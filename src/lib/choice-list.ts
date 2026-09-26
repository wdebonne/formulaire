import type React from 'react'

// Navigation au clavier d'une liste de choix rendue avec des `<button>`.
//
// Un groupe de boutons radio se parcourt aux flèches et ne compte qu'une seule tabulation :
// tabuler option par option ferait traverser vingt arrêts pour atteindre le bouton suivant, et
// surtout, rien n'indiquerait qu'il s'agit d'un choix unique. Le `tabIndex` circule donc sur
// l'option cochée (à défaut, la première).
//
// **Les flèches déplacent le focus sans cocher**, contrairement au motif radio habituel. Ici,
// cocher déclenche le passage à la question suivante : sélectionner au passage ferait défiler le
// formulaire à chaque flèche. C'est la variante prévue par l'ARIA Authoring Practices quand la
// sélection provoque un changement de contexte ; Entrée et Espace cochent, comme sur un bouton.
//
// Ce sont des fonctions et non un hook : un groupe affiche plusieurs listes de choix à la fois,
// et le parcours se fait depuis `event.currentTarget`, sans référence à conserver.

export interface ChoiceListProps {
  role: 'radiogroup' | 'group'
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
}

export interface ChoiceOptionProps {
  role: 'radio' | 'checkbox'
  'aria-checked': boolean
  tabIndex: number
  'data-choice-option': string
}

function moveFocus(container: HTMLElement, delta: number | 'first' | 'last'): void {
  const options = Array.from(
    container.querySelectorAll<HTMLElement>('[data-choice-option]:not([disabled])')
  )
  if (options.length === 0) return

  const active = document.activeElement as HTMLElement | null
  const current = active ? options.indexOf(active) : -1

  let next: number
  if (delta === 'first') next = 0
  else if (delta === 'last') next = options.length - 1
  else if (current < 0) next = delta > 0 ? 0 : options.length - 1
  else next = (current + delta + options.length) % options.length

  options[next]?.focus()
}

export function choiceListProps(multiple: boolean): ChoiceListProps {
  return {
    role: multiple ? 'group' : 'radiogroup',
    onKeyDown: (event) => {
      // La saisie libre de l'option « Autre » vit dans la liste : ses flèches déplacent le curseur.
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const container = event.currentTarget
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          moveFocus(container, 1)
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          moveFocus(container, -1)
          break
        case 'Home':
          event.preventDefault()
          moveFocus(container, 'first')
          break
        case 'End':
          event.preventDefault()
          moveFocus(container, 'last')
          break
      }
    },
  }
}

export function choiceOptionProps(
  multiple: boolean,
  index: number,
  selected: boolean,
  selectedIndex: number
): ChoiceOptionProps {
  return {
    role: multiple ? 'checkbox' : 'radio',
    'aria-checked': selected,
    // Une case à cocher reste un arrêt de tabulation : chacune se coche indépendamment, il n'y a
    // pas de « valeur du groupe » sur laquelle poser le focus.
    tabIndex: multiple || selected || (selectedIndex < 0 && index === 0) ? 0 : -1,
    'data-choice-option': '',
  }
}

// Position de l'option cochée, sur laquelle le `tabIndex` du groupe se pose. Une réponse
// multiple retient la première cochée ; `-1` quand rien ne l'est, et la première option prend
// alors le relais.
export function selectedChoiceIndex(values: string[], answer: unknown): number {
  if (Array.isArray(answer)) {
    for (let i = 0; i < values.length; i++) {
      if (answer.includes(values[i])) return i
    }
    return -1
  }
  if (typeof answer === 'string' || typeof answer === 'number') {
    return values.indexOf(String(answer))
  }
  return -1
}
