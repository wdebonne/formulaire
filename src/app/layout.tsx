import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { prisma } from '@/lib/prisma'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' },
    select: { siteName: true, siteFavicon: true },
  }).catch(() => null)

  const siteName = settings?.siteName ?? 'FormBuilder'
  const siteFavicon = settings?.siteFavicon ?? null

  return {
    title: `${siteName} - Créateur de formulaires`,
    description: 'Créez des formulaires interactifs avec un éditeur visuel moderne',
    icons: siteFavicon ? { icon: siteFavicon } : undefined,
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
