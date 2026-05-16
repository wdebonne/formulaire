import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getSession } from '@/lib/auth'

// GET system settings
export async function GET() {
  try {
    // Pour les paramètres publics (nom du site, logo, etc.), on autorise tous les utilisateurs connectés
    const session = await getSession()
    if (!session) {
      // Pour les utilisateurs non connectés, on renvoie seulement les paramètres publics
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
        registrationEnabled: true 
      })
    }

    // Pour les admins, renvoyer tous les paramètres
    const adminSession = await requireAdmin()
    if (adminSession) {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'system' }
      })
      return NextResponse.json(settings || {
        id: 'system',
        siteName: 'FormBuilder',
        siteLogo: null,
        siteFavicon: null,
        smtpHost: null,
        smtpPort: 587,
        smtpUser: null,
        smtpPass: null,
        smtpFrom: null,
        smtpFromName: null,
        smtpSecure: false,
        registrationEnabled: true,
      })
    }

    // Pour les utilisateurs normaux, renvoyer seulement les paramètres publics
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: {
        siteName: true,
        siteLogo: true,
        siteFavicon: true,
      }
    })
    return NextResponse.json(settings || { siteName: 'FormBuilder', siteLogo: null, siteFavicon: null })
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT update system settings
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const data = await request.json()

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        id: 'system',
        ...data,
      }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
