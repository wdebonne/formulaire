import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'

interface RouteParams {
  params: { id: string }
}

// Fonction utilitaire pour vérifier les permissions d'accès au formulaire
async function checkFormAccess(formId: string, userId: string, requiredPermissions: string[] = ['view', 'edit', 'admin']) {
  // Vérifier si l'utilisateur est le propriétaire
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: { theme: true }
  })

  if (!form) {
    return { form: null, permission: null, hasAccess: false }
  }

  if (form.userId === userId) {
    return { form, permission: 'owner', hasAccess: true }
  }

  // Vérifier si l'utilisateur est admin système
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.role === 'admin') {
    return { form, permission: 'admin', hasAccess: true }
  }

  // Vérifier si le formulaire est partagé avec l'utilisateur
  const share = await prisma.formShare.findFirst({
    where: { formId, userId }
  })

  if (share && requiredPermissions.includes(share.permission)) {
    return { form, permission: share.permission, hasAccess: true }
  }

  return { form: null, permission: null, hasAccess: false }
}

// GET single form
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { form, hasAccess } = await checkFormAccess(params.id, session.userId, ['view', 'edit', 'admin'])

    if (!hasAccess || !form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    return NextResponse.json({
      ...form,
      blocks: JSON.parse(form.blocks),
      logic: JSON.parse(form.logic),
      settings: JSON.parse(form.settings),
      webhooks: JSON.parse(form.webhooks),
      theme: form.theme ? {
        ...form.theme,
        properties: JSON.parse(form.theme.properties)
      } : null
    })
  } catch (error) {
    console.error('Get form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT update form
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { form: existingForm, hasAccess } = await checkFormAccess(params.id, session.userId, ['edit', 'admin'])

    if (!hasAccess || !existingForm) {
      return NextResponse.json({ error: 'Formulaire non trouvé ou accès refusé' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, status, blocks, logic, settings, webhooks, themeId } = body

    // Update slug if title changed
    let slug = existingForm.slug
    if (title && title !== existingForm.title) {
      slug = generateSlug(title)
      let counter = 1
      while (await prisma.form.findFirst({ where: { slug, id: { not: params.id } } })) {
        slug = `${generateSlug(title)}-${counter}`
        counter++
      }
    }

    const form = await prisma.form.update({
      where: { id: params.id },
      data: {
        title: title ?? existingForm.title,
        slug,
        description: description ?? existingForm.description,
        status: status ?? existingForm.status,
        blocks: blocks ? JSON.stringify(blocks) : existingForm.blocks,
        logic: logic ? JSON.stringify(logic) : existingForm.logic,
        settings: settings ? JSON.stringify(settings) : existingForm.settings,
        webhooks: webhooks ? JSON.stringify(webhooks) : existingForm.webhooks,
        themeId: themeId !== undefined ? themeId : existingForm.themeId,
      }
    })

    return NextResponse.json(form)
  } catch (error) {
    console.error('Update form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE form (seul le propriétaire peut supprimer)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Seul le propriétaire peut supprimer
    const form = await prisma.form.findFirst({
      where: { id: params.id, userId: session.userId }
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé ou accès refusé' }, { status: 404 })
    }

    await prisma.form.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
