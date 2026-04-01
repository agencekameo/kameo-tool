import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoTaskWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const tasks = await prisma.task.findMany({
      where: { ...(projectId ? { projectId } : {}), ...demoTaskWhere(session) },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(tasks)
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  try {
    const body = await req.json()
    const { projectId, title, description, status, priority, assigneeId, dueDate, recurring, recurrenceType, position } = body
    const task = await prisma.task.create({
      data: {
        projectId: projectId || null,
        title: title || 'Sans titre',
        description: description || null,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        recurring: recurring || false,
        recurrenceType: recurrenceType || null,
        position: typeof position === 'number' ? position : 0,
      },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    })
    return NextResponse.json(task)
  } catch (err) {
    console.error('[POST /api/tasks]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
