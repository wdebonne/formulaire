import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/themes/[id] - Récupérer un thème
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const theme = await prisma.theme.findFirst({
      where: {
        id,
        OR: [{ userId: session.userId }, { isDefault: true }],
      },
    })

    if (!theme) {
      return NextResponse.json({ error: 'Thème non trouvé' }, { status: 404 })
    }

    return NextResponse.json({
      ...theme,
      properties: JSON.parse(theme.properties),
    })
  } catch (error) {
    console.error('Erreur lors de la récupération du thème:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/themes/[id] - Mettre à jour un thème
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, properties } = body

    // Vérifier que le thème appartient à l'utilisateur et n'est pas un thème par défaut
    const existingTheme = await prisma.theme.findFirst({
      where: {
        id,
        userId: session.userId,
        isDefault: false,
      },
    })

    if (!existingTheme) {
      return NextResponse.json(
        { error: 'Thème non trouvé ou non modifiable' },
        { status: 404 }
      )
    }

    const theme = await prisma.theme.update({
      where: { id },
      data: {
        name,
        properties: JSON.stringify(properties),
      },
    })

    return NextResponse.json({
      ...theme,
      properties: JSON.parse(theme.properties),
    })
  } catch (error) {
    console.error('Erreur lors de la mise à jour du thème:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/themes/[id] - Supprimer un thème
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

    // Vérifier que le thème appartient à l'utilisateur et n'est pas un thème par défaut
    const existingTheme = await prisma.theme.findFirst({
      where: {
        id,
        userId: session.userId,
        isDefault: false,
      },
    })

    if (!existingTheme) {
      return NextResponse.json(
        { error: 'Thème non trouvé ou non supprimable' },
        { status: 404 }
      )
    }

    await prisma.theme.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression du thème:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
