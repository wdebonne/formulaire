import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

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

    const { forms, themes, responses, settings, templates, formShares, formVersions, fonts } = backup.data

    // Build a set of user IDs that exist in the current DB so we can remap unknown owners
    const existingUsers = await prisma.user.findMany({ select: { id: true } })
    const existingUserIds = new Set(existingUsers.map(u => u.id))
    const fallbackUserId = session.userId

    const stats = {
      settings: 0,
      templates: 0,
      themes: 0,
      forms: 0,
      responses: 0,
      formShares: 0,
      formVersions: 0,
      fonts: 0,
    }

    // Settings and templates don't depend on users — import first
    if (settings && settings.length > 0) {
      for (const setting of settings) {
        await prisma.systemSettings.upsert({
          where: { id: setting.id },
          update: { ...setting, updatedAt: new Date() },
          create: setting,
        })
        stats.settings++
      }
    }

    if (templates && templates.length > 0) {
      for (const template of templates) {
        await prisma.emailTemplate.upsert({
          where: { id: template.id },
          update: template,
          create: template,
        })
        stats.templates++
      }
    }

    if (fonts && fonts.length > 0) {
      for (const font of fonts) {
        await prisma.font.upsert({
          where: { id: font.id },
          update: font,
          create: font,
        })
        stats.fonts++
      }
    }

    if (themes && themes.length > 0) {
      for (const theme of themes) {
        const userId = theme.userId && existingUserIds.has(theme.userId) ? theme.userId : (theme.userId ? fallbackUserId : null)
        const themeData = { ...theme, userId }
        await prisma.theme.upsert({
          where: { id: theme.id },
          update: themeData,
          create: themeData,
        })
        stats.themes++
      }
    }

    // Build a set of theme IDs now in the DB so we can validate themeId on forms
    const existingThemeIds = new Set(
      (await prisma.theme.findMany({ select: { id: true } })).map(t => t.id)
    )

    if (forms && forms.length > 0) {
      for (const form of forms) {
        const userId = existingUserIds.has(form.userId) ? form.userId : fallbackUserId
        const themeId = form.themeId && existingThemeIds.has(form.themeId) ? form.themeId : null

        // Check for slug conflicts with a different form
        const slugConflict = await prisma.form.findUnique({ where: { slug: form.slug } })
        let slug = form.slug
        if (slugConflict && slugConflict.id !== form.id) {
          let counter = 1
          while (await prisma.form.findUnique({ where: { slug: `${form.slug}-${counter}` } })) {
            counter++
          }
          slug = `${form.slug}-${counter}`
        }

        const formData = { ...form, userId, themeId, slug }
        await prisma.form.upsert({
          where: { id: form.id },
          update: formData,
          create: formData,
        })
        stats.forms++
      }
    }

    // Build a set of form IDs now in the DB
    const existingFormIds = new Set(
      (await prisma.form.findMany({ select: { id: true } })).map(f => f.id)
    )

    if (responses && responses.length > 0) {
      for (const response of responses) {
        if (!existingFormIds.has(response.formId)) continue
        await prisma.response.upsert({
          where: { id: response.id },
          update: response,
          create: response,
        })
        stats.responses++
      }
    }

    if (formVersions && formVersions.length > 0) {
      for (const version of formVersions) {
        if (!existingFormIds.has(version.formId)) continue
        await prisma.formVersion.upsert({
          where: { id: version.id },
          update: version,
          create: version,
        })
        stats.formVersions++
      }
    }

    if (formShares && formShares.length > 0) {
      for (const share of formShares) {
        if (!existingFormIds.has(share.formId)) continue
        if (!existingUserIds.has(share.userId)) continue
        await prisma.formShare.upsert({
          where: { id: share.id },
          update: share,
          create: share,
        })
        stats.formShares++
      }
    }

    return NextResponse.json({ success: true, message: 'Import réussi', stats })
  } catch (error) {
    console.error('Import database error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'import' }, { status: 500 })
  }
}
