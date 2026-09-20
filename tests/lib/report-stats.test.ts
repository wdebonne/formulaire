import { describe, expect, it } from 'vitest'
import { collectQuestionFields, computeReportStats, resolveReportRange } from '@/lib/report-stats'
import type { ReportBlockInput, ReportResponseInput } from '@/lib/report-stats'
import { DEFAULT_REPORT_SETTINGS } from '@/lib/report-settings'
import type { FormReportSettings, ReportPeriod } from '@/types/form'

// Mêmes réglages de départ que l'écran Statistiques : il part des défauts et n'impose que la
// période. Repartir d'un objet écrit à la main ferait diverger les tests du produit.
const settings = (over: Partial<FormReportSettings> = {}): FormReportSettings => ({
  ...DEFAULT_REPORT_SETTINGS,
  period: { mode: 'all' },
  includeEmptyChoices: false,
  showAllTextAnswers: false,
  textSampleSize: 3,
  tableRowLimit: 10,
  ...over,
})

const period = (value: ReportPeriod): Partial<FormReportSettings> => ({ period: value })

const at = (iso: string) => new Date(`${iso}T12:00:00`)

let sequence = 0
const response = (createdAt: string, data: Record<string, any>): ReportResponseInput => ({
  id: `r${++sequence}`,
  createdAt: at(createdAt),
  data,
})

const stats = (blocks: ReportBlockInput[], responses: ReportResponseInput[], over: Partial<FormReportSettings> = {}) => {
  const conf = settings(over)
  return computeReportStats(blocks, responses, conf, resolveReportRange(conf, { now: at('2026-09-20') }))
}

