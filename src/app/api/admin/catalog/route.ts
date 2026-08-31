import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  catalogSettingsView,
  getSystemCatalogSettings,
  normalizeCatalogUrl,
  saveSystemCatalogSettings,
} from '@/lib/catalog-config'

// GET /api/admin/catalog — réglages du catalogue de matériel externe.
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    return NextResponse.json(catalogSettingsView(await getSystemCatalogSettings()))
  } catch (error) {
    console.error('Erreur lors de la lecture des réglages catalogue:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/admin/catalog — enregistre l'adresse et, si un nouveau jeton est saisi, le jeton.
//
// Un jeton laissé vide conserve celui déjà enregistré : l'écran ne pouvant pas le relire, exiger
// de le ressaisir à chaque changement d'adresse ferait perdre le raccordement à qui ne l'a plus
// sous la main. Vider l'adresse, en revanche, débranche le catalogue et efface le jeton avec lui.
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const current = await getSystemCatalogSettings()
    const apiUrl = normalizeCatalogUrl(String(body?.apiUrl ?? ''))
    const nouveauJeton = String(body?.apiToken ?? '').trim()

    if (!apiUrl) {
      return NextResponse.json(catalogSettingsView(await saveSystemCatalogSettings({})))
    }

    const apiToken = nouveauJeton || current.apiToken || ''
    // Toute modification remet la vérification à zéro : l'état affiché doit porter sur ce qui est
    // réellement enregistré, pas sur un raccordement qui n'existe plus.
    const inchange = apiUrl === current.apiUrl && apiToken === current.apiToken
    const settings = inchange
      ? { ...current, apiUrl, apiToken }
      : { apiUrl, apiToken, verified: false }

    return NextResponse.json(catalogSettingsView(await saveSystemCatalogSettings(settings)))
  } catch (error) {
    console.error('Erreur lors de l’enregistrement du catalogue:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
