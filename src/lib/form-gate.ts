// Application des options d'accès d'un formulaire — côté serveur uniquement.
//
// Toutes les restrictions sont évaluées ici, à la fois au rendu de /[slug] et dans la route de
// soumission : un répondant qui contournerait l'écran de garde côté navigateur se ferait refuser
// sa réponse. La partie pure (types, valeurs par défaut, messages) vit dans form-options.ts, que
// la modale d'options importe depuis un composant client.

import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { getSession } from './auth'
import { accessMessage, parseFormAccessSettings, parseLocalDateTime } from './form-options'
import type { FormAccessSettings, FormGateState } from '@/types/form'

export interface FormGateResult {
  state: FormGateState
  message: string
  // Renseigné pour 'not_open' : permet d'annoncer la date d'ouverture au visiteur.
  opensAt?: string | null
  settings: FormAccessSettings
}

export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 12 // 12 h
export const SUBMITTED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function accessCookieName(formId: string): string {
  return `fb_access_${formId}`
}

export function submittedCookieName(formId: string): string {
  return `fb_done_${formId}`
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

// Le jeton dérive du condensat du mot de passe : changer le mot de passe invalide donc
// immédiatement tous les accès déjà accordés, sans avoir à tenir une liste de sessions.
export function signAccessToken(formId: string, passwordHash: string): string {
  return createHmac('sha256', getSecret()).update(`${formId}:${passwordHash}`).digest('hex')
}

export function verifyAccessToken(
  token: string | undefined,
  formId: string,
  passwordHash: string
): boolean {
  if (!token) return false
  const expected = signAccessToken(formId, passwordHash)
  const given = Buffer.from(token)
  const want = Buffer.from(expected)
  if (given.length !== want.length) return false
  return timingSafeEqual(given, want)
}

export async function verifyFormPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

export async function hashFormPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

interface GateInput {
  id: string
  accessSettings: string | null
}

/**
 * Détermine si le formulaire est ouvert au visiteur courant.
 *
 * L'ordre des contrôles est délibéré : une fenêtre de publication fermée prime sur tout le reste
 * (inutile de faire saisir un mot de passe pour un formulaire clôturé), et le mot de passe vient
 * en dernier, une fois qu'on sait que le formulaire est réellement accessible.
 */
export async function resolveFormGate(form: GateInput): Promise<FormGateResult> {
  const settings = parseFormAccessSettings(form.accessSettings)
  const ok = (state: FormGateState): FormGateResult => ({
    state,
    message: state === 'open' ? '' : accessMessage(settings, state),
    settings,
  })

  if (settings.requireLogin) {
    const session = await getSession()
    if (!session) return ok('login_required')
  }

  const now = Date.now()

  const opensAt = parseLocalDateTime(settings.opensAt)
  if (opensAt && now < opensAt.getTime()) {
    return { ...ok('not_open'), opensAt: settings.opensAt }
  }

  const closesAt = parseLocalDateTime(settings.closesAt)
  if (closesAt && now >= closesAt.getTime()) {
    return ok('closed')
  }

  const cookieStore = await cookies()

  if (settings.onePerDevice && cookieStore.get(submittedCookieName(form.id))?.value === '1') {
    return ok('already_submitted')
  }

  if (settings.maxResponsesEnabled && settings.maxResponses && settings.maxResponses > 0) {
    const count = await prisma.response.count({ where: { formId: form.id } })
    if (count >= settings.maxResponses) return ok('limit_reached')
  }

  if (settings.passwordEnabled && settings.passwordHash) {
    const token = cookieStore.get(accessCookieName(form.id))?.value
    if (!verifyAccessToken(token, form.id, settings.passwordHash)) {
      return ok('password_required')
    }
  }

  return ok('open')
}
