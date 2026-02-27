import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = new Date().getFullYear()
  const start = new Date(`${year}-01-01T00:00:00.000Z`)
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`)

  const invoices = await prisma.projectInvoice.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      amount: { not: null },
    },
    select: { amount: true, createdAt: true },
  })

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthInvoices = invoices.filter(inv => new Date(inv.createdAt).getUTCMonth() === i)
    const ca = monthInvoices.reduce((s, inv) => s + (inv.amount ?? 0), 0)
    return { month: i + 1, ca: Math.round(ca), count: monthInvoices.length }
  })

  const totalCA = months.reduce((s, m) => s + m.ca, 0)

  return NextResponse.json({
    year,
    annualGoal: 120000,
    monthlyGoal: 10000,
    months,
    totalCA,
  })
}
