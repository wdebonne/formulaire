import { describe, expect, it } from 'vitest'
import { applyTokenTemplate, formatDatePattern, parseDateText } from '@/lib/token-format'
import { withRouteVariables } from '@/lib/document-fields'

describe('parseDateText', () => {
  it('relit la date française produite par les jetons, en heure locale', () => {
    const d = parseDateText('18/11/2026')!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 18])
  })

  it('relit l’ISO des réponses anciennes', () => {
    expect(parseDateText('2026-11-18')?.getDate()).toBe(18)
  })

  it('refuse ce qui n’est pas une date réelle', () => {
    expect(parseDateText('31/02/2026')).toBeNull()
    expect(parseDateText('Didier Dupont')).toBeNull()
  })
})

describe('formatDatePattern', () => {
  const date = new Date(2026, 10, 18)

  it('accepte les lettres françaises et anglaises', () => {
    expect(formatDatePattern(date, 'AAAA-MM-JJ')).toBe('2026-11-18')
    expect(formatDatePattern(date, 'DD/MM/YYYY')).toBe('18/11/2026')
    expect(formatDatePattern(date, 'JJ-MM-AA')).toBe('18-11-26')
  })

  it('écrit mois et jour en toutes lettres', () => {
    expect(formatDatePattern(date, 'JJJJ JJ MMMM AAAA')).toBe('mercredi 18 novembre 2026')
  })
})

describe('applyTokenTemplate', () => {
  const data = { today: '18/11/2026', nom: 'Dupont' }

  it('reformate un jeton de date et laisse les autres tels quels', () => {
    expect(applyTokenTemplate('Le {today|AAAA-MM-JJ} pour {nom}', data)).toBe(
      'Le 2026-11-18 pour Dupont'
    )
  })

  it('ignore un format posé sur une valeur qui n’est pas une date', () => {
    expect(applyTokenTemplate('{nom|AAAA}', data)).toBe('Dupont')
  })

  it('vide un jeton inconnu, comme le rendu .docx', () => {
    expect(applyTokenTemplate('[{absent|AAAA}]', data)).toBe('[]')
  })
})

describe('valeur de circuit construite sur un jeton', () => {
  it('résout {today|…} dans la valeur personnalisée', () => {
    const tokens = withRouteVariables({ today: '18/11/2026' }, [
      { key: 'date_document', value: '{today|AAAA-MM-JJ}' },
    ])
    expect(tokens.date_document).toBe('2026-11-18')
  })

  it('ne résout pas une valeur de circuit dans une autre : l’ordre des lignes ne compte pas', () => {
    const tokens = withRouteVariables({}, [
      { key: 'a', value: 'X' },
      { key: 'b', value: '{a}' },
    ])
    expect(tokens.b).toBe('')
  })
})
