import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { resolveDataLabels } from '@/lib/response-format'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'

// POST export des réponses sélectionnées (revues par l'admin) :
//  - format "xlsx" : portabilité — toutes les réponses en clair, regroupées par formulaire
//  - format "pdf"  : récapitulatif simple (formulaire + date de soumission), à transmettre à la personne
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const responseIds: string[] = Array.isArray(body.responseIds) ? body.responseIds.filter((v: any) => typeof v === 'string') : []
    const exportFormat = body.format === 'pdf' ? 'pdf' : body.format === 'xlsx' ? 'xlsx' : null

    if (responseIds.length === 0 || !exportFormat) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const responses = await prisma.response.findMany({
      where: { id: { in: responseIds } },
      orderBy: { createdAt: 'desc' },
      include: { form: { select: { id: true, title: true, blocks: true } } },
    })

    if (exportFormat === 'pdf') {
      const buffer = await buildSummaryPdf(responses)
      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="recapitulatif-rgpd.pdf"',
        },
      })
    }

    const buffer = buildPortabilityWorkbook(responses)
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="export-donnees-rgpd.xlsx"',
      },
    })
  } catch (error) {
    console.error('GDPR export error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

type ExportResponse = {
  id: string
  formId: string
  data: string
  createdAt: Date
  form: { id: string; title: string; blocks: string }
}

// Classeur de portabilité : une feuille par formulaire, une ligne par réponse,
// une colonne par champ — valeurs résolues en clair (labels de choix, dates formatées…)
function buildPortabilityWorkbook(responses: ExportResponse[]): Buffer {
  const wb = XLSX.utils.book_new()
  const byForm = groupByForm(responses)

  for (const group of Array.from(byForm.values())) {
    const blocks = JSON.parse(group.form.blocks) as any[]
    const fieldKeys: string[] = []
    const resolvedRows: Record<string, any>[] = []

    for (const r of group.items) {
      const data = JSON.parse(r.data) as Record<string, any>
      const resolved = resolveDataLabels(data, blocks)
      resolvedRows.push({ __date: r.createdAt, ...resolved })
      for (const key of Object.keys(resolved)) {
        if (!fieldKeys.includes(key)) fieldKeys.push(key)
      }
    }

    const headerRow = ['Date de soumission', ...fieldKeys.map((key) => describeField(key, blocks))]
    const dataRows = resolvedRows.map((row) => [
      format(new Date(row.__date), 'dd/MM/yyyy HH:mm', { locale: fr }),
      ...fieldKeys.map((key) => stringifyValue(row[key])),
    ])

    const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    const sheetName = sanitizeSheetName(group.form.title)
    XLSX.utils.book_append_sheet(wb, sheet, sheetName)
  }

  const arrayBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return arrayBuffer as Buffer
}

// Récapitulatif PDF : liste simple "Formulaire — Date de soumission", à transmettre à la personne
// pour qu'elle puisse vérifier les données détenues avant une éventuelle demande d'effacement.
function buildSummaryPdf(responses: ExportResponse[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(16).text('Récapitulatif des réponses détenues', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#666').text(
      `Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })} — ${responses.length} réponse(s)`,
      { align: 'center' }
    )
    doc.moveDown(1.5)
    doc.fillColor('#000')

    responses.forEach((r, index) => {
      const date = format(new Date(r.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })
      doc.fontSize(11).text(`${index + 1}. `, { continued: true })
      doc.font('Helvetica-Bold').text(r.form.title, { continued: true })
      doc.font('Helvetica').text(`  —  soumise le ${date}`)
      doc.moveDown(0.3)
    })

    doc.end()
  })
}

function groupByForm(responses: ExportResponse[]): Map<string, { form: ExportResponse['form']; items: ExportResponse[] }> {
  const map = new Map<string, { form: ExportResponse['form']; items: ExportResponse[] }>()
  for (const r of responses) {
    const entry = map.get(r.formId)
    if (entry) {
      entry.items.push(r)
    } else {
      map.set(r.formId, { form: r.form, items: [r] })
    }
  }
  return map
}

// Construit un libellé lisible pour une clé de donnée (gère les blocs directs, de groupe et de répéteur)
function describeField(key: string, blocks: any[]): string {
  const repeaterMatch = key.match(/^(.+)_(\d+)_(.+)$/)
  if (repeaterMatch) {
    const [, repeaterId, rep, innerId] = repeaterMatch
    const repeater = blocks.find((b) => b.id === repeaterId)
    const inner = repeater?.innerBlocks?.find((ib: any) => ib.id === innerId)
    if (repeater && inner) {
      return `${repeater.attributes?.label || repeaterId} #${rep} — ${inner.attributes?.label || innerId}`
    }
  }

  for (const block of blocks) {
    if (block.innerBlocks?.length) {
      const inner = block.innerBlocks.find((ib: any) => ib.id === key)
      if (inner) return `${block.attributes?.label || block.id} — ${inner.attributes?.label || inner.id}`
    }
  }

  const block = blocks.find((b) => b.id === key)
  if (block) return block.attributes?.label || block.id

  return key
}

function stringifyValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return value.map(stringifyValue).join(', ')
  if (typeof value === 'object') return Object.values(value).map(stringifyValue).join(', ')
  return String(value)
}

// Les noms de feuille Excel ne peuvent pas dépasser 31 caractères ni contenir certains caractères spéciaux
function sanitizeSheetName(title: string): string {
  return title.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Formulaire'
}
