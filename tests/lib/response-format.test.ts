import { describe, expect, it } from 'vitest'
import {
  answerToText,
  findBlockDeep,
  formatBlockValue,
  formatDateString,
  isStructuredAnswer,
  resolveDataLabels,
} from '@/lib/response-format'

const choiceBlock = {
  id: 'service',
  type: 'multiple-choice',
  attributes: {
    choices: [
      { id: 'c1', label: 'Service informatique', value: 'service-informatique' },
      { id: 'c2', label: 'Service technique', value: 'service-technique' },
    ],
  },
}

describe('findBlockDeep', () => {
  const blocks = [
    { id: 'top', type: 'short-text' },
    { id: 'grp', type: 'group', innerBlocks: [{ id: 'inner', type: 'email' }] },
  ]

  it('trouve un bloc de premier niveau', () => {
    expect(findBlockDeep(blocks, 'top')?.type).toBe('short-text')
  })

  it('trouve un bloc interne de groupe', () => {
    expect(findBlockDeep(blocks, 'inner')?.type).toBe('email')
  })

  it('rend undefined plutôt que de lever quand le bloc a disparu', () => {
    expect(findBlockDeep(blocks, 'supprime')).toBeUndefined()
  })
})

describe('formatDateString', () => {
  it('applique le format configuré', () => {
    expect(formatDateString('2026-08-12', 'DD/MM/YYYY')).toBe('12/08/2026')
    expect(formatDateString('2026-08-12', 'YYYY-MM-DD')).toBe('2026-08-12')
  })

  // Les jetons longs doivent être remplacés avant les courts, sinon YYYY consomme le YY.
  it('ne laisse pas YY manger YYYY', () => {
    expect(formatDateString('2026-08-12', 'DD/MM/YY')).toBe('12/08/26')
  })

  it('rend la valeur telle quelle si ce n’est pas une date ISO', () => {
    expect(formatDateString('pas une date', 'DD/MM/YYYY')).toBe('pas une date')
  })
})

describe('formatBlockValue', () => {
  it('résout un slug de choix en libellé', () => {
    expect(formatBlockValue(choiceBlock, 'service-technique')).toBe('Service technique')
  })

  it('joint les choix multiples par une virgule', () => {
    expect(formatBlockValue(choiceBlock, ['service-informatique', 'service-technique'])).toBe(
      'Service informatique, Service technique'
    )
  })

  it('retire le préfixe __other__ et garde la saisie libre', () => {
    expect(formatBlockValue(choiceBlock, '__other__:Cuisine')).toBe('Cuisine')
  })

  it('laisse la valeur brute quand le bloc a disparu du formulaire', () => {
    expect(formatBlockValue(undefined, 'service-technique')).toBe('service-technique')
  })

  // Régression : réduire une pièce jointe à son nom perdrait `storedName`, donc le fichier.
  it('recopie une pièce jointe intacte', () => {
    const file = { kind: 'file', name: 'contrat.pdf', size: 1258291, storedName: 'abc123.pdf' }
    expect(formatBlockValue({ id: 'f', type: 'file' }, file)).toEqual(file)
  })

  it('recopie une signature intacte', () => {
    const signature = { kind: 'signature', dataUrl: 'data:image/png;base64,AAAA', signedAt: '2026-09-20T10:00:00Z' }
    expect(formatBlockValue({ id: 's', type: 'signature' }, signature)).toEqual(signature)
  })

  it('est idempotent : une valeur déjà résolue ne change plus', () => {
    const once = formatBlockValue(choiceBlock, 'service-technique')
    expect(formatBlockValue(choiceBlock, once)).toBe(once)
  })

  describe('dates', () => {
    const dateBlock = { id: 'd', type: 'date', attributes: { format: 'DD/MM/YYYY' } }
    const rangeBlock = { id: 'r', type: 'advanced-date', attributes: { format: 'DD/MM/YYYY' } }

    it('formate une date simple', () => {
      expect(formatBlockValue(dateBlock, '2026-08-12')).toBe('12/08/2026')
    })

    it('formate une plage de dates', () => {
      expect(formatBlockValue(rangeBlock, { start: '2026-08-12', end: '2026-08-15' })).toBe(
        '12/08/2026 - 15/08/2026'
      )
    })

    it('rend la seule borne de début quand la fin manque', () => {
      expect(formatBlockValue(rangeBlock, { start: '2026-08-12' })).toBe('12/08/2026')
    })
  })

  describe('quantité', () => {
    const block = (outputFormat: string) => ({
      id: 'q',
      type: 'quantity',
      attributes: { quantityOutputFormat: outputFormat },
    })

    it('nettoie les clés __other__ en sortie objet', () => {
      expect(formatBlockValue(block('object'), { '__other__:Chaise': 4, Table: 2 })).toEqual({
        Chaise: 4,
        Table: 2,
      })
    })

    it('joint les quantités en sortie valeur', () => {
      expect(formatBlockValue(block('value'), { Table: 2, Chaise: 4 })).toBe('2, 4')
    })
  })
})

