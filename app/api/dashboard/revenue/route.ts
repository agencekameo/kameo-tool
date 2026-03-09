import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // 1-12
  const year = searchParams.get('year') // e.g. 2026

  const now = new Date()
  const targetYear = year ? parseInt(year, 10) : now.getFullYear()

  let where: Record<string, unknown> = {}

  if (month) {
    const m = parseInt(month, 10)
    const start = new Date(targetYear, m - 1, 1)
    const end = new Date(targetYear, m, 1)
    where = { createdAt: { gte: start, lt: end } }
  } else {
    // Full year
    const start = new Date(targetYear, 0, 1)
    const end = new Date(targetYear + 1, 0, 1)
    where = { createdAt: { gte: start, lt: end } }
  }

  const result = await prisma.project.aggregate({
    _sum: { price: true },
    where,
  })

  return NextResponse.json({ revenue: result._sum.price ?? 0 })
}
