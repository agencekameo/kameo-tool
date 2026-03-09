import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateQuotePdf } from '@/lib/quote-pdf'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { position: 'asc' } } },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { buffer } = await generateQuotePdf(quote)

  const fileName = `Devis ${quote.subject} - ${quote.clientName}.pdf`
    .replace(/[/\\?%*:|"<>]/g, '-') // sanitize filename

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
