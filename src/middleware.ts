import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Liste des routes réservées (chemins qui ne sont pas des slugs de formulaires)
const RESERVED_PATHS = [
  'api',
  'login',
  'register',
  'dashboard',
  'builder',
  'forms',
  'settings',
  'admin',
  'forgot-password',
  'reset-password',
  'f', // Ancienne route, rediriger vers la nouvelle
  'uploads', // Fichiers uploadés, redirigés vers l'API
  '_next',
  'favicon.ico',
]

// Cache mémoire des listes IP, rafraîchi périodiquement depuis /api/internal/ip-lists.
// Le middleware tourne en Edge Runtime et ne peut pas utiliser Prisma/SQLite directement.
const IP_LIST_CACHE_TTL_MS = 60_000
let ipListCache: { blacklist: Set<string>; whitelist: Set<string> } = {
  blacklist: new Set(),
  whitelist: new Set(),
}
let ipListCacheLastAttemptAt = 0
let ipListCacheRefreshing: Promise<void> | null = null

function refreshIpListCache(origin: string) {
  if (ipListCacheRefreshing) return ipListCacheRefreshing

  // Marqué immédiatement pour éviter qu'un échec ne déclenche une nouvelle tentative à chaque requête
  ipListCacheLastAttemptAt = Date.now()

  ipListCacheRefreshing = fetch(`${origin}/api/internal/ip-lists`, {
    headers: { 'x-internal-secret': process.env.JWT_SECRET || '' },
    cache: 'no-store',
  })
    .then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { blacklist: string[]; whitelist: string[] }
      ipListCache = {
        blacklist: new Set(data.blacklist),
        whitelist: new Set(data.whitelist),
      }
    })
    .catch(() => {
      // En cas d'échec réseau, on conserve le cache existant ("fail open")
    })
    .finally(() => {
      ipListCacheRefreshing = null
    })

  return ipListCacheRefreshing
}

function getMiddlewareClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim()
    if (ip) return ip
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorer les routes réservées et les fichiers statiques
  const firstSegment = pathname.split('/')[1]

  // Ne pas appliquer le filtrage IP à l'endpoint interne lui-même (évite l'auto-blocage)
  if (!pathname.startsWith('/api/internal/')) {
    if (Date.now() - ipListCacheLastAttemptAt > IP_LIST_CACHE_TTL_MS) {
      await refreshIpListCache(request.nextUrl.origin)
    }

    const clientIp = getMiddlewareClientIp(request)
    if (
      clientIp !== 'unknown' &&
      ipListCache.blacklist.has(clientIp) &&
      !ipListCache.whitelist.has(clientIp)
    ) {
      return new NextResponse('Accès refusé', { status: 403 })
    }
  }

  // Rediriger /uploads/* vers /api/uploads/* pour compatibilité avec le mode standalone
  if (firstSegment === 'uploads') {
    const filename = pathname.split('/')[2]
    if (filename) {
      const url = request.nextUrl.clone()
      url.pathname = `/api/uploads/${filename}`
      return NextResponse.rewrite(url)
    }
  }

  // Si c'est l'ancienne route /f/[slug], rediriger vers /[slug]
  if (firstSegment === 'f') {
    const slug = pathname.split('/')[2]
    if (slug) {
      const url = request.nextUrl.clone()
      url.pathname = `/${slug}`
      return NextResponse.redirect(url, 301)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder) EXCEPT /uploads/*
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/uploads/:path*',
  ],
}
