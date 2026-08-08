import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { logEvent } from '@/lib/audit-log'
import { getClientIp } from '@/lib/security'
import { sendReportForForm } from '@/lib/report-delivery'
import { sanitizeReportRecipients } from '@/lib/report-settings'

// POST /api/forms/[id]/report/send — envoi immédiat du rapport aux destinataires enregistrés.
//
// `recipients` permet d'adresser un envoi de contrôle à soi-même sans toucher à la liste
// configurée. L'envoi utilise les réglages enregistrés : il faut donc avoir cliqué sur
// « Enregistrer » pour tester une nouvelle période.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'write')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const override = sanitizeReportRecipients(body?.recipients)

    const status = await sendReportForForm(
      {
        id: form.id,
        title: form.title,
        slug: form.slug,
        blocks: form.blocks,
        reportSettings: (form as any).reportSettings ?? '{}',
        createdAt: form.createdAt,
      },
      'manual',
      { ...(override.length > 0 && { recipients: override }) }
    )

    await logEvent({
      action: 'form.report_send',
      status: status.success ? 'success' : 'failure',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'form',
      targetId: form.id,
      targetLabel: form.title,
      metadata: {
        recipients: status.recipients ?? [],
        responseCount: status.responseCount ?? 0,
        period: status.periodLabel ?? '',
        ...(status.error && { error: status.error }),
      },
    })

    return NextResponse.json({ status })
  } catch (error) {
    console.error('Erreur lors de l’envoi du rapport:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
