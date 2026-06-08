import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { GdprClient } from './gdpr-client'

export default async function GdprPage() {
  const user = await getSessionWithUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <GdprClient />
}
