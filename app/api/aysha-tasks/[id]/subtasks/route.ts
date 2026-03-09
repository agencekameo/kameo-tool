import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const count = await prisma.ayshaSubTask.count({ where: { taskId: id } })

  const subtask = await prisma.ayshaSubTask.create({
    data: {
      taskId: id,
      title: body.title,
      position: count,
    },
  })
  return NextResponse.json(subtask)
}
