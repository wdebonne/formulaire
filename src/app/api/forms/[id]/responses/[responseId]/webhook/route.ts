import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Webhook {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: { key: string; value: string }[]
  bodyFormat: 'JSON' | 'FORM'
  fieldMappings: { key: string; blockId: string; flatRepeater?: boolean }[]
  enabled: boolean
  triggerOn: string
}

function slugify(str: string): string {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'champ'
}

// POST /api/forms/[id]/responses/[responseId]/webhook - Renvoyer le webhook pour une réponse
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id, responseId } = await params
    const body = await request.json()
    const { webhookId } = body // Optionnel: spécifier un webhook particulier

    // Vérifier que le formulaire appartient à l'utilisateur
    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    // Récupérer la réponse
    const response = await prisma.response.findFirst({
      where: {
        id: responseId,
        formId: id,
      },
    })

    if (!response) {
      return NextResponse.json({ error: 'Réponse non trouvée' }, { status: 404 })
    }

    const webhooks: Webhook[] = JSON.parse(form.webhooks || '[]')
    const responseData = JSON.parse(response.data || '{}')
    const blocks = JSON.parse(form.blocks || '[]')

    // Filtrer les webhooks actifs (et éventuellement par ID)
    const webhooksToSend = webhooks.filter(
      (w) => w.enabled && (!webhookId || w.id === webhookId)
    )

    if (webhooksToSend.length === 0) {
      return NextResponse.json(
        { error: 'Aucun webhook actif trouvé' },
        { status: 400 }
      )
    }

    const results: {
      webhookId: string
      webhookName: string
      success: boolean
      status?: number
      statusText?: string
      duration?: number
      error?: string
      response?: string
    }[] = []

    // Helper pour obtenir le label d'un bloc
    const getBlockLabel = (block: any) => block?.attributes?.label || block?.id || 'unknown'

    // Nettoie le préfixe __other__: des valeurs de type choix (Autre / saisie libre)
    const cleanValue = (rawValue: any): any => {
      if (typeof rawValue === 'string') return rawValue.startsWith('__other__:') ? rawValue.slice(10) : rawValue
      if (Array.isArray(rawValue)) return rawValue.map((v: any) => typeof v === 'string' && v.startsWith('__other__:') ? v.slice(10) : v).join(', ')
      return rawValue
    }

    // Formate la valeur d'un bloc selon son type
    const formatBlockValue = (block: any, rawValue: any): any => {
      if (rawValue === undefined || rawValue === null) return rawValue
      // Quantité
      if (block?.type === 'quantity' && rawValue && typeof rawValue === 'object') {
        const outputFormat = block.attributes?.quantityOutputFormat || 'object'
        if (outputFormat === 'value') {
          const quantities = Object.values(rawValue) as number[]
          if (quantities.length === 1) return String(quantities[0])
          return quantities.join(', ')
        }
        // Format objet : nettoyer les clés __other__:
        const cleaned: Record<string, any> = {}
        for (const [k, v] of Object.entries(rawValue)) {
          cleaned[k.startsWith('__other__:') ? k.slice(10) : k] = v
        }
        return cleaned
      }
      // Choix (dropdown, multiple-choice, image-selection) : nettoyer __other__:
      if (['dropdown', 'multiple-choice', 'image-selection'].includes(block?.type)) {
        return cleanValue(rawValue)
      }
      return rawValue
    }

    // Alias pour compatibilité avec le code existant
    const formatQuantityValue = formatBlockValue

    // Helper pour extraire les données des repeaters
    const extractRepeaterData = (repeaterId: string, innerBlocks: any[], data: Record<string, any>) => {
      const repeaterData: Record<string, any>[] = []

      let repetition = 1
      let hasData = true

      while (hasData) {
        const repetitionData: Record<string, any> = {}
        let hasAnyValue = false

        for (const innerBlock of innerBlocks) {
          const key = `${repeaterId}_${repetition}_${innerBlock.id}`
          if (data[key] !== undefined) {
            const label = getBlockLabel(innerBlock)
            repetitionData[label] = formatQuantityValue(innerBlock, data[key])
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
    const extractGroupData = (groupId: string, innerBlocks: any[], data: Record<string, any>) => {
      const groupData: Record<string, any> = {}

      for (const innerBlock of innerBlocks) {
        if (data[innerBlock.id] !== undefined) {
          const label = getBlockLabel(innerBlock)
          groupData[label] = formatQuantityValue(innerBlock, data[innerBlock.id])
        }
      }

      return groupData
    }

    for (const webhook of webhooksToSend) {
      try {
        // Construire le payload selon les mappings
        const payload: Record<string, any> = {}

        if (webhook.fieldMappings && webhook.fieldMappings.length > 0) {
          for (const mapping of webhook.fieldMappings) {
            if (mapping.key) {
              if (mapping.blockId === 'entry_date') {
                payload[mapping.key] = response.createdAt.toISOString()
              } else if (mapping.blockId === 'entry_id') {
                payload[mapping.key] = response.id
              } else {
                // Vérifier si c'est un repeater ou un group
                const block = blocks.find((b: any) => b.id === mapping.blockId)
                if (block?.type === 'repeater' && block.innerBlocks && mapping.flatRepeater) {
                  // Mode clés plates : génère {préfixe}_{champ}_{N}
                  let rep = 1
                  let hasData = true
                  while (hasData) {
                    let hasAnyValue = false
                    for (const innerBlock of block.innerBlocks) {
                      const dataKey = `${mapping.blockId}_${rep}_${innerBlock.id}`
                      if (responseData[dataKey] !== undefined) {
                        const fieldSlug = slugify(innerBlock.attributes?.label || innerBlock.id || 'champ')
                        payload[`${mapping.key}_${fieldSlug}_${rep}`] = formatQuantityValue(innerBlock, responseData[dataKey])
                        hasAnyValue = true
                      }
                    }
                    if (hasAnyValue) { rep++ } else { hasData = false }
                  }
                } else if (block?.type === 'repeater' && block.innerBlocks) {
                  payload[mapping.key] = extractRepeaterData(mapping.blockId, block.innerBlocks, responseData)
                } else if (block?.type === 'group' && block.innerBlocks) {
                  payload[mapping.key] = extractGroupData(mapping.blockId, block.innerBlocks, responseData)
                } else {
                  payload[mapping.key] = formatQuantityValue(block, responseData[mapping.blockId])
                }
              }
            }
          }
        } else {
          // Si pas de mapping, envoyer toutes les données avec gestion des repeaters et groupes
          for (const block of blocks) {
            if (block.type === 'repeater' && block.innerBlocks) {
              const repeaterData = extractRepeaterData(block.id, block.innerBlocks, responseData)
              if (repeaterData.length > 0) {
                const label = getBlockLabel(block)
                payload[label] = repeaterData
              }
            } else if (block.type === 'group' && block.innerBlocks) {
              const groupData = extractGroupData(block.id, block.innerBlocks, responseData)
              if (Object.keys(groupData).length > 0) {
                const label = getBlockLabel(block)
                payload[label] = groupData
              }
            } else if (responseData[block.id] !== undefined) {
              const label = getBlockLabel(block)
              payload[label] = formatQuantityValue(block, responseData[block.id])
            }
          }
          payload._responseId = response.id
          payload._formId = form.id
          payload._submittedAt = response.createdAt.toISOString()
        }

        // Construire les headers
        const requestHeaders: Record<string, string> = {}
        if (webhook.bodyFormat === 'JSON') {
          requestHeaders['Content-Type'] = 'application/json'
        } else {
          requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
        }

        for (const header of webhook.headers || []) {
          if (header.key && header.value) {
            requestHeaders[header.key] = header.value
          }
        }

        const startTime = Date.now()

        // Préparer le body
        let bodyContent: string | undefined
        if (webhook.method !== 'GET') {
          if (webhook.bodyFormat === 'JSON') {
            bodyContent = JSON.stringify(payload)
          } else {
            bodyContent = new URLSearchParams(
              Object.entries(payload).map(([k, v]) => [k, String(v)])
            ).toString()
          }
        }

        const fetchResponse = await fetch(webhook.url, {
          method: webhook.method,
          headers: requestHeaders,
          body: bodyContent,
        })

        const duration = Date.now() - startTime
        let responseText = ''
        try {
          responseText = await fetchResponse.text()
        } catch {
          // Ignorer les erreurs de lecture du body
        }

        results.push({
          webhookId: webhook.id,
          webhookName: webhook.name,
          success: fetchResponse.ok,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          duration,
          response: responseText.substring(0, 500), // Limiter la taille
        })
      } catch (error: any) {
        results.push({
          webhookId: webhook.id,
          webhookName: webhook.name,
          success: false,
          error: error.message || 'Erreur de connexion',
        })
      }
    }

    const allSuccess = results.every((r) => r.success)

    // Mettre à jour le statut webhook de la réponse
    const existingStatus = JSON.parse(response.webhookStatus || '{}')
    const updatedStatus: Record<string, { success: boolean; lastSent: string; error?: string }> = { ...existingStatus }
    
    for (const result of results) {
      updatedStatus[result.webhookId] = {
        success: result.success,
        lastSent: new Date().toISOString(),
        ...(result.error && { error: result.error }),
      }
    }

    await prisma.response.update({
      where: { id: responseId },
      data: { webhookStatus: JSON.stringify(updatedStatus) },
    })

    return NextResponse.json({
      success: allSuccess,
      results,
    })
  } catch (error) {
    console.error('Erreur lors du renvoi du webhook:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
