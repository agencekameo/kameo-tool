import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const anthropic = new Anthropic()

interface KW { keyword: string; search_volume: number | null; competition: string | null; competition_index: number | null; cpc: number | null }
interface SERPItem { rank: number; domain: string; title: string; url: string }
interface SERPResult { keyword: string; items: SERPItem[] }
interface BacklinkSummary { domain: string; backlinks: number; referring_domains: number; rank: number }
interface PageSpeedResult { performance: number; fcp: number; lcp: number; cls: number; tbt: number; si: number }

interface FullSEOData {
  volumes: KW[]; suggestions: KW[]; serp: SERPResult[]
  backlinks: BacklinkSummary | null; competitorBacklinks: BacklinkSummary[]
  clusters: Record<string, string[]>; pageSpeed: { mobile: PageSpeedResult | null; desktop: PageSpeedResult | null }
  scrapedPages: { url: string; title: string; h1: string; meta: string; content: string }[]
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string })?.role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })

  const body = await req.json()
  let { businessName, sector, city, targetAudience, services, existingUrl, step, hasExistingSite } = body

  // Scrape info from existing site
  if (hasExistingSite && existingUrl && step === 'keywords') {
    const scraped = await scrapeAndExtractInfo(existingUrl)
    if (scraped) {
      businessName = scraped.businessName || businessName || ''
      sector = scraped.sector || sector || ''
      city = scraped.city || city || ''
      services = scraped.services || services || ''
      targetAudience = scraped.targetAudience || targetAudience || ''
    }
  }

  if (!hasExistingSite && (!businessName || !sector)) return NextResponse.json({ error: 'Nom et secteur requis' }, { status: 400 })
  if (hasExistingSite && !existingUrl) return NextResponse.json({ error: 'URL du site requis' }, { status: 400 })

  try {
    if (step === 'keywords') {
      // Step 1: Extract keywords + fetch ALL DataForSEO data
      const seedKeywords = await extractKeywords(businessName || '', sector || '', city || '', services || '', existingUrl || '')
      const seoData = await fetchAllSEOData(seedKeywords, existingUrl || '')
      return NextResponse.json({
        keywords: seedKeywords, seoData,
        extractedInfo: hasExistingSite ? { businessName, sector, city, services, targetAudience } : null,
      })
    }

    if (step === 'analyse') {
      const { seoDataStr } = body
      // Step 2: Stream analysis with Opus + multi-pass review
      return streamAuditWithReview(businessName || '', sector || '', city || '', targetAudience || '', services || '', existingUrl || '', seoDataStr || '')
    }

    return NextResponse.json({ error: 'Step invalide' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/audit-premium]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dfHeaders() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  return { 'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`, 'Content-Type': 'application/json' }
}

async function dfPost(endpoint: string, body: unknown) {
  const h = dfHeaders()
  if (!h) return null
  try {
    const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, { method: 'POST', headers: h, body: JSON.stringify(body) })
    return await res.json()
  } catch { return null }
}

// ─── Extract keywords ───────────────────────────────────────────────────────

async function extractKeywords(business: string, sector: string, city: string, services: string, url: string): Promise<string[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `Expert SEO senior. Extrais 25 mots-clés Google pertinents pour cette entreprise.
Inclus : 6 mots-clés principaux courte traîne, 6 géolocalisés (ville+département si dispo), 6 longue traîne (questions, "comment", "meilleur"), 4 concurrentiels, 3 marque/navigation.
Réponds UNIQUEMENT en JSON array de strings.`,
      messages: [{ role: 'user', content: `Entreprise: ${business}\nSecteur: ${sector}\nVille: ${city || 'France'}\nServices: ${services || 'N/A'}\nSite: ${url || 'Pas de site'}` }],
    })
    const text = (response.content[0] as { text: string }).text.trim()
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch { return [] }
}

// ─── Keyword clustering ─────────────────────────────────────────────────────

