import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { getClientIp, checkIpAccess, recordFailedLogin, recordSuccessfulLogin } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    const ip = getClientIp(request)
    const access = await checkIpAccess(ip)

    if (!access.allowed) {
      if (access.reason === 'blacklisted') {
        return NextResponse.json(
          { error: 'Accès refusé depuis cette adresse IP' },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: `Trop de tentatives échouées. Réessayez dans ${access.retryAfterMinutes} minute(s).` },
        { status: 429 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      await recordFailedLogin(ip)
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      await recordFailedLogin(ip)
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    await recordSuccessfulLogin(ip)

    const token = generateToken({ userId: user.id, email: user.email, role: user.role })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })

    // Set the auth cookie on the response
    // secure: true only if using HTTPS (check APP_URL)
    const isHttps = process.env.APP_URL?.startsWith('https')
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
