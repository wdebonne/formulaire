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
    const enabledWebhooks = webhooks.filter(
      (w) => w.enabled && (w.triggerOn === 'submission' || !w.triggerOn)
    )

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

    return NextResponse.json({
      success: true,
      responseId: response.id,
    })
  } catch (error) {
    console.error('Erreur lors de la soumission:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Formate une date YYYY-MM-DD selon le format configuré sur le bloc (ex: DD/MM/YYYY)
function formatDateString(isoDate: string, format: string): string {
  // Accepte YYYY-MM-DD mais aussi un objet { start, end } sérialisé comme chaîne
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(isoDate)
  const [, year, month, day] = m
  // Remplacer les tokens les plus longs en premier pour éviter les collisions (YYYY avant YY, etc.)
  return format
    .replace('YYYY', year)
    .replace('YY', year.slice(-2))
    .replace('MM', month)
    .replace('DD', day)
}

// Résout les valeurs brutes (slugs de choix, dates) en valeurs lisibles pour tous les champs soumis.
function resolveDataLabels(data: Record<string, any>, blocks: any[]): Record<string, any> {
  const resolved: Record<string, any> = {}

  for (const [key, value] of Object.entries(data)) {
    // Clés de contrôle du répéteur (_initial, _repeat_N) : on garde as-is
    if (/_initial$/.test(key) || /_repeat_\d+$/.test(key)) {
      resolved[key] = value
      continue
    }

    // Clé directe (bloc de premier niveau ou groupe)
    let block = findBlockDeep(blocks, key)

    // Clé de répéteur : format {repeaterId}_{repNum}_{innerBlockId}
    if (!block) {
      const match = key.match(/^(.+)_(\d+)_(.+)$/)
      if (match) {
        const [, , , innerBlockId] = match
        block = findBlockDeep(blocks, innerBlockId)
      }
    }

    resolved[key] = formatBlockValue(block, value)
  }

  return resolved
}

// Cherche un bloc par ID dans les blocs de premier niveau ET dans leurs innerBlocks.
// Nécessaire car les blocs internes d'un groupe/répéteur ne sont pas dans le tableau racine.
function findBlockDeep(blocks: any[], blockId: string): any | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return block
    if (block.innerBlocks?.length) {
      const inner = block.innerBlocks.find((ib: any) => ib.id === blockId)
      if (inner) return inner
    }
  }
  return undefined
}

// Convertit une valeur brute en valeur lisible selon le type du bloc :
//  - date / advanced-date → format configuré (DD/MM/YYYY…)
//  - multiple-choice / dropdown / image-selection → label du choix (pas la valeur slug)
function formatBlockValue(block: any, rawValue: any): any {
  if (rawValue === undefined || rawValue === null) return rawValue
  if (!block) return rawValue // bloc introuvable → valeur brute inchangée

  // ── Dates ──────────────────────────────────────────────────────────────────
  if (block.type === 'date' && typeof rawValue === 'string') {
    const fmt = block.attributes?.format || 'DD/MM/YYYY'
    return formatDateString(rawValue, fmt)
  }

  if (block.type === 'advanced-date') {
    const fmt = block.attributes?.format || 'DD/MM/YYYY'
    if (typeof rawValue === 'string') return formatDateString(rawValue, fmt)
    // Plage de dates : { start, end }
    if (rawValue && typeof rawValue === 'object' && rawValue.start) {
      const start = formatDateString(rawValue.start, fmt)
      const end   = rawValue.end ? formatDateString(rawValue.end, fmt) : ''
      return end ? `${start} - ${end}` : start
    }
    return rawValue
  }

  // ── Quantité ───────────────────────────────────────────────────────────────
  if (block.type === 'quantity' && rawValue && typeof rawValue === 'object') {
    const outputFormat = block.attributes?.quantityOutputFormat || 'object'
    if (outputFormat === 'value') {
      const quantities = Object.values(rawValue) as number[]
      if (quantities.length === 1) return String(quantities[0])
      return quantities.join(', ')
    }
    // Format objet : nettoyer les clés __other__:
    const cleaned: Record<string, any> = {}
    for (const [k, v] of Object.entries(rawValue)) {
      const cleanKey = k.startsWith('__other__:') ? k.slice(10) : k
      cleaned[cleanKey] = v
    }
    return cleaned
  }

  // ── Choix (multiple-choice, dropdown, image-selection) ─────────────────────
  const choices: any[] = block.attributes?.choices || []
  const stripOther = (v: string) => v.startsWith('__other__:') ? v.slice(10) : v
  if (choices.length) {
    const findLabel = (v: string) => {
      if (v.startsWith('__other__:')) return v.slice(10)
      const c = choices.find((c: any) => c.value === v || c.id === v || c.label === v)
      return c?.label ?? v
    }
    if (Array.isArray(rawValue)) return rawValue.map(findLabel).join(', ')
    return findLabel(String(rawValue))
  }
  // Pas de choices définis (ex: dropdown allowCustomValue sans liste) : nettoyer quand même
  if (typeof rawValue === 'string') return stripOther(rawValue)
  if (Array.isArray(rawValue)) return rawValue.map((v: any) => typeof v === 'string' ? stripOther(v) : v).join(', ')

  return rawValue
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
