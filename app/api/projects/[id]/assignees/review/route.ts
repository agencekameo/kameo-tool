import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin reviews a counter-proposal from a freelancer.
 * POST body: { userId, action: 'accept' | 'reject' }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: projectId } = await params

  let body: { userId: string; action: 'accept' | 'reject' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, action } = body
  if (!userId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const assignment = await prisma.projectAssignee.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })

  if (!assignment) {
    return NextResponse.json({ error: 'Assignation introuvable' }, { status: 404 })
  }

  if (assignment.status !== 'CONTRE_PROPOSITION') {
    return NextResponse.json({ error: 'Pas de contre-proposition à examiner' }, { status: 400 })
  }

  let data: Record<string, unknown> = {}

  if (action === 'accept') {
    // Apply counter-proposal values as the new terms
    data = {
      status: 'VALIDE',
      price: assignment.counterPrice ?? assignment.price,
      deadline: assignment.counterDeadline ?? assignment.deadline,
    }
  } else {
    // Reject → reset to EN_ATTENTE so the freelancer can respond again
    data = {
      status: 'EN_ATTENTE',
      counterPrice: null,
      counterDeadline: null,
      counterNote: null,
      respondedAt: null,
    }
  }

  const updated = await prisma.projectAssignee.update({
    where: { projectId_userId: { projectId, userId } },
    data,
    include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
  })

  // Notify the freelancer of the admin's decision
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
  const projectName = project?.name ?? 'Sans nom'
  createNotification({
    userId,
    type: 'MISSION_REVIEW',
    title: action === 'accept' ? 'Contre-proposition acceptée' : 'Contre-proposition refusée',
    message: action === 'accept'
      ? `Votre contre-proposition pour "${projectName}" a été acceptée`
      : `Votre contre-proposition pour "${projectName}" a été refusée. Veuillez soumettre une nouvelle réponse.`,
    link: `/projects/${projectId}`,
  })

  return NextResponse.json(updated)
}
