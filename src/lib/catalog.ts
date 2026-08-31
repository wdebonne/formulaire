// Catalogue externe : la liste des articles et la quantité encore disponible à une date.
//
// Un bloc de choix peut tirer ses options d'une application de gestion de matériel plutôt que
// d'une liste saisie à la main. La liste saisie à la main vieillit : un matériel vendu, une
// tente déchirée, dix tables achetées, et le formulaire propose encore l'ancien parc. La date
// répondue plus haut dans le formulaire décide de ce qui est disponible — demander « 20 tables »
// n'a de sens que rapporté à un jour donné.
//
// Ce module ne contient que du calcul : la route /api/catalog/availability l'utilise côté serveur
// pour lire la configuration d'un bloc, le formulaire public côté navigateur pour injecter les
// options reçues. Rien ici ne connaît ni l'URL ni le jeton du catalogue, qui ne quittent jamais
// le serveur.

import type { BlockChoice, FormBlock } from '@/types/form'

export interface CatalogItem {
  id: number
  name: string
  category: string
  unit: string
  /** Quantité encore libre sur la période demandée, engagements déjà pris déduits. */
  available: number
  total: number
}

export type CatalogStatus = 'no-date' | 'loading' | 'ready' | 'error'

export interface CatalogState {
  status: CatalogStatus
  items: CatalogItem[]
  message?: string
}

