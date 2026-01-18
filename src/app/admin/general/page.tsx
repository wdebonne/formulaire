import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { GeneralSettingsClient } from './general-client'

export default async function GeneralSettingsPage() {
  const user = await getSessionWithUser()
  
  if (!user) {
    redirect('/login')
  }
  
  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <GeneralSettingsClient />
}
