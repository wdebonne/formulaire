import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendFormSharedEmail } from '@/lib/email'

// GET shares for a form
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Vérifier que l'utilisateur est le propriétaire du formulaire, admin système, ou admin du formulaire
    const form = await prisma.form.findUnique({
      where: { id },
      include: { user: { select: { id: true, role: true } } }
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    const userShare = await prisma.formShare.findFirst({
      where: { formId: id, userId: session.userId }
    })
    
    const isOwner = form.userId === session.userId
    const isSystemAdmin = user?.role === 'admin'
    const isFormAdmin = userShare?.permission === 'admin'
    
    if (!isOwner && !isSystemAdmin && !isFormAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const shares = await prisma.formShare.findMany({
      where: { formId: id },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    })

    return NextResponse.json(shares)
  } catch (error) {
    console.error('Get shares error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST create share
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const { email, permission = 'view' } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    if (!['view', 'edit', 'admin'].includes(permission)) {
      return NextResponse.json({ error: 'Permission invalide' }, { status: 400 })
    }

    // Vérifier que l'utilisateur est le propriétaire du formulaire, admin système, ou admin du formulaire
    const form = await prisma.form.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, role: true } } }
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const currentUser = await prisma.user.findUnique({ where: { id: session.userId } })
    const userShare = await prisma.formShare.findFirst({
      where: { formId: id, userId: session.userId }
    })
    
    const isOwner = form.userId === session.userId
    const isSystemAdmin = currentUser?.role === 'admin'
    const isFormAdmin = userShare?.permission === 'admin'
    
    if (!isOwner && !isSystemAdmin && !isFormAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Trouver l'utilisateur à ajouter
    const userToShare = await prisma.user.findUnique({ where: { email } })
    if (!userToShare) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Vérifier que ce n'est pas le propriétaire
    if (userToShare.id === form.userId) {
      return NextResponse.json({ error: 'Impossible de partager avec le propriétaire' }, { status: 400 })
    }

    // Vérifier si le partage existe déjà
    const existingShare = await prisma.formShare.findUnique({
      where: {
        formId_userId: {
          formId: id,
          userId: userToShare.id
        }
      }
    })

    if (existingShare) {
      // Mettre à jour la permission
      const share = await prisma.formShare.update({
        where: { id: existingShare.id },
        data: { permission },
        include: {
          user: { select: { id: true, email: true, name: true } }
        }
      })
      return NextResponse.json(share)
    }

    // Créer le partage
    const share = await prisma.formShare.create({
      data: {
        formId: id,
        userId: userToShare.id,
        permission,
      },
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    })

    // Envoyer un email de notification
    try {
      await sendFormSharedEmail(
        userToShare.email,
        form.title,
        currentUser?.name || currentUser?.email || 'Un utilisateur',
        form.id
      )
    } catch (e) {
      console.error('Error sending share notification email:', e)
    }

    return NextResponse.json(share)
  } catch (error) {
    console.error('Create share error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE remove share
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
    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')

    if (!shareId) {
      return NextResponse.json({ error: 'ID du partage requis' }, { status: 400 })
    }

    // Vérifier que l'utilisateur est le propriétaire du formulaire, admin système, ou admin du formulaire
    const form = await prisma.form.findUnique({ where: { id } })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    const userShare = await prisma.formShare.findFirst({
      where: { formId: id, userId: session.userId }
    })
    
    const isOwner = form.userId === session.userId
    const isSystemAdmin = user?.role === 'admin'
    const isFormAdmin = userShare?.permission === 'admin'
    
    if (!isOwner && !isSystemAdmin && !isFormAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    await prisma.formShare.delete({ where: { id: shareId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete share error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH update share permission
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const { shareId, permission } = await request.json()

    if (!shareId || !permission) {
      return NextResponse.json({ error: 'ID du partage et permission requis' }, { status: 400 })
    }

    if (!['view', 'edit', 'admin'].includes(permission)) {
      return NextResponse.json({ error: 'Permission invalide' }, { status: 400 })
    }

    // Vérifier que l'utilisateur est le propriétaire du formulaire, admin système, ou admin du formulaire
    const form = await prisma.form.findUnique({ where: { id } })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    const userShare = await prisma.formShare.findFirst({
      where: { formId: id, userId: session.userId }
    })
    
    const isOwner = form.userId === session.userId
    const isSystemAdmin = user?.role === 'admin'
    const isFormAdmin = userShare?.permission === 'admin'
    
    if (!isOwner && !isSystemAdmin && !isFormAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const updatedShare = await prisma.formShare.update({
      where: { id: shareId },
      data: { permission },
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    })

    return NextResponse.json(updatedShare)
  } catch (error) {
    console.error('Update share error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
