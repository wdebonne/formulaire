import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { generateReportForForm } from '@/lib/report-delivery'
import { parseFormReportSettings } from '@/lib/report-settings'

// POST /api/forms/[id]/report/preview — télécharge le PDF du rapport.
//
// Accepte des réglages dans le corps de la requête pour prévisualiser une configuration non
// encore enregistrée : c'est exactement le PDF qui partirait par e-mail avec ces réglages.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'read')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const settings = body?.settings
      ? parseFormReportSettings(JSON.stringify(body.settings))
      : parseFormReportSettings((form as any).reportSettings)

    const generated = await generateReportForForm(
      {
        id: form.id,
        title: form.title,
        slug: form.slug,
        blocks: form.blocks,
        reportSettings: (form as any).reportSettings ?? '{}',
        createdAt: form.createdAt,
      },
      { settings, trigger: 'manual' }
    )

    return new NextResponse(generated.buffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(generated.fileName)}"`,
      },
    })
  } catch (error: any) {
    console.error('Erreur lors de la génération du rapport:', error)
    return NextResponse.json(
      { error: error?.message || 'Impossible de générer le rapport' },
      { status: 500 }
    )
  }
}
