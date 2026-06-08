import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { AuditAction } from '@/lib/audit-actions'

export type { AuditAction } from '@/lib/audit-actions'
export { ACTION_LABELS, ACTION_CATEGORIES, actionLabel } from '@/lib/audit-actions'

export interface LogSettings {
  retentionEnabled: boolean
  retentionDays: number
}

export const DEFAULT_LOG_SETTINGS: LogSettings = {
  retentionEnabled: true,
  retentionDays: 365,
}

export async function getLogSettings(): Promise<LogSettings> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })
  if (!settings?.logSettings) return DEFAULT_LOG_SETTINGS

  try {
    return { ...DEFAULT_LOG_SETTINGS, ...JSON.parse(settings.logSettings) }
  } catch {
    return DEFAULT_LOG_SETTINGS
  }
}

// Date avant laquelle les logs sont considérés comme expirés au regard de la durée de conservation configurée
export function getLogRetentionCutoffDate(settings: LogSettings): Date {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - settings.retentionDays)
  return cutoff
}

export interface LogEventParams {
  action: AuditAction
  status?: 'success' | 'failure'
  userId?: string | null
  userEmail?: string | null
  ipAddress?: string | null
  targetType?: string
  targetId?: string
  targetLabel?: string
  metadata?: Record<string, unknown>
}

export interface LogFilters {
  action?: string
  status?: string
  q?: string
  from?: string
  to?: string
}

// Lit les filtres depuis les query params — partagé entre la liste et l'export
// pour garantir que l'export reflète exactement ce que l'admin a filtré
export function parseLogFilters(searchParams: URLSearchParams): LogFilters {
  return {
    action: searchParams.get('action') || undefined,
    status: searchParams.get('status') || undefined,
    q: searchParams.get('q')?.trim() || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  }
}

export function buildAuditLogWhere(filters: LogFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {}

  if (filters.action) where.action = filters.action
  if (filters.status) where.status = filters.status

  if (filters.q) {
    where.OR = [
      { userEmail: { contains: filters.q } },
      { ipAddress: { contains: filters.q } },
      { targetLabel: { contains: filters.q } },
    ]
  }

  if (filters.from || filters.to) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (filters.from) {
      const from = new Date(filters.from)
      if (!isNaN(from.getTime())) createdAt.gte = from
    }
    if (filters.to) {
      const to = new Date(filters.to)
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999)
        createdAt.lte = to
      }
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt
  }

  return where
}

// Écrit une entrée dans le journal d'activité — ne doit jamais faire échouer
// l'action métier appelante : toute erreur est capturée et journalisée en console.
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        status: params.status ?? 'success',
        userId: params.userId ?? null,
        userEmail: params.userEmail ?? null,
        ipAddress: params.ipAddress ?? null,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        targetLabel: params.targetLabel ?? null,
        metadata: JSON.stringify(params.metadata ?? {}),
      },
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}
