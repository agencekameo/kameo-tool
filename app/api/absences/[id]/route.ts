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
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.type) data.type = body.type
  if (body.duration !== undefined) data.duration = body.duration
  if (body.notes !== undefined) data.notes = body.notes || null
  const absence = await prisma.absence.update({ where: { id }, data, include: { user: { select: { id: true, name: true } } } })
  return NextResponse.json(absence)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.absence.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
