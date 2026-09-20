import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  getSystemDocumentSettings,
  normalizeConverterUrl,
  resolveProvider,
  saveSystemDocumentSettings,
  testGotenberg,
} from '@/lib/pdf-convert'
import { probeNextcloud } from '@/lib/nextcloud-convert'
import type { PdfConverterProvider } from '@/types/form'

// POST /api/admin/documents/test — teste la joignabilité du moteur retenu.
//
// Gotenberg n'a qu'un endpoint de conversion : son /health suffit à conclure, et ce test ouvre
// donc les options PDF comme il l'a toujours fait. NextCloud, lui, peut très bien répondre sans
// qu'aucun serveur bureautique ne lui soit branché : une connexion réussie n'ouvre rien, seule
// une conversion aboutie le fait (/api/admin/documents/test-conversion).
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const current = await getSystemDocumentSettings()

    const provider: PdfConverterProvider =
      body?.pdfConverterProvider === 'nextcloud'
        ? 'nextcloud'
        : body?.pdfConverterProvider === 'gotenberg'
          ? 'gotenberg'
          : resolveProvider(current)

    if (provider === 'nextcloud') {
      const result = await probeNextcloud()

      // Rien de ce qui a été constaté sur Gotenberg ne vaut pour NextCloud : ni la vérification,
      // qui ouvrirait l'option PDF pour un moteur n'ayant rien converti, ni la version rapportée.
      // L'adresse Gotenberg, elle, est conservée pour permettre de revenir en arrière.
      const sameEngine = resolveProvider(current) === 'nextcloud'

      await saveSystemDocumentSettings({
        ...(sameEngine ? current : { pdfConverterUrl: current.pdfConverterUrl }),
        pdfConverterProvider: 'nextcloud',
        // Une instance injoignable ne peut plus rien convertir : l'option PDF se referme.
        // Une instance joignable, elle, ne prouve rien de plus qu'avant.
        pdfConverterVerified: result.success && sameEngine && Boolean(current.pdfConverterVerified),
      })

      return NextResponse.json(result)
    }

    const url = normalizeConverterUrl(String(body?.pdfConverterUrl ?? current.pdfConverterUrl ?? ''))
    const result = await testGotenberg(url)

    // Changer de moteur ou d'adresse périme la conversion éprouvée : la garder afficherait
    // « dernière conversion réussie » à propos d'un service qui n'est plus celui-là.
    const sameSetup =
      resolveProvider(current) === 'gotenberg' && (current.pdfConverterUrl ?? '') === url

    await saveSystemDocumentSettings({
      ...(sameSetup ? current : {}),
      pdfConverterProvider: 'gotenberg',
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
