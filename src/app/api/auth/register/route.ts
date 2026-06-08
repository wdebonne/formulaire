import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { getClientIp } from '@/lib/security'
import { logEvent } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Vérifier si l'inscription est activée
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'system' }
      })
      if (settings && !settings.registrationEnabled) {
        return NextResponse.json(
          { error: 'Les inscriptions sont désactivées' },
          { status: 403 }
        )
      }
    } catch (e) {
      // Si la table n'existe pas encore, permettre l'inscription
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    })

    // Create default themes for the user
    await prisma.theme.createMany({
      data: [
        {
          name: 'Par défaut',
          userId: user.id,
          isDefault: true,
          properties: JSON.stringify({
            font: 'Inter',
            backgroundColor: '#ffffff',
            questionsColor: '#000000',
            answersColor: '#4a4a4a',
            buttonsBgColor: '#7c3aed',
            buttonsFontColor: '#ffffff',
          }),
        },
        {
          name: 'Violet Gradient',
          userId: user.id,
          properties: JSON.stringify({
            font: 'Inter',
            backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            questionsColor: '#ffffff',
            answersColor: '#f0f0f0',
            buttonsBgColor: '#ffffff',
            buttonsFontColor: '#7c3aed',
          }),
        },
      ],
    })

    await logEvent({
      action: 'auth.register',
      userId: user.id,
      userEmail: user.email,
      ipAddress: getClientIp(request),
    })

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
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
