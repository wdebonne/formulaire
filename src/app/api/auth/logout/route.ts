import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { logEvent } from '@/lib/audit-log'

export async function POST() {
  const session = await getSession()
  if (session) {
    await logEvent({
      action: 'auth.logout',
      userId: session.userId,
      userEmail: session.email,
    })
  }

  const response = NextResponse.json({ success: true })

  // Delete the auth cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  
  return response
}
