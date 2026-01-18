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

// GET /api/admin/fonts - Liste toutes les polices
export async function GET() {
  try {
    const user = await getSessionWithUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Utiliser une requête SQL brute pour contourner le problème de régénération du client
    const fonts = await prisma.$queryRaw<FontRecord[]>`
      SELECT * FROM Font ORDER BY isDefault DESC, name ASC
    `

    return NextResponse.json(fonts.map((font: FontRecord) => ({
      ...font,
      weights: JSON.parse(font.weights),
      isDefault: Boolean(font.isDefault),
    })))
  } catch (error) {
    console.error('Erreur lors de la récupération des polices:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/admin/fonts - Ajouter une nouvelle police
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionWithUser()
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { name, family, source = 'google', url, weights = [400, 700] } = body

    if (!name || !family) {
      return NextResponse.json(
        { error: 'Le nom et la famille de police sont requis' },
        { status: 400 }
      )
    }

    // Vérifier si la police existe déjà
    const existingFont = await prisma.$queryRaw<FontRecord[]>`
      SELECT * FROM Font WHERE family = ${family}
    `

    if (existingFont.length > 0) {
      return NextResponse.json(
        { error: 'Cette police existe déjà' },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const weightsJson = JSON.stringify(weights)

    await prisma.$executeRaw`
      INSERT INTO Font (id, name, family, source, url, weights, isDefault, createdAt, updatedAt)
      VALUES (${id}, ${name}, ${family}, ${source}, ${url || null}, ${weightsJson}, 0, ${now}, ${now})
    `

    const font = {
      id,
      name,
      family,
      source,
      url: url || null,
      weights,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    }

    return NextResponse.json(font, { status: 201 })
  } catch (error) {
    console.error('Erreur lors de la création de la police:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
