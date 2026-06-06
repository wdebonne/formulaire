import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PublicFormClient } from '@/app/[slug]/public-form-client'

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })

  const whereCondition =
    user?.role === 'admin'
      ? { id, deletedAt: null }
      : {
          id,
          deletedAt: null,
          OR: [
            { userId: session.userId },
            {
              shares: {
                some: {
                  userId: session.userId,
                  permission: { in: ['view', 'edit', 'admin'] },
                },
              },
            },
          ],
        }

  const [form, systemSettings] = await Promise.all([
    prisma.form.findFirst({
      where: whereCondition,
      include: { theme: true },
    }),
    prisma.systemSettings.findFirst({
      where: { id: 'system' },
      select: { siteLogo: true },
    }),
  ])

  if (!form) redirect('/dashboard')

  let theme = form.theme
  if (!theme) {
    theme = await prisma.theme.findFirst({ where: { isDefault: true } })
  }

  const parsedForm = {
    id: form.id,
    title: form.title,
    blocks: JSON.parse(form.blocks),
    settings: JSON.parse(form.settings),
    logic: JSON.parse(form.logic),
    webhooks: JSON.parse(form.webhooks),
  }

  const parsedTheme = theme
    ? { ...theme, properties: JSON.parse(theme.properties) }
    : {
        id: 'default',
        name: 'Défaut',
        properties: {
          font: 'Inter',
          backgroundColor: '#ffffff',
          questionsColor: '#000000',
          answersColor: '#4a4a4a',
          buttonsBgColor: '#7c3aed',
          buttonsFontColor: '#ffffff',
        },
      }

  return (
    <PublicFormClient
      form={parsedForm}
      theme={parsedTheme}
      siteLogo={systemSettings?.siteLogo ?? null}
    />
  )
}
