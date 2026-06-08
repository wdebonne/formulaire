import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'
import { getClientIp } from '@/lib/security'
import { logEvent } from '@/lib/audit-log'

// GET all forms for user (including shared forms)
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'utilisateur avec son rôle
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true }
    })

    let forms

    if (user?.role === 'admin') {
      // Les admins voient tous les formulaires non supprimés
      forms = await prisma.form.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { responses: true }
          },
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      })
    } else {
      // Les utilisateurs voient leurs formulaires + ceux partagés avec eux
      const [ownForms, sharedForms] = await Promise.all([
        // Formulaires propres non supprimés
        prisma.form.findMany({
          where: { userId: session.userId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          include: {
            _count: {
              select: { responses: true }
            },
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }),
        // Formulaires partagés non supprimés
        prisma.formShare.findMany({
          where: { userId: session.userId, form: { deletedAt: null } },
          include: {
            form: {
              include: {
                _count: {
                  select: { responses: true }
                },
                user: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          }
        })
      ])

      // Combiner et marquer les formulaires partagés
      const sharedFormsList = sharedForms.map(share => ({
        ...share.form,
        isShared: true,
        sharePermission: share.permission,
      }))

      forms = [
        ...ownForms.map(f => ({ ...f, isShared: false })),
        ...sharedFormsList
      ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

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

    await logEvent({
      action: 'form.create',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'form',
      targetId: form.id,
      targetLabel: form.title,
    })

    return NextResponse.json(form)
  } catch (error) {
    console.error('Create form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
