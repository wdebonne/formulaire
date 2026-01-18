import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ResponsesClient } from './responses-client'

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const { id } = await params

  const form = await prisma.form.findFirst({
    where: {
      id,
      userId: session.userId,
    },
  })

  if (!form) {
    redirect('/dashboard')
  }

  const responses = await prisma.response.findMany({
    where: {
      formId: id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const parsedForm = {
    ...form,
    blocks: JSON.parse(form.blocks),
    settings: JSON.parse(form.settings),
    webhooks: JSON.parse(form.webhooks || '[]'),
  }

  const parsedResponses = responses.map((r) => ({
    ...r,
    data: JSON.parse(r.data),
  }))

  return <ResponsesClient form={parsedForm} responses={parsedResponses} />
}
