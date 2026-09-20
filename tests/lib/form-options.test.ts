import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ACCESS_MESSAGES,
  DEFAULT_ACCESS_SETTINGS,
  accessMessage,
  accessSummary,
  hasAnyRestriction,
  parseFormAccessSettings,
  parseLocalDateTime,
  scheduleState,
  toPublicAccessSettings,
} from '@/lib/form-options'
import type { FormAccessSettings } from '@/types/form'

const settings = (over: Partial<FormAccessSettings> = {}): FormAccessSettings => ({
  ...DEFAULT_ACCESS_SETTINGS,
  ...over,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('parseFormAccessSettings', () => {
  // Convention anti-spam du projet : un formulaire enregistré avant l'arrivée d'un réglage doit
  // en hériter sans être ré-enregistré, donc fusion au-dessus des défauts.
  it('rend les défauts sur une valeur absente', () => {
    expect(parseFormAccessSettings(null)).toEqual(DEFAULT_ACCESS_SETTINGS)
    expect(parseFormAccessSettings(undefined)).toEqual(DEFAULT_ACCESS_SETTINGS)
    expect(parseFormAccessSettings('')).toEqual(DEFAULT_ACCESS_SETTINGS)
  })

  it('rend les défauts sur un JSON illisible plutôt que de lever', () => {
    expect(parseFormAccessSettings('{pas du json')).toEqual(DEFAULT_ACCESS_SETTINGS)
    expect(parseFormAccessSettings('null')).toEqual(DEFAULT_ACCESS_SETTINGS)
    expect(parseFormAccessSettings('"une chaîne"')).toEqual(DEFAULT_ACCESS_SETTINGS)
  })

  it('complète un enregistrement partiel avec les défauts', () => {
    const parsed = parseFormAccessSettings(JSON.stringify({ requireLogin: true }))
    expect(parsed.requireLogin).toBe(true)
    expect(parsed.honeypotEnabled).toBe(true)
    expect(parsed.rateLimitMax).toBe(20)
  })

  // Les mesures anti-spam sont actives par défaut : un formulaire antérieur est protégé sans
  // intervention. Ce test est là pour que personne ne les bascule à false par inadvertance.
  it('laisse les mesures anti-spam actives par défaut', () => {
    expect(DEFAULT_ACCESS_SETTINGS.honeypotEnabled).toBe(true)
    expect(DEFAULT_ACCESS_SETTINGS.minFillTimeEnabled).toBe(true)
    expect(DEFAULT_ACCESS_SETTINGS.rateLimitEnabled).toBe(true)
  })

  it('rend un objet distinct à chaque appel', () => {
    const a = parseFormAccessSettings(null)
    a.requireLogin = true
    expect(parseFormAccessSettings(null).requireLogin).toBe(false)
    expect(DEFAULT_ACCESS_SETTINGS.requireLogin).toBe(false)
  })
})

describe('toPublicAccessSettings', () => {
  // Le condensat ne doit jamais atteindre le navigateur : seule sa présence est exposée.
  it('retire le condensat et n’en garde que l’existence', () => {
    const publicView = toPublicAccessSettings(settings({ passwordEnabled: true, passwordHash: '$2a$10$abc' }))
    expect(publicView).not.toHaveProperty('passwordHash')
    expect(publicView.passwordSet).toBe(true)
  })

  it('annonce l’absence de mot de passe', () => {
    expect(toPublicAccessSettings(settings()).passwordSet).toBe(false)
  })
})

describe('accessMessage', () => {
  it('rend le message par défaut quand aucun n’est personnalisé', () => {
    expect(accessMessage(settings(), 'closed')).toBe(DEFAULT_ACCESS_MESSAGES.closed)
  })

  it('préfère le message personnalisé', () => {
    expect(accessMessage(settings({ closedMessage: 'Inscriptions terminées.' }), 'closed')).toBe(
      'Inscriptions terminées.'
    )
  })

  it('ignore un message qui n’est que des espaces', () => {
    expect(accessMessage(settings({ closedMessage: '   ' }), 'closed')).toBe(DEFAULT_ACCESS_MESSAGES.closed)
  })

  it('couvre tous les états fermés', () => {
    for (const state of Object.keys(DEFAULT_ACCESS_MESSAGES) as (keyof typeof DEFAULT_ACCESS_MESSAGES)[]) {
      expect(accessMessage(settings(), state)).toBeTruthy()
    }
  })
})

describe('parseLocalDateTime', () => {
  it('lit le format produit par datetime-local', () => {
    expect(parseLocalDateTime('2026-09-01T08:30')?.getFullYear()).toBe(2026)
  })

  // Une date invalide est ignorée plutôt que de bloquer le formulaire.
  it('rend null sur une valeur absente ou illisible', () => {
    expect(parseLocalDateTime(null)).toBeNull()
    expect(parseLocalDateTime('')).toBeNull()
    expect(parseLocalDateTime('pas une date')).toBeNull()
  })
})

describe('accessSummary / hasAnyRestriction', () => {
  it('ne liste rien sur un formulaire sans restriction', () => {
    expect(accessSummary(settings())).toEqual([])
    expect(hasAnyRestriction(settings())).toBe(false)
  })

  // Un mot de passe activé mais jamais saisi ne restreint rien : il ne doit pas être annoncé.
  it('n’annonce le mot de passe que s’il en existe un', () => {
    expect(accessSummary(settings({ passwordEnabled: true }))).toEqual([])
    expect(accessSummary(settings({ passwordEnabled: true, passwordHash: '$2a$10$abc' }))).toContain('Mot de passe')
  })

  it('énumère les restrictions actives', () => {
    const summary = accessSummary(
      settings({
        maxResponsesEnabled: true,
        maxResponses: 50,
        onePerDevice: true,
        requireLogin: true,
        noIndex: true,
      })
    )
    expect(summary).toEqual(['50 réponse(s) max.', 'Une réponse par appareil', 'Connexion requise', 'Non indexé'])
    expect(hasAnyRestriction(settings({ requireLogin: true }))).toBe(true)
  })

  it('ignore un quota activé sans nombre', () => {
    expect(accessSummary(settings({ maxResponsesEnabled: true, maxResponses: null }))).toEqual([])
  })
})

describe('scheduleState', () => {
  const at = (iso: string) => vi.setSystemTime(new Date(iso))

  it('est ouvert sans fenêtre ni quota', () => {
    expect(scheduleState(settings(), 0)).toBe('open')
  })

  it('est programmé avant la date d’ouverture', () => {
    vi.useFakeTimers()
    at('2026-08-31T10:00:00')
    expect(scheduleState(settings({ opensAt: '2026-09-01T08:30' }), 0)).toBe('scheduled')
  })

  it('est ouvert une fois la date d’ouverture passée', () => {
    vi.useFakeTimers()
    at('2026-09-01T09:00:00')
    expect(scheduleState(settings({ opensAt: '2026-09-01T08:30' }), 0)).toBe('open')
  })

  it('est clôturé à partir de la date de clôture', () => {
    vi.useFakeTimers()
    at('2026-09-10T00:00:00')
    expect(scheduleState(settings({ closesAt: '2026-09-10T00:00' }), 0)).toBe('closed')
  })

  it('est clôturé quand le quota est atteint', () => {
    expect(scheduleState(settings({ maxResponsesEnabled: true, maxResponses: 50 }), 50)).toBe('closed')
    expect(scheduleState(settings({ maxResponsesEnabled: true, maxResponses: 50 }), 49)).toBe('open')
  })

  it('ignore le quota quand il n’est pas activé', () => {
    expect(scheduleState(settings({ maxResponses: 1 }), 99)).toBe('open')
  })

  // L'état ne décrit que le formulaire, pas le visiteur : mot de passe et connexion n'entrent pas
  // en compte, sinon le tableau de bord afficherait « fermé » sur un formulaire qui accepte tout.
  it('ne tient pas compte des restrictions liées au visiteur', () => {
    expect(scheduleState(settings({ requireLogin: true, passwordEnabled: true, onePerDevice: true }), 0)).toBe('open')
  })
})
