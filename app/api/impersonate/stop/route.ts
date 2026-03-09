import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * POST /api/impersonate/stop
 * Stops impersonation by creating a reverse token to sign back in as the original admin.
 * The `impersonatingFrom` field in the JWT tells us who the original admin is.
 */
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const impersonatingFrom = (session.user as { impersonatingFrom?: string })?.impersonatingFrom
  if (!impersonatingFrom) {
    return NextResponse.json({ error: 'Vous n\'êtes pas en mode impersonation.' }, { status: 400 })
  }

  // Verify the original admin still exists
  const admin = await prisma.user.findUnique({
    where: { id: impersonatingFrom },
    select: { id: true, name: true },
  })

  if (!admin) {
    return NextResponse.json({ error: 'Compte admin introuvable.' }, { status: 404 })
  }

  // Generate a reverse impersonation token (back to admin, no impersonation flag)
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await prisma.setting.create({
    data: {
      key: `impersonate:${token}`,
      value: JSON.stringify({
        targetUserId: admin.id,
        adminId: null, // No impersonation flag — returning to own account
        expiresAt: expiresAt.toISOString(),
      }),
    },
  })

  return NextResponse.json({
    success: true,
    token,
  })
}