async function clusterKeywords(keywords: KW[]): Promise<Record<string, string[]>> {
  try {
    const kwList = keywords.filter(k => k.search_volume).map(k => k.keyword).join(', ')
    if (!kwList) return {}
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: 'Expert SEO. Regroupe ces mots-clés par intention de recherche et thématique pour construire un cocon sémantique. Réponds UNIQUEMENT en JSON: {"cluster_name": ["kw1", "kw2"]}. Max 10 clusters.',
      messages: [{ role: 'user', content: kwList }],
    })
    const text = (response.content[0] as { text: string }).text.trim()
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch { return {} }
}

// ─── Scrape + extract info ──────────────────────────────────────────────────

async function scrapeAndExtractInfo(url: string) {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch(normalized, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoBot/1.0)' }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const html = await res.text()
    const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
    const meta = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || ''
    const h1s = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []).map(strip)
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 500,
      system: 'Extrais les infos de ce site. Réponds UNIQUEMENT en JSON: {"businessName":"","sector":"","city":"","services":"","targetAudience":""}',
      messages: [{ role: 'user', content: `URL: ${normalized}\nTitle: ${strip(title)}\nMeta: ${meta}\nH1: ${h1s.join(' | ')}\nContenu: ${body.substring(0, 2000)}` }],
    })
    return JSON.parse((response.content[0] as { text: string }).text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch { return null }
}

// ─── Multi-page scraping ────────────────────────────────────────────────────

async function scrapeMultiPage(baseUrl: string): Promise<{ url: string; title: string; h1: string; meta: string; content: string }[]> {
  try {
    const normalized = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    const domain = new URL(normalized).hostname
    const fetchPage = async (u: string) => {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoBot/1.0)' }, signal: AbortSignal.timeout(8000) })
        return r.ok ? await r.text() : ''
      } catch { return '' }
    }
    const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const parsePage = (html: string, url: string) => ({
      url,
      title: strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''),
      h1: strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ''),
      meta: html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || '',
      content: html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 1000),
    })

    const homepage = await fetchPage(normalized)
    if (!homepage) return []

    const links = new Set<string>()
    const linkRegex = /href=["'](\/[^"'#?]*|https?:\/\/[^"'#?]*)/gi
    let match
    while ((match = linkRegex.exec(homepage)) !== null) {
      let href = match[1]
      if (href.startsWith('/')) href = new URL(href, normalized).href
      try { if (new URL(href).hostname === domain && !href.match(/\.(jpg|png|gif|svg|css|js|pdf|zip)/i)) links.add(href) } catch {}
    }

    const pages = [parsePage(homepage, normalized)]
    const subPages = await Promise.all(Array.from(links).slice(0, 10).map(fetchPage))
    Array.from(links).slice(0, 10).forEach((url, i) => { if (subPages[i]) pages.push(parsePage(subPages[i], url)) })
    return pages
  } catch { return [] }
}

// ─── PageSpeed API ──────────────────────────────────────────────────────────

