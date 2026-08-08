// Rendu PDF d'un rapport, à partir des statistiques calculées par report-stats.ts.
//
// Serveur uniquement : pdfkit lit ses métriques de police sur le disque (voir la note
// « pdfkit + output: standalone » dans CLAUDE.md — le paquet est déclaré dans
// serverComponentsExternalPackages et copié explicitement dans l'image Docker).
//
// Les graphiques sont dessinés à la main (rectangles + texte) : aucune dépendance de
// graphiques n'est ajoutée, et le rendu reste identique quel que soit l'environnement.

import PDFDocument from 'pdfkit'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { FormReportSettings } from '@/types/form'
import type { ReportStats } from './report-stats'

export interface ReportPdfContext {
  formTitle: string
  siteName: string
  logo?: Buffer | null
  generatedAt?: Date
  trigger?: 'manual' | 'schedule' | 'closing'
  closingDate?: string
}

const COLORS = {
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  text: '#111827',
  muted: '#6b7280',
  line: '#e5e7eb',
  bar: '#6366f1',
  barSoft: '#c7d2fe',
  positive: '#059669',
  negative: '#dc2626',
}

const MARGIN = 45
const PAGE_WIDTH = 595.28
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const PAGE_BOTTOM = 841.89 - MARGIN - 20 // marge basse + bandeau de pied de page

type Doc = PDFKit.PDFDocument

function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > PAGE_BOTTOM) doc.addPage()
}

