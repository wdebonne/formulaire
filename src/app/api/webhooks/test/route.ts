import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// POST /api/webhooks/test - Tester un webhook
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { url, method, headers } = body

    if (!url) {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    }

    // Construire les headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    for (const header of headers || []) {
      if (header.key && header.value) {
        requestHeaders[header.key] = header.value
      }
    }

    // Données de test
    const testData = {
      _test: true,
      _message: 'Ceci est un test de webhook depuis FormBuilder',
      _timestamp: new Date().toISOString(),
      question1: 'Réponse exemple 1',
      question2: 'Réponse exemple 2',
      email: 'test@example.com',
    }

    const startTime = Date.now()

    try {
      const response = await fetch(url, {
        method: method || 'POST',
        headers: requestHeaders,
        body: method !== 'GET' ? JSON.stringify(testData) : undefined,
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
