import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, avatar: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}
