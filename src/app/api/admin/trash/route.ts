import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// GET all trashed forms (admin only)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const forms = await prisma.form.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        _count: { select: { responses: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(forms)
  } catch (error) {
    console.error('Get trash error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
