import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { answerToText, findBlockDeep, formatBlockValue, formatDateString, isStructuredAnswer, resolveDataLabels } from '@/lib/response-format'
import { parseFormDocumentSettings } from '@/lib/docx-template'
import { sendDocumentForResponse } from '@/lib/document-delivery'
import { resolveFormGate, submittedCookieName, SUBMITTED_COOKIE_MAX_AGE } from '@/lib/form-gate'
import { applyWebhookSignature } from '@/lib/webhook-signature'
import { evaluateSubmissionAntiSpam } from '@/lib/form-antispam'
import { parseFormAccessSettings } from '@/lib/form-options'
import { getClientIp } from '@/lib/security'

// POST /api/forms/[id]/submit - Soumettre une réponse à un formulaire
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { data, metadata, honeypot, renderToken } = body

    // Vérifier que le formulaire existe et est publié
    const form = await prisma.form.findFirst({
      where: {
        id,
        status: 'published',
        deletedAt: null,
      },
    })

    if (!form) {
      return NextResponse.json(
        { error: 'Formulaire non trouvé ou non publié' },
        { status: 404 }
      )
    }

    // Anti-spam avant la porte d'accès : un flot automatisé doit être arrêté avant les requêtes
    // de comptage, et surtout avant les webhooks et les e-mails que déclenche une réponse admise.
    const antiSpam = evaluateSubmissionAntiSpam(parseFormAccessSettings(form.accessSettings), {
      formId: form.id,
      ip: getClientIp(request),
      honeypot,
      renderToken,
    })
    if (antiSpam.verdict === 'discard') {
      // Le leurre a été rempli : la réponse est jetée et l'appelant reçoit un succès. Lui
      // signaler l'échec reviendrait à lui indiquer quel champ laisser vide au prochain essai.
      console.warn(`Soumission ignorée (anti-spam: ${antiSpam.reason}) sur le formulaire ${form.id}`)
      return NextResponse.json({ success: true })
    }
    if (antiSpam.verdict === 'reject') {
      return NextResponse.json({ error: antiSpam.message }, { status: antiSpam.status })
    }

    // Les options d'accès sont revérifiées ici et pas seulement au rendu de la page : sans ce
    // contrôle, une requête forgée contournerait la fenêtre de publication, le mot de passe ou
    // le quota de réponses.
    const gate = await resolveFormGate(form)
    if (gate.state !== 'open') {
      return NextResponse.json({ error: gate.message }, { status: 403 })
    }

    // Résoudre les valeurs de choix (slugs → labels) avant stockage
    const blocks = JSON.parse(form.blocks || '[]') as any[]
    const resolvedData = resolveDataLabels(data, blocks)

    // Créer la réponse
    const response = await prisma.response.create({
      data: {
        formId: id,
        data: JSON.stringify(resolvedData),
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    })

    // Déclencher les webhooks
    const webhooks = JSON.parse(form.webhooks || '[]') as any[]
    // La soumission est le seul déclencheur qui existe : filtrer sur `triggerOn` laissait
    // muets les webhooks enregistrés avec une des valeurs fictives proposées autrefois par
    // l'éditeur ('partial', 'save'), sans que rien ne le signale.
    const enabledWebhooks = webhooks.filter((w) => w.enabled)

    // Stocker les résultats des webhooks
    const webhookStatus: Record<string, { success: boolean; lastSent: string; error?: string }> = {}

    // Exécuter les webhooks en arrière-plan
    for (const webhook of enabledWebhooks) {
      try {
        await triggerWebhook(webhook, data, form, response.id)
        webhookStatus[webhook.id] = {
          success: true,
          lastSent: new Date().toISOString(),
        }
      } catch (webhookError: any) {
        console.error(`Erreur webhook ${webhook.name}:`, webhookError)
        webhookStatus[webhook.id] = {
          success: false,
          lastSent: new Date().toISOString(),
          error: webhookError.message || 'Erreur inconnue',
        }
        // On continue même si un webhook échoue
      }
    }

    // Mettre à jour le statut webhook de la réponse
    if (enabledWebhooks.length > 0) {
      await prisma.response.update({
        where: { id: response.id },
        data: { webhookStatus: JSON.stringify(webhookStatus) },
      })
    }

    // Génération du document et envoi par e-mail. sendDocumentForResponse ne lève jamais et
    // enregistre son propre statut : un modèle cassé ou un SMTP injoignable ne doit pas faire
    // échouer la soumission côté répondant.
    const documentSettings = parseFormDocumentSettings(form.documentSettings)
    if (
      documentSettings.email.enabled &&
      documentSettings.email.sendOnSubmission &&
      documentSettings.template.storedName &&
      documentSettings.email.routes.some((route) => route.enabled)
    ) {
      await sendDocumentForResponse(form, response)
    }

    const result = NextResponse.json({
      success: true,
      responseId: response.id,
    })

    if (gate.settings.onePerDevice) {
      result.cookies.set(submittedCookieName(form.id), '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SUBMITTED_COOKIE_MAX_AGE,
        path: '/',
      })
    }

    return result
  } catch (error) {
    console.error('Erreur lors de la soumission:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Corps `FORM` : une valeur structurée (pièce jointe, quantité, groupe) n'a pas d'écriture
// dans un x-www-form-urlencoded. `String(objet)` donnait « [object Object] » : on écrit le
// libellé lisible pour une pièce jointe, du JSON pour le reste.
function formEncodedValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (isStructuredAnswer(value)) return answerToText(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function resolveCustomTemplate(
  template: string,
  data: Record<string, any>,
  blocks: any[],
  responseId: string,
  formId: string,
  now: Date
): string {
  const pad = (n: number) => String(n).padStart(2, '0')

  const applyDateFmt = (fmt: string) =>
    fmt
      .replace('YYYY', String(now.getFullYear()))
      .replace('YY', String(now.getFullYear()).slice(-2))
      .replace('MM', pad(now.getMonth() + 1))
      .replace('dd', pad(now.getDate()))

  const applyTimeFmt = (fmt: string) =>
    fmt
      .replace('HH', pad(now.getHours()))
      .replace('mm', pad(now.getMinutes()))
      .replace('ss', pad(now.getSeconds()))

  return template
    .replace(/\{field:([^}]+)\}/g, (_, blockId) => {
      const rawValue = data[blockId]
      if (rawValue === undefined || rawValue === null || rawValue === '') return ''
      const block = findBlockDeep(blocks, blockId)
      const formatted = formatBlockValue(block, rawValue)
      if (Array.isArray(formatted)) return formatted.join(', ')
      return String(formatted)
    })
    .replace(/\{date:([^}]+)\}/g, (_, fmt) => applyDateFmt(fmt))
    .replace(/\{time:([^}]+)\}/g, (_, fmt) => applyTimeFmt(fmt))
    .replace(/\{entry_id\}/g, responseId)
    .replace(/\{form_id\}/g, formId)
}

