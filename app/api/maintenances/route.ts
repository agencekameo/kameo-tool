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
  const data = await req.json()
  const maintenance = await prisma.maintenanceContract.create({ data })
  return NextResponse.json(maintenance)
}