// pdfkit n'ellipse pas de lui-même en dessin libre : sans cela un libellé long déborde
// sur la colonne voisine.
function truncate(doc: Doc, text: string, maxWidth: number): string {
  const clean = String(text ?? '')
  if (doc.widthOfString(clean) <= maxWidth) return clean
  let cut = clean
  while (cut.length > 1 && doc.widthOfString(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

function fieldTitle(item: { label: string; parentLabel?: string }): string {
  return item.parentLabel ? `${item.parentLabel} — ${item.label}` : item.label
}

/**
 * Écrit une ligne et avance le curseur vertical.
 *
 * `lineBreak: false` est indispensable pour que pdfkit ne renvoie pas à la ligne un libellé
 * long, mais dans ce mode il avance `x` au lieu de `y` : sans repositionnement explicite, la
 * ligne suivante se superpose à la précédente.
 */
function writeLine(
  doc: Doc,
  text: string,
  options: { font?: string; size?: number; color?: string; indent?: number; gap?: number } = {}
): void {
  const { font = 'Helvetica', size = 9, color = COLORS.text, indent = 0, gap = 0 } = options
  doc.font(font).fontSize(size).fillColor(color)

  const top = doc.y
  doc.text(truncate(doc, text, CONTENT_WIDTH - indent), MARGIN + indent, top, { lineBreak: false })
  doc.y = top + doc.currentLineHeight() + gap
  doc.x = MARGIN
}

function sectionTitle(doc: Doc, title: string, subtitle?: string): void {
  ensureSpace(doc, 60)
  doc.moveDown(0.8)
  const y = doc.y
  doc.rect(MARGIN, y, 3.5, 16).fill(COLORS.accent)
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLORS.text)
    .text(title, MARGIN + 11, y + 2)
  if (subtitle) {
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(subtitle, MARGIN + 11, doc.y + 1)
  }
  doc.moveDown(0.6)
  doc.fillColor(COLORS.text)
}

function drawHeader(doc: Doc, stats: ReportStats, ctx: ReportPdfContext): void {
  const generatedAt = ctx.generatedAt ?? new Date()

  doc.rect(0, 0, PAGE_WIDTH, 96).fill(COLORS.accent)

  let textLeft = MARGIN
  if (ctx.logo) {
    try {
      doc.image(ctx.logo, MARGIN, 24, { fit: [48, 48] })
      textLeft = MARGIN + 60
    } catch {
      // Un logo illisible (SVG, WebP…) ne doit pas empêcher la génération du rapport
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#ffffff')
    .text(truncate(doc, ctx.formTitle || 'Formulaire', CONTENT_WIDTH - (textLeft - MARGIN)), textLeft, 26)
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#e0e7ff')
    .text(`Rapport ${stats.range.label}`, textLeft, doc.y + 2)
  doc
    .fontSize(8.5)
    .text(
      `${ctx.siteName} — généré le ${format(generatedAt, 'dd/MM/yyyy à HH:mm', { locale: fr })}`,
      textLeft,
      doc.y + 1
    )

  doc.y = 116
  doc.x = MARGIN
  doc.fillColor(COLORS.text)

  if (ctx.closingDate) {
    const closing = new Date(`${ctx.closingDate}T00:00:00`)
    if (!Number.isNaN(closing.getTime())) {
      const closed = closing.getTime() < generatedAt.getTime()
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(closed ? COLORS.negative : COLORS.muted)
        .text(
          closed
            ? `Formulaire clôturé le ${format(closing, 'dd/MM/yyyy', { locale: fr })} — les rapports ne couvrent plus de nouvelles réponses.`
            : `Clôture prévue le ${format(closing, 'dd/MM/yyyy', { locale: fr })}.`,
          MARGIN,
          doc.y
        )
      doc.moveDown(0.4)
      doc.fillColor(COLORS.text)
    }
  }
}

function drawKpis(doc: Doc, stats: ReportStats): void {
  const { totals } = stats

  const cards: { label: string; value: string; hint?: string; tone?: 'positive' | 'negative' }[] = [
    {
      label: 'Réponses sur la période',
      value: String(totals.inPeriod),
      hint: `${totals.allTime} au total depuis la création`,
    },
    {
      label: 'Moyenne par jour',
      value: totals.perDay.toLocaleString('fr-FR'),
      hint: `${totals.activeDays} jour(s) avec au moins une réponse`,
    },
    {
      label: 'Taux de remplissage moyen',
      value: `${totals.averageFillRate} %`,
      hint: `${totals.questionCount} question(s) analysée(s)`,
    },
  ]

  if (totals.deltaPercent !== null) {
    cards.push({
      label: 'Évolution',
      value: `${totals.deltaPercent > 0 ? '+' : ''}${totals.deltaPercent} %`,
      hint: `contre ${totals.previousPeriod} sur la période précédente`,
      tone: totals.deltaPercent >= 0 ? 'positive' : 'negative',
    })
  }
  if (totals.bestDay) {
    cards.push({
      label: 'Journée la plus active',
      value: totals.bestDay.label,
      hint: `${totals.bestDay.count} réponse(s)`,
    })
  }
  if (totals.lastAt) {
    cards.push({
      label: 'Dernière réponse',
      value: format(new Date(totals.lastAt), 'dd/MM/yyyy', { locale: fr }),
      hint: format(new Date(totals.lastAt), 'à HH:mm', { locale: fr }),
    })
  }

  const perRow = 3
  const gap = 10
  const cardWidth = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow
  const cardHeight = 60

  for (let i = 0; i < cards.length; i += perRow) {
    const row = cards.slice(i, i + perRow)
    ensureSpace(doc, cardHeight + gap)
    const top = doc.y

    row.forEach((card, index) => {
      const left = MARGIN + index * (cardWidth + gap)
      doc.roundedRect(left, top, cardWidth, cardHeight, 6).fillAndStroke(COLORS.accentSoft, COLORS.line)

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(truncate(doc, card.label.toUpperCase(), cardWidth - 16), left + 8, top + 8, {
          width: cardWidth - 16,
          lineBreak: false,
        })

      const valueColor =
        card.tone === 'positive' ? COLORS.positive : card.tone === 'negative' ? COLORS.negative : COLORS.text
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(valueColor)
        .text(truncate(doc, card.value, cardWidth - 16), left + 8, top + 21, {
          width: cardWidth - 16,
          lineBreak: false,
        })

      if (card.hint) {
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(COLORS.muted)
          .text(truncate(doc, card.hint, cardWidth - 16), left + 8, top + 42, {
            width: cardWidth - 16,
            lineBreak: false,
          })
      }
    })

    doc.y = top + cardHeight + gap
    doc.x = MARGIN
  }

  doc.fillColor(COLORS.text)
}

function drawTimeline(doc: Doc, stats: ReportStats): void {
  const points = stats.timeline
  if (points.length === 0) return

  const chartHeight = 110
  ensureSpace(doc, chartHeight + 34)

  const top = doc.y
  const baseline = top + chartHeight
  const max = Math.max(...points.map((p) => p.count), 1)

  // Au-delà d'une trentaine de barres les libellés deviennent illisibles : on n'affiche
  // alors qu'un libellé sur N.
  const slotWidth = CONTENT_WIDTH / points.length
  const barWidth = Math.max(2, Math.min(28, slotWidth * 0.62))
  const labelStep = Math.ceil(points.length / 16)

  doc.moveTo(MARGIN, baseline).lineTo(MARGIN + CONTENT_WIDTH, baseline).strokeColor(COLORS.line).lineWidth(1).stroke()

  points.forEach((point, index) => {
    const height = (point.count / max) * (chartHeight - 14)
    const left = MARGIN + index * slotWidth + (slotWidth - barWidth) / 2
    doc.rect(left, baseline - height, barWidth, height).fill(COLORS.bar)

    if (point.count > 0 && slotWidth > 18) {
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor(COLORS.muted)
        .text(String(point.count), left - 4, baseline - height - 9, {
          width: barWidth + 8,
          align: 'center',
          lineBreak: false,
        })
    }

    if (index % labelStep === 0) {
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(COLORS.muted)
        .text(point.label, MARGIN + index * slotWidth - 6, baseline + 5, {
          width: slotWidth + 12,
          align: 'center',
          lineBreak: false,
        })
    }
  })

  doc.y = baseline + 20
  doc.x = MARGIN
  doc.fillColor(COLORS.text)
}

function drawBarRow(
  doc: Doc,
  label: string,
  count: number,
  percent: number,
  maxCount: number,
  options: { suffix?: string } = {}
): void {
  const rowHeight = 15
  ensureSpace(doc, rowHeight + 2)

  const top = doc.y
  const labelWidth = 190
  const valueWidth = 78
  const trackLeft = MARGIN + labelWidth + 8
  const trackWidth = CONTENT_WIDTH - labelWidth - valueWidth - 16

  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text)
  doc.text(truncate(doc, label, labelWidth), MARGIN, top + 2, { width: labelWidth, lineBreak: false })

  doc.roundedRect(trackLeft, top + 2, trackWidth, 9, 4.5).fill(COLORS.barSoft)
  const filled = maxCount > 0 ? Math.max(0, (count / maxCount) * trackWidth) : 0
  if (filled > 0) doc.roundedRect(trackLeft, top + 2, Math.max(filled, 3), 9, 4.5).fill(COLORS.bar)

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(COLORS.text)
    .text(
      `${count}${options.suffix ?? ''}  ·  ${percent} %`,
      trackLeft + trackWidth + 8,
      top + 2,
      { width: valueWidth, align: 'right', lineBreak: false }
    )

  doc.y = top + rowHeight
  doc.x = MARGIN
}

function drawChoices(doc: Doc, stats: ReportStats): void {
  for (const stat of stats.choices) {
    ensureSpace(doc, 52)
    writeLine(doc, fieldTitle(stat), { font: 'Helvetica-Bold', size: 9.5 })

    const note = stat.unit
      ? `${stat.unit} — ${stat.answered} réponse(s) concernée(s)`
      : stat.multi
        ? `${stat.answered} réponse(s) — plusieurs options possibles, le total peut dépasser 100 %`
        : `${stat.answered} réponse(s)`
    writeLine(doc, note, { size: 7.5, color: COLORS.muted, gap: 3 })

    const maxCount = Math.max(...stat.options.map((o) => o.count), 1)
    for (const option of stat.options) {
      drawBarRow(doc, option.label, option.count, option.percent, maxCount)
    }
    doc.moveDown(0.5)
  }
}

function drawNumerics(doc: Doc, stats: ReportStats): void {
  const columns = [
    { key: 'label', title: 'Question', width: 175, align: 'left' as const },
    { key: 'count', title: 'Nb', width: 34, align: 'right' as const },
    { key: 'min', title: 'Min', width: 52, align: 'right' as const },
    { key: 'average', title: 'Moyenne', width: 60, align: 'right' as const },
    { key: 'median', title: 'Médiane', width: 60, align: 'right' as const },
    { key: 'max', title: 'Max', width: 52, align: 'right' as const },
    { key: 'sum', title: 'Total', width: 60, align: 'right' as const },
  ]

  drawTable(
    doc,
    columns.map((c) => ({ title: c.title, width: c.width, align: c.align })),
    stats.numerics.map((n) => [
      fieldTitle(n),
      String(n.count),
      String(n.min),
      String(n.average),
      String(n.median),
      String(n.max),
      String(n.sum),
    ])
  )
}

function drawFreeform(doc: Doc, stats: ReportStats, settings: FormReportSettings): void {
  for (const stat of stats.freeform) {
    ensureSpace(doc, 46)
    writeLine(doc, fieldTitle(stat), { font: 'Helvetica-Bold', size: 9.5 })
    writeLine(doc, `${stat.answered} réponse(s) renseignée(s)`, {
      size: 7.5,
      color: COLORS.muted,
      gap: 3,
    })

    if (stat.top.length > 0) {
      const maxCount = Math.max(...stat.top.map((t) => t.count), 1)
      for (const entry of stat.top.slice(0, 8)) {
        drawBarRow(
          doc,
          entry.value,
          entry.count,
          stat.answered > 0 ? Math.round((entry.count / stat.answered) * 1000) / 10 : 0,
          maxCount
        )
      }
    }

    if (settings.textSampleSize > 0 && stat.samples.length > 0) {
      ensureSpace(doc, 20)
      writeLine(doc, 'Dernières réponses :', { font: 'Helvetica-Oblique', size: 7.5, color: COLORS.muted })
      for (const sample of stat.samples) {
        ensureSpace(doc, 12)
        writeLine(doc, `• ${sample}`, { size: 8, indent: 6 })
      }
    }

    doc.moveDown(0.6)
  }
}

function drawCompletion(doc: Doc, stats: ReportStats): void {
  const maxCount = Math.max(...stats.completion.map((c) => c.answered), 1)
  for (const stat of stats.completion) {
    drawBarRow(
      doc,
      `${fieldTitle(stat)}${stat.required ? ' *' : ''}`,
      stat.answered,
      stat.rate,
      maxCount
    )
  }
  doc.moveDown(0.2)
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text('* question obligatoire', MARGIN, doc.y)
  doc.fillColor(COLORS.text)
}

function drawTable(
  doc: Doc,
  columns: { title: string; width: number; align?: 'left' | 'right' }[],
  rows: string[][]
): void {
  if (rows.length === 0) return

  const total = columns.reduce((acc, c) => acc + c.width, 0)
  const scale = CONTENT_WIDTH / total
  const widths = columns.map((c) => c.width * scale)

  const drawHeaderRow = () => {
    const top = doc.y
    doc.rect(MARGIN, top, CONTENT_WIDTH, 18).fill(COLORS.accentSoft)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.text)
    let left = MARGIN
    columns.forEach((column, index) => {
      doc.text(truncate(doc, column.title, widths[index] - 8), left + 4, top + 5, {
        width: widths[index] - 8,
        align: column.align ?? 'left',
        lineBreak: false,
      })
      left += widths[index]
    })
    doc.y = top + 18
    doc.x = MARGIN
  }

  ensureSpace(doc, 40)
  drawHeaderRow()

  rows.forEach((row, rowIndex) => {
    if (doc.y + 16 > PAGE_BOTTOM) {
      doc.addPage()
      drawHeaderRow()
    }
    const top = doc.y
    if (rowIndex % 2 === 1) doc.rect(MARGIN, top, CONTENT_WIDTH, 16).fill('#f9fafb')

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text)
    let left = MARGIN
    row.forEach((cell, index) => {
      doc.text(truncate(doc, cell, widths[index] - 8), left + 4, top + 4, {
        width: widths[index] - 8,
        align: columns[index]?.align ?? 'left',
        lineBreak: false,
      })
      left += widths[index]
    })

    doc
      .moveTo(MARGIN, top + 16)
      .lineTo(MARGIN + CONTENT_WIDTH, top + 16)
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .stroke()

    doc.y = top + 16
    doc.x = MARGIN
  })

  doc.moveDown(0.5)
}

function drawFooters(doc: Doc, ctx: ReportPdfContext): void {
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)

    // Le pied de page s'écrit sous la marge basse : sans neutraliser celle-ci, pdfkit considère
    // que le texte déborde et ajoute une page vide à chaque itération.
    const bottomMargin = doc.page.margins.bottom
    doc.page.margins.bottom = 0

    const y = 841.89 - MARGIN + 4
    doc
      .moveTo(MARGIN, y - 6)
      .lineTo(MARGIN + CONTENT_WIDTH, y - 6)
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .stroke()
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    doc.text(truncate(doc, `${ctx.siteName} — ${ctx.formTitle}`, CONTENT_WIDTH - 60), MARGIN, y, {
      width: CONTENT_WIDTH - 60,
      lineBreak: false,
    })
    doc.text(`${i + 1} / ${range.count}`, MARGIN + CONTENT_WIDTH - 60, y, {
      width: 60,
      align: 'right',
      lineBreak: false,
    })

    doc.page.margins.bottom = bottomMargin
  }
}

