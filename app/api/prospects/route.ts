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

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string })?.role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Delete related relances first, then prospects
  const prospectIds = (await prisma.prospect.findMany({ where: { assignedTo: userId }, select: { id: true } })).map(p => p.id)
  if (prospectIds.length > 0) {
    await prisma.relance.deleteMany({ where: { prospectId: { in: prospectIds } } })
  }
  const result = await prisma.prospect.deleteMany({ where: { assignedTo: userId } })
  return NextResponse.json({ deleted: result.count })
}
