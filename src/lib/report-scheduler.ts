// Planificateur des rapports périodiques.
//
// L'application est distribuée comme un conteneur unique (`node server.js`) : plutôt que
// d'exiger la configuration d'un cron externe, une minuterie en processus vérifie
// régulièrement les échéances. Le même travail est exposé sur /api/internal/reports/run pour
// qui préfère piloter l'envoi depuis un cron système.
//
// Rien n'est envoyé « en retard de plusieurs échéances » : seule la dernière échéance passée
// est comparée à `schedule.lastRunAt`, donc un conteneur arrêté une semaine envoie un rapport
// au redémarrage, pas sept.

import { prisma } from './prisma'
import { sendReportForForm, type ReportFormRecord } from './report-delivery'
import { isScheduleDue, parseFormReportSettings } from './report-settings'
import type { FormReportSettings } from '@/types/form'

const DEFAULT_INTERVAL_MINUTES = 5

export interface ReportRunSummary {
  checked: number
  sent: number
  failed: number
  errors: string[]
}

function isClosingDue(settings: FormReportSettings, now: Date): boolean {
  if (!settings.sendFinalReportOnClosing || !settings.closingDate) return false
  if (settings.finalReportSentAt) return false
  const closing = new Date(`${settings.closingDate}T23:59:59`)
  return !Number.isNaN(closing.getTime()) && closing.getTime() <= now.getTime()
}

/**
 * Parcourt les formulaires et envoie les rapports dont l'échéance est atteinte.
 *
 * Ne lève jamais : une erreur sur un formulaire est consignée et n'interrompt pas les suivants.
 */
export async function runDueReports(now: Date = new Date()): Promise<ReportRunSummary> {
  const summary: ReportRunSummary = { checked: 0, sent: 0, failed: 0, errors: [] }

  let forms: ReportFormRecord[]
  try {
    forms = await prisma.form.findMany({
      where: { deletedAt: null, NOT: { reportSettings: '{}' } },
      select: { id: true, title: true, slug: true, blocks: true, reportSettings: true, createdAt: true },
    })
  } catch (error: any) {
    console.error('Planificateur de rapports — lecture des formulaires impossible:', error)
    summary.errors.push(error?.message || 'Lecture des formulaires impossible')
    return summary
  }

  for (const form of forms) {
    summary.checked++
    try {
      const settings = parseFormReportSettings(form.reportSettings)

      // Planification activée sans horodatage de référence : on pose le repère sans envoyer,
      // pour ne pas déclencher rétroactivement une échéance antérieure à l'activation.
      if (settings.schedule.enabled && !settings.schedule.lastRunAt) {
        await prisma.form.update({
          where: { id: form.id },
          data: {
            reportSettings: JSON.stringify({
              ...settings,
              schedule: { ...settings.schedule, lastRunAt: now.toISOString() },
            }),
          },
        })
        continue
      }

      if (isScheduleDue(settings.schedule, now)) {
        const status = await sendReportForForm(form, 'schedule', { now })
        if (status.success) summary.sent++
        else {
          summary.failed++
          if (status.error) summary.errors.push(`${form.title} : ${status.error}`)
        }
      }

      if (isClosingDue(settings, now)) {
        const status = await sendReportForForm(form, 'closing', { now })
        if (status.success) summary.sent++
        else {
          summary.failed++
          if (status.error) summary.errors.push(`${form.title} (clôture) : ${status.error}`)
        }
      }
    } catch (error: any) {
      summary.failed++
      summary.errors.push(`${form.title} : ${error?.message || 'erreur inconnue'}`)
      console.error(`Planificateur de rapports — échec sur ${form.id}:`, error)
    }
  }

  return summary
}

let timer: NodeJS.Timeout | null = null
let running = false

async function tick(): Promise<void> {
  // Un passage plus long que l'intervalle ne doit pas se superposer au suivant : les envois
  // seraient dupliqués avant que `lastRunAt` ne soit écrit.
  if (running) return
  running = true
  try {
    const summary = await runDueReports()
    if (summary.sent > 0 || summary.failed > 0) {
      console.log(
        `📊 Rapports — ${summary.sent} envoyé(s), ${summary.failed} en échec sur ${summary.checked} formulaire(s)`
      )
    }
  } catch (error) {
    console.error('Planificateur de rapports — erreur inattendue:', error)
  } finally {
    running = false
  }
}

/**
 * Démarre la minuterie, au plus une fois par processus.
 *
 * Appelée depuis le layout racine plutôt que depuis `instrumentation.ts` : ce dernier est aussi
 * compilé pour le runtime Edge (le middleware en dépend), où `fs`, `path` et nodemailer ne se
 * résolvent pas — la compilation échoue même avec un import dynamique gardé par NEXT_RUNTIME.
 * Le layout, lui, ne s'exécute qu'en Node. Conséquence assumée : le planificateur démarre à la
 * première page servie, pas à l'instant du démarrage du conteneur.
 */
export function startReportScheduler(): void {
  if (timer) return
  if (process.env.REPORT_SCHEDULER === '0') return

  const minutes = Number(process.env.REPORT_SCHEDULER_INTERVAL_MINUTES)
  const intervalMinutes =
    Number.isFinite(minutes) && minutes >= 1 ? Math.min(minutes, 60) : DEFAULT_INTERVAL_MINUTES

  timer = setInterval(tick, intervalMinutes * 60 * 1000)
  // Le processus ne doit pas rester en vie uniquement pour cette minuterie.
  timer.unref?.()

  console.log(`📊 Planificateur de rapports actif (vérification toutes les ${intervalMinutes} min)`)

  // Premier passage différé : au démarrage, la base peut encore être en cours de migration.
  setTimeout(() => {
    void tick()
  }, 30_000).unref?.()
}
