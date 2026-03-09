import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const KNOWN_UNITS = ['forfait', 'jour', 'heure', 'page', 'mois', 'unité', 'jours', 'heures', 'pages']
const UNIT_NORMALIZE: Record<string, string> = { jours: 'jour', heures: 'heure', pages: 'page' }

function parsePrompt(prompt: string): { name: string; description: string; unitPrice: number; unit: string } {
  let text = prompt.trim()

  // Extract price (e.g. "2500€", "2 500 €", "1500.50€", "2500 euros")
  let unitPrice = 0
  const priceMatch = text.match(/(\d[\d\s]*[\d](?:[.,]\d+)?)\s*(?:€|euros?|eur)/i)
    || text.match(/(?:€|euros?)\s*(\d[\d\s]*[\d](?:[.,]\d+)?)/i)
  if (priceMatch) {
    unitPrice = parseFloat(priceMatch[1].replace(/\s/g, '').replace(',', '.'))
    text = text.replace(priceMatch[0], ' ').trim()
  }

  // Extract unit (e.g. "/jour", "par jour", "forfait", at the end)
  let unit = 'forfait'
  const unitMatch = text.match(/(?:\/|par\s+)(forfait|jour|heure|page|mois|unité|jours|heures|pages)/i)
    || text.match(/\b(forfait|jour|heure|page|mois|unité|jours|heures|pages)\s*$/i)
  if (unitMatch) {
    const raw = unitMatch[1].toLowerCase()
    unit = UNIT_NORMALIZE[raw] || raw
    text = text.replace(unitMatch[0], ' ').trim()
  }

  // Clean up leftover separators
  text = text.replace(/\s{2,}/g, ' ').replace(/^[\s,\-–]+|[\s,\-–]+$/g, '').trim()

  const name = text || prompt.trim()
  const description = name

  return { name, description, unitPrice, unit }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const templates = await prisma.articleTemplate.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(templates)
  } catch (err) {
    console.error('[GET /api/article-templates]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()

    let name: string, description: string | null, unitPrice: number, unit: string, category: string | null

    if (body.prompt) {
      // Parse from natural language prompt
      const parsed = parsePrompt(body.prompt)
      name = parsed.name
      description = parsed.description
      unitPrice = parsed.unitPrice
      unit = parsed.unit
      category = null
    } else {
      name = body.name
      description = body.description || null
      unitPrice = body.unitPrice || 0
      unit = body.unit || 'forfait'
      category = body.category || null
    }

    const template = await prisma.articleTemplate.create({
      data: { name, description, unitPrice, unit, category },
    })
    return NextResponse.json(template)
  } catch (err) {
    console.error('[POST /api/article-templates]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
