import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.clientName !== undefined) data.clientName = body.clientName
  if (body.subject !== undefined) data.subject = body.subject || null
  if (body.type !== undefined) data.type = body.type
  if (body.billing !== undefined) data.billing = body.billing
  if (body.priceHT !== undefined) data.priceHT = body.priceHT
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.contactName !== undefined) data.contactName = body.contactName || null
  if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone || null
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail || null
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.active !== undefined) data.active = body.active
  const contract = await prisma.contract.update({ where: { id }, data })
  return NextResponse.json(contract)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.contract.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
