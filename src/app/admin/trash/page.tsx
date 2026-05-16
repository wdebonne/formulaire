import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { TrashClient } from './trash-client'

export default async function TrashPage() {
  const user = await getSessionWithUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <TrashClient />
}
