// Catalogue des champs disponibles pour un modèle .docx.
//
// Ce fichier est volontairement pur (aucun import Prisma, aucun accès disque) pour pouvoir
// être importé depuis un composant 'use client' — même raisonnement que audit-actions.ts
// vis-à-vis de audit-log.ts. Le rendu du document lui-même vit dans docx-template.ts.

import type { DocumentFieldMapping, DocumentMetaField, EmailRouteVariable } from '@/types/form'

export interface DocumentFieldChoice {
  label: string
  value: string
}

// Jeton rendant ☒ ou ☐ selon qu'une option précise est retenue.
export interface DocumentCheckboxToken {
  tag: string
  label: string // libellé de l'option cochable
  choiceValue: string // valeur telle qu'elle est stockée dans la réponse
}

export interface DocumentCatalogField {
  blockId: string
  label: string
  type: string
  tag: string
  isMeta?: boolean
  parentLabel?: string // libellé du groupe/répéteur d'origine, pour l'affichage
  choices?: DocumentFieldChoice[]
  checkboxes?: DocumentCheckboxToken[]
  children?: DocumentCatalogField[] // uniquement pour les répéteurs (jeton de boucle)
}

interface CatalogBlock {
  id: string
  type: string
  attributes?: {
    label?: string
    choices?: { label?: string; value?: string }[]
    yesLabel?: string
    noLabel?: string
    checkboxLabel?: string
  }
  innerBlocks?: CatalogBlock[]
}

// Options cochables d'un bloc, dans la forme où la réponse les enregistre.
// Les blocs Oui/Non stockent 'yes'/'no' et non leur libellé ; la mention légale stocke un booléen.
function checkboxOptions(block: CatalogBlock): { label: string; choiceValue: string }[] {
  if (block.type === 'yes-no') {
    return [
      { label: block.attributes?.yesLabel || 'Oui', choiceValue: 'yes' },
      { label: block.attributes?.noLabel || 'Non', choiceValue: 'no' },
    ]
  }
  if (block.type === 'legal') {
    return [{ label: block.attributes?.checkboxLabel || 'Accepté', choiceValue: 'true' }]
  }
  const choices = block.attributes?.choices
  if (!choices?.length) return []
  return choices.map((c) => ({ label: c.label || c.value || '', choiceValue: c.value ?? '' }))
}

// Blocs purement décoratifs : ils ne portent jamais de réponse.
const NON_ANSWER_TYPES = new Set(['welcome-screen', 'thankyou-screen', 'statement'])

export const DOCUMENT_META_FIELDS: { id: DocumentMetaField; label: string }[] = [
  { id: 'entry_date', label: 'Date de la réponse' },
  { id: 'today', label: "Date du jour (à la génération)" },
  { id: 'entry_id', label: 'Identifiant de la réponse' },
  { id: 'form_title', label: 'Titre du formulaire' },
]

export function slugifyTag(str: string): string {
  return (
    String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'champ'
  )
}

// Les jetons partagent un espace de noms global : à l'intérieur d'une boucle, docxtemplater
// résout d'abord dans l'élément courant puis remonte au scope parent. Dédupliquer globalement
// évite qu'un champ de répéteur masque silencieusement un champ de premier niveau.
function makeUniqueTag(base: string, taken: Set<string>): string {
  let tag = base
  let n = 2
  while (taken.has(tag)) {
    tag = `${base}_${n}`
    n++
  }
  taken.add(tag)
  return tag
}

function blockLabel(block: CatalogBlock): string {
  return block.attributes?.label?.trim() || block.id
}

function blockChoices(block: CatalogBlock): DocumentFieldChoice[] | undefined {
  const choices = block.attributes?.choices
  if (!choices?.length) return undefined
  return choices.map((c) => ({ label: c.label ?? '', value: c.value ?? '' }))
}

/**
 * Construit la liste des champs proposés dans la modale « Modèle de document ».
 *
 * `savedMappings` a la priorité absolue : un jeton déjà attribué à un bloc est conservé tel
 * quel, même si le libellé de la question a changé depuis. C'est ce qui garantit qu'un .docx
 * déjà rédigé continue de fonctionner après un renommage dans le builder.
 */
