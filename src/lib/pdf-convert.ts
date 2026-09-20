// Conversion .docx → PDF, déléguée à un moteur bureautique extérieur.
//
// Aucun convertisseur fidèle n'existe en JS pur : rendre un modèle Word avec en-tête, tableaux
// et polices d'organisme suppose LibreOffice ou un serveur de documents. Plutôt que d'alourdir
// l'image applicative de plusieurs centaines de Mo, l'administrateur désigne le moteur à
// employer :
//
// - **Gotenberg**, un conteneur dédié qu'il faut ajouter au docker-compose ;
// - **NextCloud**, c'est-à-dire le serveur bureautique déjà branché à l'instance configurée
//   (Euro-Office, ONLYOFFICE, Nextcloud Office) — rien de plus à administrer.
//
// Tant que la conversion n'a pas été éprouvée, les options PDF restent masquées dans l'interface.

import PizZip from 'pizzip'
import { prisma } from './prisma'
import { DOCX_MIME } from './document-storage'
import { convertWithNextcloud } from './nextcloud-convert'
import type { PdfConverterProvider, SystemDocumentSettings } from '@/types/form'

const HEALTH_TIMEOUT_MS = 8_000
const CONVERT_TIMEOUT_MS = 120_000

export function normalizeConverterUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

// Les installations antérieures au choix de moteur n'ont que l'URL Gotenberg enregistrée.
export function resolveProvider(settings: SystemDocumentSettings): PdfConverterProvider {
  return settings.pdfConverterProvider === 'nextcloud' ? 'nextcloud' : 'gotenberg'
}

export function providerLabel(provider: PdfConverterProvider): string {
  return provider === 'nextcloud' ? 'NextCloud' : 'Gotenberg'
}

export async function getSystemDocumentSettings(): Promise<SystemDocumentSettings> {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: { documentSettings: true },
    })
    return settings?.documentSettings ? JSON.parse(settings.documentSettings) : {}
  } catch {
    return {}
  }
}

export async function saveSystemDocumentSettings(
  settings: SystemDocumentSettings
): Promise<SystemDocumentSettings> {
  await prisma.systemSettings.upsert({
    where: { id: 'system' },
    update: { documentSettings: JSON.stringify(settings) },
    create: { id: 'system', documentSettings: JSON.stringify(settings) },
  })
  return settings
}

// Le PDF n'est proposé que si la dernière vérification a réussi. Gotenberg se vérifie par son
// /health ; NextCloud, lui, n'est vérifié que par une conversion réellement aboutie — une
// instance joignable n'apprend rien du serveur bureautique qui lui est (ou non) branché.
export async function isPdfConversionAvailable(): Promise<boolean> {
  const settings = await getSystemDocumentSettings()
  if (!settings.pdfConverterVerified) return false

  return resolveProvider(settings) === 'nextcloud' || Boolean(settings.pdfConverterUrl)
}

export interface ConverterTestResult {
  success: boolean
  version?: string
  /** Applications bureautiques repérées sur l'instance NextCloud, quand elles se déclarent. */
  office?: string[]
  error?: string
}

/** Test de joignabilité d'un Gotenberg : /health, puis /version qui est facultatif. */
export async function testGotenberg(rawUrl: string): Promise<ConverterTestResult> {
  const url = normalizeConverterUrl(rawUrl)
  if (!url) return { success: false, error: 'Aucune adresse renseignée' }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { success: false, error: 'Adresse invalide (exemple : http://gotenberg:3000)' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { success: false, error: 'Seuls les protocoles http et https sont acceptés' }
  }

  try {
    const health = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (!health.ok) {
      return { success: false, error: `Le service a répondu ${health.status} sur /health` }
    }

    let version: string | undefined
    try {
      const versionRes = await fetch(`${url}/version`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      })
      if (versionRes.ok) version = (await versionRes.text()).trim().slice(0, 40)
    } catch {
      // /version est facultatif : son absence n'invalide pas un service sain.
    }

    return { success: true, version }
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return { success: false, error: 'Délai dépassé — le service ne répond pas' }
    }
    return { success: false, error: error?.message || 'Connexion impossible' }
  }
}

/** Conservé sous son nom d'origine : c'est le test de connexion du moteur Gotenberg. */
export const testPdfConverter = testGotenberg

