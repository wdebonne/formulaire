import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/forms/[id]/submit - Soumettre une réponse à un formulaire
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { data, metadata } = body

    // Vérifier que le formulaire existe et est publié
    const form = await prisma.form.findFirst({
      where: {
        id,
        status: 'published',
      },
    })

    if (!form) {
      return NextResponse.json(
        { error: 'Formulaire non trouvé ou non publié' },
        { status: 404 }
      )
    }

    // Créer la réponse
    const response = await prisma.response.create({
      data: {
        formId: id,
        data: JSON.stringify(data),
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    })

    // Déclencher les webhooks
    const webhooks = JSON.parse(form.webhooks || '[]') as any[]
    const enabledWebhooks = webhooks.filter(
      (w) => w.enabled && (w.triggerOn === 'submission' || !w.triggerOn)
    )

    // Exécuter les webhooks en arrière-plan
    for (const webhook of enabledWebhooks) {
      try {
        await triggerWebhook(webhook, data, form, response.id)
      } catch (webhookError) {
        console.error(`Erreur webhook ${webhook.name}:`, webhookError)
        // On continue même si un webhook échoue
      }
    }

    return NextResponse.json({
      success: true,
      responseId: response.id,
    })
  } catch (error) {
    console.error('Erreur lors de la soumission:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function triggerWebhook(webhook: any, data: Record<string, any>, form: any, responseId: string) {
  const { url, method, headers, bodyFormat, fieldMappings } = webhook

  let payload: Record<string, any> = {}
  const blocks = JSON.parse(form.blocks || '[]') as any[]

  // Helper pour obtenir le label d'un bloc
  const getBlockLabel = (block: any) => block?.attributes?.label || block?.id || 'unknown'

  // Helper pour extraire les données des repeaters
  const extractRepeaterData = (repeaterId: string, innerBlocks: any[]) => {
    const repeaterData: Record<string, any>[] = []
    
    // Trouver toutes les répétitions
    let repetition = 1
    let hasData = true
    
    while (hasData) {
      const repetitionData: Record<string, any> = {}
      let hasAnyValue = false
      
      for (const innerBlock of innerBlocks) {
        const key = `${repeaterId}_${repetition}_${innerBlock.id}`
        if (data[key] !== undefined) {
          const label = getBlockLabel(innerBlock)
          repetitionData[label] = data[key]
          hasAnyValue = true
        }
      }
      
      if (hasAnyValue) {
        repeaterData.push(repetitionData)
        repetition++
      } else {
        hasData = false
      }
    }
    
    return repeaterData
  }

  // Helper pour extraire les données des groupes
  const extractGroupData = (groupId: string, innerBlocks: any[]) => {
    const groupData: Record<string, any> = {}
    
    for (const innerBlock of innerBlocks) {
      // Les blocs dans un groupe sont stockés directement avec leur ID
      if (data[innerBlock.id] !== undefined) {
        const label = getBlockLabel(innerBlock)
        groupData[label] = data[innerBlock.id]
      }
    }
    
    return groupData
  }

  // Construire le payload selon les mappings
  if (fieldMappings && fieldMappings.length > 0) {
    for (const mapping of fieldMappings) {
      if (mapping.key) {
        if (mapping.blockId === 'entry_date') {
          payload[mapping.key] = new Date().toISOString()
        } else if (mapping.blockId === 'entry_id') {
          payload[mapping.key] = responseId
        } else {
          // Vérifier si c'est un repeater ou un group
          const block = blocks.find((b: any) => b.id === mapping.blockId)
          if (block?.type === 'repeater' && block.innerBlocks) {
            payload[mapping.key] = extractRepeaterData(mapping.blockId, block.innerBlocks)
          } else if (block?.type === 'group' && block.innerBlocks) {
            payload[mapping.key] = extractGroupData(mapping.blockId, block.innerBlocks)
          } else {
            payload[mapping.key] = data[mapping.blockId]
          }
        }
      }
    }
  } else {
    // Si aucun mapping, envoyer toutes les données
    for (const block of blocks) {
      // Gérer les repeaters
      if (block.type === 'repeater' && block.innerBlocks) {
        const repeaterData = extractRepeaterData(block.id, block.innerBlocks)
        if (repeaterData.length > 0) {
          const label = getBlockLabel(block)
          payload[label] = repeaterData
        }
      // Gérer les groupes
      } else if (block.type === 'group' && block.innerBlocks) {
        const groupData = extractGroupData(block.id, block.innerBlocks)
        if (Object.keys(groupData).length > 0) {
          const label = getBlockLabel(block)
          payload[label] = groupData
        }
      } else if (data[block.id] !== undefined) {
        const label = getBlockLabel(block)
        payload[label] = data[block.id]
      }
    }
    // Ajouter des métadonnées
    payload._responseId = responseId
    payload._formId = form.id
    payload._formTitle = form.title
    payload._submittedAt = new Date().toISOString()
  }

  // Construire les headers
  const requestHeaders: Record<string, string> = {}
  
  if (bodyFormat === 'JSON') {
    requestHeaders['Content-Type'] = 'application/json'
  } else if (bodyFormat === 'FORM') {
    requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
  } else {
    requestHeaders['Content-Type'] = 'application/json'
  }

  for (const header of headers || []) {
    if (header.key && header.value) {
      requestHeaders[header.key] = header.value
    }
  }

  // Préparer le body
  let bodyContent: string | undefined
  if (method !== 'GET') {
    if (bodyFormat === 'FORM') {
      bodyContent = new URLSearchParams(
        Object.entries(payload).map(([k, v]) => [k, String(v ?? '')])
      ).toString()
    } else {
      bodyContent = JSON.stringify(payload)
    }
  }

  // Envoyer la requête
  const response = await fetch(url, {
    method: method || 'POST',
    headers: requestHeaders,
    body: bodyContent,
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`Webhook responded with status ${response.status}: ${responseText.substring(0, 200)}`)
  }

  return response
}
