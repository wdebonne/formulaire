import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { DatabaseSettingsClient } from './database-client'

export default async function DatabaseSettingsPage() {
  const user = await getSessionWithUser()
  
  if (!user) {
    redirect('/login')
  }
  
  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <DatabaseSettingsClient />
}
