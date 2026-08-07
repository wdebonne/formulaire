// Stockage privé des modèles .docx.
//
// Volontairement HORS de public/ : /api/uploads/[filename] sert les fichiers de public/uploads
// sans aucun contrôle d'authentification, ce qui conviendrait mal à un modèle contenant
// l'en-tête d'un organisme. Ici, l'unique porte d'entrée est une route API authentifiée.

import { randomUUID } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const MAX_TEMPLATE_SIZE = 10 * 1024 * 1024 // 10 Mo

function storageDir(): string {
  return process.env.DOCUMENT_STORAGE_DIR || path.join(process.cwd(), 'storage', 'templates')
}

// Les noms sont générés par nous (uuid.docx) ; on refuse tout ce qui ne colle pas exactement
// à cette forme plutôt que de filtrer les séquences de traversée une par une.
const STORED_NAME_RE = /^[0-9a-f-]{36}\.docx$/i

function resolveStoredPath(storedName: string): string {
  if (!STORED_NAME_RE.test(storedName)) {
    throw new Error('Nom de fichier de modèle invalide')
  }
  return path.join(storageDir(), storedName)
}

export async function saveTemplateFile(buffer: Buffer): Promise<string> {
  const dir = storageDir()
  await mkdir(dir, { recursive: true })
  const storedName = `${randomUUID()}.docx`
  await writeFile(path.join(dir, storedName), buffer)
  return storedName
}

export async function readTemplateFile(storedName: string): Promise<Buffer> {
  return readFile(resolveStoredPath(storedName))
}

export async function deleteTemplateFile(storedName: string): Promise<void> {
  try {
    await unlink(resolveStoredPath(storedName))
  } catch {
    // Fichier déjà absent : la suppression logique en base reste valable.
  }
}

// Un .docx est un ZIP : le type MIME déclaré par le navigateur ne suffit pas, on vérifie
// aussi la signature du conteneur avant d'écrire quoi que ce soit sur le disque.
export function looksLikeDocx(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b // "PK"
}
