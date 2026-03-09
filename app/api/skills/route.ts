import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET — fetch all skill progress for the logged-in user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const progress = await prisma.skillProgress.findMany({
    where: { userId: session.user.id },
  })

  // Return as a map: { itemKey: completed }
  const map: Record<string, boolean> = {}
  for (const p of progress) {
    map[p.itemKey] = p.completed
  }

  return NextResponse.json(map)
}

// POST — toggle a skill item
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemKey, completed } = await req.json()
  if (!itemKey || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const result = await prisma.skillProgress.upsert({
    where: {
      userId_itemKey: {
        userId: session.user.id,
        itemKey,
      },
    },
    update: { completed },
    create: {
      userId: session.user.id,
      itemKey,
      completed,
    },
  })

  return NextResponse.json(result)
}
