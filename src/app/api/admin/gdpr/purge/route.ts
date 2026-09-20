import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { deleteFilesOfResponses } from '@/lib/response-uploads'
import { getClientIp } from '@/lib/security'
import { logEvent } from '@/lib/audit-log'

// POST suppression ciblée de réponses (droit à l'effacement RGPD), à partir d'une liste d'IDs
// explicitement revus par l'admin dans l'écran de recherche — jamais d'une requête de recherche
// ré-exécutée côté serveur, pour garantir que seules les réponses vérifiées sont supprimées.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const responseIds: string[] = Array.isArray(body.responseIds) ? body.responseIds.filter((v: any) => typeof v === 'string') : []

    if (responseIds.length === 0) {
      return NextResponse.json({ error: 'Aucune réponse sélectionnée' }, { status: 400 })
    }

    const doomed = await prisma.response.findMany({
      where: { id: { in: responseIds } },
      select: { formId: true, data: true },
    })
    // Les pièces jointes vivent sur le disque, hors de la base : les laisser derrière
    // ferait survivre le fichier à la réponse qui le référençait.
    await deleteFilesOfResponses(doomed)

    const result = await prisma.response.deleteMany({
      where: { id: { in: responseIds } },
    })

    // Le journal retient le nombre et l'auteur, jamais le terme recherché ni une valeur de
    // réponse : il ne doit pas devenir une seconde copie des données qu'on vient d'effacer.
    await logEvent({
      action: 'gdpr.erasure',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'response',
      targetLabel: `${result.count} réponse(s)`,
      metadata: { deleted: result.count, requested: responseIds.length },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('GDPR purge error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
