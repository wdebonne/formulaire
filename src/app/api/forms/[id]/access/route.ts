import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/security'
import {
  ACCESS_COOKIE_MAX_AGE,
  accessCookieName,
  signAccessToken,
  verifyFormPassword,
} from '@/lib/form-gate'
import { parseFormAccessSettings } from '@/lib/form-options'

// Limitation en mémoire des essais de mot de passe, par IP et par formulaire. Volontairement
// distincte du dispositif anti-bruteforce des comptes (src/lib/security.ts) : un répondant qui se
// trompe de mot de passe ne doit pas se retrouver bloqué sur l'ensemble de l'application.
const MAX_ATTEMPTS = 10
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const attempts = new Map<string, { count: number; firstAt: number }>()

function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key)
  if (!entry) return false
  if (Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.delete(key)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

function recordAttempt(key: string) {
  const entry = attempts.get(key)
  if (!entry || Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() })
    return
  }
  entry.count += 1
}

// POST /api/forms/[id]/access — vérifie le mot de passe d'accès d'un formulaire public
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const password = typeof body?.password === 'string' ? body.password : ''

    const key = `${getClientIp(request)}:${id}`
    if (tooManyAttempts(key)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        { status: 429 }
      )
    }

    const form = await prisma.form.findFirst({
      where: { id, status: 'published', deletedAt: null },
      select: { id: true, accessSettings: true },
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const settings = parseFormAccessSettings(form.accessSettings)
    if (!settings.passwordEnabled || !settings.passwordHash) {
      // Plus de mot de passe : inutile d'en exiger un, le visiteur peut continuer.
      return NextResponse.json({ success: true })
    }

    if (!password || !(await verifyFormPassword(password, settings.passwordHash))) {
      recordAttempt(key)
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
    }

    attempts.delete(key)

    const response = NextResponse.json({ success: true })
    response.cookies.set(accessCookieName(form.id), signAccessToken(form.id, settings.passwordHash), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ACCESS_COOKIE_MAX_AGE,
      path: '/',
    })
    return response
  } catch (error) {
    console.error('Erreur lors de la vérification du mot de passe du formulaire:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
