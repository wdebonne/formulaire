import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Fonction utilitaire pour vérifier les permissions d'accès au formulaire
async function checkFormAccess(formId: string, userId: string, requiredPermissions: string[] = ['view', 'edit', 'admin']) {
  // Vérifier si le formulaire existe
  const form = await prisma.form.findUnique({
    where: { id: formId }
  })

  if (!form) {
    return { form: null, permission: null, hasAccess: false }
  }

  // Propriétaire
  if (form.userId === userId) {
    return { form, permission: 'owner', hasAccess: true }
  }

  // Admin système
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.role === 'admin') {
    return { form, permission: 'admin', hasAccess: true }
  }

  // Partage
  const share = await prisma.formShare.findFirst({
    where: { formId, userId }
  })

  if (share && requiredPermissions.includes(share.permission)) {
    return { form, permission: share.permission, hasAccess: true }
  }

  return { form: null, permission: null, hasAccess: false }
}

// GET /api/forms/[id]/responses - Liste toutes les réponses d'un formulaire
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Vérifier que l'utilisateur a accès au formulaire (view, edit ou admin)
    const { hasAccess } = await checkFormAccess(id, session.userId, ['view', 'edit', 'admin'])

    if (!hasAccess) {
      return NextResponse.json({ error: 'Formulaire non trouvé ou accès refusé' }, { status: 404 })
    }

    const responses = await prisma.response.findMany({
      where: {
        formId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const parsedResponses = responses.map((r: { id: string; data: string; metadata: string | null; createdAt: Date }) => ({
      ...r,
      data: JSON.parse(r.data),
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    }))

    return NextResponse.json(parsedResponses)
  } catch (error) {
    console.error('Erreur lors de la récupération des réponses:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/forms/[id]/responses - Supprimer toutes les réponses d'un formulaire
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Seuls le propriétaire et les admins peuvent supprimer les réponses
    const { hasAccess, permission } = await checkFormAccess(id, session.userId, ['edit', 'admin'])

    if (!hasAccess || (permission !== 'owner' && permission !== 'admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    await prisma.response.deleteMany({
      where: {
        formId: id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression des réponses:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
