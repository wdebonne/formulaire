// Remplissage d'un modèle .docx à partir d'une réponse de formulaire.
//
// Utilise docxtemplater (MIT) plutôt que Carbone : depuis la v3.5.5, Carbone est distribué sous
// « Carbone Community License », qui ajoute des restrictions d'usage (pas d'exposition de la
// fonctionnalité à des tiers, même via un wrapper) incompatibles avec l'AGPLv3 §7 de ce projet.
//
// Server-only : importe le système de fichiers indirectement via les appelants et manipule des
// Buffer Node. Le catalogue des champs, lui, vit dans document-fields.ts pour rester importable
// depuis un composant client.

import { randomUUID } from 'crypto'
import Docxtemplater from 'docxtemplater'
// inspect-module.js dépend de lodash, absent des dépendances de docxtemplater ; get-tags.js
// en est exempt et suffit, à condition de récupérer soi-même le postparsed (voir plus bas).
import { getTags } from 'docxtemplater/js/get-tags.js'
import PizZip from 'pizzip'
import { answerToText, findBlockDeep, formatBlockValue, formatReadableValue, isStructuredAnswer } from './response-format'
import type {
  DocumentCheckboxStyle,
  DocumentEmailRoute,
  DocumentFieldMapping,
  DocumentEmailSettings,
  DocumentTemplateSettings,
  FormDocumentSettings,
} from '@/types/form'
import { applyTokenTemplate } from './token-format'

export const DEFAULT_EMAIL_SUBJECT = 'Nouvelle réponse — {form_title}'

export const DEFAULT_EMAIL_BODY =
  '<p>Bonjour,</p>\n' +
  '<p>Veuillez trouver ci-joint le document généré à partir de la réponse au formulaire ' +
  '« {form_title} » reçue le {entry_date}.</p>\n' +
  '<p>Cordialement,</p>'

export const DEFAULT_DOCUMENT_EMAIL: DocumentEmailSettings = {
  enabled: false,
  sendOnSubmission: true,
  routes: [],
}

export const DEFAULT_DOCUMENT_TEMPLATE: DocumentTemplateSettings = {
  mappings: [],
  outputFormat: 'docx',
  outputName: '{form_title} - {entry_date}',
  checkboxStyle: 'unicode',
}

export function createEmailRoute(name: string): DocumentEmailRoute {
  return {
    id: randomUUID(),
    name,
    enabled: true,
    conditions: [],
    conditionMatch: 'all',
    recipients: [],
    recipientBlockIds: [],
    subject: DEFAULT_EMAIL_SUBJECT,
    body: DEFAULT_EMAIL_BODY,
    attachDocument: true,
  }
}

