import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// GET /api/catalog/facets - Services et catégories déclarés dans l'application de gestion.
//
// Sert les listes de l'éditeur : choisir « Urbanisme » dans une liste vaut mieux que le taper au
// clavier, où la faute de frappe ne se voit qu'au premier formulaire vide.
//
// Réservé aux comptes connectés — c'est un écran de conception, pas une page publique, et la liste
// des services d'une collectivité n'a pas à être servie à qui passe.

export const dynamic = 'force-dynamic'

const DELAI_MS = 10_000

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const base = (process.env.CATALOG_API_URL || '').replace(/\/+$/, '')
    const jeton = process.env.CATALOG_API_TOKEN || ''
    if (!base || !jeton) {
      return NextResponse.json(
        { error: 'Catalogue non configuré (CATALOG_API_URL et CATALOG_API_TOKEN)' },
        { status: 503 }
      )
    }

    const lire = async (chemin: string) => {
      const reponse = await fetch(`${base}${chemin}`, {
        headers: { 'X-API-Token': jeton, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(DELAI_MS),
      })
      if (!reponse.ok) throw new Error(`${chemin} a répondu ${reponse.status}`)
      return reponse.json()
    }

    const [services, categories] = await Promise.all([lire('/api/services'), lire('/api/categories')])

    return NextResponse.json({
      // Un service désactivé ne doit pas être proposé : le formulaire construit sur lui ne
      // proposerait plus rien, sans dire pourquoi.
      services: (Array.isArray(services?.data) ? services.data : [])
        .filter((service: any) => service?.is_active !== 0)
        .map((service: any) => ({
          id: service.id,
          name: String(service.name ?? ''),
          slug: String(service.slug ?? ''),
        }))
        .filter((service: any) => service.name && service.slug),
      categories: (Array.isArray(categories?.categories) ? categories.categories : [])
        .map((categorie: any) => ({ id: categorie.id, name: String(categorie.name ?? '') }))
        .filter((categorie: any) => categorie.name)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr')),
    })
  } catch (error: any) {
    // Le catalogue peut être injoignable sans que l'éditeur cesse de fonctionner : les listes
    // restent vides et le bloc se règle à la main.
    return NextResponse.json({ error: error?.message || 'Catalogue injoignable' }, { status: 502 })
  }
}
