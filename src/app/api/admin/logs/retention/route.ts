import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getLogRetentionCutoffDate, getLogSettings } from '@/lib/audit-log'

// GET nombre de logs dépassant la durée de conservation configurée (admin uniquement)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getLogSettings()
    const cutoff = getLogRetentionCutoffDate(settings)

    const total = await prisma.auditLog.count({ where: { createdAt: { lt: cutoff } } })

    return NextResponse.json({ cutoff, retentionDays: settings.retentionDays, total })
  } catch (error) {
    console.error('Get log retention count error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE purge des logs dépassant la durée de conservation configurée (admin uniquement)
export async function DELETE() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getLogSettings()
    // La date de coupure est toujours recalculée côté serveur — jamais transmise par le client
    const cutoff = getLogRetentionCutoffDate(settings)

    const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('Purge expired audit logs error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
