import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mandats = await prisma.mandat.findMany({ where: demoWhere(session), orderBy: { createdAt: 'desc' } })
  return NextResponse.json(mandats)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const body = await req.json()

  // Use provided referenceMandat or auto-generate: M{YEAR}-{NNN}
  let referenceMandat = body.referenceMandat
  if (!referenceMandat) {
    const year = new Date().getFullYear()
    const prefix = `M${year}-`
    // Find all existing references for this year to get the max number
    const existing = await prisma.mandat.findMany({
      where: { referenceMandat: { startsWith: prefix } },
      select: { referenceMandat: true },
    })
    const existingNums = existing.map(m => parseInt(m.referenceMandat!.replace(prefix, ''), 10)).filter(n => !isNaN(n))
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0
    referenceMandat = `${prefix}${String(maxNum + 1).padStart(3, '0')}`
  }

  const data = {
    referenceMandat,
    clientName: body.clientName,
    clientEmail: body.clientEmail || null,
    subject: body.subject || null,
    priceHT: body.priceHT ?? null,
    billing: body.billing || 'MENSUEL',
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
    contactName: body.contactName || null,
    contactPhone: body.contactPhone || null,
    contactEmail: body.contactEmail || null,
    notes: body.notes || null,
    active: body.active ?? true,
    clientId: body.clientId || null,
    clientAddress: body.clientAddress || null,
    clientPostalCode: body.clientPostalCode || null,
    clientCity: body.clientCity || null,
    clientCountry: body.clientCountry || null,
    clientPhone2: body.clientPhone2 || null,
    clientSiren: body.clientSiren || null,
    clientPrenom: body.clientPrenom || null,
    bic: body.bic || null,
    iban: body.iban || null,
    paymentType: body.paymentType || 'RECURRENT',
    referenceContrat: body.referenceContrat || null,
    descriptionContrat: body.descriptionContrat || null,
    contractId: body.contractId || null,
    signatureStatus: body.signatureStatus || 'BROUILLON',
    createdById: session.user.id,
  }

  try {
    const mandat = await prisma.mandat.create({ data })
    return NextResponse.json(mandat)
  } catch (err: unknown) {
    const isPrismaUniqueError = typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002'
    if (isPrismaUniqueError) {
      return NextResponse.json({ error: `La référence mandat "${referenceMandat}" existe déjà` }, { status: 409 })
    }
    console.error('Mandat creation error:', err)
    return NextResponse.json({ error: `Erreur lors de la création du mandat: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }
}
