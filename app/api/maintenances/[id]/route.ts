import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const body = await req.json()
    // Remove auto-managed / non-updatable fields
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = body
    const data = {
      ...rest,
      startDate: rest.startDate ? new Date(rest.startDate) : null,
      endDate: rest.endDate ? new Date(rest.endDate) : null,
      priceHT: rest.priceHT != null ? parseFloat(rest.priceHT) : null,
    }
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
