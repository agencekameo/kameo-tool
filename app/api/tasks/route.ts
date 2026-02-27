import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const tasks = await prisma.task.findMany({
    where: projectId ? { projectId } : {},
    include: { assignee: true, project: { include: { client: true } } },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const task = await prisma.task.create({
    data: body,
    include: { assignee: true, project: { include: { client: true } } },
  })
  return NextResponse.json(task)
}
