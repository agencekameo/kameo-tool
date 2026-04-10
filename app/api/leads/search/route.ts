import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

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

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
}

const JUNK_DOMAINS = ['example.', 'wixpress', 'sentry', 'wordpress.org', 'gravatar', 'schema.org', 'cloudflare',
  'google', 'facebook', 'w3.org', 'apache.org', 'microsoft', 'jquery', 'bootstrap', 'github', 'npm',
  'protection', 'sentry.io', 'gstatic', 'googleapis', 'fontawesome', 'cdnjs', 'polyfill', 'recaptcha']

async function fetchAndExtractEmails(pageUrl: string): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(pageUrl, { signal: controller.signal, headers: BROWSER_HEADERS, redirect: 'follow' })
    clearTimeout(timeout)
    if (!res.ok) return []
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return []
    const html = await res.text()
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
    const allFound = new Set<string>()
    for (const m of html.matchAll(emailRegex)) allFound.add(m[0].toLowerCase())
    const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi
    for (const m of html.matchAll(mailtoRegex)) allFound.add(m[1].toLowerCase())
    const decoded = html.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    for (const m of decoded.matchAll(emailRegex)) allFound.add(m[0].toLowerCase())
    const deobfuscated = html.replace(/\s*\[at\]\s*/gi, '@').replace(/\s*\[dot\]\s*/gi, '.')
      .replace(/\s*\(at\)\s*/gi, '@').replace(/\s*\(dot\)\s*/gi, '.')
    for (const m of deobfuscated.matchAll(emailRegex)) allFound.add(m[0].toLowerCase())
    return [...allFound].filter(e =>
      !JUNK_DOMAINS.some(j => e.includes(j)) &&
      !e.includes('.png') && !e.includes('.jpg') && !e.includes('.svg') && !e.endsWith('.webp') &&
      !e.startsWith('test@') && !e.startsWith('user@') && !e.startsWith('placeholder') &&
      !e.startsWith('your') && !e.startsWith('email@') && !e.startsWith('name@') &&
      e.length < 60 && e.length > 5
    )
  } catch { return [] }
}

async function scrapeEmail(url: string): Promise<string | null> {
  try {
    let baseUrl = url
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    let origin: string
    try { origin = new URL(baseUrl).origin } catch { return null }
    const allEmails: string[] = []
    const addEmails = (emails: string[]) => { for (const e of emails) if (!allEmails.includes(e)) allEmails.push(e) }
    if (baseUrl.startsWith('http://')) {
      const httpsUrl = baseUrl.replace('http://', 'https://')
      addEmails(await fetchAndExtractEmails(httpsUrl))
      if (allEmails.length === 0) addEmails(await fetchAndExtractEmails(baseUrl))
      else origin = origin.replace('http://', 'https://')
    } else {
      addEmails(await fetchAndExtractEmails(baseUrl))
    }
    if (allEmails.length === 0) {
      const contactPaths = ['/contact', '/nous-contacter', '/contactez-nous', '/contact-us', '/contact/', '/nous-contacter/']
      const results = await Promise.all(contactPaths.map(p => fetchAndExtractEmails(origin + p)))
      for (const r of results) addEmails(r)
    }
    if (allEmails.length === 0) {
      const morePaths = ['/a-propos', '/about', '/mentions-legales', '/equipe', '/agence', '/societe']
      const results = await Promise.all(morePaths.map(p => fetchAndExtractEmails(origin + p)))
      for (const r of results) addEmails(r)
    }
    if (allEmails.length === 0) return null
    const preferred = allEmails.find(e => /^(contact|info|hello|bonjour|accueil|agence|cabinet|direction|commercial)@/i.test(e))
    if (preferred) return preferred
    try {
      const hostname = new URL(origin).hostname.replace('www.', '')
      const domainBase = hostname.split('.')[0]
      const sameDomain = allEmails.find(e => e.includes('@') && e.split('@')[1].includes(domainBase))
      if (sameDomain) return sameDomain
    } catch { /* */ }
    return allEmails[0]
  } catch { return null }
}


