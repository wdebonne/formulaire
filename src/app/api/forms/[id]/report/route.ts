import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { prisma } from '@/lib/prisma'
import {
  nextOccurrence,
  parseFormReportSettings,
  sanitizeReportRecipients,
} from '@/lib/report-settings'
import type { FormReportSettings, ReportSchedule } from '@/types/form'

async function isSmtpConfigured(): Promise<boolean> {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })
    return Boolean(settings?.smtpHost || process.env.SMTP_HOST)
  } catch {
    return Boolean(process.env.SMTP_HOST)
  }
}

function withNextRun(settings: FormReportSettings) {
  return {
    ...settings,
    nextRunAt: settings.schedule.enabled
      ? nextOccurrence(settings.schedule, new Date()).toISOString()
      : null,
  }
}

// GET /api/forms/[id]/report — réglages du rapport
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'read')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const settings = parseFormReportSettings((form as any).reportSettings)
    return NextResponse.json({
      ...withNextRun(settings),
      smtpConfigured: await isSmtpConfigured(),
    })
  } catch (error) {
    console.error('Erreur lors de la lecture des réglages de rapport:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Un changement d'horaire doit repartir de la prochaine échéance, jamais rattraper une échéance
// déjà passée au moment où l'utilisateur enregistre.
function scheduleTimingChanged(before: ReportSchedule, after: ReportSchedule): boolean {
  return (
    before.frequency !== after.frequency ||
    before.dayOfWeek !== after.dayOfWeek ||
    before.dayOfMonth !== after.dayOfMonth ||
    before.hour !== after.hour ||
    before.minute !== after.minute
  )
}

// PUT /api/forms/[id]/report — enregistre les réglages saisis dans la modale
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'write')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const body = await request.json()
    const current = parseFormReportSettings((form as any).reportSettings)

    // Le corps client n'est jamais fusionné tel quel : il repasse par le lecteur tolérant, qui
    // borne les entiers et filtre les adresses. Les champs d'historique (dernier envoi,
    // horodatage de planification, rapport de clôture) restent sous contrôle serveur.
    const requested = parseFormReportSettings(
      JSON.stringify({
        ...current,
        ...body,
        recipients: sanitizeReportRecipients(body?.recipients ?? current.recipients),
        schedule: { ...current.schedule, ...(body?.schedule ?? {}) },
        lastStatus: current.lastStatus,
      })
    )

    const now = new Date()
    const wasEnabled = current.schedule.enabled
    const timingChanged = scheduleTimingChanged(current.schedule, requested.schedule)
    const closingChanged = current.closingDate !== requested.closingDate

    const schedule: ReportSchedule = { ...requested.schedule }
    delete schedule.lastRunAt
    if (schedule.enabled) {
      schedule.lastRunAt =
        !wasEnabled || timingChanged || !current.schedule.lastRunAt
          ? now.toISOString()
          : current.schedule.lastRunAt
    }

    const next: FormReportSettings = { ...requested, schedule }
    delete next.finalReportSentAt
    delete next.lastStatus

    // Changer la date de clôture rouvre le droit à un rapport final : c'est une nouvelle échéance.
    if (current.finalReportSentAt && !closingChanged) next.finalReportSentAt = current.finalReportSentAt
    if (current.lastStatus) next.lastStatus = current.lastStatus

    await prisma.form.update({
      where: { id },
      data: { reportSettings: JSON.stringify(next) },
    })

    return NextResponse.json({
      ...withNextRun(next),
      smtpConfigured: await isSmtpConfigured(),
    })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des réglages de rapport:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