export function parseFormDocumentSettings(raw: string | null | undefined): FormDocumentSettings {
  let parsed: Partial<FormDocumentSettings> = {}
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch {
    parsed = {}
  }

  const email: DocumentEmailSettings = { ...DEFAULT_DOCUMENT_EMAIL, ...(parsed.email ?? {}) }

  // Migration depuis la configuration à circuit unique : les anciens réglages deviennent un
  // circuit sans condition, donc déclenché systématiquement — comportement inchangé.
  if (!Array.isArray(email.routes) || email.routes.length === 0) {
    const legacy = parsed.email as (DocumentEmailSettings & Record<string, any>) | undefined
    const hasLegacy =
      legacy && ((legacy.recipients?.length ?? 0) > 0 || (legacy.recipientBlockIds?.length ?? 0) > 0)
    email.routes = hasLegacy
      ? [
          {
            id: 'legacy',
            name: 'Envoi principal',
            enabled: true,
            conditions: [],
            conditionMatch: 'all',
            recipients: legacy!.recipients ?? [],
            recipientBlockIds: legacy!.recipientBlockIds ?? [],
            subject: legacy!.subject || DEFAULT_EMAIL_SUBJECT,
            body: legacy!.body || DEFAULT_EMAIL_BODY,
            attachDocument: true,
          },
        ]
      : []
  }

  delete email.recipients
  delete email.recipientBlockIds
  delete email.subject
  delete email.body

  return {
    template: { ...DEFAULT_DOCUMENT_TEMPLATE, ...(parsed.template ?? {}) },
    email,
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
  // Pièce jointe / signature : leur structure ne se déplie pas en texte utile — et déverser
  // une signature (data-URL base64) dans une cellule ou un jeton la rendrait illisible.
  if (isStructuredAnswer(value)) return answerToText(value)
  // Jeton image hors du .docx (objet d'e-mail, nom de fichier) : rien à écrire.
  if (isSignatureImage(value)) return ''
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k} : ${toText(v)}`)
      .join(', ')
  }
  return String(value)
}

// ── Signature : texte ou image ───────────────────────────────────────────────
// Un bloc signature offre deux jetons : {tag} écrit « Signé électroniquement le … », {%tag}
// insère le tracé. Le préfixe % est la convention du module image de docxtemplater (payant) ;
// sans lui, docxtemplater lit {%tag} comme un jeton ordinaire nommé « %tag », qu'on remplit
// d'un marqueur texte puis qu'on remplace par une image après le rendu (embedSignatureImages).
export const SIGNATURE_IMAGE_PREFIX = '%'

interface SignatureImageToken {
  kind: 'signature-image'
  dataUrl: string
}

function isSignatureImage(value: unknown): value is SignatureImageToken {
  return !!value && typeof value === 'object' && (value as any).kind === 'signature-image'
}

function signatureImageToken(rawValue: any): SignatureImageToken | '' {
  if (rawValue?.kind !== 'signature' || typeof rawValue.dataUrl !== 'string') return ''
  return { kind: 'signature-image', dataUrl: rawValue.dataUrl }
}

// Largeur d'une signature dans le document ; la hauteur suit les proportions du tracé,
// plafonnée pour qu'un pad très haut ne mange pas la page.
const SIGNATURE_WIDTH_EMU = 5 * 360000 // 5 cm
const SIGNATURE_MAX_HEIGHT_EMU = 2.5 * 360000

interface PendingImage {
  marker: string
  png: Buffer
}

function decodePng(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  const png = Buffer.from(m[1], 'base64')
  // Signature PNG : on refuse tout autre contenu plutôt que d'embarquer n'importe quoi.
  if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) return null
  return png
}

// Remplace chaque jeton image (y compris dans les lignes d'une boucle) par un marqueur texte
// que docxtemplater recopiera tel quel dans un <w:t>.
function extractSignatureImages(value: any, images: PendingImage[]): any {
  if (isSignatureImage(value)) {
    const png = decodePng(value.dataUrl)
    if (!png) return ''
    const marker = `FBSIGIMG${images.length}X${randomUUID().replace(/-/g, '')}`
    images.push({ marker, png })
    return marker
  }
  if (Array.isArray(value)) return value.map((v) => extractSignatureImages(v, images))
  if (value && typeof value === 'object' && !isStructuredAnswer(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, extractSignatureImages(v, images)])
    )
  }
  return value
}

function imageExtent(png: Buffer): { cx: number; cy: number } {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  let cx = SIGNATURE_WIDTH_EMU
  let cy = width > 0 ? Math.round((cx * height) / width) : SIGNATURE_MAX_HEIGHT_EMU
  if (cy > SIGNATURE_MAX_HEIGHT_EMU) {
    cx = Math.round((cx * SIGNATURE_MAX_HEIGHT_EMU) / cy)
    cy = SIGNATURE_MAX_HEIGHT_EMU
  }
  return { cx, cy }
}

// Namespaces déclarés localement : on ne dépend pas de ce que la racine de la partie déclare
// (un en-tête produit par un autre outil que Word peut ne pas déclarer wp ou r).
function drawingXml(rId: string, docPrId: number, cx: number, cy: number): string {
  const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
  return (
    `<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="Signature ${docPrId}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${a}" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${a}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="signature.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/>` +
    `<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  )
}

const EMPTY_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'

const IMAGE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'

// Remplace chaque marqueur par l'image : le marqueur est dans un <w:t>, qu'on referme pour
// glisser un <w:drawing> dans le même <w:r> (un run peut alterner texte et dessin) — la mise
// en forme du run et le texte qui entoure le jeton sont ainsi conservés.
function embedSignatureImages(zip: PizZip, images: PendingImage[]): void {
  if (images.length === 0) return

  const parts = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(name)
  )
  let docPrId = 90000
  let used = false

  for (const part of parts) {
    let xml = zip.file(part)!.asText()
    const present = images.filter((img) => xml.includes(img.marker))
    if (present.length === 0) continue

    const relsPath = part.replace(/^word\//, 'word/_rels/') + '.rels'
    let rels = zip.file(relsPath)?.asText() ?? EMPTY_RELS

    for (const img of present) {
      const index = images.indexOf(img)
      const rId = `rIdFbSignature${index}`
      const media = `media/fb-signature-${index}.png`
      zip.file(`word/${media}`, img.png)
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="${rId}" Type="${IMAGE_REL_TYPE}" Target="${media}"/></Relationships>`
      )
      const { cx, cy } = imageExtent(img.png)
      xml = xml
        .split(img.marker)
        .join(`</w:t>${drawingXml(rId, docPrId++, cx, cy)}<w:t xml:space="preserve">`)
    }

    zip.file(relsPath, rels)
    zip.file(part, xml)
    used = true
  }

  if (!used) return
  const typesPath = '[Content_Types].xml'
  const types = zip.file(typesPath)?.asText()
  if (types && !/Extension="png"/i.test(types)) {
    zip.file(
      typesPath,
      types.replace(/<Types([^>]*)>/, '<Types$1><Default Extension="png" ContentType="image/png"/>')
    )
  }
}

