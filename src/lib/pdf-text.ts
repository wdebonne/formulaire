// Nettoyage des chaînes destinées à pdfkit.
//
// Les polices standard du PDF (Helvetica, Times, Courier) sont encodées en **WinAnsi** : elles
// ne couvrent que le Latin-1 étendu. pdfkit n'échoue pas sur un caractère absent de cette table,
// il écrit l'octet de poids faible de chaque unité UTF-16 — un emoji, codé sur une paire de
// substitution, ressort donc en « Ø<Ø » (U+1F3D8 = D83C DFD8 → 0xD8 0x3C…). C'est ce qu'on
// voyait sur les titres de questions des rapports.
//
// Aucune police standard ne contient d'emoji, et pdfkit ne sait pas changer de police au
// caractère près au sein d'un même appel `text()` : la seule sortie propre est de retirer ces
// caractères. Les symboles qui ont un équivalent lisible sont transposés plutôt que supprimés,
// pour ne pas amputer le sens d'un libellé.
//
// Conséquence assumée : un libellé composé **uniquement** d'emoji ressort vide dans le PDF.
// Les autres exports (Excel, Word, HTML) sont en UTF-8 et ne sont pas concernés.

// Les caractères de la plage 0x80-0x9F de WinAnsi : hors Latin-1, mais encodables par pdfkit.
const WINANSI_SPECIALS = new Set([
  '€', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰',
  'Š', '‹', 'Œ', 'Ž', '‘', '’', '“', '”', '•',
  '–', '—', '˜', '™', 'š', '›', 'œ', 'ž', 'Ÿ',
])

const SUBSTITUTIONS: Record<string, string> = {
  // Espaces fines et insécables étroites : absentes de WinAnsi alors qu'elles abondent en
  // typographie française (avant « : » ou « ? »).
  ' ': ' ', // espace fine
  ' ': ' ', // espace insécable étroite
  ' ': ' ', // espace tabulaire
  '​': '', // espace de largeur nulle
  '‑': '-', // trait d'union insécable
  '−': '-', // signe moins
  // Flèches et comparateurs, fréquents dans les intitulés de questions
  '→': '->',
  '←': '<-',
  '⇒': '=>',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  // Cases et coches
  '☐': '[ ]',
  '☑': '[x]',
  '☒': '[x]',
  '✓': '[x]',
  '✔': '[x]',
  '✗': 'x',
  '✘': 'x',
  // Puces exotiques ramenées sur la puce WinAnsi
  '‣': '•',
  '▪': '•',
  '▫': '•',
  '●': '•',
  '○': '•',
  '⁃': '•',
  // Ponctuation
  '′': "'",
  '″': '"',
  '―': '—',
  '⁄': '/',
}

function isWinAnsi(codePoint: number, char: string): boolean {
  if (codePoint === 0x0a || codePoint === 0x0d || codePoint === 0x09) return true
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true
  return WINANSI_SPECIALS.has(char)
}

/**
 * Rend une chaîne représentable par les polices standard de pdfkit.
 *
 * Idempotent : la fonction peut être appliquée plusieurs fois sur la même valeur.
 */
export function pdfSafeText(value: unknown): string {
  const source = value === null || value === undefined ? '' : String(value)
  if (!source) return ''

  // Précomposition : « e + accent aigu combinant » devient « é », représentable, au lieu d'être
  // amputé de son accent.
  const normalized = source.normalize('NFC')

  let out = ''
  for (const char of normalized) {
    const codePoint = char.codePointAt(0) ?? 0
    if (isWinAnsi(codePoint, char)) {
      out += char
      continue
    }
    const substitute = SUBSTITUTIONS[char]
    if (substitute !== undefined) {
      out += substitute
    }
    // Tout le reste (emoji, sélecteurs de variante, modificateurs de teint, jointures de
    // largeur nulle, alphabets non latins) est retiré.
  }

  // La suppression laisse des espaces orphelins là où se trouvait l'emoji décoratif.
  return out.replace(/[^\S\r\n]{2,}/g, ' ').trim()
}
