import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  catalogSettingsView,
  getSystemCatalogSettings,
  normalizeCatalogUrl,
  saveSystemCatalogSettings,
  testCatalogConnection,
} from '@/lib/catalog-config'

// POST /api/admin/catalog/test — teste le raccordement et enregistre son résultat.
//
// Le test porte sur les valeurs saisies à l'écran, jeton compris, et enregistre ce qu'il vient de
// vérifier : tester une adresse pour en garder une autre annoncerait un état que rien ne soutient.
// Un jeton laissé vide reprend celui déjà enregistré, que l'écran ne peut pas relire.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const current = await getSystemCatalogSettings()
    const apiUrl = normalizeCatalogUrl(String(body?.apiUrl ?? current.apiUrl ?? ''))
    const apiToken = String(body?.apiToken ?? '').trim() || current.apiToken || ''

    const result = await testCatalogConnection(apiUrl, apiToken)

    const settings = await saveSystemCatalogSettings({
      apiUrl: apiUrl || undefined,
      apiToken: apiToken || undefined,
      verified: result.success,
      ...(result.success && {
        verifiedAt: new Date().toISOString(),
        verifiedServiceCount: result.services?.length ?? 0,
        verifiedItemCount: result.itemCount ?? 0,
      }),
    })

    return NextResponse.json({
      success: result.success,
      error: result.error,
      services: result.services ?? [],
      categories: result.categories ?? [],
      itemCount: result.itemCount ?? 0,
      settings: catalogSettingsView(settings),
    })
  } catch (error) {
    console.error('Erreur lors du test du catalogue:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
