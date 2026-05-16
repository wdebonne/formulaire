import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { SmtpSettingsClient } from './smtp-client'

export default async function SmtpSettingsPage() {
  const user = await getSessionWithUser()
  
  if (!user) {
    redirect('/login')
  }
  
  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <SmtpSettingsClient />
}
