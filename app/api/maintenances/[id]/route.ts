import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    const allowedFields = ['clientName', 'url', 'loginUrl', 'cms', 'type', 'billing', 'commercial', 'loginEmail', 'loginPassword', 'contactName', 'contactPhone', 'notes', 'active']
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key] || null
    }
    if ('startDate' in body) data.startDate = body.startDate ? new Date(body.startDate) : null
    if ('endDate' in body) data.endDate = body.endDate ? new Date(body.endDate) : null
    if ('priceHT' in body) data.priceHT = body.priceHT != null ? parseFloat(body.priceHT) : null
    if ('active' in body) data.active = body.active ?? true
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
  const { id } = await params
  await prisma.maintenanceContract.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