export function buildFieldCatalog(
  blocks: CatalogBlock[],
  savedMappings: DocumentFieldMapping[] = []
): DocumentCatalogField[] {
  // Un bloc porte un jeton texte et, s'il est cochable, un jeton par option : la clé de
  // correspondance doit donc combiner le bloc et l'option.
  const mappingKey = (blockId: string, choiceValue?: string) =>
    // Séparateur NUL écrit en échappement : un octet nul posé tel quel dans le fichier le
    // fait passer pour binaire aux yeux de git et de grep — plus de diff, plus de recherche.
    choiceValue === undefined ? blockId : `${blockId}\u0000${choiceValue}`

  const saved = new Map(savedMappings.map((m) => [mappingKey(m.blockId, m.choiceValue), m.tag]))
  const taken = new Set<string>(savedMappings.map((m) => m.tag))
  const fields: DocumentCatalogField[] = []

  const tagFor = (blockId: string, label: string, choiceValue?: string): string => {
    const existing = saved.get(mappingKey(blockId, choiceValue))
    if (existing) return existing
    const base = choiceValue === undefined ? slugifyTag(label) : `case_${slugifyTag(label)}`
    return makeUniqueTag(base, taken)
  }

  const checkboxesFor = (block: CatalogBlock): DocumentCheckboxToken[] | undefined => {
    const options = checkboxOptions(block)
    if (options.length === 0) return undefined
    return options.map((o) => ({
      tag: tagFor(block.id, o.label, o.choiceValue),
      label: o.label,
      choiceValue: o.choiceValue,
    }))
  }

  for (const block of blocks) {
    if (NON_ANSWER_TYPES.has(block.type)) continue

    // Répéteur → jeton de boucle {#tag} … {/tag}, ses champs internes vivent dans la boucle.
    if (block.type === 'repeater' && block.innerBlocks?.length) {
      const label = blockLabel(block)
      const children: DocumentCatalogField[] = block.innerBlocks
        .filter((inner) => !NON_ANSWER_TYPES.has(inner.type))
        .map((inner) => {
          const innerLabel = blockLabel(inner)
          return {
            blockId: inner.id,
            label: innerLabel,
            type: inner.type,
            tag: tagFor(inner.id, innerLabel),
            parentLabel: label,
            choices: blockChoices(inner),
            checkboxes: checkboxesFor(inner),
          }
        })

      fields.push({
        blockId: block.id,
        label,
        type: block.type,
        tag: tagFor(block.id, label),
        children,
      })
      continue
    }

    // Groupe → les réponses de ses blocs internes sont stockées à plat, sous leur propre id.
    // Ils deviennent donc de simples jetons de premier niveau.
    if (block.type === 'group' && block.innerBlocks?.length) {
      const groupLabel = blockLabel(block)
      for (const inner of block.innerBlocks) {
        if (NON_ANSWER_TYPES.has(inner.type)) continue
        const innerLabel = blockLabel(inner)
        fields.push({
          blockId: inner.id,
          label: innerLabel,
          type: inner.type,
          tag: tagFor(inner.id, innerLabel),
          parentLabel: groupLabel,
          choices: blockChoices(inner),
          checkboxes: checkboxesFor(inner),
        })
      }
      continue
    }

    const label = blockLabel(block)
    fields.push({
      blockId: block.id,
      label,
      type: block.type,
      tag: tagFor(block.id, label),
      choices: blockChoices(block),
      checkboxes: checkboxesFor(block),
    })
  }

  for (const meta of DOCUMENT_META_FIELDS) {
    fields.push({
      blockId: meta.id,
      label: meta.label,
      type: 'meta',
      tag: tagFor(meta.id, meta.id),
      isMeta: true,
    })
  }

  return fields
}

// Aplatit le catalogue en la liste de mappings à persister (boucles + enfants + méta).
export function catalogToMappings(fields: DocumentCatalogField[]): DocumentFieldMapping[] {
  const mappings: DocumentFieldMapping[] = []
  const push = (field: DocumentCatalogField) => {
    mappings.push({ tag: field.tag, blockId: field.blockId })
    for (const box of field.checkboxes ?? []) {
      mappings.push({ tag: box.tag, blockId: field.blockId, choiceValue: box.choiceValue })
    }
  }
  for (const field of fields) {
    push(field)
    for (const child of field.children ?? []) push(child)
  }
  return mappings
}

// Tous les jetons du catalogue, boucles et enfants compris.
export function catalogTags(fields: DocumentCatalogField[]): string[] {
  return catalogToMappings(fields).map((m) => m.tag)
}

export const MAX_ROUTE_VARIABLES = 30
export const MAX_ROUTE_VARIABLE_LENGTH = 2000
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

// Saisie en cours d'une clé : on ne rogne pas les underscores de bord, sinon taper « mon_ »
// avant « nom » produirait « monnom ». Le rognage final se fait à l'enregistrement.
export function toVariableKey(raw: string): string {
  return String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .slice(0, 60)
}

/**
 * Valeurs personnalisées d'un circuit, nettoyées pour l'enregistrement. Une clé vide est
 * écartée (ligne laissée blanche dans la modale), une clé en double garde sa première valeur :
 * deux lignes « responsable » ne doivent pas dépendre de leur ordre pour savoir laquelle part.
 */
export function sanitizeRouteVariables(input: unknown): EmailRouteVariable[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const variables: EmailRouteVariable[] = []
  for (const raw of input) {
    const key = toVariableKey(String(raw?.key ?? '')).replace(/^_+|_+$/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    variables.push({ key, value: String(raw?.value ?? '').slice(0, MAX_ROUTE_VARIABLE_LENGTH) })
    if (variables.length >= MAX_ROUTE_VARIABLES) break
  }
  return variables
}

/**
 * Jetons d'un e-mail pour un circuit donné. La valeur du circuit l'emporte sur un champ du
 * formulaire de même nom — c'est la portée la plus précise, comme une boucle docxtemplater
 * masque le scope parent ; la modale signale la collision au moment de la saisie.
 */
export function withRouteVariables(
  tokens: Record<string, any>,
  variables: EmailRouteVariable[] | undefined
): Record<string, any> {
  const clean = sanitizeRouteVariables(variables)
  if (clean.length === 0) return tokens
  return { ...tokens, ...Object.fromEntries(clean.map((v) => [v.key, v.value])) }
}
