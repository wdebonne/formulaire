import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import {
  ALLOWED_UPLOAD_TYPES,
  collectStoredNames,
  extensionOf,
  isImageMime,
  readResponseFile,
} from '@/lib/response-uploads'

// Retrouve la pièce jointe dans les réponses enregistrées du formulaire : c'est de là que
// viennent son nom d'origine et son type, et cela garantit qu'un nom de fichier deviné ne
// sort rien du stockage tant qu'aucune réponse ne le référence.
async function findAttachment(formId: string, storedName: string) {
  const responses = await prisma.response.findMany({
    where: { formId, data: { contains: storedName } },
    select: { data: true },
  })

  for (const response of responses) {
    let parsed: unknown
    try {
      parsed = JSON.parse(response.data || '{}')
    } catch {
      continue
    }
    if (!collectStoredNames(parsed).includes(storedName)) continue

    const stack: unknown[] = [parsed]
    while (stack.length) {
      const value = stack.pop()
      if (!value || typeof value !== 'object') continue
      if (Array.isArray(value)) {
        stack.push(...value)
        continue
      }
      const obj = value as Record<string, unknown>
      if (obj.kind === 'file' && obj.storedName === storedName) {
        return { name: String(obj.name || storedName), mime: String(obj.mime || '') }
      }
      stack.push(...Object.values(obj))
    }
  }

  return null
}

// GET /api/forms/[id]/files/[name] — télécharge une pièce jointe déposée par un répondant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id, name } = await params

    const form = await getAccessibleForm(id, session, 'read')
    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const attachment = await findAttachment(id, name)
    if (!attachment) {
      return NextResponse.json({ error: 'Pièce jointe non trouvée' }, { status: 404 })
    }

    let file: Buffer
    try {
      file = await readResponseFile(id, name)
    } catch {
      return NextResponse.json({ error: 'Pièce jointe non trouvée' }, { status: 404 })
    }

    const mime = ALLOWED_UPLOAD_TYPES[extensionOf(name)] || attachment.mime || 'application/octet-stream'

    // Une image s'affiche en place dans le détail de la réponse ; tout le reste est téléchargé.
    // `nosniff` interdit au navigateur de requalifier un contenu servi en ligne.
    const disposition = isImageMime(mime) ? 'inline' : 'attachment'
    const asciiName = attachment.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")

    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Erreur lors du téléchargement de la pièce jointe:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
