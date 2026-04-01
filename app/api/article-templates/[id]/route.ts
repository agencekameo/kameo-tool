import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.description !== undefined) data.description = body.description
  if (body.unitPrice !== undefined) data.unitPrice = parseFloat(body.unitPrice) || 0
  if (body.unit !== undefined) data.unit = body.unit || null
  if (body.deliveryDays !== undefined) data.deliveryDays = body.deliveryDays ? parseInt(body.deliveryDays) : null
  if (body.category !== undefined) data.category = body.category || null
  const template = await prisma.articleTemplate.update({ where: { id }, data })
  return NextResponse.json(template)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  await prisma.articleTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
