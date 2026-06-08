import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { SecurityClient } from './security-client'

export default async function SecurityPage() {
  const user = await getSessionWithUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <SecurityClient />
}
