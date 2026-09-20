import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  getSystemDocumentSettings,
  normalizeConverterUrl,
  resolveProvider,
  saveSystemDocumentSettings,
  testPdfConversion,
} from '@/lib/pdf-convert'
import type { PdfConverterProvider } from '@/types/form'

// POST /api/admin/documents/test-conversion — convertit un document témoin de bout en bout.
//
// C'est la seule vérification qui prouve quelque chose : un moteur joignable peut refuser de
// convertir (connecteur absent, serveur de documents éteint, format refusé). Une conversion
// aboutie ouvre donc les options PDF ; une conversion ratée les referme, même si la connexion,
// elle, répond — sinon un réglage « PDF » resterait offert en sachant qu'il échouera.
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

    const url = normalizeConverterUrl(String(body?.pdfConverterUrl ?? current.pdfConverterUrl ?? ''))
    const result = await testPdfConversion(provider, url)
    const now = new Date().toISOString()

    // Ce qui avait été constaté sur l'autre moteur ne le suit pas : la version rapportée comme la
    // date de la dernière conversion parleraient d'un service qui n'est plus celui-là. L'adresse
    // Gotenberg reste néanmoins enregistrée, pour pouvoir y revenir sans la ressaisir.
    const sameEngine = resolveProvider(current) === provider

    await saveSystemDocumentSettings({
      ...(sameEngine ? current : { pdfConverterUrl: current.pdfConverterUrl }),
      pdfConverterProvider: provider,
      ...(provider === 'gotenberg' && { pdfConverterUrl: url || undefined }),
      pdfConverterVerified: result.success,
      ...(result.success && {
        pdfConverterVerifiedAt: now,
        pdfConversionVerifiedAt: now,
        pdfConversionMethod: result.method,
      }),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erreur lors du test de conversion:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
