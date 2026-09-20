import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_META_FIELDS,
  buildFieldCatalog,
  catalogTags,
  catalogToMappings,
  slugifyTag,
} from '@/lib/document-fields'

const metaTags = DOCUMENT_META_FIELDS.map((m) => m.id)

const text = (id: string, label: string) => ({ id, type: 'short-text', attributes: { label } })

describe('slugifyTag', () => {
  it('translittère accents et ponctuation en un jeton utilisable dans Word', () => {
    expect(slugifyTag('Quel est votre prénom ?')).toBe('quel_est_votre_prenom')
    expect(slugifyTag('Été 2026 — Nº 4')).toBe('ete_2026_n_4')
  })

  it('ne laisse ni underscore en bord ni doublon', () => {
    expect(slugifyTag('  --Bonjour--  ')).toBe('bonjour')
  })

  // Un jeton vide casserait le modèle : il faut toujours une retombée.
  it('retombe sur « champ » quand il ne reste rien', () => {
    expect(slugifyTag('???')).toBe('champ')
    expect(slugifyTag('')).toBe('champ')
  })
})

describe('buildFieldCatalog', () => {
  it('produit un champ par question, plus les champs méta', () => {
    const fields = buildFieldCatalog([text('b1', 'Votre prénom')])
    expect(fields.map((f) => f.tag)).toEqual(['votre_prenom', ...metaTags])
  })

  it('écarte les blocs qui ne portent jamais de réponse', () => {
    const fields = buildFieldCatalog([
      { id: 'w', type: 'welcome-screen', attributes: { label: 'Bienvenue' } },
      { id: 's', type: 'statement', attributes: { label: 'Note' } },
      text('b1', 'Votre prénom'),
    ])
    expect(fields.filter((f) => !f.isMeta).map((f) => f.blockId)).toEqual(['b1'])
  })

  it('retombe sur l’identifiant du bloc quand la question n’a pas d’intitulé', () => {
    const fields = buildFieldCatalog([{ id: 'b1', type: 'short-text', attributes: {} }])
    expect(fields[0].label).toBe('b1')
  })

  // La garantie centrale : un .docx déjà rédigé continue de fonctionner après un renommage.
  it('conserve un jeton déjà attribué malgré le renommage de la question', () => {
    const saved = [{ tag: 'votre_prenom', blockId: 'b1' }]
    const fields = buildFieldCatalog([text('b1', 'Comment vous appelez-vous ?')], saved)
    expect(fields[0].tag).toBe('votre_prenom')
  })

  // Une question ajoutée depuis le dernier import n'a pas de mapping : elle doit tout de même
  // recevoir un jeton, sinon elle serait absente du modèle.
  it('attribue un jeton aux questions ajoutées depuis le dernier import', () => {
    const saved = [{ tag: 'votre_prenom', blockId: 'b1' }]
    const fields = buildFieldCatalog([text('b1', 'Votre prénom'), text('b2', 'Votre adresse')], saved)
    expect(fields.map((f) => f.tag).slice(0, 2)).toEqual(['votre_prenom', 'votre_adresse'])
  })

  it('déduplique deux questions au même intitulé', () => {
    const fields = buildFieldCatalog([text('b1', 'Nom'), text('b2', 'Nom')])
    expect(fields.slice(0, 2).map((f) => f.tag)).toEqual(['nom', 'nom_2'])
  })

  // docxtemplater remonte de la boucle au scope parent : un jeton d'enfant qui doublonne un jeton
  // de premier niveau masquerait silencieusement ce dernier. D'où une déduplication globale.
  it('déduplique globalement, y compris entre un répéteur et le premier niveau', () => {
    const fields = buildFieldCatalog([
      text('b1', 'Nom'),
      { id: 'rep', type: 'repeater', attributes: { label: 'Matériel' }, innerBlocks: [text('r1', 'Nom')] },
    ])
    const tags = catalogTags(fields)
    expect(new Set(tags).size).toBe(tags.length)
  })

  describe('répéteur', () => {
    const fields = buildFieldCatalog([
      {
        id: 'rep',
        type: 'repeater',
        attributes: { label: 'Matériel emprunté' },
        innerBlocks: [text('r1', 'Lequel'), { id: 'w', type: 'thankyou-screen', attributes: {} }],
      },
    ])

    it('devient un jeton de boucle portant ses enfants', () => {
      expect(fields[0].tag).toBe('materiel_emprunte')
      expect(fields[0].children?.map((c) => c.tag)).toEqual(['lequel'])
    })

    it('écarte les blocs décoratifs internes', () => {
      expect(fields[0].children?.map((c) => c.blockId)).not.toContain('w')
    })

    it('rattache l’enfant à sa boucle par le libellé parent', () => {
      expect(fields[0].children?.[0].parentLabel).toBe('Matériel emprunté')
    })
  })

  describe('groupe', () => {
    // Les réponses d'un groupe sont stockées à plat, sous l'id de chaque bloc interne : ses champs
    // deviennent donc des jetons de premier niveau, pas une boucle.
    it('aplatit ses blocs internes en jetons de premier niveau', () => {
      const fields = buildFieldCatalog([
        {
          id: 'grp',
          type: 'group',
          attributes: { label: 'Coordonnées' },
          innerBlocks: [text('g1', 'Prénom'), text('g2', 'E-mail')],
        },
      ])
      // Le tiret de « E-mail » devient un underscore, comme tout séparateur non alphanumérique.
      expect(fields.filter((f) => !f.isMeta).map((f) => f.tag)).toEqual(['prenom', 'e_mail'])
      expect(fields[0].children).toBeUndefined()
      expect(fields[0].parentLabel).toBe('Coordonnées')
    })
  })

  describe('cases à cocher', () => {
    const choiceBlock = {
      id: 'b1',
      type: 'multiple-choice',
      attributes: {
        label: 'Services',
        choices: [
          { label: 'Matériel', value: 'materiel' },
          { label: 'Salle', value: 'salle' },
        ],
      },
    }

    it('ajoute un jeton par option, en plus du jeton texte', () => {
      const [field] = buildFieldCatalog([choiceBlock])
      expect(field.tag).toBe('services')
      expect(field.checkboxes?.map((c) => c.tag)).toEqual(['case_materiel', 'case_salle'])
    })

    it('garde la valeur de l’option pour savoir laquelle cocher', () => {
      const [field] = buildFieldCatalog([choiceBlock])
      expect(field.checkboxes?.map((c) => c.choiceValue)).toEqual(['materiel', 'salle'])
    })

    // La clé de correspondance combine bloc et option : un jeton de case enregistré doit être
    // retrouvé par ce couple, pas par le seul identifiant de bloc.
    it('conserve un jeton de case déjà attribué', () => {
      const saved = [{ tag: 'coche_materiel', blockId: 'b1', choiceValue: 'materiel' }]
      const [field] = buildFieldCatalog([choiceBlock], saved)
      expect(field.checkboxes?.[0].tag).toBe('coche_materiel')
      expect(field.checkboxes?.[1].tag).toBe('case_salle')
    })

    it('ne confond pas le jeton texte du bloc avec celui d’une de ses options', () => {
      const saved = [{ tag: 'texte_du_bloc', blockId: 'b1' }]
      const [field] = buildFieldCatalog([choiceBlock], saved)
      expect(field.tag).toBe('texte_du_bloc')
      expect(field.checkboxes?.map((c) => c.tag)).toEqual(['case_materiel', 'case_salle'])
    })

    it('n’ajoute pas de cases à une question sans options', () => {
      expect(buildFieldCatalog([text('b1', 'Nom')])[0].checkboxes).toBeUndefined()
    })
  })

  it('termine toujours par les champs méta', () => {
    const fields = buildFieldCatalog([])
    expect(fields.every((f) => f.isMeta)).toBe(true)
    expect(fields.map((f) => f.blockId)).toEqual(metaTags)
  })
})

