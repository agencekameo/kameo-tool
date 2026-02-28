import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const absences = await prisma.absence.findMany({
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(absences)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const absence = await prisma.absence.create({
    data: {
      userId: body.userId || session.user.id,
      date: new Date(body.date),
      endDate: body.endDate ? new Date(body.endDate) : null,
      type: body.type || 'AUTRE',
      duration: body.duration || 1,
      notes: body.notes || null,
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
  return NextResponse.json(absence)
}
