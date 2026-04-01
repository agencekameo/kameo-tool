import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('tid')
  if (!tid) return NextResponse.json({ error: 'Missing tid' }, { status: 400 })

  // Find partner by tracking ID and mark as REFUSE
  const partner = await prisma.partner.findUnique({ where: { trackingId: tid } })
  if (partner) {
    await prisma.partner.update({
      where: { id: partner.id },
      data: { status: 'REFUSE', notes: `${partner.notes || ''}\n[Désinscrit le ${new Date().toLocaleDateString('fr-FR')}]`.trim() },
    })
  }

  // Return a simple HTML page
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Désinscription</title></head>
<body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;">
<div style="background:#fff;border-radius:12px;padding:40px;text-align:center;max-width:400px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<h1 style="font-size:20px;color:#1a1a2e;margin:0 0 12px;">Désinscription confirmée</h1>
<p style="font-size:14px;color:#666;line-height:1.6;margin:0;">Vous ne recevrez plus de messages de notre part. Nous vous souhaitons le meilleur.</p>
<p style="font-size:12px;color:#aaa;margin-top:20px;">Agence Kameo</p>
</div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
