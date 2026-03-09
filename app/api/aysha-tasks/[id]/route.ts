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
  if (body.status !== undefined) data.status = body.status
  if (body.priority !== undefined) data.priority = body.priority
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.recurring !== undefined) data.recurring = body.recurring
  if (body.recurrenceType !== undefined) data.recurrenceType = body.recurrenceType
  if (body.position !== undefined) data.position = body.position

  const task = await prisma.ayshaTask.update({ where: { id }, data })
  return NextResponse.json(task)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.ayshaTask.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
