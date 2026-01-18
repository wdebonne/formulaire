import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// GET single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params

    const template = await prisma.emailTemplate.findUnique({
      where: { id }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template non trouvé' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Get template error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const { name, slug, subject, htmlContent, variables } = await request.json()

    // Vérifier si le template existe
    const existingTemplate = await prisma.emailTemplate.findUnique({ where: { id } })
    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template non trouvé' }, { status: 404 })
    }

    // Vérifier si le nouveau slug est déjà utilisé par un autre template
    if (slug && slug !== existingTemplate.slug) {
      const slugExists = await prisma.emailTemplate.findUnique({ where: { slug } })
      if (slugExists) {
        return NextResponse.json({ error: 'Ce slug est déjà utilisé' }, { status: 400 })
      }
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(subject && { subject }),
        ...(htmlContent && { htmlContent }),
        ...(variables && { variables: JSON.stringify(variables) }),
      }
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Update template error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE template
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

    // Vérifier si le template existe
    const existingTemplate = await prisma.emailTemplate.findUnique({ where: { id } })
    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template non trouvé' }, { status: 404 })
    }

    // Empêcher la suppression des templates par défaut
    if (existingTemplate.isDefault) {
      return NextResponse.json({ error: 'Impossible de supprimer un template par défaut' }, { status: 400 })
    }

    await prisma.emailTemplate.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete template error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
