import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

const LIST_TYPES = ['whitelist', 'blacklist'] as const

// Validation simple d'adresse IPv4 ou IPv6 (pas de plages CIDR)
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

function isValidIp(value: string): boolean {
  if (IPV4_REGEX.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255)
  }
  return IPV6_REGEX.test(value)
}

// GET all IP rules (admin only)
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const rules = await prisma.ipRule.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(rules)
  } catch (error) {
    console.error('Get IP rules error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST create new IP rule (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { ipAddress, listType, note } = await request.json()

    if (!ipAddress || !isValidIp(ipAddress)) {
      return NextResponse.json({ error: 'Adresse IP invalide' }, { status: 400 })
    }

    if (!LIST_TYPES.includes(listType)) {
      return NextResponse.json({ error: 'Type de liste invalide' }, { status: 400 })
    }

    try {
      const rule = await prisma.ipRule.create({
        data: { ipAddress, listType, note: note || null },
      })
      return NextResponse.json(rule)
    } catch (error: any) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Cette adresse IP est déjà dans cette liste' }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    console.error('Create IP rule error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
