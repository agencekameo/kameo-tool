import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, isDemo } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const demoFilter = isDemo(session) ? { user: { role: 'DEMO' as const } } : { NOT: { user: { role: 'DEMO' as const } } }
  const reports = await prisma.expenseReport.findMany({
    where: demoFilter,
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const body = await req.json()
  const report = await prisma.expenseReport.create({
    data: {
      userId: body.userId || session.user.id,
      date: new Date(body.date),
      amount: body.amount,
      description: body.description,
      category: body.category || 'AUTRE',
      receiptUrl: body.receiptUrl || null,
      status: 'EN_ATTENTE',
      notes: body.notes || null,
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
  return NextResponse.json(report)
}
