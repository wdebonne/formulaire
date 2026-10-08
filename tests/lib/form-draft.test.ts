import { describe, expect, it } from 'vitest'
import { buildRestartAnswers, pruneStaleRepeaterKeys } from '@/lib/form-draft'

describe('buildRestartAnswers', () => {
  it('keeps every ordinary answer so only the changed field has to be retyped', () => {
    const answers = {
      nom: 'Dupont',
      date: '2026-10-08',
      service: ['informatique', 'logistique'],
      quantite: { tables: 4 },
    }
    expect(buildRestartAnswers(answers)).toEqual(answers)
  })

  it('drops the signature — signing again is the honest behaviour', () => {
    const kept = buildRestartAnswers({
      nom: 'Dupont',
      signature: { kind: 'signature', dataUrl: 'data:image/png;base64,AAAA', signedAt: '2026-10-08T10:00:00Z' },
    })
    expect(kept).toEqual({ nom: 'Dupont' })
  })

  it('drops attachments, since erasing one response deletes the files it references', () => {
    const kept = buildRestartAnswers({
      nom: 'Dupont',
      piece: { kind: 'file', name: 'devis.pdf', size: 1200, mime: 'application/pdf', storedName: 'abc.pdf' },
    })
    expect(kept).toEqual({ nom: 'Dupont' })
  })

  it('returns a fresh object, never the submitted answers themselves', () => {
    const answers = { nom: 'Dupont' }
    expect(buildRestartAnswers(answers)).not.toBe(answers)
  })
})

describe('pruneStaleRepeaterKeys', () => {
  const R = 'rep'
  const blocks = [
    { id: 'nom', type: 'short-text' },
    { id: R, type: 'repeater' },
  ]
  const data = {
    nom: 'Dupont',
    [`${R}_initial`]: 'yes',
    [`${R}_1_article`]: 'Tente',
    [`${R}_repeat_1`]: 'yes',
    [`${R}_2_article`]: 'Table',
    [`${R}_repeat_2`]: 'yes',
    [`${R}_3_article`]: 'Chaise',
    [`${R}_3_article__complement`]: 'pliante',
    [`${R}_repeat_3`]: 'no',
  }

  it('removes iterations beyond the count actually walked through', () => {
    // Première réponse en 3 itérations, reprise puis arrêtée à 2 : la 3ᵉ ne doit pas repartir.
    const pruned = pruneStaleRepeaterKeys(data, blocks, { [R]: { repetitionCount: 2 } })
    expect(pruned).toEqual({
      nom: 'Dupont',
      [`${R}_initial`]: 'yes',
      [`${R}_1_article`]: 'Tente',
      [`${R}_repeat_1`]: 'yes',
      [`${R}_2_article`]: 'Table',
      [`${R}_repeat_2`]: 'yes',
    })
  })

  it('keeps every iteration up to and including the last one walked through', () => {
    expect(pruneStaleRepeaterKeys(data, blocks, { [R]: { repetitionCount: 3 } })).toEqual(data)
  })

  it('removes all iterations of a repeater never entered, but keeps its initial answer', () => {
    const pruned = pruneStaleRepeaterKeys(data, blocks, {})
    expect(pruned).toEqual({ nom: 'Dupont', [`${R}_initial`]: 'yes' })
  })

  it('leaves keys of other blocks alone, even when their id shares the repeater prefix', () => {
    const lookalike = { [`${R}_10`]: 'x', [`${R}x_5_a`]: 'y' }
    const pruned = pruneStaleRepeaterKeys(
      { ...lookalike },
      [{ id: R, type: 'repeater' }, { id: `${R}x`, type: 'short-text' }],
      { [R]: { repetitionCount: 1 } }
    )
    // `rep_10` est une clé d'itération (10 > 1), `repx_5_a` n'appartient pas au répéteur.
    expect(pruned).toEqual({ [`${R}x_5_a`]: 'y' })
  })
})
