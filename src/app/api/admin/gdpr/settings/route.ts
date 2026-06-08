import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { DEFAULT_GDPR_SETTINGS, getGdprSettings } from '@/lib/gdpr'
import type { GdprSettings } from '@/types/form'

// GET paramètres RGPD (admin uniquement)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getGdprSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Get GDPR settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT mise à jour des paramètres RGPD (admin uniquement)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()

    const settings: Required<GdprSettings> = {
      retentionEnabled: body.retentionEnabled !== false,
      retentionMonths: clampPositiveInt(body.retentionMonths, DEFAULT_GDPR_SETTINGS.retentionMonths),
    }

    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      create: { id: 'system', gdprSettings: JSON.stringify(settings) },
      update: { gdprSettings: JSON.stringify(settings) },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Update GDPR settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function clampPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}
