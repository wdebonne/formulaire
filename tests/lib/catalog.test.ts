import { describe, expect, it } from 'vitest'
import {
  catalogCacheKey,
  catalogChoices,
  catalogFilterParams,
  catalogItems,
  catalogPeriod,
  catalogQuantityItems,
  flattenBlocks,
  isCatalogBlock,
  resolveCatalogBlocks,
} from '@/lib/catalog'
import type { CatalogItem, CatalogState } from '@/lib/catalog'
import type { FormBlock } from '@/types/form'

const block = (over: Partial<FormBlock> & { id: string }): FormBlock =>
  ({ type: 'multiple-choice', attributes: {}, ...over } as FormBlock)

const catalogBlock = (over: Partial<FormBlock['attributes']> = {}) =>
  block({
    id: 'materiel',
    type: 'multiple-choice',
    attributes: { choicesSource: 'catalog', catalogDateBlockId: 'quand', ...over },
  })

const item = (over: Partial<CatalogItem> = {}): CatalogItem => ({
  ref: 'stock:1',
  id: 1,
  name: 'Tente',
  category: 'Abris',
  unit: 'disponible(s)',
  is_prestation: false,
  available: 3,
  total: 5,
  ...over,
})

describe('isCatalogBlock', () => {
  it('ne reconnaît que les deux types à options, et seulement en source catalogue', () => {
    expect(isCatalogBlock(catalogBlock())).toBe(true)
    expect(isCatalogBlock(block({ id: 'd', type: 'dropdown', attributes: { choicesSource: 'catalog' } }))).toBe(true)
    expect(isCatalogBlock(block({ id: 'm', type: 'multiple-choice', attributes: {} }))).toBe(false)
    expect(isCatalogBlock(block({ id: 't', type: 'short-text', attributes: { choicesSource: 'catalog' } }))).toBe(false)
  })
})

describe('flattenBlocks', () => {
  it('descend dans les groupes et les répéteurs', () => {
    const tree = [
      block({ id: 'a' }),
      block({
        id: 'grp',
        type: 'group',
        innerBlocks: [block({ id: 'inner' }), block({ id: 'rep', type: 'repeater', innerBlocks: [block({ id: 'deep' })] })],
      }),
    ]
    expect(flattenBlocks(tree).map((b) => b.id)).toEqual(['a', 'grp', 'inner', 'rep', 'deep'])
  })
})

describe('catalogPeriod', () => {
  // Tant que la date n'est pas répondue, aucune période : mieux vaut annoncer qu'on l'attend que
  // de proposer le stock d'aujourd'hui pour une manifestation dans six mois.
  it('rend null tant que la date n’est pas renseignée', () => {
    expect(catalogPeriod(catalogBlock(), {})).toBeNull()
    expect(catalogPeriod(catalogBlock(), { quand: '' })).toBeNull()
    expect(catalogPeriod(catalogBlock({ catalogDateBlockId: undefined }), { quand: '2026-08-12' })).toBeNull()
  })

  it('rend une période d’un jour sur une date simple', () => {
    expect(catalogPeriod(catalogBlock(), { quand: '2026-08-12' })).toEqual({ from: '2026-08-12', to: '2026-08-12' })
  })

  it('lit les deux bornes d’un bloc de plage', () => {
    expect(catalogPeriod(catalogBlock(), { quand: { start: '2026-08-12', end: '2026-08-15' } })).toEqual({
      from: '2026-08-12',
      to: '2026-08-15',
    })
  })

  it('lit la borne de fin depuis un second bloc', () => {
    const b = catalogBlock({ catalogEndDateBlockId: 'jusqua' })
    expect(catalogPeriod(b, { quand: '2026-08-12', jusqua: '2026-08-15' })).toEqual({
      from: '2026-08-12',
      to: '2026-08-15',
    })
  })

  // Une fin antérieure au début n'a pas de sens : la période se replie sur le début.
  it('ignore une fin antérieure au début', () => {
    expect(catalogPeriod(catalogBlock(), { quand: { start: '2026-08-12', end: '2026-08-01' } })).toEqual({
      from: '2026-08-12',
      to: '2026-08-12',
    })
  })

  it('rejette une date qui n’est pas au format ISO', () => {
    expect(catalogPeriod(catalogBlock(), { quand: '12/08/2026' })).toBeNull()
    expect(catalogPeriod(catalogBlock(), { quand: 42 })).toBeNull()
  })

  it('tolère un horodatage complet en n’en gardant que le jour', () => {
    expect(catalogPeriod(catalogBlock(), { quand: '2026-08-12T10:00:00Z' })?.from).toBe('2026-08-12')
  })
})

