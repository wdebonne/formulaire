'use client'

// Interrogation du catalogue depuis le formulaire public.
//
// Une seule requête par bloc et par période : tant que le répondant ne touche pas à la date, la
// liste n'est pas redemandée. Change-t-il la date, la liste et les plafonds suivent — c'est tout
// l'intérêt d'une liste vivante plutôt que d'une liste figée à la conception du formulaire.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormBlock } from '@/types/form'
import {
  catalogCacheKey,
  catalogPeriod,
  flattenBlocks,
  isCatalogBlock,
  resolveCatalogBlocks,
  type CatalogItem,
  type CatalogState,
} from './catalog'

interface Demande {
  blockId: string
  /** Vide tant que la date n'est pas répondue : il n'y a alors rien à demander. */
  key: string
  from: string
  to: string
}

export function useCatalogBlocks(
  formId: string,
  blocks: FormBlock[],
  answers: Record<string, unknown>
): FormBlock[] {
  const [reponses, setReponses] = useState<Record<string, CatalogState>>({})
  const dejaDemandees = useRef<Set<string>>(new Set())

  const demandes: Demande[] = []
  for (const block of flattenBlocks(blocks)) {
    if (!isCatalogBlock(block)) continue
    const periode = catalogPeriod(block, answers)
    demandes.push(
      periode
        ? { blockId: block.id, key: catalogCacheKey(block.id, periode), from: periode.from, to: periode.to }
        : { blockId: block.id, key: '', from: '', to: '' }
    )
  }

  // Les demandes sont recalculées à chaque frappe, mais leur signature ne bouge qu'à un changement
  // de date : c'est elle, et non le tableau, qui déclenche les requêtes et la mémoïsation.
  const signature = demandes.map((d) => `${d.blockId}:${d.key}`).join('|')
  const demandesRef = useRef<Demande[]>(demandes)
  demandesRef.current = demandes

  useEffect(() => {
    let abandonne = false

    for (const demande of demandesRef.current) {
      if (!demande.key || dejaDemandees.current.has(demande.key)) continue
      dejaDemandees.current.add(demande.key)
      setReponses((prev) => (prev[demande.key] ? prev : { ...prev, [demande.key]: { status: 'loading', items: [] } }))

      const params = new URLSearchParams({
        form: formId,
        block: demande.blockId,
        date_from: demande.from,
        date_to: demande.to,
      })

      fetch(`/api/catalog/availability?${params.toString()}`)
        .then(async (res) => {
          const corps = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(corps?.error || `Le catalogue a répondu ${res.status}`)
          return (corps.items ?? []) as CatalogItem[]
        })
        .then((items) => {
          if (!abandonne) setReponses((prev) => ({ ...prev, [demande.key]: { status: 'ready', items } }))
        })
        .catch((erreur: Error) => {
          // Oubliée du cache : revenir sur la date relancera la tentative, sans boucler pour autant
          // puisque seule une signature différente réveille cet effet.
          dejaDemandees.current.delete(demande.key)
          if (!abandonne) {
            setReponses((prev) => ({
              ...prev,
              [demande.key]: { status: 'error', items: [], message: erreur.message },
            }))
          }
        })
    }

    return () => {
      abandonne = true
    }
  }, [signature, formId])

  const etats = useMemo(() => {
    const map = new Map<string, CatalogState>()
    for (const demande of demandesRef.current) {
      map.set(
        demande.blockId,
        demande.key
          ? reponses[demande.key] ?? { status: 'loading', items: [] }
          : { status: 'no-date', items: [] }
      )
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reponses])

  return useMemo(() => resolveCatalogBlocks(blocks, etats), [blocks, etats])
}
