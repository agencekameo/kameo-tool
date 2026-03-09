import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotificationForAdmins } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Freelancer responds to a mission assignment.
 * POST body: { action: 'accept' | 'counter' | 'refuse', counterPrice?, counterDeadline?, counterNote? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const userId = session.user.id

  let body: {
    action: 'accept' | 'counter' | 'refuse'
    counterPrice?: number | null
    counterDeadline?: string | null
    counterNote?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, counterPrice, counterDeadline, counterNote } = body
  if (!['accept', 'counter', 'refuse'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  // Verify the assignment exists and belongs to this user
  const assignment = await prisma.projectAssignee.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })

  if (!assignment) {
    return NextResponse.json({ error: 'Assignation introuvable' }, { status: 404 })
  }

  if (assignment.status === 'REFUSE') {
    return NextResponse.json({ error: 'Cette mission a été refusée' }, { status: 400 })
  }

  let data: Record<string, unknown> = { respondedAt: new Date() }

  switch (action) {
    case 'accept':
      data.status = 'VALIDE'
      break
    case 'counter':
      data.status = 'CONTRE_PROPOSITION'
      if (counterPrice !== undefined) data.counterPrice = counterPrice
      if (counterDeadline) data.counterDeadline = new Date(counterDeadline)
      if (counterNote) data.counterNote = counterNote
      break
    case 'refuse':
      data.status = 'REFUSE'
      break
  }

  const updated = await prisma.projectAssignee.update({
    where: { projectId_userId: { projectId, userId } },
    data,
    include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
  })

  // Notify admins of the freelancer's response
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
  const userName = updated.user.name
  const projectName = project?.name ?? 'Sans nom'
  const notifMap: Record<string, { type: string; title: string; message: string }> = {
    accept: { type: 'MISSION_ACCEPTED', title: 'Mission acceptée', message: `${userName} a accepté la mission "${projectName}"` },
    counter: { type: 'MISSION_COUNTER', title: 'Contre-proposition', message: `${userName} a fait une contre-proposition pour "${projectName}"` },
    refuse: { type: 'MISSION_REFUSED', title: 'Mission refusée', message: `${userName} a refusé la mission "${projectName}"` },
  }
  const notif = notifMap[action]
  createNotificationForAdmins({ ...notif, link: `/projects/${projectId}` })

  return NextResponse.json(updated)
}
