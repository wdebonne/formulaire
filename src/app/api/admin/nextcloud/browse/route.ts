import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface NextCloudItem {
  name: string
  path: string       // chemin relatif depuis la racine WebDAV user
  type: 'folder' | 'file'
  contentType?: string
  size?: number
  lastModified?: string
}

function buildWebDavUrl(baseUrl: string, user: string, path: string): string {
  const clean = baseUrl.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${clean}/remote.php/dav/files/${encodeURIComponent(user)}${cleanPath}`
}

// Parse d:href relative to base to extract the file path
function hrefToPath(href: string, user: string): string {
  const base = `/remote.php/dav/files/${encodeURIComponent(user)}`
  const decoded = decodeURIComponent(href)
  if (decoded.startsWith(base)) {
    return decoded.slice(base.length) || '/'
  }
  return decoded
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<(?:d:|D:)${tag}[^>]*>(.*?)</(?:d:|D:)${tag}>`, 's')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

function parseWebDavXml(xml: string, user: string): NextCloudItem[] {
  const items: NextCloudItem[] = []
  // Split by <d:response> blocks — skip the first one (it's the folder itself)
  const responseParts = xml.split(/<d:response>|<D:response>/i).slice(2)

  for (const part of responseParts) {
    const href = extractTag(part, 'href')
    if (!href) continue

    const path = hrefToPath(href, user)
    const name = path.split('/').filter(Boolean).pop() || ''
    if (!name) continue

    const isCollection = /<d:collection\s*\/>|<D:collection\s*\/>/i.test(part)
    const contentType = extractTag(part, 'getcontenttype')
    const sizeStr = extractTag(part, 'getcontentlength')
    const lastModified = extractTag(part, 'getlastmodified')

    items.push({
      name,
      path,
      type: isCollection ? 'folder' : 'file',
      contentType: isCollection ? undefined : contentType || undefined,
      size: sizeStr ? Number(sizeStr) : undefined,
      lastModified: lastModified || undefined,
    })
  }

  return items
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const browsePath = searchParams.get('path') || '/'

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })

    if (!settings?.nextcloudUrl || !settings?.nextcloudUser || !settings?.nextcloudPass) {
      return NextResponse.json({ error: 'NextCloud non configuré' }, { status: 400 })
    }

    const { nextcloudUrl, nextcloudUser, nextcloudPass } = settings
    const webdavUrl = buildWebDavUrl(nextcloudUrl, nextcloudUser, browsePath)
    const credentials = Buffer.from(`${nextcloudUser}:${nextcloudPass}`).toString('base64')

    const res = await fetch(webdavUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${credentials}`,
        Depth: '1',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
  </d:prop>
</d:propfind>`,
    })

    if (!res.ok && res.status !== 207) {
      return NextResponse.json({ error: `Erreur WebDAV ${res.status}` }, { status: res.status })
    }

    const xml = await res.text()
    const items = parseWebDavXml(xml, nextcloudUser)

    // Separate folders and files, sort folders first then alphabetically
    const sorted = [
      ...items.filter(i => i.type === 'folder').sort((a, b) => a.name.localeCompare(b.name)),
      ...items.filter(i => i.type === 'file').sort((a, b) => a.name.localeCompare(b.name)),
    ]

    return NextResponse.json({ path: browsePath, items: sorted })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}

// GET public NextCloud file URL (pour injecter dans blockMedia.url)
// Construit l'URL de partage WebDAV pour un fichier donné
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { path: filePath } = await request.json()
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })

    if (!settings?.nextcloudUrl || !settings?.nextcloudUser || !settings?.nextcloudPass) {
      return NextResponse.json({ error: 'NextCloud non configuré' }, { status: 400 })
    }

    const webdavUrl = buildWebDavUrl(settings.nextcloudUrl, settings.nextcloudUser, filePath)

    // Return the proxied URL so the form viewer can fetch via our API (avoids CORS & auth)
    const proxyUrl = `/api/admin/nextcloud/file?path=${encodeURIComponent(filePath)}`

    return NextResponse.json({
      url: proxyUrl,
      directUrl: webdavUrl,
      name: filePath.split('/').filter(Boolean).pop() || '',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
