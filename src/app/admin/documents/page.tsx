import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { DocumentsSettingsClient } from './documents-client'

export default async function AdminDocumentsPage() {
  const user = await getSessionWithUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <DocumentsSettingsClient />
}
