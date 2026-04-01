import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  try {
    const existing = await prisma.maintenanceContract.findUnique({ where: { id }, select: { createdById: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const role = (session.user as { role?: string }).role
    if (role !== 'ADMIN' && role !== 'DEMO' && existing.createdById && existing.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const data: Record<string, unknown> = {}
    const allowedFields = ['clientName', 'clientEmail', 'url', 'loginUrl', 'cms', 'type', 'billing', 'commercial', 'loginEmail', 'loginPassword', 'contactName', 'contactPhone', 'notes', 'active']
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key] || null
    }
    if ('startDate' in body) data.startDate = body.startDate ? new Date(body.startDate) : null
    if ('endDate' in body) data.endDate = body.endDate ? new Date(body.endDate) : null
    if ('priceHT' in body) data.priceHT = body.priceHT != null ? parseFloat(body.priceHT) : null
    if ('billingDay' in body) data.billingDay = body.billingDay ? parseInt(body.billingDay) : null
    if ('active' in body) data.active = body.active ?? true
    if ('manualPaid' in body) data.manualPaid = !!body.manualPaid
    if ('level' in body) data.level = body.level ? parseInt(body.level) : null
    if ('contractId' in body) data.contractId = body.contractId || null
    if ('mandatId' in body) data.mandatId = body.mandatId || null
    const maintenance = await prisma.maintenanceContract.update({ where: { id }, data })
    return NextResponse.json(maintenance)
  } catch (err) {
    console.error('[PATCH /api/maintenances]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const existing = await prisma.maintenanceContract.findUnique({ where: { id }, select: { createdById: true, mandatId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && existing.createdById && existing.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Stop linked mandat + its contract when deleting a maintenance
  if (existing.mandatId) {
    const now = new Date()
    const mandat = await prisma.mandat.findUnique({ where: { id: existing.mandatId }, select: { contractId: true } })
    await prisma.mandat.update({ where: { id: existing.mandatId }, data: { stoppedAt: now } })
    if (mandat?.contractId) {
      await prisma.contract.update({ where: { id: mandat.contractId }, data: { stoppedAt: now } })
    }
  }
  await prisma.maintenanceContract.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
