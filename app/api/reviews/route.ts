import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auto-sync: create review entries for maintenance clients + finished projects
  const maintenances = await prisma.maintenanceContract.findMany({
    where: { ...demoWhere(session), active: true },
    select: { clientName: true, clientEmail: true, contactName: true },
  })

  const finishedProjects = await prisma.project.findMany({
    where: { status: { in: ['LIVRAISON', 'MAINTENANCE', 'ARCHIVE'] } },
    select: { client: { select: { name: true, email: true } } },
  })

  // Also fetch all clients for email + contact lookup
  const allClients = await prisma.client.findMany({
    select: { name: true, email: true, company: true },
  })

  // Valid client names = only from maintenances + finished projects
  const validClients = new Set<string>()
  for (const m of maintenances) validClients.add(m.clientName)
  for (const p of finishedProjects) validClients.add(p.client.name)

  // Build maps: clientName -> email, contactName, companyName
  const clientEmailMap = new Map<string, string | null>()
  const clientContactMap = new Map<string, string | null>()
  const clientCompanyMap = new Map<string, string | null>()
  for (const c of allClients) {
    if (c.email) clientEmailMap.set(c.name, c.email)
    if (c.company) {
      clientCompanyMap.set(c.name, c.company)
    }
  }
  for (const p of finishedProjects) {
    if (p.client.email) clientEmailMap.set(p.client.name, p.client.email)
  }
  for (const m of maintenances) {
    if (m.clientEmail) clientEmailMap.set(m.clientName, m.clientEmail)
    if (m.contactName) clientContactMap.set(m.clientName, m.contactName)
  }

  const uniqueClients = [...validClients]

  // Auto-create missing review entries (skip hidden ones = manually deleted)
  if (uniqueClients.length > 0) {
    const existing = await prisma.review.findMany({
      where: { clientName: { in: uniqueClients } },
      select: { clientName: true },
    })
    const existingNames = new Set(existing.map(r => r.clientName))
    const toCreate = uniqueClients.filter(name => !existingNames.has(name))
    if (toCreate.length > 0) {
      await prisma.review.createMany({
        data: toCreate.map(clientName => ({ clientName, status: 'A_DEMANDER' })),
        skipDuplicates: true,
      })
    }
  }

  const reviews = await prisma.review.findMany({
    where: { hidden: false },
    orderBy: { clientName: 'asc' },
  })

  // Attach email + contact + company info to each review
  const reviewsWithEmail = reviews.map(r => {
    const company = clientCompanyMap.get(r.clientName)
    const contactFromMaint = clientContactMap.get(r.clientName)
    return {
      ...r,
      clientEmail: clientEmailMap.get(r.clientName) || null,
      companyName: company || null,
      contactName: contactFromMaint || (company ? r.clientName : null),
    }
  })

  return NextResponse.json(reviewsWithEmail)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  try {
    const body = await req.json()
    if (!body.clientName) return NextResponse.json({ error: 'clientName requis' }, { status: 400 })
    const review = await prisma.review.upsert({
      where: { clientName: body.clientName },
      update: { status: body.status || 'A_DEMANDER', hidden: false },
      create: { clientName: body.clientName, status: body.status || 'A_DEMANDER' },
    })
    return NextResponse.json(review)
  } catch (err) {
    console.error('[POST /api/reviews]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
