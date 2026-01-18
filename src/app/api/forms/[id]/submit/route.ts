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
    const webhooks = JSON.parse(form.webhooks) as any[]
    const enabledWebhooks = webhooks.filter(
      (w) => w.enabled && (w.trigger === 'submission' || w.trigger === 'all')
    )

    // Exécuter les webhooks en arrière-plan
    for (const webhook of enabledWebhooks) {
      try {
        await triggerWebhook(webhook, data, form)
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

async function triggerWebhook(webhook: any, data: Record<string, any>, form: any) {
  const { url, method, headers, bodyFormat, fieldMappings } = webhook

  let body: any = {}

  // Construire le corps de la requête selon le format
  if (bodyFormat === 'raw') {
    body = data
  } else {
    // Format mappé
    const blocks = JSON.parse(form.blocks) as any[]

    for (const mapping of fieldMappings || []) {
      const block = blocks.find((b) => b.id === mapping.blockId)
      const key = mapping.webhookField || block?.attributes?.label || mapping.blockId
      body[key] = data[mapping.blockId]
    }

    // Si aucun mapping, envoyer toutes les données avec les labels comme clés
    if (!fieldMappings || fieldMappings.length === 0) {
      for (const block of blocks) {
        if (data[block.id] !== undefined) {
          const key = block.attributes?.label || block.id
          body[key] = data[block.id]
        }
      }
    }
  }

  // Ajouter des métadonnées
  body._formId = form.id
  body._formTitle = form.title
  body._submittedAt = new Date().toISOString()

  // Construire les headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  for (const header of headers || []) {
    if (header.key && header.value) {
      requestHeaders[header.key] = header.value
    }
  }

  // Envoyer la requête
  const response = await fetch(url, {
    method: method || 'POST',
    headers: requestHeaders,
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`Webhook responded with status ${response.status}`)
  }

  return response
}
