import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * POST /api/users/[id]/impersonate
 * Admin-only: creates a short-lived impersonation token to log in as another user.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string })?.role
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 })
  }

  const { id } = await params

  // Can't impersonate yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas vous connecter en tant que vous-même.' }, { status: 400 })
  }

  // Check target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
  }

  // Generate a short-lived token (5 minutes)
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  // Store in Settings table (key: impersonate:{token})
  await prisma.setting.create({
    data: {
      key: `impersonate:${token}`,
      value: JSON.stringify({
        targetUserId: targetUser.id,
        adminId: session.user.id,
        expiresAt: expiresAt.toISOString(),
      }),
    },
  })

  return NextResponse.json({
    success: true,
    token,
    targetName: targetUser.name,
  })
}
