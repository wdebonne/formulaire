import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { CustomizationClient } from './customization-client'

export default async function CustomizationPage() {
  const user = await getSessionWithUser()
  
  if (!user) {
    redirect('/login')
  }
  
  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <CustomizationClient />
}
