import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { hasDocumentTemplate, sendDocumentForResponse } from '@/lib/document-delivery'
import { prisma } from '@/lib/prisma'

// POST /api/forms/[id]/responses/[responseId]/document/send — (re)envoyer l'e-mail avec le
// document en pièce jointe, sur le même modèle que le renvoi de webhook.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id, responseId } = await params
  const form = await getAccessibleForm(id, session, 'read')
  if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

  if (!hasDocumentTemplate(form.documentSettings)) {
    return NextResponse.json(
      { error: 'Aucun modèle de document n’est associé à ce formulaire' },
      { status: 400 }
    )
  }

  const response = await prisma.response.findFirst({ where: { id: responseId, formId: id } })
  if (!response) return NextResponse.json({ error: 'Réponse non trouvée' }, { status: 404 })

  const status = await sendDocumentForResponse(form, response)

  return NextResponse.json({ success: status.success, status })
}
