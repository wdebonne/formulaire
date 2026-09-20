// File de reprise des webhooks — partie serveur (Prisma, réseau).
//
// Jusqu'ici, un webhook qui échouait laissait une trace dans `Response.webhookStatus` et rien de
// plus : la réponse était bien enregistrée, mais l'application destinataire ne la voyait jamais,
// et personne n'était prévenu. Une perte silencieuse, qui ne se découvrait qu'en rapprochant les
// deux bases à la main.
//
// Le premier envoi reste **synchrone** dans la route de soumission : la grande majorité aboutit
// du premier coup, et la page des réponses doit afficher le résultat tout de suite. Seul un
// échec entre dans cette file.

import prisma from '@/lib/prisma'
import { logEvent } from '@/lib/audit-log'
import { sendWebhook, type WebhookConfig, type WebhookFormInput } from '@/lib/webhook-send'
import {
  MAX_WEBHOOK_ATTEMPTS,
  isWebhookExhausted,
  nextWebhookAttemptAt,
} from '@/lib/webhook-retry'

// Plafond par passage : une panne de plusieurs heures peut laisser des milliers de reprises dues
// en même temps, et les traiter toutes d'un coup rendrait la minuterie inutilisable pour les
// rapports et les purges qui partagent le même tic.
const MAX_DELIVERIES_PER_PASS = 50

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 500)
}

/**
 * Inscrit une tentative de reprise après l'échec de l'envoi immédiat.
 *
 * Ne lève jamais : la réponse du répondant est déjà enregistrée, et l'échec d'une écriture dans
 * la file ne doit pas faire échouer sa soumission — même contrat que `logEvent()`.
 */
export async function enqueueWebhookRetry(
  responseId: string,
  webhook: WebhookConfig,
  error: unknown
): Promise<void> {
  try {
    const at = nextWebhookAttemptAt(1)
    if (!at) return

    await prisma.webhookDelivery.create({
      data: {
        responseId,
        webhookId: webhook.id,
        webhookName: webhook.name || webhook.url || webhook.id,
        url: webhook.url || '',
        status: 'pending',
        attempts: 1,
        nextAttemptAt: at,
        lastError: errorMessage(error),
      },
    })
  } catch (queueError) {
    console.error('Impossible d’inscrire la reprise du webhook :', queueError)
  }
}

/**
 * Retire les reprises en attente d'une réponse.
 *
 * Appelée après une relance manuelle réussie : insister en arrière-plan sur un envoi que
 * l'administrateur vient de réussir enverrait la réponse deux fois.
 */
export async function cancelWebhookRetries(
  responseId: string,
  webhookId?: string
): Promise<number> {
  try {
    const result = await prisma.webhookDelivery.updateMany({
      where: { responseId, status: 'pending', ...(webhookId ? { webhookId } : {}) },
      data: { status: 'delivered', nextAttemptAt: new Date() },
    })
    return result.count
  } catch (error) {
    console.error('Impossible d’annuler les reprises du webhook :', error)
    return 0
  }
}

