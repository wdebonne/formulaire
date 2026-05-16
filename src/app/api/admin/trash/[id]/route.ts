import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

// POST — restore a trashed form (admin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const form = await prisma.form.findFirst({
      where: { id: params.id, deletedAt: { not: null } },
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé dans la corbeille' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const newUserId: string | undefined = body.userId

    await prisma.form.update({
      where: { id: params.id },
      data: {
        deletedAt: null,
        ...(newUserId ? { userId: newUserId } : {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Restore form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — permanently delete a trashed form (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const form = await prisma.form.findFirst({
      where: { id: params.id, deletedAt: { not: null } },
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé dans la corbeille' }, { status: 404 })
    }

    await prisma.form.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Permanent delete form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
