import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getClientIp } from '@/lib/security'
import { getLogRetentionCutoffDate, getLogSettings } from '@/lib/audit-log'
import { purgeExpiredAuditLogs } from '@/lib/retention-purge'

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

// DELETE purge des logs dépassant la durée de conservation configurée (admin uniquement).
// Même code que la purge automatique — la coupure est recalculée côté serveur, jamais reçue
// du client, et l'opération laisse une entrée au journal d'activité.
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getLogSettings()
    const result = await purgeExpiredAuditLogs(settings, {
      trigger: 'manual',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ success: true, deleted: result.deleted })
  } catch (error) {
    console.error('Purge expired audit logs error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
