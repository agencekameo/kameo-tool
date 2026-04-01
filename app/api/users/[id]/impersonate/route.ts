import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createLog } from '@/lib/log'
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

  // Store hashed token in Settings table (never store plaintext)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await prisma.setting.create({
    data: {
      key: `impersonate:${tokenHash}`,
      value: JSON.stringify({
        targetUserId: targetUser.id,
        adminId: session.user.id,
        expiresAt: expiresAt.toISOString(),
      }),
    },
  })

  // Audit log: track impersonation events
  await createLog(
    session.user.id,
    'IMPERSONATION',
    'User',
    targetUser.id,
    targetUser.name || undefined,
    `Admin ${session.user.name || session.user.id} a démarré une impersonation de ${targetUser.name}`
  )

  return NextResponse.json({
    success: true,
    token,
    targetName: targetUser.name,
  })
}
