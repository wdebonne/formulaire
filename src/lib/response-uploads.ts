// Stockage privé des pièces jointes déposées par les répondants.
//
// Volontairement HORS de public/, pour la même raison que les modèles .docx : la route
// /api/uploads/[filename] sert public/uploads sans aucune authentification, ce qui conviendrait
// mal à un justificatif d'identité ou à un devis. L'unique porte d'entrée en lecture est
// /api/forms/[id]/files/[name], gardée par getAccessibleForm().

import { randomUUID } from 'crypto'
import { mkdir, readFile, rm, unlink, writeFile } from 'fs/promises'
import path from 'path'

export {
  ALLOWED_UPLOAD_TYPES,
  DEFAULT_MAX_FILE_SIZE_MB,
  MAX_RESPONSE_FILE_SIZE,
  extensionOf,
  isImageMime,
  resolveUploadType,
} from './upload-types'

// Les noms sont générés par nous (uuid.ext) ; on refuse tout ce qui ne colle pas exactement à
// cette forme plutôt que de filtrer les séquences de traversée une par une.
const STORED_NAME_RE = /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i
const FORM_ID_RE = /^[0-9a-zA-Z_-]{1,64}$/

function storageRoot(): string {
  return process.env.RESPONSE_UPLOAD_DIR || path.join(process.cwd(), 'storage', 'response-files')
}

function formDir(formId: string): string {
  if (!FORM_ID_RE.test(formId)) throw new Error('Identifiant de formulaire invalide')
  return path.join(storageRoot(), formId)
}

function resolveStoredPath(formId: string, storedName: string): string {
  if (!STORED_NAME_RE.test(storedName)) throw new Error('Nom de pièce jointe invalide')
  return path.join(formDir(formId), storedName)
}

export async function saveResponseFile(
  formId: string,
  buffer: Buffer,
  extension: string
): Promise<string> {
  const dir = formDir(formId)
  await mkdir(dir, { recursive: true })
  const storedName = `${randomUUID()}.${extension}`
  await writeFile(path.join(dir, storedName), buffer)
  return storedName
}

export async function readResponseFile(formId: string, storedName: string): Promise<Buffer> {
  return readFile(resolveStoredPath(formId, storedName))
}

export async function deleteResponseFile(formId: string, storedName: string): Promise<void> {
  try {
    await unlink(resolveStoredPath(formId, storedName))
  } catch {
    // Fichier déjà absent : la suppression logique reste valable.
  }
}

export async function deleteFormFiles(formId: string): Promise<void> {
  try {
    await rm(formDir(formId), { recursive: true, force: true })
  } catch {
    // Dossier jamais créé (aucun dépôt) : rien à faire.
  }
}

// Parcourt les valeurs d'une réponse et rend les noms stockés des pièces jointes, y compris
// celles déposées dans un groupe ou une itération de répéteur (clés plates).
export function collectStoredNames(data: unknown): string[] {
  const names: string[] = []
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const obj = value as Record<string, unknown>
    if (obj.kind === 'file' && typeof obj.storedName === 'string') {
      names.push(obj.storedName)
      return
    }
    Object.values(obj).forEach(visit)
  }
  visit(data)
  return names
}

// Supprimer une réponse doit emporter ses pièces jointes : sans cela, une demande d'effacement
// RGPD laisserait le fichier sur le disque alors que la ligne a disparu de la base.
export async function deleteFilesOfResponses(
  responses: { formId: string; data: string }[]
): Promise<void> {
  for (const response of responses) {
    let parsed: unknown
    try {
      parsed = JSON.parse(response.data || '{}')
    } catch {
      continue
    }
    for (const storedName of collectStoredNames(parsed)) {
      await deleteResponseFile(response.formId, storedName)
    }
  }
}
