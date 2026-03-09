import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  const prospects = await prisma.prospect.findMany({
    where: userId ? { assignedTo: userId } : undefined,
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
