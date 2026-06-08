import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { buildAuditLogWhere, parseLogFilters } from '@/lib/audit-log'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

// GET liste paginée et filtrée du journal d'activité (admin uniquement)
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE))

    const where = buildAuditLogWhere(parseLogFilters(searchParams))

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs: logs.map((log) => ({ ...log, metadata: JSON.parse(log.metadata) })),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('List audit logs error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
