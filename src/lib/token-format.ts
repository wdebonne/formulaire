// Remplacement des jetons {tag} et {tag|format} dans un texte : objet et corps d'e-mail, nom du
// fichier généré, valeurs personnalisées d'un circuit.
//
// Pur et importable côté client, pour que la modale montre exactement ce que l'envoi produira.

export const TOKEN_RE = /\{([a-z0-9_]+)(?:\|([^{}|]+))?\}/gi

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Relit une date déjà mise en texte. Les jetons de date arrivent formatés « 18/11/2026 »
 * (today, entry_date, questions date) ; une réponse ancienne peut encore porter l'ISO.
 * Construite en heure locale : passer par l'ISO « 2026-11-18 » donnerait minuit UTC, donc
 * la veille au soir à l'ouest de Greenwich.
 */
export function parseDateText(text: string): Date | null {
  const value = String(text ?? '').trim()
  let m = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  let y: number, mo: number, d: number
  if (m) {
    d = +m[1]
    mo = +m[2]
    y = +m[3]
  } else {
    m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
    if (!m) return null
    y = +m[1]
    mo = +m[2]
    d = +m[3]
  }
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
    ? date
    : null
}

// Lettres françaises (JJ/MM/AAAA) ou anglaises (DD/MM/YYYY), la forme longue d'abord pour que
// « AAAA » ne soit pas lu comme deux « AA ».
const PATTERN_RE = /AAAA|YYYY|JJJJ|DDDD|MMMM|AA|YY|JJ|DD|MM/g

export function formatDatePattern(date: Date, pattern: string): string {
  return pattern.replace(PATTERN_RE, (part) => {
    switch (part) {
      case 'AAAA':
      case 'YYYY':
        return String(date.getFullYear())
      case 'AA':
      case 'YY':
        return pad(date.getFullYear() % 100)
      case 'MMMM':
        return MONTHS[date.getMonth()]
      case 'MM':
        return pad(date.getMonth() + 1)
      case 'JJJJ':
      case 'DDDD':
        return WEEKDAYS[date.getDay()]
      default:
        return pad(date.getDate())
    }
  })
}

function defaultText(value: unknown): string {
  if (value === undefined || value === null || Array.isArray(value)) return ''
  if (typeof value === 'object') return ''
  return String(value)
}

/**
 * Remplace les jetons d'un texte. Un jeton inconnu est vidé, comme le nullGetter du rendu
 * .docx. Un format n'agit que sur une valeur qui se relit comme une date : appliqué à un nom,
 * il est ignoré plutôt que de produire un texte mutilé.
 */
export function applyTokenTemplate(
  template: string,
  data: Record<string, unknown>,
  toText: (value: unknown) => string = defaultText
): string {
  return String(template ?? '').replace(TOKEN_RE, (_match, tag: string, format?: string) => {
    const value = data[tag]
    if (Array.isArray(value)) return ''
    const text = toText(value)
    if (!format) return text
    const date = parseDateText(text)
    return date ? formatDatePattern(date, format.trim()) : text
  })
}
