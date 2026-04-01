import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [partners, searches] = await Promise.all([
    prisma.partner.findMany({
      include: { search: { select: { keyword: true, location: true } }, project: { select: { id: true, name: true, price: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.partnerSearch.findMany({
      include: { _count: { select: { partners: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({ partners, searches })
}
