import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { inspectDocxTags, parseFormDocumentSettings } from '@/lib/docx-template'
import {
  DOCX_MIME,
  MAX_TEMPLATE_SIZE,
  deleteTemplateFile,
  looksLikeDocx,
  readTemplateFile,
  saveTemplateFile,
} from '@/lib/document-storage'
import { prisma } from '@/lib/prisma'

// POST /api/forms/[id]/document/template — importer un modèle .docx
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const form = await getAccessibleForm(id, session, 'write')
  if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  }

  if (file.type !== DOCX_MIME) {
    return NextResponse.json(
      { error: 'Seuls les fichiers Word .docx sont acceptés' },
      { status: 400 }
    )
  }
  if (file.size > MAX_TEMPLATE_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!looksLikeDocx(buffer)) {
    return NextResponse.json({ error: 'Le fichier n’est pas un .docx valide' }, { status: 400 })
  }

  // Compiler le modèle immédiatement : un .docx dont la syntaxe de jetons est cassée doit être
  // refusé à l'import, pas au moment de la première soumission.
  let tags: string[]
  try {
    tags = inspectDocxTags(buffer)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Modèle illisible' }, { status: 400 })
  }

  const current = parseFormDocumentSettings(form.documentSettings)
  const storedName = await saveTemplateFile(buffer)
  if (current.template.storedName) {
    await deleteTemplateFile(current.template.storedName)
  }

  const next = {
    ...current,
    template: {
      ...current.template,
      fileName: file.name,
      storedName,
      uploadedAt: new Date().toISOString(),
      size: file.size,
    },
  }

  await prisma.form.update({
    where: { id },
    data: { documentSettings: JSON.stringify(next) },
  })

  return NextResponse.json({ ...next, tags })
}

// GET /api/forms/[id]/document/template — télécharger le modèle (authentifié)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const form = await getAccessibleForm(id, session, 'read')
  if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

  const { template } = parseFormDocumentSettings(form.documentSettings)
  if (!template.storedName) {
    return NextResponse.json({ error: 'Aucun modèle enregistré' }, { status: 404 })
  }

  try {
    const buffer = await readTemplateFile(template.storedName)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': DOCX_MIME,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          template.fileName || 'modele.docx'
        )}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Modèle introuvable sur le serveur' }, { status: 404 })
  }
}

// DELETE /api/forms/[id]/document/template — retirer le modèle
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const form = await getAccessibleForm(id, session, 'write')
  if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

  const current = parseFormDocumentSettings(form.documentSettings)
  if (current.template.storedName) {
    await deleteTemplateFile(current.template.storedName)
  }

  const next = {
    ...current,
    template: {
      ...current.template,
      fileName: undefined,
      storedName: undefined,
      uploadedAt: undefined,
      size: undefined,
    },
  }

  await prisma.form.update({
    where: { id },
    data: { documentSettings: JSON.stringify(next) },
  })

  return NextResponse.json(next)
}
