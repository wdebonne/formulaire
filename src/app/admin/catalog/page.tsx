import { redirect } from 'next/navigation'
import { getSessionWithUser } from '@/lib/auth'
import { CatalogSettingsClient } from './catalog-client'

export default async function AdminCatalogPage() {
  const user = await getSessionWithUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <CatalogSettingsClient />
}
