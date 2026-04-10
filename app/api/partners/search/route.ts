import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

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

async function generateRelatedKeywords(keyword: string): Promise<string[]> {
  try {
    const anthropic = new Anthropic()
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Génère 5 à 8 variantes de mots-clés Google Maps pour le terme "${keyword}".
Ce sont des termes qu'un utilisateur taperait dans Google Maps pour trouver des entreprises similaires.
Inclus le terme original. Variantes : synonymes, termes proches, spécialisations du même secteur.
Réponds UNIQUEMENT en JSON array de strings, sans explication. Ex: ["agence web","studio web","agence digitale"]` }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
  } catch { /* fallback to original keyword */ }
  return [keyword]
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

  const { keyword, location, listName, filters } = await req.json()
  const websiteFilter = filters?.website || 'with'
  const addressFilter = filters?.address || 'all'
  const typeFilter = filters?.type || 'company'
  const minRating = Number(filters?.minRating) || 0
  const minReviews = Number(filters?.minReviews) || 0
  if (!keyword || !location) return new Response(JSON.stringify({ error: 'Keyword et location requis' }), { status: 400 })

  const locationCode = LOCATION_CODES[location] || 2250
  let authToken: string
  try { authToken = getDataForSeoAuth() } catch {
    return new Response(JSON.stringify({ error: 'Configuration DataForSEO manquante' }), { status: 500 })
  }

  // SSE streaming response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ── Step 0: Generate related keywords ──
        send({ step: 'keywords', message: 'Génération des mots-clés associés...', progress: 2 })
        const keywords = await generateRelatedKeywords(keyword)
        send({ step: 'keywords', message: `${keywords.length} mots-clés : ${keywords.join(', ')}`, progress: 5 })

        // ── Step 1: Google Maps search for ALL keywords ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let allResults: any[] = []

        for (let ki = 0; ki < keywords.length; ki++) {
          const kw = keywords[ki]
          send({ step: 'search', message: `Recherche "${kw}" (${ki + 1}/${keywords.length})...`, progress: 5 + Math.round((ki / keywords.length) * 10) })

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
            const kwResults = mapItems.length > 0 ? mapItems : items
            allResults.push(...kwResults)
          }
        }

        // Deduplicate within search results (by name)
        const seenNames = new Set<string>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allResults = allResults.filter((r: any) => {
          if (!r.title) return false
          const key = r.title.toLowerCase().trim()
          if (seenNames.has(key)) return false
          seenNames.add(key)
          return true
        })

        if (allResults.length === 0) {
          send({ step: 'error', message: 'Aucun résultat trouvé' })
          controller.close()
          return
        }

        const results = allResults
        send({ step: 'search', message: `${results.length} entreprises trouvées (${keywords.length} mots-clés). Dédoublonnage...`, progress: 15 })

        // ── Step 2: Deduplicate against existing partners ──
        const existingPartners = await prisma.partner.findMany({ select: { name: true, phone: true } })
        const existingNames = new Set(existingPartners.map(p => p.name.toLowerCase().trim()))
        const existingPhones = new Set(existingPartners.filter(p => p.phone).map(p => p.phone!.replace(/\s/g, '')))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueResults = results.filter((r: any) => {
          if (!r.title) return false
          const nameLower = r.title.toLowerCase().trim()
          const phone = r.phone?.replace(/\s/g, '') || ''
          if (existingNames.has(nameLower)) return false
          if (phone && existingPhones.has(phone)) return false
          existingNames.add(nameLower)
          if (phone) existingPhones.add(phone)
          return true
        })

        send({ step: 'dedup', message: `${uniqueResults.length} nouvelles entreprises (${results.length - uniqueResults.length} doublons ignorés)`, progress: 20 })

        if (uniqueResults.length === 0) {
          send({ step: 'done', message: 'Toutes les entreprises existaient déjà', searchId: null, total: 0, withEmail: 0 })
          controller.close()
          return
        }

        // ── Step 2b: Apply filters ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filtered = uniqueResults.filter((r: any) => {
          if (!r.phone) return false // telephone toujours obligatoire
          if (websiteFilter === 'with' && !r.url) return false
          if (websiteFilter === 'without' && r.url) return false
          if (addressFilter === 'with' && !r.address) return false
          if (addressFilter === 'without' && r.address) return false
          const rating = r.rating?.value ?? 0
          const reviews = r.rating?.votes_count ?? r.reviews_count ?? 0
          if (minRating > 0 && rating < minRating) return false
          if (minReviews > 0 && reviews < minReviews) return false
          return true
        })

        send({ step: 'filter', message: `${uniqueResults.length - filtered.length} filtres. ${filtered.length} resultats.`, progress: 25 })

        if (filtered.length === 0) {
          send({ step: 'done', message: 'Aucun resultat apres filtrage', searchId: null, total: 0, withEmail: 0 })
          controller.close()
          return
        }

        // ── Step 3: Save to DB — email scraping is done separately via /api/partners/scrape-batch ──
        const withWebsite = filtered.filter((r: { url?: string }) => r.url)

        const search = await prisma.partnerSearch.create({
          data: {
            name: listName || null,
            keyword,
            location,
            resultCount: withWebsite.length,
            scrapingStatus: 'SCRAPING',
            totalToScrape: withWebsite.length,
            scrapedCount: 0,
          },
        })

        send({ step: 'saving', message: `Enregistrement de ${withWebsite.length} entreprises...`, progress: 90 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partnerData = withWebsite.map((r: any) => ({
          name: r.title,
          category: r.category || null,
          phone: r.phone || null,
          email: (r.email || r.contact_email || null) as string | null,
          website: r.url || null,
          address: r.address || null,
          rating: r.rating?.value ?? null,
          reviewCount: r.rating?.votes_count ?? null,
          searchId: search.id,
        }))

        await prisma.partner.createMany({ data: partnerData })

        send({
          step: 'done',
          message: `${withWebsite.length} entreprises enregistrées. Scraping des emails en cours...`,
          progress: 100,
          searchId: search.id,
          total: withWebsite.length,
          scrapingStatus: 'SCRAPING',
        })
      } catch (err) {
        send({ step: 'error', message: `Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
