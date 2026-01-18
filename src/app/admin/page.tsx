import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { AdminSettingsClient } from './admin-settings-client'

export default async function AdminSettingsPage() {
  const user = await getSessionWithUser()
  
  if (!user) {
    redirect('/login')
  }
  
  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <AdminSettingsClient user={user} />
}
