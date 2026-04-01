import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { createLog } from '@/lib/log'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const clients = await prisma.client.findMany({
      where: demoWhere(session),
      include: {
        projects: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(clients)
  } catch (err) {
    console.error('[GET /api/clients]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  try {
    const body = await req.json()
    const firstName = body.firstName || ''
    const lastName = body.lastName || ''
    const data = {
      name: body.name || `${firstName} ${lastName}`.trim(),
      firstName: firstName || null,
      lastName: lastName || null,
      company: body.company || null,
      siret: body.siret || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      postalCode: body.postalCode || null,
      city: body.city || null,
      country: body.country || 'France',
      website: body.website || null,
      notes: body.notes || null,
      contact2Name: body.contact2Name || null,
      contact2Email: body.contact2Email || null,
      contact2Phone: body.contact2Phone || null,
      maintenancePlan: body.maintenancePlan || undefined,
      maintenancePrice: body.maintenancePrice != null ? Number(body.maintenancePrice) : undefined,
    }
    const client = await prisma.client.create({ data, include: { projects: true } })
    await createLog(session.user.id, 'CRÉÉ', 'Client', client.id, client.name)
    return NextResponse.json(client)
  } catch (err: unknown) {
    console.error('[POST /api/clients]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
