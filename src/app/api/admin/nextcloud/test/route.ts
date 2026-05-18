import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

function buildWebDavUrl(baseUrl: string, user: string, path: string): string {
  const clean = baseUrl.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${clean}/remote.php/dav/files/${encodeURIComponent(user)}${cleanPath}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { url, user, pass, basePath = '/' } = await request.json()

    if (!url || !user || !pass) {
      return NextResponse.json({ error: 'URL, utilisateur et mot de passe requis' }, { status: 400 })
    }

    const webdavUrl = buildWebDavUrl(url, user, basePath)
    const credentials = Buffer.from(`${user}:${pass}`).toString('base64')

    const res = await fetch(webdavUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${credentials}`,
        Depth: '0',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:resourcetype/><d:displayname/></d:prop>
</d:propfind>`,
    })

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ success: false, error: 'Authentification refusée — vérifiez le nom d\'utilisateur et le mot de passe d\'application' })
    }
    if (res.status === 404) {
      return NextResponse.json({ success: false, error: `Dossier introuvable : ${basePath}` })
    }
    if (res.status === 207 || res.ok) {
      return NextResponse.json({ success: true, message: 'Connexion réussie' })
    }

    return NextResponse.json({ success: false, error: `Erreur HTTP ${res.status}` })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: `Impossible de joindre le serveur : ${error.message}` })
  }
}
