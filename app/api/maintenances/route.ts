import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const maintenances = await prisma.maintenanceContract.findMany({
    orderBy: { clientName: 'asc' },
  })
  return NextResponse.json(maintenances)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    // Convert date strings to Date objects for Prisma
    const data = {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      priceHT: body.priceHT ? parseFloat(body.priceHT) : null,
    }
    const maintenance = await prisma.maintenanceContract.create({ data })
    return NextResponse.json(maintenance)
  } catch (err) {
    console.error('[POST /api/maintenances]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
