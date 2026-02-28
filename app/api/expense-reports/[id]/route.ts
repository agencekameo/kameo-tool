import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.date) data.date = new Date(body.date)
  if (body.amount !== undefined) data.amount = body.amount
  if (body.description) data.description = body.description
  if (body.category) data.category = body.category
  if (body.status) data.status = body.status
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl || null
  const report = await prisma.expenseReport.update({ where: { id }, data, include: { user: { select: { id: true, name: true } } } })
  return NextResponse.json(report)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.expenseReport.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
