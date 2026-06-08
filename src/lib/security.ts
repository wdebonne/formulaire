import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendFailedLoginAlertEmail } from '@/lib/email'

export interface SecuritySettings {
  enabled: boolean
  maxFailedAttempts: number
  attemptWindowMinutes: number
  blockDurationMinutes: number
  notifyOnFailedLogin: boolean
  notifyThreshold: number
  notifyEmail: string
}

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  enabled: true,
  maxFailedAttempts: 5,
  attemptWindowMinutes: 15,
  blockDurationMinutes: 15,
  notifyOnFailedLogin: false,
  notifyThreshold: 3,
  notifyEmail: '',
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim()
    if (ip) return ip
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })
  if (!settings?.securitySettings) return DEFAULT_SECURITY_SETTINGS

  try {
    return { ...DEFAULT_SECURITY_SETTINGS, ...JSON.parse(settings.securitySettings) }
  } catch {
    return DEFAULT_SECURITY_SETTINGS
  }
}

async function isWhitelisted(ipAddress: string): Promise<boolean> {
  const rule = await prisma.ipRule.findUnique({
    where: { ipAddress_listType: { ipAddress, listType: 'whitelist' } },
  })
  return !!rule
}

async function isBlacklisted(ipAddress: string): Promise<boolean> {
  const rule = await prisma.ipRule.findUnique({
    where: { ipAddress_listType: { ipAddress, listType: 'blacklist' } },
  })
  return !!rule
}

export type IpAccessResult =
  | { allowed: true }
  | { allowed: false; reason: 'blacklisted' }
  | { allowed: false; reason: 'blocked'; retryAfterMinutes: number }

export async function checkIpAccess(ipAddress: string): Promise<IpAccessResult> {
  if (ipAddress === 'unknown') return { allowed: true }

  if (await isWhitelisted(ipAddress)) return { allowed: true }

  if (await isBlacklisted(ipAddress)) return { allowed: false, reason: 'blacklisted' }

  const block = await prisma.ipBlock.findUnique({ where: { ipAddress } })
  if (block?.blockedUntil && block.blockedUntil > new Date()) {
    const retryAfterMinutes = Math.ceil((block.blockedUntil.getTime() - Date.now()) / 60000)
    return { allowed: false, reason: 'blocked', retryAfterMinutes }
  }

  return { allowed: true }
}

export async function recordFailedLogin(ipAddress: string): Promise<void> {
  if (ipAddress === 'unknown') return
  if (await isWhitelisted(ipAddress)) return

  const settings = await getSecuritySettings()
  if (!settings.enabled) return

  const now = new Date()
  const windowMs = settings.attemptWindowMinutes * 60000
  const existing = await prisma.ipBlock.findUnique({ where: { ipAddress } })

  const withinWindow = existing && now.getTime() - existing.lastAttemptAt.getTime() <= windowMs
  const failedAttempts = withinWindow ? existing.failedAttempts + 1 : 1
  const blockedUntil =
    failedAttempts >= settings.maxFailedAttempts
      ? new Date(now.getTime() + settings.blockDurationMinutes * 60000)
      : existing?.blockedUntil && existing.blockedUntil > now
        ? existing.blockedUntil
        : null

  await prisma.ipBlock.upsert({
    where: { ipAddress },
    create: { ipAddress, failedAttempts, lastAttemptAt: now, blockedUntil },
    update: { failedAttempts, lastAttemptAt: now, blockedUntil },
  })

  // Égalité stricte : un seul email par cycle (le compteur retombe à 0 sur
  // connexion réussie ou nouvelle fenêtre), pas un email à chaque tentative
  if (settings.notifyOnFailedLogin && settings.notifyEmail && failedAttempts === settings.notifyThreshold) {
    sendFailedLoginAlertEmail(settings.notifyEmail, ipAddress, failedAttempts).catch((error) => {
      console.error('Failed login alert email error:', error)
    })
  }
}

export async function recordSuccessfulLogin(ipAddress: string): Promise<void> {
  if (ipAddress === 'unknown') return

  await prisma.ipBlock.updateMany({
    where: { ipAddress },
    data: { failedAttempts: 0, blockedUntil: null },
  })
}
