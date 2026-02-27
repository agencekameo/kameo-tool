import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const prospects = await prisma.prospect.findMany({
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(prospects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await req.json()
  const prospect = await prisma.prospect.create({
    data: { ...data, assignedTo: data.assignedTo || null },
    include: { assignee: { select: { id: true, name: true } } },
  })
  return NextResponse.json(prospect)
}
