import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { createLog } from '@/lib/log'
import { rateLimit } from '@/lib/security'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 180

// ── GET: list all audits ────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const audits = await prisma.audit.findMany({
    where: demoWhere(session),
    include: { createdBy: true, project: { include: { client: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(audits)
}

// ── POST: run a new audit ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard

  // Rate limit: max 3 audits per user per 10 minutes (expensive API calls)
  if (!rateLimit(`audit:${session.user.id}`, 3, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop d\'audits lancés. Réessayez dans quelques minutes.' }, { status: 429 })
  }

  const { url: rawUrl, projectId, keywords } = await req.json()
  if (!rawUrl) return NextResponse.json({ error: 'URL requise' }, { status: 400 })

  // Normalize URL: auto-detect https/http if no protocol given
  const url = await normalizeUrl(rawUrl)

  const apiKey = process.env.PAGESPEED_API_KEY

  try {
    // ── 1. Run PageSpeed, multi-page scraping, technical checks, and backlinks in parallel ──
    const [mobile, desktop, multiPage, technical, backlinksData] = await Promise.all([
      fetchPageSpeed(url, 'mobile', apiKey),
      fetchPageSpeed(url, 'desktop', apiKey),
      discoverAndScrapePages(url),
      checkTechnical(url),
      fetchBacklinks(new URL(url).hostname).catch(() => null),
    ])

    const performanceMobile = mobile.performance
    const performanceDesktop = desktop.performance

    // ── 2. Fetch & analyze website HTML ───────────────────────────────────────
    const siteAnalysis = await analyzeWebsite(url)

    // ── 2b. Broken links check ────────────────────────────────────────────────
    const brokenLinks = await checkBrokenLinks(multiPage.allInternalLinks.slice(0, 15))

    // ── 2c. Keyword density ───────────────────────────────────────────────────
    const kws_ = (keywords || '').toLowerCase().split(/[,;|]+/).map((k: string) => k.trim()).filter(Boolean)
    // Re-fetch homepage text content for keyword density calculation
    let combinedTextContent = ''
    try {
      const densityRes = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoAudit/1.0)' },
      })
      const densityHtml = await densityRes.text()
      combinedTextContent = densityHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    } catch { /* ignore */ }
    const keywordDensity = calculateKeywordDensity(combinedTextContent, kws_)

    // ── Core Web Vitals (average mobile + desktop) ────────────────────────────
    const cwvLcp = mobile.coreWebVitals.lcp ?? desktop.coreWebVitals.lcp ?? null
    const cwvCls = mobile.coreWebVitals.cls ?? desktop.coreWebVitals.cls ?? null

    // ── 4. Calculate 6 category scores ────────────────────────────────────────

    // 1. PERFORMANCES (moyenne mobile + desktop + CWV bonuses)
    let performanceScore = Math.round((performanceMobile + performanceDesktop) / 2)
    // CWV bonuses/penalties
    if (cwvLcp !== null) {
      if (cwvLcp < 2500) performanceScore += 5
      else if (cwvLcp < 4000) performanceScore += 2
      else performanceScore -= 5
    }
    if (cwvCls !== null) {
      if (cwvCls < 0.1) performanceScore += 5
      else if (cwvCls < 0.25) performanceScore += 2
      else performanceScore -= 5
    }
    performanceScore = Math.max(0, Math.min(performanceScore, 100))
    // CWV hard caps
    if (cwvLcp !== null && cwvLcp > 4000) performanceScore = Math.min(performanceScore, 50)
    if (cwvCls !== null && cwvCls > 0.25) performanceScore = Math.min(performanceScore, 55)

    // 2. BALISES — scoring exigeant avec analyse hiérarchie headings
    let balisesScore = 0
    const balisesChecks = {
      hasH1: siteAnalysis.hasH1,
      h1Count: siteAnalysis.h1Count,
      h1Text: siteAnalysis.h1Text,
      hasMetaTitle: !!siteAnalysis.metaTitle,
      hasMetaDescription: !!siteAnalysis.metaDescription,
      metaTitleLength: siteAnalysis.metaTitle?.length ?? 0,
      metaDescLength: siteAnalysis.metaDescription?.length ?? 0,
      hasCanonical: siteAnalysis.hasCanonical,
      hasOpenGraph: siteAnalysis.hasOpenGraph,
      ogTagCount: siteAnalysis.ogTagCount,
      hasOgTitle: siteAnalysis.hasOgTitle,
      hasOgDescription: siteAnalysis.hasOgDescription,
      hasOgImage: siteAnalysis.hasOgImage,
      h2Count: siteAnalysis.h2Count,
      h3Count: siteAnalysis.h3Count,
      h4Count: siteAnalysis.h4Count,
      h5Count: siteAnalysis.h5Count,
      h6Count: siteAnalysis.h6Count,
      totalHeadings: siteAnalysis.totalHeadings,
      hierarchyViolations: siteAnalysis.hierarchyViolations,
      duplicateHeadings: siteAnalysis.duplicateHeadings,
      hasDeepHeadingAbuse: siteAnalysis.hasDeepHeadingAbuse,
      headingStructure: siteAnalysis.headingStructure,
      kwInH1: false,
      kwInTitle: false,
      kwInDesc: false,
    }

    // ── Keyword coherence analysis ──
    const kws = (keywords || '').toLowerCase().split(/[,;|]+/).map((k: string) => k.trim()).filter(Boolean)
    const h1Lower = (balisesChecks.h1Text || '').toLowerCase()
    const titleLower = (siteAnalysis.metaTitle || '').toLowerCase()
    const descLower = (siteAnalysis.metaDescription || '').toLowerCase()
    const kwInH1 = kws.length > 0 ? kws.some((kw: string) => h1Lower.includes(kw)) : false
    const kwInTitle = kws.length > 0 ? kws.some((kw: string) => titleLower.includes(kw)) : false
    const kwInDesc = kws.length > 0 ? kws.some((kw: string) => descLower.includes(kw)) : false

    balisesChecks.kwInH1 = kwInH1
    balisesChecks.kwInTitle = kwInTitle
    balisesChecks.kwInDesc = kwInDesc

    // ── H1 (max 15 pts) ──
    if (balisesChecks.hasH1) {
      if (balisesChecks.h1Count === 1) balisesScore += 10
      else balisesScore += 4 // multiple H1 = probleme
      // H1 quality: not too short, not too long
      const h1Len = (balisesChecks.h1Text || '').length
      if (h1Len >= 20 && h1Len <= 70) balisesScore += 5
      else if (h1Len >= 10 && h1Len <= 100) balisesScore += 2
    }

    // ── Meta title (max 12 pts) ──
    if (balisesChecks.hasMetaTitle) {
      balisesScore += 5
      if (balisesChecks.metaTitleLength >= 30 && balisesChecks.metaTitleLength <= 60) balisesScore += 7
      else if (balisesChecks.metaTitleLength >= 20 && balisesChecks.metaTitleLength <= 70) balisesScore += 3
      // Title = juste le nom du site → pas optimise
      if (balisesChecks.metaTitleLength < 15) balisesScore -= 3
    }

    // ── Meta description (max 12 pts) ──
    if (balisesChecks.hasMetaDescription) {
      balisesScore += 5
      if (balisesChecks.metaDescLength >= 120 && balisesChecks.metaDescLength <= 160) balisesScore += 7
      else if (balisesChecks.metaDescLength >= 80 && balisesChecks.metaDescLength <= 200) balisesScore += 3
      // Trop courte = pas optimisee
      if (balisesChecks.metaDescLength < 70) balisesScore -= 3
    }

    // ── Keyword coherence (max 15 pts) — le plus important pour un expert SEO ──
    if (kws.length > 0) {
      if (kwInH1) balisesScore += 6  // mot-cle dans le H1 = critique
      if (kwInTitle) balisesScore += 5  // mot-cle dans le title
      if (kwInDesc) balisesScore += 4  // mot-cle dans la meta description
    } else {
      // Pas de mot-cle fourni → on ne peut pas verifier, points neutres
      balisesScore += 8
    }

    // ── Heading hierarchy quality (max 18 pts) ──
    if (balisesChecks.h2Count >= 4) balisesScore += 7
    else if (balisesChecks.h2Count >= 3) balisesScore += 5
    else if (balisesChecks.h2Count >= 1) balisesScore += 3
    if (balisesChecks.h3Count >= 2 && balisesChecks.h2Count >= 2) balisesScore += 5
    else if (balisesChecks.h3Count >= 1 && balisesChecks.h2Count >= 1) balisesScore += 2

    if (balisesChecks.hierarchyViolations === 0) balisesScore += 4
    else if (balisesChecks.hierarchyViolations <= 1) balisesScore += 2

    if (!balisesChecks.hasDeepHeadingAbuse) balisesScore += 2

    // ── Duplicate headings penalty ──
    if (balisesChecks.duplicateHeadings > 5) balisesScore -= 10
    else if (balisesChecks.duplicateHeadings > 2) balisesScore -= 5
    else if (balisesChecks.duplicateHeadings > 0) balisesScore -= 2

    // ── Canonical (max 5 pts) ──
    if (balisesChecks.hasCanonical) balisesScore += 5

    // ── Open Graph quality (max 13 pts) ──
    if (balisesChecks.hasOgTitle) balisesScore += 4
    if (balisesChecks.hasOgDescription) balisesScore += 3
    if (balisesChecks.hasOgImage) balisesScore += 4
    if (balisesChecks.ogTagCount >= 4) balisesScore += 2

    balisesScore = Math.max(0, Math.min(balisesScore, 100))

    // ── HARD CAPS — un expert SEO est sans pitie ──
    if (!balisesChecks.hasH1 || !balisesChecks.hasMetaTitle || !balisesChecks.hasMetaDescription) {
      balisesScore = Math.min(balisesScore, 30) // manque un essentiel = max 30
    }
    if (!balisesChecks.hasH1 && !balisesChecks.hasMetaTitle) {
      balisesScore = Math.min(balisesScore, 15) // manque les 2 = catastrophe
    }
    if (balisesChecks.h1Count > 1) balisesScore = Math.min(balisesScore, 55)
    if (balisesChecks.hierarchyViolations >= 3) balisesScore = Math.min(balisesScore, 50)
    if (balisesChecks.hierarchyViolations >= 5) balisesScore = Math.min(balisesScore, 35)
    // Mot-cle absent du H1 et du title = pas optimise pour le SEO
    if (kws.length > 0 && !kwInH1 && !kwInTitle) balisesScore = Math.min(balisesScore, 50)
    // Title trop court (juste nom de marque) = pas optimise
    if (balisesChecks.metaTitleLength > 0 && balisesChecks.metaTitleLength < 20) balisesScore = Math.min(balisesScore, 55)

    // ── New balises signals ──
    if (siteAnalysis.h1VsTitleIdentical) {
      balisesScore -= 8
      balisesScore = Math.min(balisesScore, 60)
    }
    if (siteAnalysis.hasFavicon) balisesScore += 3
    if (siteAnalysis.hasTwitterTitle && siteAnalysis.hasTwitterImage) balisesScore += 4
    if (siteAnalysis.hasCharset) balisesScore += 2
    if (siteAnalysis.hasLangAttr) balisesScore += 3
    balisesScore = Math.max(0, Math.min(balisesScore, 100))
    // Hard cap: no lang attribute
    if (!siteAnalysis.hasLangAttr) balisesScore = Math.min(balisesScore, 55)

    // 3. CONTENU — scoring exigeant (vision rédacteur SEO expert)
    let contentScore = 0
    const contentChecks = {
      wordCount: siteAnalysis.wordCount,
      internalLinks: siteAnalysis.internalLinks,
      externalLinks: siteAnalysis.externalLinks,
      h2Count: siteAnalysis.h2Count,
      h3Count: siteAnalysis.h3Count,
      imgAltRatio: siteAnalysis.imgCount > 0 ? siteAnalysis.imgAltCount / siteAnalysis.imgCount : 1,
      hasStructuredData: siteAnalysis.hasStructuredData,
      pagespeedSeo: Math.round((mobile.seo + desktop.seo) / 2),
      paragraphCount: siteAnalysis.paragraphCount,
      avgParagraphLength: siteAnalysis.avgParagraphLength,
      contentRatio: siteAnalysis.contentRatio,
      wordsPerHeading: siteAnalysis.wordsPerHeading,
      listCount: siteAnalysis.listCount,
    }

    // ── QUANTITE DE CONTENU (max 20 pts) — un expert SEO veut du fond ──
    // Pour une page d'accueil, 800+ mots est le minimum pour ranker
    // Combiner wordCount, paragraphCount et avgParagraphLength
    const hasRealContent = contentChecks.paragraphCount >= 6 && contentChecks.avgParagraphLength >= 30
    const hasDecentContent = contentChecks.paragraphCount >= 4 && contentChecks.avgParagraphLength >= 20
    const hasMinimalContent = contentChecks.paragraphCount >= 2 && contentChecks.avgParagraphLength >= 15
    if (hasRealContent && contentChecks.wordCount >= 1200) contentScore += 20
    else if (hasRealContent && contentChecks.wordCount >= 800) contentScore += 16
    else if (hasDecentContent && contentChecks.wordCount >= 600) contentScore += 12
    else if (hasDecentContent && contentChecks.wordCount >= 400) contentScore += 8
    else if (hasMinimalContent && contentChecks.wordCount >= 300) contentScore += 5
    else if (contentChecks.wordCount >= 200) contentScore += 2

    // ── STRUCTURE REDACTIONNELLE (max 18 pts) ──
    // H2 decoupent le contenu, H3 le detaillent — un expert veut une arbo riche
    if (contentChecks.h2Count >= 5) contentScore += 9
    else if (contentChecks.h2Count >= 4) contentScore += 7
    else if (contentChecks.h2Count >= 3) contentScore += 5
    else if (contentChecks.h2Count >= 2) contentScore += 3
    else if (contentChecks.h2Count >= 1) contentScore += 1
    if (contentChecks.h3Count >= 4 && contentChecks.h2Count >= 3) contentScore += 9
    else if (contentChecks.h3Count >= 2 && contentChecks.h2Count >= 2) contentScore += 6
    else if (contentChecks.h3Count >= 1 && contentChecks.h2Count >= 1) contentScore += 3

    // ── RATIO MOTS PAR HEADING (max 7 pts) — equilibre contenu/structure ──
    // Ideal: 100-200 mots par heading, montre un contenu detaille sous chaque titre
    if (contentChecks.wordsPerHeading >= 80 && contentChecks.wordsPerHeading <= 250) contentScore += 7
    else if (contentChecks.wordsPerHeading >= 50 && contentChecks.wordsPerHeading <= 350) contentScore += 4
    else if (contentChecks.wordsPerHeading > 0) contentScore += 1

    // ── ELEMENTS DE STRUCTURATION (max 5 pts) — listes, tableaux ──
    if (contentChecks.listCount >= 4) contentScore += 5
    else if (contentChecks.listCount >= 2) contentScore += 3
    else if (contentChecks.listCount >= 1) contentScore += 1

    // ── MAILLAGE INTERNE (max 10 pts) — critique pour le SEO ──
    if (contentChecks.internalLinks >= 15) contentScore += 10
    else if (contentChecks.internalLinks >= 8) contentScore += 7
    else if (contentChecks.internalLinks >= 5) contentScore += 5
    else if (contentChecks.internalLinks >= 2) contentScore += 3
    else if (contentChecks.internalLinks >= 1) contentScore += 1

    // ── IMAGES + ALT (max 7 pts) ──
    contentScore += Math.round(contentChecks.imgAltRatio * 7)

    // ── DONNEES STRUCTUREES (max 7 pts) ──
    if (contentChecks.hasStructuredData) contentScore += 7

    // ── RATIO CONTENU/CODE (max 8 pts) ──
    if (contentChecks.contentRatio >= 30) contentScore += 8
    else if (contentChecks.contentRatio >= 20) contentScore += 6
    else if (contentChecks.contentRatio >= 12) contentScore += 3
    else if (contentChecks.contentRatio >= 8) contentScore += 1

    // ── LIENS EXTERNES (max 5 pts) ──
    if (contentChecks.externalLinks >= 3) contentScore += 5
    else if (contentChecks.externalLinks >= 1) contentScore += 2

    // ── PAGESPEED SEO (max 8 pts) ──
    contentScore += Math.round(contentChecks.pagespeedSeo * 0.08)

    contentScore = Math.max(0, Math.min(contentScore, 100))

    // ── HARD CAPS — un expert SEO est impitoyable sur le contenu ──
    // Pas de vrais paragraphes = site vide
    if (contentChecks.paragraphCount < 2) contentScore = Math.min(contentScore, 20)
    else if (contentChecks.paragraphCount < 3) contentScore = Math.min(contentScore, 30)
    else if (contentChecks.paragraphCount < 5 && contentChecks.avgParagraphLength < 20) contentScore = Math.min(contentScore, 40)
    // Aucun H2 = pas de structure editoriale
    if (contentChecks.h2Count === 0) contentScore = Math.min(contentScore, 25)
    else if (contentChecks.h2Count === 1) contentScore = Math.min(contentScore, 50)
    // Tres peu de mots = pas de contenu
    if (contentChecks.wordCount < 100) contentScore = Math.min(contentScore, 10)
    else if (contentChecks.wordCount < 200) contentScore = Math.min(contentScore, 25)
    else if (contentChecks.wordCount < 400) contentScore = Math.min(contentScore, 40)
    else if (contentChecks.wordCount < 600) contentScore = Math.min(contentScore, 55)
    // Ratio contenu/code catastrophique = site presque vide
    if (contentChecks.contentRatio < 5) contentScore = Math.min(contentScore, 20)
    else if (contentChecks.contentRatio < 8) contentScore = Math.min(contentScore, 35)
    // Pas de maillage interne = isolation SEO
    if (contentChecks.internalLinks === 0) contentScore = Math.min(contentScore, 40)
    // Paragraphes tres courts = contenu superficiel
    if (contentChecks.avgParagraphLength < 10 && contentChecks.paragraphCount > 0) contentScore = Math.min(contentScore, 35)

    // ── New content signals: keyword density ──
    if (kws_.length > 0 && keywordDensity.length > 0) {
      const primaryDensity = keywordDensity[0]?.density ?? 0
      if (primaryDensity >= 1 && primaryDensity <= 3) contentScore += 7
      else if ((primaryDensity >= 0.5 && primaryDensity < 1) || (primaryDensity > 3 && primaryDensity <= 4)) contentScore += 3
      // else: 0% or >5% → no bonus
      contentScore = Math.max(0, Math.min(contentScore, 100))
      // Hard cap: keyword absent from body
      if (primaryDensity === 0) contentScore = Math.min(contentScore, 45)
    }
    // Multi-page: low total word count across pages = thin site
    if (multiPage.pagesScraped > 1 && multiPage.totalWordCount < 500) {
      contentScore = Math.min(contentScore, contentScore - 5)
      contentScore = Math.max(0, contentScore)
    }

    // 4. RESPONSIVE — scoring expert webdesigner mobile
    // Un site "fonctionnel" sur mobile ≠ un site "pensé" pour le mobile
    // 99/100 = UX mobile exceptionnelle (animations tactiles, navigation adaptée, touch-first)
    // 75-80 = site qui fonctionne sur mobile sans problème
    // < 60 = problèmes responsive visibles
    let responsiveScore = 0
    const responsiveChecks = {
      hasViewport: siteAnalysis.hasViewport,
      mobilePerf: performanceMobile,
      desktopPerf: performanceDesktop,
      mobileRatio: performanceDesktop > 0 ? performanceMobile / performanceDesktop : 0,
      // Mobile UX quality signals
      hasStickyNav: siteAnalysis.hasStickyNav,
      hasScrollAnimations: siteAnalysis.hasScrollAnimations,
      hasCssAnimations: siteAnalysis.hasCssAnimations,
      hasModernLayout: siteAnalysis.hasModernLayout,
      hasLazyLoading: siteAnalysis.hasLazyLoading,
      hasModernImageFormats: siteAnalysis.hasModernImageFormats,
      hasSmoothScroll: siteAnalysis.hasSmoothScroll,
      hasCtaInNav: siteAnalysis.hasCtaInNav,
      ctaCount: siteAnalysis.ctaCount,
    }

    // ── BASE TECHNIQUE (max 40 pts) — le minimum pour que ça fonctionne ──
    if (responsiveChecks.hasViewport) responsiveScore += 10
    // Performance mobile brute
    if (responsiveChecks.mobilePerf >= 80) responsiveScore += 15
    else if (responsiveChecks.mobilePerf >= 60) responsiveScore += 10
    else if (responsiveChecks.mobilePerf >= 40) responsiveScore += 5
    // Ratio mobile/desktop (écart de perf)
    if (responsiveChecks.mobileRatio >= 0.9) responsiveScore += 10
    else if (responsiveChecks.mobileRatio >= 0.75) responsiveScore += 7
    else if (responsiveChecks.mobileRatio >= 0.6) responsiveScore += 4
    else if (responsiveChecks.mobileRatio >= 0.4) responsiveScore += 2
    // Accessibilité mobile (modeste)
    responsiveScore += Math.round(mobile.accessibility * 0.05) // max ~5 pts

    // ── UX MOBILE AVANCÉE (max 35 pts) — ce qui fait la différence ──
    // Navigation sticky sur mobile = navigation toujours accessible
    if (responsiveChecks.hasStickyNav) responsiveScore += 7
    // Animations adaptées au mobile (scroll animations, transitions)
    if (responsiveChecks.hasScrollAnimations) responsiveScore += 6
    else if (responsiveChecks.hasCssAnimations) responsiveScore += 3
    // Modern layout (flexbox/grid = bon responsive)
    if (responsiveChecks.hasModernLayout) responsiveScore += 5
    // Smooth scroll (UX tactile fluide)
    if (responsiveChecks.hasSmoothScroll) responsiveScore += 3
    // CTA accessibles sur mobile (dans la nav ou multiples sur page)
    if (responsiveChecks.hasCtaInNav) responsiveScore += 5
    else if (responsiveChecks.ctaCount >= 2) responsiveScore += 2
    // Images optimisées pour mobile
    if (responsiveChecks.hasLazyLoading) responsiveScore += 5
    if (responsiveChecks.hasModernImageFormats) responsiveScore += 4

    // ── QUALITÉ LIGHTHOUSE MOBILE (max 15 pts) — bonus ──
    // Mobile best practices
    responsiveScore += Math.round(mobile.bestPractices * 0.08) // max ~8 pts
    // Mobile SEO (tap targets, font sizes, etc.)
    responsiveScore += Math.round(mobile.seo * 0.07) // max ~7 pts

    responsiveScore = Math.max(0, Math.min(responsiveScore, 100))

    // ── HARD CAPS — un site basique mobile ne dépasse pas 80 ──
    // Pas de nav sticky → pas pensé mobile-first, cap 75
    if (!responsiveChecks.hasStickyNav) responsiveScore = Math.min(responsiveScore, 75)
    // Pas d'animations → expérience mobile plate, cap 70
    if (!responsiveChecks.hasScrollAnimations && !responsiveChecks.hasCssAnimations) {
      responsiveScore = Math.min(responsiveScore, 70)
    }
    // Pas de lazy loading → pas optimisé mobile, cap 75
    if (!responsiveChecks.hasLazyLoading) responsiveScore = Math.min(responsiveScore, 75)
    // Pas de CTA dans la nav → conversion mobile mauvaise
    if (!responsiveChecks.hasCtaInNav) responsiveScore = Math.min(responsiveScore, 75)
    // Perf mobile mauvaise → hard cap
    if (responsiveChecks.mobilePerf < 40) responsiveScore = Math.min(responsiveScore, 45)
    else if (responsiveChecks.mobilePerf < 60) responsiveScore = Math.min(responsiveScore, 60)

    // 5. CONFIGURATION TECHNIQUE
    let configScore = 0
    const configChecks = {
      isHttps: technical.isHttps,
      hasRedirectToHttps: technical.hasRedirectToHttps,
      hasRobotsTxt: technical.hasRobotsTxt,
      hasSitemap: technical.hasSitemap,
      hasMixedContent: technical.hasMixedContent,
      responseTime: technical.responseTime,
      sitemapUrlCount: technical.sitemapUrlCount,
      sitemapLastMod: technical.sitemapLastMod,
    }
    // HTTPS (30 pts) — fondamental, sans HTTPS le site ne devrait pas exister en 2026
    if (configChecks.isHttps) configScore += 30
    // Redirection HTTP → HTTPS (10 pts)
    if (configChecks.hasRedirectToHttps) configScore += 10
    // robots.txt (15 pts) — indispensable pour le crawl
    if (configChecks.hasRobotsTxt) configScore += 15
    // Sitemap XML (15 pts) — indispensable pour l'indexation
    if (configChecks.hasSitemap) configScore += 15
    // Pas de mixed content (10 pts)
    if (!configChecks.hasMixedContent) configScore += 10
    // Temps de réponse : max 20 pts (< 500ms = 20, > 2000ms = 0 — plus exigeant)
    configScore += Math.round(Math.max(0, Math.min(20, (2000 - configChecks.responseTime) / 2000 * 20)))
    // ── New config signals ──
    if (siteAnalysis.hasCharset) configScore += 3
    if (siteAnalysis.hasLangAttr) configScore += 3
    // Broken links
    if (brokenLinks.length === 0) configScore += 5
    else if (brokenLinks.length <= 2) configScore += 2
    // else 3+: no bonus
    // Sitemap quality
    if (technical.sitemapUrlCount >= 10) configScore += 3
    if (technical.sitemapLastMod) {
      const lastModDate = new Date(technical.sitemapLastMod)
      const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      if (lastModDate > sixMonthsAgo) configScore += 2
    }
    // Backlinks
    if (backlinksData) {
      if (backlinksData.referringDomains >= 50) configScore += 5
      else if (backlinksData.referringDomains >= 20) configScore += 3
      else if (backlinksData.referringDomains >= 5) configScore += 1
    }

    configScore = Math.min(configScore, 100)
    // Hard caps — pénalités lourdes pour manques critiques
    if (!configChecks.isHttps) configScore = Math.min(configScore, 20)
    if (configChecks.hasMixedContent) configScore = Math.min(configScore, 50)
    if (!configChecks.hasRobotsTxt && !configChecks.hasSitemap) configScore = Math.min(configScore, 35)
    else if (!configChecks.hasRobotsTxt) configScore = Math.min(configScore, 55)
    else if (!configChecks.hasSitemap) configScore = Math.min(configScore, 55)
    if (configChecks.responseTime > 3000) configScore = Math.min(configScore, 45)
    // New hard cap: many broken links
    if (brokenLinks.length > 5) configScore = Math.min(configScore, 40)

    // 6. EXPERIENCE UTILISATEUR — scoring très exigeant (vision webdesigner expert)
    // Un webdesigner regarde : modernité du design, animations, CTA, navigation, hero, footer, typographie, etc.
    const accessibilityAvg = Math.round((mobile.accessibility + desktop.accessibility) / 2)
    const bestPracticesAvg = Math.round((mobile.bestPractices + desktop.bestPractices) / 2)
    let uxScore = 0

    // ── 1. DESIGN MODERNITY (max 22 pts) — le plus important pour un webdesigner ──
    // Animations & transitions (un site moderne DOIT avoir des animations)
    let animationPoints = 0
    if (siteAnalysis.hasScrollAnimations) animationPoints += 6  // AOS, GSAP, Framer Motion = pro
    if (siteAnalysis.hasCssAnimations) animationPoints += 3     // @keyframes
    if (siteAnalysis.hasCssTransitions) animationPoints += 2    // transitions CSS
    if (siteAnalysis.hasHoverEffects) animationPoints += 1      // hover states
    uxScore += Math.min(animationPoints, 10)
    // Modern CSS techniques (gradients, glassmorphism, effects)
    if (siteAnalysis.hasGradients) uxScore += 3
    if (siteAnalysis.hasModernEffects) uxScore += 3             // backdrop-blur, clip-path
    if (siteAnalysis.hasCssVariables) uxScore += 2              // design system
    if (siteAnalysis.hasSmoothScroll) uxScore += 1
    // Modern layout
    if (siteAnalysis.hasModernLayout) uxScore += 3

    // ── 2. VISUAL QUALITY (max 15 pts) — typographie, icônes, images, vidéo ──
    if (siteAnalysis.hasCustomFonts) uxScore += 4               // Google Fonts, @font-face = pro
    if (siteAnalysis.hasIconLibrary) uxScore += 3               // icons = design soigné
    if (siteAnalysis.svgCount >= 3) uxScore += 3                // SVGs = qualité vectorielle
    else if (siteAnalysis.svgCount >= 1) uxScore += 1
    if (siteAnalysis.hasVideoContent) uxScore += 3              // vidéo = engagement
    if (siteAnalysis.hasModernImageFormats) uxScore += 2        // WebP/AVIF = optimisé

    // ── 3. NAVIGATION & HEADER (max 14 pts) ──
    if (siteAnalysis.hasNav) uxScore += 3
    if (siteAnalysis.hasStickyNav) uxScore += 3                 // sticky nav = UX pro
    if (siteAnalysis.hasCtaInNav) uxScore += 5                  // CTA dans la nav = conversion
    if (siteAnalysis.hasBreadcrumbs) uxScore += 1
    if (siteAnalysis.hasBackToTop) uxScore += 2

    // ── 4. CTA & CONVERSION (max 13 pts) ──
    if (siteAnalysis.ctaCount >= 5) uxScore += 8
    else if (siteAnalysis.ctaCount >= 3) uxScore += 6
    else if (siteAnalysis.ctaCount >= 2) uxScore += 4
    else if (siteAnalysis.ctaCount >= 1) uxScore += 2
    // 0 CTA = 0 points (problème majeur)
    if (siteAnalysis.formCount >= 2) uxScore += 5
    else if (siteAnalysis.formCount >= 1) uxScore += 3

    // ── 5. PAGE STRUCTURE (max 12 pts) — hero, sections, social proof ──
    if (siteAnalysis.hasHeroSection) uxScore += 4               // hero = première impression
    if (siteAnalysis.visualBlockCount >= 5) uxScore += 4
    else if (siteAnalysis.visualBlockCount >= 3) uxScore += 2
    else if (siteAnalysis.visualBlockCount >= 1) uxScore += 1
    if (siteAnalysis.hasSocialProof) uxScore += 4               // témoignages = confiance

    // ── 6. FOOTER QUALITY (max 7 pts) — un bon footer est organisé ──
    if (siteAnalysis.hasFooter) {
      uxScore += 2
      if (siteAnalysis.footerHasColumns) uxScore += 3           // footer multi-colonnes = organisé
      if (siteAnalysis.footerLinkCount >= 8) uxScore += 2       // footer riche en liens
      else if (siteAnalysis.footerLinkCount >= 4) uxScore += 1
    }

    // ── 7. TECHNICAL UX (max 10 pts) — perf perçue, accessibilité, lazy loading ──
    if (siteAnalysis.hasViewport) uxScore += 2
    const mobileRatio = performanceDesktop > 0 ? performanceMobile / performanceDesktop : 0
    if (mobileRatio >= 0.85) uxScore += 3
    else if (mobileRatio >= 0.7) uxScore += 2
    else if (mobileRatio >= 0.5) uxScore += 1
    if (siteAnalysis.hasLazyLoading) uxScore += 2
    // Accessibilité Lighthouse (bonus modeste — on évalue le design, pas juste le score Lighthouse)
    uxScore += Math.round(accessibilityAvg * 0.03)              // max ~3 pts

    // ── 8. LISIBILITÉ CONTENU (max 7 pts) ──
    if (contentChecks.paragraphCount >= 5 && contentChecks.h2Count >= 2) uxScore += 5
    else if (contentChecks.paragraphCount >= 3 && contentChecks.h2Count >= 1) uxScore += 3
    else if (contentChecks.paragraphCount >= 2) uxScore += 1
    if (contentChecks.listCount >= 2) uxScore += 2

    uxScore = Math.max(0, Math.min(uxScore, 100))

    // ── HARD CAPS — Un webdesigner sévère pénalise lourdement les manques ──
    // Système de défauts cumulatifs : chaque manque abaisse le plafond
    let uxCap = 100
    let defectCount = 0

    // Aucune animation → site statique, pas moderne
    if (!siteAnalysis.hasCssAnimations && !siteAnalysis.hasCssTransitions && !siteAnalysis.hasScrollAnimations) {
      uxCap = Math.min(uxCap, 40); defectCount += 2
    } else if (!siteAnalysis.hasScrollAnimations) {
      // Transitions basiques mais pas de scroll animations pro
      uxCap = Math.min(uxCap, 60); defectCount++
    }
    // Pas de CTA → aucune conversion possible
    if (siteAnalysis.ctaCount === 0) { uxCap = Math.min(uxCap, 38); defectCount += 2 }
    else if (siteAnalysis.ctaCount < 3) { uxCap = Math.min(uxCap, 60); defectCount++ }
    // Pas de CTA dans la navbar → manque majeur
    if (!siteAnalysis.hasCtaInNav) { uxCap = Math.min(uxCap, 55); defectCount++ }
    // Pas de hero section → première impression ratée
    if (!siteAnalysis.hasHeroSection) { uxCap = Math.min(uxCap, 50); defectCount++ }
    // Pas de nav → catastrophique
    if (!siteAnalysis.hasNav) { uxCap = Math.min(uxCap, 40); defectCount += 2 }
    // Pas de fonts custom → design amateur
    if (!siteAnalysis.hasCustomFonts) { uxCap = Math.min(uxCap, 50); defectCount++ }
    // Footer absent ou en désordre
    if (!siteAnalysis.hasFooter) { uxCap = Math.min(uxCap, 45); defectCount++ }
    else if (!siteAnalysis.footerHasColumns && siteAnalysis.footerLinkCount < 4) { uxCap = Math.min(uxCap, 55); defectCount++ }
    // Pas d'effets modernes (gradients, glassmorphism) → design plat
    if (!siteAnalysis.hasGradients && !siteAnalysis.hasModernEffects) { defectCount++ }
    // Pas de preuves sociales
    if (!siteAnalysis.hasSocialProof) { defectCount++ }
    // Pas de vidéo ni SVG → pauvre visuellement
    if (!siteAnalysis.hasVideoContent && siteAnalysis.svgCount < 2) { defectCount++ }
    // Pas de nav sticky → UX basique
    if (!siteAnalysis.hasStickyNav) { defectCount++ }

    // ── Pénalité cumulative : plus il y a de défauts, plus le cap baisse ──
    // 3 défauts → -5, 5 → -10, 7 → -18, 9+ → -25
    if (defectCount >= 9) uxCap = Math.min(uxCap, Math.max(uxCap - 25, 15))
    else if (defectCount >= 7) uxCap = Math.min(uxCap, Math.max(uxCap - 18, 20))
    else if (defectCount >= 5) uxCap = Math.min(uxCap, Math.max(uxCap - 10, 25))
    else if (defectCount >= 3) uxCap = Math.min(uxCap, Math.max(uxCap - 5, 30))

    // Site ultra simple (peu de blocs, pas d'animations, pas de CTA, fond uniforme)
    if (siteAnalysis.visualBlockCount <= 2 && siteAnalysis.ctaCount <= 1 &&
      !siteAnalysis.hasCssAnimations && !siteAnalysis.hasScrollAnimations) {
      uxCap = Math.min(uxCap, 30)
    }

    uxScore = Math.min(uxScore, uxCap)

    // SCORE GLOBAL (pondération Kameo — total 12)
    // Balises x2.5 + Contenu x2.5 + Responsive x1.5 + Performances x1.5 + UX x2.5 + Config x1.5 = 12
    const globalScore = Math.round(
      (balisesScore * 2.5 + contentScore * 2.5 + responsiveScore * 1.5 + performanceScore * 1.5 + uxScore * 2.5 + configScore * 1.5) / 12
    )

    // ── 5. Generate descriptions & improvements with Claude ───────────────────
    const uxChecks = {
      ctaCount: siteAnalysis.ctaCount,
      hasNav: siteAnalysis.hasNav,
      sectionCount: siteAnalysis.sectionCount,
      hasFooter: siteAnalysis.hasFooter,
      formCount: siteAnalysis.formCount,
      mobileRatio: performanceDesktop > 0 ? performanceMobile / performanceDesktop : 0,
      // Design modernity
      hasCssAnimations: siteAnalysis.hasCssAnimations,
      hasCssTransitions: siteAnalysis.hasCssTransitions,
      hasScrollAnimations: siteAnalysis.hasScrollAnimations,
      hasGradients: siteAnalysis.hasGradients,
      hasModernEffects: siteAnalysis.hasModernEffects,
      hasSmoothScroll: siteAnalysis.hasSmoothScroll,
      // Visual quality
      hasCustomFonts: siteAnalysis.hasCustomFonts,
      hasIconLibrary: siteAnalysis.hasIconLibrary,
      svgCount: siteAnalysis.svgCount,
      hasVideoContent: siteAnalysis.hasVideoContent,
      hasModernImageFormats: siteAnalysis.hasModernImageFormats,
      // Page structure
      hasHeroSection: siteAnalysis.hasHeroSection,
      hasSocialProof: siteAnalysis.hasSocialProof,
      hasCtaInNav: siteAnalysis.hasCtaInNav,
      hasStickyNav: siteAnalysis.hasStickyNav,
      footerLinkCount: siteAnalysis.footerLinkCount,
      footerHasColumns: siteAnalysis.footerHasColumns,
      hasBackToTop: siteAnalysis.hasBackToTop,
      hasBreadcrumbs: siteAnalysis.hasBreadcrumbs,
      hasLazyLoading: siteAnalysis.hasLazyLoading,
      hasHoverEffects: siteAnalysis.hasHoverEffects,
      visualBlockCount: siteAnalysis.visualBlockCount,
    }

    const analysisData: AnalysisData = {
      url,
      technology: siteAnalysis.technology,
      keywords: keywords || null,
      performanceMobile,
      performanceDesktop,
      performanceScore,
      balisesScore,
      balisesChecks,
      contentScore,
      contentChecks,
      responsiveScore,
      responsiveChecks,
      configScore,
      configChecks,
      uxScore,
      uxChecks,
      accessibilityAvg,
      bestPracticesAvg,
      globalScore,
      metaTitle: siteAnalysis.metaTitle,
      metaDescription: siteAnalysis.metaDescription,
      // New fields
      coreWebVitals: mobile.coreWebVitals,
      backlinks: backlinksData,
      brokenLinksCount: brokenLinks.length,
      keywordDensity,
      multiPageData: { pagesScraped: multiPage.pagesScraped, totalWordCount: multiPage.totalWordCount },
      hasCharset: siteAnalysis.hasCharset,
      hasLangAttr: siteAnalysis.hasLangAttr,
      langValue: siteAnalysis.langValue,
      hasFavicon: siteAnalysis.hasFavicon,
      hasTwitterCards: siteAnalysis.hasTwitterCards,
      hasTwitterTitle: siteAnalysis.hasTwitterTitle,
      hasTwitterImage: siteAnalysis.hasTwitterImage,
      h1VsTitleIdentical: siteAnalysis.h1VsTitleIdentical,
      sitemapUrlCount: technical.sitemapUrlCount,
      sitemapLastMod: technical.sitemapLastMod,
    }

    const aiAnalysis = await generateAIAnalysis(analysisData)

    // ── 6. Save to DB ─────────────────────────────────────────────────────────
    const audit = await prisma.audit.create({
      data: {
        url,
        projectId: projectId || null,
        createdById: session.user.id,
        performanceMobile,
        performanceDesktop,
        seoScore: balisesScore,
        globalScore,
        technology: siteAnalysis.technology,
        keywords: keywords?.toString() ?? null,
        details: {
          scores: {
            performance: performanceScore,
            balises: balisesScore,
            content: contentScore,
            responsive: responsiveScore,
            config: configScore,
            ux: uxScore,
          },
          logoUrl: siteAnalysis.faviconUrl || `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`,
          balisesChecks,
          contentChecks,
          responsiveChecks,
          configChecks,
          descriptions: aiAnalysis.descriptions,
          cost: aiAnalysis.cost || null,
          costDetails: aiAnalysis.costDetails || null,
          coreWebVitals: mobile.coreWebVitals,
          backlinks: backlinksData,
          brokenLinks,
          multiPageData: {
            pagesScraped: multiPage.pagesScraped,
            totalWordCount: multiPage.totalWordCount,
            pageDetails: multiPage.pageDetails,
          },
          keywordDensity,
        },
        improvements: aiAnalysis.improvements,
      },
      include: { createdBy: true },
    })

    await createLog(session.user.id, 'CRÉÉ', 'Audit SEO', audit.id, url)
    return NextResponse.json(audit)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'audit"
    console.error('[Audit] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── PATCH: update keywords on an audit ──────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, keywords, details } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  if (keywords !== undefined) data.keywords = keywords?.toString() ?? null
  if (details !== undefined) data.details = details

  const audit = await prisma.audit.update({
    where: { id },
    data,
    include: { createdBy: true },
  })

  return NextResponse.json(audit)
}

