// Cadence des reprises d'un webhook en échec — partie pure, sans Prisma ni réseau.
//
// Même découpage que form-options.ts / form-gate.ts : le calcul des délais est testable et
// importable de partout, l'exécution vit dans webhook-queue.ts.

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'abandoned'

/**
 * Délais avant chaque nouvelle tentative, après l'échec de l'envoi immédiat.
 *
 * Progression volontairement large : un récepteur indisponible l'est rarement pour dix secondes.
 * Une minute couvre le redémarrage d'un service, vingt-quatre heures couvrent une panne traitée le
 * lendemain matin — au-delà, insister n'apporte plus rien qu'une relance manuelle ne ferait mieux.
 *
 * La minuterie de maintenance passe toutes les cinq minutes : un délai plus court que cet
 * intervalle veut dire « au prochain passage », et non « dans une minute ». C'est assumé, la file
 * ne promet pas la seconde près.
 */
export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000, // 1 min
  5 * 60_000, // 5 min
  15 * 60_000, // 15 min
  60 * 60_000, // 1 h
  6 * 60 * 60_000, // 6 h
  24 * 60 * 60_000, // 24 h
] as const

export const MAX_WEBHOOK_ATTEMPTS = WEBHOOK_RETRY_DELAYS_MS.length

/**
 * Part d'aléa ajoutée au délai, en proportion.
 *
 * Cent réponses reçues pendant une panne repartiraient toutes à la même seconde et achèveraient un
 * récepteur qui vient à peine de revenir. Le décalage est seulement positif : jamais plus tôt que
 * le délai annoncé.
 */
export const WEBHOOK_RETRY_JITTER = 0.2

/**
 * Délai avant la tentative `attempt` (1 = première reprise, après l'échec immédiat).
 *
 * `random` est injectable pour que le calcul reste vérifiable : sans cela le test ne pourrait
 * qu'encadrer un intervalle.
 */
export function webhookRetryDelayMs(attempt: number, random: () => number = Math.random): number {
  const index = Math.min(Math.max(Math.trunc(attempt), 1), MAX_WEBHOOK_ATTEMPTS) - 1
  const base = WEBHOOK_RETRY_DELAYS_MS[index]
  return Math.round(base * (1 + WEBHOOK_RETRY_JITTER * Math.min(Math.max(random(), 0), 1)))
}

/** Date de la tentative `attempt`, ou `null` quand il n'y a plus de tentative à programmer. */
export function nextWebhookAttemptAt(
  attempt: number,
  now: Date = new Date(),
  random: () => number = Math.random
): Date | null {
  if (attempt > MAX_WEBHOOK_ATTEMPTS) return null
  return new Date(now.getTime() + webhookRetryDelayMs(attempt, random))
}

/** Toutes les tentatives ont été consommées : seule une relance manuelle reste possible. */
export function isWebhookExhausted(attempts: number): boolean {
  return attempts >= MAX_WEBHOOK_ATTEMPTS
}

/** Phrase affichée sur la réponse, à côté du statut d'envoi. */
export function describeWebhookRetry(
  status: WebhookDeliveryStatus,
  attempts: number,
  nextAttemptAt: Date | string | null | undefined
): string {
  if (status === 'delivered') return 'Livré'
  if (status === 'abandoned') {
    return `Abandonné après ${attempts} tentative${attempts > 1 ? 's' : ''}`
  }

  const date = nextAttemptAt ? new Date(nextAttemptAt) : null
  if (!date || Number.isNaN(date.getTime())) return 'Nouvelle tentative programmée'

  const label = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
  return `Nouvelle tentative le ${label} (${attempts}/${MAX_WEBHOOK_ATTEMPTS})`
}