export function buildReportPdf(
  stats: ReportStats,
  settings: FormReportSettings,
  ctx: ReportPdfContext
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // bufferPages est indispensable à la pagination « n / total » : le nombre de pages n'est
    // connu qu'une fois tout le contenu écrit.
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    try {
      drawHeader(doc, stats, ctx)

      if (stats.totals.inPeriod === 0) {
        doc.moveDown(2)
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(COLORS.text)
          .text('Aucune réponse sur cette période', { align: 'center' })
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(
            `Le formulaire totalise ${stats.totals.allTime} réponse(s) toutes périodes confondues.`,
            { align: 'center' }
          )
        drawFooters(doc, ctx)
        doc.end()
        return
      }

      if (settings.sections.summary) {
        sectionTitle(doc, 'Indicateurs clés', stats.range.label)
        drawKpis(doc, stats)
      }

      if (settings.sections.timeline && stats.timeline.length > 0) {
        const unit =
          stats.timelineGranularity === 'day'
            ? 'par jour'
            : stats.timelineGranularity === 'week'
              ? 'par semaine'
              : 'par mois'
        sectionTitle(doc, 'Évolution des réponses', `Nombre de réponses ${unit}`)
        drawTimeline(doc, stats)
      }

      if (settings.sections.choiceBreakdown && stats.choices.length > 0) {
        sectionTitle(
          doc,
          'Répartition des réponses',
          'Pourcentages calculés sur les réponses ayant renseigné la question'
        )
        drawChoices(doc, stats)
      }

      if (settings.sections.numericStats && stats.numerics.length > 0) {
        sectionTitle(doc, 'Valeurs numériques', 'Minimum, moyenne, médiane, maximum et cumul')
        drawNumerics(doc, stats)
      }

      if (settings.sections.textAnswers && stats.freeform.length > 0) {
        sectionTitle(
          doc,
          'Réponses libres',
          'Valeurs revenant plusieurs fois, puis les dernières réponses reçues'
        )
        drawFreeform(doc, stats, settings)
      }

      if (settings.sections.completion && stats.completion.length > 0) {
        sectionTitle(doc, 'Taux de remplissage par question', 'Part des réponses ayant renseigné le champ')
        drawCompletion(doc, stats)
      }

      if (settings.sections.responseTable && stats.tableRows.length > 0) {
        sectionTitle(
          doc,
          'Dernières réponses',
          `${stats.tableRows.length} réponse(s) affichée(s) sur ${stats.totals.inPeriod}`
        )
        drawTable(
          doc,
          stats.tableHeaders.map((title, index) => ({
            title,
            width: index === 0 ? 90 : 110,
          })),
          stats.tableRows
        )
      }

      drawFooters(doc, ctx)
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
