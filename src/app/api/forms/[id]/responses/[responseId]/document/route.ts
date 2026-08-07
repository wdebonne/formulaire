import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { generateDocumentForResponse } from '@/lib/document-delivery'
import { prisma } from '@/lib/prisma'

// GET /api/forms/[id]/responses/[responseId]/document — télécharger le document rempli.
// Le fichier n'est jamais stocké : il est régénéré ici, derrière l'authentification.
// ?format=docx force le .docx même si le formulaire est réglé sur PDF (contrôle du remplissage).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id, responseId } = await params
  const form = await getAccessibleForm(id, session, 'read')
  if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

  const response = await prisma.response.findFirst({ where: { id: responseId, formId: id } })
  if (!response) return NextResponse.json({ error: 'Réponse non trouvée' }, { status: 404 })

  const forceDocx = request.nextUrl.searchParams.get('format') === 'docx'

  try {
    const generated = await generateDocumentForResponse(form, response, { forceDocx })
    return new NextResponse(new Uint8Array(generated.buffer), {
      headers: {
        'Content-Type': generated.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          generated.fileName
        )}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Impossible de générer le document' },
      { status: 400 }
    )
  }
}
