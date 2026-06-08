import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// GET currently blocked IPs (admin only)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const blocks = await prisma.ipBlock.findMany({
      where: { blockedUntil: { gt: new Date() } },
      orderBy: { blockedUntil: 'desc' },
    })

    return NextResponse.json(blocks)
  } catch (error) {
    console.error('Get blocked IPs error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
