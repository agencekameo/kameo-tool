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
      documents: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
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
  const { name, status, type, price, deadline, notes, services, figmaUrl, contentUrl, startDate } = body
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (status !== undefined) data.status = status
  if (type !== undefined) data.type = type
  if (price !== undefined) data.price = price !== null && price !== '' ? Number(price) : null
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
  if (notes !== undefined) data.notes = notes || null
  if (services !== undefined) data.services = services
  if (figmaUrl !== undefined) data.figmaUrl = figmaUrl || null
  if (contentUrl !== undefined) data.contentUrl = contentUrl || null
  const project = await prisma.project.update({
    where: { id },
    data,
    include: { client: true, tasks: true },
  })
  const changes = Object.keys(data).join(', ')
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
