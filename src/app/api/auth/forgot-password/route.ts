import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true })
    }

    const resetToken = generateResetToken()
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    await sendPasswordResetEmail(user.email, resetToken)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
