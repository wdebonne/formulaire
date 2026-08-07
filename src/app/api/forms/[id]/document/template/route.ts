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

// Validation par la forme de l'objet plutôt que par `instanceof File`, volontairement : `File`
// n'est exposé comme global qu'à partir de Node 20, et l'image a tourné sur Node 18, où le seul
// fait de référencer l'identifiant levait une ReferenceError à chaque import. L'image est
// aujourd'hui sur Node 24, mais ce test ne coûte rien et ne dépend d'aucune version.
interface UploadedFile {
  name: string
  type: string
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UploadedFile).arrayBuffer === 'function' &&
    typeof (value as UploadedFile).size === 'number'
  )
}

// POST /api/forms/[id]/document/template — importer un modèle .docx
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'write')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file')
    if (!isUploadedFile(file)) {
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

    let storedName: string
    try {
      storedName = await saveTemplateFile(buffer)
    } catch (error: any) {
      // Cause la plus fréquente : le volume du stockage privé n'est pas monté, ou l'utilisateur
      // du conteneur n'y a pas les droits d'écriture. Le message doit le dire explicitement.
      console.error('Écriture du modèle impossible:', error)
      return NextResponse.json(
        {
          error:
            'Impossible d’enregistrer le modèle sur le serveur. Vérifiez que le stockage des ' +
            'modèles est accessible en écriture (volume templates-data monté sur /app/storage).',
        },
        { status: 500 }
      )
    }

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
  } catch (error) {
    console.error('Erreur lors de l’import du modèle:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET /api/forms/[id]/document/template — télécharger le modèle (authentifié)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'read')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const { template } = parseFormDocumentSettings(form.documentSettings)
    if (!template.storedName) {
      return NextResponse.json({ error: 'Aucun modèle enregistré' }, { status: 404 })
    }

    let buffer: Buffer
    try {
      buffer = await readTemplateFile(template.storedName)
    } catch {
      return NextResponse.json({ error: 'Modèle introuvable sur le serveur' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': DOCX_MIME,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          template.fileName || 'modele.docx'
        )}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Erreur lors du téléchargement du modèle:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/forms/[id]/document/template — retirer le modèle
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
  } catch (error) {
    console.error('Erreur lors de la suppression du modèle:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
