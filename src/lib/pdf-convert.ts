// Conversion .docx → PDF déléguée à un service externe (Gotenberg).
//
// Aucun convertisseur fidèle n'existe en JS pur : rendre un modèle Word avec en-tête, tableaux
// et polices d'organisme suppose LibreOffice. Plutôt que d'alourdir l'image applicative de
// plusieurs centaines de Mo, l'administrateur déclare l'URL d'un conteneur dédié. Tant que
// cette URL n'a pas été vérifiée, les options PDF restent masquées dans l'interface.

import { prisma } from './prisma'
import { DOCX_MIME } from './document-storage'
import type { SystemDocumentSettings } from '@/types/form'

const HEALTH_TIMEOUT_MS = 8_000
const CONVERT_TIMEOUT_MS = 60_000

export function normalizeConverterUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
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

// Le PDF n'est proposé que si la dernière vérification de l'URL enregistrée a réussi.
export async function isPdfConversionAvailable(): Promise<boolean> {
  const settings = await getSystemDocumentSettings()
  return Boolean(settings.pdfConverterUrl && settings.pdfConverterVerified)
}

export interface ConverterTestResult {
  success: boolean
  version?: string
  error?: string
}

export async function testPdfConverter(rawUrl: string): Promise<ConverterTestResult> {
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

/**
 * Convertit un .docx en PDF via l'endpoint LibreOffice de Gotenberg.
 *
 * Non testé ici contre une instance réelle : cette fonction n'est atteinte qu'une fois une URL
 * de convertisseur enregistrée et vérifiée par un administrateur.
 */
export async function convertDocxToPdf(docxBuffer: Buffer, fileName: string): Promise<Buffer> {
  const settings = await getSystemDocumentSettings()
  if (!settings.pdfConverterUrl || !settings.pdfConverterVerified) {
    throw new Error("Aucun convertisseur PDF vérifié n'est configuré")
  }

  const url = normalizeConverterUrl(settings.pdfConverterUrl)
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
