// Minuterie interne unique — rapports périodiques et purges de conservation.
//
// L'application est distribuée comme un conteneur unique (`node server.js`) : plutôt que
// d'exiger la configuration d'un cron externe, une minuterie en processus vérifie
// régulièrement les échéances. Les deux travaux sont exposés sur /api/internal/reports/run et
// /api/internal/retention/run pour qui préfère les piloter depuis un cron système.
//
// Les rapports et les purges partagent délibérément la même minuterie : une conservation qui
// n'a pas d'échéance propre n'est pas une conservation, et il n'y avait aucune raison de faire
// vivre un second ordonnanceur à côté de celui qui tournait déjà.

import { runDueReports } from './report-scheduler'
import { runDueRetentionPurges } from './retention-purge'
import { runDueWebhookRetries } from './webhook-queue'

const DEFAULT_INTERVAL_MINUTES = 5

export interface MaintenanceSummary {
  reportsSent: number
  reportsFailed: number
  responsesDeleted: number
  logsDeleted: number
  webhooksDelivered: number
  webhooksAbandoned: number
  errors: string[]
}

/** Exécute un passage complet : échéances de rapport, puis purges dues. Ne lève jamais. */
export async function runMaintenancePass(now: Date = new Date()): Promise<MaintenanceSummary> {
  const summary: MaintenanceSummary = {
    reportsSent: 0,
    reportsFailed: 0,
    responsesDeleted: 0,
    logsDeleted: 0,
    webhooksDelivered: 0,
    webhooksAbandoned: 0,
    errors: [],
  }

  try {
    const reports = await runDueReports(now)
    summary.reportsSent = reports.sent
    summary.reportsFailed = reports.failed
    summary.errors.push(...reports.errors)
  } catch (error: any) {
    summary.errors.push(`Rapports : ${error?.message || 'erreur inconnue'}`)
    console.error('Passage de maintenance — rapports:', error)
  }

  // Les purges tournent même si les rapports ont échoué : ce sont deux obligations distinctes.
  try {
    const purges = await runDueRetentionPurges(now)
    summary.responsesDeleted = purges.responsesDeleted
    summary.logsDeleted = purges.logsDeleted
    summary.errors.push(...purges.errors)
  } catch (error: any) {
    summary.errors.push(`Purges : ${error?.message || 'erreur inconnue'}`)
    console.error('Passage de maintenance — purges:', error)
  }

  // Reprises de webhook : troisième obligation indépendante des deux précédentes. Un rapport qui
  // échoue ne doit pas retenir une livraison qui, elle, repasserait.
  try {
    const webhooks = await runDueWebhookRetries(now)
    summary.webhooksDelivered = webhooks.delivered
    summary.webhooksAbandoned = webhooks.abandoned
  } catch (error: any) {
    summary.errors.push(`Webhooks : ${error?.message || 'erreur inconnue'}`)
    console.error('Passage de maintenance — webhooks:', error)
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
    const summary = await runMaintenancePass()
    if (summary.reportsSent > 0 || summary.reportsFailed > 0) {
      console.log(`📊 Rapports — ${summary.reportsSent} envoyé(s), ${summary.reportsFailed} en échec`)
    }
    if (summary.responsesDeleted > 0 || summary.logsDeleted > 0) {
      console.log(
        `🧹 Purge automatique — ${summary.responsesDeleted} réponse(s), ${summary.logsDeleted} entrée(s) de journal`
      )
    }
  } catch (error) {
    console.error('Minuterie de maintenance — erreur inattendue:', error)
  } finally {
    running = false
  }
}

function envValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined && value !== '') return value
  }
  return undefined
}

/**
 * Démarre la minuterie, au plus une fois par processus.
 *
 * Appelée depuis le layout racine plutôt que depuis `instrumentation.ts` : ce dernier est aussi
 * compilé pour le runtime Edge (le middleware en dépend), où `fs`, `path` et nodemailer ne se
 * résolvent pas — la compilation échoue même avec un import dynamique gardé par NEXT_RUNTIME.
 * Le layout, lui, ne s'exécute qu'en Node. Conséquence assumée : la minuterie démarre à la
 * première page servie, pas à l'instant du démarrage du conteneur.
 *
 * `REPORT_SCHEDULER` / `REPORT_SCHEDULER_INTERVAL_MINUTES` restent lus : ce sont les noms
 * historiques, déjà présents dans les déploiements existants.
 */
export function startMaintenanceScheduler(): void {
  if (timer) return
  if (envValue('SCHEDULER', 'REPORT_SCHEDULER') === '0') return

  const minutes = Number(envValue('SCHEDULER_INTERVAL_MINUTES', 'REPORT_SCHEDULER_INTERVAL_MINUTES'))
  const intervalMinutes =
    Number.isFinite(minutes) && minutes >= 1 ? Math.min(minutes, 60) : DEFAULT_INTERVAL_MINUTES

  timer = setInterval(tick, intervalMinutes * 60 * 1000)
  // Le processus ne doit pas rester en vie uniquement pour cette minuterie.
  timer.unref?.()

  console.log(
    `📊 Minuterie de maintenance active — rapports et purges vérifiés toutes les ${intervalMinutes} min`
  )

  // Premier passage différé : au démarrage, la base peut encore être en cours de migration.
  setTimeout(() => {
    void tick()
  }, 30_000).unref?.()
}
