import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// ~1 MB in base64 characters (~1.37 bytes per base64 char, so 1MB ≈ 1_400_000 chars)
const AVATAR_MAX_B64_LENGTH = 1_500_000

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true, lastSeen: true },
  })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, email, avatar, currentPassword, newPassword } = body as {
    name?: string
    email?: string
    avatar?: string
    currentPassword?: string
    newPassword?: string
  }

  const data: Record<string, unknown> = {}

  // Validate and sanitize name
  if (name !== undefined) {
    const trimmed = String(name).trim()
    if (trimmed.length === 0 || trimmed.length > 100) {
      return NextResponse.json({ error: 'Nom invalide (1–100 caractères)' }, { status: 400 })
    }
    data.name = trimmed
  }

  // Validate email
  if (email !== undefined) {
    const trimmed = String(email).trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    // Check email uniqueness (excluding current user)
    const existing = await prisma.user.findFirst({
      where: { email: trimmed, NOT: { id: session.user.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 400 })
    }
    data.email = trimmed
  }

  // Validate avatar (must be a data URI, max ~1 MB)
  if (avatar !== undefined) {
    if (avatar === null || avatar === '') {
      data.avatar = null
    } else {
      const avatarStr = String(avatar)
      if (!avatarStr.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Format d\'image invalide' }, { status: 400 })
      }
      if (avatarStr.length > AVATAR_MAX_B64_LENGTH) {
        return NextResponse.json({ error: 'Image trop lourde (max ~1 Mo)' }, { status: 400 })
      }
      data.avatar = avatarStr
    }
  }

  // Handle password change
  if (newPassword !== undefined) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Mot de passe actuel requis' }, { status: 400 })
    }
    const pwStr = String(newPassword)
    if (pwStr.length < 8) {
      return NextResponse.json(
        { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      )
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    const valid = await bcrypt.compare(String(currentPassword), user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
    }
    data.password = await bcrypt.hash(pwStr, 12)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { id: true, name: true, email: true, role: true, avatar: true },
    })
    return NextResponse.json(user)
  } catch (err) {
    console.error('[profile PATCH]', err)
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: `Erreur lors de la mise à jour : ${message}` }, { status: 500 })
  }
}
