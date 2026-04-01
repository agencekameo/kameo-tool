import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  // Find all prospects with status A_RAPPELER and callbackDate today
  const prospects = await prisma.prospect.findMany({
    where: {
      status: 'A_RAPPELER',
      callbackDate: { gte: todayStart, lt: todayEnd },
      assignedTo: { not: null },
    },
  })

  let sent = 0
  for (const prospect of prospects) {
    if (!prospect.assignedTo) continue
    const time = prospect.callbackDate
      ? new Date(prospect.callbackDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : ''
    const timeStr = time && time !== '09:00' ? ` a ${time}` : ''
    await createNotification({
      userId: prospect.assignedTo,
      type: 'RAPPEL',
      title: 'Rappel client',
      message: `${prospect.company || prospect.name} est a rappeler aujourd'hui${timeStr}`,
      link: `/commerciaux/${prospect.assignedTo}`,
    })
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
