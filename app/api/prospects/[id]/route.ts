import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const prospect = await prisma.prospect.findUnique({ where: { id } })
  if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && prospect.assignedTo !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(prospect)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const existing = await prisma.prospect.findUnique({ where: { id }, select: { assignedTo: true, status: true, statusHistory: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && existing.assignedTo !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const data = await req.json()
  // Keep name in sync
  if ((data.firstName !== undefined || data.lastName !== undefined) && data.name === undefined) {
    data.name = `${data.firstName || ''} ${data.lastName || ''}`.trim()
  }
  // Track status history
  if (data.status && data.status !== existing.status) {
    const history = existing.statusHistory || []
    if (!history.includes(data.status)) {
      data.statusHistory = [...history, data.status]
    }
  }
  // Only update assignedTo if explicitly provided
  const updateData = { ...data }
  if (data.assignedTo !== undefined) {
    updateData.assignedTo = data.assignedTo || null
  } else {
    delete updateData.assignedTo
  }
  const prospect = await prisma.prospect.update({
    where: { id },
    data: updateData,
    include: { assignee: { select: { id: true, name: true } } },
  })
  return NextResponse.json(prospect)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const existing = await prisma.prospect.findUnique({ where: { id }, select: { assignedTo: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && existing.assignedTo !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.prospect.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
