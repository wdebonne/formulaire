import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/forms/[id]/responses - Liste toutes les réponses d'un formulaire
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

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

    const responses = await prisma.response.findMany({
      where: {
        formId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const parsedResponses = responses.map((r: { id: string; data: string; metadata: string | null; createdAt: Date }) => ({
      ...r,
      data: JSON.parse(r.data),
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    }))

    return NextResponse.json(parsedResponses)
  } catch (error) {
    console.error('Erreur lors de la récupération des réponses:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/forms/[id]/responses - Supprimer toutes les réponses d'un formulaire
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

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

    await prisma.response.deleteMany({
      where: {
        formId: id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression des réponses:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
