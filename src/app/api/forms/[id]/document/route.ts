import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { inspectDocxTags, parseFormDocumentSettings } from '@/lib/docx-template'
import { readTemplateFile } from '@/lib/document-storage'
import { isPdfConversionAvailable } from '@/lib/pdf-convert'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type {
  DocumentEmailRoute,
  DocumentFieldMapping,
  FormDocumentSettings,
  LogicCondition,
} from '@/types/form'

// GET /api/forms/[id]/document — réglages du modèle et de l'e-mail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'read')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const settings = parseFormDocumentSettings(form.documentSettings)

    // Jetons réellement présents dans le .docx enregistré : alimente le tableau de contrôle
    // de la modale (jeton reconnu / jeton inconnu / champ non utilisé).
    let tags: string[] = []
    let templateError: string | undefined
    if (settings.template.storedName) {
      try {
        tags = inspectDocxTags(await readTemplateFile(settings.template.storedName))
      } catch (error: any) {
        templateError = error?.message || 'Modèle illisible'
      }
    }

    return NextResponse.json({
      ...settings,
      tags,
      templateError,
      pdfAvailable: await isPdfConversionAvailable(),
    })
  } catch (error) {
    console.error('Erreur lors de la lecture des réglages document:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function sanitizeMappings(input: unknown): DocumentFieldMapping[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const mappings: DocumentFieldMapping[] = []
  for (const raw of input) {
    const tag = String(raw?.tag ?? '').trim()
    const blockId = String(raw?.blockId ?? '').trim()
    // Les jetons doivent rester des identifiants simples : docxtemplater les lit tels quels
    // dans le XML du document.
    if (!tag || !blockId || !/^[a-z0-9_]+$/i.test(tag) || seen.has(tag)) continue
    seen.add(tag)
    mappings.push({
      tag,
      blockId: blockId as DocumentFieldMapping['blockId'],
      ...(raw?.choiceValue !== undefined && { choiceValue: String(raw.choiceValue) }),
    })
  }
  return mappings
}

const CONDITION_OPERATORS = new Set([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
])

function sanitizeConditions(input: unknown): LogicCondition[] {
  if (!Array.isArray(input)) return []
  const conditions: LogicCondition[] = []
  for (const raw of input) {
    const blockId = String(raw?.blockId ?? '').trim()
    const operator = String(raw?.operator ?? '')
    if (!blockId || !CONDITION_OPERATORS.has(operator)) continue
    conditions.push({
      blockId,
      operator: operator as LogicCondition['operator'],
      value: String(raw?.value ?? '').slice(0, 500),
    })
  }
  return conditions
}

function sanitizeRoutes(input: unknown, current: DocumentEmailRoute[]): DocumentEmailRoute[] {
  if (!Array.isArray(input)) return current
  const routes: DocumentEmailRoute[] = []
  const seen = new Set<string>()
  for (const raw of input.slice(0, 50)) {
    const id = String(raw?.id ?? '').trim() || randomUUID()
    if (seen.has(id)) continue
    seen.add(id)
    routes.push({
      id,
      name: String(raw?.name ?? '').trim().slice(0, 120) || 'Circuit',
      enabled: raw?.enabled !== false,
      conditions: sanitizeConditions(raw?.conditions),
      conditionMatch: raw?.conditionMatch === 'any' ? 'any' : 'all',
      recipients: sanitizeAddresses(raw?.recipients),
      recipientBlockIds: Array.isArray(raw?.recipientBlockIds)
        ? raw.recipientBlockIds.map(String).slice(0, 50)
        : [],
      subject: String(raw?.subject ?? '').slice(0, 300),
      body: String(raw?.body ?? '').slice(0, 20000),
      attachDocument: raw?.attachDocument !== false,
    })
  }
  return routes
}

function sanitizeAddresses(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return Array.from(new Set(input.map((v) => String(v).trim()).filter((v) => emailRe.test(v))))
}

// PUT /api/forms/[id]/document — enregistre les deux modales (modèle + e-mail)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    const form = await getAccessibleForm(id, session, 'write')
    if (!form) return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })

    const body = await request.json()
    const current = parseFormDocumentSettings(form.documentSettings)

    // Le PDF ne peut être sélectionné que si un convertisseur vérifié existe : sans ce garde-fou,
    // un réglage laissé en base continuerait de s'appliquer après retrait du convertisseur.
    const pdfAvailable = await isPdfConversionAvailable()
    const requestedFormat = body?.template?.outputFormat
    const outputFormat =
      requestedFormat === 'pdf' && pdfAvailable ? 'pdf' : ('docx' as const)

    const next: FormDocumentSettings = {
      template: {
        ...current.template,
        ...(body?.template?.mappings !== undefined && {
          mappings: sanitizeMappings(body.template.mappings),
        }),
        ...(body?.template?.outputName !== undefined && {
          outputName: String(body.template.outputName).slice(0, 200),
        }),
        ...(body?.template?.checkboxStyle !== undefined && {
          checkboxStyle: body.template.checkboxStyle === 'wingdings' ? 'wingdings' : 'unicode',
        }),
        outputFormat,
      },
      email: {
        ...current.email,
        ...(body?.email?.enabled !== undefined && { enabled: Boolean(body.email.enabled) }),
        ...(body?.email?.sendOnSubmission !== undefined && {
          sendOnSubmission: Boolean(body.email.sendOnSubmission),
        }),
        ...(body?.email?.routes !== undefined && {
          routes: sanitizeRoutes(body.email.routes, current.email.routes),
        }),
      },
    }

    await prisma.form.update({
      where: { id },
      data: { documentSettings: JSON.stringify(next) },
    })

    return NextResponse.json({ ...next, pdfAvailable })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des réglages document:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
