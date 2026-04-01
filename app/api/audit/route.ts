import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { createLog } from '@/lib/log'
import { rateLimit } from '@/lib/security'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

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
    // ── 1. PageSpeed Insights ─────────────────────────────────────────────────
    const [mobile, desktop] = await Promise.all([
      fetchPageSpeed(url, 'mobile', apiKey),
      fetchPageSpeed(url, 'desktop', apiKey),
    ])

    const performanceMobile = mobile.performance
    const performanceDesktop = desktop.performance

    // ── 2. Fetch & analyze website HTML ───────────────────────────────────────
    const siteAnalysis = await analyzeWebsite(url)

    // ── 3. Technical checks ───────────────────────────────────────────────────
    const technical = await checkTechnical(url)

    // ── 4. Calculate 6 category scores ────────────────────────────────────────

    // 1. PERFORMANCES (moyenne mobile + desktop)
    const performanceScore = Math.round((performanceMobile + performanceDesktop) / 2)

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
    }

    // ── H1 (max 20 pts) ──
    if (balisesChecks.hasH1) {
      if (balisesChecks.h1Count === 1) balisesScore += 20 // unique H1 = perfect
      else balisesScore += 8 // multiple H1 = partial credit
    }

    // ── Meta title (max 15 pts) ──
    if (balisesChecks.hasMetaTitle) {
      balisesScore += 8
      if (balisesChecks.metaTitleLength >= 30 && balisesChecks.metaTitleLength <= 60) balisesScore += 7
      else if (balisesChecks.metaTitleLength >= 20 && balisesChecks.metaTitleLength <= 70) balisesScore += 3
    }

    // ── Meta description (max 15 pts) ──
    if (balisesChecks.hasMetaDescription) {
      balisesScore += 8
      if (balisesChecks.metaDescLength >= 120 && balisesChecks.metaDescLength <= 160) balisesScore += 7
      else if (balisesChecks.metaDescLength >= 80 && balisesChecks.metaDescLength <= 200) balisesScore += 3
    }

    // ── Heading hierarchy quality (max 25 pts) ──
    // Need at least some H2 for structure
    if (balisesChecks.h2Count >= 3) balisesScore += 8
    else if (balisesChecks.h2Count >= 1) balisesScore += 4
    // H3 used properly under H2
    if (balisesChecks.h3Count >= 1 && balisesChecks.h2Count >= 1) balisesScore += 5

    // Penalize hierarchy violations (H1→H4, H2→H6 etc.)
    if (balisesChecks.hierarchyViolations === 0) balisesScore += 7
    else if (balisesChecks.hierarchyViolations <= 2) balisesScore += 3
    // else: 0 points for 3+ violations

    // Penalize deep heading abuse (H4-H6 overused for non-semantic purposes)
    if (!balisesChecks.hasDeepHeadingAbuse) balisesScore += 5
    // else: 0 points

    // ── Duplicate headings penalty (max -10) ──
    if (balisesChecks.duplicateHeadings > 5) balisesScore -= 10
    else if (balisesChecks.duplicateHeadings > 2) balisesScore -= 5
    else if (balisesChecks.duplicateHeadings > 0) balisesScore -= 2

    // ── Canonical (max 5 pts) ──
    if (balisesChecks.hasCanonical) balisesScore += 5

    // ── Open Graph quality (max 15 pts) ──
    if (balisesChecks.hasOgTitle) balisesScore += 4
    if (balisesChecks.hasOgDescription) balisesScore += 4
    if (balisesChecks.hasOgImage) balisesScore += 4
    if (balisesChecks.ogTagCount >= 4) balisesScore += 3 // has additional OG tags (type, url, etc.)

    // Floor at 0, cap at 100
    balisesScore = Math.max(0, Math.min(balisesScore, 100))

    // Hard rule: missing essentials → capped
    if (!balisesChecks.hasH1 || !balisesChecks.hasMetaTitle || !balisesChecks.hasMetaDescription) {
      balisesScore = Math.min(balisesScore, 35)
    }
    // Multiple H1 → capped at 70
    if (balisesChecks.h1Count > 1) {
      balisesScore = Math.min(balisesScore, 70)
    }
    // Severe hierarchy issues → capped at 65
    if (balisesChecks.hierarchyViolations >= 3) {
      balisesScore = Math.min(balisesScore, 65)
    }

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

    // ── Profondeur rédactionnelle (max 25 pts) ──
    // On veut du VRAI contenu (paragraphes rédigés), pas juste des mots épars
    // Combiner wordCount ET paragraphCount pour évaluer la profondeur
    const hasRealContent = contentChecks.paragraphCount >= 5 && contentChecks.avgParagraphLength >= 25
    const hasDecentContent = contentChecks.paragraphCount >= 3 && contentChecks.avgParagraphLength >= 15
    if (hasRealContent && contentChecks.wordCount >= 800) contentScore += 25
    else if (hasRealContent && contentChecks.wordCount >= 500) contentScore += 18
    else if (hasDecentContent && contentChecks.wordCount >= 400) contentScore += 12
    else if (hasDecentContent) contentScore += 7
    else if (contentChecks.wordCount >= 300) contentScore += 4
    // Beaucoup de mots mais pas de paragraphes = contenu superficiel → quasi 0

    // ── Structure rédactionnelle titres + sous-titres (max 18 pts) ──
    // Les H2 découpent le contenu, les H3 le détaillent
    if (contentChecks.h2Count >= 4) contentScore += 10
    else if (contentChecks.h2Count >= 3) contentScore += 7
    else if (contentChecks.h2Count >= 2) contentScore += 4
    else if (contentChecks.h2Count >= 1) contentScore += 2
    if (contentChecks.h3Count >= 3 && contentChecks.h2Count >= 2) contentScore += 8
    else if (contentChecks.h3Count >= 2 && contentChecks.h2Count >= 1) contentScore += 5
    else if (contentChecks.h3Count >= 1 && contentChecks.h2Count >= 1) contentScore += 2

    // ── Éléments de structuration (max 5 pts) ──
    if (contentChecks.listCount >= 3) contentScore += 5
    else if (contentChecks.listCount >= 1) contentScore += 2

    // ── Maillage interne (max 10 pts) ──
    if (contentChecks.internalLinks >= 10) contentScore += 10
    else if (contentChecks.internalLinks >= 5) contentScore += 7
    else if (contentChecks.internalLinks >= 3) contentScore += 4
    else if (contentChecks.internalLinks >= 1) contentScore += 2

    // ── Images + alt (max 7 pts) ──
    contentScore += Math.round(contentChecks.imgAltRatio * 7)

    // ── Données structurées (max 7 pts) ──
    if (contentChecks.hasStructuredData) contentScore += 7

    // ── Ratio contenu/code (max 8 pts) ──
    if (contentChecks.contentRatio >= 25) contentScore += 8
    else if (contentChecks.contentRatio >= 15) contentScore += 5
    else if (contentChecks.contentRatio >= 8) contentScore += 2

    // ── Liens externes pertinents (max 5 pts) ──
    if (contentChecks.externalLinks >= 3) contentScore += 5
    else if (contentChecks.externalLinks >= 1) contentScore += 2

    // ── PageSpeed SEO (max 10 pts) — bonus modeste ──
    contentScore += Math.round(contentChecks.pagespeedSeo * 0.10)

    contentScore = Math.max(0, Math.min(contentScore, 100))

    // ── Hard caps — contenu clairement insuffisant ──
    // Pas de vrais paragraphes → site "vitrine vide"
    if (contentChecks.paragraphCount < 2) contentScore = Math.min(contentScore, 30)
    else if (contentChecks.paragraphCount < 4 && contentChecks.avgParagraphLength < 20) contentScore = Math.min(contentScore, 40)
    // Aucun H2 → pas de structure → cap
    if (contentChecks.h2Count === 0) contentScore = Math.min(contentScore, 35)
    // Très peu de mots réels
    if (contentChecks.wordCount < 150) contentScore = Math.min(contentScore, 20)
    else if (contentChecks.wordCount < 300) contentScore = Math.min(contentScore, 40)
    // Ratio contenu/code catastrophique
    if (contentChecks.contentRatio < 5) contentScore = Math.min(contentScore, 30)

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
    configScore = Math.min(configScore, 100)
    // Hard caps — pénalités lourdes pour manques critiques
    if (!configChecks.isHttps) configScore = Math.min(configScore, 20)
    if (configChecks.hasMixedContent) configScore = Math.min(configScore, 50)
    if (!configChecks.hasRobotsTxt && !configChecks.hasSitemap) configScore = Math.min(configScore, 35)
    else if (!configChecks.hasRobotsTxt) configScore = Math.min(configScore, 55)
    else if (!configChecks.hasSitemap) configScore = Math.min(configScore, 55)
    if (configChecks.responseTime > 3000) configScore = Math.min(configScore, 45)

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

    const analysisData = {
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
          logoUrl: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`,
          balisesChecks,
          contentChecks,
          responsiveChecks,
          configChecks,
          descriptions: aiAnalysis.descriptions,
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

  const { id, keywords } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const audit = await prisma.audit.update({
    where: { id },
    data: { keywords: keywords?.toString() ?? null },
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

  return {
    performance: Math.round((data.lighthouseResult.categories?.performance?.score ?? 0) * 100),
    seo: Math.round((data.lighthouseResult.categories?.seo?.score ?? 0) * 100),
    accessibility: Math.round((data.lighthouseResult.categories?.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((data.lighthouseResult.categories?.['best-practices']?.score ?? 0) * 100),
    audits: data.lighthouseResult.audits ?? {},
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
    }
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
  try {
    const res = await fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(5000) })
    const text = await res.text()
    hasSitemap = res.ok && (text.includes('<urlset') || text.includes('<sitemapindex'))
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

  return { isHttps, hasRobotsTxt, hasSitemap, hasMixedContent, responseTime, hasRedirectToHttps }
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
  configChecks: { isHttps: boolean; hasRedirectToHttps: boolean; hasRobotsTxt: boolean; hasSitemap: boolean; hasMixedContent: boolean; responseTime: number }
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

3. CONTENU (${data.contentScore}/100) :
- Nombre de mots : ${data.contentChecks.wordCount}${data.contentChecks.wordCount < 300 ? ' (INSUFFISANT, min 500-800 recommandé)' : ''}
- Paragraphes structurés : ${data.contentChecks.paragraphCount}${data.contentChecks.paragraphCount < 3 ? ' (INSUFFISANT)' : ''}
- Longueur moyenne paragraphes : ${data.contentChecks.avgParagraphLength} mots
- Ratio contenu/code : ${data.contentChecks.contentRatio}%${data.contentChecks.contentRatio < 10 ? ' (TRÈS FAIBLE)' : ''}
- Balises H2 : ${data.contentChecks.h2Count}${data.contentChecks.h2Count < 2 ? ' (PAS DE STRUCTURE)' : ''}
- Balises H3 : ${data.contentChecks.h3Count}
- Listes (ul/ol) : ${data.contentChecks.listCount}
- Liens internes : ${data.contentChecks.internalLinks}
- Liens externes : ${data.contentChecks.externalLinks}
- Ratio alt images : ${Math.round(data.contentChecks.imgAltRatio * 100)}%
- Données structurées : ${data.contentChecks.hasStructuredData ? 'Oui' : 'Non'}

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
- sitemap.xml : ${data.configChecks.hasSitemap ? 'Oui' : 'Non'}
- Contenu mixte : ${data.configChecks.hasMixedContent ? 'OUI (problème)' : 'Non'}
- Temps de réponse : ${data.configChecks.responseTime}ms

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

Score global : ${data.globalScore}/100

GÉNÈRE un JSON avec cette structure exacte :
{
  "descriptions": {
    "performance": "2-3 phrases. Moyenne en premier, puis détail mobile/desktop.",
    "balises": "2-3 phrases. Mentionne les balises présentes/absentes et leur qualité.",
    "content": "2-3 phrases. Analyse contenu, maillage interne, structure.",
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (response.content[0] as { type: string; text: string }).text
    const parsed = JSON.parse(text)
    return { descriptions: parsed.descriptions, improvements: parsed.improvements }
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

  return { descriptions, improvements: improvements.slice(0, 10) }
}
