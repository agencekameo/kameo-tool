import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// GET — check whether setup is needed (no users in DB)
export async function GET() {
  try {
    const count = await prisma.user.count()
    return NextResponse.json({ needsSetup: count === 0 })
  } catch {
    return NextResponse.json({ needsSetup: false })
  }
}

// POST — create the first ADMIN user (only works when DB has no users)
// Uses a transaction to prevent race conditions
export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe trop court (min. 8 caractères)' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)

    // Atomic check-and-create inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count()
      if (count > 0) return null
      return tx.user.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: hashed,
          role: 'ADMIN',
        },
      })
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Setup already completed — users already exist.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[setup POST]', err)
    return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
  }
}
