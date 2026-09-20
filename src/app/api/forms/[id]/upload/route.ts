import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { resolveFormGate } from '@/lib/form-gate'
import { findBlockDeep } from '@/lib/response-format'
import {
  ALLOWED_UPLOAD_TYPES,
  DEFAULT_MAX_FILE_SIZE_MB,
  MAX_RESPONSE_FILE_SIZE,
  deleteResponseFile,
  resolveUploadType,
  saveResponseFile,
} from '@/lib/response-uploads'

// Un dépôt de fichier est autorisé soit sur un formulaire publié dont les options d'accès sont
// ouvertes — mêmes contrôles que la soumission, une requête forgée ne doit pas contourner la
// fenêtre de publication ni le mot de passe — soit, hors publication, à un utilisateur ayant
// accès au formulaire : c'est ce qui fait fonctionner l'aperçu du concepteur.
type StoredForm = NonNullable<Awaited<ReturnType<typeof prisma.form.findFirst>>>

async function authorizeUpload(
  formId: string
): Promise<{ form: StoredForm | null; error?: string; status?: number }> {
  const form = await prisma.form.findFirst({ where: { id: formId, deletedAt: null } })
  if (!form) return { form: null, error: 'Formulaire non trouvé', status: 404 }

  if (form.status === 'published') {
    const gate = await resolveFormGate(form)
    if (gate.state === 'open') return { form }
  }

  const session = await getSession()
  if (session && (await getAccessibleForm(formId, session, 'read'))) return { form }

  return { form: null, error: 'Dépôt de fichier non autorisé', status: 403 }
}

// POST /api/forms/[id]/upload — dépôt d'une pièce jointe par un répondant
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const auth = await authorizeUpload(id)
    if (!auth.form) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const formData = await request.formData()
    const blockId = String(formData.get('blockId') || '')
    const file = formData.get('file')

    // Contrôle structurel plutôt que `instanceof File` : ce global n'existe pas avant Node 20
    // et le code doit rester insensible à la version du runtime (cf. CLAUDE.md).
    if (!file || typeof file !== 'object' || typeof (file as any).arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
    }
    const upload = file as unknown as { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }

    // Le bloc doit exister et être un bloc Téléchargement : sans cette vérification la route
    // serait un dépôt de fichiers ouvert pour qui devine son adresse.
    const blocks = JSON.parse(auth.form.blocks || '[]') as any[]
    const block = findBlockDeep(blocks, blockId)
    if (!block || block.type !== 'file') {
      return NextResponse.json({ error: 'Champ de dépôt inconnu' }, { status: 400 })
    }

    const type = resolveUploadType(upload.name)
    if (!type) {
      return NextResponse.json(
        { error: `Type de fichier refusé. Formats acceptés : ${Object.keys(ALLOWED_UPLOAD_TYPES).join(', ')}` },
        { status: 400 }
      )
    }

    // Le réglage du bloc ne peut que restreindre la liste blanche du serveur.
    const allowed: string[] = Array.isArray(block.attributes?.allowedFileExtensions)
      ? block.attributes.allowedFileExtensions.map((e: string) => String(e).toLowerCase().replace('.', ''))
      : []
    if (allowed.length > 0 && !allowed.includes(type.extension)) {
      return NextResponse.json(
        { error: `Ce champ n'accepte que les fichiers : ${allowed.join(', ')}` },
        { status: 400 }
      )
    }

    const maxMb = Number(block.attributes?.maxFileSizeMb) || DEFAULT_MAX_FILE_SIZE_MB
    const maxSize = Math.min(maxMb * 1024 * 1024, MAX_RESPONSE_FILE_SIZE)
    if (upload.size > maxSize) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (maximum ${Math.round(maxSize / (1024 * 1024))} Mo)` },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await upload.arrayBuffer())
    const storedName = await saveResponseFile(id, buffer, type.extension)

    return NextResponse.json({
      value: {
        kind: 'file',
        name: upload.name,
        size: upload.size,
        mime: type.mime,
        storedName,
      },
    })
  } catch (error) {
    console.error('Erreur lors du dépôt de la pièce jointe:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/forms/[id]/upload?name=… — le répondant retire un fichier avant d'envoyer
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const auth = await authorizeUpload(id)
    if (!auth.form) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const storedName = request.nextUrl.searchParams.get('name') || ''
    if (!storedName) {
      return NextResponse.json({ error: 'Pièce jointe non précisée' }, { status: 400 })
    }

    // Un fichier déjà rattaché à une réponse enregistrée n'est plus retirable ici : sans ce
    // garde-fou, n'importe quel visiteur effacerait la pièce jointe d'un autre répondant.
    const attached = await prisma.response.count({
      where: { formId: id, data: { contains: storedName } },
    })
    if (attached > 0) {
      return NextResponse.json({ error: 'Pièce jointe déjà enregistrée' }, { status: 409 })
    }

    await deleteResponseFile(id, storedName)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur lors du retrait de la pièce jointe:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