async function fetchPageSpeed(url: string): Promise<{ mobile: PageSpeedResult | null; desktop: PageSpeedResult | null }> {
  const apiKey = process.env.GOOGLE_PAGESPEED_KEY
  const parseResult = (data: Record<string, unknown>): PageSpeedResult | null => {
    try {
      const lhr = data.lighthouseResult as Record<string, unknown>
      const audits = lhr?.audits as Record<string, Record<string, unknown>>
      const cats = lhr?.categories as Record<string, Record<string, unknown>>
      return {
        performance: Math.round(((cats?.performance?.score as number) || 0) * 100),
        fcp: (audits?.['first-contentful-paint']?.numericValue as number) || 0,
        lcp: (audits?.['largest-contentful-paint']?.numericValue as number) || 0,
        cls: (audits?.['cumulative-layout-shift']?.numericValue as number) || 0,
        tbt: (audits?.['total-blocking-time']?.numericValue as number) || 0,
        si: (audits?.['speed-index']?.numericValue as number) || 0,
      }
    } catch { return null }
  }

  const base = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}${apiKey ? `&key=${apiKey}` : ''}&category=performance`
  try {
    const [mRes, dRes] = await Promise.all([
      fetch(`${base}&strategy=mobile`).then(r => r.json()),
      fetch(`${base}&strategy=desktop`).then(r => r.json()),
    ])
    return { mobile: parseResult(mRes), desktop: parseResult(dRes) }
  } catch { return { mobile: null, desktop: null } }
}

// ─── Fetch ALL SEO Data ─────────────────────────────────────────────────────

async function fetchAllSEOData(keywords: string[], existingUrl: string): Promise<FullSEOData> {
  const empty: FullSEOData = { volumes: [], suggestions: [], serp: [], backlinks: null, competitorBacklinks: [], clusters: {}, pageSpeed: { mobile: null, desktop: null }, scrapedPages: [] }
  if (!dfHeaders() || keywords.length === 0) return empty

  const topKw = keywords.slice(0, 5)

  // All DataForSEO calls in parallel
  const [volData, sugData, ...serpData] = await Promise.all([
    dfPost('keywords_data/google_ads/search_volume/live', [{ keywords: keywords.slice(0, 25), language_code: 'fr', location_code: 2250 }]),
    dfPost('keywords_data/google_ads/keywords_for_keywords/live', [{ keywords: topKw, language_code: 'fr', location_code: 2250 }]),
    ...topKw.slice(0, 3).map(kw => dfPost('serp/google/organic/live/regular', [{ keyword: kw, language_code: 'fr', location_code: 2250, depth: 10 }])),
  ])

  const volumes: KW[] = volData?.tasks?.[0]?.result || []
  const suggestions: KW[] = (sugData?.tasks?.[0]?.result || [])
    .filter((k: KW) => k.search_volume && k.search_volume > 0)
    .sort((a: KW, b: KW) => (b.search_volume || 0) - (a.search_volume || 0))
    .slice(0, 40)

  // Parse SERP
  const serp: SERPResult[] = []
  const competitorDomains = new Set<string>()
  for (let i = 0; i < 3; i++) {
    const d = serpData[i]
    if (d?.tasks?.[0]?.result?.[0]) {
      const items = (d.tasks[0].result[0].items || [])
        .filter((it: Record<string, unknown>) => it.type === 'organic')
        .slice(0, 10)
        .map((it: Record<string, unknown>) => {
          competitorDomains.add(it.domain as string)
          return { rank: it.rank_group, domain: it.domain, title: it.title, url: it.url }
        })
      serp.push({ keyword: topKw[i], items })
    }
  }

  // Fetch backlinks + competitor backlinks + PageSpeed + scraping + clustering in parallel
  const domain = existingUrl ? existingUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : ''
  const topCompetitors = Array.from(competitorDomains).filter(d => d !== domain && !d.includes('wikipedia') && !d.includes('youtube')).slice(0, 3)

  const parallelTasks: Promise<unknown>[] = [
    // Backlinks for client site
    domain ? dfPost('backlinks/summary/live', [{ target: domain, internal_list_limit: 0, backlinks_filters: ['dofollow', '=', 'true'] }]) : Promise.resolve(null),
    // Backlinks for top 3 competitors
    ...topCompetitors.map(comp => dfPost('backlinks/summary/live', [{ target: comp, internal_list_limit: 0, backlinks_filters: ['dofollow', '=', 'true'] }])),
    // PageSpeed (if existing site)
    existingUrl ? fetchPageSpeed(existingUrl) : Promise.resolve({ mobile: null, desktop: null }),
    // Multi-page scraping (if existing site)
    existingUrl ? scrapeMultiPage(existingUrl) : Promise.resolve([]),
    // Keyword clustering
    clusterKeywords([...volumes, ...suggestions]),
  ]

  const results = await Promise.allSettled(parallelTasks)
  const getVal = <T,>(idx: number): T | null => {
    const r = results[idx]
    return r.status === 'fulfilled' ? r.value as T : null
  }

  // Client backlinks
  let backlinks: BacklinkSummary | null = null
  const blData = getVal<Record<string, unknown>>(0)
  if (blData && (blData as Record<string, unknown>)?.tasks) {
    const r = ((blData as Record<string, unknown>).tasks as Record<string, unknown>[])?.[0]?.result as Record<string, unknown>[] | undefined
    if (r?.[0]) backlinks = { domain, backlinks: (r[0].backlinks as number) || 0, referring_domains: (r[0].referring_domains as number) || 0, rank: (r[0].rank as number) || 0 }
  }

  // Competitor backlinks
  const competitorBacklinks: BacklinkSummary[] = []
  for (let i = 0; i < topCompetitors.length; i++) {
    const cbl = getVal<Record<string, unknown>>(1 + i)
    if (cbl && (cbl as Record<string, unknown>)?.tasks) {
      const r = ((cbl as Record<string, unknown>).tasks as Record<string, unknown>[])?.[0]?.result as Record<string, unknown>[] | undefined
      if (r?.[0]) competitorBacklinks.push({ domain: topCompetitors[i], backlinks: (r[0].backlinks as number) || 0, referring_domains: (r[0].referring_domains as number) || 0, rank: (r[0].rank as number) || 0 })
    }
  }

  const pageSpeed = getVal<{ mobile: PageSpeedResult | null; desktop: PageSpeedResult | null }>(1 + topCompetitors.length) || { mobile: null, desktop: null }
  const scrapedPages = getVal<{ url: string; title: string; h1: string; meta: string; content: string }[]>(2 + topCompetitors.length) || []
  const clusters = getVal<Record<string, string[]>>(3 + topCompetitors.length) || {}

  return { volumes, suggestions, serp, backlinks, competitorBacklinks, clusters, pageSpeed, scrapedPages }
}

// ─── Format SEO data for Claude ─────────────────────────────────────────────

function formatFullSEOData(data: FullSEOData): string {
  const p: string[] = ['## DONNÉES SEO RÉELLES (DataForSEO + Google PageSpeed)\n']

  if (data.volumes.length > 0) {
    p.push('### Volumes — Mots-clés principaux')
    p.push('| Mot-clé | Vol/mois | Concurrence | CPC |')
    p.push('|---------|----------|-------------|-----|')
    for (const k of data.volumes) p.push(`| ${k.keyword} | ${k.search_volume ?? 'N/A'} | ${k.competition || 'N/A'} | ${k.cpc ? k.cpc.toFixed(2) + '€' : 'N/A'} |`)
  }

  if (data.suggestions.length > 0) {
    p.push('\n### Mots-clés associés (opportunités)')
    p.push('| Mot-clé | Vol/mois | Concurrence | CPC |')
    p.push('|---------|----------|-------------|-----|')
    for (const k of data.suggestions.slice(0, 30)) p.push(`| ${k.keyword} | ${k.search_volume ?? 'N/A'} | ${k.competition || 'N/A'} | ${k.cpc ? k.cpc.toFixed(2) + '€' : 'N/A'} |`)
  }

  if (data.serp.length > 0) {
    p.push('\n### Analyse SERP — Qui ranke sur les mots-clés cibles')
    for (const s of data.serp) {
      p.push(`\n**"${s.keyword}"** — Top ${s.items.length} :`)
      for (const it of s.items) p.push(`${it.rank}. ${it.domain} — "${it.title}"`)
    }
  }

  if (data.backlinks) {
    p.push(`\n### Profil backlinks — ${data.backlinks.domain}`)
    p.push(`- Backlinks dofollow : ${data.backlinks.backlinks}`)
    p.push(`- Domaines référents : ${data.backlinks.referring_domains}`)
    p.push(`- Rank DataForSEO : ${data.backlinks.rank}`)
  }

  if (data.competitorBacklinks.length > 0) {
    p.push('\n### Backlinks concurrents (comparaison)')
    p.push('| Domaine | Backlinks | Domaines ref. | Rank |')
    p.push('|---------|-----------|---------------|------|')
    if (data.backlinks) p.push(`| **${data.backlinks.domain} (client)** | **${data.backlinks.backlinks}** | **${data.backlinks.referring_domains}** | **${data.backlinks.rank}** |`)
    for (const c of data.competitorBacklinks) p.push(`| ${c.domain} | ${c.backlinks} | ${c.referring_domains} | ${c.rank} |`)
  }

  if (data.pageSpeed.mobile || data.pageSpeed.desktop) {
    p.push('\n### Google PageSpeed (scores réels)')
    if (data.pageSpeed.mobile) {
      const m = data.pageSpeed.mobile
      p.push(`**Mobile** : Performance ${m.performance}/100 · FCP ${(m.fcp / 1000).toFixed(1)}s · LCP ${(m.lcp / 1000).toFixed(1)}s · CLS ${m.cls.toFixed(3)} · TBT ${Math.round(m.tbt)}ms`)
    }
    if (data.pageSpeed.desktop) {
      const d = data.pageSpeed.desktop
      p.push(`**Desktop** : Performance ${d.performance}/100 · FCP ${(d.fcp / 1000).toFixed(1)}s · LCP ${(d.lcp / 1000).toFixed(1)}s · CLS ${d.cls.toFixed(3)} · TBT ${Math.round(d.tbt)}ms`)
    }
  }

  if (Object.keys(data.clusters).length > 0) {
    p.push('\n### Clusters de mots-clés (cocon sémantique)')
    for (const [name, kws] of Object.entries(data.clusters)) p.push(`**${name}** : ${kws.join(', ')}`)
  }

  if (data.scrapedPages.length > 0) {
    p.push('\n### Contenu du site existant (scraping multi-pages)')
    for (const pg of data.scrapedPages.slice(0, 8)) {
      p.push(`\n**${pg.url}**`)
      p.push(`Title: ${pg.title} | H1: ${pg.h1} | Meta: ${pg.meta}`)
      p.push(`Contenu: ${pg.content.substring(0, 500)}`)
    }
  }

  p.push('\n⚠️ Source : DataForSEO + Google PageSpeed — ' + new Date().toLocaleDateString('fr-FR'))
  return p.join('\n')
}

