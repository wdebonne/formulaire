// Construction du tableau d'export des réponses : en-têtes et lignes, une colonne par question.
//
// Volontairement pur (aucun import Prisma ni xlsx) : la modale d'export l'utilise pour annoncer
// le nombre de lignes et de colonnes avant le téléchargement, la route API pour produire le
// fichier. CSV et Excel décrivent donc exactement le même tableau — le format ne change que
// l'encodage, jamais le contenu.
//
// La résolution des valeurs reprend celle de la page des réponses (slug de choix → libellé,
// pièce jointe et signature → texte lisible), conformément à la convention « Choice Value vs
// Label » : ce qui est stocké n'est jamais réécrit, c'est la lecture qui traduit.

import { answerToText, isStructuredAnswer } from './response-format'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface ExportBlock {
  id: string
  type: string
  attributes: Record<string, any>
  innerBlocks?: ExportBlock[]
}

export interface ExportResponseInput {
  data: Record<string, any>
  createdAt: Date | string
}

export interface ExportTable {
  headers: string[]
  rows: string[][]
}

const NON_QUESTION_TYPES = ['welcome-screen', 'thankyou-screen', 'statement']

// Même garde-fou que report-stats.ts : une réponse corrompue ne doit pas faire boucler l'export.
const MAX_REPETITIONS = 100

export function exportQuestionBlocks(blocks: ExportBlock[]): ExportBlock[] {
  return (blocks || []).filter((b) => !NON_QUESTION_TYPES.includes(b.type))
}

function blockLabel(block: ExportBlock): string {
  return block.attributes?.label || block.id
}

function resolveChoiceLabel(choices: { label: string; value: string }[], value: string): string {
  const match = choices.find((c) => c.value === value)
  return match ? match.label : value
}

/**
 * Rend une valeur enregistrée sous forme de texte de cellule.
 *
 * Une cellule sans réponse reste **vide** plutôt que de porter un tiret : dans un tableur, un
 * « - » ne se compte pas, ne se filtre pas et ne s'additionne pas. Le tiret est un artifice
 * d'affichage, il n'a pas sa place dans un export de données.
 */
export function formatExportCell(
  value: any,
  choices?: { label: string; value: string }[]
): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  // Pièce jointe et signature : structures stockées telles quelles dans la réponse, dépliées
  // clé par clé elles enverraient une data-URL base64 entière dans une cellule.
  if (isStructuredAnswer(value)) return answerToText(value)
  if (choices && choices.length > 0) {
    if (Array.isArray(value)) {
      return value.map((v) => resolveChoiceLabel(choices, String(v))).join(', ')
    }
    return resolveChoiceLabel(choices, String(value))
  }
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, v]) => `${key.replace(/^__other__:/, '')} : ${formatExportCell(v)}`)
      .join(', ')
  }
  return String(value).replace(/^__other__:/, '')
}

/**
 * Nombre maximal d'itérations atteint par un répéteur sur l'ensemble des réponses.
 *
 * Une itération est considérée remplie dès qu'un **quelconque** de ses champs internes porte
 * une valeur : s'arrêter au premier champ interne perdrait les itérations suivantes dès que ce
 * champ est facultatif et laissé vide.
 */
function maxRepetitions(block: ExportBlock, responses: ExportResponseInput[]): number {
  const inner = block.innerBlocks ?? []
  let max = 0

  for (const response of responses) {
    let n = 1
    while (
      n <= MAX_REPETITIONS &&
      inner.some((child) => response.data[`${block.id}_${n}_${child.id}`] !== undefined)
    ) {
      n++
    }
    max = Math.max(max, n - 1)
  }

  return max
}

interface ExportColumn {
  header: string
  read: (data: Record<string, any>) => string
}

/**
 * Colonnes de l'export, répéteurs et groupes dépliés.
 *
 * La largeur du tableau dépend des réponses : un répéteur occupe autant de blocs de colonnes
 * que sa plus longue itération observée. Elle est donc mesurée une seule fois ici, et non à
 * chaque ligne.
 */
export function buildExportColumns(
  blocks: ExportBlock[],
  responses: ExportResponseInput[]
): ExportColumn[] {
  const columns: ExportColumn[] = [
    {
      header: 'Date',
      read: () => '',
    },
  ]

  for (const block of exportQuestionBlocks(blocks)) {
    const inner = block.innerBlocks ?? []

    if (block.type === 'repeater' && inner.length > 0) {
      const repetitions = maxRepetitions(block, responses)

      // Un répéteur qu'aucune réponse n'a rempli garde une colonne, sinon la question
      // disparaîtrait du tableau sans que rien ne le signale.
      if (repetitions === 0) {
        columns.push({ header: blockLabel(block), read: () => '' })
        continue
      }

      for (let index = 1; index <= repetitions; index++) {
        for (const child of inner) {
          columns.push({
            header: `${blockLabel(block)} #${index} - ${blockLabel(child)}`,
            read: (data) =>
              formatExportCell(data[`${block.id}_${index}_${child.id}`], child.attributes?.choices),
          })
        }
      }
      continue
    }

    if (block.type === 'group' && inner.length > 0) {
      for (const child of inner) {
        columns.push({
          header: `${blockLabel(block)} - ${blockLabel(child)}`,
          read: (data) => formatExportCell(data[child.id], child.attributes?.choices),
        })
      }
      continue
    }

    columns.push({
      header: blockLabel(block),
      read: (data) => formatExportCell(data[block.id], block.attributes?.choices),
    })
  }

  return columns
}

export function buildExportTable(
  blocks: ExportBlock[],
  responses: ExportResponseInput[]
): ExportTable {
  const columns = buildExportColumns(blocks, responses)

  const rows = responses.map((response) => [
    format(new Date(response.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
    ...columns.slice(1).map((column) => column.read(response.data)),
  ])

  return { headers: columns.map((column) => column.header), rows }
}

// Toutes les cellules sont entourées de guillemets : une valeur libre peut contenir une
// virgule, un saut de ligne ou un guillemet sans que la ligne ne se disloque.
export function toCsv(table: ExportTable): string {
  return [table.headers, ...table.rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function filterResponsesByRange<T extends ExportResponseInput>(
  responses: T[],
  range: { from: Date | null; to: Date }
): T[] {
  return responses.filter((response) => {
    const at = new Date(response.createdAt)
    if (Number.isNaN(at.getTime())) return false
    if (range.from && at.getTime() < range.from.getTime()) return false
    return at.getTime() <= range.to.getTime()
  })
}

// Caractères interdits dans un nom de fichier Windows retirés, longueur bornée : le titre du
// formulaire est libre, il n'a pas à produire un nom que le navigateur refusera d'écrire.
export function exportFileName(title: string, from: Date | null, to: Date): string {
  const clean = (title || 'formulaire')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'formulaire'

  const stamp = from
    ? `du ${format(from, 'yyyy-MM-dd')} au ${format(to, 'yyyy-MM-dd')}`
    : `au ${format(to, 'yyyy-MM-dd')}`

  return `${clean} - reponses ${stamp}`
}
