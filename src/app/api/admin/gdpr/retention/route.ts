import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getGdprSettings, getRetentionCutoffDate } from '@/lib/gdpr'

// GET nombre de réponses dépassant la durée de conservation configurée (admin uniquement)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getGdprSettings()
    const cutoff = getRetentionCutoffDate(settings)

    const expired = await prisma.response.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { formId: true, form: { select: { title: true } } },
    })

    const byFormMap = new Map<string, { formId: string; formTitle: string; count: number }>()
    for (const r of expired) {
      const entry = byFormMap.get(r.formId)
      if (entry) {
        entry.count++
      } else {
        byFormMap.set(r.formId, { formId: r.formId, formTitle: r.form.title, count: 1 })
      }
    }

    return NextResponse.json({
      cutoff,
      retentionMonths: settings.retentionMonths,
      total: expired.length,
      byForm: Array.from(byFormMap.values()).sort((a, b) => b.count - a.count),
    })
  } catch (error) {
    console.error('Get GDPR retention count error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE purge des réponses dépassant la durée de conservation configurée (admin uniquement)
export async function DELETE() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getGdprSettings()
    // La date de coupure est toujours recalculée côté serveur — jamais transmise par le client
    const cutoff = getRetentionCutoffDate(settings)

    const result = await prisma.response.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('Purge expired GDPR responses error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
