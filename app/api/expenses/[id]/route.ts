import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const existing = await prisma.expense.findUnique({ where: { id }, select: { createdById: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && existing.createdById && existing.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const data = await req.json()
  const expense = await prisma.expense.update({ where: { id }, data })
  return NextResponse.json(expense)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const existing = await prisma.expense.findUnique({ where: { id }, select: { createdById: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && existing.createdById && existing.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
