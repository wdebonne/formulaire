import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function buildWebDavUrl(baseUrl: string, user: string, path: string): string {
  const clean = baseUrl.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${clean}/remote.php/dav/files/${encodeURIComponent(user)}${cleanPath}`
}

// Proxy public — sert un fichier NextCloud sans exposer les credentials
// Accessible sans authentification pour que les répondants au formulaire puissent voir les fichiers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')
    if (!filePath) {
      return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 })
    }

    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: { nextcloudUrl: true, nextcloudUser: true, nextcloudPass: true },
    })

    if (!settings?.nextcloudUrl || !settings?.nextcloudUser || !settings?.nextcloudPass) {
      return NextResponse.json({ error: 'NextCloud non configuré' }, { status: 400 })
    }

    const { nextcloudUrl, nextcloudUser, nextcloudPass } = settings
    const webdavUrl = buildWebDavUrl(nextcloudUrl, nextcloudUser, filePath)
    const credentials = Buffer.from(`${nextcloudUser}:${nextcloudPass}`).toString('base64')

    const res = await fetch(webdavUrl, {
      headers: { Authorization: `Basic ${credentials}` },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Fichier introuvable (${res.status})` }, { status: res.status })
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300', // 5 min cache
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
