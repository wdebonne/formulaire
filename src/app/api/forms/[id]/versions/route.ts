import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

async function checkFormEditAccess(formId: string, userId: string) {
  const form = await prisma.form.findUnique({ where: { id: formId } })
  if (!form || form.deletedAt) return { form: null, hasAccess: false }
  if (form.userId === userId) return { form, hasAccess: true }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.role === 'admin') return { form, hasAccess: true }

  const share = await prisma.formShare.findFirst({ where: { formId, userId } })
  if (share && ['edit', 'admin'].includes(share.permission)) return { form, hasAccess: true }

  return { form: null, hasAccess: false }
}

// GET — list all versions for a form
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { hasAccess } = await checkFormEditAccess(params.id, session.userId)
    if (!hasAccess) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const versions = await prisma.formVersion.findMany({
      where: { formId: params.id },
      orderBy: { number: 'desc' },
      select: {
        id: true,
        number: true,
        label: true,
        isAuto: true,
        title: true,
        themeId: true,
        createdBy: true,
        createdAt: true,
      },
    })

    return NextResponse.json(versions)
  } catch (error) {
    console.error('List versions error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — create a manual version
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { form, hasAccess } = await checkFormEditAccess(params.id, session.userId)
    if (!hasAccess || !form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const body = await request.json()
    const { label } = body

    const last = await prisma.formVersion.findFirst({
      where: { formId: params.id },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    const version = await prisma.formVersion.create({
      data: {
        formId: params.id,
        number: (last?.number ?? 0) + 1,
        label: label ?? null,
        isAuto: false,
        title: form.title,
        blocks: form.blocks,
        logic: form.logic,
        settings: form.settings,
        webhooks: form.webhooks,
        themeId: form.themeId,
        createdBy: session.userId,
      },
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    console.error('Create version error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
