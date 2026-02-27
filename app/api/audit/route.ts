import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const audits = await prisma.audit.findMany({
    include: { createdBy: true, project: { include: { client: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(audits)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, projectId } = await req.json()
  const apiKey = process.env.PAGESPEED_API_KEY
  const baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

  async function getScore(strategy: 'mobile' | 'desktop') {
    const queryUrl = `${baseUrl}?url=${encodeURIComponent(url)}&strategy=${strategy}${apiKey ? `&key=${apiKey}` : ''}`
    const res = await fetch(queryUrl)
    const data = await res.json()
    return {
      performance: Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      seo: Math.round((data.lighthouseResult?.categories?.seo?.score ?? 0) * 100),
      accessibility: Math.round((data.lighthouseResult?.categories?.accessibility?.score ?? 0) * 100),
      audits: data.lighthouseResult?.audits ?? {},
    }
  }

  const [mobile, desktop] = await Promise.all([getScore('mobile'), getScore('desktop')])

  const performanceMobile = mobile.performance
  const performanceDesktop = desktop.performance
  const seoScore = Math.round((mobile.seo + desktop.seo) / 2)
  const uxScore = Math.round((mobile.accessibility + desktop.accessibility) / 2)
  const responsiveScore = performanceMobile
  const avgPerf = Math.round((performanceMobile + performanceDesktop) / 2)
  const globalScore = Math.round((avgPerf * 1 + seoScore * 1 + uxScore * 0.5 + responsiveScore * 1) / 3.5)

  const improvements: { problem: string; complexity: string; urgency: string }[] = []
  const audits = desktop.audits

  const checks = [
    { key: 'render-blocking-resources', problem: 'Ressources bloquant le rendu', complexity: 'Modérée', urgency: 'Important' },
    { key: 'uses-optimized-images', problem: 'Images non optimisées', complexity: 'Simple', urgency: 'Important' },
    { key: 'unused-javascript', problem: 'JavaScript inutilisé chargé', complexity: 'Modérée', urgency: 'Important' },
    { key: 'document-title', problem: 'Balise title manquante ou incorrecte', complexity: 'Simple', urgency: 'Critique' },
    { key: 'meta-description', problem: 'Meta description manquante', complexity: 'Simple', urgency: 'Critique' },
    { key: 'hreflang', problem: 'Attribut hreflang manquant', complexity: 'Simple', urgency: 'Secondaire' },
    { key: 'image-alt', problem: 'Images sans attribut alt', complexity: 'Simple', urgency: 'Important' },
    { key: 'link-text', problem: 'Liens sans texte descriptif', complexity: 'Simple', urgency: 'Secondaire' },
    { key: 'crawlable-anchors', problem: 'Liens non crawlables', complexity: 'Modérée', urgency: 'Important' },
    { key: 'uses-text-compression', problem: 'Compression texte non activée', complexity: 'Simple', urgency: 'Important' },
    { key: 'uses-long-cache-ttl', problem: 'Cache navigateur non configuré', complexity: 'Modérée', urgency: 'Important' },
  ]

  for (const check of checks) {
    if (audits[check.key]?.score !== null && (audits[check.key]?.score ?? 1) < 0.9) {
      improvements.push({ problem: check.problem, complexity: check.complexity, urgency: check.urgency })
    }
  }

  if (performanceMobile < 50) improvements.push({ problem: 'Performances mobiles critiques (< 50)', complexity: 'Complexe', urgency: 'Critique' })
  else if (performanceMobile < 70) improvements.push({ problem: 'Performances mobiles insuffisantes (< 70)', complexity: 'Modérée', urgency: 'Important' })

  const audit = await prisma.audit.create({
    data: {
      url,
      projectId: projectId || null,
      createdById: session.user.id,
      performanceMobile,
      performanceDesktop,
      seoScore,
      uxScore,
      responsiveScore,
      globalScore,
      improvements,
    },
    include: { createdBy: true },
  })

  return NextResponse.json(audit)
}
