import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  const commissions = await prisma.commercialCommission.findMany({
    where: userId ? { userId } : undefined,
    include: {
      prospect: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(commissions)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { userId, prospectId, amount, type, date, notes, paid } = data

  const commission = await prisma.commercialCommission.create({
    data: {
      userId,
      prospectId: prospectId || null,
      amount,
      type: type || 'SIGNATURE',
      date: new Date(date),
      notes: notes || null,
      paid: paid || false,
    },
    include: {
      prospect: { select: { name: true } },
    },
  })

  return NextResponse.json(commission)
}
