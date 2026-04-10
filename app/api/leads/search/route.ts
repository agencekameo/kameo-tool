import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 10

function getDataForSeoAuth() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw new Error('DataForSEO credentials missing')
  return Buffer.from(`${login}:${password}`).toString('base64')
}

const LOCATION_CODES: Record<string, number> = {
  'Paris': 1006094, 'Lyon': 1006298, 'Marseille': 1006426, 'Toulouse': 1006707,
  'Bordeaux': 1006094, 'Lille': 1006282, 'Nantes': 1006464, 'Strasbourg': 1006680,
  'Nice': 1006484, 'Rennes': 1006570, 'Montpellier': 1006449, 'France': 2250,
}

// Step 1: Generate keywords via Anthropic
async function generateRelatedKeywords(keyword: string, onlyFreelance = false): Promise<string[]> {
  try {
    const anthropic = new Anthropic()
    const prompt = onlyFreelance
      ? `Génère 5 à 8 variantes de mots-clés Google Maps pour le terme "${keyword}".
Ce sont des termes pour trouver des FREELANCES/INDÉPENDANTS/CONSULTANTS.
Inclus le terme original. Privilégie les termes contenant "freelance", "indépendant", "consultant".
Réponds UNIQUEMENT en JSON array de strings.`
      : `Génère 5 à 8 variantes de mots-clés Google Maps pour le terme "${keyword}".
Ce sont des termes qu'un utilisateur taperait dans Google Maps pour trouver des AGENCES/ENTREPRISES (pas des freelances ou indépendants).
Inclus le terme original. Privilégie les termes contenant "agence", "cabinet", "société", "studio", "groupe".
Exclure tout terme lié aux freelances, indépendants, auto-entrepreneurs, consultants solo.
Réponds UNIQUEMENT en JSON array de strings. Ex: ["agence web","studio web","agence digitale"]`
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
  } catch { /* fallback */ }
  return [keyword]
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { step } = body

  // ═══ STEP 1: Generate keywords ═══
  if (step === 'keywords') {
    const { keyword, typeFilter } = body
    const keywords = await generateRelatedKeywords(keyword, typeFilter === 'freelance')
    return NextResponse.json({ keywords })
  }

  // ═══ STEP 2: Search one keyword on DataForSEO ═══
  if (step === 'search') {
    const { keyword: kw, location } = body
    const locationCode = LOCATION_CODES[location] || 2250
    let authToken: string
    try { authToken = getDataForSeoAuth() } catch {
      return NextResponse.json({ error: 'Configuration DataForSEO manquante' }, { status: 500 })
    }
    const res = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: kw, location_code: locationCode, language_code: 'fr', device: 'desktop', os: 'windows', depth: 700 }]),
    })
    const data = await res.json()
    if (data.status_code === 20000 && data.tasks?.[0]?.status_code === 20000) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = data.tasks[0].result?.[0]?.items || []
      const mapItems = items.filter((i: { type?: string }) => i.type === 'maps_search')
      const results = mapItems.length > 0 ? mapItems : items
      // Only keep essential fields to reduce payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slim = results.map((r: any) => ({
        title: r.title, phone: r.phone, url: r.url, address: r.address,
        is_closed: r.is_closed, permanently_closed: r.permanently_closed,
        category: r.category, rating: r.rating?.value, reviews: r.rating?.votes_count ?? r.reviews_count ?? 0,
      }))
      return NextResponse.json({ results: slim })
    }
    return NextResponse.json({ results: [], error: `DataForSEO: ${data.tasks?.[0]?.status_message || data.status_code}` })
  }

  // ═══ STEP 3: Classify with AI ═══
  if (step === 'classify') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { results, typeFilter } = body as { results: any[]; typeFilter: string }
    if (!results || results.length === 0 || typeFilter === 'all') {
      return NextResponse.json({ keepIds: results?.map((_: unknown, i: number) => i) || [] })
    }
    try {
      const anthropic = new Anthropic()
      const batch = results.map((r: { title: string; category?: string; rating?: number; reviews?: number; address?: string }, i: number) => ({
        id: i, name: r.title, category: r.category || '', rating: r.rating ?? null, reviews: r.reviews ?? 0, address: r.address || '',
      }))
      const targetType = typeFilter === 'freelance' ? 'FREELANCE' : 'AGENCE'
      const classifRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: `Analyse cette liste d'entreprises trouvées sur Google Maps.
Pour chaque entrée, détermine si c'est une AGENCE/ENTREPRISE ou un FREELANCE/INDÉPENDANT.

Critères FREELANCE/INDÉPENDANT :
- Le nom contient un prénom + nom de personne sans structure (ex: "Jean Dupont", "Marie Martin Développeur")
- Le nom contient "freelance", "indépendant", "auto-entrepreneur", "consultant" seul
- Très peu d'avis (0-1) ET le nom ressemble à un nom de personne

Critères AGENCE/ENTREPRISE :
- Le nom contient "agence", "cabinet", "studio", "groupe", "société", "SARL", "SAS", "EURL"
- Nom de marque/entreprise clairement identifiable
- Nombre d'avis significatif (3+)

Je veux UNIQUEMENT les ${targetType === 'FREELANCE' ? 'FREELANCES/INDÉPENDANTS' : 'AGENCES/ENTREPRISES'}.
Réponds UNIQUEMENT en JSON array des IDs à GARDER. Ex: [0,1,3,5]

Liste :
${JSON.stringify(batch)}` }],
      })
      const text = classifRes.content[0].type === 'text' ? classifRes.content[0].text : '[]'
      const match = text.match(/\[[\s\S]*\]/)
      if (match) return NextResponse.json({ keepIds: JSON.parse(match[0]) })
    } catch { /* fallback */ }
    return NextResponse.json({ keepIds: results.map((_: unknown, i: number) => i) })
  }

  // ═══ STEP 4: Save results ═══
  if (step === 'save') {
    const { results, keyword, location, userId, listName, filters } = body
    const assignTo = userId || session.user.id
    const websiteFilter = filters?.website || 'with'
    const addressFilter = filters?.address || 'all'
    const phoneFilter = filters?.phone || 'all'
    const minRating = Number(filters?.minRating) || 0
    const minReviews = Number(filters?.minReviews) || 0

    // Deduplicate against existing
    const existingProspects = await prisma.prospect.findMany({ select: { name: true, phone: true } })
    const existingNames = new Set(existingProspects.map(p => p.name.toLowerCase().trim()))
    const existingPhones = new Set(existingProspects.filter(p => p.phone).map(p => p.phone!.replace(/\s/g, '')))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unique = results.filter((r: any) => {
      if (!r.title) return false
      const nameLower = r.title.toLowerCase().trim()
      const phone = r.phone?.replace(/\s/g, '') || ''
      if (existingNames.has(nameLower)) return false
      if (phone && existingPhones.has(phone)) return false
      existingNames.add(nameLower)
      if (phone) existingPhones.add(phone)
      return true
    })

    // Heuristic filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = unique.filter((r: any) => {
      if (r.is_closed || r.permanently_closed) return false
      if (websiteFilter === 'with' && !r.url) return false
      if (websiteFilter === 'without' && r.url) return false
      if (!r.phone) return false
      if (phoneFilter !== 'all') {
        const cleanPhone = (r.phone || '').replace(/\s/g, '').replace(/^\+33/, '0')
        const isMobile = /^0[67]/.test(cleanPhone)
        const isLandline = /^0[1-5]|^09/.test(cleanPhone)
        if (phoneFilter === 'mobile' && !isMobile) return false
        if (phoneFilter === 'landline' && !isLandline) return false
      }
      if (addressFilter === 'with' && !r.address) return false
      if (addressFilter === 'without' && r.address) return false
      if (minRating > 0 && (r.rating ?? 0) < minRating) return false
      if (minReviews > 0 && (r.reviews ?? 0) < minReviews) return false
      return true
    })

    if (filtered.length === 0) {
      return NextResponse.json({ searchId: null, total: 0, duplicates: results.length - unique.length, filtered: unique.length - filtered.length })
    }

    const withWebsite = filtered.filter((r: { url?: string }) => r.url)
    const search = await prisma.leadSearch.create({
      data: { name: listName || null, keyword, location, userId: assignTo, resultCount: filtered.length, withEmail: 0, totalToScrape: withWebsite.length, scrapedCount: 0, scrapingStatus: withWebsite.length > 0 ? 'SCRAPING' : 'DONE' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.prospect.createMany({
      data: filtered.map((r: any) => ({
        name: r.title, company: r.title, phone: r.phone || null,
        firstName: null, lastName: null,
        website: r.url || null, address: r.address || null,
        status: 'A_CONTACTER', assignedTo: assignTo, leadSearchId: search.id,
        source: `scraping:${keyword}`,
      })),
    })

    return NextResponse.json({
      searchId: search.id, total: filtered.length, duplicates: results.length - unique.length,
      filtered: unique.length - filtered.length, needsScraping: withWebsite.length > 0,
    })
  }

  return NextResponse.json({ error: 'Step requis (keywords, search, classify, save)' }, { status: 400 })
}
