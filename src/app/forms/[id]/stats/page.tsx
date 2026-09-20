import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import prisma from '@/lib/prisma'
import { parseFormReportSettings } from '@/lib/report-settings'
import { StatsClient } from './stats-client'

// Statistiques à l'écran : exactement les chiffres du rapport PDF, sans passer par le PDF.
// computeReportStats() étant pur, la page le fait tourner côté client sur les réponses déjà
// chargées — aucune agrégation n'est réécrite ici, et l'écran ne peut donc pas diverger du
// document envoyé par e-mail.
export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const form = await getAccessibleForm(id, session, 'read')
  if (!form) redirect('/dashboard')

  const responses = await prisma.response.findMany({
    where: { formId: id },
    select: { id: true, data: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // La date de clôture du rapport plafonne aussi les périodes affichées ici : passée cette
  // date, l'écran et le PDF décrivent le même corpus figé.
  const { closingDate } = parseFormReportSettings((form as any).reportSettings)

  return (
    <StatsClient
      form={{
        id: form.id,
        title: form.title,
        blocks: JSON.parse(form.blocks),
        createdAt: form.createdAt,
      }}
      responses={responses.map((response) => ({
        id: response.id,
        data: safeParse(response.data),
        createdAt: response.createdAt,
      }))}
      closingDate={closingDate}
    />
  )
}

function safeParse(raw: string | null): Record<string, any> {
  try {
    if (!raw || !raw.trim()) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.error('Réponse illisible dans les statistiques:', error)
    return {}
  }
}
