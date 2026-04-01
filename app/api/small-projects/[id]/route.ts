import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const data = await req.json()
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.clientId !== undefined) updateData.clientId = data.clientId
  if (data.price !== undefined) updateData.price = parseFloat(data.price)
  if (data.charges !== undefined) updateData.charges = parseFloat(data.charges) || 0
  if (data.description !== undefined) updateData.description = data.description || null
  if (data.signedAt !== undefined) updateData.signedAt = new Date(data.signedAt)
  if (data.status !== undefined) updateData.status = data.status
  if (data.freelanceId !== undefined) updateData.freelanceId = data.freelanceId || null
  const project = await prisma.smallProject.update({
    where: { id },
    data: updateData,
    include: {
      client: { select: { id: true, name: true } },
      freelance: { select: { id: true, name: true, avatar: true } },
    },
  })
  return NextResponse.json(project)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  await prisma.smallProject.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
