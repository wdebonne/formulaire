import { describe, expect, it } from 'vitest'
import { canonicalizeValue, evaluateRouteConditions } from '@/lib/condition-eval'
import type { LogicCondition } from '@/types/form'

const serviceBlock = {
  id: 'service',
  type: 'multiple-choice',
  attributes: {
    choices: [
      { id: 'c1', label: 'Matériel', value: 'materiel' },
      { id: 'c2', label: 'Salle', value: 'salle' },
      { id: 'c3', label: 'Écran, second', value: 'ecran-second' },
    ],
  },
}
const yesNoBlock = { id: 'rappel', type: 'yes-no', attributes: {} }
const legalBlock = { id: 'cgu', type: 'legal', attributes: {} }
const numberBlock = { id: 'nb', type: 'number', attributes: {} }

const blocks = [serviceBlock, yesNoBlock, legalBlock, numberBlock]

const cond = (
  blockId: string,
  operator: LogicCondition['operator'],
  value?: string
): LogicCondition => ({ blockId, operator, value: value as any } as LogicCondition)

const run = (conditions: LogicCondition[], data: Record<string, any>, match?: 'all' | 'any') =>
  evaluateRouteConditions(conditions, match, blocks, data)

describe('canonicalizeValue', () => {
  // Une même option circule sous trois écritures selon l'ancienneté de la réponse.
  it('ramène slug, identifiant et libellé à la même forme', () => {
    expect(canonicalizeValue(serviceBlock, 'materiel')).toBe('matériel')
    expect(canonicalizeValue(serviceBlock, 'c1')).toBe('matériel')
    expect(canonicalizeValue(serviceBlock, 'Matériel')).toBe('matériel')
  })

  it('normalise les écritures d’un Oui/Non', () => {
    for (const v of ['yes', 'Oui', 'true', 'OUI']) expect(canonicalizeValue(yesNoBlock, v)).toBe('yes')
    for (const v of ['no', 'Non', 'false']) expect(canonicalizeValue(yesNoBlock, v)).toBe('no')
  })

  it('tient compte des libellés Oui/Non personnalisés', () => {
    const block = { id: 'x', type: 'yes-no', attributes: { yesLabel: "J'accepte", noLabel: 'Je refuse' } }
    expect(canonicalizeValue(block, "J'accepte")).toBe('yes')
    expect(canonicalizeValue(block, 'Je refuse')).toBe('no')
  })

  it('ramène une case légale à true / false', () => {
    expect(canonicalizeValue(legalBlock, true)).toBe('true')
    expect(canonicalizeValue(legalBlock, 'oui')).toBe('true')
    expect(canonicalizeValue(legalBlock, false)).toBe('false')
  })

  it('retire le préfixe __other__', () => {
    expect(canonicalizeValue(serviceBlock, '__other__:Cuisine')).toBe('cuisine')
  })

  it('rend une chaîne vide pour une absence de valeur', () => {
    expect(canonicalizeValue(serviceBlock, null)).toBe('')
    expect(canonicalizeValue(serviceBlock, '   ')).toBe('')
  })
})

