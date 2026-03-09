import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tasks = await prisma.ayshaTask.findMany({
    include: { subtasks: { orderBy: { position: 'asc' } } },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const subtitles: string[] = Array.isArray(body.subtasks) ? body.subtasks : []
  const task = await prisma.ayshaTask.create({
    data: {
      title: body.title,
      status: body.status ?? 'TODO',
      priority: body.priority ?? 'MEDIUM',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      recurring: body.recurring ?? false,
      recurrenceType: body.recurrenceType ?? null,
      position: body.position ?? 0,
      subtasks: subtitles.length > 0 ? {
        create: subtitles.map((title: string, i: number) => ({ title, position: i })),
      } : undefined,
    },
    include: { subtasks: { orderBy: { position: 'asc' } } },
  })
  return NextResponse.json(task)
}
