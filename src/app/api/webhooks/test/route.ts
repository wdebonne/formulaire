import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'dns/promises'
import { getSession } from '@/lib/auth'

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0)|^::1$|^(fc|fd)[0-9a-f]{2,}:/i
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', 'metadata.google.internal'])

async function isSafeWebhookUrl(rawUrl: string): Promise<{ safe: boolean; reason?: string }> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { safe: false, reason: 'URL invalide' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: 'Protocole non autorisé (http/https uniquement)' }
  }

  const hostname = parsed.hostname

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase()) || PRIVATE_IP_RE.test(hostname)) {
    return { safe: false, reason: 'Adresse privée ou locale non autorisée' }
  }

  try {
    const resolved = await lookup(hostname)
    if (PRIVATE_IP_RE.test(resolved.address)) {
      return { safe: false, reason: 'Le nom d\'hôte pointe vers une adresse IP privée' }
    }
  } catch {
    return { safe: false, reason: 'Impossible de résoudre le nom d\'hôte' }
  }

  return { safe: true }
}

// POST /api/webhooks/test - Tester un webhook
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { url, method, headers, data, bodyFormat } = body

    if (!url) {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    }

    const urlCheck = await isSafeWebhookUrl(url)
    if (!urlCheck.safe) {
      return NextResponse.json({ error: urlCheck.reason ?? 'URL non autorisée' }, { status: 400 })
    }

    // Construire les headers
    const requestHeaders: Record<string, string> = {}

    // Ajouter les headers personnalisés
    if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (key && value) {
          requestHeaders[key] = String(value)
        }
      }
    }

    // S'assurer qu'on a un Content-Type si pas déjà défini
    if (!requestHeaders['Content-Type'] && method !== 'GET') {
      requestHeaders['Content-Type'] = bodyFormat === 'FORM' 
        ? 'application/x-www-form-urlencoded' 
        : 'application/json'
    }

    // Utiliser les données envoyées ou créer des données de test par défaut
    const testData = data || {
      _test: true,
      _message: 'Ceci est un test de webhook depuis FormBuilder',
      _timestamp: new Date().toISOString(),
      question1: 'Réponse exemple 1',
      question2: 'Réponse exemple 2',
      email: 'test@example.com',
    }

    const startTime = Date.now()

    try {
      let bodyContent: string | undefined
      
      if (method !== 'GET') {
        if (bodyFormat === 'FORM') {
          bodyContent = new URLSearchParams(
            Object.entries(testData).map(([k, v]) => [k, String(v)])
          ).toString()
        } else {
          bodyContent = JSON.stringify(testData)
        }
      }

      const response = await fetch(url, {
        method: method || 'POST',
        headers: requestHeaders,
        body: bodyContent,
      })

      const duration = Date.now() - startTime
      const responseText = await response.text()

      return NextResponse.json({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration,
        response: responseText.substring(0, 1000), // Limiter la taille de la réponse
      })
    } catch (fetchError: any) {
      return NextResponse.json({
        success: false,
        error: fetchError.message || 'Impossible de contacter le serveur',
      })
    }
  } catch (error) {
    console.error('Erreur lors du test webhook:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
