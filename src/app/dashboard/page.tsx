import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  const [forms, user] = await Promise.all([
    prisma.form.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { responses: true }
        }
      }
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true }
    })
  ])

  const formsData = forms.map(form => ({
    id: form.id,
    title: form.title,
    slug: form.slug,
    status: form.status as 'draft' | 'published',
    responsesCount: form._count.responses,
    updatedAt: form.updatedAt.toISOString(),
  }))

  return <DashboardClient forms={formsData} user={user!} />
}
