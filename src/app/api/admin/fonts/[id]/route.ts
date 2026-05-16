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
  isDefault: boolean | number
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
    const fonts = await prisma.$queryRaw<FontRecord[]>`
      SELECT * FROM Font WHERE id = ${id}
    `

    if (fonts.length === 0) {
      return NextResponse.json({ error: 'Police non trouvée' }, { status: 404 })
    }

    const font = fonts[0]

    // Ne pas permettre la suppression des polices par défaut
    if (font.isDefault) {
      return NextResponse.json(
        { error: 'Impossible de supprimer une police par défaut' },
        { status: 400 }
      )
    }

    await prisma.$executeRaw`DELETE FROM Font WHERE id = ${id}`

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

    const fonts = await prisma.$queryRaw<FontRecord[]>`
      SELECT * FROM Font WHERE id = ${id}
    `

    if (fonts.length === 0) {
      return NextResponse.json({ error: 'Police non trouvée' }, { status: 404 })
    }

    const font = fonts[0]

    // Ne pas permettre la modification des polices par défaut
    if (font.isDefault) {
      return NextResponse.json(
        { error: 'Impossible de modifier une police par défaut' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const newName = name || font.name
    const newFamily = family || font.family
    const newSource = source || font.source
    const newUrl = url !== undefined ? url : font.url
    const newWeights = weights ? JSON.stringify(weights) : font.weights

    await prisma.$executeRaw`
      UPDATE Font 
      SET name = ${newName}, family = ${newFamily}, source = ${newSource}, 
          url = ${newUrl}, weights = ${newWeights}, updatedAt = ${now}
      WHERE id = ${id}
    `

    return NextResponse.json({
      id,
      name: newName,
      family: newFamily,
      source: newSource,
      url: newUrl,
      weights: typeof newWeights === 'string' ? JSON.parse(newWeights) : newWeights,
      isDefault: Boolean(font.isDefault),
      createdAt: font.createdAt,
      updatedAt: now,
    })
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la police:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
