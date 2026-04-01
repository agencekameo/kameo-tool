import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const now = new Date()
  const targetYear = year ? parseInt(year, 10) : now.getFullYear()
  const demoFilter = demoWhere(session)

  // Fetch maintenances once (same for all months)
  const maintenances = await prisma.maintenanceContract.findMany({
    where: { ...demoFilter, active: true, priceHT: { not: null } },
    select: { priceHT: true, billing: true },
  })
  const maintenanceMRR = maintenances.reduce((sum, m) => {
    const price = m.priceHT!
    if (m.billing === 'ANNUEL') return sum + price / 12
    if (m.billing === 'TRIMESTRIEL') return sum + price / 3
    if (m.billing === 'MANUEL') return sum
    return sum + price
  }, 0)

  // Build all 13 periods (12 months + full year) and fetch in parallel
  const periods = Array.from({ length: 13 }, (_, i) => {
    if (i === 0) return { key: '0', start: new Date(targetYear, 0, 1), end: new Date(targetYear + 1, 0, 1) }
    return { key: String(i), start: new Date(targetYear, i - 1, 1), end: new Date(targetYear, i, 1) }
  })

  const results = await Promise.all(periods.map(async ({ start, end }) => {
    const dateOR = [
      { signedAt: { gte: start, lt: end } },
      { signedAt: null, startDate: { gte: start, lt: end } },
      { signedAt: null, startDate: null, createdAt: { gte: start, lt: end } },
    ]
    const [projectResult, smallProjectResult] = await Promise.all([
      prisma.project.aggregate({ _sum: { price: true }, where: { AND: [demoFilter], OR: dateOR } }),
      prisma.smallProject.aggregate({ _sum: { price: true }, where: { signedAt: { gte: start, lt: end } } }),
    ])
    return (projectResult._sum.price ?? 0) + (smallProjectResult._sum.price ?? 0)
  }))

  const byMonth: Record<string, number> = {}
  periods.forEach(({ key }, i) => {
    byMonth[key] = results[i] + maintenanceMRR
  })

  return NextResponse.json({ byMonth })
}
