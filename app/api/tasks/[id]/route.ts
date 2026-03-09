import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description || null
  if (body.status !== undefined) data.status = body.status
  if (body.priority !== undefined) data.priority = body.priority
  if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null
  if (body.projectId !== undefined) data.projectId = body.projectId || null
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.position !== undefined) data.position = body.position
  if (body.isRecurring !== undefined) data.isRecurring = body.isRecurring
  if (body.recurrencePattern !== undefined) data.recurrencePattern = body.recurrencePattern || null
  const task = await prisma.task.update({
    where: { id },
    data,
    include: { assignee: { select: { id: true, name: true } }, project: { include: { client: true } } },
  })
  return NextResponse.json(task)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
