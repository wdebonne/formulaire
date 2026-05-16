import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// GET all email templates
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const templates = await prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Get templates error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST create new email template
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { name, slug, subject, htmlContent, variables = [] } = await request.json()

    if (!name || !slug || !subject || !htmlContent) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 })
    }

    // Vérifier si le slug existe déjà
    const existingTemplate = await prisma.emailTemplate.findUnique({ where: { slug } })
    if (existingTemplate) {
      return NextResponse.json({ error: 'Ce slug est déjà utilisé' }, { status: 400 })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        slug,
        subject,
        htmlContent,
        variables: JSON.stringify(variables),
      }
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Create template error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