describe('evaluateRouteConditions', () => {
  // Contrat inverse de celui de la logique de formulaire, et délibéré : un circuit fraîchement
  // créé doit envoyer sans qu'on lui invente une condition toujours vraie.
  it('part systématiquement sans condition', () => {
    expect(run([], {})).toBe(true)
    expect(evaluateRouteConditions(undefined, undefined, blocks, {})).toBe(true)
  })

  it('ignore les conditions incomplètes laissées par l’éditeur', () => {
    expect(evaluateRouteConditions([{ blockId: '', operator: 'equals', value: 'x' } as any], undefined, blocks, {})).toBe(true)
  })

  describe('equals', () => {
    it('reconnaît une réponse stockée en slug (réponse ancienne)', () => {
      expect(run([cond('service', 'equals', 'Matériel')], { service: 'materiel' })).toBe(true)
    })

    it('reconnaît une réponse stockée en libellé (après resolveDataLabels)', () => {
      expect(run([cond('service', 'equals', 'materiel')], { service: 'Matériel' })).toBe(true)
    })

    // « si la réponse est Matériel » doit rester vrai quand Matériel est coché parmi d'autres.
    it('est vrai dès que l’option est cochée parmi plusieurs', () => {
      expect(run([cond('service', 'equals', 'Matériel')], { service: 'Matériel, Salle' })).toBe(true)
      expect(run([cond('service', 'equals', 'Matériel')], { service: ['materiel', 'salle'] })).toBe(true)
    })

    // Régression : découper naïvement sur la virgule scinderait « Écran, second » en deux.
    it('ne scinde pas un libellé contenant une virgule', () => {
      expect(run([cond('service', 'equals', 'Écran, second')], { service: 'Écran, second' })).toBe(true)
    })

    // Le cas que la reconstitution existe pour : le libellé à virgule est noyé au milieu d'autres
    // options, donc la chaîne entière ne correspond à rien et il faut recoller les fragments.
    it('reconstitue un libellé à virgule coché parmi d’autres options', () => {
      const data = { service: 'Matériel, Écran, second, Salle' }
      expect(run([cond('service', 'equals', 'Écran, second')], data)).toBe(true)
      expect(run([cond('service', 'equals', 'Matériel')], data)).toBe(true)
      expect(run([cond('service', 'equals', 'Salle')], data)).toBe(true)
      // « second » seul n'est pas une option : il ne doit pas en devenir une.
      expect(run([cond('service', 'equals', 'second')], data)).toBe(false)
    })

    it('est faux sur une réponse absente', () => {
      expect(run([cond('service', 'equals', 'Matériel')], {})).toBe(false)
      expect(run([cond('service', 'equals', 'Matériel')], { service: '' })).toBe(false)
      expect(run([cond('service', 'equals', 'Matériel')], { service: [] })).toBe(false)
    })
  })

  describe('not_equals', () => {
    it('est vrai quand l’option n’est pas cochée', () => {
      expect(run([cond('service', 'not_equals', 'Salle')], { service: 'Matériel' })).toBe(true)
    })

    // Une réponse absente n'est pas « différente de » : elle est absente.
    it('est faux sur une réponse absente', () => {
      expect(run([cond('service', 'not_equals', 'Salle')], {})).toBe(false)
    })
  })

  describe('contains / not_contains', () => {
    it('cherche dans le texte rendu de la réponse', () => {
      expect(run([cond('service', 'contains', 'mat')], { service: 'materiel' })).toBe(true)
      expect(run([cond('service', 'not_contains', 'salle')], { service: 'materiel' })).toBe(true)
    })
  })

  describe('greater_than / less_than', () => {
    it('compare numériquement', () => {
      expect(run([cond('nb', 'greater_than', '10')], { nb: 12 })).toBe(true)
      expect(run([cond('nb', 'greater_than', '10')], { nb: 8 })).toBe(false)
      expect(run([cond('nb', 'less_than', '10')], { nb: 8 })).toBe(true)
    })

    it('reste faux sur une réponse absente plutôt que de comparer un zéro implicite', () => {
      expect(run([cond('nb', 'less_than', '10')], {})).toBe(false)
    })
  })

  describe('is_empty / is_not_empty', () => {
    it('distingue vide, tableau vide et absence', () => {
      expect(run([cond('service', 'is_empty')], {})).toBe(true)
      expect(run([cond('service', 'is_empty')], { service: [] })).toBe(true)
      expect(run([cond('service', 'is_empty')], { service: 'Matériel' })).toBe(false)
      expect(run([cond('service', 'is_not_empty')], { service: 'Matériel' })).toBe(true)
    })
  })

  describe('combinaison', () => {
    const two = [cond('service', 'equals', 'Matériel'), cond('rappel', 'equals', 'Oui')]

    it('« toutes » exige les deux', () => {
      expect(run(two, { service: 'Matériel', rappel: 'yes' }, 'all')).toBe(true)
      expect(run(two, { service: 'Matériel', rappel: 'no' }, 'all')).toBe(false)
    })

    it('« au moins une » se contente d’une', () => {
      expect(run(two, { service: 'Matériel', rappel: 'no' }, 'any')).toBe(true)
      expect(run(two, { service: 'Salle', rappel: 'no' }, 'any')).toBe(false)
    })

    it('« toutes » est le défaut quand le mode n’est pas précisé', () => {
      expect(run(two, { service: 'Matériel', rappel: 'no' })).toBe(false)
    })
  })

  // Une signature est une data-URL base64 : la déverser dans la comparaison ferait correspondre
  // n'importe quelle sous-chaîne courte.
  it('compare une signature sur son rendu lisible, pas sur ses octets', () => {
    const signature = { kind: 'signature', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAA', signedAt: '2026-09-20T10:00:00Z' }
    const withSignature = [{ id: 'sig', type: 'signature', attributes: {} }]
    expect(
      evaluateRouteConditions([cond('sig', 'contains', 'iVBORw')], undefined, withSignature, { sig: signature })
    ).toBe(false)
    expect(
      evaluateRouteConditions([cond('sig', 'is_not_empty')], undefined, withSignature, { sig: signature })
    ).toBe(true)
  })
})
