import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { buildAuditLogWhere, parseLogFilters } from '@/lib/audit-log'
import { actionLabel } from '@/lib/audit-actions'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import * as XLSX from 'xlsx'

const MAX_EXPORT_ROWS = 50000

// POST export Excel du journal d'activité filtré (admin uniquement)
// Reprend exactement les mêmes filtres que la liste, pour que l'export
// corresponde toujours à ce que l'admin a sous les yeux
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const params = new URLSearchParams()
    for (const key of ['action', 'status', 'q', 'from', 'to']) {
      if (typeof body[key] === 'string' && body[key]) params.set(key, body[key])
    }

    const where = buildAuditLogWhere(parseLogFilters(params))

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    })

    const headerRow = ['Date', 'Action', 'Statut', 'Utilisateur', 'Adresse IP', 'Cible', 'Détails']
    const dataRows = logs.map((log) => [
      format(log.createdAt, 'dd/MM/yyyy HH:mm:ss', { locale: fr }),
      actionLabel(log.action),
      log.status === 'success' ? 'Succès' : 'Échec',
      log.userEmail || '—',
      log.ipAddress || '—',
      log.targetLabel || '—',
      formatMetadata(log.metadata),
    ])

    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    XLSX.utils.book_append_sheet(wb, sheet, 'Journal d\'activité')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="journal-activite.xlsx"',
      },
    })
  } catch (error) {
    console.error('Export audit logs error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function formatMetadata(raw: string): string {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return ''
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' • ')
  } catch {
    return ''
  }
}
