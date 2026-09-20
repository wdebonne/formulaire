import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { prisma } from '@/lib/prisma'
import { startMaintenanceScheduler } from '@/lib/maintenance-scheduler'

const inter = Inter({ subsets: ['latin'] })

// Le layout racine est le seul point d'entrée garanti côté Node : la minuterie de maintenance
// y est armée (rapports périodiques et purges de conservation, une seule fois par processus —
// l'appel est idempotent).
startMaintenanceScheduler()

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

// `maximumScale: 1` / `userScalable: false` bloquaient le zoom : c'est un échec du critère
// WCAG 1.4.4 (RGAA 10.4), et la raison d'origine — le zoom automatique de iOS à la mise au point
// d'un champ — est déjà traitée par le `fontSize: 16px` posé sur les champs du formulaire public.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
