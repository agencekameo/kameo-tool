import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  let body: { userId: string; price?: number | null; deadline?: string | null; delayDays?: number | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, price, deadline, delayDays } = body
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  // Check if the user is a DESIGNER → no price
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const assignment = await prisma.projectAssignee.create({
    data: {
      projectId: id,
      userId,
      price: user.role === 'DESIGNER' ? null : (price ?? null),
      delayDays: delayDays ?? null,
      deadline: deadline ? new Date(deadline) : null,
      status: 'EN_ATTENTE',
    },
    include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
  })

  // Notify the assigned freelancer
  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } })
  const projectName = project?.name ?? 'Sans nom'
  createNotification({
    userId,
    type: 'MISSION_NEW',
    title: 'Nouvelle mission',
    message: `Vous avez été assigné au projet "${projectName}"`,
    link: `/projects/${id}`,
  })

  // Send email to the freelancer
  try {
    const freelancer = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (freelancer?.email) {
      const gmailUser = process.env.GMAIL_USER || process.env.GMAIL_KAMEO_USER
      const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_KAMEO_PASSWORD
      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } })
        const priceText = assignment.price ? `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(assignment.price)} HT` : 'À définir'
        const delayText = assignment.delayDays ? `${assignment.delayDays} jours` : 'À définir'
        const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.NEXTAUTH_URL || 'https://kameo-tool.vercel.app'
        await transporter.sendMail({
          from: `"Agence Kameo" <${gmailUser}>`,
          to: freelancer.email,
          subject: `Nouvelle mission — ${projectName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:500px;">
            <div style="height:4px;background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:4px;margin-bottom:24px;"></div>
            <h2 style="color:#1a1a2e;margin:0 0 16px;">Nouvelle mission</h2>
            <p style="color:#444;margin:0 0 16px;">Bonjour ${freelancer.name},</p>
            <p style="color:#444;margin:0 0 16px;">Une nouvelle mission vous a été proposée :</p>
            <div style="background:#f8f9fa;border-left:4px solid #F8903C;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px;">
              <p style="font-weight:600;color:#1a1a2e;margin:0;">${projectName}</p>
            </div>
            <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:0 0 24px;">
              <p style="color:#444;margin:0 0 8px;"><strong>Budget proposé :</strong> ${priceText}</p>
              <p style="color:#444;margin:0;"><strong>Délai :</strong> ${delayText}</p>
            </div>
            <p style="margin:0 0 24px;"><a href="${baseUrl}/projects/${id}" style="display:inline-block;background:linear-gradient(135deg,#E14B89,#F8903C);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">Voir la mission</a></p>
            <p style="color:#aaa;font-size:12px;">Agence Kameo — kameo-tool.vercel.app</p>
          </div>`,
        })
      }
    }
  } catch { /* Non-blocking */ }

  // Also add the user to the project's group conversation
  try {
    const conv = await prisma.conversation.findUnique({ where: { projectId: id } })
    if (conv) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conv.id, userId } },
        update: {},
        create: { conversationId: conv.id, userId },
      })
    }
  } catch { /* Non-blocking */ }

  return NextResponse.json(assignment)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  let body: { userId: string; price?: number | null; deadline?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, price, deadline, status } = body as { userId: string; price?: number | null; deadline?: string | null; status?: string }
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (price !== undefined) data.price = price
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null
  if (status !== undefined) {
    data.status = status
    if (status === 'EN_ATTENTE') {
      data.counterPrice = null
      data.counterDeadline = null
      data.counterNote = null
      data.respondedAt = null
    }
  }

  const assignment = await prisma.projectAssignee.update({
    where: { projectId_userId: { projectId: id, userId } },
    data,
    include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
  })

  // Notify the freelancer if the proposal was changed
  if (Object.keys(data).length > 0 && (price !== undefined || deadline !== undefined || status === 'EN_ATTENTE')) {
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true } })
    createNotification({
      userId,
      type: 'MISSION_UPDATED',
      title: 'Mission mise à jour',
      message: `La proposition pour "${project?.name ?? 'Sans nom'}" a été modifiée`,
      link: `/projects/${id}`,
    })
  }

  return NextResponse.json(assignment)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  let body: { userId: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId } = body
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  await prisma.projectAssignee.delete({
    where: { projectId_userId: { projectId: id, userId } },
  })

  return NextResponse.json({ ok: true })
}
