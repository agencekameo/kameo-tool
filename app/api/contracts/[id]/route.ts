import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_FIELDS = [
  'clientName', 'clientEmail', 'subject', 'type', 'billing', 'priceHT',
  'contactName', 'contactPhone', 'contactEmail', 'notes', 'active',
  'clientId', 'clientAddress', 'clientPostalCode', 'clientCity', 'clientCountry',
  'clientPhone', 'clientSiren', 'duration',
]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const existing = await prisma.contract.findUnique({ where: { id }, select: { createdById: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && existing.createdById && existing.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const data: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) {
      if (key === 'active') data[key] = body[key]
      else if (key === 'priceHT') data[key] = body[key]
      else data[key] = body[key] || null
    }
  }
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.stoppedAt !== undefined) data.stoppedAt = body.stoppedAt ? new Date(body.stoppedAt) : null
  const contract = await prisma.contract.update({ where: { id }, data })
  return NextResponse.json(contract)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const existing = await prisma.contract.findUnique({ where: { id }, select: { createdById: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && existing.createdById && existing.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.contract.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