describe('resolveReportRange', () => {
  const now = at('2026-09-20')

  it('n’a pas de borne basse sur « tout »', () => {
    const range = resolveReportRange(settings(period({ mode: 'all' })), { now })
    expect(range.from).toBeNull()
    expect(range.label).toMatch(/^jusqu'au 20\/09\/2026$/)
  })

  it('remonte de N jours', () => {
    const range = resolveReportRange(settings(period({ mode: 'last_days', days: 7 })), { now })
    expect(range.from?.getDate()).toBe(13)
    expect(range.label).toBe('du 13/09/2026 au 20/09/2026')
  })

  it('retombe sur 7 jours quand le nombre est absent ou absurde', () => {
    for (const days of [undefined, 0, -3]) {
      const range = resolveReportRange(settings(period({ mode: 'last_days', days })), { now })
      expect(range.from?.getDate()).toBe(13)
    }
  })

  it('cadre le mois en cours', () => {
    const range = resolveReportRange(settings(period({ mode: 'current_month' })), { now })
    expect(range.from?.getDate()).toBe(1)
    expect(range.from?.getMonth()).toBe(8)
  })

  it('cadre le mois précédent et s’arrête à son dernier instant', () => {
    const range = resolveReportRange(settings(period({ mode: 'previous_month' })), { now })
    expect(range.from?.getMonth()).toBe(7)
    expect(range.to.getMonth()).toBe(7)
    expect(range.to.getDate()).toBe(31)
  })

  it('lit une plage explicite', () => {
    const custom: ReportPeriod = { mode: 'custom', from: '2026-09-01', to: '2026-09-10' }
    const range = resolveReportRange(settings({ period: custom }), { now })
    expect(range.label).toBe('du 01/09/2026 au 10/09/2026')
  })

  it('repart du dernier envoi, à défaut de la création du formulaire', () => {
    const sinceLast: ReportPeriod = { mode: 'since_last_report' }
    expect(
      resolveReportRange(settings({ period: sinceLast }), { now, lastReportAt: '2026-09-15T00:00:00' })?.from?.getDate()
    ).toBe(15)
    expect(
      resolveReportRange(settings({ period: sinceLast }), { now, formCreatedAt: '2026-01-05T00:00:00' })?.from?.getMonth()
    ).toBe(0)
  })

  // Passé la date de clôture, tous les rapports décrivent le même corpus figé.
  it('plafonne toujours la borne haute à la date de clôture', () => {
    const range = resolveReportRange(
      settings({ period: { mode: 'all' }, closingDate: '2026-09-10' }),
      { now }
    )
    expect(range.to.getDate()).toBe(10)
    expect(range.label).toBe("jusqu'au 10/09/2026")
  })

  it('ne laisse pas la borne basse dépasser la borne haute', () => {
    const range = resolveReportRange(
      settings({ period: { mode: 'last_days', days: 7 }, closingDate: '2026-01-01' }),
      { now }
    )
    expect(range.from!.getTime()).toBeLessThanOrEqual(range.to.getTime())
  })
})

describe('collectQuestionFields', () => {
  it('écarte les écrans et énonciations, qui ne portent pas de réponse', () => {
    const fields = collectQuestionFields([
      { id: 'w', type: 'welcome-screen', attributes: {} },
      { id: 's', type: 'statement', attributes: {} },
      { id: 'q', type: 'short-text', attributes: { label: 'Nom' } },
    ])
    expect(fields.map((f) => f.blockId)).toEqual(['q'])
  })

  it('remonte les blocs internes d’un groupe avec le libellé du groupe', () => {
    const fields = collectQuestionFields([
      { id: 'grp', type: 'group', attributes: { label: 'Coordonnées' }, innerBlocks: [{ id: 'g1', type: 'email', attributes: { label: 'E-mail' } }] },
    ])
    expect(fields[0]).toMatchObject({ blockId: 'g1', parentLabel: 'Coordonnées' })
  })

  it('marque les blocs d’un répéteur pour que leurs itérations soient agrégées', () => {
    const fields = collectQuestionFields([
      { id: 'rep', type: 'repeater', attributes: { label: 'Matériel' }, innerBlocks: [{ id: 'r1', type: 'short-text', attributes: { label: 'Lequel' } }] },
    ])
    expect(fields[0]).toMatchObject({ blockId: 'r1', repeaterId: 'rep' })
  })
})

describe('computeReportStats — totaux', () => {
  const blocks: ReportBlockInput[] = [{ id: 'nom', type: 'short-text', attributes: { label: 'Nom' } }]

  it('compte les réponses de la période et hors période', () => {
    const result = stats(
      blocks,
      [response('2026-09-18', { nom: 'A' }), response('2026-09-19', { nom: 'B' })],
      period({ mode: 'last_days', days: 7 })
    )
    expect(result.totals.inPeriod).toBe(2)
    expect(result.totals.allTime).toBe(2)
  })

  it('exclut ce qui tombe hors de la période', () => {
    const result = stats(
      blocks,
      [response('2026-01-01', { nom: 'A' }), response('2026-09-19', { nom: 'B' })],
      period({ mode: 'last_days', days: 7 })
    )
    expect(result.totals.inPeriod).toBe(1)
    expect(result.totals.allTime).toBe(2)
  })

  it('écarte une date illisible plutôt que de lever', () => {
    const result = stats(blocks, [{ id: 'r0', createdAt: 'pas une date', data: { nom: 'A' } }])
    expect(result.totals.allTime).toBe(0)
  })

  it('compare à la période équivalente précédente', () => {
    const result = stats(
      blocks,
      [
        response('2026-09-10', { nom: 'A' }), // dans les 7 jours qui précèdent la période
        response('2026-09-18', { nom: 'B' }),
        response('2026-09-19', { nom: 'C' }),
      ],
      period({ mode: 'last_days', days: 7 })
    )
    expect(result.totals.previousPeriod).toBe(1)
    expect(result.totals.deltaPercent).toBe(100)
  })

  it('ne calcule pas de variation sans borne basse', () => {
    expect(stats(blocks, [response('2026-09-19', { nom: 'A' })]).totals.previousPeriod).toBeNull()
  })

  it('désigne le jour le plus actif', () => {
    const result = stats(blocks, [
      response('2026-09-18', { nom: 'A' }),
      response('2026-09-19', { nom: 'B' }),
      response('2026-09-19', { nom: 'C' }),
    ])
    expect(result.totals.bestDay).toEqual({ label: '19/09/2026', count: 2 })
  })

  it('reste cohérent sans aucune réponse', () => {
    const result = stats(blocks, [])
    expect(result.totals.inPeriod).toBe(0)
    expect(result.totals.averageFillRate).toBe(0)
    expect(result.totals.bestDay).toBeNull()
    expect(result.tableRows).toEqual([])
  })
})

describe('computeReportStats — questions à choix', () => {
  const choiceBlock: ReportBlockInput = {
    id: 'service',
    type: 'multiple-choice',
    attributes: {
      label: 'Service',
      choices: [
        { id: 'c1', label: 'Matériel', value: 'materiel' },
        { id: 'c2', label: 'Salle', value: 'salle' },
        { id: 'c3', label: 'Écran, second', value: 'ecran-second' },
      ],
    },
  }

  // Les réponses antérieures à resolveDataLabels portent des slugs, les récentes des libellés :
  // une même option ne doit jamais être comptée deux fois selon la forme de stockage.
  it('ne compte pas deux fois une option stockée sous deux formes', () => {
    const result = stats(
      [choiceBlock],
      [
        response('2026-09-18', { service: 'materiel' }),
        response('2026-09-19', { service: 'Matériel' }),
        response('2026-09-19', { service: ['c1'] }),
      ]
    )
    const options = result.choices[0].options
    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ label: 'Matériel', count: 3, percent: 100 })
  })

  it('redécoupe une chaîne « A, B » en deux options', () => {
    const result = stats([choiceBlock], [response('2026-09-19', { service: 'Matériel, Salle' })])
    expect(result.choices[0].options.map((o) => o.label).sort()).toEqual(['Matériel', 'Salle'])
  })

  // Régression : découper naïvement sur la virgule inventerait deux options inexistantes.
  it('ne scinde pas un libellé qui contient une virgule', () => {
    const result = stats([choiceBlock], [response('2026-09-19', { service: 'Écran, second' })])
    expect(result.choices[0].options).toEqual([{ label: 'Écran, second', count: 1, percent: 100 }])
  })

  // Le cas que la reconstitution existe pour : la chaîne entière ne correspond à aucune option,
  // il faut recoller les fragments pour retrouver celle qui porte une virgule.
  it('reconstitue un libellé à virgule coché parmi d’autres options', () => {
    const result = stats([choiceBlock], [response('2026-09-19', { service: 'Matériel, Écran, second, Salle' })])
    const labels = result.choices[0].options.map((o) => o.label).sort()
    expect(labels).toEqual(['Matériel', 'Salle', 'Écran, second'])
  })

  it('range une saisie libre sous « Autre »', () => {
    const result = stats([choiceBlock], [response('2026-09-19', { service: '__other__:Cuisine' })])
    expect(result.choices[0].options[0].label).toBe('Autre : Cuisine')
  })

  it('n’affiche les options jamais choisies que si on le demande', () => {
    const withEmpty = stats([choiceBlock], [response('2026-09-19', { service: 'materiel' })], {
      includeEmptyChoices: true,
    })
    expect(withEmpty.choices[0].options).toHaveLength(3)
    const without = stats([choiceBlock], [response('2026-09-19', { service: 'materiel' })])
    expect(without.choices[0].options).toHaveLength(1)
  })

  it('normalise un Oui/Non quelle que soit son écriture', () => {
    const block: ReportBlockInput = { id: 'ok', type: 'yes-no', attributes: { label: 'Rappel' } }
    const result = stats(block ? [block] : [], [
      response('2026-09-18', { ok: 'yes' }),
      response('2026-09-19', { ok: 'Oui' }),
      response('2026-09-19', { ok: 'no' }),
    ])
    const options = Object.fromEntries(result.choices[0].options.map((o) => [o.label, o.count]))
    expect(options).toEqual({ Oui: 2, Non: 1 })
  })

  it('cumule les quantités au lieu de compter les réponses', () => {
    const block: ReportBlockInput = { id: 'qte', type: 'quantity', attributes: { label: 'Quantités' } }
    const result = stats([block], [
      response('2026-09-18', { qte: { Table: 2, Chaise: 10 } }),
      response('2026-09-19', { qte: { Table: 3 } }),
    ])
    const options = Object.fromEntries(result.choices[0].options.map((o) => [o.label, o.count]))
    expect(options).toEqual({ Chaise: 10, Table: 5 })
    expect(result.choices[0].unit).toBe('quantité cumulée')
  })
})

