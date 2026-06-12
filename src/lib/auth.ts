import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { prisma } from './prisma'

const TOKEN_EXPIRY = '7d'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters. Generate one with: openssl rand -base64 32'
    )
  }
  return secret
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY })
}

export function verifyToken(token: string): JWTPayload | null {
  const secret = getJwtSecret() // intentionally outside try/catch — misconfiguration must throw
  try {
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  // Verify the user still exists — invalidates sessions for deleted accounts
  const exists = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  })

  return exists ? payload : null
}

// Version étendue qui récupère aussi les infos utilisateur fraîches de la DB
export async function getSessionWithUser() {
  const session = await getSession()
  if (!session) return null
  
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    }
  })
  
  return user
}

// Vérifie si l'utilisateur est admin (récupère le rôle depuis la DB pour plus de fiabilité)
export async function isAdmin(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  
  // Si le rôle est dans le token, l'utiliser
  if (session.role) {
    return session.role === 'admin'
  }
  
  // Sinon, récupérer depuis la DB (pour les anciens tokens)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true }
  })
  
  return user?.role === 'admin'
}

// Middleware helper pour protéger les routes admin
export async function requireAdmin(): Promise<JWTPayload | null> {
  const session = await getSession()
  if (!session) return null
  
  // Si le rôle est dans le token, l'utiliser
  if (session.role === 'admin') {
    return session
  }
  
  // Sinon, récupérer le rôle depuis la DB (pour les anciens tokens sans role)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true }
  })
  
  if (user?.role === 'admin') {
    return { ...session, role: 'admin' }
  }
  
  return null
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function removeAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('auth-token')
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}
