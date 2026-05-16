import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  })

  if (!user) {
    redirect('/login')
  }

  return <SettingsClient user={user} />
}
