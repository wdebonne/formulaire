import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { FontsClient } from './fonts-client'

export default async function AdminFontsPage() {
  const user = await getSessionWithUser()
  
  if (!user) {
    redirect('/login')
  }
  
  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <FontsClient />
}
