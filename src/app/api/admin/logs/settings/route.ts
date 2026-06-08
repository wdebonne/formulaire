import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { DEFAULT_LOG_SETTINGS, getLogSettings, type LogSettings } from '@/lib/audit-log'

// GET paramètres de rétention du journal d'activité (admin uniquement)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getLogSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Get log settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT mise à jour des paramètres de rétention du journal d'activité (admin uniquement)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()

    const settings: LogSettings = {
      retentionEnabled: body.retentionEnabled !== false,
      retentionDays: clampPositiveInt(body.retentionDays, DEFAULT_LOG_SETTINGS.retentionDays),
    }

    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      create: { id: 'system', logSettings: JSON.stringify(settings) },
      update: { logSettings: JSON.stringify(settings) },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Update log settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function clampPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}