export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { keyword, location, userId, filters, listName } = await req.json()
  const websiteFilter = filters?.website || 'with' // 'all' | 'with' | 'without'
  const addressFilter = filters?.address || 'all'
  const typeFilter = filters?.type || 'company' // 'all' | 'company' | 'freelance'
  const phoneFilter = filters?.phone || 'all' // 'all' | 'mobile' | 'landline'
  const minRating = Number(filters?.minRating) || 0
  const minReviews = Number(filters?.minReviews) || 0
  if (!keyword || !location) return new Response(JSON.stringify({ error: 'Keyword et location requis' }), { status: 400 })

  const assignTo = userId || session.user.id
  const locationCode = LOCATION_CODES[location] || 2250
  let authToken: string
  try { authToken = getDataForSeoAuth() } catch {
    return new Response(JSON.stringify({ error: 'Configuration DataForSEO manquante' }), { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ step: 'search', message: `Recherche "${keyword}" sur Google Maps...`, progress: 5 })
        const res = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
          method: 'POST',
          headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword, location_code: locationCode, language_code: 'fr', device: 'desktop', os: 'windows', depth: 700 }]),
        })
        const apiData = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let allResults: any[] = []
        if (apiData.status_code === 20000 && apiData.tasks?.[0]?.status_code === 20000) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items: any[] = apiData.tasks[0].result?.[0]?.items || []
          const mapItems = items.filter((i: { type?: string }) => i.type === 'maps_search')
          allResults = mapItems.length > 0 ? mapItems : items
          send({ step: 'search', message: `${allResults.length} résultats trouvés`, progress: 15 })
        } else {
          send({ step: 'error', message: `Erreur DataForSEO (code: ${apiData.status_code}, task: ${apiData.tasks?.[0]?.status_code}, msg: ${apiData.tasks?.[0]?.status_message || 'none'})` })
          controller.close()
          return
        }

        // Deduplicate within results
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
          send({ step: 'error', message: `Aucun résultat trouvé (${keywords.length} mots-clés testés: ${keywords.join(', ')})` })
          controller.close()
          return
        }

        send({ step: 'search', message: `${allResults.length} entreprises trouvées. Dédoublonnage...`, progress: 15 })

        // Deduplicate against ALL existing prospects (cross-user)
        const existingProspects = await prisma.prospect.findMany({
          select: { name: true, phone: true },
        })
        const existingNames = new Set(existingProspects.map(p => p.name.toLowerCase().trim()))
        const existingPhones = new Set(existingProspects.filter(p => p.phone).map(p => p.phone!.replace(/\s/g, '')))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueResults = allResults.filter((r: any) => {
          const nameLower = r.title.toLowerCase().trim()
          const phone = r.phone?.replace(/\s/g, '') || ''
          if (existingNames.has(nameLower)) return false
          if (phone && existingPhones.has(phone)) return false
          existingNames.add(nameLower)
          if (phone) existingPhones.add(phone)
          return true
        })

        send({ step: 'dedup', message: `${uniqueResults.length} nouveaux leads (${allResults.length - uniqueResults.length} doublons)`, progress: 20 })

        if (uniqueResults.length === 0) {
          send({ step: 'done', message: 'Tous les leads existaient déjà', searchId: null, total: 0, withEmail: 0 })
          controller.close()
          return
        }

        // ═══ FILTRAGE HEURISTIQUE ═══
        send({ step: 'filter', message: 'Filtrage des freelances et entreprises fermées...', progress: 22 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const heuristicFiltered = uniqueResults.filter((r: any) => {
          if (r.is_closed || r.permanently_closed) return false
          if (websiteFilter === 'with' && !r.url) return false
          if (websiteFilter === 'without' && r.url) return false
          if (!r.phone) return false // telephone toujours obligatoire
          if (phoneFilter !== 'all') {
            const cleanPhone = (r.phone || '').replace(/\s/g, '').replace(/^\+33/, '0')
            const isMobile = /^0[67]/.test(cleanPhone)
            const isLandline = /^0[1-5]|^09/.test(cleanPhone)
            if (phoneFilter === 'mobile' && !isMobile) return false
            if (phoneFilter === 'landline' && !isLandline) return false
          }
          if (addressFilter === 'with' && !r.address) return false
          if (addressFilter === 'without' && r.address) return false
          const rating = r.rating?.value ?? 0
          const reviews = r.rating?.votes_count ?? r.reviews_count ?? 0
          if (minRating > 0 && rating < minRating) return false
          if (minReviews > 0 && reviews < minReviews) return false
          return true
        })

        const heuristicRemoved = uniqueResults.length - heuristicFiltered.length
        const filteredResults = heuristicFiltered
        send({ step: 'filter', message: `${heuristicRemoved} filtrés. ${filteredResults.length} résultats conservés.`, progress: 30 })

        if (filteredResults.length === 0) {
          send({ step: 'done', message: 'Aucune agence trouvée après filtrage', searchId: null, total: 0, withEmail: 0 })
          controller.close()
          return
        }

        // Create LeadSearch
        const withWebsite = filteredResults.filter((r: { url?: string }) => r.url)
        const withoutWebsite = filteredResults.filter((r: { url?: string }) => !r.url)

        const search = await prisma.leadSearch.create({
          data: { name: listName || null, keyword, location, userId: assignTo, resultCount: filteredResults.length, withEmail: 0, totalToScrape: withWebsite.length, scrapedCount: 0, scrapingStatus: withWebsite.length > 0 ? 'SCRAPING' : 'DONE' },
        })

        send({ step: 'saving', message: `Enregistrement de ${filteredResults.length} agences...`, progress: 35 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.prospect.createMany({
          data: filteredResults.map((r: any) => ({
            name: r.title, company: r.title, phone: r.phone || null,
            firstName: null, lastName: null,
            website: r.url || null, address: r.address || null,
            status: 'A_CONTACTER', assignedTo: assignTo, leadSearchId: search.id,
            source: `scraping:${keyword}`,
          })),
        })

        send({
          step: 'done', message: `${filteredResults.length} agences enregistrées. Scraping des emails en cours...`,
          progress: 100, searchId: search.id, total: filteredResults.length, needsScraping: withWebsite.length > 0,
        })
      } catch (err) {
        send({ step: 'error', message: `Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
