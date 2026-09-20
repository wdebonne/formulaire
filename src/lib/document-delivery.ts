// Envoi des e-mails déclenchés par une réponse, pièce jointe comprise.
//
// La pièce jointe est facultative : un circuit peut se contenter d'un accusé de réception au
// répondant ou d'une notification à l'équipe, auquel cas aucun modèle Word n'est nécessaire et
// rien n'est généré.
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
import { buildFieldCatalog, catalogToMappings } from './document-fields'
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
  /** Renseigné quand le PDF demandé n'a pas pu être produit et que le .docx part à sa place. */
  conversionError?: string
}

export function hasDocumentTemplate(documentSettings: string): boolean {
  return Boolean(parseFormDocumentSettings(documentSettings).template.storedName)
}

// Un envoi est possible dès qu'un circuit actif existe, modèle Word ou non : depuis que la
// pièce jointe est facultative, un formulaire sans modèle peut parfaitement envoyer un accusé
// de réception au répondant ou une notification à l'équipe.
export function hasEmailRoutes(documentSettings: string): boolean {
  return parseFormDocumentSettings(documentSettings).email.routes.some((route) => route.enabled)
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

  // Un serveur bureautique en panne ne doit pas priver le destinataire de son document : le
  // .docx rempli part alors à la place du PDF, et l'échec est rapporté sur la réponse plutôt
  // qu'échangé contre un envoi manquant.
  let conversionError: string | undefined
  if (!options.forceDocx && template.outputFormat === 'pdf' && (await isPdfConversionAvailable())) {
    try {
      buffer = await convertDocxToPdf(buffer, `${baseName}.docx`)
      contentType = PDF_MIME
      extension = 'pdf'
    } catch (error: any) {
      conversionError = error?.message || 'Conversion PDF indisponible'
      console.error('Conversion PDF échouée, repli sur le .docx:', error)
    }
  }

  return {
    buffer,
    fileName: `${baseName}.${extension}`,
    contentType,
    data,
    settings,
    ...(conversionError && { conversionError }),
  }
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
 * Valeurs des jetons acceptés dans l'objet et le corps d'un e-mail.
 *
 * Le catalogue des champs est fusionné avec les correspondances enregistrées plutôt que
 * substitué : un jeton déjà attribué garde son bloc — c'est la garantie de stabilité des
 * modèles — et les questions ajoutées depuis, ou posées par un formulaire qui n'a aucun modèle
 * et donc aucune correspondance enregistrée, se résolvent tout de même. C'est exactement la
 * liste que la modale annonce comme « jetons acceptés ».
 */
function emailTokens(
  form: FormRecord,
  response: ResponseRecord,
  settings: FormDocumentSettings
): Record<string, any> {
  const blocks = JSON.parse(form.blocks || '[]')
  return buildDocumentData(
    blocks,
    catalogToMappings(buildFieldCatalog(blocks, settings.template.mappings)),
    JSON.parse(response.data || '{}'),
    {
      responseId: response.id,
      createdAt: response.createdAt,
      formTitle: form.title,
      checkboxStyle: settings.template.checkboxStyle,
    }
  )
}

/**
 * Évalue les circuits d'envoi d'une réponse, envoie les e-mails, enregistre le statut.
 *
 * Le document n'est produit que si un circuit réellement déclenché le réclame : un accusé de
 * réception au répondant ou une notification à l'équipe n'exige donc aucun modèle Word, et ne
 * paie ni le rendu du .docx ni l'aller-retour de conversion PDF.
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
    const settings = parseFormDocumentSettings(form.documentSettings)
    const responseData = JSON.parse(response.data || '{}')
    const blocks = JSON.parse(form.blocks || '[]')
    const routes = (settings.email.routes ?? []).filter((r) => r.enabled)
    const tokens = emailTokens(form, response, settings)

    const matched = new Set(
      routes
        .filter((route) =>
          evaluateRouteConditions(route.conditions, route.conditionMatch, blocks, responseData)
        )
        .map((route) => route.id)
    )

    let generated: GeneratedDocument | null = null
    let documentError: string | undefined
    if (routes.some((route) => matched.has(route.id) && route.attachDocument !== false)) {
      if (!settings.template.storedName) {
        documentError = 'Aucun modèle de document n’est associé à ce formulaire'
      } else {
        try {
          generated = await generateDocumentForResponse(form, response)
        } catch (error: any) {
          documentError = error?.message || 'Génération du document impossible'
        }
      }
    }

    const results: DocumentRouteStatus[] = []

    for (const route of routes) {
      // Un circuit écarté n'est pas un échec : ses conditions n'étaient simplement pas remplies.
      if (!matched.has(route.id)) {
        results.push({ routeId: route.id, routeName: route.name, matched: false })
        continue
      }

      // Un circuit qui annonce une pièce jointe ne part pas sans elle : un « veuillez trouver
      // ci-joint » sans document vaut moins qu'un échec explicite. Les circuits qui n'en
      // demandent pas partent quand même — un modèle absent ou cassé ne doit pas faire taire
      // l'accusé de réception du répondant.
      const withDocument = route.attachDocument !== false
      if (withDocument && !generated) {
        results.push({
          routeId: route.id,
          routeName: route.name,
          matched: true,
          success: false,
          recipients: [],
          error: documentError || 'Document indisponible',
        })
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
        subject: applyTags(route.subject, tokens),
        body: applyTags(route.body, tokens),
        ...(withDocument &&
          generated && {
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
      ...(generated && { fileName: generated.fileName }),
      routes: results,
      ...(generated?.conversionError && { conversionFallback: generated.conversionError }),
      ...(routes.length === 0 && { error: 'Aucun circuit d’envoi actif' }),
      ...(routes.length > 0 &&
        triggered.length === 0 && { error: 'Aucun circuit ne correspond à cette réponse' }),
    }
  } catch (error: any) {
    status = {
      success: false,
      lastSent: new Date().toISOString(),
      error: error?.message || 'Erreur lors de l’envoi des e-mails',
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
