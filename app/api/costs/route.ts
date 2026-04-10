import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const year = new Date().getFullYear()

  // Get costs from ApiCostLog (new tracking)
  const costLogs = await prisma.apiCostLog.findMany({
    where: { createdAt: { gte: new Date(`${year}-01-01`) } },
    select: { service: true, action: true, cost: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  // Get costs from Audit.details.cost (legacy)
  const audits = await prisma.audit.findMany({
    where: { createdAt: { gte: new Date(`${year}-01-01`) } },
    select: { cost: true, costDetails: true, createdAt: true },
  })

  // Get costs from Redaction.cost (legacy)
  const redactions = await prisma.redaction.findMany({
    where: { createdAt: { gte: new Date(`${year}-01-01`) } },
    select: { cost: true, costDetails: true, createdAt: true },
  })

  // Build monthly breakdown
  const months: Record<string, { anthropic: number; dataforseo: number; total: number; details: { service: string; action: string; cost: number; date: string }[] }> = {}

  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    months[key] = { anthropic: 0, dataforseo: 0, total: 0, details: [] }
  }

  // Process ApiCostLog entries
  for (const log of costLogs) {
    const key = log.createdAt.toISOString().slice(0, 7)
    if (!months[key]) continue
    months[key].total += log.cost
    if (log.service === 'anthropic') months[key].anthropic += log.cost
    else if (log.service === 'dataforseo') months[key].dataforseo += log.cost
    months[key].details.push({ service: log.service, action: log.action, cost: log.cost, date: log.createdAt.toISOString() })
  }

  // Process legacy Audit costs
  for (const audit of audits) {
    const cost = audit.cost || (audit.costDetails as Record<string, unknown>)?.cost as number || 0
    if (!cost) continue
    const key = audit.createdAt.toISOString().slice(0, 7)
    if (!months[key]) continue
    const details = (audit.costDetails || audit.costDetails) as Record<string, unknown> | null
    const aiCost = (details?.ai as number) || cost * 0.6
    const dfCost = (details?.dataForSeo as number) || cost * 0.4
    months[key].anthropic += aiCost
    months[key].dataforseo += dfCost
    months[key].total += cost
    months[key].details.push({ service: 'audit', action: 'audit-seo', cost, date: audit.createdAt.toISOString() })
  }

  // Process legacy Redaction costs
  for (const redaction of redactions) {
    const cost = redaction.cost || 0
    if (!cost) continue
    const key = redaction.createdAt.toISOString().slice(0, 7)
    if (!months[key]) continue
    const details = redaction.costDetails as Record<string, unknown> | null
    const analysisCost = (details?.analysis as Record<string, unknown>)?.total as number || 0
    const redactionCost = (details?.redaction as Record<string, unknown>)?.total as number || 0
    const dfCost = (details?.analysis as Record<string, unknown>)?.dataForSeo as number || 0.40
    months[key].anthropic += (cost - dfCost)
    months[key].dataforseo += dfCost
    months[key].total += cost
    months[key].details.push({ service: 'redaction', action: 'redaction-seo', cost, date: redaction.createdAt.toISOString() })
  }

  // Round values
  for (const key of Object.keys(months)) {
    months[key].anthropic = Math.round(months[key].anthropic * 1000) / 1000
    months[key].dataforseo = Math.round(months[key].dataforseo * 1000) / 1000
    months[key].total = Math.round(months[key].total * 1000) / 1000
  }

  // Totals
  const yearTotal = Object.values(months).reduce((s, m) => s + m.total, 0)
  const yearAnthropic = Object.values(months).reduce((s, m) => s + m.anthropic, 0)
  const yearDataforseo = Object.values(months).reduce((s, m) => s + m.dataforseo, 0)

  // Counts
  const auditCount = audits.length
  const redactionCount = redactions.length
  const chatCount = costLogs.filter(l => l.action === 'chat').length

  // Check Anthropic API status
  let anthropicStatus: 'active' | 'no_credits' | 'error' = 'error'
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: '.' }] }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) anthropicStatus = 'active'
      else {
        const err = await res.json().catch(() => ({}))
        anthropicStatus = err?.error?.message?.includes('credit balance') ? 'no_credits' : 'active'
      }
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    year,
    months,
    totals: {
      total: Math.round(yearTotal * 1000) / 1000,
      anthropic: Math.round(yearAnthropic * 1000) / 1000,
      dataforseo: Math.round(yearDataforseo * 1000) / 1000,
    },
    counts: { audits: auditCount, redactions: redactionCount, chats: chatCount },
    apiStatus: { anthropic: anthropicStatus },
  })
}