describe('catalogToMappings / catalogTags', () => {
  const fields = buildFieldCatalog([
    {
      id: 'b1',
      type: 'multiple-choice',
      attributes: { label: 'Services', choices: [{ label: 'Matériel', value: 'materiel' }] },
    },
    { id: 'rep', type: 'repeater', attributes: { label: 'Matériel emprunté' }, innerBlocks: [text('r1', 'Lequel')] },
  ])

  it('aplatit boucles, enfants, cases et méta', () => {
    const tags = catalogToMappings(fields).map((m) => m.tag)
    expect(tags).toContain('services')
    expect(tags).toContain('case_materiel')
    expect(tags).toContain('materiel_emprunte')
    expect(tags).toContain('lequel')
    for (const meta of metaTags) expect(tags).toContain(meta)
  })

  it('rattache un jeton de case à son bloc et à son option', () => {
    const mapping = catalogToMappings(fields).find((m) => m.tag === 'case_materiel')
    expect(mapping).toEqual({ tag: 'case_materiel', blockId: 'b1', choiceValue: 'materiel' })
  })

  // Le tour complet : sauvegarder puis relire ne doit pas bouger un seul jeton.
  it('est stable par aller-retour catalogue → mappings → catalogue', () => {
    const blocks = [
      {
        id: 'b1',
        type: 'multiple-choice',
        attributes: { label: 'Services', choices: [{ label: 'Matériel', value: 'materiel' }] },
      },
      { id: 'rep', type: 'repeater', attributes: { label: 'Matériel emprunté' }, innerBlocks: [text('r1', 'Lequel')] },
    ]
    const first = buildFieldCatalog(blocks)
    const second = buildFieldCatalog(blocks, catalogToMappings(first))
    expect(catalogTags(second)).toEqual(catalogTags(first))
  })

  it('reste stable même après renommage de toutes les questions', () => {
    const before = buildFieldCatalog([text('b1', 'Votre prénom')])
    const after = buildFieldCatalog([text('b1', 'Comment vous appelez-vous ?')], catalogToMappings(before))
    expect(catalogTags(after)).toEqual(catalogTags(before))
  })
})
