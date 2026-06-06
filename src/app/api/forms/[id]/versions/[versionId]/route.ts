import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface RouteParams {
  params: { id: string; versionId: string }
}

// DELETE — remove a specific version
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const form = await prisma.form.findUnique({ where: { id: params.id } })
    if (!form || form.deletedAt) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    if (form.userId !== session.userId) {
      const user = await prisma.user.findUnique({ where: { id: session.userId } })
      if (user?.role !== 'admin') {
        const share = await prisma.formShare.findFirst({ where: { formId: params.id, userId: session.userId } })
        if (!share || !['edit', 'admin'].includes(share.permission)) {
          return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }
      }
    }

    const version = await prisma.formVersion.findUnique({ where: { id: params.versionId } })
    if (!version || version.formId !== params.id) {
      return NextResponse.json({ error: 'Version non trouvée' }, { status: 404 })
    }

    await prisma.formVersion.delete({ where: { id: params.versionId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete version error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
