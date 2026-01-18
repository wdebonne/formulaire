import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { testSmtpConnection, sendTestEmail } from '@/lib/email'

// POST test SMTP connection or send test email
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { action, config, testEmail } = await request.json()

    if (action === 'test-connection') {
      // Tester la connexion SMTP
      const result = await testSmtpConnection(config)
      return NextResponse.json(result)
    } else if (action === 'send-test') {
      // Envoyer un email de test
      if (!testEmail) {
        return NextResponse.json({ error: 'Adresse email de test requise' }, { status: 400 })
      }
      const result = await sendTestEmail(testEmail, config)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Action non valide' }, { status: 400 })
  } catch (error) {
    console.error('SMTP test error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
