import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { name, email } = await request.json()

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email !== session.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })

      if (existingUser && existingUser.id !== session.userId) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé' },
          { status: 400 }
        )
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        name,
        email: email.toLowerCase(),
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Erreur mise à jour profil:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
