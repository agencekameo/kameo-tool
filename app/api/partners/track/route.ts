import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// 1x1 transparent PNG pixel
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('tid')
  if (tid) {
    try {
      await prisma.partner.update({
        where: { trackingId: tid },
        data: {
          mailOpenCount: { increment: 1 },
          lastOpenedAt: new Date(),
        },
      })
    } catch {
      // Partner not found or already deleted — ignore
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
