import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const VALID_ROLES = ['ADMIN', 'DEVELOPER', 'DESIGNER', 'COMMERCIAL', 'MANAGER'] as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, avatar: true,
      lastSeen: true, createdAt: true,
      assignedProjects: {
        include: {
          client: { select: { name: true } },
          invoices: { where: { uploadedBy: id } },
        },
      },
      invoicesUploaded: {
        include: {
          project: { include: { client: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Whitelist allowed fields — never allow password, id, createdAt, etc.
  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 100)
  if (typeof body.email === 'string' && body.email.trim()) data.email = body.email.trim().toLowerCase()
  if (typeof body.avatar === 'string' || body.avatar === null) data.avatar = body.avatar
  if (typeof body.role === 'string') {
    if (!VALID_ROLES.includes(body.role as (typeof VALID_ROLES)[number])) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }
    data.role = body.role
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, avatar: true, lastSeen: true, createdAt: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Prevent admin from deleting their own account
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
