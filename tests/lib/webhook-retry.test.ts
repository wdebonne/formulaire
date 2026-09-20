import { describe, expect, it } from 'vitest'
import {
  MAX_WEBHOOK_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
  WEBHOOK_RETRY_JITTER,
  describeWebhookRetry,
  isWebhookExhausted,
  nextWebhookAttemptAt,
  webhookRetryDelayMs,
} from '@/lib/webhook-retry'

// `random` est injecté pour que les délais soient vérifiables au lieu d'être seulement encadrés.
const noJitter = () => 0
const fullJitter = () => 1

describe('webhookRetryDelayMs', () => {
  it('suit la progression annoncée, sans aléa', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => webhookRetryDelayMs(n, noJitter))).toEqual([
      60_000,
      5 * 60_000,
      15 * 60_000,
      60 * 60_000,
      6 * 60 * 60_000,
      24 * 60 * 60_000,
    ])
  })

  it('croît strictement d’une tentative à la suivante', () => {
    const delays = [1, 2, 3, 4, 5, 6].map((n) => webhookRetryDelayMs(n, noJitter))
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1])
    }
  })

  // Cent réponses reçues pendant une panne repartiraient à la même seconde sans cet écart.
  it('ajoute un aléa borné, jamais négatif', () => {
    for (const attempt of [1, 2, 3, 4, 5, 6]) {
      const base = WEBHOOK_RETRY_DELAYS_MS[attempt - 1]
      expect(webhookRetryDelayMs(attempt, noJitter)).toBe(base)
      expect(webhookRetryDelayMs(attempt, fullJitter)).toBe(Math.round(base * (1 + WEBHOOK_RETRY_JITTER)))
      const drawn = webhookRetryDelayMs(attempt, () => 0.5)
      expect(drawn).toBeGreaterThanOrEqual(base)
      expect(drawn).toBeLessThanOrEqual(Math.round(base * (1 + WEBHOOK_RETRY_JITTER)))
    }
  })

  // Les assertions ci-dessus calculent l'écart attendu *à partir* de la constante : elles restent
  // vraies si on la met à zéro. Celle-ci vérifie que l'écart existe pour de bon.
  it('écarte réellement deux reprises programmées au même instant', () => {
    expect(WEBHOOK_RETRY_JITTER).toBeGreaterThan(0)
    expect(webhookRetryDelayMs(2, () => 1)).toBeGreaterThan(webhookRetryDelayMs(2, () => 0))
  })

  it('n’attend jamais moins que le délai annoncé', () => {
    for (const random of [() => 0, () => 0.3, () => 0.99, () => 1]) {
      expect(webhookRetryDelayMs(3, random)).toBeGreaterThanOrEqual(WEBHOOK_RETRY_DELAYS_MS[2])
    }
  })

  // Un appelant qui se trompe de numéro ne doit pas obtenir un délai indéfini.
  it('borne un numéro de tentative hors plage', () => {
    expect(webhookRetryDelayMs(0, noJitter)).toBe(WEBHOOK_RETRY_DELAYS_MS[0])
    expect(webhookRetryDelayMs(-5, noJitter)).toBe(WEBHOOK_RETRY_DELAYS_MS[0])
    expect(webhookRetryDelayMs(99, noJitter)).toBe(WEBHOOK_RETRY_DELAYS_MS[MAX_WEBHOOK_ATTEMPTS - 1])
    expect(webhookRetryDelayMs(2.7, noJitter)).toBe(WEBHOOK_RETRY_DELAYS_MS[1])
  })

  it('résiste à une source d’aléa qui sort de [0, 1]', () => {
    expect(webhookRetryDelayMs(1, () => -3)).toBe(WEBHOOK_RETRY_DELAYS_MS[0])
    expect(webhookRetryDelayMs(1, () => 42)).toBe(Math.round(WEBHOOK_RETRY_DELAYS_MS[0] * (1 + WEBHOOK_RETRY_JITTER)))
  })
})

describe('nextWebhookAttemptAt', () => {
  const now = new Date('2026-09-20T12:00:00Z')

  it('programme la tentative à partir de l’instant donné', () => {
    expect(nextWebhookAttemptAt(1, now, noJitter)?.toISOString()).toBe('2026-09-20T12:01:00.000Z')
    expect(nextWebhookAttemptAt(4, now, noJitter)?.toISOString()).toBe('2026-09-20T13:00:00.000Z')
  })

  it('est toujours postérieure à l’instant donné', () => {
    for (const attempt of [1, 2, 3, 4, 5, 6]) {
      expect(nextWebhookAttemptAt(attempt, now)!.getTime()).toBeGreaterThan(now.getTime())
    }
  })

  // Passé la dernière tentative, il n'y a plus rien à programmer : seule une relance manuelle
  // reste possible, et la ligne est classée « abandonnée ».
  it('ne programme rien au-delà de la dernière tentative', () => {
    expect(nextWebhookAttemptAt(MAX_WEBHOOK_ATTEMPTS, now)).not.toBeNull()
    expect(nextWebhookAttemptAt(MAX_WEBHOOK_ATTEMPTS + 1, now)).toBeNull()
  })
})

describe('isWebhookExhausted', () => {
  it('ne s’épuise qu’une fois toutes les tentatives consommées', () => {
    expect(isWebhookExhausted(0)).toBe(false)
    expect(isWebhookExhausted(MAX_WEBHOOK_ATTEMPTS - 1)).toBe(false)
    expect(isWebhookExhausted(MAX_WEBHOOK_ATTEMPTS)).toBe(true)
    expect(isWebhookExhausted(MAX_WEBHOOK_ATTEMPTS + 3)).toBe(true)
  })

  // La durée totale doit couvrir une panne traitée le lendemain matin.
  it('couvre plus de vingt-quatre heures au total', () => {
    const total = WEBHOOK_RETRY_DELAYS_MS.reduce((acc, d) => acc + d, 0)
    expect(total).toBeGreaterThan(24 * 60 * 60_000)
  })
})

describe('describeWebhookRetry', () => {
  it('annonce une livraison', () => {
    expect(describeWebhookRetry('delivered', 3, null)).toBe('Livré')
  })

  it('annonce un abandon avec le nombre de tentatives, accordé', () => {
    expect(describeWebhookRetry('abandoned', 1, null)).toBe('Abandonné après 1 tentative')
    expect(describeWebhookRetry('abandoned', 6, null)).toBe('Abandonné après 6 tentatives')
  })

  it('annonce la prochaine tentative et la progression', () => {
    const text = describeWebhookRetry('pending', 2, new Date('2026-09-20T14:30:00'))
    expect(text).toContain('Nouvelle tentative le')
    expect(text).toContain(`(2/${MAX_WEBHOOK_ATTEMPTS})`)
  })

  // Une date illisible ne doit pas produire « Nouvelle tentative le Invalid Date ».
  it('reste lisible sans date exploitable', () => {
    expect(describeWebhookRetry('pending', 1, null)).toBe('Nouvelle tentative programmée')
    expect(describeWebhookRetry('pending', 1, 'pas une date')).toBe('Nouvelle tentative programmée')
  })
})
