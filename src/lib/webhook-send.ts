// Construction et envoi du corps d'un webhook.
//
// Ce code vivait en double : une copie dans la route de soumission, une autre dans la route de
// relance manuelle. La file de reprise en aurait fait une troisième — d'où l'extraction. Aucun
// import Prisma ici : la file, elle, est dans webhook-queue.ts.
//
// Les valeurs partent en libellés lisibles, jamais en slugs : c'est un destinataire externe qui
// les reçoit, et « service-informatique » ne lui apprend rien que « Service informatique » ne dise
// mieux.

import {
  answerToText,
  findBlockDeep,
  formatBlockValue,
  isStructuredAnswer,
} from './response-format'
import { applyWebhookSignature } from './webhook-signature'

// Un récepteur qui ne répond jamais bloquerait la soumission du répondant jusqu'au délai du
// serveur. Passé ce délai, l'envoi est compté en échec et repasse par la file de reprise.
export const WEBHOOK_TIMEOUT_MS = 10_000

export interface WebhookConfig {
  id: string
  name?: string
  url: string
  method?: string
  headers?: { key: string; value: string }[]
  bodyFormat?: string
  fieldMappings?: {
    key: string
    blockId: string
    flatRepeater?: boolean
    customTemplate?: string
  }[]
  secret?: string
  enabled?: boolean
}

export interface WebhookFormInput {
  id: string
  title: string
  blocks: string
}

// Corps `FORM` : une valeur structurée (pièce jointe, quantité, groupe) n'a pas d'écriture dans un
// x-www-form-urlencoded. `String(objet)` donnait « [object Object] » : on écrit le libellé lisible
// pour une pièce jointe, du JSON pour le reste.
function formEncodedValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (isStructuredAnswer(value)) return answerToText(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Convertit un label en slug utilisable comme clé JSON (ex: "Quel matériel ?" → "quel_materiel")
function slugify(str: string): string {
  return (
    String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'champ'
  )
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

export function buildWebhookPayload(
  webhook: WebhookConfig,
  data: Record<string, any>,
  form: WebhookFormInput,
  responseId: string,
  now: Date = new Date()
): Record<string, any> {
  const { fieldMappings } = webhook
  const payload: Record<string, any> = {}
  const blocks = JSON.parse(form.blocks || '[]') as any[]

  const getBlockLabel = (block: any) => block?.attributes?.label || block?.id || 'unknown'

  const extractRepeaterData = (repeaterId: string, innerBlocks: any[]) => {
    const repeaterData: Record<string, any>[] = []
    let repetition = 1
    let hasData = true

    while (hasData) {
      const repetitionData: Record<string, any> = {}
      let hasAnyValue = false

      for (const innerBlock of innerBlocks) {
        const key = `${repeaterId}_${repetition}_${innerBlock.id}`
        if (data[key] !== undefined) {
          repetitionData[getBlockLabel(innerBlock)] = formatBlockValue(innerBlock, data[key])
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

  const extractGroupData = (groupId: string, innerBlocks: any[]) => {
    const groupData: Record<string, any> = {}
    for (const innerBlock of innerBlocks) {
      if (data[innerBlock.id] !== undefined) {
        groupData[getBlockLabel(innerBlock)] = formatBlockValue(innerBlock, data[innerBlock.id])
      }
    }
    return groupData
  }

  if (fieldMappings && fieldMappings.length > 0) {
    for (const mapping of fieldMappings) {
      if (!mapping.key) continue

      if (mapping.blockId === 'entry_date') {
        payload[mapping.key] = now.toISOString()
      } else if (mapping.blockId === 'entry_id') {
        payload[mapping.key] = responseId
      } else if (mapping.blockId === '_custom') {
        payload[mapping.key] = mapping.customTemplate
          ? resolveCustomTemplate(mapping.customTemplate, data, blocks, responseId, form.id, now)
          : ''
      } else {
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
                payload[`${mapping.key}_${fieldSlug}_${rep}`] = formatBlockValue(
                  innerBlock,
                  data[dataKey]
                )
                hasAnyValue = true
              }
            }
            if (hasAnyValue) rep++
            else hasData = false
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

    return payload
  }

  // Sans mapping, tout part, plus quelques métadonnées.
  for (const block of blocks) {
    if (block.type === 'repeater' && block.innerBlocks) {
      const repeaterData = extractRepeaterData(block.id, block.innerBlocks)
      if (repeaterData.length > 0) payload[getBlockLabel(block)] = repeaterData
    } else if (block.type === 'group' && block.innerBlocks) {
      const groupData = extractGroupData(block.id, block.innerBlocks)
      if (Object.keys(groupData).length > 0) payload[getBlockLabel(block)] = groupData
    } else if (data[block.id] !== undefined) {
      payload[getBlockLabel(block)] = formatBlockValue(block, data[block.id])
    }
  }

  payload._responseId = responseId
  payload._formId = form.id
  payload._formTitle = form.title
  payload._submittedAt = now.toISOString()

  return payload
}

export function buildWebhookRequest(
  webhook: WebhookConfig,
  payload: Record<string, any>
): { headers: Record<string, string>; body?: string } {
  const { method, headers, bodyFormat } = webhook

  const requestHeaders: Record<string, string> = {
    'Content-Type': bodyFormat === 'FORM' ? 'application/x-www-form-urlencoded' : 'application/json',
  }

  for (const header of headers || []) {
    if (header.key && header.value) requestHeaders[header.key] = header.value
  }

  let body: string | undefined
  if (method !== 'GET') {
    body =
      bodyFormat === 'FORM'
        ? new URLSearchParams(
            Object.entries(payload).map(([k, v]) => [k, formEncodedValue(v)])
          ).toString()
        : JSON.stringify(payload)
  }

  // La signature porte sur la chaîne exactement envoyée : re-sérialiser l'objet avant de signer
  // produirait un condensat que le destinataire ne peut pas reproduire.
  applyWebhookSignature(requestHeaders, webhook.secret, body)

  return { headers: requestHeaders, body }
}

/** Envoie le webhook. Lève sur échec réseau, délai dépassé ou statut non 2xx. */
export async function sendWebhook(
  webhook: WebhookConfig,
  data: Record<string, any>,
  form: WebhookFormInput,
  responseId: string
): Promise<void> {
  const payload = buildWebhookPayload(webhook, data, form, responseId)
  const { headers, body } = buildWebhookRequest(webhook, payload)

  const response = await fetch(webhook.url, {
    method: webhook.method || 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(
      `Webhook responded with status ${response.status}: ${responseText.substring(0, 200)}`
    )
  }
}
