import { describe, expect, it } from 'vitest'
import {
  complementKey,
  isComplementMode,
  mergeChoiceComplements,
  otherOptionLabel,
  stripChoiceComplement,
} from '@/lib/choice-other'
import { resolveDataLabels } from '@/lib/response-format'

const R = '0f8e2a4c-0000-4000-8000-000000000001'
const Q = '0f8e2a4c-0000-4000-8000-000000000002'

const complementAttrs = {
  allowOtherOption: true,
  otherOptionMode: 'complement' as const,
  otherOptionLabel: 'Commentaire',
  choices: [
    { id: 'c1', label: 'Oui', value: 'oui' },
    { id: 'c2', label: 'Non', value: 'non' },
  ],
}

const blocks = [
  { id: 'avis', type: 'multiple-choice', attributes: complementAttrs },
  { id: 'autre', type: 'multiple-choice', attributes: { allowOtherOption: true, choices: [] } },
  { id: R, type: 'repeater', attributes: {}, innerBlocks: [{ id: Q, type: 'multiple-choice', attributes: complementAttrs }] },
]

describe('otherOptionLabel', () => {
  it('falls back to « Autre » when the label is missing or blank', () => {
    expect(otherOptionLabel({})).toBe('Autre')
    expect(otherOptionLabel({ otherOptionLabel: '   ' })).toBe('Autre')
    expect(otherOptionLabel({ otherOptionLabel: 'Votre avis' })).toBe('Votre avis')
  })
})

describe('isComplementMode', () => {
  it('requires the option to be enabled — a stale mode on a disabled option does nothing', () => {
    expect(isComplementMode({ otherOptionMode: 'complement' })).toBe(false)
    expect(isComplementMode({ allowOtherOption: true })).toBe(false)
    expect(isComplementMode({ allowOtherOption: true, otherOptionMode: 'complement' })).toBe(true)
  })
})

describe('mergeChoiceComplements', () => {
  it('adds the complement to a single choice without the choice itself being altered', () => {
    const merged = mergeChoiceComplements({ avis: 'oui', [complementKey('avis')]: ' Très bien ' }, blocks)
    expect(merged).toEqual({ avis: ['oui', '__other__:Commentaire : Très bien'] })
    // La même normalisation qu'à la soumission : le lecteur voit le libellé, puis le complément.
    expect(resolveDataLabels(merged, blocks).avis).toBe('Oui, Commentaire : Très bien')
  })

  it('keeps a complement even when no choice was made', () => {
    expect(mergeChoiceComplements({ [complementKey('avis')]: 'Rien à ajouter' }, blocks)).toEqual({
      avis: ['__other__:Commentaire : Rien à ajouter'],
    })
  })

  it('drops an empty complement and never leaves the working key in the submitted data', () => {
    expect(mergeChoiceComplements({ avis: 'non', [complementKey('avis')]: '  ' }, blocks)).toEqual({ avis: 'non' })
  })

  it('resolves repeater keys to their inner block', () => {
    const key = `${R}_2_${Q}`
    expect(mergeChoiceComplements({ [key]: 'non', [complementKey(key)]: 'Cassé' }, blocks)).toEqual({
      [key]: ['non', '__other__:Commentaire : Cassé'],
    })
  })

  it('ignores a complement whose block is no longer in complement mode', () => {
    expect(mergeChoiceComplements({ autre: 'x', [complementKey('autre')]: 'orphelin' }, blocks)).toEqual({ autre: 'x' })
  })
})

describe('stripChoiceComplement', () => {
  it('removes the resolved complement, commas inside the comment included', () => {
    expect(stripChoiceComplement('Oui, Commentaire : bien, mais lent', complementAttrs)).toBe('Oui')
    expect(stripChoiceComplement('Commentaire : seul', complementAttrs)).toBe('')
  })

  it('removes the raw complement from an unresolved array', () => {
    expect(stripChoiceComplement(['oui', '__other__:Commentaire : ok'], complementAttrs)).toEqual(['oui'])
  })

  it('leaves answers of a block in choice mode untouched', () => {
    expect(stripChoiceComplement('Oui, Commentaire : x', { allowOtherOption: true })).toBe('Oui, Commentaire : x')
  })
})
