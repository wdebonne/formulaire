// Remplissage d'un modèle .docx à partir d'une réponse de formulaire.
//
// Utilise docxtemplater (MIT) plutôt que Carbone : depuis la v3.5.5, Carbone est distribué sous
// « Carbone Community License », qui ajoute des restrictions d'usage (pas d'exposition de la
// fonctionnalité à des tiers, même via un wrapper) incompatibles avec l'AGPLv3 §7 de ce projet.
//
// Server-only : importe le système de fichiers indirectement via les appelants et manipule des
// Buffer Node. Le catalogue des champs, lui, vit dans document-fields.ts pour rester importable
// depuis un composant client.

import Docxtemplater from 'docxtemplater'
// inspect-module.js dépend de lodash, absent des dépendances de docxtemplater ; get-tags.js
// en est exempt et suffit, à condition de récupérer soi-même le postparsed (voir plus bas).
import { getTags } from 'docxtemplater/js/get-tags.js'
import PizZip from 'pizzip'
import { findBlockDeep, formatBlockValue } from './response-format'
import type {
  DocumentFieldMapping,
  DocumentEmailSettings,
  DocumentTemplateSettings,
  FormDocumentSettings,
} from '@/types/form'

export const DEFAULT_DOCUMENT_EMAIL: DocumentEmailSettings = {
  enabled: false,
  sendOnSubmission: true,
  recipients: [],
  recipientBlockIds: [],
  subject: 'Nouvelle réponse — {form_title}',
  body:
    '<p>Bonjour,</p>\n' +
    '<p>Veuillez trouver ci-joint le document généré à partir de la réponse au formulaire ' +
    '« {form_title} » reçue le {entry_date}.</p>\n' +
    '<p>Cordialement,</p>',
}

export const DEFAULT_DOCUMENT_TEMPLATE: DocumentTemplateSettings = {
  mappings: [],
  outputFormat: 'docx',
  outputName: '{form_title} - {entry_date}',
}

