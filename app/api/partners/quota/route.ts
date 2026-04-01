import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getQuotaForToday, estimateSendTime, getRiskLevel } from '@/lib/email-safety'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const quota = await getQuotaForToday()

  return NextResponse.json({
    ...quota,
    estimateSendTime: (count: number) => estimateSendTime(count),
    getRiskLevel: (count: number) => getRiskLevel(count, quota.remaining),
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { count } = await req.json()
  const quota = await getQuotaForToday()

  return NextResponse.json({
    quota,
    estimate: estimateSendTime(count || 0),
    risk: getRiskLevel(count || 0, quota.remaining),
  })
}
