import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const form = await prisma.form.findFirst({
      where: { id: params.id, userId: session.userId },
      include: { theme: true }
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      form: {
        title: form.title,
        slug: form.slug,
        description: form.description,
        blocks: JSON.parse(form.blocks),
        logic: JSON.parse(form.logic),
        settings: JSON.parse(form.settings),
        webhooks: JSON.parse(form.webhooks),
        theme: form.theme ? {
          name: form.theme.name,
          properties: JSON.parse(form.theme.properties)
        } : null
      }
    }

    return NextResponse.json(exportData)
  } catch (error) {
    console.error('Export form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