// Convertit un label en slug utilisable comme clé JSON (ex: "Quel matériel ?" → "quel_materiel")
function slugify(str: string): string {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'champ'
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
          repetitionData[label] = formatBlockValue(innerBlock, data[key])
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
      if (data[innerBlock.id] !== undefined) {
        const label = getBlockLabel(innerBlock)
        groupData[label] = formatBlockValue(innerBlock, data[innerBlock.id])
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
        } else if (mapping.blockId === '_custom') {
          payload[mapping.key] = mapping.customTemplate
            ? resolveCustomTemplate(mapping.customTemplate, data, blocks, responseId, form.id, new Date())
            : ''
        } else {
          // Chercher le bloc (y compris dans les innerBlocks des groupes/répéteurs)
          const block = findBlockDeep(blocks, mapping.blockId)
          if (block?.type === 'repeater' && block.innerBlocks && mapping.flatRepeater) {
            // Mode clés plates : génère {préfixe}_{champ}_{N} pour chaque champ et chaque répétition
            let rep = 1
            let hasData = true
            while (hasData) {
              let hasAnyValue = false
              for (const innerBlock of block.innerBlocks) {
                const dataKey = `${mapping.blockId}_${rep}_${innerBlock.id}`
                if (data[dataKey] !== undefined) {
                  const fieldSlug = slugify(getBlockLabel(innerBlock))
                  payload[`${mapping.key}_${fieldSlug}_${rep}`] = formatBlockValue(innerBlock, data[dataKey])
                  hasAnyValue = true
                }
              }
              if (hasAnyValue) { rep++ } else { hasData = false }
            }
          } else if (block?.type === 'repeater' && block.innerBlocks) {
            payload[mapping.key] = extractRepeaterData(mapping.blockId, block.innerBlocks)
          } else if (block?.type === 'group' && block.innerBlocks) {
            payload[mapping.key] = extractGroupData(mapping.blockId, block.innerBlocks)
          } else {
            payload[mapping.key] = formatBlockValue(block, data[mapping.blockId])
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
        payload[label] = formatBlockValue(block, data[block.id])
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
        Object.entries(payload).map(([k, v]) => [k, formEncodedValue(v)])
      ).toString()
    } else {
      bodyContent = JSON.stringify(payload)
    }
  }

  // Envoyer la requête, signée si le webhook porte un secret
  applyWebhookSignature(requestHeaders, webhook.secret, bodyContent)

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
