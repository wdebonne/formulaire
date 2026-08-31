import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { CATALOG_NOT_CONFIGURED, fetchCatalogFacets, getCatalogConfig } from '@/lib/catalog-config'

// GET /api/catalog/facets - Services et catégories déclarés dans l'application de gestion.
//
// Sert les listes de l'éditeur : choisir « Urbanisme » dans une liste vaut mieux que le taper au
// clavier, où la faute de frappe ne se voit qu'au premier formulaire vide.
//
// Réservé aux comptes connectés — c'est un écran de conception, pas une page publique, et la liste
// des services d'une collectivité n'a pas à être servie à qui passe.

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const config = await getCatalogConfig()
    if (!config) {
      return NextResponse.json(
        { error: CATALOG_NOT_CONFIGURED.error },
        { status: CATALOG_NOT_CONFIGURED.status }
      )
    }

    const facettes = await fetchCatalogFacets(config)
    if (!facettes.ok) {
      // Le catalogue peut être injoignable sans que l'éditeur cesse de fonctionner : les listes
      // restent vides et le bloc se règle à la main.
      return NextResponse.json({ error: facettes.error }, { status: facettes.status })
    }

    return NextResponse.json(facettes.data)
  } catch (error) {
    console.error('Erreur facettes catalogue:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
