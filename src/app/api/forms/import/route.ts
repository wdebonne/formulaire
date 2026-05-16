import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const importData = await request.json()

    if (!importData.form) {
      return NextResponse.json({ error: 'Format d\'import invalide' }, { status: 400 })
    }

    const { form: formData } = importData

    // Generate unique slug
    let slug = generateSlug(formData.title || 'Formulaire importé')
    let counter = 1
    while (await prisma.form.findUnique({ where: { slug } })) {
      slug = `${generateSlug(formData.title || 'Formulaire importé')}-${counter}`
      counter++
    }

    // Create or find theme if provided
    let themeId = null
    if (formData.theme) {
      const existingTheme = await prisma.theme.findFirst({
        where: {
          userId: session.userId,
          name: formData.theme.name
        }
      })

      if (existingTheme) {
        themeId = existingTheme.id
      } else {
        const newTheme = await prisma.theme.create({
          data: {
            name: formData.theme.name,
            properties: JSON.stringify(formData.theme.properties || {}),
            userId: session.userId
          }
        })
        themeId = newTheme.id
      }
    }

    const form = await prisma.form.create({
      data: {
        title: formData.title || 'Formulaire importé',
        slug,
        description: formData.description || '',
        status: 'draft',
        blocks: JSON.stringify(formData.blocks || []),
        logic: JSON.stringify(formData.logic || {}),
        settings: JSON.stringify(formData.settings || {}),
        webhooks: JSON.stringify(formData.webhooks || []),
        themeId,
        userId: session.userId,
      }
    })

    return NextResponse.json(form)
  } catch (error) {
    console.error('Import form error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
