import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  ISO_DATE,
  catalogFilterParams,
  catalogItemsFromStock,
  flattenBlocks,
  isCatalogBlock,
} from '@/lib/catalog'
import type { FormBlock } from '@/types/form'

// GET /api/catalog/availability - Articles et quantités disponibles sur une période.
//
// Le formulaire public ne parle jamais à l'application de gestion : c'est ce relais qui s'en
// charge, avec un jeton qui ne quitte pas le serveur. Un jeton posé dans le navigateur serait
// lisible par n'importe quel répondant, et donnerait accès à bien plus que la liste du matériel.
//
// La requête est bornée à un bloc précis d'un formulaire précis : sans cela, la route serait un
// relais ouvert vers l'application de gestion pour qui devine son adresse. C'est aussi ce qui
// permet de lire le filtre de catégorie dans le formulaire enregistré plutôt que de le recevoir
// du navigateur, où il serait modifiable.

export const dynamic = 'force-dynamic'

const DELAI_CATALOGUE_MS = 10_000

function trouverBloc(blocks: FormBlock[], blockId: string): FormBlock | undefined {
  return flattenBlocks(blocks).find((b) => b.id === blockId)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const formRef = (searchParams.get('form') || '').trim()
    const blockId = (searchParams.get('block') || '').trim()
    const dateFrom = (searchParams.get('date_from') || '').trim()
    const dateTo = (searchParams.get('date_to') || '').trim() || dateFrom

    if (!formRef || !blockId) {
      return NextResponse.json({ error: 'Formulaire et bloc requis' }, { status: 400 })
    }
    if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo) || dateTo < dateFrom) {
      return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
    }

    const form = await prisma.form.findFirst({
      where: { deletedAt: null, OR: [{ id: formRef }, { slug: formRef }] },
      select: { blocks: true },
    })
    if (!form) {
      return NextResponse.json({ error: 'Formulaire introuvable' }, { status: 404 })
    }

    let blocks: FormBlock[] = []
    try {
      blocks = JSON.parse(form.blocks || '[]')
    } catch {
      blocks = []
    }

    const block = trouverBloc(blocks, blockId)
    if (!block || !isCatalogBlock(block)) {
      return NextResponse.json({ error: 'Ce bloc ne lit pas le catalogue' }, { status: 404 })
    }

    const base = (process.env.CATALOG_API_URL || '').replace(/\/+$/, '')
    const jeton = process.env.CATALOG_API_TOKEN || ''
    if (!base || !jeton) {
      // 503 et non 500 : ce n'est pas une panne, c'est une configuration absente, et le message
      // doit dire quoi renseigner plutôt que d'envoyer chercher dans les journaux.
      return NextResponse.json(
        { error: 'Catalogue non configuré (CATALOG_API_URL et CATALOG_API_TOKEN)' },
        { status: 503 }
      )
    }

    // Le périmètre réglé sur le bloc — service, nature, catégorie — part avec la demande : c'est
    // l'application de gestion qui sait quel article relève de quel service.
    const parametres = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      ...catalogFilterParams(block),
    })
    const url = `${base}/api/manifestations/stock/availability?${parametres.toString()}`

    let reponse: Response
    try {
      reponse = await fetch(url, {
        headers: { 'X-API-Token': jeton, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(DELAI_CATALOGUE_MS),
      })
    } catch {
      return NextResponse.json({ error: 'Catalogue injoignable' }, { status: 502 })
    }

    if (!reponse.ok) {
      // Le corps de la réponse amont peut contenir n'importe quoi : seul le code est relayé, et le
      // 401 est nommé parce que c'est la panne la plus probable — un jeton expiré ou révoqué.
      const detail = reponse.status === 401 || reponse.status === 403 ? ' (jeton refusé)' : ''
      return NextResponse.json(
        { error: `Le catalogue a répondu ${reponse.status}${detail}` },
        { status: 502 }
      )
    }

    const corps = await reponse.json().catch(() => null)

    const items = catalogItemsFromStock(corps?.data, {
      hideUnavailable: block.attributes.catalogHideUnavailable,
    })

    return NextResponse.json({ items, periode: { from: dateFrom, to: dateTo } })
  } catch (error) {
    console.error('Erreur catalogue:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