describe('computeReportStats — questions numériques', () => {
  const rating: ReportBlockInput = { id: 'note', type: 'slider', attributes: { label: 'Satisfaction', min: 1, max: 5 } }
  const amount: ReportBlockInput = { id: 'montant', type: 'number', attributes: { label: 'Montant' } }

  const notes = (values: number[]) => values.map((v, i) => response(`2026-09-${String(10 + i).padStart(2, '0')}`, { note: v }))

  it('calcule moyenne, médiane et bornes', () => {
    const result = stats([rating], notes([1, 2, 4, 5]))
    expect(result.numerics[0]).toMatchObject({ count: 4, min: 1, max: 5, average: 3, median: 3 })
  })

  // Seules les bornes déclarées sur la question rendent « 4,2 / 5 » lisible ; des bornes
  // simplement observées feraient dire « 1 250 / 1 800 » à une question de montant libre.
  it('ne retient une échelle que si la question la déclare', () => {
    expect(stats([rating], notes([1, 5])).numerics[0].scaleMax).toBe(5)
    const libre = stats([amount], [response('2026-09-19', { montant: 1250 }), response('2026-09-18', { montant: 1800 })])
    expect(libre.numerics[0].scaleMax).toBeUndefined()
  })

  it('garde les notes que personne n’a choisies dans la répartition', () => {
    const distribution = stats([rating], notes([1, 1, 5])).numerics[0].distribution
    expect(distribution?.map((d) => d.value)).toEqual([1, 2, 3, 4, 5])
    expect(distribution?.find((d) => d.value === 3)?.count).toBe(0)
  })

  it('élargit la répartition à une réponse hors échelle plutôt que de la perdre', () => {
    const distribution = stats([rating], notes([1, 7])).numerics[0].distribution
    expect(distribution?.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(distribution?.reduce((acc, d) => acc + d.percent, 0)).toBe(100)
  })

  it('renonce à la répartition au-delà d’une dizaine de crans', () => {
    const large: ReportBlockInput = { id: 'note', type: 'slider', attributes: { label: 'X', min: 0, max: 100 } }
    expect(stats([large], notes([0, 100])).numerics[0].distribution).toBeUndefined()
  })

  it('renonce à la répartition sur des valeurs décimales', () => {
    expect(stats([rating], notes([1.5, 2.5])).numerics[0].distribution).toBeUndefined()
  })

  it('accepte la virgule décimale française', () => {
    expect(stats([amount], [response('2026-09-19', { montant: '12,5' })]).numerics[0].average).toBe(12.5)
  })

  it('ignore une valeur qui n’est pas un nombre', () => {
    const result = stats([amount], [response('2026-09-19', { montant: 'beaucoup' }), response('2026-09-18', { montant: 10 })])
    expect(result.numerics[0].count).toBe(1)
  })
})

describe('computeReportStats — réponses libres', () => {
  const block: ReportBlockInput = { id: 'avis', type: 'long-text', attributes: { label: 'Votre avis' } }
  const avis = (values: string[]) =>
    values.map((v, i) => response(`2026-09-${String(10 + i).padStart(2, '0')}`, { avis: v }))

  // Sur du texte libre, un classement de valeurs uniques n'est qu'une liste arbitraire.
  it('ne classe que ce qui se répète', () => {
    const result = stats([block], avis(['Très bien', 'Très bien', 'Bof']))
    expect(result.freeform[0].top).toEqual([{ value: 'Très bien', count: 2 }])
  })

  it('déduplique l’échantillon, du plus récent au plus ancien', () => {
    const result = stats([block], avis(['A', 'B', 'B', 'C']), { textSampleSize: 3 })
    expect(result.freeform[0].samples).toEqual(['C', 'B', 'A'])
  })

  // « Toutes les réponses » est une intention différente : deux répondants qui écrivent la même
  // chose sont deux réponses.
  it('conserve les doublons en mode « toutes les réponses »', () => {
    const result = stats([block], avis(['A', 'B', 'B']), { showAllTextAnswers: true })
    expect(result.freeform[0].samples).toEqual(['B', 'B', 'A'])
    expect(result.freeform[0].total).toBe(3)
  })

  it('n’échantillonne rien quand la taille demandée est nulle', () => {
    expect(stats([block], avis(['A']), { textSampleSize: 0 }).freeform[0].samples).toEqual([])
  })
})

describe('computeReportStats — taux de remplissage', () => {
  const blocks: ReportBlockInput[] = [
    { id: 'nom', type: 'short-text', attributes: { label: 'Nom', required: true } },
    { id: 'avis', type: 'long-text', attributes: { label: 'Avis' } },
  ]

  it('compte une question laissée vide comme non remplie', () => {
    const result = stats(blocks, [
      response('2026-09-18', { nom: 'A', avis: 'Bien' }),
      response('2026-09-19', { nom: 'B', avis: '   ' }),
    ])
    const avis = result.completion.find((c) => c.blockId === 'avis')!
    expect(avis).toMatchObject({ answered: 1, rate: 50, required: false })
    expect(result.completion.find((c) => c.blockId === 'nom')).toMatchObject({ rate: 100, required: true })
  })

  it('traite un tableau et un objet vides comme non remplis', () => {
    const block: ReportBlockInput = { id: 'x', type: 'multiple-choice', attributes: { label: 'X', choices: [] } }
    const result = stats([block], [response('2026-09-18', { x: [] }), response('2026-09-19', { x: {} })])
    expect(result.completion[0].answered).toBe(0)
  })

  // Un même matériel demandé dans trois itérations compte pour trois.
  it('agrège toutes les itérations d’un répéteur', () => {
    const rep: ReportBlockInput = {
      id: 'rep',
      type: 'repeater',
      attributes: { label: 'Matériel' },
      innerBlocks: [{ id: 'quoi', type: 'dropdown', attributes: { label: 'Quoi', choices: [{ id: 'c1', label: 'Tente', value: 'tente' }] } }],
    }
    const result = stats([rep], [
      response('2026-09-19', { rep_1_quoi: 'tente', rep_2_quoi: 'tente', rep_3_quoi: 'tente' }),
    ])
    expect(result.choices[0].options[0]).toMatchObject({ label: 'Tente', count: 3 })
    expect(result.completion[0].answered).toBe(1)
  })
})

describe('computeReportStats — tableau des dernières réponses', () => {
  const blocks: ReportBlockInput[] = [
    { id: 'nom', type: 'short-text', attributes: { label: 'Nom' } },
    { id: 'service', type: 'dropdown', attributes: { label: 'Service', choices: [{ id: 'c1', label: 'Matériel', value: 'materiel' }] } },
  ]

  it('résout les libellés à l’affichage, sans réécrire ce qui est stocké', () => {
    const result = stats(blocks, [response('2026-09-19', { nom: 'Camille', service: 'materiel' })])
    expect(result.tableHeaders).toEqual(['Date', 'Nom', 'Service'])
    expect(result.tableRows[0]).toEqual(['19/09/2026 12:00', 'Camille', 'Matériel'])
  })

  it('présente les plus récentes d’abord et respecte la limite', () => {
    const result = stats(
      blocks,
      [response('2026-09-17', { nom: 'A' }), response('2026-09-18', { nom: 'B' }), response('2026-09-19', { nom: 'C' })],
      { tableRowLimit: 2 }
    )
    expect(result.tableRows.map((r) => r[1])).toEqual(['C', 'B'])
  })

  // Déplier la structure enverrait une data-URL base64 entière dans une cellule.
  it('rend une pièce jointe et une signature en texte lisible', () => {
    const withFiles: ReportBlockInput[] = [
      { id: 'f', type: 'file', attributes: { label: 'Pièce' } },
      { id: 's', type: 'signature', attributes: { label: 'Signature' } },
    ]
    const result = stats(withFiles, [
      response('2026-09-19', {
        f: { kind: 'file', name: 'contrat.pdf', size: 1258291 },
        s: { kind: 'signature', dataUrl: 'data:image/png;base64,AAAA', signedAt: '2026-09-19T10:00:00Z' },
      }),
    ])
    expect(result.tableRows[0]).toEqual(['19/09/2026 12:00', 'contrat.pdf (1,2 Mo)', 'Signé le 19/09/2026'])
  })

  it('n’analyse ni les pièces jointes ni les signatures', () => {
    const withFiles: ReportBlockInput[] = [{ id: 'f', type: 'file', attributes: { label: 'Pièce' } }]
    const result = stats(withFiles, [response('2026-09-19', { f: { kind: 'file', name: 'x.pdf', size: 10 } })])
    expect(result.choices).toEqual([])
    expect(result.freeform).toEqual([])
    expect(result.completion[0].answered).toBe(1)
  })
})

describe('computeReportStats — chronologie', () => {
  const blocks: ReportBlockInput[] = [{ id: 'nom', type: 'short-text', attributes: { label: 'Nom' } }]

  it('groupe par jour sur une courte période', () => {
    const result = stats(blocks, [response('2026-09-18', { nom: 'A' }), response('2026-09-19', { nom: 'B' })], {
      ...period({ mode: 'last_days', days: 7 }),
    })
    expect(result.timelineGranularity).toBe('day')
    expect(result.timeline).toEqual([
      { label: '18/09', count: 1 },
      { label: '19/09', count: 1 },
    ])
  })

  it('groupe par semaine puis par mois à mesure que la période s’allonge', () => {
    const responses = [response('2026-09-19', { nom: 'A' })]
    expect(stats(blocks, responses, period({ mode: 'last_days', days: 120 })).timelineGranularity).toBe('week')
    expect(stats(blocks, responses, period({ mode: 'last_days', days: 500 })).timelineGranularity).toBe('month')
  })
})