export interface CatalogPeriod {
  from: string
  to: string
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Un bloc dont les options viennent du catalogue plutôt que de la liste saisie. */
export function isCatalogBlock(block: FormBlock): boolean {
  return block.type === 'multiple-choice' && block.attributes.choicesSource === 'catalog'
}

/** Parcourt les blocs de premier niveau et les blocs internes des groupes et répéteurs. */
export function flattenBlocks(blocks: FormBlock[]): FormBlock[] {
  const plat: FormBlock[] = []
  for (const block of blocks) {
    plat.push(block)
    if (block.innerBlocks?.length) plat.push(...flattenBlocks(block.innerBlocks))
  }
  return plat
}

// Une réponse de date est soit 'AAAA-MM-JJ', soit { start, end } pour un bloc de plage. Les deux
// formes circulent : le bloc « Date » simple rend une chaîne, la date avancée en mode plage rend
// un objet. Une valeur inattendue vaut date absente — jamais une date inventée.
function lireDate(reponse: unknown, bout: 'start' | 'end'): string | null {
  if (typeof reponse === 'string') {
    const jour = reponse.slice(0, 10)
    return ISO_DATE.test(jour) ? jour : null
  }
  if (reponse && typeof reponse === 'object') {
    const valeur = (reponse as Record<string, unknown>)[bout]
    if (typeof valeur === 'string') {
      const jour = valeur.slice(0, 10)
      return ISO_DATE.test(jour) ? jour : null
    }
  }
  return null
}

/**
 * Période à interroger pour ce bloc, d'après les dates déjà répondues.
 *
 * `null` tant que la date n'est pas renseignée : le bloc affiche alors qu'il attend la date, ce
 * qui vaut mieux qu'une liste calculée sur aujourd'hui et fausse pour la manifestation demandée.
 */
export function catalogPeriod(
  block: FormBlock,
  answers: Record<string, unknown>
): CatalogPeriod | null {
  const debutId = block.attributes.catalogDateBlockId
  if (!debutId) return null

  const reponseDebut = answers[debutId]
  const from = lireDate(reponseDebut, 'start')
  if (!from) return null

  const finId = block.attributes.catalogEndDateBlockId
  // La fin peut venir d'un second bloc, ou du même bloc s'il porte une plage.
  const fin = finId ? lireDate(answers[finId], 'start') : lireDate(reponseDebut, 'end')

  return { from, to: fin && fin >= from ? fin : from }
}

/** Deux blocs sur la même période partagent la réponse : la clé sert de cache. */
export function catalogCacheKey(blockId: string, periode: CatalogPeriod): string {
  return `${blockId}|${periode.from}|${periode.to}`
}

/** Le libellé peut annoncer le disponible ; la valeur reste le nom exact de l'article. */
export function catalogChoices(items: CatalogItem[], block: FormBlock): BlockChoice[] {
  const afficherRestant = block.attributes.catalogShowRemaining !== false
  return items.map((item) => ({
    id: String(item.id),
    label: afficherRestant
      ? `${item.name} — ${item.available} ${item.unit || 'disponible(s)'}`
      : item.name,
    // La valeur voyage jusqu'au webhook : c'est elle que l'application de gestion rapprochera de
    // son stock, par le nom. La décorer du reste disponible casserait ce rapprochement.
    value: item.name,
  }))
}

/** Plafonds du bloc quantité : un par article, à la hauteur de ce qui reste. */
export function catalogQuantityItems(
  items: CatalogItem[]
): NonNullable<FormBlock['attributes']['quantityItems']> {
  return items.map((item) => ({
    choiceId: String(item.id),
    choiceLabel: item.name,
    choiceValue: item.name,
    min: 1,
    max: Math.max(0, item.available),
  }))
}

/**
 * Recopie les blocs en y injectant ce que le catalogue a rendu.
 *
 * Passer par les attributs plutôt que par un rendu dédié fait profiter tout l'existant sans le
 * réécrire : la logique conditionnelle, la validation, le bloc quantité et les trois chemins
 * d'affichage lisent déjà `choices` et `quantityItems`.
 *
 * Le tableau d'origine est rendu tel quel s'il n'y a rien à injecter : le formulaire public
 * recalcule ses blocs visibles à chaque changement d'identité de ce tableau, et en fabriquer un
 * nouveau à chaque frappe le ferait tourner en boucle.
 */
export function resolveCatalogBlocks(
  blocks: FormBlock[],
  etats: Map<string, CatalogState>
): FormBlock[] {
  if (etats.size === 0) return blocks

  const resoudre = (liste: FormBlock[], portee: FormBlock[]): FormBlock[] =>
    liste.map((block) => {
      const interieurs = block.innerBlocks?.length
        ? resoudre(block.innerBlocks, block.innerBlocks)
        : block.innerBlocks

      if (isCatalogBlock(block)) {
        const etat = etats.get(block.id)
        if (!etat) return block
        return {
          ...block,
          attributes: {
            ...block.attributes,
            choices: catalogChoices(etat.items, block),
            catalogState: etat.status,
            catalogMessage: etat.message,
          },
          innerBlocks: interieurs,
        }
      }

      if (block.type === 'quantity' && block.attributes.quantityMaxFromCatalog !== false) {
        const sourceId = block.attributes.quantitySourceBlockId
        const etat = sourceId ? etats.get(sourceId) : undefined
        // La source est bien un bloc catalogue : ses plafonds priment sur ceux saisis à la main,
        // qui n'existent de toute façon pas pour une liste que l'auteur n'a jamais vue.
        const source = sourceId
          ? portee.find((b) => b.id === sourceId) ?? flattenBlocks(blocks).find((b) => b.id === sourceId)
          : undefined
        if (etat && source && isCatalogBlock(source)) {
          return {
            ...block,
            attributes: { ...block.attributes, quantityItems: catalogQuantityItems(etat.items) },
            innerBlocks: interieurs,
          }
        }
      }

      return interieurs === block.innerBlocks ? block : { ...block, innerBlocks: interieurs }
    })

  return resoudre(blocks, blocks)
}

/**
 * Traduit la réponse de l'application de gestion en articles de catalogue.
 *
 * Les noms de champs sont ceux de `/api/manifestations/stock/availability` : `quantity_available`
 * y vaut le total moins ce qui est déjà engagé, réel comme prévisionnel, sur la période demandée.
 * Un disponible négatif — du matériel promis deux fois — est ramené à zéro : il n'y a rien à
 * proposer, et un nombre négatif dans un formulaire ne veut rien dire pour le répondant.
 */
export function catalogItemsFromStock(
  brut: unknown,
  options: { category?: string; hideUnavailable?: boolean } = {}
): CatalogItem[] {
  const lignes = Array.isArray(brut) ? brut : []
  const categorie = (options.category || '').trim().toLowerCase()
  const masquer = options.hideUnavailable !== false

  return lignes
    .map((article: any) => ({
      id: Number(article?.id),
      name: String(article?.name ?? '').trim(),
      category: String(article?.category_name ?? article?.category ?? '').trim(),
      unit: String(article?.unit ?? '').trim(),
      available: Math.max(0, Number(article?.quantity_available ?? 0) || 0),
      total: Math.max(0, Number(article?.quantity_total ?? 0) || 0),
    }))
    .filter((item) => item.name.length > 0)
    .filter((item) => !categorie || item.category.toLowerCase() === categorie)
    .filter((item) => !masquer || item.available > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
