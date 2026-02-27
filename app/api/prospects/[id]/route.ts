import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const data = await req.json()
  const prospect = await prisma.prospect.update({
    where: { id },
    data: { ...data, assignedTo: data.assignedTo || null },
    include: { assignee: { select: { id: true, name: true } } },
  })
  return NextResponse.json(prospect)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.prospect.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
