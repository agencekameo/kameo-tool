import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createLog } from '@/lib/log'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const projects = await prisma.project.findMany({
      include: {
        client: { select: { id: true, name: true, company: true } },
        tasks: { select: { id: true, status: true } },
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

  try {
    const body = await req.json()

    // Destructure only known Project fields to avoid Prisma "unknown field" errors
    const { name, clientId, type, status, price, deadline, notes, services, startDate } = body

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
        notes: notes || null,
        services: Array.isArray(services) ? services : [],
        createdById: session.user.id,
      },
      include: { client: true, tasks: true },
    })

    // Auto-create a group conversation for this project (non-blocking)
    try {
      await prisma.conversation.create({
        data: {
          name: project.name,
          isGroup: true,
          projectId: project.id,
          participants: { create: [{ userId: session.user.id }] },
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
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
