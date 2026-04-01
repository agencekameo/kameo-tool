import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const contracts = await prisma.contract.findMany({ where: demoWhere(session), orderBy: { createdAt: 'desc' } })
  return NextResponse.json(contracts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const body = await req.json()
  const contract = await prisma.contract.create({
    data: {
      clientName: body.clientName,
      clientEmail: body.clientEmail || null,
      subject: body.subject || null,
      type: body.type || 'PRESTATION',
      billing: body.billing || 'ONE_SHOT',
      priceHT: body.priceHT ?? null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      contactName: body.contactName || null,
      contactPhone: body.contactPhone || null,
      contactEmail: body.contactEmail || null,
      notes: body.notes || null,
      active: body.active ?? true,
      clientId: body.clientId || null,
      clientAddress: body.clientAddress || null,
      clientPostalCode: body.clientPostalCode || null,
      clientCity: body.clientCity || null,
      clientCountry: body.clientCountry || null,
      clientPhone: body.clientPhone || null,
      clientSiren: body.clientSiren || null,
      duration: body.duration || null,
      maintenanceLevel: body.maintenanceLevel ?? null,
      createdById: session.user.id,
    },
  })
  return NextResponse.json(contract)
}
