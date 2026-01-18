import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// DELETE /api/forms/[id]/responses/[responseId] - Supprimer une réponse
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id, responseId } = await params

    // Vérifier que le formulaire appartient à l'utilisateur
    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    // Vérifier que la réponse existe et appartient au formulaire
    const response = await prisma.response.findFirst({
      where: {
        id: responseId,
        formId: id,
      },
    })

    if (!response) {
      return NextResponse.json({ error: 'Réponse non trouvée' }, { status: 404 })
    }

    await prisma.response.delete({
      where: {
        id: responseId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression de la réponse:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
