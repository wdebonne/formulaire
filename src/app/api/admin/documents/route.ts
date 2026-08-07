import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  getSystemDocumentSettings,
  normalizeConverterUrl,
  saveSystemDocumentSettings,
} from '@/lib/pdf-convert'

// GET /api/admin/documents — réglages du convertisseur PDF externe
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    return NextResponse.json(await getSystemDocumentSettings())
  } catch (error) {
    console.error('Erreur lors de la lecture des réglages documents:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/admin/documents — enregistre l'URL du convertisseur.
// Toute modification d'adresse remet la vérification à zéro : les options PDF disparaissent
// de l'interface tant que la nouvelle adresse n'a pas été testée avec succès.
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const body = await request.json()
    const current = await getSystemDocumentSettings()
    const url = normalizeConverterUrl(String(body?.pdfConverterUrl ?? ''))

    if (url && current.pdfConverterUrl === url) {
      return NextResponse.json(await saveSystemDocumentSettings({ ...current, pdfConverterUrl: url }))
    }

    return NextResponse.json(
      await saveSystemDocumentSettings({
        pdfConverterUrl: url || undefined,
        pdfConverterVerified: false,
      })
    )
  } catch (error) {
    console.error('Erreur lors de l’enregistrement du convertisseur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
