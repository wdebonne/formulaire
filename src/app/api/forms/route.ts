import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'

// GET all forms for user
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const forms = await prisma.form.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { responses: true }
        }
      }
    })

    return NextResponse.json(forms)
  } catch (error) {
    console.error('Get forms error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST create new form
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { title = 'Nouveau formulaire' } = await request.json()

    // Generate unique slug
    let slug = generateSlug(title)
    let counter = 1
    while (await prisma.form.findUnique({ where: { slug } })) {
      slug = `${generateSlug(title)}-${counter}`
      counter++
    }

    // Get default theme
    const defaultTheme = await prisma.theme.findFirst({
      where: { userId: session.userId, isDefault: true }
    })

    const form = await prisma.form.create({
      data: {
        title,
        slug,
        userId: session.userId,
        themeId: defaultTheme?.id,
        blocks: JSON.stringify([
          {
            id: 'welcome',
            type: 'welcome-screen',
            attributes: {
              label: 'Bienvenue !',
              description: 'Ce formulaire ne prendra que quelques minutes.',
              buttonText: 'Commencer'
            }
          }
        ]),
        settings: JSON.stringify({
          showProgressBar: true,
          showQuestionNumbers: true,
          lettersOnAnswers: true,
          animationDirection: 'vertical',
        })
      }
    })

    return NextResponse.json(form)
  } catch (error) {
    console.error('Create form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
