import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionWithUser } from '@/lib/auth'

interface FontRecord {
  id: string
  name: string
  family: string
  source: string
  url: string | null
  weights: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

// DELETE /api/admin/fonts/[id] - Supprimer une police
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionWithUser()
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Vérifier si la police existe
    const font = await (prisma as any).font.findUnique({
      where: { id },
    }) as FontRecord | null

    if (!font) {
      return NextResponse.json({ error: 'Police non trouvée' }, { status: 404 })
    }

    // Ne pas permettre la suppression des polices par défaut
    if (font.isDefault) {
      return NextResponse.json(
        { error: 'Impossible de supprimer une police par défaut' },
        { status: 400 }
      )
    }

    await (prisma as any).font.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression de la police:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/admin/fonts/[id] - Mettre à jour une police
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionWithUser()
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, family, source, url, weights } = body

    const font = await (prisma as any).font.findUnique({
      where: { id },
    }) as FontRecord | null

    if (!font) {
      return NextResponse.json({ error: 'Police non trouvée' }, { status: 404 })
    }

    // Ne pas permettre la modification des polices par défaut
    if (font.isDefault) {
      return NextResponse.json(
        { error: 'Impossible de modifier une police par défaut' },
        { status: 400 }
      )
    }

    const updatedFont = await (prisma as any).font.update({
      where: { id },
      data: {
        name: name || font.name,
        family: family || font.family,
        source: source || font.source,
        url: url !== undefined ? url : font.url,
        weights: weights ? JSON.stringify(weights) : font.weights,
      },
    }) as FontRecord

    return NextResponse.json({
      ...updatedFont,
      weights: JSON.parse(updatedFont.weights),
    })
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la police:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
