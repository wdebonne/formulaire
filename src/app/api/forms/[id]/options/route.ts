import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { getClientIp } from '@/lib/security'
import { logEvent } from '@/lib/audit-log'
import { hashFormPassword } from '@/lib/form-gate'
import {
  DEFAULT_ACCESS_SETTINGS,
  parseFormAccessSettings,
  parseLocalDateTime,
  toPublicAccessSettings,
} from '@/lib/form-options'
import type { FormAccessSettings } from '@/types/form'

const MESSAGE_MAX = 1000

function sanitizeDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const raw = String(value).slice(0, 25)
  return parseLocalDateTime(raw) ? raw : null
}

function sanitizeMessage(value: unknown): string {
  return String(value ?? '').slice(0, MESSAGE_MAX)
}

// GET /api/forms/[id]/options — options d'accès + contexte utile à la modale
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'read')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const responsesCount = await prisma.response.count({ where: { formId: id } })

    return NextResponse.json({
      settings: toPublicAccessSettings(parseFormAccessSettings(form.accessSettings)),
      responsesCount,
      status: form.status,
      slug: form.slug,
    })
  } catch (error) {
    console.error('Erreur lors de la lecture des options du formulaire:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/forms/[id]/options
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'write')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const body = await request.json()
    const current = parseFormAccessSettings(form.accessSettings)

    const opensAt = sanitizeDateTime(body?.opensAt)
    const closesAt = sanitizeDateTime(body?.closesAt)
    if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) {
      return NextResponse.json(
        { error: 'La date de clôture doit être postérieure à la date de mise en ligne.' },
        { status: 400 }
      )
    }

    const passwordEnabled = Boolean(body?.passwordEnabled)
    // Le condensat existant est conservé tant qu'aucun nouveau mot de passe n'est saisi :
    // la modale n'a aucun moyen de le renvoyer, elle ne le reçoit jamais.
    let passwordHash = current.passwordHash ?? null
    const newPassword = typeof body?.password === 'string' ? body.password : ''
    if (newPassword) {
      if (newPassword.length < 4) {
        return NextResponse.json(
          { error: 'Le mot de passe doit contenir au moins 4 caractères.' },
          { status: 400 }
        )
      }
      passwordHash = await hashFormPassword(newPassword)
    }
    if (!passwordEnabled) passwordHash = null
    if (passwordEnabled && !passwordHash) {
      return NextResponse.json(
        { error: 'Définissez un mot de passe pour activer la protection.' },
        { status: 400 }
      )
    }

    const maxResponsesEnabled = Boolean(body?.maxResponsesEnabled)
    const rawMax = Number(body?.maxResponses)
    const maxResponses =
      maxResponsesEnabled && Number.isFinite(rawMax) && rawMax > 0
        ? Math.min(Math.floor(rawMax), 1_000_000)
        : null
    if (maxResponsesEnabled && !maxResponses) {
      return NextResponse.json(
        { error: 'Indiquez un nombre maximum de réponses supérieur à zéro.' },
        { status: 400 }
      )
    }

    const next: FormAccessSettings = {
      ...DEFAULT_ACCESS_SETTINGS,
      opensAt,
      closesAt,
      notYetOpenMessage: sanitizeMessage(body?.notYetOpenMessage),
      closedMessage: sanitizeMessage(body?.closedMessage),
      passwordEnabled,
      passwordHash,
      passwordMessage: sanitizeMessage(body?.passwordMessage),
      maxResponsesEnabled,
      maxResponses,
      limitReachedMessage: sanitizeMessage(body?.limitReachedMessage),
      onePerDevice: Boolean(body?.onePerDevice),
      alreadySubmittedMessage: sanitizeMessage(body?.alreadySubmittedMessage),
      requireLogin: Boolean(body?.requireLogin),
      loginRequiredMessage: sanitizeMessage(body?.loginRequiredMessage),
      noIndex: Boolean(body?.noIndex),
    }

    await prisma.form.update({
      where: { id },
      data: { accessSettings: JSON.stringify(next) },
    })

    await logEvent({
      action: 'form.options_update',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'form',
      targetId: form.id,
      targetLabel: form.title,
      metadata: {
        opensAt,
        closesAt,
        passwordEnabled,
        maxResponses,
        onePerDevice: next.onePerDevice,
        requireLogin: next.requireLogin,
        noIndex: next.noIndex,
      },
    })

    return NextResponse.json({ settings: toPublicAccessSettings(next) })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des options du formulaire:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
