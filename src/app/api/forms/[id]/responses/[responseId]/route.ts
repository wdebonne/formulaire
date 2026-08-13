import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getAccessibleForm } from '@/lib/form-access'
import { findBlockDeep, resolveDataLabels } from '@/lib/response-format'
import { logEvent } from '@/lib/audit-log'
import { getClientIp } from '@/lib/security'

// PATCH /api/forms/[id]/responses/[responseId] - Corriger les valeurs d'une réponse
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id, responseId } = await params

    const form = await getAccessibleForm(id, session, 'write')
    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    const response = await prisma.response.findFirst({
      where: { id: responseId, formId: id },
    })

    if (!response) {
      return NextResponse.json({ error: 'Réponse non trouvée' }, { status: 404 })
    }

    const body = await request.json()
    const incoming = body?.data
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    const blocks = JSON.parse(form.blocks || '[]') as any[]
    const existing = JSON.parse(response.data || '{}') as Record<string, any>

    // On n'accepte que les clés correspondant à un bloc du formulaire (y compris les clés de
    // répéteur {repeaterId}_{n}_{innerId}) ou déjà présentes dans la réponse : une clé arbitraire
    // envoyée par le client ne doit pas pouvoir polluer les données stockées.
    const isKnownKey = (key: string): boolean => {
      if (key in existing) return true
      if (findBlockDeep(blocks, key)) return true
      const match = key.match(/^(.+)_(\d+)_(.+)$/)
      return Boolean(match && findBlockDeep(blocks, match[3]))
    }

    const changed: Record<string, any> = {}
    for (const [key, value] of Object.entries(incoming)) {
      if (!isKnownKey(key)) continue
      if (JSON.stringify(value) === JSON.stringify(existing[key])) continue
      changed[key] = value
    }

    // Même normalisation qu'à la soumission (slugs → libellés, dates formatées), pour que les
    // valeurs corrigées soient stockées exactement comme celles saisies par le répondant.
    // Appliquée aux seules clés modifiées : les autres restent strictement telles qu'enregistrées.
    const merged = { ...existing, ...resolveDataLabels(changed, blocks) }

    const updated = await prisma.response.update({
      where: { id: responseId },
      data: { data: JSON.stringify(merged) },
    })

    const editedFields = Object.keys(changed).filter(
      (key) => JSON.stringify(existing[key]) !== JSON.stringify(merged[key])
    )

    await logEvent({
      action: 'response.update',
      userId: session.userId,
      userEmail: session.email,
      ipAddress: getClientIp(request),
      targetType: 'form',
      targetId: form.id,
      targetLabel: form.title,
      metadata: {
        responseId,
        fields: editedFields,
      },
    })

    return NextResponse.json({
      success: true,
      response: { ...updated, data: merged },
      editedFields,
    })
  } catch (error) {
    console.error('Erreur lors de la modification de la réponse:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/forms/[id]/responses/[responseId] - Supprimer une réponse
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id, responseId } = await params

    // Vérifier que le formulaire appartient à l'utilisateur
    const form = await prisma.form.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulaire non trouvé' }, { status: 404 })
    }

    // Vérifier que la réponse existe et appartient au formulaire
    const response = await prisma.response.findFirst({
      where: {
        id: responseId,
        formId: id,
      },
    })

    if (!response) {
      return NextResponse.json({ error: 'Réponse non trouvée' }, { status: 404 })
    }

    await prisma.response.delete({
      where: {
        id: responseId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression de la réponse:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
