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

  // Vérifier si l'utilisateur est propriétaire OU a une permission de partage (view, edit, admin)
  const form = await prisma.form.findFirst({
    where: {
      id,
      OR: [
        { userId: session.userId }, // Propriétaire
        {
          shares: {
            some: {
              userId: session.userId,
              permission: { in: ['view', 'edit', 'admin'] }
            }
          }
        }
      ]
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

  const parsedResponses = responses.map((r) => {
    let webhookStatus = {}
    let data = {}
    
    try {
      const rawStatus = (r as any).webhookStatus
      if (rawStatus && typeof rawStatus === 'string' && rawStatus.trim()) {
        webhookStatus = JSON.parse(rawStatus)
      }
    } catch (e) {
      console.error('Error parsing webhookStatus:', e)
    }
    
    try {
      if (r.data && typeof r.data === 'string' && r.data.trim()) {
        data = JSON.parse(r.data)
      }
    } catch (e) {
      console.error('Error parsing response data:', e)
    }
    
    return {
      ...r,
      data,
      webhookStatus,
    }
  })

  return <ResponsesClient form={parsedForm} responses={parsedResponses} />
}
