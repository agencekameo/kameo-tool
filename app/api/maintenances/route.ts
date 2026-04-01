import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const maintenances = await prisma.maintenanceContract.findMany({
    where: demoWhere(session),
    orderBy: { clientName: 'asc' },
  })
  return NextResponse.json(maintenances)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  try {
    const body = await req.json()
    // Only pick known fields
    const data = {
      clientName: body.clientName,
      clientEmail: body.clientEmail || null,
      url: body.url || null,
      loginUrl: body.loginUrl || null,
      cms: body.cms || null,
      type: body.type || 'WEB',
      billing: body.billing || 'MENSUEL',
      billingDay: body.billingDay ? parseInt(body.billingDay) : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      priceHT: body.priceHT ? parseFloat(body.priceHT) : null,
      commercial: body.commercial || null,
      loginEmail: body.loginEmail || null,
      loginPassword: body.loginPassword || null,
      contactName: body.contactName || null,
      contactPhone: body.contactPhone || null,
      notes: body.notes || null,
      active: body.active ?? true,
      level: body.level ? parseInt(body.level) : null,
      contractId: body.contractId || null,
      mandatId: body.mandatId || null,
    }
    const maintenance = await prisma.maintenanceContract.create({ data })
    return NextResponse.json(maintenance)
  } catch (err) {
    console.error('[POST /api/maintenances]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
