import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint interne consommé par le middleware (Edge Runtime, sans accès Prisma direct)
// pour appliquer la liste noire/blanche d'IP sur l'ensemble du site.
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rules = await prisma.ipRule.findMany({ select: { ipAddress: true, listType: true } })

  return NextResponse.json({
    blacklist: rules.filter((r) => r.listType === 'blacklist').map((r) => r.ipAddress),
    whitelist: rules.filter((r) => r.listType === 'whitelist').map((r) => r.ipAddress),
  })
}
