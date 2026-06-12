import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import path from 'path'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    
    // Sécurité : empêcher la traversée de répertoire
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    const filepath = path.join(uploadDir, filename)

    // Vérifier que le fichier existe
    try {
      await stat(filepath)
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Lire le fichier
    const file = await readFile(filepath)
    
    // Déterminer le type MIME
    const ext = path.extname(filename).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    }

    // SVG servi depuis l'origine de l'app : bloquer l'exécution de scripts
    if (ext === '.svg') {
      headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'"
    }

    return new NextResponse(file, { headers })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
