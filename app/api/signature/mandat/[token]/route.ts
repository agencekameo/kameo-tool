import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const mandat = await prisma.mandat.findUnique({
    where: { signatureToken: token },
    select: {
      clientName: true, subject: true, billing: true,
      priceHT: true, startDate: true, endDate: true, notes: true,
      signatureStatus: true,
      referenceMandat: true, referenceContrat: true, descriptionContrat: true,
    },
  })
  if (!mandat) return NextResponse.json({ error: 'Mandat introuvable ou lien expiré' }, { status: 404 })
  return NextResponse.json(mandat)
}
