import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  CATALOG_NOT_CONFIGURED,
  catalogCall,
  fetchCatalogFacets,
  getCatalogConfig,
  todayIso,
} from '@/lib/catalog-config'
import { ISO_DATE, catalogItemsFromStock } from '@/lib/catalog'

// GET /api/admin/catalog/preview — ce que le catalogue répond, tel qu'un formulaire le recevra.
//
// Séparé du test : celui-ci atteste le raccordement et l'enregistre, celui-là ne fait que
// regarder. Rejouer le test à chaque changement de filtre réécrirait l'état de vérification pour
// une simple consultation.
//
// Le filtrage par service part à l'application de gestion plutôt que d'être appliqué ici, pour la
// raison qui vaut déjà côté formulaire (`catalogFilterParams`) : c'est là-bas qu'est écrit le
// rattachement d'un article à un service. Un aperçu qui trierait autrement que le formulaire ne
// prouverait rien de ce que le formulaire affichera.

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const config = await getCatalogConfig()
    if (!config) {
      return NextResponse.json(
        { error: CATALOG_NOT_CONFIGURED.error },
        { status: CATALOG_NOT_CONFIGURED.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const service = (searchParams.get('service') || '').trim()
    const kind = (searchParams.get('kind') || '').trim()
    const categoryId = (searchParams.get('category_id') || '').trim()
    const dateFrom = (searchParams.get('date_from') || '').trim() || todayIso()
    const dateTo = (searchParams.get('date_to') || '').trim() || dateFrom

    if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo) || dateTo < dateFrom) {
      return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
    }

    const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
    if (service) params.service = service
    if (kind === 'prestation' || kind === 'materiel') params.kind = kind
    if (categoryId) params.category_id = categoryId

    const [stock, facettes] = await Promise.all([
      catalogCall(config, '/api/manifestations/stock/availability', params),
      fetchCatalogFacets(config),
    ])

    if (!stock.ok) return NextResponse.json({ error: stock.error }, { status: stock.status })

    return NextResponse.json({
      dateFrom,
      dateTo,
      // Rien n'est masqué ici : voir un article à zéro est précisément ce qui explique pourquoi il
      // manque dans le formulaire, alors que la même liste amputée laisserait croire à un filtre
      // de service trop étroit.
      items: catalogItemsFromStock(stock.data?.data, { hideUnavailable: false }),
      services: facettes.ok ? facettes.data.services : [],
      categories: facettes.ok ? facettes.data.categories : [],
    })
  } catch (error) {
    console.error('Erreur lors de l’aperçu du catalogue:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
