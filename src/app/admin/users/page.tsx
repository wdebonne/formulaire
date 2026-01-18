import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { UsersManagementClient } from './users-client'

export default async function UsersManagementPage() {
  const user = await getSessionWithUser()
  
  if (!user) {
    redirect('/login')
  }
  
  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <UsersManagementClient />
}
