// Anti-spam de la soumission publique — côté serveur uniquement.
//
// L'adresse d'un formulaire publié est publique par nature : rien n'empêche un script d'appeler
// POST /api/forms/[id]/submit en boucle. Chaque réponse acceptée déclenche un e-mail par circuit
// d'envoi, un appel par webhook actif, consomme le quota et laisse une donnée personnelle à
// purger — le coût d'une soumission automatisée est donc bien supérieur à celui de la requête.
//
// Trois mesures cumulées, sans dépendance externe ni captcha : un champ leurre, un délai minimum
// de remplissage attesté par un jeton signé, et un seau par IP et par formulaire. Le découpage
// suit celui de form-options.ts / form-gate.ts : la partie pure (valeurs par défaut, nom du champ
// leurre, bornes) vit dans form-options.ts, importable depuis la modale 'use client'.

import { createHmac, timingSafeEqual } from 'crypto'
import { HONEYPOT_FIELD } from './form-options'
import type { FormAccessSettings } from '@/types/form'

export { HONEYPOT_FIELD }

export type AntiSpamOutcome =
  // Réponse à jeter sans le dire : le leurre a été rempli, donc l'appelant n'est pas un humain.
  // Lui renvoyer une erreur lui apprendrait quel champ éviter au prochain essai.
  | { verdict: 'discard'; reason: 'honeypot' }
  | { verdict: 'reject'; reason: 'too_fast' | 'no_token' | 'rate_limited'; status: number; message: string }
  | { verdict: 'accept' }

export interface AntiSpamInput {
  formId: string
  ip: string
  honeypot: unknown
  renderToken: unknown
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters. Generate one with: openssl rand -base64 32'
    )
  }
  return secret
}

// Jeton de rendu : l'instant où la page publique a été servie, signé pour que le navigateur ne
// puisse pas l'antidater. Sans signature, un script se contenterait d'annoncer une date vieille
// de dix minutes ; avec elle, il doit réellement charger la page puis attendre.
//
// Volontairement sans péremption : un onglet laissé ouvert toute la nuit doit pouvoir être envoyé
// le lendemain matin sans perdre les réponses saisies. Le volume, lui, est tenu par le seau.
export function signRenderToken(formId: string, issuedAt: number = Date.now()): string {
  const payload = String(issuedAt)
  const mac = createHmac('sha256', getSecret()).update(`${formId}:${payload}`).digest('hex')
  return `${payload}.${mac}`
}

export function readRenderToken(token: unknown, formId: string): number | null {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payload, mac] = token.split('.', 2)
  const issuedAt = Number(payload)
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null

  const expected = createHmac('sha256', getSecret()).update(`${formId}:${payload}`).digest('hex')
  const given = Buffer.from(mac ?? '')
  const want = Buffer.from(expected)
  if (given.length !== want.length) return null
  return timingSafeEqual(given, want) ? issuedAt : null
}

// Seau en mémoire, par IP et par formulaire — même dispositif que la vérification du mot de passe
// d'accès (src/app/api/forms/[id]/access/route.ts), et pour la même raison : pas de dépendance
// externe, et un répondant trop insistant ne doit surtout pas être traité par l'anti-bruteforce
// des comptes, qui blackliste l'IP sur toute l'application.
//
// Limite connue : la mémoire est celle du processus. Derrière plusieurs instances, chacune tient
// son propre compte et le plafond effectif est multiplié par leur nombre ; le dispositif reste
// dissuasif, il n'est pas une garantie stricte.
const buckets = new Map<string, { count: number; firstAt: number }>()
const MAX_BUCKETS = 10_000

function sweep(now: number) {
  // Une heure couvre la plus longue fenêtre utile en pratique ; au-delà, le repli sur les
  // entrées les plus anciennes prend le relais.
  const stale: string[] = []
  buckets.forEach((entry, key) => {
    if (now - entry.firstAt > 60 * 60 * 1000) stale.push(key)
  })
  stale.forEach((key) => buckets.delete(key))

  const excess = buckets.size - MAX_BUCKETS
  if (excess <= 0) return

  // Dernier recours : la table ne doit pas croître sans fin sous un flot d'IP différentes.
  const byAge: Array<[string, number]> = []
  buckets.forEach((entry, key) => byAge.push([key, entry.firstAt]))
  byAge.sort((a, b) => a[1] - b[1])
  byAge.slice(0, excess).forEach(([key]) => buckets.delete(key))
}

/**
 * Compte une tentative et indique si le seau déborde. Toute tentative est comptée, y compris
 * celle que le leurre ou le délai minimum feront rejeter juste après : c'est précisément le flot
 * automatisé qu'il s'agit de freiner.
 */
export function consumeSubmissionSlot(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  if (buckets.size > MAX_BUCKETS) sweep(now)

  const entry = buckets.get(key)
  if (!entry || now - entry.firstAt > windowMs) {
    buckets.set(key, { count: 1, firstAt: now })
    return true
  }
  entry.count += 1
  return entry.count <= max
}

export function submissionBucketKey(ip: string, formId: string): string {
  return `${ip}:${formId}`
}

/**
 * Applique les trois mesures dans l'ordre du moins coûteux au plus informatif : le seau d'abord,
 * pour qu'un flot soit arrêté avant les requêtes de la porte d'accès, puis le leurre, puis le
 * délai de remplissage.
 */
export function evaluateSubmissionAntiSpam(
  settings: FormAccessSettings,
  input: AntiSpamInput
): AntiSpamOutcome {
  if (settings.rateLimitEnabled) {
    const max = Math.max(1, settings.rateLimitMax ?? 20)
    const windowMs = Math.max(1, settings.rateLimitWindowMinutes ?? 10) * 60 * 1000
    if (!consumeSubmissionSlot(submissionBucketKey(input.ip, input.formId), max, windowMs)) {
      return {
        verdict: 'reject',
        reason: 'rate_limited',
        status: 429,
        message:
          'Trop de réponses ont été envoyées depuis cette connexion. Réessayez dans quelques minutes.',
      }
    }
  }

  if (settings.honeypotEnabled) {
    const value = input.honeypot
    const filled = typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
    if (filled) return { verdict: 'discard', reason: 'honeypot' }
  }

  if (settings.minFillTimeEnabled) {
    const issuedAt = readRenderToken(input.renderToken, input.formId)
    if (issuedAt === null) {
      // Aucun jeton valable : la page publique n'a pas été chargée, ou l'a été pour un autre
      // formulaire. C'est le cas d'un script qui appelle directement la route de soumission.
      return {
        verdict: 'reject',
        reason: 'no_token',
        status: 400,
        message:
          'Cette page n’est plus valide. Rechargez le formulaire avant d’envoyer votre réponse.',
      }
    }
    const minMs = Math.max(0, settings.minFillSeconds ?? 3) * 1000
    if (Date.now() - issuedAt < minMs) {
      return {
        verdict: 'reject',
        reason: 'too_fast',
        status: 400,
        message: 'Votre réponse est partie trop vite. Patientez quelques secondes et réessayez.',
      }
    }
  }

  return { verdict: 'accept' }
}