describe('catalogCacheKey', () => {
  it('distingue deux blocs et deux périodes', () => {
    const p = { from: '2026-08-12', to: '2026-08-15' }
    expect(catalogCacheKey('a', p)).not.toBe(catalogCacheKey('b', p))
    expect(catalogCacheKey('a', p)).not.toBe(catalogCacheKey('a', { from: '2026-08-12', to: '2026-08-12' }))
  })
})

describe('catalogChoices', () => {
  // La valeur voyage jusqu'au webhook : l'application de gestion la rapproche de son parc par le
  // nom. La décorer du reste disponible casserait ce rapprochement.
  it('garde le nom exact en valeur et n’orne que le libellé', () => {
    const [choice] = catalogChoices([item()], catalogBlock())
    expect(choice.value).toBe('Tente')
    expect(choice.label).toBe('Tente — 3 disponible(s)')
  })

  it('n’affiche pas le restant quand le bloc le désactive', () => {
    const [choice] = catalogChoices([item()], catalogBlock({ catalogShowRemaining: false }))
    expect(choice.label).toBe('Tente')
  })

  it('n’affiche pas de restant pour une prestation, qui n’en a pas', () => {
    const [choice] = catalogChoices([item({ available: null, is_prestation: true })], catalogBlock())
    expect(choice.label).toBe('Tente')
  })

  // La référence, pas l'identifiant : les deux tables de l'application numérotent chacune à
  // partir de un, et deux homonymes de sources différentes se confondraient.
  it('identifie l’option par la référence', () => {
    expect(catalogChoices([item({ ref: 'parc:1', id: 1 })], catalogBlock())[0].id).toBe('parc:1')
  })
})

describe('catalogQuantityItems', () => {
  it('plafonne à ce qui reste', () => {
    expect(catalogQuantityItems([item({ available: 3 })])[0]).toMatchObject({ min: 1, max: 3, choiceValue: 'Tente' })
  })

  // Un zéro interdirait de demander ce que le formulaire vient de proposer.
  it('laisse une prestation sans plafond', () => {
    expect(catalogQuantityItems([item({ available: null })])[0].max).toBeUndefined()
  })

  it('ramène un reste négatif à zéro', () => {
    expect(catalogQuantityItems([item({ available: -2 })])[0].max).toBe(0)
  })
})

describe('catalogItems', () => {
  const raw = [
    { id: 1, ref: 'stock:1', name: 'Table', quantity_available: 10, quantity_total: 12, unit: 'u' },
    { id: 2, ref: 'stock:2', name: 'Chaise', quantity_available: 0, quantity_total: 300 },
    { id: 3, ref: 'parc:3', name: 'Sonorisation', quantity_available: null, is_prestation: true },
    { id: 4, name: '   ', quantity_available: 5 },
  ]

  it('trie par nom et écarte les lignes sans nom', () => {
    expect(catalogItems(raw).map((i) => i.name)).toEqual(['Sonorisation', 'Table'])
  })

  // « Masquer ce qui n'est plus disponible » ne vise que ce qui se compte : une prestation sans
  // limite disparaîtrait de tous les formulaires cochant cette case.
  it('masque le stock épuisé mais jamais une prestation', () => {
    const noms = catalogItems(raw).map((i) => i.name)
    expect(noms).not.toContain('Chaise')
    expect(noms).toContain('Sonorisation')
  })

  it('garde le stock épuisé quand on le demande', () => {
    expect(catalogItems(raw, { hideUnavailable: false }).map((i) => i.name)).toContain('Chaise')
  })

  it('compose une référence quand l’application n’en fournit pas', () => {
    expect(catalogItems([{ id: 7, name: 'Barnum', source: 'parc', quantity_available: 1 }])[0].ref).toBe('parc:7')
  })

  it('rend une liste vide sur une réponse qui n’est pas un tableau', () => {
    expect(catalogItems(null)).toEqual([])
    expect(catalogItems({ erreur: 'nope' })).toEqual([])
  })

  it('ramène une quantité illisible à zéro et une absente à « sans limite »', () => {
    const [ill] = catalogItems([{ id: 1, name: 'X', quantity_available: 'beaucoup' }], { hideUnavailable: false })
    expect(ill.available).toBe(0)
    const [abs] = catalogItems([{ id: 2, name: 'Y' }])
    expect(abs.available).toBeNull()
  })
})

