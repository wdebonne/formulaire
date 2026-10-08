import { describe, expect, it } from 'vitest'
import {
  hasMultiDateOption,
  isMultiDateActive,
  normalizeMultiDateAnswers,
  toDateList,
} from '@/lib/multi-date'
import { formatBlockValue, resolveDataLabels } from '@/lib/response-format'
import { buildWebhookPayload } from '@/lib/webhook-send'

const R = '0f8e2a4c-0000-4000-8000-000000000001'
const Q = '0f8e2a4c-0000-4000-8000-000000000002'
const D = '0f8e2a4c-0000-4000-8000-000000000003'

const conditional = (blockId: string, value: string) => ({
  multiDateMode: 'conditional' as const,
  multiDateConditionBlockId: blockId,
  multiDateConditionValue: value,
})

const blocks: any[] = [
  { id: 'recurrent', type: 'yes-no', attributes: {} },
  {
    id: 'frequence',
    type: 'multiple-choice',
    attributes: {
      choices: [
        { id: 'c1', label: 'Hebdomadaire', value: 'hebdomadaire' },
        { id: 'c2', label: 'Ponctuel', value: 'ponctuel' },
      ],
    },
  },
  { id: 'quand', type: 'advanced-date', attributes: { format: 'DD/MM/YYYY', ...conditional('recurrent', 'yes') } },
  { id: 'toujours', type: 'advanced-date', attributes: { multiDateMode: 'always' } },
  {
    id: R,
    type: 'repeater',
    attributes: {},
    innerBlocks: [
      { id: Q, type: 'yes-no', attributes: {} },
      { id: D, type: 'advanced-date', attributes: conditional(Q, 'yes') },
    ],
  },
]

describe('isMultiDateActive', () => {
  it('stays a single date when the option is absent — forms saved before the feature are unchanged', () => {
    expect(isMultiDateActive({ attributes: {} }, {}, blocks)).toBe(false)
    expect(hasMultiDateOption({})).toBe(false)
  })

  it('is always on in « always » mode, whatever was answered', () => {
    expect(isMultiDateActive(blocks[3], {}, blocks)).toBe(true)
  })

  it('follows the earlier answer in conditional mode', () => {
    expect(isMultiDateActive(blocks[2], { recurrent: 'yes' }, blocks)).toBe(true)
    expect(isMultiDateActive(blocks[2], { recurrent: 'no' }, blocks)).toBe(false)
  })

  // Avant que la question ne soit répondue, le calendrier ne doit pas basculer de lui-même.
  it('is off while the source question is unanswered', () => {
    expect(isMultiDateActive(blocks[2], {}, blocks)).toBe(false)
    expect(isMultiDateActive(blocks[2], { recurrent: '' }, blocks)).toBe(false)
  })

  it('ignores an incomplete condition instead of guessing', () => {
    const b = { attributes: { multiDateMode: 'conditional' as const, multiDateConditionBlockId: 'recurrent' } }
    expect(isMultiDateActive(b, { recurrent: 'yes' }, blocks)).toBe(false)
  })

  it('accepts a condition saved as a choice label as well as a slug', () => {
    const b = { attributes: conditional('frequence', 'Hebdomadaire') }
    expect(isMultiDateActive(b, { frequence: 'hebdomadaire' }, blocks)).toBe(true)
    expect(isMultiDateActive(b, { frequence: 'ponctuel' }, blocks)).toBe(false)
  })

  it('is on when a multiple-answer question includes the expected option', () => {
    const b = { attributes: conditional('frequence', 'hebdomadaire') }
    expect(isMultiDateActive(b, { frequence: ['ponctuel', 'hebdomadaire'] }, blocks)).toBe(true)
  })

  // Dans un répéteur, chaque itération a sa propre réponse « récurrent ? ».
  it('reads the source answer from the same repeater iteration', () => {
    const answers = { [`${R}_1_${Q}`]: 'yes', [`${R}_2_${Q}`]: 'no' }
    expect(isMultiDateActive(blocks[4].innerBlocks[1], answers, blocks, `${R}_1_${D}`)).toBe(true)
    expect(isMultiDateActive(blocks[4].innerBlocks[1], answers, blocks, `${R}_2_${D}`)).toBe(false)
  })
})

describe('toDateList', () => {
  it('sorts, deduplicates and drops anything that is not an ISO date', () => {
    expect(toDateList(['2026-10-17', '2026-10-03', '2026-10-03', 'pas une date'])).toEqual([
      '2026-10-03',
      '2026-10-17',
    ])
    expect(toDateList('2026-10-10, 2026-10-03')).toEqual(['2026-10-03', '2026-10-10'])
    expect(toDateList(undefined)).toEqual([])
  })
})

describe('normalizeMultiDateAnswers', () => {
  // Trois dates cochées, puis retour en arrière et « Non » : le formulaire n'affiche plus qu'une
  // date, il n'en envoie qu'une.
  it('keeps only the first date once the condition no longer holds', () => {
    const out = normalizeMultiDateAnswers({ recurrent: 'no', quand: ['2026-10-17', '2026-10-03'] }, blocks)
    expect(out.quand).toBe('2026-10-03')
  })

  it('keeps every date, sorted, while the condition holds', () => {
    const out = normalizeMultiDateAnswers({ recurrent: 'yes', quand: ['2026-10-17', '2026-10-03'] }, blocks)
    expect(out.quand).toEqual(['2026-10-03', '2026-10-17'])
  })

  it('applies per repeater iteration', () => {
    const out = normalizeMultiDateAnswers(
      {
        [`${R}_1_${Q}`]: 'yes',
        [`${R}_1_${D}`]: ['2026-10-03', '2026-10-10'],
        [`${R}_2_${Q}`]: 'no',
        [`${R}_2_${D}`]: ['2026-11-07', '2026-11-14'],
      },
      blocks
    )
    expect(out[`${R}_1_${D}`]).toEqual(['2026-10-03', '2026-10-10'])
    expect(out[`${R}_2_${D}`]).toBe('2026-11-07')
  })

  it('leaves other arrays alone — a multiple choice is not a list of dates', () => {
    const out = normalizeMultiDateAnswers({ frequence: ['ponctuel', 'hebdomadaire'] }, blocks)
    expect(out.frequence).toEqual(['ponctuel', 'hebdomadaire'])
  })
})

describe('formatting a list of dates', () => {
  it('joins the dates in the block format, like a multiple choice', () => {
    expect(formatBlockValue(blocks[2], ['2026-10-03', '2026-10-10'])).toBe('03/10/2026, 10/10/2026')
  })

  // La réponse est formatée à la soumission, puis de nouveau par chaque export et chaque jeton.
  it('is idempotent on the stored joined string', () => {
    const stored = resolveDataLabels({ quand: ['2026-10-03', '2026-10-10'] }, blocks).quand
    expect(formatBlockValue(blocks[2], stored)).toBe('03/10/2026, 10/10/2026')
  })

  // Une forme stable : le récepteur n'a pas à deviner, réponse par réponse, chaîne ou liste.
  it('sends an array in the webhook, even with a single date', () => {
    const form = { id: 'f', title: 'T', blocks: JSON.stringify(blocks) }
    const many = buildWebhookPayload({ id: 'w', url: 'x' }, { quand: '03/10/2026, 10/10/2026' }, form, 'r')
    const one = buildWebhookPayload({ id: 'w', url: 'x' }, { quand: '03/10/2026' }, form, 'r')
    expect(many.quand).toEqual(['03/10/2026', '10/10/2026'])
    expect(one.quand).toEqual(['03/10/2026'])
  })
})
