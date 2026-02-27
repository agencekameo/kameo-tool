import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createLog } from '@/lib/log'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      tasks: { include: { assignee: true }, orderBy: { createdAt: 'desc' } },
      createdBy: true,
      assignees: true,
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const project = await prisma.project.update({
    where: { id },
    data: body,
    include: { client: true, tasks: true },
  })
  const changes = Object.keys(body).join(', ')
  await createLog(session.user.id, 'MODIFIÉ', 'Projet', project.id, project.name, changes)
  return NextResponse.json(project)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } })
  await prisma.project.delete({ where: { id } })
  await createLog(session.user.id, 'SUPPRIMÉ', 'Projet', id, project?.name)
  return NextResponse.json({ success: true })
}