export function parseFormDocumentSettings(raw: string | null | undefined): FormDocumentSettings {
  let parsed: Partial<FormDocumentSettings> = {}
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch {
    parsed = {}
  }
  return {
    template: { ...DEFAULT_DOCUMENT_TEMPLATE, ...(parsed.template ?? {}) },
    email: { ...DEFAULT_DOCUMENT_EMAIL, ...(parsed.email ?? {}) },
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Word n'accepte que du texte : tout ce qui n'est pas une chaîne doit être aplati ici,
// sinon docxtemplater injecte "[object Object]" dans le document.
function toText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k} : ${toText(v)}`)
      .join(', ')
  }
  return String(value)
}

interface DocumentContext {
  responseId: string
  createdAt: Date
  formTitle: string
}

/**
 * Construit l'objet passé à docxtemplater : une clé par jeton.
 *
 * Les valeurs de Response.data sont déjà résolues en libellés lisibles à la soumission
 * (resolveDataLabels). formatBlockValue est néanmoins réappliqué ici : il est idempotent sur
 * une valeur déjà résolue, et couvre les réponses enregistrées avant cette résolution.
 */
export function buildDocumentData(
  blocks: any[],
  mappings: DocumentFieldMapping[],
  responseData: Record<string, any>,
  context: DocumentContext
): Record<string, any> {
  const tagByBlockId = new Map(mappings.map((m) => [m.blockId, m.tag]))
  const data: Record<string, any> = {}

  for (const mapping of mappings) {
    const { tag, blockId } = mapping

    if (blockId === 'entry_id') {
      data[tag] = context.responseId
      continue
    }
    if (blockId === 'entry_date') {
      data[tag] = formatDate(context.createdAt)
      continue
    }
    if (blockId === 'today') {
      data[tag] = formatDate(new Date())
      continue
    }
    if (blockId === 'form_title') {
      data[tag] = context.formTitle
      continue
    }

    const block = findBlockDeep(blocks, blockId)

    // Répéteur → tableau d'objets consommé par {#tag} … {/tag}. Les clés de Response.data
    // suivent le format {repeaterId}_{n}_{innerBlockId} (cf. convention « Repeater State »).
    if (block?.type === 'repeater' && block.innerBlocks?.length) {
      const rows: Record<string, string>[] = []
      let rep = 1
      for (;;) {
        const row: Record<string, string> = {}
        let hasValue = false
        for (const inner of block.innerBlocks) {
          const key = `${blockId}_${rep}_${inner.id}`
          if (responseData[key] === undefined) continue
          const innerTag = tagByBlockId.get(inner.id)
          if (!innerTag) continue
          row[innerTag] = toText(formatBlockValue(inner, responseData[key]))
          hasValue = true
        }
        if (!hasValue) break
        rows.push(row)
        rep++
      }
      data[tag] = rows
      continue
    }

    // Les blocs internes d'un répéteur sont déjà couverts par la boucle ci-dessus ; leur
    // jeton ne doit pas être écrasé par une valeur de premier niveau inexistante.
    if (data[tag] !== undefined) continue

    data[tag] = toText(formatBlockValue(block, responseData[blockId]))
  }

  return data
}

function describeRenderError(error: any): string {
  const inner = error?.properties?.errors
  if (Array.isArray(inner) && inner.length > 0) {
    const details = inner
      .map((e: any) => e?.properties?.explanation || e?.message)
      .filter(Boolean)
      .slice(0, 5)
      .join(' ; ')
    if (details) return `Modèle .docx invalide : ${details}`
  }
  return error?.message ? `Modèle .docx invalide : ${error.message}` : 'Modèle .docx invalide'
}

export function renderDocx(templateBuffer: Buffer, data: Record<string, any>): Buffer {
  let doc: Docxtemplater
  try {
    const zip = new PizZip(templateBuffer)
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    })
  } catch (error: any) {
    throw new Error(describeRenderError(error))
  }

  try {
    doc.render(data)
  } catch (error: any) {
    throw new Error(describeRenderError(error))
  }

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

// Jetons réellement présents dans le .docx — sert au tableau de contrôle de la modale
// (jeton reconnu / jeton inconnu / champ non utilisé).
export function inspectDocxTags(templateBuffer: Buffer): string[] {
  // Module minimal au sens de docxtemplater : n'implémenter que `set` suffit, le reste des
  // hooks reçoit des implémentations par défaut. Il sert uniquement à capturer le postparsed
  // de chaque partie du document, seule entrée attendue par getTags().
  const postparsedByFile: Record<string, unknown> = {}
  let currentFile = ''
  const captureModule = {
    name: 'FormbuilderTagInspector',
    set(obj: any) {
      if (!obj?.inspect) return
      if (obj.inspect.filePath) currentFile = obj.inspect.filePath
      if (obj.inspect.postparsed) postparsedByFile[currentFile] = obj.inspect.postparsed
    },
  }

  try {
    const zip = new PizZip(templateBuffer)
    // La construction compile le modèle, ce qui alimente le module de capture.
    new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [captureModule as any],
    })
  } catch (error: any) {
    throw new Error(describeRenderError(error))
  }

  const found = new Set<string>()
  const walk = (node: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(node ?? {})) {
      found.add(key)
      if (value && typeof value === 'object') walk(value as Record<string, unknown>)
    }
  }
  for (const postparsed of Object.values(postparsedByFile)) {
    walk(getTags(postparsed) as Record<string, unknown>)
  }
  return Array.from(found)
}

// Remplace les {jetons} d'un gabarit texte (sujet d'e-mail, nom de fichier, corps du message).
export function applyTags(template: string, data: Record<string, any>): string {
  // Un jeton inconnu est vidé plutôt que laissé tel quel, comme le nullGetter du rendu .docx.
  return template.replace(/\{([a-z0-9_]+)\}/gi, (_match, tag) => {
    const value = data[tag]
    if (Array.isArray(value)) return ''
    return toText(value)
  })
}

// Nettoie un nom de fichier de pièce jointe : on ne retire que les caractères interdits par
// les systèmes de fichiers — espaces et tirets doivent survivre au passage.
export function safeFileName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return cleaned || fallback
}
