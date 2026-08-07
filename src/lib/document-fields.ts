// Catalogue des champs disponibles pour un modèle .docx.
//
// Ce fichier est volontairement pur (aucun import Prisma, aucun accès disque) pour pouvoir
// être importé depuis un composant 'use client' — même raisonnement que audit-actions.ts
// vis-à-vis de audit-log.ts. Le rendu du document lui-même vit dans docx-template.ts.

import type { DocumentFieldMapping, DocumentMetaField } from '@/types/form'

export interface DocumentFieldChoice {
  label: string
  value: string
}

export interface DocumentCatalogField {
  blockId: string
  label: string
  type: string
  tag: string
  isMeta?: boolean
  parentLabel?: string // libellé du groupe/répéteur d'origine, pour l'affichage
  choices?: DocumentFieldChoice[]
  children?: DocumentCatalogField[] // uniquement pour les répéteurs (jeton de boucle)
}

interface CatalogBlock {
  id: string
  type: string
  attributes?: { label?: string; choices?: { label?: string; value?: string }[] }
  innerBlocks?: CatalogBlock[]
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
  const saved = new Map(savedMappings.map((m) => [m.blockId, m.tag]))
  const taken = new Set<string>(savedMappings.map((m) => m.tag))
  const fields: DocumentCatalogField[] = []

  const tagFor = (blockId: string, label: string): string => {
    const existing = saved.get(blockId)
    if (existing) return existing
    return makeUniqueTag(slugifyTag(label), taken)
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
  for (const field of fields) {
    mappings.push({ tag: field.tag, blockId: field.blockId })
    for (const child of field.children ?? []) {
      mappings.push({ tag: child.tag, blockId: child.blockId })
    }
  }
  return mappings
}

// Tous les jetons du catalogue, boucles et enfants compris.
export function catalogTags(fields: DocumentCatalogField[]): string[] {
  return catalogToMappings(fields).map((m) => m.tag)
}
