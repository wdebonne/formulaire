import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { DEFAULT_SECURITY_SETTINGS, getSecuritySettings, type SecuritySettings } from '@/lib/security'

// GET security settings (admin only)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const settings = await getSecuritySettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Get security settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT update security settings (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()

    const settings: SecuritySettings = {
      enabled: body.enabled !== false,
      maxFailedAttempts: clampPositiveInt(body.maxFailedAttempts, DEFAULT_SECURITY_SETTINGS.maxFailedAttempts),
      attemptWindowMinutes: clampPositiveInt(body.attemptWindowMinutes, DEFAULT_SECURITY_SETTINGS.attemptWindowMinutes),
      blockDurationMinutes: clampPositiveInt(body.blockDurationMinutes, DEFAULT_SECURITY_SETTINGS.blockDurationMinutes),
    }

    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      create: { id: 'system', securitySettings: JSON.stringify(settings) },
      update: { securitySettings: JSON.stringify(settings) },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Update security settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function clampPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}
