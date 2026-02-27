import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const logs = await prisma.log.findMany({
    include: { user: { select: { id: true, name: true, role: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return NextResponse.json(logs)
}
