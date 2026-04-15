import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const viewMode = searchParams.get('view') || 'month'
  const targetMonth = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const demoFilter = demoWhere(session)

  // ─── Rolling 12 months: from 11 months ago to current month ───
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() // 0-indexed

  // Build array of 12 {year, month} objects ending at current month
  const rolling12: { year: number; month: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(curYear, curMonth - i, 1)
    rolling12.push({ year: d.getFullYear(), month: d.getMonth() + 1 }) // month 1-indexed
  }

  const rollingStart = new Date(rolling12[0].year, rolling12[0].month - 1, 1)
  const rollingEnd = new Date(curYear, curMonth + 1, 1) // first day after current month

  // Previous 12 months (for N-1 comparison)
  const prevRollingStart = new Date(rolling12[0].year - 1, rolling12[0].month - 1, 1)
  const prevRollingEnd = new Date(curYear - 1, curMonth + 1, 1)

  // Fetch all data in parallel
  const [
    activeMaintenances,
    , // maintenance invoices rolling (unused — récurrent uses active maintenances)
    maintenanceInvoicesPrev,
    expenses,
    projectsRolling,
    projectsPrev,
    allProjects,
    smallProjectsRolling,
    smallProjectsPrev,
  ] = await Promise.all([
    // Active maintenances for MRR
    prisma.maintenanceContract.findMany({
      where: { ...demoFilter, active: true, priceHT: { not: null } },
      select: { id: true, clientName: true, type: true, priceHT: true, billing: true, startDate: true, endDate: true, createdAt: true },
    }),
    // Maintenance invoices for rolling 12 months + some buffer
    prisma.maintenanceInvoice.findMany({
      where: {
        OR: rolling12.map(r => ({ year: r.year, month: r.month })),
      },
      select: { year: true, month: true, amountHT: true, amountTTC: true },
    }),
    // Maintenance invoices previous 12 months
    prisma.maintenanceInvoice.findMany({
      where: {
        OR: rolling12.map(r => ({ year: r.year - 1, month: r.month })),
      },
      select: { year: true, month: true, amountHT: true, amountTTC: true },
    }),
    // Expenses
    prisma.expense.findMany({ where: demoFilter }),
    // Projects in rolling 12 months (use startDate if available, else createdAt)
    prisma.project.findMany({
      where: {
        AND: [demoFilter],
        price: { not: null },
        OR: [
          { signedAt: { gte: rollingStart, lt: rollingEnd } },
          { signedAt: null, startDate: { gte: rollingStart, lt: rollingEnd } },
          { signedAt: null, startDate: null, createdAt: { gte: rollingStart, lt: rollingEnd } },
        ],
      },
      select: { id: true, name: true, price: true, signedAt: true, startDate: true, createdAt: true, client: { select: { name: true } }, assignments: { select: { price: true, status: true } } },
    }),
    // Projects previous 12 months
    prisma.project.findMany({
      where: {
        AND: [demoFilter],
        price: { not: null },
        OR: [
          { signedAt: { gte: prevRollingStart, lt: prevRollingEnd } },
          { signedAt: null, startDate: { gte: prevRollingStart, lt: prevRollingEnd } },
          { signedAt: null, startDate: null, createdAt: { gte: prevRollingStart, lt: prevRollingEnd } },
        ],
      },
      select: { id: true, price: true, signedAt: true, startDate: true, createdAt: true },
    }),
    // All projects for pipeline value
    prisma.project.findMany({
      where: { AND: [demoFilter] },
      select: { id: true, name: true, status: true, price: true, createdAt: true, client: { select: { name: true } } },
    }),
    // Small projects in rolling 12 months
    prisma.smallProject.findMany({
      where: { signedAt: { gte: rollingStart, lt: rollingEnd } },
      select: { id: true, name: true, price: true, charges: true, signedAt: true, client: { select: { name: true } } },
    }),
    // Small projects previous 12 months
    prisma.smallProject.findMany({
      where: { signedAt: { gte: prevRollingStart, lt: prevRollingEnd } },
      select: { id: true, price: true, signedAt: true },
    }),
  ])

  // ─── MRR ───
  function toMonthly(billing: string, price: number) {
    if (billing === 'MANUEL') return 0
    if (billing === 'ANNUEL') return price / 12
    if (billing === 'TRIMESTRIEL') return price / 3
    return price
  }
  const mrrByType: Record<string, number> = {}
  const mrrDetails: { clientName: string; type: string; priceHT: number; billing: string; monthly: number }[] = []
  for (const m of activeMaintenances) {
    const monthly = toMonthly(m.billing, m.priceHT!)
    mrrByType[m.type] = (mrrByType[m.type] || 0) + monthly
    mrrDetails.push({ clientName: m.clientName, type: m.type, priceHT: m.priceHT!, billing: m.billing, monthly })
  }
  const totalMRR = Object.values(mrrByType).reduce((s, v) => s + v, 0)

  // MANUEL maintenances: one-shot revenue attributed to endDate (or startDate / createdAt)
  const manualMaintenances = activeMaintenances.filter(m => m.billing === 'MANUEL')
  function manualDate(m: { endDate: Date | null; startDate: Date | null; createdAt: Date }): Date {
    return m.endDate ?? m.startDate ?? m.createdAt
  }

  // Helper: get effective date for a project (signedAt > startDate > createdAt)
  function projectDate(p: { signedAt?: Date | null; startDate: Date | null; createdAt: Date }): Date {
    return p.signedAt ?? p.startDate ?? p.createdAt
  }

  // ─── Rolling 12 months breakdown ───
  const months = rolling12.map((rm) => {
    const monthIdx = rm.month // 1-indexed

    // Récurrent = somme des maintenances actives (prix mensuel), pas les factures
    // + MANUEL attribuées au mois de leur endDate (one-shot)
    const monthManual = manualMaintenances.filter(m => {
      const d = manualDate(m)
      return d.getFullYear() === rm.year && d.getMonth() + 1 === rm.month
    })
    const manualHT = monthManual.reduce((s, m) => s + (m.priceHT ?? 0), 0)
    const maintenanceHT = totalMRR + manualHT
    const maintenanceTTC = maintenanceHT * 1.2
    const maintenanceEstimated = true

    // Projects for this month
    const monthProjects = projectsRolling.filter(p => {
      const d = projectDate(p)
      return d.getFullYear() === rm.year && d.getMonth() + 1 === rm.month
    })
    // Small projects for this month
    const monthSmallProjects = smallProjectsRolling.filter(sp => {
      const d = new Date(sp.signedAt)
      return d.getFullYear() === rm.year && d.getMonth() + 1 === rm.month
    })
    const projectHT = monthProjects.reduce((s, p) => s + (p.price ?? 0), 0) + monthSmallProjects.reduce((s, sp) => s + sp.price, 0)

    // Freelance costs for this month
    const projectFreelanceCosts = monthProjects.reduce((s, p) => {
      const accepted = (p as { assignments?: { price: number | null; status: string }[] }).assignments || []
      return s + accepted.filter(a => a.status === 'VALIDE' && a.price).reduce((sum, a) => sum + (a.price ?? 0), 0)
    }, 0)
    const smallProjectCharges = monthSmallProjects.reduce((s, sp) => s + ((sp as { charges?: number }).charges ?? 0), 0)
    const monthFreelanceCosts = projectFreelanceCosts + smallProjectCharges

    // Previous year same month
    const prevMaintInvoices = maintenanceInvoicesPrev.filter(inv => inv.year === rm.year - 1 && inv.month === rm.month)
    const prevMaintenanceHT = prevMaintInvoices.reduce((s, inv) => s + inv.amountHT, 0)
    const prevMonthProjects = projectsPrev.filter(p => {
      const d = projectDate(p)
      return d.getFullYear() === rm.year - 1 && d.getMonth() + 1 === rm.month
    })
    const prevSmallProjects = smallProjectsPrev.filter(sp => {
      const d = new Date(sp.signedAt)
      return d.getFullYear() === rm.year - 1 && d.getMonth() + 1 === rm.month
    })
    const prevProjectHT = prevMonthProjects.reduce((s, p) => s + (p.price ?? 0), 0) + prevSmallProjects.reduce((s, sp) => s + sp.price, 0)

    // Combine projects list for display (with costs: validated + pending)
    const allMonthProjects = [
      ...monthProjects.map(p => {
        const assignments = (p as { assignments?: { price: number | null; status: string }[] }).assignments || []
        const costs = assignments.filter(a => a.status === 'VALIDE' && a.price).reduce((sum, a) => sum + (a.price ?? 0), 0)
        const pendingCosts = assignments.filter(a => ['EN_ATTENTE', 'COUNTER'].includes(a.status) && a.price).reduce((sum, a) => sum + (a.price ?? 0), 0)
        return { id: p.id, name: p.name, price: p.price, client: p.client?.name, type: 'project' as const, costs, pendingCosts }
      }),
      ...monthSmallProjects.map(sp => ({
        id: sp.id, name: sp.name, price: sp.price, client: sp.client?.name, type: 'small-project' as const,
        costs: (sp as { charges?: number }).charges ?? 0, pendingCosts: 0,
      })),
    ]

    return {
      year: rm.year,
      month: monthIdx,
      maintenanceHT,
      maintenanceTTC,
      maintenanceEstimated,
      projectHT,
      freelanceCosts: monthFreelanceCosts,
      totalHT: maintenanceHT + projectHT,
      totalTTC: maintenanceTTC + projectHT * 1.2,
      prevYearTotalHT: prevMaintenanceHT + prevProjectHT,
      projects: allMonthProjects,
    }
  })

  // ─── Totals ───
  const totalCAHT = months.reduce((s, m) => s + m.totalHT, 0)
  const totalMaintenanceHT = months.reduce((s, m) => s + m.maintenanceHT, 0)
  const totalProjectHT = months.reduce((s, m) => s + m.projectHT, 0)
  const prevYearTotalHT = months.reduce((s, m) => s + m.prevYearTotalHT, 0)
  const recurringExpenses = expenses.filter(e => e.recurring)
  const oneTimeExpenses = expenses.filter(e => !e.recurring)
  const totalRecurringExpenses = recurringExpenses.reduce((s, e) => s + e.amount, 0)
  const totalOneTimeExpenses = oneTimeExpenses.reduce((s, e) => s + e.amount, 0)
  const totalExpenses = totalRecurringExpenses + totalOneTimeExpenses
  const totalFreelanceCosts = months.reduce((s, m) => s + m.freelanceCosts, 0)
  const totalCosts = totalExpenses + totalFreelanceCosts

  // ─── Objectives ───
  const goalSetting = await prisma.setting.findUnique({ where: { key: 'monthlyGoal' } })
  const monthlyGoal = goalSetting ? parseFloat(goalSetting.value) : 10000
  const annualGoal = monthlyGoal * 12
  const monthsElapsed = targetYear === curYear ? curMonth + 1 : 12
  const proRataGoal = monthlyGoal * monthsElapsed
  const goalProgress = proRataGoal > 0 ? Math.round((totalCAHT / proRataGoal) * 100) : 0

  // ─── Pipeline ───
  const pipelineStatuses = ['BRIEF', 'REDACTION', 'MAQUETTE', 'INTEGRATION', 'DEVELOPPEMENT', 'CONCEPTION', 'OPTIMISATIONS', 'TESTING']
  const pipelineProjects = allProjects.filter(p => pipelineStatuses.includes(p.status) && p.price)
  const pipelineValue = pipelineProjects.reduce((s, p) => s + (p.price ?? 0), 0)

  // ─── Expense breakdown ───
  const expensesByCategory: Record<string, number> = {}
  for (const e of expenses) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount
  }

  // ─── Prospects with DEVIS_ENVOYE + Quotes with ENVOYE ───
  const [devisEnvoyeProspects, devisEnvoyeQuotes] = await Promise.all([
    prisma.prospect.findMany({
      where: { status: 'DEVIS_ENVOYE' },
      select: { id: true, name: true, company: true, budget: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.quote.findMany({
      where: { status: 'ENVOYE' },
      select: { id: true, number: true, clientName: true, subject: true, items: { select: { quantity: true, unitPrice: true } }, discount: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  // ─── Month-specific data (for month view) ───
  // Find the target month in rolling12
  const monthData = months.find(m => m.year === targetYear && m.month === targetMonth) || months[months.length - 1]

  return NextResponse.json({
    year: targetYear,
    viewMode,
    targetMonth,
    months, // rolling 12 months with year+month
    monthData,
    totalCAHT,
    totalMaintenanceHT,
    totalProjectHT,
    prevYearTotalHT,
    totalExpenses,
    totalRecurringExpenses,
    totalOneTimeExpenses,
    totalFreelanceCosts,
    totalCosts,
    netProfit: totalCAHT - totalCosts,
    marginPct: totalCAHT > 0 ? Math.round(((totalCAHT - totalCosts) / totalCAHT) * 100) : 0,
    netResult: totalCAHT * 1.2 - totalExpenses,
    totalMRR,
    mrrByType,
    mrrDetails,
    activeMaintenanceCount: activeMaintenances.length,
    annualGoal,
    monthlyGoal,
    goalProgress,
    monthsElapsed,
    proRataGoal,
    pipelineValue,
    pipelineCount: pipelineProjects.length,
    expensesByCategory,
    recurrentPct: totalCAHT > 0 ? Math.round((totalMaintenanceHT / totalCAHT) * 100) : 0,
    oneShotPct: totalCAHT > 0 ? Math.round((totalProjectHT / totalCAHT) * 100) : 0,
    devisEnvoyeProspects,
    devisEnvoyeQuotes: devisEnvoyeQuotes.map(q => {
      const totalHT = q.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      const afterDiscount = totalHT - (totalHT * q.discount / 100)
      return { id: q.id, number: q.number, clientName: q.clientName, subject: q.subject, totalHT: afterDiscount }
    }),
  })
}
