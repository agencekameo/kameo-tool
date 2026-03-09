import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Vercel Cron calls this every 1st of the month at 00:01
// Reset all maintenance contracts active status to false ("Pas encore")
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await prisma.maintenanceContract.updateMany({
    data: { active: false },
  })

  return NextResponse.json({ reset: result.count })
}
