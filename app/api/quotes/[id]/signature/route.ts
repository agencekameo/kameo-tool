import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const sig = await prisma.signatureRequest.findFirst({
    where: { quoteId: id, usedAt: { not: null } },
    orderBy: { signedAt: 'desc' },
    select: {
      signatureData: true,
      signedCity: true,
      signedDate: true,
      signerFirstName: true,
      signerLastName: true,
      signedAt: true,
    },
  })

  if (!sig) return NextResponse.json({ error: 'Pas de signature' }, { status: 404 })

  return NextResponse.json({
    signatureImage: sig.signatureData,
    signedCity: sig.signedCity,
    signedDate: sig.signedDate,
    signerName: `${sig.signerFirstName} ${sig.signerLastName}`,
    signedAt: sig.signedAt,
  })
}
