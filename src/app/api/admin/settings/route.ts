import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getSession } from '@/lib/auth'

// Crée les colonnes NextCloud si elles n'existent pas encore (migration lazy)
// Indispensable si le container tourne avec un ancien client Prisma.
async function ensureNextcloudColumns() {
  const cols = ['nextcloudUrl', 'nextcloudUser', 'nextcloudPass', 'nextcloudBasePath']
  for (const col of cols) {
    try {
      const defaultVal = col === 'nextcloudBasePath' ? `DEFAULT '/'` : ''
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "SystemSettings" ADD COLUMN "${col}" TEXT ${defaultVal}`
      )
    } catch {
      // Colonne déjà présente — OK
    }
  }
}

// Lit les champs NextCloud via SQL brut (compatible avec et sans migration)
async function readNextcloudFields(): Promise<Record<string, string | null>> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT nextcloudUrl, nextcloudUser, nextcloudPass, nextcloudBasePath FROM "SystemSettings" WHERE id = 'system'`
    )) as any[]
    const row = rows[0] || {}
    return {
      nextcloudUrl:      row.nextcloudUrl      ?? null,
      nextcloudUser:     row.nextcloudUser     ?? null,
      nextcloudPass:     row.nextcloudPass     ?? null,
      nextcloudBasePath: row.nextcloudBasePath ?? '/',
    }
  } catch {
    return { nextcloudUrl: null, nextcloudUser: null, nextcloudPass: null, nextcloudBasePath: '/' }
  }
}

// Écrit les champs NextCloud via SQL brut
async function writeNextcloudFields(fields: {
  nextcloudUrl?: string | null
  nextcloudUser?: string | null
  nextcloudPass?: string | null
  nextcloudBasePath?: string | null
}) {
  await ensureNextcloudColumns()

  // Assure qu'une ligne 'system' existe
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "SystemSettings" (id, siteName, registrationEnabled, smtpPort, smtpSecure, updatedAt)
     VALUES ('system', 'FormBuilder', 1, 587, 0, datetime('now'))`
  )

  await prisma.$executeRawUnsafe(
    `UPDATE "SystemSettings"
     SET nextcloudUrl = ?, nextcloudUser = ?, nextcloudPass = ?, nextcloudBasePath = ?, updatedAt = datetime('now')
     WHERE id = 'system'`,
    fields.nextcloudUrl   ?? null,
    fields.nextcloudUser  ?? null,
    fields.nextcloudPass  ?? null,
    fields.nextcloudBasePath ?? '/'
  )
}

// Champs NextCloud — à traiter séparément du client Prisma
const NC_FIELDS = new Set(['nextcloudUrl', 'nextcloudUser', 'nextcloudPass', 'nextcloudBasePath'])

function splitData(data: Record<string, any>) {
  const prismaData: Record<string, any> = {}
  const ncData: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) {
    if (NC_FIELDS.has(k)) ncData[k] = v
    else prismaData[k] = v
  }
  // loginPageSettings est stocké en JSON texte (comme Form.settings)
  if (prismaData.loginPageSettings && typeof prismaData.loginPageSettings === 'object') {
    prismaData.loginPageSettings = JSON.stringify(prismaData.loginPageSettings)
  }
  return { prismaData, ncData }
}

function parseLoginPageSettings(raw: string | null | undefined) {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// GET system settings
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'system' },
        select: { siteName: true, siteLogo: true, siteFavicon: true, registrationEnabled: true }
      })
      return NextResponse.json(settings || { siteName: 'FormBuilder', siteLogo: null, siteFavicon: null, registrationEnabled: true })
    }

    const adminSession = await requireAdmin()
    if (adminSession) {
      const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })
      const ncFields = await readNextcloudFields()
      return NextResponse.json({
        ...(settings || {
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
          loginPageSettings: '{}',
        }),
        ...ncFields,
        loginPageSettings: parseLoginPageSettings(settings?.loginPageSettings),
      })
    }

    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: { siteName: true, siteLogo: true, siteFavicon: true }
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
    const { prismaData, ncData } = splitData(data)

    // Sauvegarde les champs standard via le client Prisma
    if (Object.keys(prismaData).length > 0) {
      await prisma.systemSettings.upsert({
        where: { id: 'system' },
        update: { ...prismaData, updatedAt: new Date() },
        create: { id: 'system', ...prismaData },
      })
    }

    // Sauvegarde les champs NextCloud via SQL brut
    if (Object.keys(ncData).length > 0) {
      await writeNextcloudFields(ncData)
    }

    // Renvoie la config complète fusionnée
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })
    const ncFields = await readNextcloudFields()
    return NextResponse.json({
      ...settings,
      ...ncFields,
      loginPageSettings: parseLoginPageSettings(settings?.loginPageSettings),
    })
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
