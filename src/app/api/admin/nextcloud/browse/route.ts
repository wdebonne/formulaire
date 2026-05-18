import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface NextCloudItem {
  name: string
  path: string
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

function hrefToPath(href: string, user: string): string {
  const base = `/remote.php/dav/files/${encodeURIComponent(user)}`
  const decoded = decodeURIComponent(href)
  if (decoded.startsWith(base)) return decoded.slice(base.length) || '/'
  return decoded
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<(?:d:|D:)${tag}[^>]*>(.*?)</(?:d:|D:)${tag}>`, 's')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

function parseWebDavXml(xml: string, user: string): NextCloudItem[] {
  const items: NextCloudItem[] = []
  const parts = xml.split(/<d:response>|<D:response>/i).slice(2)
  for (const part of parts) {
    const href = extractTag(part, 'href')
    if (!href) continue
    const path = hrefToPath(href, user)
    const name = path.split('/').filter(Boolean).pop() || ''
    if (!name) continue
    const isCollection = /<d:collection\s*\/>|<D:collection\s*\/>/i.test(part)
    items.push({
      name, path,
      type: isCollection ? 'folder' : 'file',
      contentType: isCollection ? undefined : extractTag(part, 'getcontenttype') || undefined,
      size: extractTag(part, 'getcontentlength') ? Number(extractTag(part, 'getcontentlength')) : undefined,
      lastModified: extractTag(part, 'getlastmodified') || undefined,
    })
  }
  return items
}

// Lit les settings NextCloud via SQL brut (compatible ancien client Prisma)
async function getNextcloudSettings() {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT nextcloudUrl, nextcloudUser, nextcloudPass, nextcloudBasePath FROM "SystemSettings" WHERE id = 'system'`
    )) as any[]
    return rows[0] || null
  } catch {
    return null
  }
}

// GET — liste le contenu d'un dossier WebDAV
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const browsePath = searchParams.get('path') || '/'

    const nc = await getNextcloudSettings()
    if (!nc?.nextcloudUrl || !nc?.nextcloudUser || !nc?.nextcloudPass) {
      return NextResponse.json({ error: 'NextCloud non configuré' }, { status: 400 })
    }

    const webdavUrl = buildWebDavUrl(nc.nextcloudUrl, nc.nextcloudUser, browsePath)
    const credentials = Buffer.from(`${nc.nextcloudUser}:${nc.nextcloudPass}`).toString('base64')

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
    <d:resourcetype/><d:displayname/>
    <d:getcontenttype/><d:getcontentlength/><d:getlastmodified/>
  </d:prop>
</d:propfind>`,
    })

    if (!res.ok && res.status !== 207) {
      return NextResponse.json({ error: `Erreur WebDAV ${res.status}` }, { status: res.status })
    }

    const xml = await res.text()
    const items = parseWebDavXml(xml, nc.nextcloudUser)
    const sorted = [
      ...items.filter(i => i.type === 'folder').sort((a, b) => a.name.localeCompare(b.name)),
      ...items.filter(i => i.type === 'file').sort((a, b) => a.name.localeCompare(b.name)),
    ]

    return NextResponse.json({ path: browsePath, items: sorted })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}

// POST — renvoie l'URL proxy pour un fichier NextCloud donné
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const { path: filePath } = await request.json()
    const nc = await getNextcloudSettings()

    if (!nc?.nextcloudUrl || !nc?.nextcloudUser || !nc?.nextcloudPass) {
      return NextResponse.json({ error: 'NextCloud non configuré' }, { status: 400 })
    }

    const proxyUrl = `/api/admin/nextcloud/file?path=${encodeURIComponent(filePath)}`
    const directUrl = buildWebDavUrl(nc.nextcloudUrl, nc.nextcloudUser, filePath)

    return NextResponse.json({
      url: proxyUrl,
      directUrl,
      name: filePath.split('/').filter(Boolean).pop() || '',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
