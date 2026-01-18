import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { promises as fs } from 'fs'
import path from 'path'

// GET database info
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Récupérer des statistiques sur la base de données
    const [usersCount, formsCount, responsesCount, themesCount] = await Promise.all([
      prisma.user.count(),
      prisma.form.count(),
      prisma.response.count(),
      prisma.theme.count(),
    ])

    // Vérifier si la base de données est SQLite (fichier local)
    const databaseUrl = process.env.DATABASE_URL || ''
    const isLocalFile = databaseUrl.startsWith('file:')
    
    let fileSize = null
    if (isLocalFile) {
      try {
        const dbPath = databaseUrl.replace('file:', '').split('?')[0]
        const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), 'prisma', dbPath)
        const stats = await fs.stat(absolutePath)
        fileSize = stats.size
      } catch (e) {
        console.error('Error getting DB file size:', e)
      }
    }

    return NextResponse.json({
      type: isLocalFile ? 'sqlite' : 'external',
      stats: {
        users: usersCount,
        forms: formsCount,
        responses: responsesCount,
        themes: themesCount,
      },
      fileSize,
      databaseUrl: isLocalFile ? databaseUrl : '[External Database]',
    })
  } catch (error) {
    console.error('Get database info error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST database actions (backup, test connection)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { action } = await request.json()

    if (action === 'test-connection') {
      // Tester la connexion à la base de données
      try {
        await prisma.$queryRaw`SELECT 1`
        return NextResponse.json({ success: true, message: 'Connexion réussie' })
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message })
      }
    }

    if (action === 'backup') {
      // Exporter toutes les données
      const [users, forms, themes, responses, settings, templates, formShares] = await Promise.all([
        prisma.user.findMany(),
        prisma.form.findMany(),
        prisma.theme.findMany(),
        prisma.response.findMany(),
        prisma.systemSettings.findMany(),
        prisma.emailTemplate.findMany(),
        prisma.formShare.findMany(),
      ])

      const backup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {
          users: users.map(u => ({ ...u, password: '[REDACTED]' })), // Ne pas exporter les mots de passe
          forms,
          themes,
          responses,
          settings,
          templates,
          formShares,
        }
      }

      return NextResponse.json(backup)
    }

    return NextResponse.json({ error: 'Action non valide' }, { status: 400 })
  } catch (error) {
    console.error('Database action error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
