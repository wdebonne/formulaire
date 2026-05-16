import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// POST import database backup
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const backup = await request.json()

    if (!backup.version || !backup.data) {
      return NextResponse.json({ error: 'Format de sauvegarde invalide' }, { status: 400 })
    }

    const { forms, themes, responses, settings, templates, formShares } = backup.data

    // Importer les données en transaction
    await prisma.$transaction(async (tx) => {
      // Importer les paramètres système
      if (settings && settings.length > 0) {
        for (const setting of settings) {
          await tx.systemSettings.upsert({
            where: { id: setting.id },
            update: { ...setting, updatedAt: new Date() },
            create: setting,
          })
        }
      }

      // Importer les templates
      if (templates && templates.length > 0) {
        for (const template of templates) {
          await tx.emailTemplate.upsert({
            where: { id: template.id },
            update: template,
            create: template,
          })
        }
      }

      // Importer les thèmes
      if (themes && themes.length > 0) {
        for (const theme of themes) {
          // Vérifier si l'utilisateur existe
          const userExists = await tx.user.findUnique({ where: { id: theme.userId || '' } })
          if (userExists || !theme.userId) {
            await tx.theme.upsert({
              where: { id: theme.id },
              update: theme,
              create: theme,
            })
          }
        }
      }

      // Importer les formulaires
      if (forms && forms.length > 0) {
        for (const form of forms) {
          // Vérifier si l'utilisateur existe
          const userExists = await tx.user.findUnique({ where: { id: form.userId } })
          if (userExists) {
            await tx.form.upsert({
              where: { id: form.id },
              update: form,
              create: form,
            })
          }
        }
      }

      // Importer les réponses
      if (responses && responses.length > 0) {
        for (const response of responses) {
          // Vérifier si le formulaire existe
          const formExists = await tx.form.findUnique({ where: { id: response.formId } })
          if (formExists) {
            await tx.response.upsert({
              where: { id: response.id },
              update: response,
              create: response,
            })
          }
        }
      }

      // Importer les partages de formulaires
      if (formShares && formShares.length > 0) {
        for (const share of formShares) {
          const formExists = await tx.form.findUnique({ where: { id: share.formId } })
          const userExists = await tx.user.findUnique({ where: { id: share.userId } })
          if (formExists && userExists) {
            await tx.formShare.upsert({
              where: { id: share.id },
              update: share,
              create: share,
            })
          }
        }
      }
    })

    return NextResponse.json({ success: true, message: 'Import réussi' })
  } catch (error) {
    console.error('Import database error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'import' }, { status: 500 })
  }
}
