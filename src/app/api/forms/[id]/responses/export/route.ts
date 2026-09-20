import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { prisma } from '@/lib/prisma'
import { resolveReportRange } from '@/lib/report-stats'
import { parseManualPeriod } from '@/lib/manual-period'
import { buildExportTable, exportFileName, toCsv } from '@/lib/response-export'
import * as XLSX from 'xlsx'

// POST /api/forms/[id]/responses/export — export des réponses en CSV ou en Excel.
//
// La période est résolue **côté serveur** par resolveReportRange(), la même fonction que les
// rapports : la modale annonce donc exactement les lignes que le fichier contiendra, et une
// borne reçue du navigateur ne sert qu'à choisir un mode, jamais à désigner directement un
// intervalle de lignes.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'read')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const fileFormat = body?.format === 'csv' ? 'csv' : 'xlsx'
    const period = parseManualPeriod(body?.period)
    const range = resolveReportRange({ period })

    const responses = await prisma.response.findMany({
      where: {
        formId: id,
        createdAt: {
          ...(range.from && { gte: range.from }),
          lte: range.to,
        },
      },
      select: { data: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const blocks = JSON.parse(form.blocks)
    const table = buildExportTable(
      blocks,
      responses.map((response) => ({
        data: safeParse(response.data),
        createdAt: response.createdAt,
      }))
    )

    const baseName = exportFileName(form.title, range.from, range.to)

    if (fileFormat === 'csv') {
      // Le BOM est ce qui fait ouvrir le fichier en UTF-8 par Excel plutôt qu'en ANSI.
      const body = '\ufeff' + toCsv(table)
      return fileResponse(Buffer.from(body, 'utf-8'), `${baseName}.csv`, 'text/csv; charset=utf-8')
    }

    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows])
    // Largeurs mesurées sur le contenu : sans elles, une colonne de verbatims s'ouvre à la
    // largeur par défaut et son contenu reste invisible. Le figeage des en-têtes, lui, n'est
    // pas écrit par l'édition communautaire de SheetJS — ne pas le promettre.
    sheet['!cols'] = table.headers.map((header, index) => ({
      wch: columnWidth(header, table.rows, index),
    }))
    XLSX.utils.book_append_sheet(workbook, sheet, 'Réponses')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return fileResponse(
      buffer,
      `${baseName}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  } catch (error) {
    console.error('Erreur lors de l\'export des réponses:', error)
    return NextResponse.json({ error: 'Impossible de générer l\'export' }, { status: 500 })
  }
}

function safeParse(raw: string | null): Record<string, any> {
  try {
    if (!raw || !raw.trim()) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const MIN_COLUMN_WIDTH = 12
const MAX_COLUMN_WIDTH = 50

function columnWidth(header: string, rows: string[][], index: number): number {
  let widest = header.length
  for (const row of rows) {
    const cell = row[index]
    if (cell && cell.length > widest) widest = cell.length
  }
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, widest + 2))
}

// Deux formes de `filename` : l'ASCII pour les clients anciens, la forme RFC 5987 pour les
// autres — sans quoi un titre accentué arrive percent-échappé dans le nom du fichier.
function fileResponse(buffer: Buffer, fileName: string, contentType: string): NextResponse {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
