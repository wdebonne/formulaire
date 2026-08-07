import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { inspectDocxTags, parseFormDocumentSettings } from '@/lib/docx-template'
import { readTemplateFile } from '@/lib/document-storage'
import { isPdfConversionAvailable } from '@/lib/pdf-convert'
import { prisma } from '@/lib/prisma'
import type { DocumentFieldMapping, FormDocumentSettings } from '@/types/form'

// GET /api/forms/[id]/document — réglages du modèle et de l'e-mail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    mappings.push({ tag, blockId: blockId as DocumentFieldMapping['blockId'] })
  }
  return mappings
}

function sanitizeAddresses(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return Array.from(new Set(input.map((v) => String(v).trim()).filter((v) => emailRe.test(v))))
}

// PUT /api/forms/[id]/document — enregistre les deux modales (modèle + e-mail)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      outputFormat,
    },
    email: {
      ...current.email,
      ...(body?.email?.enabled !== undefined && { enabled: Boolean(body.email.enabled) }),
      ...(body?.email?.sendOnSubmission !== undefined && {
        sendOnSubmission: Boolean(body.email.sendOnSubmission),
      }),
      ...(body?.email?.recipients !== undefined && {
        recipients: sanitizeAddresses(body.email.recipients),
      }),
      ...(body?.email?.recipientBlockIds !== undefined && {
        recipientBlockIds: Array.isArray(body.email.recipientBlockIds)
          ? body.email.recipientBlockIds.map(String)
          : [],
      }),
      ...(body?.email?.subject !== undefined && {
        subject: String(body.email.subject).slice(0, 300),
      }),
      ...(body?.email?.body !== undefined && { body: String(body.email.body).slice(0, 20000) }),
    },
  }

  await prisma.form.update({
    where: { id },
    data: { documentSettings: JSON.stringify(next) },
  })

  return NextResponse.json({ ...next, pdfAvailable })
}