/** Ce que la page des réponses affiche à côté du statut d'envoi. */
export async function getWebhookRetries(responseId: string) {
  try {
    return await prisma.webhookDelivery.findMany({
      where: { responseId },
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    console.error('Impossible de lire les reprises du webhook :', error)
    return []
  }
}

// Recopie le résultat dans `Response.webhookStatus`, d'où la page des réponses le lit déjà.
async function recordAttempt(
  responseId: string,
  webhookId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const response = await prisma.response.findUnique({
    where: { id: responseId },
    select: { webhookStatus: true },
  })
  if (!response) return

  let status: Record<string, any> = {}
  try {
    status = JSON.parse(response.webhookStatus || '{}')
  } catch {
    status = {}
  }

  status[webhookId] = {
    success,
    lastSent: new Date().toISOString(),
    ...(error ? { error } : {}),
    retried: true,
  }

  await prisma.response.update({
    where: { id: responseId },
    data: { webhookStatus: JSON.stringify(status) },
  })
}

/**
 * Traite les reprises échues.
 *
 * Ne lève jamais : elle partage son tic avec les rapports périodiques et les purges de
 * conservation, et une file en panne ne doit pas empêcher les deux autres de tourner.
 */
export async function runDueWebhookRetries(now: Date = new Date()): Promise<{
  attempted: number
  delivered: number
  abandoned: number
}> {
  const result = { attempted: 0, delivered: 0, abandoned: 0 }

  let due: Awaited<ReturnType<typeof prisma.webhookDelivery.findMany>>
  try {
    due = await prisma.webhookDelivery.findMany({
      where: { status: 'pending', nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: MAX_DELIVERIES_PER_PASS,
    })
  } catch (error) {
    console.error('Lecture de la file de reprise impossible :', error)
    return result
  }

  for (const delivery of due) {
    try {
      const response = await prisma.response.findUnique({
        where: { id: delivery.responseId },
        include: { form: { select: { id: true, title: true, blocks: true, webhooks: true } } },
      })

      // La réponse a disparu entre-temps : le `onDelete: Cascade` a normalement déjà emporté la
      // ligne, mais une course reste possible.
      if (!response) {
        await prisma.webhookDelivery.delete({ where: { id: delivery.id } }).catch(() => {})
        continue
      }

      const webhooks = JSON.parse(response.form.webhooks || '[]') as WebhookConfig[]
      const webhook = webhooks.find((w) => w.id === delivery.webhookId)

      // Webhook supprimé ou désactivé depuis l'échec : insister irait contre une décision prise
      // après coup. La ligne est classée, pas réessayée.
      if (!webhook || webhook.enabled === false) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'abandoned',
            lastError: webhook ? 'Webhook désactivé depuis l’échec' : 'Webhook supprimé depuis l’échec',
          },
        })
        result.abandoned++
        continue
      }

      result.attempted++

      const form: WebhookFormInput = {
        id: response.form.id,
        title: response.form.title,
        blocks: response.form.blocks,
      }

      try {
        // Le corps est reconstruit ici, jamais rejoué depuis un stockage : une configuration
        // corrigée entre-temps est celle qui part.
        await sendWebhook(webhook, JSON.parse(response.data || '{}'), form, response.id)

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: 'delivered', lastError: null },
        })
        await recordAttempt(response.id, webhook.id, true)
        result.delivered++

        await logEvent({
          action: 'webhook.retry_succeeded',
          status: 'success',
          targetType: 'form',
          targetId: response.form.id,
          targetLabel: response.form.title,
          metadata: { webhook: delivery.webhookName, attempts: delivery.attempts },
        })
      } catch (sendError) {
        const attempts = delivery.attempts + 1
        const at = isWebhookExhausted(attempts) ? null : nextWebhookAttemptAt(attempts, now)

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts,
            lastError: errorMessage(sendError),
            ...(at ? { nextAttemptAt: at } : { status: 'abandoned' }),
          },
        })
        await recordAttempt(response.id, webhook.id, false, errorMessage(sendError))

        if (!at) {
          result.abandoned++
          // Un abandon est la seule issue qu'un administrateur doive pouvoir retrouver : c'est le
          // moment où la perte devient définitive sans relance manuelle.
          await logEvent({
            action: 'webhook.retry_abandoned',
            status: 'failure',
            targetType: 'form',
            targetId: response.form.id,
            targetLabel: response.form.title,
            metadata: {
              webhook: delivery.webhookName,
              attempts,
              maxAttempts: MAX_WEBHOOK_ATTEMPTS,
              error: errorMessage(sendError),
            },
          })
        }
      }
    } catch (error) {
      console.error(`Reprise du webhook ${delivery.id} impossible :`, error)
    }
  }

  return result
}
