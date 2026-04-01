import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const expenses = await prisma.expense.findMany({ where: demoWhere(session), orderBy: { name: 'asc' } })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const data = await req.json()
  const expense = await prisma.expense.create({ data })
  return NextResponse.json(expense)
}
