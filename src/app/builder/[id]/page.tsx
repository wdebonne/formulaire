import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FormBuilderClient } from './form-builder-client'

interface BuilderPageProps {
  params: Promise<{ id: string }>
}

export default async function BuilderPage({ params }: BuilderPageProps) {
  const session = await getSession()
  const { id } = await params

  if (!session) {
    redirect('/login')
  }

  const [form, themes] = await Promise.all([
    prisma.form.findFirst({
      where: {
        id,
        userId: session.userId
      },
      include: { theme: true }
    }),
    prisma.theme.findMany({
      where: {
        OR: [
          { userId: session.userId },
          { isDefault: true }
        ]
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })
  ])

  if (!form) {
    redirect('/dashboard')
  }

  const formData = {
    id: form.id,
    title: form.title,
    slug: form.slug,
    description: form.description || '',
    status: form.status as 'draft' | 'published',
    blocks: JSON.parse(form.blocks),
    logic: JSON.parse(form.logic),
    settings: JSON.parse(form.settings),
    webhooks: JSON.parse(form.webhooks),
    themeId: form.themeId,
    theme: form.theme ? {
      id: form.theme.id,
      name: form.theme.name,
      properties: JSON.parse(form.theme.properties),
      isDefault: form.theme.isDefault
    } : null
  }

  const themesData = themes.map(t => ({
    id: t.id,
    name: t.name,
    properties: JSON.parse(t.properties),
    isDefault: t.isDefault
  }))

  return <FormBuilderClient initialForm={formData} themes={themesData} />
}
