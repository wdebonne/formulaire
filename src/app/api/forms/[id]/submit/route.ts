import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { formatDateString, resolveDataLabels } from '@/lib/response-format'
import { parseFormDocumentSettings } from '@/lib/docx-template'
import { sendDocumentForResponse } from '@/lib/document-delivery'
import { resolveFormGate, submittedCookieName, SUBMITTED_COOKIE_MAX_AGE } from '@/lib/form-gate'
import { sendWebhook, type WebhookConfig } from '@/lib/webhook-send'
import { enqueueWebhookRetry } from '@/lib/webhook-queue'
import { evaluateSubmissionAntiSpam } from '@/lib/form-antispam'
import { parseFormAccessSettings } from '@/lib/form-options'
import { getClientIp } from '@/lib/security'

// POST /api/forms/[id]/submit - Soumettre une réponse à un formulaire
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { data, metadata, honeypot, renderToken } = body

    // Vérifier que le formulaire existe et est publié
    const form = await prisma.form.findFirst({
      where: {
        id,
        status: 'published',
        deletedAt: null,
      },
    })

    if (!form) {
      return NextResponse.json(
        { error: 'Formulaire non trouvé ou non publié' },
        { status: 404 }
      )
    }

    // Anti-spam avant la porte d'accès : un flot automatisé doit être arrêté avant les requêtes
    // de comptage, et surtout avant les webhooks et les e-mails que déclenche une réponse admise.
    const antiSpam = evaluateSubmissionAntiSpam(parseFormAccessSettings(form.accessSettings), {
      formId: form.id,
      ip: getClientIp(request),
      honeypot,
      renderToken,
    })
    if (antiSpam.verdict === 'discard') {
      // Le leurre a été rempli : la réponse est jetée et l'appelant reçoit un succès. Lui
      // signaler l'échec reviendrait à lui indiquer quel champ laisser vide au prochain essai.
      console.warn(`Soumission ignorée (anti-spam: ${antiSpam.reason}) sur le formulaire ${form.id}`)
      return NextResponse.json({ success: true })
    }
    if (antiSpam.verdict === 'reject') {
      return NextResponse.json({ error: antiSpam.message }, { status: antiSpam.status })
    }

    // Les options d'accès sont revérifiées ici et pas seulement au rendu de la page : sans ce
    // contrôle, une requête forgée contournerait la fenêtre de publication, le mot de passe ou
    // le quota de réponses.
    const gate = await resolveFormGate(form)
    if (gate.state !== 'open') {
      return NextResponse.json({ error: gate.message }, { status: 403 })
    }

    // Résoudre les valeurs de choix (slugs → labels) avant stockage
    const blocks = JSON.parse(form.blocks || '[]') as any[]
    const resolvedData = resolveDataLabels(data, blocks)

    // Créer la réponse
    const response = await prisma.response.create({
      data: {
        formId: id,
        data: JSON.stringify(resolvedData),
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    })

    // Déclencher les webhooks
    const webhooks = JSON.parse(form.webhooks || '[]') as any[]
    // La soumission est le seul déclencheur qui existe : filtrer sur `triggerOn` laissait
    // muets les webhooks enregistrés avec une des valeurs fictives proposées autrefois par
    // l'éditeur ('partial', 'save'), sans que rien ne le signale.
    const enabledWebhooks = webhooks.filter((w) => w.enabled)

    // Stocker les résultats des webhooks
    const webhookStatus: Record<string, { success: boolean; lastSent: string; error?: string }> = {}

    // Premier envoi, synchrone : la grande majorité aboutit du premier coup, et la page des
    // réponses doit afficher le résultat tout de suite. Seul un échec passe en file de reprise.
    for (const webhook of enabledWebhooks as WebhookConfig[]) {
      try {
        await sendWebhook(webhook, data, form, response.id)
        webhookStatus[webhook.id] = {
          success: true,
          lastSent: new Date().toISOString(),
        }
      } catch (webhookError: any) {
        console.error(`Erreur webhook ${webhook.name}:`, webhookError)
        webhookStatus[webhook.id] = {
          success: false,
          lastSent: new Date().toISOString(),
          error: webhookError.message || 'Erreur inconnue',
        }
        // Le statut seul laissait la perte silencieuse : la réponse était bien enregistrée, mais
        // l'application destinataire ne la voyait jamais et personne n'était prévenu.
        await enqueueWebhookRetry(response.id, webhook, webhookError)
      }
    }

    // Mettre à jour le statut webhook de la réponse
    if (enabledWebhooks.length > 0) {
      await prisma.response.update({
        where: { id: response.id },
        data: { webhookStatus: JSON.stringify(webhookStatus) },
      })
    }

    // E-mails déclenchés par la réponse. Aucun modèle Word n'est exigé ici : un circuit peut
    // n'être qu'un accusé de réception au répondant ou une notification à l'équipe, et
    // sendDocumentForResponse ne produit le document que pour les circuits qui le réclament.
    // Il ne lève jamais et enregistre son propre statut : un modèle cassé ou un SMTP
    // injoignable ne doit pas faire échouer la soumission côté répondant.
    const documentSettings = parseFormDocumentSettings(form.documentSettings)
    if (
      documentSettings.email.enabled &&
      documentSettings.email.sendOnSubmission &&
      documentSettings.email.routes.some((route) => route.enabled)
    ) {
      await sendDocumentForResponse(form, response)
    }

    const result = NextResponse.json({
      success: true,
      responseId: response.id,
    })

    if (gate.settings.onePerDevice) {
      result.cookies.set(submittedCookieName(form.id), '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SUBMITTED_COOKIE_MAX_AGE,
        path: '/',
      })
    }

    return result
  } catch (error) {
    console.error('Erreur lors de la soumission:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
