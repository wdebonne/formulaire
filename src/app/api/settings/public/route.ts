import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      }
    })

    return NextResponse.json(settings || {
      siteName: 'FormBuilder',
      siteLogo: null,
      siteFavicon: null,
      registrationEnabled: true,
    })
  } catch (error) {
    // Si la table n'existe pas encore
    return NextResponse.json({
      siteName: 'FormBuilder',
      siteLogo: null,
      siteFavicon: null,
      registrationEnabled: true,
    })
  }
}