// ── DELETE: remove an audit ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  await prisma.audit.delete({ where: { id } })
  await createLog(session.user.id, 'SUPPRIMÉ', 'Audit SEO', id)
  return NextResponse.json({ success: true })
}

// ── URL Normalization ────────────────────────────────────────────────────────────

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const h = parsed.hostname.toLowerCase()
    if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h === '::') return true
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
    if (/^169\.254\./.test(h)) return true
    if (/^fc/i.test(h) || /^fd/i.test(h) || /^fe80/i.test(h)) return true
    if (!['http:', 'https:'].includes(parsed.protocol)) return true
    return false
  } catch { return true }
}

async function normalizeUrl(raw: string): Promise<string> {
  const trimmed = raw.trim().replace(/\/+$/, '')

  // Block private/internal URLs
  const testUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  if (isBlockedUrl(testUrl)) throw new Error('URL non autorisée (adresse privée ou locale)')

  // Already has protocol → use as-is
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  // No protocol → try HTTPS first (fast HEAD request), fallback to HTTP
  try {
    const res = await fetch(`https://${trimmed}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
      redirect: 'follow',
    })
    if (res.ok || res.status < 500) return `https://${trimmed}`
  } catch { /* HTTPS failed */ }

  return `http://${trimmed}`
}

// ── PageSpeed Insights ──────────────────────────────────────────────────────────

async function fetchPageSpeed(url: string, strategy: 'mobile' | 'desktop', apiKey?: string) {
  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  const categories = ['performance', 'seo', 'accessibility', 'best-practices'].map(c => `&category=${c}`).join('')
  const queryUrl = `${base}?url=${encodeURIComponent(url)}&strategy=${strategy}${categories}${apiKey ? `&key=${apiKey}` : ''}`
  const res = await fetch(queryUrl, { signal: AbortSignal.timeout(60000) })
  const data = await res.json()

  if (data.error) {
    const msg = data.error.message ?? data.error.status ?? JSON.stringify(data.error)
    throw new Error(`PageSpeed API : ${msg}`)
  }
  if (!data.lighthouseResult) {
    throw new Error("Pas de résultats Lighthouse — vérifiez que l'URL est accessible et publique.")
  }

  const audits = data.lighthouseResult.audits ?? {}
  return {
    performance: Math.round((data.lighthouseResult.categories?.performance?.score ?? 0) * 100),
    seo: Math.round((data.lighthouseResult.categories?.seo?.score ?? 0) * 100),
    accessibility: Math.round((data.lighthouseResult.categories?.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((data.lighthouseResult.categories?.['best-practices']?.score ?? 0) * 100),
    audits,
    coreWebVitals: {
      lcp: audits?.['largest-contentful-paint']?.numericValue ?? null,
      cls: audits?.['cumulative-layout-shift']?.numericValue ?? null,
      inp: audits?.['interaction-to-next-paint']?.numericValue ?? null,
      fcp: audits?.['first-contentful-paint']?.numericValue ?? null,
      tbt: audits?.['total-blocking-time']?.numericValue ?? null,
    },
  }
}

// ── Website HTML Analysis ───────────────────────────────────────────────────────

async function analyzeWebsite(url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoAudit/1.0)' },
    })
    const html = await res.text()
    const parsedUrl = new URL(url)

    const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 2).length

    const linkMatches = html.match(/<a[^>]*href=["']([^"'#]+)["']/gi) || []
    let internalLinks = 0
    let externalLinks = 0
    for (const link of linkMatches) {
      const href = link.match(/href=["']([^"'#]+)["']/i)?.[1] || ''
      if (href.startsWith('/') || href.includes(parsedUrl.hostname)) {
        internalLinks++
      } else if (href.startsWith('http')) {
        externalLinks++
      }
    }

    // ── Heading analysis (deep) ──────────────────────────────────────────────
    const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi
    const allHeadings: { level: number; text: string }[] = []
    let hMatch
    while ((hMatch = headingRegex.exec(html)) !== null) {
      const level = parseInt(hMatch[1][1])
      const text = hMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      allHeadings.push({ level, text })
    }

    const h1s = allHeadings.filter(h => h.level === 1)
    const h2s = allHeadings.filter(h => h.level === 2)
    const h3s = allHeadings.filter(h => h.level === 3)
    const h4s = allHeadings.filter(h => h.level === 4)
    const h5s = allHeadings.filter(h => h.level === 5)
    const h6s = allHeadings.filter(h => h.level === 6)

    // Check hierarchy violations (e.g. H1 → H4 skipping H2/H3)
    let hierarchyViolations = 0
    for (let i = 1; i < allHeadings.length; i++) {
      const prev = allHeadings[i - 1].level
      const curr = allHeadings[i].level
      if (curr > prev + 1) hierarchyViolations++ // skipped level(s)
    }

    // Check duplicate headings
    const headingTexts = allHeadings.map(h => h.text.toLowerCase())
    const duplicateHeadings = headingTexts.length - new Set(headingTexts).size

    // Check if deep headings (H4-H6) are overused vs structural (H2-H3)
    const structuralCount = h2s.length + h3s.length
    const deepCount = h4s.length + h5s.length + h6s.length
    const hasDeepHeadingAbuse = deepCount > structuralCount && deepCount > 3

    // Meta tags
    const metaTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null
    const metaDescription = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim()
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1]?.trim()
      || null

    // OG tag count (not just presence)
    const ogTags = html.match(/<meta[^>]*property=["']og:[^"']*["']/gi) || []
    const hasOgTitle = /<meta[^>]*property=["']og:title["']/i.test(html)
    const hasOgDescription = /<meta[^>]*property=["']og:description["']/i.test(html)
    const hasOgImage = /<meta[^>]*property=["']og:image["']/i.test(html)

    // ── Content quality metrics ───────────────────────────────────────────────
    // Paragraph count & average length
    const paragraphs = (html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [])
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 20)
    const avgParagraphLength = paragraphs.length > 0
      ? Math.round(paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length)
      : 0
    // Content-to-code ratio (text vs HTML)
    const contentRatio = textContent.length > 0 ? Math.round((textContent.length / html.length) * 100) : 0
    // Words per heading (content density indicator)
    const wordsPerHeading = allHeadings.length > 0 ? Math.round(wordCount / allHeadings.length) : wordCount
    // List elements (structured content)
    const listCount = (html.match(/<(ul|ol)[^>]*>/gi) || []).length

    // ── UX quality metrics (détection approfondie vision webdesigner) ─────────
    // CTA buttons detection
    const ctaPatterns = /<(button|a)[^>]*class=["'][^"']*(btn|button|cta)[^"']*["']/gi
    const ctaTextPatterns = /<(button|a)[^>]*>[^<]*(contact|devis|réserv|commander|acheter|essayer|découvrir|commencer|inscri|télécharg|appel|demande|gratuit|offre|tarif)/gi
    const ctaCount = new Set([
      ...(html.match(ctaPatterns) || []),
      ...(html.match(ctaTextPatterns) || []),
    ]).size
    // Navigation detection
    const hasNav = /<nav[\s>]/i.test(html)
    // Section/main structure
    const sectionCount = (html.match(/<(section|main)[^>]*>/gi) || []).length
    // Footer detection
    const hasFooter = /<footer[\s>]/i.test(html)
    // Form presence (contact, newsletter, etc.)
    const formCount = (html.match(/<form[^>]*>/gi) || []).length

    // ── Design modernity signals ──────────────────────────────────────────────
    // Extract all inline + embedded CSS for analysis
    const styleTags = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []
    const inlineStyles = html.match(/style=["'][^"']*["']/gi) || []
    const allCss = styleTags.join(' ') + ' ' + inlineStyles.join(' ')
    const classAttr = html.match(/class=["'][^"']*["']/gi) || []
    const allClasses = classAttr.join(' ').toLowerCase()

    // CSS Animations & transitions
    const hasCssAnimations = /@keyframes/i.test(allCss) || /animation\s*:/i.test(allCss)
    const hasCssTransitions = /transition\s*:/i.test(allCss) || /transition-/i.test(allCss)
    // Scroll animation libraries (AOS, GSAP, Framer Motion, ScrollReveal, WOW.js, Lenis, Locomotive)
    const hasScrollAnimations = /data-aos/i.test(html) || /gsap|scrolltrigger/i.test(html) ||
      /framer-motion|data-framer/i.test(html) || /scrollreveal|wow\.js|wowjs/i.test(html) ||
      /data-scroll|locomotive/i.test(html) || /lenis/i.test(html) || /data-sal/i.test(html) ||
      /intersection-observer.*animate|animate.*intersection/i.test(html)
    // Modern CSS techniques
    const hasModernLayout = /display\s*:\s*(flex|grid)/i.test(allCss) || /flexbox|grid-template/i.test(allCss) ||
      allClasses.includes('flex') || allClasses.includes('grid')
    const hasCssVariables = /--[\w-]+\s*:/i.test(allCss) || /var\(--/i.test(allCss)
    const hasGradients = /linear-gradient|radial-gradient|conic-gradient/i.test(allCss) || /from-|to-|via-/i.test(allClasses)
    // Backdrop blur, glassmorphism, modern effects
    const hasModernEffects = /backdrop-filter|blur\(/i.test(allCss) || /clip-path/i.test(allCss) ||
      /mix-blend-mode/i.test(allCss) || allClasses.includes('backdrop-blur') || allClasses.includes('glass')

    // ── Visual quality signals ────────────────────────────────────────────────
    // Custom fonts (Google Fonts, Adobe Fonts, @font-face)
    const hasCustomFonts = /fonts\.googleapis\.com/i.test(html) || /use\.typekit\.net/i.test(html) ||
      /@font-face/i.test(allCss) || /fonts\.bunny\.net/i.test(html)
    // Icon libraries (FontAwesome, Material Icons, Phosphor, Lucide, Heroicons, etc.)
    const hasIconLibrary = /font-?awesome|fa-[a-z]/i.test(html) || /material-icons|material-symbols/i.test(html) ||
      /phosphor|lucide|heroicon|feather|tabler-icon/i.test(html) || /icon-[\w]+/i.test(allClasses)
    // SVG usage (inline SVGs = modern, quality graphics)
    const svgCount = (html.match(/<svg[\s>]/gi) || []).length
    // Video content (embedded or HTML5)
    const hasVideoContent = /<video[\s>]/i.test(html) || /youtube\.com\/embed|player\.vimeo|wistia/i.test(html) ||
      /lottie|lottie-player/i.test(html)
    // High quality images (webp, avif = modern formats)
    const hasModernImageFormats = /\.webp|\.avif/i.test(html) || /image\/webp|image\/avif/i.test(html)

    // ── Page structure signals ────────────────────────────────────────────────
    // Hero section detection (first fold, banner)
    const hasHeroSection = /class=["'][^"']*(hero|banner|jumbotron|masthead|splash|landing-header|home-header|intro-section)[^"']*["']/i.test(html) ||
      /id=["'](hero|banner|intro|splash|masthead)["']/i.test(html) ||
      // Detect large background images in first section
      (sectionCount >= 1 && (/<(section|div)[^>]*class=["'][^"']*(h-screen|min-h-screen|vh-100|full-height)[^"']*["']/i.test(html)))
    // Social proof (testimonials, reviews, trust elements)
    const hasSocialProof = /class=["'][^"']*(testimonial|review|avis|témoignage|trust|rating|stars)[^"']*["']/i.test(html) ||
      /testimonial|témoignage/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))
    // CTA in navbar (very important for conversion)
    const navMatch = html.match(/<nav[\s\S]*?<\/nav>/gi) || []
    const navContent = navMatch.join(' ')
    const hasCtaInNav = /<(button|a)[^>]*class=["'][^"']*(btn|button|cta)[^"']*["']/i.test(navContent) ||
      /<(button|a)[^>]*>[^<]*(contact|devis|réserv|commencer|essayer|gratuit|appel|rdv)/gi.test(navContent)
    // Sticky/fixed navigation
    const hasStickyNav = /class=["'][^"']*(sticky|fixed)[^"']*["']/i.test(navContent) || /position\s*:\s*(sticky|fixed)/i.test(navContent) ||
      allClasses.includes('sticky') && /<nav/i.test(html)
    // Footer quality (multi-column, organized)
    const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/gi) || []
    const footerContent = footerMatch.join(' ')
    const footerLinkCount = (footerContent.match(/<a[\s]/gi) || []).length
    const footerHasColumns = /class=["'][^"']*(col-|grid|flex|columns|footer-col|footer-menu|footer-widget)[^"']*["']/i.test(footerContent) ||
      (footerContent.match(/<(div|ul|section)[^>]*>/gi) || []).length >= 3
    // Back to top button
    const hasBackToTop = /class=["'][^"']*(back-to-top|scroll-top|to-top|gotop)[^"']*["']/i.test(html) ||
      /id=["'](back-to-top|scroll-top|toTop)["']/i.test(html)
    // Breadcrumbs
    const hasBreadcrumbs = /class=["'][^"']*(breadcrumb)[^"']*["']/i.test(html) || /aria-label=["']breadcrumb/i.test(html)
    // Lazy loading
    const hasLazyLoading = /loading=["']lazy["']/i.test(html) || /data-src/i.test(html) || /lazyload/i.test(allClasses)
    // Smooth scroll
    const hasSmoothScroll = /scroll-behavior\s*:\s*smooth/i.test(allCss) || /smooth-scroll/i.test(allClasses)
    // Hover effects detected in CSS
    const hasHoverEffects = /:hover/i.test(allCss)
    // Count distinct visual sections (not just <section> but visual blocks)
    const visualBlockCount = Math.max(sectionCount,
      (html.match(/<(section|article|aside)[^>]*>/gi) || []).length)

    return {
      technology: detectTechnology(html),
      hasH1: h1s.length > 0,
      h1Count: h1s.length,
      h1Text: h1s[0]?.text || null,
      metaTitle,
      metaDescription,
      hasCanonical: /<link[^>]*rel=["']canonical["']/i.test(html),
      hasViewport: /<meta[^>]*name=["']viewport["']/i.test(html),
      hasOpenGraph: ogTags.length > 0,
      ogTagCount: ogTags.length,
      hasOgTitle,
      hasOgDescription,
      hasOgImage,
      imgCount: (html.match(/<img[\s]/gi) || []).length,
      imgAltCount: (html.match(/<img[^>]*alt=["'][^"']+["']/gi) || []).length,
      wordCount,
      internalLinks,
      externalLinks,
      h2Count: h2s.length,
      h3Count: h3s.length,
      h4Count: h4s.length,
      h5Count: h5s.length,
      h6Count: h6s.length,
      totalHeadings: allHeadings.length,
      hierarchyViolations,
      duplicateHeadings,
      hasDeepHeadingAbuse,
      headingStructure: allHeadings.slice(0, 30).map(h => `H${h.level}: ${h.text.slice(0, 60)}`),
      hasStructuredData: /application\/ld\+json/i.test(html),
      // Content quality
      paragraphCount: paragraphs.length,
      avgParagraphLength,
      contentRatio,
      wordsPerHeading,
      listCount,
      // UX quality
      ctaCount,
      hasNav,
      sectionCount,
      hasFooter,
      formCount,
      // Design modernity
      hasCssAnimations,
      hasCssTransitions,
      hasScrollAnimations,
      hasModernLayout,
      hasCssVariables,
      hasGradients,
      hasModernEffects,
      // Visual quality
      hasCustomFonts,
      hasIconLibrary,
      svgCount,
      hasVideoContent,
      hasModernImageFormats,
      // Page structure
      hasHeroSection,
      hasSocialProof,
      hasCtaInNav,
      hasStickyNav,
      footerLinkCount,
      footerHasColumns,
      hasBackToTop,
      hasBreadcrumbs,
      hasLazyLoading,
      hasSmoothScroll,
      hasHoverEffects,
      visualBlockCount,
      // Charset & lang
      hasCharset: /<meta[^>]*charset=/i.test(html),
      hasLangAttr: /<html[^>]*lang=/i.test(html),
      langValue: html.match(/<html[^>]*lang=["']?([^"'\s>]+)/i)?.[1] || null,
      // Favicon
      hasFavicon: /<link[^>]*rel=["'](icon|shortcut icon|apple-touch-icon)["']/i.test(html),
      faviconUrl: (() => {
        const m = html.match(/<link[^>]*rel=["'](icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/i)
          || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](icon|shortcut icon|apple-touch-icon)["']/i)
        const href = m?.[2] || m?.[1] || null
        if (!href) return null
        if (href.startsWith('http')) return href
        if (href.startsWith('//')) return 'https:' + href
        try { return new URL(href, parsedUrl.origin).href } catch { return null }
      })(),
      // Twitter Cards
      hasTwitterCards: /<meta[^>]*name=["']twitter:/i.test(html),
      hasTwitterTitle: /<meta[^>]*name=["']twitter:title["']/i.test(html),
      hasTwitterImage: /<meta[^>]*name=["']twitter:image["']/i.test(html),
      // H1 vs title identical
      h1VsTitleIdentical: (h1s[0]?.text || '').toLowerCase().trim() === (metaTitle || '').toLowerCase().trim() && !!metaTitle,
    }
  } catch {
    return {
      technology: 'Non détecté', hasH1: false, h1Count: 0, h1Text: null,
      metaTitle: null, metaDescription: null,
      hasCanonical: false, hasViewport: false, hasOpenGraph: false,
      ogTagCount: 0, hasOgTitle: false, hasOgDescription: false, hasOgImage: false,
      imgCount: 0, imgAltCount: 0, wordCount: 0, internalLinks: 0, externalLinks: 0,
      h2Count: 0, h3Count: 0, h4Count: 0, h5Count: 0, h6Count: 0,
      totalHeadings: 0, hierarchyViolations: 0, duplicateHeadings: 0,
      hasDeepHeadingAbuse: false, headingStructure: [],
      hasStructuredData: false,
      paragraphCount: 0, avgParagraphLength: 0, contentRatio: 0, wordsPerHeading: 0, listCount: 0,
      ctaCount: 0, hasNav: false, sectionCount: 0, hasFooter: false, formCount: 0,
      hasCssAnimations: false, hasCssTransitions: false, hasScrollAnimations: false,
      hasModernLayout: false, hasCssVariables: false, hasGradients: false, hasModernEffects: false,
      hasCustomFonts: false, hasIconLibrary: false, svgCount: 0, hasVideoContent: false, hasModernImageFormats: false,
      hasHeroSection: false, hasSocialProof: false, hasCtaInNav: false, hasStickyNav: false,
      footerLinkCount: 0, footerHasColumns: false, hasBackToTop: false, hasBreadcrumbs: false,
      hasLazyLoading: false, hasSmoothScroll: false, hasHoverEffects: false, visualBlockCount: 0,
      hasCharset: false, hasLangAttr: false, langValue: null, hasFavicon: false, faviconUrl: null,
      hasTwitterCards: false, hasTwitterTitle: false, hasTwitterImage: false, h1VsTitleIdentical: false,
    }
  }
}

// ── Multi-page scraping ─────────────────────────────────────────────────────

async function discoverAndScrapePages(url: string): Promise<{
  pagesScraped: number
  totalWordCount: number
  pageDetails: { url: string; wordCount: number; hasH1: boolean; metaTitle: string | null }[]
  allInternalLinks: string[]
}> {
  const fallback = { pagesScraped: 0, totalWordCount: 0, pageDetails: [], allInternalLinks: [] }
  try {
    const parsedUrl = new URL(url)
    const origin = parsedUrl.origin

    // Fetch homepage HTML
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoAudit/1.0)' },
    })
    const html = await res.text()

    // Extract all same-domain links
    const linkRegex = /<a[^>]*href=["']([^"'#]+)["']/gi
    const allLinks: string[] = []
    let lm
    while ((lm = linkRegex.exec(html)) !== null) {
      let href = lm[1]
      if (href.startsWith('/')) href = origin + href
      try {
        const linkUrl = new URL(href)
        if (linkUrl.hostname === parsedUrl.hostname && linkUrl.pathname !== parsedUrl.pathname) {
          if (!allLinks.includes(linkUrl.href)) allLinks.push(linkUrl.href)
        }
      } catch { /* skip invalid URLs */ }
    }

    // Priority paths
    const priorityPaths = ['/services', '/about', '/a-propos', '/contact', '/blog', '/nos-services',
      '/qui-sommes-nous', '/tarifs', '/portfolio', '/realisations', '/agence', '/equipe', '/prestations']

    const sorted = allLinks.sort((a, b) => {
      const aPath = new URL(a).pathname.toLowerCase()
      const bPath = new URL(b).pathname.toLowerCase()
      const aPriority = priorityPaths.some(p => aPath.startsWith(p))
      const bPriority = priorityPaths.some(p => bPath.startsWith(p))
      if (aPriority && !bPriority) return -1
      if (!aPriority && bPriority) return 1
      return 0
    })

    const toScrape = sorted.slice(0, 4)
    const results = await Promise.allSettled(
      toScrape.map(async (link) => {
        const r = await fetch(link, {
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoAudit/1.0)' },
        })
        const h = await r.text()
        const textContent = h.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 2).length
        const hasH1 = /<h1[\s>]/i.test(h)
        const metaTitle = h.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null
        return { url: link, wordCount, hasH1, metaTitle }
      })
    )

    const pageDetails = results
      .filter((r): r is PromiseFulfilledResult<{ url: string; wordCount: number; hasH1: boolean; metaTitle: string | null }> => r.status === 'fulfilled')
      .map(r => r.value)

    const totalWordCount = pageDetails.reduce((sum, p) => sum + p.wordCount, 0)

    return {
      pagesScraped: pageDetails.length,
      totalWordCount,
      pageDetails,
      allInternalLinks: allLinks,
    }
  } catch {
    return fallback
  }
}

// ── Keyword density ─────────────────────────────────────────────────────────

function calculateKeywordDensity(text: string, keywords: string[]): { keyword: string; count: number; density: number }[] {
  if (!text || keywords.length === 0) return []
  const lowerText = text.toLowerCase()
  const totalWords = lowerText.split(/\s+/).filter(w => w.length > 1).length
  if (totalWords === 0) return keywords.map(kw => ({ keyword: kw, count: 0, density: 0 }))

  return keywords.map(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    const matches = lowerText.match(regex)
    const count = matches ? matches.length : 0
    const density = Math.round((count / totalWords) * 10000) / 100
    return { keyword: kw, count, density }
  })
}

// ── Broken links check ──────────────────────────────────────────────────────

async function checkBrokenLinks(links: string[]): Promise<{ url: string; status: number }[]> {
  if (links.length === 0) return []
  const toCheck = links.slice(0, 15)
  const results = await Promise.allSettled(
    toCheck.map(async (link) => {
      const res = await fetch(link, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoAudit/1.0)' },
      })
      return { url: link, status: res.status }
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<{ url: string; status: number }> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(r => r.status >= 400)
}

// ── Backlinks fetch (DataForSEO) ────────────────────────────────────────────

function dfHeaders(): Record<string, string> | null {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  return { 'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`, 'Content-Type': 'application/json' }
}

async function fetchBacklinks(domain: string): Promise<{ backlinks: number; referringDomains: number; rank: number } | null> {
  const headers = dfHeaders()
  if (!headers) return null
  try {
    const res = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ target: domain, internal_list_limit: 0, backlinks_filters: ['dofollow', '=', 'true'] }]),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    const r = data?.tasks?.[0]?.result?.[0]
    if (!r) return null
    return {
      backlinks: (r.backlinks as number) || 0,
      referringDomains: (r.referring_domains as number) || 0,
      rank: (r.rank as number) || 0,
    }
  } catch {
    return null
  }
}

function detectTechnology(html: string): string {
  if (/wp-content|wp-includes/i.test(html)) {
    const plugins: string[] = []
    if (/elementor/i.test(html)) plugins.push('Elementor')
    if (/yoast/i.test(html)) plugins.push('Yoast')
    if (/woocommerce/i.test(html)) plugins.push('WooCommerce')
    if (/divi/i.test(html)) plugins.push('Divi')
    if (/wpbakery|js_composer/i.test(html)) plugins.push('WPBakery')
    return plugins.length > 0 ? `WordPress + ${plugins.join(', ')}` : 'WordPress'
  }
  if (/framer\.com|framerusercontent/i.test(html)) return 'Framer'
  if (/webflow/i.test(html)) return 'Webflow'
  if (/cdn\.shopify\.com/i.test(html)) return 'Shopify'
  if (/squarespace/i.test(html)) return 'Squarespace'
  if (/wix\.com|parastorage/i.test(html)) return 'Wix'
  if (/__next|_next\/static/i.test(html)) return 'Next.js'
  if (/__nuxt|nuxt/i.test(html)) return 'Nuxt.js'
  if (/gatsby/i.test(html)) return 'Gatsby'
  if (/drupal/i.test(html)) return 'Drupal'
  if (/joomla/i.test(html)) return 'Joomla'
  if (/prestashop/i.test(html)) return 'PrestaShop'
  if (/ghost/i.test(html)) return 'Ghost'
  return 'Site custom / non détecté'
}

// ── Technical Checks ────────────────────────────────────────────────────────────

async function checkTechnical(url: string) {
  const parsedUrl = new URL(url)
  const baseUrl = parsedUrl.origin
  const isHttps = parsedUrl.protocol === 'https:'

  let hasRobotsTxt = false
  try {
    const res = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(5000) })
    const text = await res.text()
    hasRobotsTxt = res.ok && text.length > 10 && /user-agent/i.test(text)
  } catch { /* ignore */ }

  let hasSitemap = false
  let sitemapUrlCount = 0
  let sitemapLastMod: string | null = null
  try {
    const res = await fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(5000) })
    const text = await res.text()
    hasSitemap = res.ok && (text.includes('<urlset') || text.includes('<sitemapindex'))
    if (hasSitemap) {
      const urlMatches = text.match(/<url>/gi)
      sitemapUrlCount = urlMatches ? urlMatches.length : 0
      const lastmodMatches = text.match(/<lastmod>([^<]+)<\/lastmod>/gi)
      if (lastmodMatches && lastmodMatches.length > 0) {
        const dates = lastmodMatches.map(m => m.replace(/<\/?lastmod>/gi, '').trim()).sort().reverse()
        sitemapLastMod = dates[0] || null
      }
    }
  } catch { /* ignore */ }

  let hasMixedContent = false
  let responseTime = 3000
  try {
    const start = Date.now()
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoAudit/1.0)' },
    })
    responseTime = Date.now() - start
    const html = await res.text()
    if (isHttps) {
      hasMixedContent = /http:\/\/[^"']*\.(js|css|jpg|png|gif|svg|woff)/i.test(html)
    }
  } catch { /* ignore */ }

  let hasRedirectToHttps = false
  if (isHttps) {
    try {
      const httpUrl = url.replace('https://', 'http://')
      const res = await fetch(httpUrl, { signal: AbortSignal.timeout(5000), redirect: 'manual' })
      hasRedirectToHttps = (res.status === 301 || res.status === 302) &&
        (res.headers.get('location')?.startsWith('https') ?? false)
    } catch { /* ignore */ }
  }

  return { isHttps, hasRobotsTxt, hasSitemap, hasMixedContent, responseTime, hasRedirectToHttps, sitemapUrlCount, sitemapLastMod }
}

// ── AI Analysis (Claude) ────────────────────────────────────────────────────────

interface AnalysisData {
  url: string
  technology: string
  keywords: string | null
  performanceMobile: number
  performanceDesktop: number
  performanceScore: number
  balisesScore: number
  balisesChecks: {
    hasH1: boolean; h1Count: number; h1Text: string | null
    hasMetaTitle: boolean; hasMetaDescription: boolean; metaTitleLength: number; metaDescLength: number
    hasCanonical: boolean; hasOpenGraph: boolean; ogTagCount: number; hasOgTitle: boolean; hasOgDescription: boolean; hasOgImage: boolean
    h2Count: number; h3Count: number; h4Count: number; h5Count: number; h6Count: number
    totalHeadings: number; hierarchyViolations: number; duplicateHeadings: number; hasDeepHeadingAbuse: boolean
    headingStructure: string[]
    kwInH1: boolean; kwInTitle: boolean; kwInDesc: boolean
  }
  contentScore: number
  contentChecks: {
    wordCount: number; internalLinks: number; externalLinks: number; h2Count: number; h3Count: number
    imgAltRatio: number; hasStructuredData: boolean; pagespeedSeo: number
    paragraphCount: number; avgParagraphLength: number; contentRatio: number; wordsPerHeading: number; listCount: number
  }
  responsiveScore: number
  responsiveChecks: {
    hasViewport: boolean; mobilePerf: number; desktopPerf: number; mobileRatio: number
    hasStickyNav: boolean; hasScrollAnimations: boolean; hasCssAnimations: boolean; hasModernLayout: boolean
    hasLazyLoading: boolean; hasModernImageFormats: boolean; hasSmoothScroll: boolean; hasCtaInNav: boolean; ctaCount: number
  }
  configScore: number
  configChecks: { isHttps: boolean; hasRedirectToHttps: boolean; hasRobotsTxt: boolean; hasSitemap: boolean; hasMixedContent: boolean; responseTime: number; sitemapUrlCount: number; sitemapLastMod: string | null }
  uxScore: number
  uxChecks: {
    ctaCount: number; hasNav: boolean; sectionCount: number; hasFooter: boolean; formCount: number; mobileRatio: number
    hasCssAnimations: boolean; hasCssTransitions: boolean; hasScrollAnimations: boolean; hasGradients: boolean
    hasModernEffects: boolean; hasSmoothScroll: boolean; hasCustomFonts: boolean; hasIconLibrary: boolean
    svgCount: number; hasVideoContent: boolean; hasModernImageFormats: boolean; hasHeroSection: boolean
    hasSocialProof: boolean; hasCtaInNav: boolean; hasStickyNav: boolean; footerLinkCount: number
    footerHasColumns: boolean; hasBackToTop: boolean; hasBreadcrumbs: boolean; hasLazyLoading: boolean
    hasHoverEffects: boolean; visualBlockCount: number
  }
  accessibilityAvg: number
  bestPracticesAvg: number
  globalScore: number
  metaTitle: string | null
  metaDescription: string | null
  // New fields
  coreWebVitals: { lcp: number | null; cls: number | null; inp: number | null; fcp: number | null; tbt: number | null }
  backlinks: { backlinks: number; referringDomains: number; rank: number } | null
  brokenLinksCount: number
  keywordDensity: { keyword: string; count: number; density: number }[]
  multiPageData: { pagesScraped: number; totalWordCount: number }
  hasCharset: boolean
  hasLangAttr: boolean
  langValue: string | null
  hasFavicon: boolean
  hasTwitterCards: boolean
  hasTwitterTitle: boolean
  hasTwitterImage: boolean
  h1VsTitleIdentical: boolean
  sitemapUrlCount: number
  sitemapLastMod: string | null
}

async function generateAIAnalysis(data: AnalysisData) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateFallbackAnalysis(data)
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `Tu es un expert SEO de l'agence web Kameo. Analyse ces données d'audit pour ${data.url} et génère un rapport structuré.

DONNÉES COLLECTÉES :
- Technologie : ${data.technology}
- Mots-clés positionnés : ${(data.keywords ?? 'Non renseigné').replace(/[\r\n]/g, ' ').slice(0, 200)}

1. PERFORMANCES (${data.performanceScore}/100) :
- Mobile : ${data.performanceMobile}/100
- Desktop : ${data.performanceDesktop}/100

2. BALISES (${data.balisesScore}/100) :
- H1 : ${data.balisesChecks.h1Count === 0 ? 'ABSENTE' : data.balisesChecks.h1Count === 1 ? `Unique ✓ "${data.balisesChecks.h1Text}"` : `${data.balisesChecks.h1Count} H1 (PROBLÈME: doit être unique)`}
- Meta title : ${data.metaTitle ? `"${data.metaTitle}" (${data.balisesChecks.metaTitleLength} car.)` : 'ABSENTE'}
- Meta description : ${data.metaDescription ? `"${data.metaDescription}" (${data.balisesChecks.metaDescLength} car.)` : 'ABSENTE'}
- Canonical : ${data.balisesChecks.hasCanonical ? 'Oui' : 'Non'}
- Open Graph : ${data.balisesChecks.hasOpenGraph ? `${data.balisesChecks.ogTagCount} tags (title:${data.balisesChecks.hasOgTitle ? '✓' : '✗'} desc:${data.balisesChecks.hasOgDescription ? '✓' : '✗'} image:${data.balisesChecks.hasOgImage ? '✓' : '✗'})` : 'ABSENT'}
- Hiérarchie headings : ${data.balisesChecks.totalHeadings} balises (H2:${data.balisesChecks.h2Count} H3:${data.balisesChecks.h3Count} H4:${data.balisesChecks.h4Count} H5:${data.balisesChecks.h5Count} H6:${data.balisesChecks.h6Count})
- Violations hiérarchie : ${data.balisesChecks.hierarchyViolations} sauts de niveaux${data.balisesChecks.hierarchyViolations > 0 ? ' (PROBLÈME)' : ' ✓'}
- Doublons headings : ${data.balisesChecks.duplicateHeadings}${data.balisesChecks.duplicateHeadings > 2 ? ' (PROBLÈME)' : ''}
- Abus H4-H6 : ${data.balisesChecks.hasDeepHeadingAbuse ? 'OUI — H4-H6 surreprésentés vs H2-H3' : 'Non'}
- Structure headings : ${data.balisesChecks.headingStructure.slice(0, 15).join(' | ')}
- COHERENCE MOT-CLE / CIBLE :
  - Mots-clés ciblés : ${(data.keywords ?? 'Non renseignés').replace(/[\r\n]/g, ' ').slice(0, 200)}
  - Mot-clé dans H1 : ${data.balisesChecks.kwInH1 ? 'Oui ✓' : 'NON — le H1 ne contient pas le mot-clé ciblé'}
  - Mot-clé dans Title : ${data.balisesChecks.kwInTitle ? 'Oui ✓' : 'NON — le title ne contient pas le mot-clé ciblé'}
  - Mot-clé dans Meta Desc : ${data.balisesChecks.kwInDesc ? 'Oui ✓' : 'NON — la meta description ne contient pas le mot-clé ciblé'}

3. CONTENU (${data.contentScore}/100) — ANALYSE EXPERT SEO EXIGEANTE :
- Nombre de mots : ${data.contentChecks.wordCount}${data.contentChecks.wordCount < 600 ? ' (INSUFFISANT — un expert SEO attend min 800-1200 mots sur une page d\'accueil)' : data.contentChecks.wordCount < 800 ? ' (FAIBLE — manque de profondeur)' : ''}
- Paragraphes structurés : ${data.contentChecks.paragraphCount}${data.contentChecks.paragraphCount < 5 ? ' (INSUFFISANT — contenu superficiel)' : ''}
- Longueur moyenne paragraphes : ${data.contentChecks.avgParagraphLength} mots${data.contentChecks.avgParagraphLength < 20 ? ' (TROP COURT — paragraphes pas développés)' : ''}
- Mots par heading : ${data.contentChecks.wordsPerHeading}${data.contentChecks.wordsPerHeading < 50 ? ' (contenu trop fragmenté)' : data.contentChecks.wordsPerHeading > 300 ? ' (pavés de texte sans sous-titres)' : ' ✓'}
- Ratio contenu/code : ${data.contentChecks.contentRatio}%${data.contentChecks.contentRatio < 10 ? ' (TRÈS FAIBLE — le site est presque vide de contenu texte)' : data.contentChecks.contentRatio < 15 ? ' (FAIBLE)' : ''}
- Balises H2 : ${data.contentChecks.h2Count}${data.contentChecks.h2Count < 3 ? ' (STRUCTURE INSUFFISANTE — un expert attend 4-6 H2 minimum)' : ''}
- Balises H3 : ${data.contentChecks.h3Count}${data.contentChecks.h3Count < 2 ? ' (PAS DE SOUS-STRUCTURE)' : ''}
- Listes (ul/ol) : ${data.contentChecks.listCount}${data.contentChecks.listCount === 0 ? ' (aucune liste — contenu monotone)' : ''}
- Liens internes : ${data.contentChecks.internalLinks}${data.contentChecks.internalLinks < 3 ? ' (MAILLAGE INEXISTANT)' : data.contentChecks.internalLinks < 8 ? ' (MAILLAGE FAIBLE)' : ''}
- Liens externes : ${data.contentChecks.externalLinks}
- Ratio alt images : ${Math.round(data.contentChecks.imgAltRatio * 100)}%${data.contentChecks.imgAltRatio < 0.5 ? ' (PLUS DE LA MOITIÉ DES IMAGES SANS ALT)' : ''}
- Données structurées : ${data.contentChecks.hasStructuredData ? 'Oui' : 'NON — aucune donnée structurée (Schema.org absent)'}

4. RESPONSIVE (${data.responsiveScore}/100) — ANALYSE MOBILE EXPERT :
- Viewport : ${data.responsiveChecks.hasViewport ? 'Oui' : 'Non'}
- Perf. mobile : ${data.responsiveChecks.mobilePerf}/100
- Ratio mobile/desktop : ${Math.round(data.responsiveChecks.mobileRatio * 100)}%
- Navigation sticky mobile : ${data.responsiveChecks.hasStickyNav ? 'Oui' : 'NON — navigation pas fixe'}
- Animations mobiles : ${data.responsiveChecks.hasScrollAnimations ? 'Scroll animations ✓' : data.responsiveChecks.hasCssAnimations ? 'Transitions basiques' : 'AUCUNE — UX mobile plate'}
- Layout moderne (flex/grid) : ${data.responsiveChecks.hasModernLayout ? 'Oui' : 'Non'}
- Lazy loading : ${data.responsiveChecks.hasLazyLoading ? 'Oui' : 'Non'}
- Formats images modernes : ${data.responsiveChecks.hasModernImageFormats ? 'Oui (WebP/AVIF)' : 'Non'}
- Smooth scroll : ${data.responsiveChecks.hasSmoothScroll ? 'Oui' : 'Non'}
- CTA accessible mobile : ${data.responsiveChecks.hasCtaInNav ? 'Oui (dans la nav)' : data.responsiveChecks.ctaCount >= 2 ? 'Oui (sur la page)' : 'NON'}

5. CONFIGURATION TECHNIQUE (${data.configScore}/100) :
- HTTPS : ${data.configChecks.isHttps ? 'Oui' : 'NON'}
- Redirection HTTP→HTTPS : ${data.configChecks.hasRedirectToHttps ? 'Oui' : 'Non'}
- robots.txt : ${data.configChecks.hasRobotsTxt ? 'Oui' : 'Non'}
- sitemap.xml : ${data.configChecks.hasSitemap ? 'Oui' : 'Non'}${data.configChecks.sitemapUrlCount > 0 ? ` (${data.configChecks.sitemapUrlCount} URLs)` : ''}
- Sitemap dernière mise à jour : ${data.sitemapLastMod || 'N/A'}
- Contenu mixte : ${data.configChecks.hasMixedContent ? 'OUI (problème)' : 'Non'}
- Temps de réponse : ${data.configChecks.responseTime}ms
- Charset déclaré : ${data.hasCharset ? 'Oui' : 'NON'}
- Attribut lang : ${data.hasLangAttr ? `Oui (${data.langValue})` : 'NON'}
- Favicon : ${data.hasFavicon ? 'Oui' : 'Non'}
- Twitter Cards : ${data.hasTwitterCards ? `Oui (title:${data.hasTwitterTitle ? '✓' : '✗'} image:${data.hasTwitterImage ? '✓' : '✗'})` : 'Non'}
- Liens cassés : ${data.brokenLinksCount}${data.brokenLinksCount > 0 ? ' (PROBLÈME)' : ' ✓'}
- Backlinks dofollow : ${data.backlinks ? data.backlinks.backlinks : 'N/A'}
- Domaines référents : ${data.backlinks ? data.backlinks.referringDomains : 'N/A'}
- Rank DataForSEO : ${data.backlinks ? data.backlinks.rank : 'N/A'}

6. EXPERIENCE UTILISATEUR (${data.uxScore}/100) — ANALYSE WEBDESIGNER :
A) Design & Modernité :
- Animations CSS (@keyframes) : ${data.uxChecks.hasCssAnimations ? 'Oui' : 'NON'}
- Transitions CSS : ${data.uxChecks.hasCssTransitions ? 'Oui' : 'NON'}
- Animations au scroll (AOS/GSAP/Framer) : ${data.uxChecks.hasScrollAnimations ? 'Oui' : 'NON — le site est statique'}
- Effets modernes (glassmorphism, blur, clip-path) : ${data.uxChecks.hasModernEffects ? 'Oui' : 'Non'}
- Dégradés CSS : ${data.uxChecks.hasGradients ? 'Oui' : 'Non'}
- Smooth scroll : ${data.uxChecks.hasSmoothScroll ? 'Oui' : 'Non'}
- Hover effects : ${data.uxChecks.hasHoverEffects ? 'Oui' : 'Non'}

B) Qualité visuelle :
- Fonts personnalisées : ${data.uxChecks.hasCustomFonts ? 'Oui' : 'NON — typographie basique'}
- Bibliothèque d'icônes : ${data.uxChecks.hasIconLibrary ? 'Oui' : 'Non'}
- SVGs : ${data.uxChecks.svgCount}${data.uxChecks.svgCount === 0 ? ' (pas de graphiques vectoriels)' : ''}
- Contenu vidéo : ${data.uxChecks.hasVideoContent ? 'Oui' : 'Non'}
- Formats images modernes (WebP/AVIF) : ${data.uxChecks.hasModernImageFormats ? 'Oui' : 'Non'}

C) Navigation & conversion :
- Navigation : ${data.uxChecks.hasNav ? 'Oui' : 'NON'}
- Navigation sticky/fixe : ${data.uxChecks.hasStickyNav ? 'Oui' : 'Non'}
- CTA dans la navbar : ${data.uxChecks.hasCtaInNav ? 'Oui' : 'NON — aucun bouton d\'action en nav'}
- Boutons CTA sur la page : ${data.uxChecks.ctaCount}${data.uxChecks.ctaCount === 0 ? ' (AUCUN CTA — problème conversion majeur)' : data.uxChecks.ctaCount < 3 ? ' (INSUFFISANT)' : ''}
- Formulaires : ${data.uxChecks.formCount}
- Breadcrumbs : ${data.uxChecks.hasBreadcrumbs ? 'Oui' : 'Non'}
- Bouton retour en haut : ${data.uxChecks.hasBackToTop ? 'Oui' : 'Non'}

D) Structure de page :
- Section Hero/Banner : ${data.uxChecks.hasHeroSection ? 'Oui' : 'NON — pas de première impression forte'}
- Blocs visuels distincts : ${data.uxChecks.visualBlockCount}${data.uxChecks.visualBlockCount < 3 ? ' (SITE ULTRA SIMPLE)' : ''}
- Preuves sociales (témoignages, avis) : ${data.uxChecks.hasSocialProof ? 'Oui' : 'Non'}

E) Footer :
- Footer présent : ${data.uxChecks.hasFooter ? 'Oui' : 'NON'}
- Footer multi-colonnes (organisé) : ${data.uxChecks.footerHasColumns ? 'Oui' : 'Non'}
- Liens dans le footer : ${data.uxChecks.footerLinkCount}${data.uxChecks.footerLinkCount < 4 ? ' (footer pauvre)' : ''}

F) Technique UX :
- Accessibilité Lighthouse : ${data.accessibilityAvg}/100
- Bonnes pratiques Lighthouse : ${data.bestPracticesAvg}/100
- Lazy loading images : ${data.uxChecks.hasLazyLoading ? 'Oui' : 'Non'}
- Ratio mobile/desktop : ${Math.round(data.uxChecks.mobileRatio * 100)}%

7. CORE WEB VITALS :
- LCP (Largest Contentful Paint) : ${data.coreWebVitals.lcp !== null ? `${Math.round(data.coreWebVitals.lcp)}ms` : 'N/A'}${data.coreWebVitals.lcp !== null ? (data.coreWebVitals.lcp < 2500 ? ' ✓ (bon)' : data.coreWebVitals.lcp < 4000 ? ' (à améliorer)' : ' (MAUVAIS)') : ''}
- CLS (Cumulative Layout Shift) : ${data.coreWebVitals.cls !== null ? data.coreWebVitals.cls.toFixed(3) : 'N/A'}${data.coreWebVitals.cls !== null ? (data.coreWebVitals.cls < 0.1 ? ' ✓ (bon)' : data.coreWebVitals.cls < 0.25 ? ' (à améliorer)' : ' (MAUVAIS)') : ''}
- INP : ${data.coreWebVitals.inp !== null ? `${Math.round(data.coreWebVitals.inp)}ms` : 'N/A'}
- FCP : ${data.coreWebVitals.fcp !== null ? `${Math.round(data.coreWebVitals.fcp)}ms` : 'N/A'}
- TBT : ${data.coreWebVitals.tbt !== null ? `${Math.round(data.coreWebVitals.tbt)}ms` : 'N/A'}

8. H1 vs TITLE : ${data.h1VsTitleIdentical ? 'IDENTIQUES (PROBLÈME — H1 et title doivent être différenciés)' : 'Différents ✓'}

9. DENSITÉ MOTS-CLÉS :
${data.keywordDensity.length > 0 ? data.keywordDensity.map(kd => `- "${kd.keyword}" : ${kd.count} occurrences (${kd.density}%)`).join('\n') : '- Non calculée (pas de mots-clés fournis)'}

10. EXPLORATION MULTI-PAGES :
- Pages analysées : ${data.multiPageData.pagesScraped}
- Nombre total de mots (pages secondaires) : ${data.multiPageData.totalWordCount}

Score global : ${data.globalScore}/100

GÉNÈRE un JSON avec cette structure exacte :
{
  "descriptions": {
    "performance": "2-3 phrases. Moyenne en premier, puis détail mobile/desktop.",
    "balises": "3-4 phrases. Analyse en expert SEO pointilleux : cohérence du H1 avec le mot-clé ciblé, qualité du meta title (longueur, présence du mot-clé, caractère incitatif), meta description (longueur, call-to-action, mot-clé), hiérarchie des headings (logique, violations, abus), Open Graph. Sois sévère si le mot-clé ciblé n'est pas dans le H1 ou le title.",
    "content": "3-4 phrases. Analyse en rédacteur SEO exigeant : le contenu est-il suffisamment développé (800+ mots attendus) ? Les paragraphes sont-ils rédigés en profondeur ou superficiels ? La structure H2/H3 découpe-t-elle logiquement le sujet ? Le maillage interne est-il travaillé ? Le ratio contenu/code est-il acceptable ? Sois critique si le contenu est maigre ou mal structuré.",
    "responsive": "3-4 phrases. Analyse en tant que webdesigner exigeant : le site est-il pensé mobile-first ? Navigation sticky, animations tactiles, optimisation images, CTA accessibles sur petit écran. Un site 'fonctionnel' sur mobile ne mérite pas plus de 75.",
    "config": "2-3 phrases. Analyse HTTPS, robots.txt, sitemap, temps de réponse.",
    "ux": "3-4 phrases. Analyse en tant que webdesigner exigeant : modernité du design (animations, effets visuels), qualité des CTA et leur placement, navigation, hero section, footer, typographie, preuves sociales. Sois critique si le site est basique/statique."
  },
  "improvements": [
    { "problem": "Titre court (max 7 mots)", "category": "Balises|Contenu|Responsive|Performances|UX|Config", "urgency": "Critique|Important|Secondaire" }
  ]
}

RÈGLES pour les 10 axes d'amélioration :
- Exactement 10 axes
- "category" = le critère d'audit concerné parmi : Balises, Contenu, Responsive, Performances, UX, Config
- "urgency" = gravité réelle du problème (Critique, Important, Secondaire) — ne force pas de répartition, si 10 problèmes sont critiques mets 10 critiques
- Basés sur les vrais problèmes détectés dans les données
- Titres courts (max 7 mots)
- Ton professionnel, direct, factuel
- Langue : français

Réponds UNIQUEMENT avec le JSON, sans markdown ni backticks.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (response.content[0] as { type: string; text: string }).text
    const parsed = JSON.parse(text)
    // Track real cost
    const usage = response.usage
    const inputCost = (usage?.input_tokens || 0) * 0.80 / 1_000_000 // Haiku $0.80/M input
    const outputCost = (usage?.output_tokens || 0) * 4 / 1_000_000 // Haiku $4/M output
    const dfCost = 0.30 // DataForSEO backlinks call
    const totalCost = Math.round((inputCost + outputCost + dfCost) * 1000) / 1000
    return { descriptions: parsed.descriptions, improvements: parsed.improvements, cost: totalCost, costDetails: { ai: Math.round((inputCost + outputCost) * 1000) / 1000, dataForSeo: dfCost, inputTokens: usage?.input_tokens || 0, outputTokens: usage?.output_tokens || 0 } }
  } catch (err) {
    console.error('[Audit] AI analysis error:', err)
    return generateFallbackAnalysis(data)
  }
}

function generateFallbackAnalysis(data: AnalysisData) {
  const descriptions = {
    performance: `Score moyen de ${data.performanceScore}/100. Mobile : ${data.performanceMobile}/100, Desktop : ${data.performanceDesktop}/100. ${data.performanceMobile < 50 ? 'Les performances mobiles sont critiques.' : data.performanceMobile < 70 ? 'Les performances mobiles sont insuffisantes.' : 'Performances correctes.'}`,
    balises: `Score de ${data.balisesScore}/100. ${!data.balisesChecks.hasH1 ? 'Balise H1 absente. ' : 'H1 présente. '}${!data.balisesChecks.hasMetaTitle ? 'Meta title absente. ' : `Meta title : ${data.balisesChecks.metaTitleLength} caractères. `}${!data.balisesChecks.hasMetaDescription ? 'Meta description absente.' : `Meta description : ${data.balisesChecks.metaDescLength} caractères.`}`,
    content: `Score de ${data.contentScore}/100. ${data.contentChecks.wordCount} mots, ${data.contentChecks.internalLinks} liens internes, ${data.contentChecks.h2Count} H2. ${data.contentChecks.hasStructuredData ? 'Données structurées présentes.' : 'Pas de données structurées.'}`,
    responsive: `Score de ${data.responsiveScore}/100. ${data.responsiveChecks.hasViewport ? 'Viewport configuré.' : 'Viewport absent.'} Ratio mobile/desktop : ${Math.round(data.responsiveChecks.mobileRatio * 100)}%.`,
    config: `Score de ${data.configScore}/100. ${data.configChecks.isHttps ? 'HTTPS actif.' : 'HTTPS absent.'} ${data.configChecks.hasRobotsTxt ? 'robots.txt présent.' : 'robots.txt absent.'} ${data.configChecks.hasSitemap ? 'Sitemap présent.' : 'Sitemap absent.'} Temps de réponse : ${data.configChecks.responseTime}ms.`,
    ux: `Score de ${data.uxScore}/100. Accessibilité : ${data.accessibilityAvg}/100. Bonnes pratiques : ${data.bestPracticesAvg}/100.`,
  }

  const improvements: { problem: string; category: string; urgency: string }[] = []
  if (!data.balisesChecks.hasH1) improvements.push({ problem: 'Ajouter une balise H1', category: 'Balises', urgency: 'Critique' })
  if (!data.balisesChecks.hasMetaTitle) improvements.push({ problem: 'Ajouter les balises meta title', category: 'Balises', urgency: 'Critique' })
  if (!data.balisesChecks.hasMetaDescription) improvements.push({ problem: 'Rédiger les meta descriptions', category: 'Balises', urgency: 'Critique' })
  if (!data.configChecks.isHttps) improvements.push({ problem: 'Migrer le site en HTTPS', category: 'Config', urgency: 'Critique' })
  if (data.performanceMobile < 50) improvements.push({ problem: 'Optimiser les performances mobiles', category: 'Performances', urgency: 'Critique' })
  if (data.contentChecks.internalLinks < 3) improvements.push({ problem: 'Renforcer le maillage interne', category: 'Contenu', urgency: 'Critique' })
  if (!data.configChecks.hasSitemap) improvements.push({ problem: 'Générer un sitemap XML', category: 'Config', urgency: 'Important' })
  if (!data.configChecks.hasRobotsTxt) improvements.push({ problem: 'Configurer le fichier robots.txt', category: 'Config', urgency: 'Important' })

  const defaults = [
    { problem: 'Optimiser les images du site', category: 'Performances', urgency: 'Critique' },
    { problem: 'Activer le cache navigateur', category: 'Performances', urgency: 'Important' },
    { problem: 'Réduire le JavaScript inutilisé', category: 'Performances', urgency: 'Important' },
    { problem: 'Enrichir le contenu textuel', category: 'Contenu', urgency: 'Critique' },
    { problem: 'Améliorer la structure des liens', category: 'Contenu', urgency: 'Important' },
    { problem: 'Ajouter des données structurées', category: 'Balises', urgency: 'Important' },
    { problem: 'Optimiser le rendu critique CSS', category: 'Performances', urgency: 'Important' },
    { problem: 'Développer une stratégie de contenu', category: 'Contenu', urgency: 'Critique' },
    { problem: 'Corriger les erreurs d\'accessibilité', category: 'UX', urgency: 'Important' },
    { problem: 'Implémenter le lazy loading images', category: 'Performances', urgency: 'Important' },
  ]

  while (improvements.length < 10) {
    const next = defaults.find(d => !improvements.some(i => i.problem === d.problem))
    if (next) improvements.push(next)
    else break
  }

  return { descriptions, improvements: improvements.slice(0, 10), cost: 0.30, costDetails: { ai: 0, dataForSeo: 0.30 } }
}
