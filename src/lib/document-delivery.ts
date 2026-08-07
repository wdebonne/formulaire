// Génération du document d'une réponse et envoi par e-mail.
//
// Point d'entrée unique partagé par la soumission (/api/forms/[id]/submit), le renvoi manuel
// depuis la page des réponses, et le téléchargement authentifié. Le document n'est jamais
// stocké : il est reconstruit à la demande depuis le modèle et la réponse, ce qui évite
// d'accumuler des fichiers contenant des données personnelles sur le disque.

import { prisma } from './prisma'
import { DOCX_MIME, readTemplateFile } from './document-storage'
import { convertDocxToPdf, isPdfConversionAvailable } from './pdf-convert'
import { sendFormDocumentEmail } from './email'
import {
  applyTags,
  buildDocumentData,
  parseFormDocumentSettings,
  renderDocx,
  safeFileName,
} from './docx-template'
import type { DocumentSendStatus, FormDocumentSettings } from '@/types/form'

const PDF_MIME = 'application/pdf'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormRecord {
  id: string
  title: string
  blocks: string
  documentSettings: string
}

interface ResponseRecord {
  id: string
  data: string
  createdAt: Date
}

export interface GeneratedDocument {
  buffer: Buffer
  fileName: string
  contentType: string
  data: Record<string, any>
  settings: FormDocumentSettings
}

export function hasDocumentTemplate(documentSettings: string): boolean {
  return Boolean(parseFormDocumentSettings(documentSettings).template.storedName)
}

/**
 * Reconstruit le document d'une réponse.
 *
 * `forceDocx` sert l'aperçu/téléchargement du .docx même lorsque le formulaire est réglé sur
 * PDF, afin de pouvoir contrôler le remplissage sans dépendre du convertisseur externe.
 */
export async function generateDocumentForResponse(
  form: FormRecord,
  response: ResponseRecord,
  options: { forceDocx?: boolean } = {}
): Promise<GeneratedDocument> {
  const settings = parseFormDocumentSettings(form.documentSettings)
  const { template } = settings

  if (!template.storedName) {
    throw new Error('Aucun modèle de document n’est associé à ce formulaire')
  }

  const blocks = JSON.parse(form.blocks || '[]')
  const responseData = JSON.parse(response.data || '{}')

  const data = buildDocumentData(blocks, template.mappings, responseData, {
    responseId: response.id,
    createdAt: response.createdAt,
    formTitle: form.title,
  })

  const templateBuffer = await readTemplateFile(template.storedName)
  let buffer = renderDocx(templateBuffer, data)
  let contentType = DOCX_MIME
  let extension = 'docx'

  const baseName = safeFileName(
    applyTags(template.outputName || '{form_title}', data),
    form.title || 'document'
  )

  if (!options.forceDocx && template.outputFormat === 'pdf' && (await isPdfConversionAvailable())) {
    buffer = await convertDocxToPdf(buffer, `${baseName}.docx`)
    contentType = PDF_MIME
    extension = 'pdf'
  }

  return { buffer, fileName: `${baseName}.${extension}`, contentType, data, settings }
}

// Destinataires = adresses fixes + valeurs des champs e-mail désignés, dédupliquées.
export function resolveRecipients(
  settings: FormDocumentSettings,
  responseData: Record<string, any>
): string[] {
  const collected = [...settings.email.recipients]

  for (const blockId of settings.email.recipientBlockIds) {
    const value = responseData[blockId]
    if (typeof value === 'string') collected.push(value)
    else if (Array.isArray(value)) collected.push(...value.map(String))
  }

  const unique = new Set<string>()
  for (const raw of collected) {
    const address = String(raw).trim()
    if (EMAIL_RE.test(address)) unique.add(address)
  }
  return Array.from(unique)
}

/**
 * Génère puis envoie le document, et enregistre le statut sur la réponse.
 *
 * Ne lève jamais : l'appelant (soumission ou renvoi manuel) ne doit pas échouer à cause d'un
 * modèle mal formé ou d'un SMTP injoignable — même logique que logEvent() pour l'audit.
 */
export async function sendDocumentForResponse(
  form: FormRecord,
  response: ResponseRecord
): Promise<DocumentSendStatus> {
  let status: DocumentSendStatus

  try {
    const generated = await generateDocumentForResponse(form, response)
    const responseData = JSON.parse(response.data || '{}')
    const recipients = resolveRecipients(generated.settings, responseData)

    if (recipients.length === 0) {
      status = {
        success: false,
        lastSent: new Date().toISOString(),
        error: 'Aucun destinataire valide',
      }
    } else {
      const subject = applyTags(generated.settings.email.subject, generated.data)
      const body = applyTags(generated.settings.email.body, generated.data)

      const result = await sendFormDocumentEmail({
        to: recipients,
        subject,
        body,
        attachment: {
          filename: generated.fileName,
          content: generated.buffer,
          contentType: generated.contentType,
        },
      })

      status = {
        success: result.success,
        lastSent: new Date().toISOString(),
        recipients,
        fileName: generated.fileName,
        ...(result.error && { error: result.error }),
      }
    }
  } catch (error: any) {
    status = {
      success: false,
      lastSent: new Date().toISOString(),
      error: error?.message || 'Erreur lors de la génération du document',
    }
  }

  try {
    await prisma.response.update({
      where: { id: response.id },
      data: { documentStatus: JSON.stringify(status) },
    })
  } catch (error) {
    console.error('Impossible d’enregistrer le statut du document:', error)
  }

  return status
}
