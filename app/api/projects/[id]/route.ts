import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
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
      assignments: {
        include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
        orderBy: { createdAt: 'asc' },
      },
      documents: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      clientForm: {
        select: { token: true, slug: true, cdcCompleted: true, docsCompleted: true, briefCompleted: true, designCompleted: true, accesCompleted: true, cdcData: true, briefData: true, designData: true, accesData: true, docsData: true },
      },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Non-admin users can only access projects they're assigned to
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN') {
    const isAssigned = project.assignments.some(a => a.userId === session.user.id)
    if (!isAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO') {
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { createdById: true, assignments: { select: { userId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const isCreator = existing.createdById === session.user.id
    const isAssigned = existing.assignments.some(a => a.userId === session.user.id)
    if (!isCreator && !isAssigned) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  const body = await req.json()
  const { name, status, type, price, deadline, notes, clientBrief, services, figmaUrl, contentUrl, startDate, signedAt, maintenancePlan, maintenancePrice, maintenanceStart, maintenanceEnd } = body
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (status !== undefined) {
    data.status = status
    // Recalculate deadlines dynamically when status changes
    // Find the assignee for the new stage and set their deadline from today + delayDays
    const ROLE_TO_STAGE: Record<string, string> = {
      REDACTEUR: 'REDACTION', DESIGNER: 'MAQUETTE', DEVELOPER: 'DEVELOPPEMENT',
    }
    const assignees = await prisma.projectAssignee.findMany({
      where: { projectId: id },
      include: { user: { select: { role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    for (const a of assignees) {
      const stage = ROLE_TO_STAGE[a.user.role]
      if (stage === status && a.delayDays) {
        const dl = new Date()
        dl.setDate(dl.getDate() + a.delayDays)
        await prisma.projectAssignee.update({
          where: { id: a.id },
          data: { deadline: dl },
        })
      }
    }
  }
  if (type !== undefined) data.type = type
  if (price !== undefined) data.price = price !== null && price !== '' ? Number(price) : null
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
  if (signedAt !== undefined) data.signedAt = signedAt ? new Date(signedAt) : null
  if (notes !== undefined) data.notes = notes || null
  if (clientBrief !== undefined) data.clientBrief = clientBrief || null
  if (services !== undefined) data.services = services
  if (figmaUrl !== undefined) data.figmaUrl = figmaUrl || null
  if (contentUrl !== undefined) data.contentUrl = contentUrl || null
  if (maintenancePlan !== undefined) data.maintenancePlan = maintenancePlan
  if (maintenancePrice !== undefined) data.maintenancePrice = maintenancePrice !== null && maintenancePrice !== '' ? Number(maintenancePrice) : null
  if (maintenanceStart !== undefined) data.maintenanceStart = maintenanceStart ? new Date(maintenanceStart) : null
  if (maintenanceEnd !== undefined) data.maintenanceEnd = maintenanceEnd ? new Date(maintenanceEnd) : null
  if (body.formBypassedAt !== undefined) {
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    data.formBypassedAt = body.formBypassedAt ? new Date(body.formBypassedAt) : null
    // Recalculate freelance deadlines from now (bypass date)
    if (body.formBypassedAt) {
      const assignees = await prisma.projectAssignee.findMany({
        where: { projectId: id, delayDays: { not: null } },
        orderBy: { createdAt: 'asc' },
      })
      let cumulativeDays = 0
      for (const a of assignees) {
        if (a.delayDays) {
          cumulativeDays += a.delayDays
          const dl = new Date()
          dl.setDate(dl.getDate() + cumulativeDays)
          await prisma.projectAssignee.update({
            where: { id: a.id },
            data: { deadline: dl },
          })
        }
      }
    }
  }
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
  const guard = demoGuard(session); if (guard) return guard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true } })
    await prisma.project.delete({ where: { id } })
    await createLog(session.user.id, 'SUPPRIMÉ', 'Projet', id, project?.name)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projects]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
