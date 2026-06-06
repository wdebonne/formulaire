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

    if (!hasAccess || !form || form.deletedAt) {
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

    const newSaveCount = existingForm.saveCount + 1
    const newBlocks = blocks ? JSON.stringify(blocks) : existingForm.blocks
    const newLogic = logic ? JSON.stringify(logic) : existingForm.logic
    const newSettings = settings ? JSON.stringify(settings) : existingForm.settings
    const newWebhooks = webhooks ? JSON.stringify(webhooks) : existingForm.webhooks
    const newThemeId = themeId !== undefined ? themeId : existingForm.themeId
    const newTitle = title ?? existingForm.title

    const shouldAutoVersion = newSaveCount % 10 === 0

    const ops: Parameters<typeof prisma.$transaction>[0] = [
      prisma.form.update({
        where: { id: params.id },
        data: {
          title: newTitle,
          slug,
          description: description ?? existingForm.description,
          status: status ?? existingForm.status,
          blocks: newBlocks,
          logic: newLogic,
          settings: newSettings,
          webhooks: newWebhooks,
          themeId: newThemeId,
          saveCount: newSaveCount,
        },
      }),
    ]

    if (shouldAutoVersion) {
      const last = await prisma.formVersion.findFirst({
        where: { formId: params.id },
        orderBy: { number: 'desc' },
        select: { number: true },
      })
      ops.push(
        prisma.formVersion.create({
          data: {
            formId: params.id,
            number: (last?.number ?? 0) + 1,
            label: null,
            isAuto: true,
            title: newTitle,
            blocks: newBlocks,
            logic: newLogic,
            settings: newSettings,
            webhooks: newWebhooks,
            themeId: newThemeId,
            createdBy: session.userId,
          },
        })
      )
    }

    const [form] = await prisma.$transaction(ops)

    return NextResponse.json(form)
  } catch (error) {
    console.error('Update form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE form — soft delete (propriétaire ou admin système)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { form, hasAccess, permission } = await checkFormAccess(params.id, session.userId)

    if (!hasAccess || !form || (permission !== 'owner' && permission !== 'admin')) {
      return NextResponse.json({ error: 'Formulaire non trouvé ou accès refusé' }, { status: 404 })
    }

    await prisma.form.update({
      where: { id: params.id },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
