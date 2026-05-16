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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorer les routes réservées et les fichiers statiques
  const firstSegment = pathname.split('/')[1]
  
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
