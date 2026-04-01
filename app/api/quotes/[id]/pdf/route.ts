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
    include: {
      items: { orderBy: { position: 'asc' } },
      client: { select: { website: true } },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { buffer } = await generateQuotePdf({
      ...quote,
      clientWebsite: quote.client?.website || null,
    })

    const fileName = `Devis ${quote.number} - ${quote.clientName}.pdf`
      .replace(/[/\\?%*:|"<>]/g, '-') // sanitize filename

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('[PDF generation error]', err)
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 })
  }
}
