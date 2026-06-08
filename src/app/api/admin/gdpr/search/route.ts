import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { findBlockDeep, formatBlockValue } from '@/lib/response-format'

const MAX_RESULTS = 500

// POST recherche globale (tous formulaires) d'une personne dans les réponses, par nom/email/texte libre.
// En POST (et non GET) pour éviter que le terme recherché — une donnée personnelle — ne se retrouve
// dans les journaux d'accès du serveur (URL/query string).
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { query } = await request.json()
    const term = typeof query === 'string' ? query.trim() : ''
    if (term.length < 2) {
      return NextResponse.json({ error: 'Le terme recherché doit contenir au moins 2 caractères' }, { status: 400 })
    }

    const matches = await prisma.response.findMany({
      where: { data: { contains: term } },
      orderBy: { createdAt: 'desc' },
      take: MAX_RESULTS + 1,
      include: { form: { select: { id: true, title: true, slug: true, blocks: true } } },
    })

    const truncated = matches.length > MAX_RESULTS
    const results = matches.slice(0, MAX_RESULTS).map((r) => {
      const data = JSON.parse(r.data) as Record<string, any>
      const blocks = JSON.parse(r.form.blocks) as any[]
      const snippet = findMatchingSnippet(data, blocks, term)

      return {
        id: r.id,
        formId: r.formId,
        formTitle: r.form.title,
        createdAt: r.createdAt,
        snippet,
      }
    })

    return NextResponse.json({ results, truncated })
  } catch (error) {
    console.error('GDPR search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Trouve le premier champ de la réponse dont la valeur (résolue en libellé lisible) contient le terme,
// et retourne un extrait "Label : valeur" pour aider l'admin à confirmer la pertinence du résultat.
function findMatchingSnippet(data: Record<string, any>, blocks: any[], term: string): string {
  const termLower = term.toLowerCase()

  for (const [key, rawValue] of Object.entries(data)) {
    const block = findBlockDeep(blocks, key)
    const value = formatBlockValue(block, rawValue)
    const text = valueToText(value)
    if (text.toLowerCase().includes(termLower)) {
      const label = block?.attributes?.label || key
      return `${label} : ${text}`
    }
  }

  return '—'
}

function valueToText(value: any): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(valueToText).join(', ')
  if (typeof value === 'object') return Object.values(value).map(valueToText).join(', ')
  return String(value)
}