// ─── Opus stream + multi-pass review ────────────────────────────────────────

function streamAuditWithReview(business: string, sector: string, city: string, audience: string, services: string, url: string, seoDataStr: string) {
  const encoder = new TextEncoder()

  const systemPrompt = `Tu es un consultant SEO senior de niveau expert dans une agence premium (Agence Kameo). Tu produis des audits SEO ultra-complets, actionnables, de qualité agence facturant 3000€+ l'audit.

RÈGLES ABSOLUES :
- Utilise EXCLUSIVEMENT les données réelles fournies (DataForSEO, PageSpeed, SERP, backlinks)
- Ne jamais inventer de volumes, scores ou chiffres
- Analyse les vrais concurrents identifiés dans les données SERP
- Compare le profil backlinks client vs concurrents
- Si PageSpeed est fourni, analyse les métriques réelles (Core Web Vitals)
- Si du contenu scrapé est fourni, analyse-le page par page
- Utilise les clusters de mots-clés pour recommander un cocon sémantique
- Niveau de détail maximal — chaque recommandation doit être spécifique et actionnable
- Tout en français, Markdown structuré`

  const userPrompt = `Produis un audit SEO premium complet :

**Entreprise** : ${business}
**Secteur** : ${sector}
**Localisation** : ${city || 'France'}
**Cible** : ${audience || 'Non précisée'}
**Services** : ${services || 'Non précisés'}
**Site existant** : ${url || 'Pas de site'}

${seoDataStr}

---

Structure :

## 1. SYNTHÈSE EXÉCUTIVE
- Score potentiel SEO global (/100) — justifié par les données
- 3 opportunités majeures (basées sur les données SERP et mots-clés)
- 3 risques identifiés
- Recommandation stratégique

## 2. ANALYSE DE MARCHÉ & CONCURRENCE
- Dynamique du marché (basée sur les volumes DataForSEO)
- Analyse des concurrents RÉELS (identifiés dans les SERP)
- Comparaison backlinks client vs concurrents (données réelles)
- Barrières à l'entrée et fenêtres d'opportunité
- Positionnement recommandé

## 3. ANALYSE MOTS-CLÉS (données DataForSEO réelles)
- Top 15 mots-clés prioritaires avec volumes, CPC, concurrence réels
- Clusters thématiques (cocon sémantique)
- Mots-clés longue traîne à fort potentiel
- Mots-clés géolocalisés
- Estimation trafic capturable

${url ? `## 4. AUDIT TECHNIQUE DU SITE
### Core Web Vitals (scores PageSpeed réels)
- Performance mobile et desktop
- FCP, LCP, CLS, TBT — analyse de chaque métrique
- Score global et comparaison aux seuils Google

### Analyse du contenu existant (scraping)
- Analyse page par page : title, H1, meta description
- Points forts à conserver
- Problèmes critiques identifiés
- Recommandations d'optimisation par page

### Profil backlinks
- Nombre de backlinks et domaines référents
- Comparaison avec les concurrents
- Stratégie de rattrapage` : `## 4. ARCHITECTURE DU NOUVEAU SITE
- Pages à créer (prioritaires)
- Structure recommandée
- Données structurées par page`}

## 5. STRATÉGIE SEO COMPLÈTE
### On-page
- Structure du site / cocon sémantique (basé sur les clusters)
- Optimisation par page (balises, contenu, maillage)
- Données structurées à implémenter

### SEO Local
- Google Business Profile
- Mots-clés locaux prioritaires (avec volumes)
- Stratégie avis clients

### Off-page / Netlinking
- Stratégie basée sur l'écart backlinks vs concurrents
- Sources de liens pertinentes pour le secteur
- Partenariats recommandés

### Content Marketing
- 10 sujets d'articles avec mot-clé cible et volume réel
- Calendrier éditorial
- Formats recommandés

## 6. PLAN D'ACTION PRIORISÉ
Tableau : Action | Priorité (P1/P2/P3) | Impact | Complexité | Délai
- Minimum 20 actions concrètes
- Ordonnées par ratio impact/effort

## 7. ESTIMATION ROI
- Trafic organique potentiel à 6 et 12 mois (basé sur les volumes réels)
- Estimation conversions
- Comparaison coût SEO vs acquisition pub (basé sur les CPC réels)`

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Pass 1: Draft with Opus
        controller.enqueue(encoder.encode(JSON.stringify({ phase: 'draft' }) + '\n'))
        let draft = ''
        const draftStream = anthropic.messages.stream({
          model: 'claude-opus-4-20250514',
          max_tokens: 16000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        for await (const event of draftStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            draft += event.delta.text
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        // Pass 2: Review with Opus
        controller.enqueue(encoder.encode(JSON.stringify({ phase: 'review' }) + '\n'))
        const reviewStream = anthropic.messages.stream({
          model: 'claude-opus-4-20250514',
          max_tokens: 16000,
          system: `Tu es un directeur SEO senior qui relit un audit produit par un consultant. Tu l'améliores :
- Vérifie que TOUS les chiffres cités correspondent aux données réelles fournies
- Renforce les analyses trop superficielles
- Ajoute des recommandations manquantes
- Améliore la précision des estimations ROI
- Vérifie la cohérence du plan d'action
- Assure que chaque recommandation est spécifique (pas de "optimiser le contenu" sans dire quoi exactement)
Renvoie la version COMPLÈTE améliorée en Markdown.`,
          messages: [{ role: 'user', content: `Voici l'audit à améliorer :\n\n${draft}` }],
        })

        controller.enqueue(encoder.encode(JSON.stringify({ clear: true }) + '\n'))
        for await (const event of reviewStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'))
        controller.close()
      } catch (err) {
        console.error('[stream audit-premium]', err)
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'Erreur de génération' }) + '\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } })
}
