import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// DELETE = débloquer manuellement une IP (réinitialise le compteur et lève le blocage)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params

    await prisma.ipBlock.update({
      where: { id },
      data: { failedAttempts: 0, blockedUntil: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unblock IP error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