/** Conversion par l'endpoint LibreOffice de Gotenberg, à une adresse donnée. */
async function convertViaGotenberg(
  rawUrl: string,
  docxBuffer: Buffer,
  fileName: string
): Promise<Buffer> {
  const url = normalizeConverterUrl(rawUrl)
  const form = new FormData()
  form.append(
    'files',
    new Blob([new Uint8Array(docxBuffer)], { type: DOCX_MIME }),
    fileName.toLowerCase().endsWith('.docx') ? fileName : `${fileName}.docx`
  )

  const response = await fetch(`${url}/forms/libreoffice/convert`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(CONVERT_TIMEOUT_MS),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Conversion PDF échouée (${response.status})${detail ? ` : ${detail.slice(0, 200)}` : ''}`
    )
  }

  return Buffer.from(await response.arrayBuffer())
}

/**
 * Convertit un .docx en PDF avec le moteur retenu par l'administrateur.
 *
 * Lève en cas d'échec : l'appelant décide quoi en faire — `generateDocumentForResponse` retombe
 * sur le .docx plutôt que de ne rien envoyer.
 */
export async function convertDocxToPdf(docxBuffer: Buffer, fileName: string): Promise<Buffer> {
  const settings = await getSystemDocumentSettings()
  if (!settings.pdfConverterVerified) {
    throw new Error("Aucun convertisseur PDF vérifié n'est configuré")
  }

  if (resolveProvider(settings) === 'nextcloud') {
    const result = await convertWithNextcloud(docxBuffer)
    if (!result.success || !result.pdf) {
      throw new Error(result.error || 'Conversion PDF échouée')
    }
    return result.pdf
  }

  if (!settings.pdfConverterUrl) {
    throw new Error("Aucun convertisseur PDF vérifié n'est configuré")
  }
  return convertViaGotenberg(settings.pdfConverterUrl, docxBuffer, fileName)
}

/**
 * Le plus petit .docx valide qui soit, portant une ligne de texte.
 *
 * Éprouver la conversion demande un vrai document : interroger la liste des applications
 * installées ne dirait rien de ce qui se passera au moment de produire un document, et faire
 * dépendre la vérification d'un modèle réglé par un utilisateur reviendrait à tester deux
 * choses à la fois. Quatre pièces suffisent à un fichier que Word comme ONLYOFFICE acceptent :
 * les types de contenu, la relation vers le document, le document, et les relations — vides —
 * de ce dernier.
 */
export function buildProbeDocx(text: string): Buffer {
  const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const zip = new PizZip()

  zip.file(
    '[Content_Types].xml',
    header +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  )

  zip.file(
    '_rels/.rels',
    header +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Target="word/document.xml" ' +
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>' +
      '</Relationships>'
  )

  zip.file(
    'word/_rels/document.xml.rels',
    header + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
  )

  zip.file(
    'word/document.xml',
    header +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>` +
      '</w:body></w:document>'
  )

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export interface ConversionTestResult {
  success: boolean
  /** Chemin qui a abouti — « connecteur Euro-Office », « Gotenberg »… */
  method?: string
  bytes?: number
  /** Le PDF produit, pour que l'administrateur puisse l'ouvrir et juger sur pièce. */
  pdfBase64?: string
  error?: string
}

/**
 * Convertit un document témoin, de bout en bout.
 *
 * Sans cette sonde, un administrateur règlerait un formulaire sur PDF et ne l'apprendrait qu'à
 * la première réponse reçue, quand la conversion échoue derrière un envoi déjà attendu. Le PDF
 * produit est renvoyé : une conversion peut « réussir » et rendre une page blanche.
 */
export async function testPdfConversion(
  provider: PdfConverterProvider,
  gotenbergUrl?: string
): Promise<ConversionTestResult> {
  const probe = buildProbeDocx(
    'FormBuilder — vérification de la conversion en PDF. Si vous lisez cette ligne dans un PDF, la chaîne fonctionne.'
  )

  if (provider === 'nextcloud') {
    const result = await convertWithNextcloud(probe)
    if (!result.success || !result.pdf) {
      return { success: false, error: result.error || 'Conversion impossible' }
    }
    return {
      success: true,
      method: result.method,
      bytes: result.pdf.length,
      pdfBase64: result.pdf.toString('base64'),
    }
  }

  const url = normalizeConverterUrl(gotenbergUrl ?? '')
  if (!url) return { success: false, error: 'Aucune adresse renseignée' }

  try {
    const pdf = await convertViaGotenberg(url, probe, 'verification.docx')
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return { success: false, error: 'Le service a répondu autre chose qu’un PDF' }
    }
    return {
      success: true,
      method: 'Gotenberg',
      bytes: pdf.length,
      pdfBase64: pdf.toString('base64'),
    }
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return { success: false, error: 'Délai dépassé — la conversion n’a pas abouti' }
    }
    return { success: false, error: error?.message || 'Conversion impossible' }
  }
}
