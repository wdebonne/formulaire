import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { NextCloudSettingsClient } from './nextcloud-client'

export default async function NextCloudSettingsPage() {
  const user = await getSessionWithUser()

  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')

  return <NextCloudSettingsClient />
}
