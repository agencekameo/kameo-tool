import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await prisma.articleTemplate.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const template = await prisma.articleTemplate.create({
    data: {
      name: body.name,
      description: body.description || null,
      unitPrice: body.unitPrice || 0,
      unit: body.unit || 'forfait',
      category: body.category || null,
    },
  })
  return NextResponse.json(template)
}
