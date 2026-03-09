import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subId } = await params
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.done !== undefined) data.done = body.done
  if (body.position !== undefined) data.position = body.position

  const subtask = await prisma.ayshaSubTask.update({ where: { id: subId }, data })
  return NextResponse.json(subtask)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subId } = await params
  await prisma.ayshaSubTask.delete({ where: { id: subId } })
  return NextResponse.json({ ok: true })
}
