import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Sans ceci, Next.js met cette route en cache statique au build (production),
// et les changements de réglages (ex: inscriptions) ne sont jamais reflétés.
export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseLoginPageSettings(raw: string | null | undefined) {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// GET public settings (no auth required)
export async function GET() {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: {
        siteName: true,
        siteLogo: true,
        siteFavicon: true,
        registrationEnabled: true,
        loginPageSettings: true,
      }
    })

    if (!settings) {
      return NextResponse.json({
        siteName: 'FormBuilder',
        siteLogo: null,
        siteFavicon: null,
        registrationEnabled: true,
        loginPageSettings: {},
      })
    }

    return NextResponse.json({
      ...settings,
      loginPageSettings: parseLoginPageSettings(settings.loginPageSettings),
    })
  } catch (error) {
    // Si la table n'existe pas encore
    return NextResponse.json({
      siteName: 'FormBuilder',
      siteLogo: null,
      siteFavicon: null,
      registrationEnabled: true,
      loginPageSettings: {},
    })
  }
}
