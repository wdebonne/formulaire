// Formats acceptés pour les pièces jointes déposées par les répondants.
//
// Module pur — aucun import de `fs` ni de Prisma — pour que l'éditeur de bloc (`'use client'`)
// propose exactement la liste que le serveur applique, sans la recopier. Même découpage que
// `audit-actions.ts` / `audit-log.ts`.

// Plafond absolu, indépendant de ce que demande le bloc : un formulaire public ne doit jamais
// pouvoir servir de dépôt de fichiers volumineux.
export const MAX_RESPONSE_FILE_SIZE = 25 * 1024 * 1024 // 25 Mo
export const DEFAULT_MAX_FILE_SIZE_MB = 10

// Liste blanche serveur : le réglage du bloc ne peut que la restreindre, jamais l'élargir.
// Ni exécutables ni SVG — ce dernier est un document HTML déguisé une fois servi depuis l'origine.
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odp: 'application/vnd.oasis.opendocument.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  zip: 'application/zip',
}

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export function extensionOf(filename: string): string {
  const name = String(filename)
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function isImageMime(mime: string): boolean {
  return IMAGE_MIMES.has(mime)
}

// L'extension prime sur le type MIME annoncé par le navigateur : celui-ci est absent ou
// fantaisiste selon les plateformes (application/octet-stream pour un .docx sous Android).
export function resolveUploadType(filename: string): { extension: string; mime: string } | null {
  const extension = extensionOf(filename)
  const mime = ALLOWED_UPLOAD_TYPES[extension]
  return mime ? { extension, mime } : null
}
