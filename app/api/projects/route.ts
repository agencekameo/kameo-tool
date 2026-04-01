import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { createLog } from '@/lib/log'
import { createNotificationForAdmins } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const role = (session.user as { role?: string }).role
    const isAdmin = role === 'ADMIN'

    const projects = await prisma.project.findMany({
      where: { ...(isAdmin ? {} : { assignments: { some: { userId: session.user.id } } }), ...demoWhere(session) },
      include: {
        client: { select: { id: true, name: true, company: true, website: true } },
        tasks: { select: { id: true, status: true } },
        assignments: { select: { user: { select: { id: true, name: true, avatar: true, role: true } }, deadline: true, status: true }, orderBy: { createdAt: 'asc' } },
        clientForm: { select: { cdcCompleted: true, briefCompleted: true, designCompleted: true, accesCompleted: true, docsCompleted: true, cdcData: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (err) {
    console.error('[GET /api/projects]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard

  try {
    const body = await req.json()

    // Destructure only known Project fields to avoid Prisma "unknown field" errors
    const { name, clientId, type, status, price, deadline, notes, services, startDate, signedAt } = body

    if (!name || !clientId || !type) {
      return NextResponse.json({ error: 'Nom, client et type sont requis' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        name,
        clientId,
        type,
        status: status || 'BRIEF',
        price: price !== undefined && price !== null && price !== '' ? Number(price) : null,
        deadline: deadline ? new Date(deadline) : null,
        startDate: startDate ? new Date(startDate) : null,
        signedAt: signedAt ? new Date(signedAt) : null,
        notes: notes || null,
        services: Array.isArray(services) ? services : [],
        createdById: session.user.id,
      },
      include: { client: true, tasks: true },
    })

    // Auto-create a group conversation for this project (non-blocking)
    // Include all ADMIN users + the creator
    try {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
      const memberIds = new Set([session.user.id, ...admins.map(a => a.id)])
      await prisma.conversation.create({
        data: {
          name: project.name,
          isGroup: true,
          projectId: project.id,
          participants: { create: [...memberIds].map(id => ({ userId: id })) },
        },
      })
    } catch {
      // Non-blocking
    }

    try {
      await createLog(session.user.id, 'CRÉÉ', 'Projet', project.id, project.name)
    } catch {
      // Non-blocking
    }

    // Notify admins of the new project
    createNotificationForAdmins({
      type: 'PROJECT_NEW',
      title: 'Nouveau projet',
      message: `Le projet "${project.name}" a été créé`,
      link: `/projects/${project.id}`,
    })

    return NextResponse.json(project)
  } catch (err) {
    console.error('Project creation error:', err)
    // P2003 = FK constraint → session user ID not in User table (DB was wiped)
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2003') {
      return NextResponse.json(
        { error: 'Compte introuvable — allez sur kameo.vercel.app/setup pour recréer votre compte, puis reconnectez-vous.' },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
