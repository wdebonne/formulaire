import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true }
  })

  if (!user) {
    redirect('/login')
  }

  let forms
  
  if (user.role === 'admin') {
    // Les admins voient tous les formulaires
    forms = await prisma.form.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { responses: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    })
  } else {
    // Les utilisateurs voient leurs formulaires + ceux partagés
    const [ownForms, sharedForms] = await Promise.all([
      prisma.form.findMany({
        where: { userId: session.userId },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { responses: true } },
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.formShare.findMany({
        where: { userId: session.userId },
        include: {
          form: {
            include: {
              _count: { select: { responses: true } },
              user: { select: { id: true, name: true, email: true } }
            }
          }
        }
      })
    ])

    const sharedFormsList = sharedForms.map(share => ({
      ...share.form,
      isShared: true,
      sharePermission: share.permission,
    }))

    forms = [
      ...ownForms.map(f => ({ ...f, isShared: false })),
      ...sharedFormsList
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  const formsData = forms.map(form => ({
    id: form.id,
    title: form.title,
    slug: form.slug,
    status: form.status as 'draft' | 'published',
    responsesCount: form._count.responses,
    updatedAt: form.updatedAt.toISOString(),
    isShared: 'isShared' in form ? form.isShared : false,
    sharePermission: 'sharePermission' in form ? form.sharePermission : null,
    owner: form.user,
  }))

  return <DashboardClient forms={formsData} user={user} />
}
