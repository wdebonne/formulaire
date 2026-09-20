// Purge des données expirées — réponses (RGPD) et entrées du journal d'activité.
//
// Une seule implémentation pour deux déclencheurs : le bouton « Purger » des écrans
// d'administration et le passage quotidien de la minuterie interne. Une conservation qui
// dépend de quelqu'un qui pense à cliquer n'est pas une conservation ; la purge automatique
// existe pour cette raison, mais elle reste un interrupteur, jamais un comportement imposé
// par une mise à jour (voir `DEFAULT_GDPR_SETTINGS.autoPurgeEnabled`).
//
// La date de coupure est toujours recalculée ici, à partir des paramètres lus en base — elle
// n'est jamais transmise par un client, même administrateur.

import { prisma } from './prisma'
import { deleteFilesOfResponses } from './response-uploads'
import { getGdprSettings, getRetentionCutoffDate } from './gdpr'
import { getLogRetentionCutoffDate, getLogSettings, logEvent, type LogSettings } from './audit-log'
import type { GdprSettings } from '@/types/form'

export type PurgeTrigger = 'manual' | 'scheduler'

export interface PurgeResult {
  deleted: number
  cutoff: Date
}

export interface RetentionRunSummary {
  responsesDeleted: number
  logsDeleted: number
  errors: string[]
}

// Un passage par jour suffit : la coupure se déplace de 24 h, pas de cinq minutes.
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Supprime les réponses dépassant la durée de conservation, pièces jointes comprises.
 *
 * Journalise l'opération dès qu'elle supprime quelque chose — un passage à vide n'écrit rien,
 * sans quoi la purge quotidienne produirait 365 entrées par an pour ne rien dire.
 */
export async function purgeExpiredResponses(
  settings: Required<GdprSettings>,
  context: { trigger: PurgeTrigger; userId?: string | null; userEmail?: string | null; ipAddress?: string | null } = {
    trigger: 'manual',
  }
): Promise<PurgeResult> {
  const cutoff = getRetentionCutoffDate(settings)

  const doomed = await prisma.response.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { formId: true, data: true },
  })
  // Les pièces jointes vivent sur le disque, hors de la base : les laisser derrière
  // ferait survivre le fichier à la réponse qui le référençait.
  await deleteFilesOfResponses(doomed)

  const result = await prisma.response.deleteMany({ where: { createdAt: { lt: cutoff } } })

  if (result.count > 0) {
    await logEvent({
      action: 'gdpr.retention_purge',
      userId: context.userId ?? null,
      userEmail: context.userEmail ?? null,
      ipAddress: context.ipAddress ?? null,
      targetType: 'response',
      targetLabel: `${result.count} réponse(s)`,
      metadata: {
        trigger: context.trigger,
        deleted: result.count,
        retentionMonths: settings.retentionMonths,
        cutoff: cutoff.toISOString(),
      },
    })
  }

  return { deleted: result.count, cutoff }
}

/**
 * Supprime les entrées du journal dépassant la durée de conservation.
 *
 * L'entrée qui rend compte de la purge est écrite *après* la suppression : elle date de
 * maintenant, donc elle ne s'auto-efface pas.
 */
export async function purgeExpiredAuditLogs(
  settings: LogSettings,
  context: { trigger: PurgeTrigger; userId?: string | null; userEmail?: string | null; ipAddress?: string | null } = {
    trigger: 'manual',
  }
): Promise<PurgeResult> {
  const cutoff = getLogRetentionCutoffDate(settings)

  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })

  if (result.count > 0) {
    await logEvent({
      action: 'logs.retention_purge',
      userId: context.userId ?? null,
      userEmail: context.userEmail ?? null,
      ipAddress: context.ipAddress ?? null,
      targetType: 'audit_log',
      targetLabel: `${result.count} entrée(s)`,
      metadata: {
        trigger: context.trigger,
        deleted: result.count,
        retentionDays: settings.retentionDays,
        cutoff: cutoff.toISOString(),
      },
    })
  }

  return { deleted: result.count, cutoff }
}

function isPurgeDue(lastRunAt: string | null | undefined, now: Date): boolean {
  if (!lastRunAt) return true
  const last = new Date(lastRunAt)
  if (Number.isNaN(last.getTime())) return true
  return now.getTime() - last.getTime() >= PURGE_INTERVAL_MS
}

// Relit les paramètres juste avant d'écrire : la minuterie peut tourner pendant qu'un
// administrateur modifie la durée de conservation dans l'écran correspondant.
async function stampGdprPurge(at: Date): Promise<void> {
  const current = await getGdprSettings()
  const payload = JSON.stringify({ ...current, lastAutoPurgeAt: at.toISOString() })
  await prisma.systemSettings.upsert({
    where: { id: 'system' },
    create: { id: 'system', gdprSettings: payload },
    update: { gdprSettings: payload },
  })
}

async function stampLogPurge(at: Date): Promise<void> {
  const current = await getLogSettings()
  const payload = JSON.stringify({ ...current, lastAutoPurgeAt: at.toISOString() })
  await prisma.systemSettings.upsert({
    where: { id: 'system' },
    create: { id: 'system', logSettings: payload },
    update: { logSettings: payload },
  })
}

/**
 * Exécute les purges automatiques dont l'échéance quotidienne est atteinte.
 *
 * Ne lève jamais : une purge en échec est consignée et n'empêche pas l'autre de s'exécuter.
 * L'horodatage est posé même après un échec — sans quoi une base indisponible ferait
 * retenter la même purge à chaque passage de la minuterie, soit toutes les cinq minutes.
 */
export async function runDueRetentionPurges(now: Date = new Date()): Promise<RetentionRunSummary> {
  const summary: RetentionRunSummary = { responsesDeleted: 0, logsDeleted: 0, errors: [] }

  try {
    const gdpr = await getGdprSettings()
    if (gdpr.retentionEnabled && gdpr.autoPurgeEnabled && isPurgeDue(gdpr.lastAutoPurgeAt, now)) {
      try {
        const result = await purgeExpiredResponses(gdpr, { trigger: 'scheduler' })
        summary.responsesDeleted = result.deleted
      } catch (error: any) {
        summary.errors.push(`Réponses : ${error?.message || 'erreur inconnue'}`)
        console.error('Purge automatique RGPD — échec:', error)
      } finally {
        await stampGdprPurge(now)
      }
    }
  } catch (error: any) {
    summary.errors.push(`Réponses : ${error?.message || 'paramètres illisibles'}`)
    console.error('Purge automatique RGPD — paramètres illisibles:', error)
  }

  try {
    const logs = await getLogSettings()
    if (logs.retentionEnabled && logs.autoPurgeEnabled && isPurgeDue(logs.lastAutoPurgeAt, now)) {
      try {
        const result = await purgeExpiredAuditLogs(logs, { trigger: 'scheduler' })
        summary.logsDeleted = result.deleted
      } catch (error: any) {
        summary.errors.push(`Journal : ${error?.message || 'erreur inconnue'}`)
        console.error('Purge automatique du journal — échec:', error)
      } finally {
        await stampLogPurge(now)
      }
    }
  } catch (error: any) {
    summary.errors.push(`Journal : ${error?.message || 'paramètres illisibles'}`)
    console.error('Purge automatique du journal — paramètres illisibles:', error)
  }

  return summary
}
