import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const contract = await prisma.contract.findUnique({
    where: { signatureToken: token },
    select: {
      clientName: true, subject: true, type: true, billing: true,
      priceHT: true, startDate: true, endDate: true, notes: true,
      signatureStatus: true,
      clientAddress: true, clientPostalCode: true, clientCity: true,
      clientCountry: true, clientPhone: true, clientEmail: true,
      clientSiren: true, duration: true, maintenanceLevel: true,
    },
  })
  if (!contract) return NextResponse.json({ error: 'Contrat introuvable ou lien expiré' }, { status: 404 })
  return NextResponse.json(contract)
}
