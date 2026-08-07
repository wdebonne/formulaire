import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  getSystemDocumentSettings,
  normalizeConverterUrl,
  saveSystemDocumentSettings,
  testPdfConverter,
} from '@/lib/pdf-convert'

// POST /api/admin/documents/test — teste la connexion au convertisseur.
// C'est le seul chemin qui peut passer pdfConverterVerified à true : les options PDF de
// l'interface ne s'ouvrent qu'après un test réussi sur l'adresse effectivement enregistrée.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const current = await getSystemDocumentSettings()
    const url = normalizeConverterUrl(String(body?.pdfConverterUrl ?? current.pdfConverterUrl ?? ''))

    const result = await testPdfConverter(url)

    await saveSystemDocumentSettings({
      pdfConverterUrl: url || undefined,
      pdfConverterVerified: result.success,
      ...(result.success && {
        pdfConverterVerifiedAt: new Date().toISOString(),
        pdfConverterVersion: result.version,
      }),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erreur lors du test du convertisseur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
