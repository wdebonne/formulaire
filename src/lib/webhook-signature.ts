// Signature HMAC des webhooks sortants.
//
// Un destinataire qui ne connaît que l'URL de son webhook ne peut pas distinguer une soumission
// réelle d'une requête forgée par quiconque a vu cette URL passer. Renseigner un secret sur le
// webhook fait accompagner chaque envoi d'un condensat HMAC-SHA256 du corps, que le destinataire
// recalcule avec le même secret : c'est la convention de GitHub et de Stripe, et celle qu'exige la
// réception de demandes de l'application Gestion Matériels.
//
// La signature porte sur la chaîne exactement envoyée. Re-sérialiser l'objet avant de signer
// donnerait un condensat que le destinataire ne retrouverait pas : deux JSON équivalents mais
// écrits différemment ne partagent pas leurs octets.

import { createHmac } from 'crypto'

export const WEBHOOK_SIGNATURE_HEADER = 'X-Webhook-Signature'

export function webhookSignature(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

// Pose la signature sur les en-têtes déjà construits. Sans secret configuré, le webhook part comme
// avant : la signature est une option, pas une rupture pour les webhooks existants.
export function applyWebhookSignature(
  headers: Record<string, string>,
  secret: string | null | undefined,
  body: string | undefined
): void {
  const key = secret?.trim()
  // Une requête GET n'a pas de corps : il n'y a rien à signer, et signer la chaîne vide
  // n'authentifierait rien.
  if (!key || body === undefined) return
  headers[WEBHOOK_SIGNATURE_HEADER] = webhookSignature(key, body)
}
