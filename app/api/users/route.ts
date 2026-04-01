import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoUserWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const users = await prisma.user.findMany({
    where: demoUserWhere(session),
    select: { id: true, name: true, email: true, role: true, avatar: true, lastSeen: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const guard = demoGuard(session); if (guard) return guard
  const { name, email, password, role } = await req.json()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 400 })
  if (!password || password.length < 8) return NextResponse.json({ error: 'Mot de passe trop court (min 8)' }, { status: 400 })
  if (!/[A-Z]/.test(password)) return NextResponse.json({ error: 'Mot de passe : au moins une majuscule' }, { status: 400 })
  if (!/[a-z]/.test(password)) return NextResponse.json({ error: 'Mot de passe : au moins une minuscule' }, { status: 400 })
  if (!/\d/.test(password)) return NextResponse.json({ error: 'Mot de passe : au moins un chiffre' }, { status: 400 })
  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: role || 'DEVELOPER' },
    select: { id: true, name: true, email: true, role: true, avatar: true, lastSeen: true, createdAt: true },
  })
  return NextResponse.json(user)
}
