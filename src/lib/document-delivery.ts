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
import { evaluateRouteConditions } from './condition-eval'
import type {
  DocumentEmailRoute,
  DocumentRouteStatus,
  DocumentSendStatus,
  FormDocumentSettings,
} from '@/types/form'

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
    checkboxStyle: template.checkboxStyle,
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

// Destinataires d'un circuit = adresses fixes + valeurs des champs e-mail désignés, dédupliquées.
export function resolveRecipients(
  route: DocumentEmailRoute,
  responseData: Record<string, any>
): string[] {
  const collected = [...(route.recipients ?? [])]

  for (const blockId of route.recipientBlockIds ?? []) {
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
    const blocks = JSON.parse(form.blocks || '[]')
    const routes = (generated.settings.email.routes ?? []).filter((r) => r.enabled)

    const results: DocumentRouteStatus[] = []

    for (const route of routes) {
      const matched = evaluateRouteConditions(
        route.conditions,
        route.conditionMatch,
        blocks,
        responseData
      )

      // Un circuit écarté n'est pas un échec : ses conditions n'étaient simplement pas remplies.
      if (!matched) {
        results.push({ routeId: route.id, routeName: route.name, matched: false })
        continue
      }

      const recipients = resolveRecipients(route, responseData)
      if (recipients.length === 0) {
        results.push({
          routeId: route.id,
          routeName: route.name,
          matched: true,
          success: false,
          recipients: [],
          error: 'Aucun destinataire valide',
        })
        continue
      }

      const result = await sendFormDocumentEmail({
        to: recipients,
        subject: applyTags(route.subject, generated.data),
        body: applyTags(route.body, generated.data),
        ...(route.attachDocument !== false && {
          attachment: {
            filename: generated.fileName,
            content: generated.buffer,
            contentType: generated.contentType,
          },
        }),
      })

      results.push({
        routeId: route.id,
        routeName: route.name,
        matched: true,
        success: result.success,
        recipients,
        ...(result.accepted && { accepted: result.accepted }),
        ...(result.rejected?.length && { rejected: result.rejected }),
        ...(result.error && { error: result.error }),
      })
    }

    const triggered = results.filter((r) => r.matched)

    status = {
      // Aucun circuit déclenché n'est un état neutre, pas une réussite d'envoi.
      success: triggered.length > 0 && triggered.every((r) => r.success),
      lastSent: new Date().toISOString(),
      fileName: generated.fileName,
      routes: results,
      ...(routes.length === 0 && { error: 'Aucun circuit d’envoi actif' }),
      ...(routes.length > 0 &&
        triggered.length === 0 && { error: 'Aucun circuit ne correspond à cette réponse' }),
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
