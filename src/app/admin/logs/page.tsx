import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { LogsClient } from './logs-client'

export default async function LogsPage() {
  const user = await getSessionWithUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <LogsClient />
}
