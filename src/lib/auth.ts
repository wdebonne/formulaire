import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const TOKEN_EXPIRY = '7d'

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  
  if (!token) return null
  
  return verifyToken(token)
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
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}
