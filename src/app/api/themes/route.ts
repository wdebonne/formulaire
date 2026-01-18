import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/themes - Liste tous les thèmes
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const themes = await prisma.theme.findMany({
      where: {
        OR: [{ userId: session.userId }, { isDefault: true }],
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })

    const parsedThemes = themes.map((theme) => ({
      ...theme,
      properties: JSON.parse(theme.properties),
    }))

    return NextResponse.json(parsedThemes)
  } catch (error) {
    console.error('Erreur lors de la récupération des thèmes:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/themes - Créer un nouveau thème
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { name, properties } = body

    const theme = await prisma.theme.create({
      data: {
        name,
        properties: JSON.stringify(properties),
        userId: session.userId,
        isDefault: false,
      },
    })

    return NextResponse.json(theme, { status: 201 })
  } catch (error) {
    console.error('Erreur lors de la création du thème:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
