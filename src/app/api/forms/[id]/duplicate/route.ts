import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'
import { getClientIp } from '@/lib/security'
import { logEvent } from '@/lib/audit-log'

interface RouteParams {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const form = await prisma.form.findFirst({
      where: { id: params.id, userId: session.userId }
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    // Generate unique slug
    const baseTitle = `${form.title} (copie)`
    let slug = generateSlug(baseTitle)
    let counter = 1
    while (await prisma.form.findUnique({ where: { slug } })) {
      slug = `${generateSlug(baseTitle)}-${counter}`
      counter++
    }

    const newForm = await prisma.form.create({
      data: {
        title: baseTitle,
        slug,
        description: form.description,
        status: 'draft',
        blocks: form.blocks,
        logic: form.logic,
        settings: form.settings,
        webhooks: form.webhooks,
        themeId: form.themeId,
        userId: session.userId,
      }
    })

    await logEvent({
      action: 'form.duplicate',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'form',
      targetId: newForm.id,
      targetLabel: newForm.title,
      metadata: { sourceFormId: form.id, sourceFormTitle: form.title },
    })

    return NextResponse.json(newForm)
  } catch (error) {
    console.error('Duplicate form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
