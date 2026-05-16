import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/users/search - Recherche d'utilisateurs pour le partage
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const excludeIds = searchParams.get('exclude')?.split(',').filter(Boolean) || []

    // Exclure l'utilisateur actuel et les admins
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { role: { not: 'admin' } }, // Exclure les administrateurs
          { id: { not: session.userId } }, // Exclure l'utilisateur actuel
          { id: { notIn: excludeIds } }, // Exclure les IDs spécifiés
          query ? {
            OR: [
              { email: { contains: query } },
              { name: { contains: query } },
            ]
          } : {}
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
      take: 10,
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Search users error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
