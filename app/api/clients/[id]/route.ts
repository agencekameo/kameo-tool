import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const client = await prisma.client.findUnique({
    where: { id },
    include: { projects: { include: { tasks: true } } },
  })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'DEMO' && (client as Record<string, unknown>).createdById && (client as Record<string, unknown>).createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  try {
    const existing = await prisma.client.findUnique({ where: { id }, select: { createdById: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const role = (session.user as { role?: string }).role
    if (role !== 'ADMIN' && role !== 'DEMO' && existing.createdById && existing.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const data: Record<string, unknown> = {}
    const fields = ['name', 'firstName', 'lastName', 'company', 'siret', 'email', 'phone', 'address', 'postalCode', 'city', 'country', 'website', 'logo', 'notes', 'contact2Name', 'contact2Email', 'contact2Phone']
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f] || null
    }
    if (body.name !== undefined) data.name = body.name // name should not be nullified
    // Keep name in sync with firstName/lastName
    if ((body.firstName !== undefined || body.lastName !== undefined) && body.name === undefined) {
      const fn = body.firstName ?? ''
      const ln = body.lastName ?? ''
      data.name = `${fn} ${ln}`.trim()
    }
    if (body.maintenancePlan !== undefined) data.maintenancePlan = body.maintenancePlan
    if (body.maintenancePrice !== undefined) data.maintenancePrice = body.maintenancePrice != null ? Number(body.maintenancePrice) : null
    const client = await prisma.client.update({ where: { id }, data, include: { projects: { include: { tasks: true } } } })
    return NextResponse.json(client)
  } catch (err) {
    console.error('[PATCH /api/clients]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  await prisma.client.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
