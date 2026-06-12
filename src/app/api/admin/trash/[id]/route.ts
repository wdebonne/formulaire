import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getClientIp } from '@/lib/security'
import { logEvent } from '@/lib/audit-log'

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

    // Un formulaire orphelin (compte supprimé → userId null) doit obligatoirement
    // être réassigné à un utilisateur existant lors de la restauration.
    if (!form.userId && !newUserId) {
      return NextResponse.json(
        { error: 'Ce formulaire appartient à un compte supprimé. Choisissez un nouveau propriétaire avant de restaurer.' },
        { status: 400 }
      )
    }

    await prisma.form.update({
      where: { id: params.id },
      data: {
        deletedAt: null,
        ...(newUserId ? { userId: newUserId } : {}),
      },
    })

    await logEvent({
      action: 'form.restore',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'form',
      targetId: form.id,
      targetLabel: form.title,
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

    await logEvent({
      action: 'form.permanent_delete',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'form',
      targetId: form.id,
      targetLabel: form.title,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Permanent delete form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
