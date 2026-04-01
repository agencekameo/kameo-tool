import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : new Date().getMonth() + 1
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

  const invoices = await prisma.maintenanceInvoice.findMany({
    where: { month, year },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(invoices)
}