describe('answerToText', () => {
  it('décrit une pièce jointe avec sa taille', () => {
    expect(answerToText({ kind: 'file', name: 'contrat.pdf', size: 1258291 })).toBe('contrat.pdf (1,2 Mo)')
  })

  it('omet la taille quand elle est inconnue', () => {
    expect(answerToText({ kind: 'file', name: 'contrat.pdf', size: 0 })).toBe('contrat.pdf')
  })

  it('date une signature au format français', () => {
    expect(answerToText({ kind: 'signature', signedAt: '2026-09-20T10:00:00Z' })).toBe('Signé le 20/09/2026')
  })

  it('se contente de « Signé » sans horodatage exploitable', () => {
    expect(answerToText({ kind: 'signature' })).toBe('Signé')
  })

  it('rend une chaîne vide pour une absence de réponse', () => {
    expect(answerToText(null)).toBe('')
    expect(answerToText(undefined)).toBe('')
  })
})

describe('isStructuredAnswer', () => {
  it('reconnaît les deux structures marquées', () => {
    expect(isStructuredAnswer({ kind: 'file' })).toBe(true)
    expect(isStructuredAnswer({ kind: 'signature' })).toBe(true)
  })

  it('ignore un objet quelconque, comme une réponse de bloc quantité', () => {
    expect(isStructuredAnswer({ Table: 2 })).toBe(false)
    expect(isStructuredAnswer('texte')).toBe(false)
    expect(isStructuredAnswer(null)).toBe(false)
  })
})

describe('resolveDataLabels', () => {
  const blocks = [
    choiceBlock,
    { id: 'quand', type: 'date', attributes: { format: 'DD/MM/YYYY' } },
    {
      id: 'rep',
      type: 'repeater',
      innerBlocks: [{ id: 'materiel', type: 'dropdown', attributes: { choices: [{ id: 'm1', label: 'Tente', value: 'tente' }] } }],
    },
  ]

  it('résout les clés de premier niveau', () => {
    expect(resolveDataLabels({ service: 'service-technique', quand: '2026-08-12' }, blocks)).toEqual({
      service: 'Service technique',
      quand: '12/08/2026',
    })
  })

  // Clé {repeaterId}_{n}_{innerId} : le bloc se retrouve par l'identifiant interne.
  it('résout les clés de répéteur itération par itération', () => {
    expect(resolveDataLabels({ 'rep_1_materiel': 'tente', 'rep_2_materiel': 'tente' }, blocks)).toEqual({
      'rep_1_materiel': 'Tente',
      'rep_2_materiel': 'Tente',
    })
  })

  it('laisse intactes les clés de contrôle du répéteur', () => {
    expect(resolveDataLabels({ rep_initial: 'yes', rep_repeat_1: 'no' }, blocks)).toEqual({
      rep_initial: 'yes',
      rep_repeat_1: 'no',
    })
  })

  it('conserve une clé dont le bloc n’existe plus', () => {
    expect(resolveDataLabels({ disparu: 'valeur' }, blocks)).toEqual({ disparu: 'valeur' })
  })
})