// La case vide doit rester un vrai caractère de case, pour que le document imprimé vierge
// se remplisse aussi à la main sans retouche.
const CHECKBOX_GLYPHS: Record<DocumentCheckboxStyle, { checked: string; unchecked: string }> = {
  unicode: { checked: '☒', unchecked: '☐' },
  wingdings: { checked: 'þ', unchecked: '¨' },
}

/**
 * Une option précise est-elle retenue dans la réponse ?
 *
 * Doit accepter les trois formes rencontrées dans Response.data : le tableau brut de valeurs
 * (réponses antérieures à la résolution des libellés), la chaîne de libellés jointe par « , »
 * produite aujourd'hui par resolveDataLabels, et la valeur simple d'un choix unique.
 */
export function isChoiceSelected(block: any, rawValue: any, choiceValue: string): boolean {
  if (rawValue === undefined || rawValue === null || rawValue === '') return false

  if (block?.type === 'legal') return Boolean(rawValue) === (choiceValue === 'true')
  if (block?.type === 'yes-no') return String(rawValue) === choiceValue

  const option = (block?.attributes?.choices || []).find((c: any) => c.value === choiceValue)
  const targets = new Set(
    [choiceValue, option?.label, option?.id]
      .filter(Boolean)
      .map((s: any) => String(s).trim().toLowerCase())
  )

  const parts = Array.isArray(rawValue)
    ? rawValue.map((v) => String(v))
    : String(toText(formatBlockValue(block, rawValue))).split(',')

  return parts.some((part) => {
    const cleaned = part.trim().replace(/^__other__:/, '').toLowerCase()
    return targets.has(cleaned)
  })
}

interface DocumentContext {
  responseId: string
  createdAt: Date
  formTitle: string
  checkboxStyle?: DocumentCheckboxStyle
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
  // Seuls les jetons texte servent à retrouver les champs d'une boucle ; les jetons de case
  // portent le même blockId et ne doivent pas les écraser.
  const tagByBlockId = new Map(
    mappings.filter((m) => m.choiceValue === undefined).map((m) => [m.blockId, m.tag])
  )
  const glyphs = CHECKBOX_GLYPHS[context.checkboxStyle ?? 'unicode'] ?? CHECKBOX_GLYPHS.unicode
  const data: Record<string, any> = {}

  for (const mapping of mappings) {
    const { tag, blockId } = mapping

    // Jeton de case à cocher : ☒ si l'option est retenue, ☐ sinon.
    if (mapping.choiceValue !== undefined) {
      const block = findBlockDeep(blocks, blockId)
      const selected = isChoiceSelected(block, responseData[blockId], mapping.choiceValue)
      data[tag] = selected ? glyphs.checked : glyphs.unchecked
      continue
    }

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
      const rows: Record<string, any>[] = []
      let rep = 1
      for (;;) {
        const row: Record<string, any> = {}
        let hasValue = false
        for (const inner of block.innerBlocks) {
          const key = `${blockId}_${rep}_${inner.id}`
          if (responseData[key] === undefined) continue
          const innerTag = tagByBlockId.get(inner.id)
          if (!innerTag) continue
          row[innerTag] = toText(formatReadableValue(inner, responseData[key]))
          if (inner.type === 'signature') {
            row[SIGNATURE_IMAGE_PREFIX + innerTag] = signatureImageToken(responseData[key])
          }
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

    data[tag] = toText(formatReadableValue(block, responseData[blockId]))
    if (block?.type === 'signature') {
      data[SIGNATURE_IMAGE_PREFIX + tag] = signatureImageToken(responseData[blockId])
    }
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

  const images: PendingImage[] = []
  try {
    doc.render(extractSignatureImages(data, images))
  } catch (error: any) {
    throw new Error(describeRenderError(error))
  }

  embedSignatureImages(doc.getZip(), images)
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
      // {%tag} (signature en image) désigne le même champ que {tag}.
      found.add(key.startsWith(SIGNATURE_IMAGE_PREFIX) ? key.slice(1) : key)
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
  return applyTokenTemplate(template, data, toText)
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
