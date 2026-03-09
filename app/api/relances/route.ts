import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  const relances = await prisma.relance.findMany({
    where: userId ? { userId } : undefined,
    include: {
      prospect: { select: { name: true, company: true } },
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(relances)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { prospectId, userId, type, date, notes } = data

  const relance = await prisma.relance.create({
    data: {
      prospectId,
      userId,
      type: type || 'APPEL',
      date: new Date(date),
      notes: notes || null,
    },
    include: {
      prospect: { select: { name: true, company: true } },
    },
  })

  return NextResponse.json(relance)
}