describe('catalogFilterParams', () => {
  it('ne transmet que les filtres renseignés', () => {
    expect(catalogFilterParams(catalogBlock())).toEqual({})
    expect(catalogFilterParams(catalogBlock({ catalogService: '  Urbanisme  ' }))).toEqual({ service: 'Urbanisme' })
    expect(catalogFilterParams(catalogBlock({ catalogCategoryId: 4 }))).toEqual({ category_id: '4' })
  })

  it('n’accepte que les deux natures connues', () => {
    expect(catalogFilterParams(catalogBlock({ catalogKind: 'prestation' }))).toEqual({ kind: 'prestation' })
    expect(catalogFilterParams(catalogBlock({ catalogKind: 'materiel' }))).toEqual({ kind: 'materiel' })
    expect(catalogFilterParams(catalogBlock({ catalogKind: 'nimporte-quoi' as any }))).toEqual({})
  })
})

describe('resolveCatalogBlocks', () => {
  const ready = (items: CatalogItem[]): CatalogState => ({ status: 'ready', items })

  // Le formulaire public recalcule ses blocs visibles à chaque changement d'identité du tableau :
  // en fabriquer un nouveau à chaque frappe le ferait tourner en boucle.
  it('rend le tableau d’origine quand il n’y a rien à injecter', () => {
    const blocks = [catalogBlock()]
    expect(resolveCatalogBlocks(blocks, new Map())).toBe(blocks)
  })

  it('injecte les options et l’état sur le bloc catalogue', () => {
    const blocks = [catalogBlock()]
    const [resolved] = resolveCatalogBlocks(blocks, new Map([['materiel', ready([item()])]]))
    expect(resolved.attributes.choices?.map((c) => c.value)).toEqual(['Tente'])
    expect(resolved.attributes.catalogState).toBe('ready')
  })

  it('laisse intact un bloc catalogue dont aucun état n’est encore connu', () => {
    const blocks = [catalogBlock(), block({ id: 'autre', type: 'short-text' })]
    const resolved = resolveCatalogBlocks(blocks, new Map([['inconnu', ready([item()])]]))
    expect(resolved[0]).toBe(blocks[0])
    expect(resolved[1]).toBe(blocks[1])
  })

  it('reporte les plafonds sur le bloc quantité qui s’y adosse', () => {
    const blocks = [
      catalogBlock(),
      block({ id: 'qte', type: 'quantity', attributes: { quantitySourceBlockId: 'materiel' } }),
    ]
    const resolved = resolveCatalogBlocks(blocks, new Map([['materiel', ready([item({ available: 3 })])]]))
    expect(resolved[1].attributes.quantityItems?.[0]).toMatchObject({ choiceValue: 'Tente', max: 3 })
  })

  it('respecte le refus explicite de plafonner depuis le catalogue', () => {
    const blocks = [
      catalogBlock(),
      block({
        id: 'qte',
        type: 'quantity',
        attributes: { quantitySourceBlockId: 'materiel', quantityMaxFromCatalog: false },
      }),
    ]
    const resolved = resolveCatalogBlocks(blocks, new Map([['materiel', ready([item()])]]))
    expect(resolved[1].attributes.quantityItems).toBeUndefined()
  })

  it('résout aussi les blocs internes d’un groupe', () => {
    const blocks = [block({ id: 'grp', type: 'group', innerBlocks: [catalogBlock()] })]
    const resolved = resolveCatalogBlocks(blocks, new Map([['materiel', ready([item()])]]))
    expect(resolved[0].innerBlocks?.[0].attributes.choices?.[0].value).toBe('Tente')
  })
})
