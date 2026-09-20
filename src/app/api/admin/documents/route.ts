import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  getSystemDocumentSettings,
  normalizeConverterUrl,
  resolveProvider,
  saveSystemDocumentSettings,
} from '@/lib/pdf-convert'
import { getNextcloudConfig } from '@/lib/nextcloud-convert'
import type { PdfConverterProvider } from '@/types/form'

// Ce que l'écran d'administration a besoin de savoir du NextCloud configuré : de quoi dire s'il
// est branché et sur quel compte. Jamais le mot de passe d'application.
async function nextcloudSummary() {
  const config = await getNextcloudConfig()
  if (!config) return { configured: false }
  return { configured: true, url: config.url, user: config.user, basePath: config.basePath }
}

// GET /api/admin/documents — réglages du convertisseur PDF
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const settings = await getSystemDocumentSettings()
    return NextResponse.json({
      ...settings,
      pdfConverterProvider: resolveProvider(settings),
      nextcloud: await nextcloudSummary(),
    })
  } catch (error) {
    console.error('Erreur lors de la lecture des réglages documents:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/admin/documents — enregistre le moteur et, pour Gotenberg, son adresse.
// Changer de moteur ou d'adresse remet la vérification à zéro : les options PDF disparaissent
// de l'interface tant que le nouveau réglage n'a pas été éprouvé.
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const body = await request.json()
    const current = await getSystemDocumentSettings()

    const provider: PdfConverterProvider =
      body?.pdfConverterProvider === 'nextcloud' ? 'nextcloud' : 'gotenberg'
    const url = normalizeConverterUrl(String(body?.pdfConverterUrl ?? ''))

    // L'adresse Gotenberg est conservée même quand NextCloud est retenu : revenir en arrière ne
    // doit pas obliger à la ressaisir. Elle ne compte alors plus dans la vérification.
    const unchanged =
      provider === resolveProvider(current) &&
      (provider === 'nextcloud' || url === (current.pdfConverterUrl ?? ''))

    return NextResponse.json({
      ...(await saveSystemDocumentSettings(
        unchanged
          ? { ...current, pdfConverterProvider: provider, pdfConverterUrl: url || undefined }
          : {
              pdfConverterProvider: provider,
              pdfConverterUrl: url || undefined,
              pdfConverterVerified: false,
            }
      )),
      nextcloud: await nextcloudSummary(),
    })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement du convertisseur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
