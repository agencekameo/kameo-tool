'use client'

import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Target, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, BarChart3, Receipt, ArrowUpRight, ArrowDownRight, Repeat, Zap, PieChart, Calendar, CalendarDays, Send } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { usePolling } from '@/hooks/usePolling'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface MonthData {
  year: number
  month: number
  maintenanceHT: number
  maintenanceTTC: number
  maintenanceEstimated: boolean
  projectHT: number
  freelanceCosts: number
  totalHT: number
  totalTTC: number
  prevYearTotalHT: number
  projects: { id: string; name: string; price: number | null; client: string | null; type: 'project' | 'small-project'; costs: number; pendingCosts: number }[]
}

interface MRRDetail {
  clientName: string
  type: string
  priceHT: number
  billing: string
  monthly: number
}

interface FinanceData {
  year: number
  viewMode: string
  targetMonth: number
  months: MonthData[]
  monthData: MonthData
  totalCAHT: number
  totalMaintenanceHT: number
  totalProjectHT: number
  prevYearTotalHT: number
  totalExpenses: number
  totalRecurringExpenses: number
  totalOneTimeExpenses: number
  totalFreelanceCosts: number
  totalCosts: number
  netProfit: number
  marginPct: number
  netResult: number
  totalMRR: number
  mrrByType: Record<string, number>
  mrrDetails: MRRDetail[]
  activeMaintenanceCount: number
  annualGoal: number
  monthlyGoal: number
  goalProgress: number
  monthsElapsed: number
  proRataGoal: number
  pipelineValue: number
  pipelineCount: number
  expensesByCategory: Record<string, number>
  recurrentPct: number
  oneShotPct: number
  devisEnvoyeProspects: { id: string; name: string; company: string | null; budget: number | null }[]
  devisEnvoyeQuotes: { id: string; number: string; clientName: string; subject: string; totalHT: number }[]
}

interface Expense {
  id: string; name: string; amount: number; category: string; recurring: boolean; notes?: string; expenseMonth?: number | null; expenseYear?: number | null
}
interface Maintenance {
  id: string; clientName: string; type: string; priceHT?: number; billing?: string; active: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  SALAIRE: 'Salaire', LOGICIEL: 'Logiciel', ABONNEMENT: 'Hébergement',
  ASSURANCE: 'Assurance', BANQUE: 'Banque', FOURNISSEUR: 'Comptable',
  DOMICILIATION: 'Domiciliation', EVENT: 'Event relationnel', COWORKING: 'Coworking',
  TRANSPORT: 'Transports', AUTRE: 'Services divers'
}
const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  SALAIRE: 'bg-[#E14B89]/10 text-[#E14B89]', LOGICIEL: 'bg-blue-400/10 text-blue-400',
  ABONNEMENT: 'bg-purple-400/10 text-purple-400', ASSURANCE: 'bg-orange-400/10 text-orange-400',
  BANQUE: 'bg-teal-400/10 text-teal-400', FOURNISSEUR: 'bg-amber-400/10 text-amber-400',
  DOMICILIATION: 'bg-cyan-400/10 text-cyan-400', EVENT: 'bg-rose-400/10 text-rose-400',
  COWORKING: 'bg-indigo-400/10 text-indigo-400', TRANSPORT: 'bg-emerald-400/10 text-emerald-400',
  AUTRE: 'bg-slate-400/10 text-slate-400'
}
const MRR_TYPE_LABELS: Record<string, string> = {
  WEB: 'Maintenances Web', GOOGLE: 'Fiches Google', RESEAUX: 'Réseaux sociaux', BLOG: 'Blog'
}
const MRR_TYPE_COLORS: Record<string, string> = {
  WEB: '#E14B89', GOOGLE: '#60a5fa', RESEAUX: '#a78bfa', BLOG: '#34d399'
}
const BILLING_LABELS: Record<string, string> = {
  MENSUEL: '/mois', TRIMESTRIEL: '/trim.', ANNUEL: '/an'
}
const emptyForm = { name: '', amount: '', category: 'ABONNEMENT', recurring: true, notes: '', expenseMonth: String(new Date().getMonth() + 1), expenseYear: String(new Date().getFullYear()) }

// ─── Smooth Curve Helper ─────────────────────────────────────────────────────────

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    const tension = 0.3
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

// ─── Curve config ────────────────────────────────────────────────────────────────

const ALL_CURVES = [
  { key: 'total', label: 'CA Total', color: '#E14B89', defaultOn: true, dashed: false },
  { key: 'objectif', label: 'Objectif', color: '#64748b', defaultOn: true, dashed: true },
  { key: 'charges', label: 'Charges', color: '#FF4040', defaultOn: true, dashed: false },
  { key: 'recurrent', label: 'Récurrent', color: '#a78bfa', defaultOn: true, dashed: false },
  { key: 'oneshot', label: 'One-shot', color: '#F8903C', defaultOn: true, dashed: false },
] as const

type CurveKey = typeof ALL_CURVES[number]['key']

// ─── Area Chart Component (smooth SVG) ──────────────────────────────────────────

function RevenueChart({ months, monthlyGoal, selectedIdx, onSelectIdx, title, curveKeys, totalExpenses }: {
  months: MonthData[]; monthlyGoal: number; selectedIdx?: number; onSelectIdx?: (idx: number) => void
  title?: string; curveKeys?: CurveKey[]; totalExpenses?: number
}) {
  const CURVES = curveKeys
    ? ALL_CURVES.filter(c => curveKeys.includes(c.key))
    : ALL_CURVES.filter(c => ['total', 'objectif'].includes(c.key))

  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CURVES.map(c => [c.key, c.defaultOn])) as Record<string, boolean>
  )
  const toggle = (key: string) => setVisible(v => ({ ...v, [key]: !v[key] }))

  // Compute max based on visible curves
  const getMax = () => {
    let max = 0
    months.forEach(m => {
      if (visible.total) max = Math.max(max, m.totalHT)
      if (visible.recurrent) max = Math.max(max, m.maintenanceHT)
      if (visible.oneshot) max = Math.max(max, m.projectHT)
      if (visible.objectif) max = Math.max(max, monthlyGoal)
      if (visible.charges) max = Math.max(max, (totalExpenses || 0) + m.freelanceCosts)
    })
    return max * 1.25 || 1
  }
  const maxVal = getMax()

  const W = 700
  const H = 220
  const PL = 50
  const PR = 10
  const PT = 15
  const PB = 30
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  function xPos(i: number) { return PL + (i / 11) * chartW }
  function yPos(val: number) { return PT + chartH - (maxVal > 0 ? (val / maxVal) * chartH : 0) }
  const baseline = yPos(0)

  // Build points for each curve
  const chargesPerMonth = totalExpenses || 0
  const curveData: Record<string, { x: number; y: number }[]> = {
    total: months.map((m, i) => ({ x: xPos(i), y: yPos(m.totalHT) })),
    recurrent: months.map((m, i) => ({ x: xPos(i), y: yPos(m.maintenanceHT) })),
    oneshot: months.map((m, i) => ({ x: xPos(i), y: yPos(m.projectHT) })),
    objectif: months.map((_, i) => ({ x: xPos(i), y: yPos(monthlyGoal) })),
    charges: months.map((m, i) => ({ x: xPos(i), y: yPos(chargesPerMonth + m.freelanceCosts) })),
  }

  // Y axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = (maxVal / 4) * i
    return { val, posY: yPos(val) }
  })

  const [hovered, setHovered] = useState<number | null>(null)

  // Find the primary visible curve for the dot (prefer total > recurrent > oneshot)
  const primaryCurve: CurveKey = visible.total ? 'total' : visible.recurrent ? 'recurrent' : visible.oneshot ? 'oneshot' : 'total'
  const primaryColor = CURVES.find(c => c.key === primaryCurve)?.color || '#E14B89'

  return (
    <div className="bg-[#0a0a12] border border-slate-800/50 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-2">
        <h3 className="text-white font-semibold text-sm">{title || 'Chiffre d\'affaires mensuel HT'}</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {CURVES.map(c => (
            <button key={c.key} onClick={() => toggle(c.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                visible[c.key]
                  ? 'bg-white/5 text-white'
                  : 'text-slate-600 hover:text-slate-400'
              }`}>
              <span className="w-3 h-1 rounded-full transition-opacity" style={{
                backgroundColor: c.color,
                opacity: visible[c.key] ? 1 : 0.25,
                ...(c.dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${c.color} 0 4px, transparent 4px 7px)`, backgroundColor: 'transparent' } : {}),
              }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="areaGradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E14B89" stopOpacity="0.30" />
              <stop offset="60%" stopColor="#E14B89" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#E14B89" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="areaGradRecurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="areaGradOneshot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F8903C" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#F8903C" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="areaGradCharges" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4040" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#FF4040" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Grid lines + Y labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PL} y1={t.posY} x2={W - PR} y2={t.posY} stroke="#1e293b" strokeWidth="0.5" opacity="0.5" />
              <text x={PL - 10} y={t.posY + 3} textAnchor="end" fill="#475569" fontSize="9" fontFamily="system-ui">
                {t.val >= 1000 ? `${(t.val / 1000).toFixed(0)}k` : Math.round(t.val).toString()}
              </text>
            </g>
          ))}

          {/* Area fills (render order: oneshot, recurrent, total) */}
          {visible.oneshot && (() => {
            const path = smoothPath(curveData.oneshot)
            return <path d={path + ` L${xPos(11)},${baseline} L${xPos(0)},${baseline} Z`} fill="url(#areaGradOneshot)" />
          })()}
          {visible.recurrent && (() => {
            const path = smoothPath(curveData.recurrent)
            return <path d={path + ` L${xPos(11)},${baseline} L${xPos(0)},${baseline} Z`} fill="url(#areaGradRecurrent)" />
          })()}
          {visible.charges && curveData.charges && (() => {
            const path = smoothPath(curveData.charges)
            return <path d={path + ` L${xPos(11)},${baseline} L${xPos(0)},${baseline} Z`} fill="url(#areaGradCharges)" />
          })()}
          {visible.total && (() => {
            const path = smoothPath(curveData.total)
            return <path d={path + ` L${xPos(11)},${baseline} L${xPos(0)},${baseline} Z`} fill="url(#areaGradTotal)" />
          })()}

          {/* Curve lines */}
          {visible.objectif && (
            <path d={smoothPath(curveData.objectif)} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
          )}
          {visible.charges && curveData.charges && (
            <path d={smoothPath(curveData.charges)} fill="none" stroke="#FF4040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          )}
          {visible.oneshot && (
            <path d={smoothPath(curveData.oneshot)} fill="none" stroke="#F8903C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          )}
          {visible.recurrent && (
            <path d={smoothPath(curveData.recurrent)} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {visible.total && (
            <path d={smoothPath(curveData.total)} fill="none" stroke="#E14B89" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
          )}

          {/* Interactive zones + points */}
          {months.map((m, i) => {
            const isSelected = selectedIdx === i
            const isHovered = hovered === i
            const active = isHovered || isSelected
            // Label: "Jan 25" format
            const label = `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(2)}`
            return (
              <g key={i} className="cursor-pointer"
                onClick={() => onSelectIdx?.(i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}>
                <rect x={xPos(i) - chartW / 24} y={PT} width={chartW / 12} height={chartH + PB} fill="transparent" />

                {active && (
                  <line x1={xPos(i)} y1={PT} x2={xPos(i)} y2={baseline}
                    stroke={isSelected ? primaryColor : '#334155'} strokeWidth="1" opacity="0.3" strokeDasharray={isSelected ? '0' : '3 3'} />
                )}

                {/* Dots for each visible curve */}
                {active && visible.total && (
                  <>
                    <circle cx={xPos(i)} cy={yPos(m.totalHT)} r="7" fill="#E14B89" opacity="0.12" />
                    <circle cx={xPos(i)} cy={yPos(m.totalHT)} r="3.5" fill="#E14B89" stroke="#0a0a12" strokeWidth="2" />
                  </>
                )}
                {active && visible.recurrent && (
                  <circle cx={xPos(i)} cy={yPos(m.maintenanceHT)} r="3" fill="#a78bfa" stroke="#0a0a12" strokeWidth="1.5" />
                )}
                {active && visible.oneshot && (
                  <circle cx={xPos(i)} cy={yPos(m.projectHT)} r="3" fill="#F8903C" stroke="#0a0a12" strokeWidth="1.5" />
                )}
                {active && visible.objectif && (
                  <circle cx={xPos(i)} cy={yPos(monthlyGoal)} r="2.5" fill="#64748b" stroke="#0a0a12" strokeWidth="1.5" />
                )}

                <text x={xPos(i)} y={H - 8} textAnchor="middle"
                  fill={isSelected ? primaryColor : active ? '#94a3b8' : '#475569'}
                  fontSize="9" fontWeight={isSelected ? 'bold' : 'normal'} fontFamily="system-ui">
                  {label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered !== null && (
          <div className="absolute z-10 pointer-events-none"
            style={{
              left: `${(xPos(hovered) / W) * 100}%`,
              top: '0',
              transform: `translateX(${hovered > 8 ? '-100%' : hovered < 2 ? '0' : '-50%'})`,
            }}>
            <div className="bg-[#13131d] border border-slate-700/50 rounded-xl px-4 py-3 text-xs whitespace-nowrap shadow-2xl backdrop-blur-sm">
              <p className="text-white font-semibold mb-1.5">{MONTH_FULL[months[hovered].month - 1]} {months[hovered].year}</p>
              <div className="space-y-1">
                {visible.total && (
                  <div className="flex items-center justify-between gap-6">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#E14B89]" />Total</span>
                    <span className="text-white font-bold">{formatCurrency(months[hovered].totalHT)}</span>
                  </div>
                )}
                {visible.recurrent && (
                  <div className="flex items-center justify-between gap-6">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />Récurrent</span>
                    <span className="text-[#a78bfa] font-medium">{formatCurrency(months[hovered].maintenanceHT)}{months[hovered].maintenanceEstimated ? ' *' : ''}</span>
                  </div>
                )}
                {visible.oneshot && (
                  <div className="flex items-center justify-between gap-6">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#F8903C]" />One-shot</span>
                    <span className="text-[#F8903C] font-medium">{formatCurrency(months[hovered].projectHT)}</span>
                  </div>
                )}
                {visible.objectif && (
                  <div className="flex items-center justify-between gap-6">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#64748b]" />Objectif</span>
                    <span className="text-slate-400 font-medium">{formatCurrency(monthlyGoal)}</span>
                  </div>
                )}
                {visible.charges && (
                  <div className="flex items-center justify-between gap-6">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#FF4040]" />Charges</span>
                    <span className="text-red-400 font-medium">{formatCurrency((totalExpenses || 0) + months[hovered].freelanceCosts)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Donut Chart (pure SVG) ─────────────────────────────────────────────────────

function DonutChart({ recurrentPct, oneShotPct, recurrentHT, oneShotHT }: { recurrentPct: number; oneShotPct: number; recurrentHT: number; oneShotHT: number }) {
  const circumference = 2 * Math.PI * 40
  const recurrentArc = (recurrentPct / 100) * circumference
  const oneShotArc = (oneShotPct / 100) * circumference

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
      <h3 className="text-white font-semibold text-sm mb-4">Répartition du CA</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1e1e2e" strokeWidth="10" />
            {recurrentPct > 0 && <circle cx="50" cy="50" r="40" fill="none" stroke="#E14B89" strokeWidth="10"
              strokeDasharray={`${recurrentArc} ${circumference}`} strokeLinecap="round" />}
            {oneShotPct > 0 && <circle cx="50" cy="50" r="40" fill="none" stroke="#F8903C" strokeWidth="10"
              strokeDasharray={`${oneShotArc} ${circumference}`} strokeDashoffset={`${-recurrentArc}`} strokeLinecap="round" />}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{recurrentPct + oneShotPct > 0 ? '100%' : '—'}</span>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Repeat size={12} className="text-[#E14B89]" />
              <span className="text-slate-400 text-xs">Récurrent</span>
              <span className="text-white text-xs font-semibold ml-auto">{recurrentPct}%</span>
            </div>
            <p className="text-white text-sm font-medium">{formatCurrency(recurrentHT)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={12} className="text-[#F8903C]" />
              <span className="text-slate-400 text-xs">One-shot</span>
              <span className="text-white text-xs font-semibold ml-auto">{oneShotPct}%</span>
            </div>
            <p className="text-white text-sm font-medium">{formatCurrency(oneShotHT)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Goal Progress ──────────────────────────────────────────────────────────────

function GoalProgress({ data }: { data: FinanceData }) {
  const annualPct = Math.min(Math.round((data.totalCAHT / data.annualGoal) * 100), 100)
  const remaining = Math.max(data.annualGoal - data.totalCAHT, 0)
  const monthsLeft = 12 - data.monthsElapsed
  const neededPerMonth = monthsLeft > 0 ? remaining / monthsLeft : 0
  const monthGoalsMet = data.months.filter((m, i) => i < data.monthsElapsed && m.totalHT >= data.monthlyGoal).length

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">Objectif annuel</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${annualPct >= 100 ? 'bg-green-400/10 text-green-400' : annualPct >= data.goalProgress ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'bg-amber-400/10 text-amber-400'}`}>
          {annualPct >= 100 ? 'Atteint !' : `${annualPct}%`}
        </span>
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-400">CA réalisé</span>
          <span className="text-white font-medium">{formatCurrency(data.totalCAHT)} / {formatCurrency(data.annualGoal)}</span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${annualPct}%`,
            background: annualPct >= 100 ? '#34d399' : 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)',
          }} />
        </div>
        {data.monthsElapsed < 12 && (
          <div className="relative h-0">
            <div className="absolute -top-3 border-l border-dashed border-slate-500 h-3" style={{ left: `${Math.round((data.monthsElapsed / 12) * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/30 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[11px] text-slate-500 mb-0.5">Obj. mensuels atteints</p>
          <p className="text-white font-semibold">{monthGoalsMet}/{data.monthsElapsed}</p>
        </div>
        <div className="bg-slate-800/30 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[11px] text-slate-500 mb-0.5">Reste à réaliser</p>
          <p className="text-white font-semibold">{formatCurrency(remaining)}</p>
        </div>
        <div className="bg-slate-800/30 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[11px] text-slate-500 mb-0.5">Nécessaire / mois</p>
          <p className={`font-semibold ${neededPerMonth > data.monthlyGoal * 1.5 ? 'text-red-400' : 'text-white'}`}>
            {monthsLeft > 0 ? formatCurrency(neededPerMonth) : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── MRR Breakdown ──────────────────────────────────────────────────────────────

function MRRBreakdown({ mrrByType, mrrDetails, totalMRR, count }: {
  mrrByType: Record<string, number>; mrrDetails: MRRDetail[]; totalMRR: number; count: number
}) {
  const types = Object.entries(mrrByType).sort((a, b) => b[1] - a[1])
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">Revenus récurrents (MRR)</h3>
        <span className="text-slate-500 text-xs">{count} contrats actifs</span>
      </div>
      <div className="space-y-3">
        {types.map(([type, amount]) => {
          const pct = totalMRR > 0 ? Math.round((amount / totalMRR) * 100) : 0
          const details = mrrDetails.filter(d => d.type === type).sort((a, b) => b.monthly - a.monthly)
          const isExpanded = expanded === type
          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : type)}>
                <span className="text-slate-300 text-sm">{MRR_TYPE_LABELS[type] || type}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{pct}%</span>
                  <span className="text-white text-sm font-medium">{formatCurrency(amount)}/mois</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: MRR_TYPE_COLORS[type] || '#E14B89' }} />
              </div>
              {isExpanded && details.length > 0 && (
                <div className="mt-2 ml-2 space-y-1 border-l border-slate-800 pl-3">
                  {details.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{d.clientName}</span>
                      <span className="text-slate-300">
                        {formatCurrency(d.priceHT)} HT{BILLING_LABELS[d.billing]}
                        {d.billing !== 'MENSUEL' && <span className="text-slate-500 ml-1">({formatCurrency(d.monthly)}/mois)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-slate-400 text-sm">MRR Total HT</span>
        <span className="text-[#E14B89] font-bold text-lg">{formatCurrency(totalMRR)}</span>
      </div>
      <p className="text-slate-500 text-[11px] mt-1 text-right">ARR: {formatCurrency(totalMRR * 12)}</p>
    </div>
  )
}

// ─── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string; trend?: { value: number; label: string }
}) {
  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-xs">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <div className="flex items-center justify-between mt-1">
        {sub && <p className="text-slate-500 text-[11px]">{sub}</p>}
        {trend && (
          <div className={`flex items-center gap-0.5 text-[11px] ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend.value >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Month Detail View ──────────────────────────────────────────────────────────

function MonthDetailView({ data, month, expenses, totalExpenses, onGoalUpdate, selectedIdx }: {
  data: FinanceData; month: MonthData; expenses: Expense[]; totalExpenses: number; onGoalUpdate: (goal: number) => void; selectedIdx: number
}) {
  const goalDiff = month.totalHT - data.monthlyGoal
  const goalPct = data.monthlyGoal > 0 ? Math.min(Math.round((month.totalHT / data.monthlyGoal) * 100), 150) : 0
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState(String(data.monthlyGoal))

  // Previous month for comparison (one index before in rolling 12)
  const prevMonth = selectedIdx > 0 ? data.months[selectedIdx - 1] : null
  const prevCA = prevMonth?.totalHT ?? 0
  const caPct = prevCA > 0 ? Math.round(((month.totalHT - prevCA) / prevCA) * 100) : null

  // N-1 comparison
  const n1CA = month.prevYearTotalHT
  const n1Pct = n1CA > 0 ? Math.round(((month.totalHT - n1CA) / n1CA) * 100) : null

  return (
    <div className="space-y-6">
      {/* Month KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="CA du mois HT" value={formatCurrency(month.totalHT)}
          sub={`Récurrent ${formatCurrency(month.maintenanceHT)} + One-shot ${formatCurrency(month.projectHT)}`}
          icon={DollarSign} color="bg-green-400/10 text-green-400"
          trend={n1Pct !== null ? { value: n1Pct, label: 'vs N-1' } : caPct !== null ? { value: caPct, label: 'vs mois préc.' } : undefined} />
        {(() => {
          const monthCosts = totalExpenses + month.freelanceCosts
          const monthNet = month.totalHT - monthCosts
          const monthMargin = month.totalHT > 0 ? Math.round((monthNet / month.totalHT) * 100) : 0
          const prevCosts = prevMonth ? totalExpenses + prevMonth.freelanceCosts : 0
          const prevNet = prevMonth ? prevMonth.totalHT - prevCosts : 0
          const netPct = prevNet !== 0 ? Math.round(((monthNet - prevNet) / Math.abs(prevNet)) * 100) : null
          return (
            <KpiCard label="Bénéfice net HT" value={formatCurrency(monthNet)}
              sub={`Marge : ${monthMargin}%`}
              icon={TrendingUp} color={monthNet >= 0 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}
              trend={netPct !== null ? { value: netPct, label: 'vs mois préc.' } : undefined} />
          )
        })()}
        {(() => {
          const recurringExp = expenses.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0)
          const oneTimeExp = expenses.filter(e => !e.recurring).reduce((s, e) => s + e.amount, 0)
          const currentCosts = totalExpenses + month.freelanceCosts
          const prevCosts = prevMonth ? totalExpenses + prevMonth.freelanceCosts : 0
          const costsPct = prevCosts > 0 ? Math.round(((currentCosts - prevCosts) / prevCosts) * 100) : null
          return (
            <KpiCard label="Charges totales" value={formatCurrency(currentCosts)}
              sub={`Fixes ${formatCurrency(recurringExp)}${oneTimeExp > 0 ? ` · Ponctuelles ${formatCurrency(oneTimeExp)}` : ''} · Freelances ${formatCurrency(month.freelanceCosts)}`}
              icon={TrendingDown} color="bg-red-400/10 text-red-400"
              trend={costsPct !== null ? { value: costsPct, label: 'vs mois préc.' } : undefined} />
          )
        })()}
      </div>

      {/* Goal progress for this month */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Objectif mensuel</h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${goalDiff >= 0 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
              {goalDiff >= 0 ? 'Atteint !' : `${goalPct}%`}
            </span>
            <button onClick={() => { setEditingGoal(!editingGoal); setGoalInput(String(data.monthlyGoal)) }}
              className="p-1 text-slate-600 hover:text-white transition-colors"><Pencil size={12} /></button>
          </div>
        </div>
        {editingGoal && (
          <div className="flex items-center gap-2 mb-3">
            <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
              className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
            <button onClick={() => { onGoalUpdate(parseFloat(goalInput)); setEditingGoal(false) }}
              className="bg-[#E14B89] hover:opacity-90 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">OK</button>
          </div>
        )}
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-400">CA réalisé</span>
          <span className="text-white font-medium">{formatCurrency(month.totalHT)} / {formatCurrency(data.monthlyGoal)}</span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${Math.min(goalPct, 100)}%`,
            background: goalDiff >= 0 ? '#34d399' : 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)',
          }} />
        </div>
        <p className={`text-xs mt-2 ${goalDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {goalDiff >= 0 ? `+${formatCurrency(goalDiff)} au-dessus de l'objectif` : `${formatCurrency(Math.abs(goalDiff))} en dessous de l'objectif`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Projects signed this month */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Zap size={14} className="text-[#F8903C]" /> Projets signés ce mois-ci
          </h3>
          {month.projects.length === 0 ? (
            <p className="text-slate-500 text-sm">Aucun projet signé ce mois-ci</p>
          ) : (
            <div className="space-y-2">
              {month.projects.map((p, i) => (
                <Link key={i} href={p.type === 'project' ? `/projects/${p.id}` : '/small-projects'}
                  className="flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/50 rounded-xl px-4 py-3 transition-colors group">
                  <div>
                    <p className="text-white text-sm group-hover:text-[#E14B89] transition-colors">{p.name}</p>
                    <p className="text-slate-500 text-xs">{p.client} · {p.type === 'project' ? 'Projet' : 'Petit projet'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#F8903C] font-semibold">{formatCurrency(p.price ?? 0)}</span>
                    {p.costs > 0 && (
                      <p className="text-red-400/70 text-xs">- {formatCurrency(p.costs)} coûts</p>
                    )}
                    {p.pendingCosts > 0 && (
                      <p className="text-amber-400/60 text-xs">~ {formatCurrency(p.pendingCosts)} en attente</p>
                    )}
                  </div>
                </Link>
              ))}
              {(() => {
                const totalPending = month.projects.reduce((s, p) => s + (p.pendingCosts || 0), 0)
                return (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-slate-400 text-sm">Total one-shot</span>
                    <div className="text-right">
                      <span className="text-[#F8903C] font-bold">{formatCurrency(month.projectHT)}</span>
                      {month.freelanceCosts > 0 && (
                        <p className="text-red-400/70 text-xs">- {formatCurrency(month.freelanceCosts)} coûts validés</p>
                      )}
                      {totalPending > 0 && (
                        <p className="text-amber-400/60 text-xs">~ {formatCurrency(totalPending)} en attente</p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* Devis envoyés en attente (prospects + quotes) */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Send size={14} className="text-blue-400" /> Devis envoyés en attente
            <span className="ml-auto text-blue-400 text-xs font-medium">
              {formatCurrency(
                (data.devisEnvoyeProspects?.reduce((s, p) => s + (p.budget ?? 0), 0) || 0) +
                (data.devisEnvoyeQuotes?.reduce((s, q) => s + q.totalHT, 0) || 0)
              )} potentiel
            </span>
          </h3>
          {(!data.devisEnvoyeProspects?.length && !data.devisEnvoyeQuotes?.length) ? (
            <p className="text-slate-500 text-sm">Aucun devis en attente</p>
          ) : (
            <div className="space-y-2">
              {/* Prospects with DEVIS_ENVOYE */}
              {data.devisEnvoyeProspects?.map(p => (
                <Link key={`p-${p.id}`} href="/commercial"
                  className="flex items-center justify-between bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 rounded-xl px-4 py-3 transition-colors group">
                  <div>
                    <p className="text-white text-sm group-hover:text-blue-400 transition-colors">{p.name}</p>
                    <p className="text-slate-500 text-xs">{p.company || 'Prospect'}</p>
                  </div>
                  {p.budget ? (
                    <span className="text-blue-400 font-semibold">{formatCurrency(p.budget)}</span>
                  ) : (
                    <span className="text-slate-600 text-sm">—</span>
                  )}
                </Link>
              ))}
              {/* Quotes with ENVOYE */}
              {data.devisEnvoyeQuotes?.map(q => (
                <Link key={`q-${q.id}`} href="/devis"
                  className="flex items-center justify-between bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 rounded-xl px-4 py-3 transition-colors group">
                  <div>
                    <p className="text-white text-sm group-hover:text-blue-400 transition-colors">{q.clientName}</p>
                    <p className="text-slate-500 text-xs">Devis {q.number}</p>
                  </div>
                  <span className="text-blue-400 font-semibold">{formatCurrency(q.totalHT)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comparison with prev year */}
      {month.prevYearTotalHT > 0 && (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-3">Comparaison N-1</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-slate-400 text-xs mb-1">Ce mois ({month.year})</p>
              <p className="text-white font-bold text-lg">{formatCurrency(month.totalHT)}</p>
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-xs mb-1">Même mois ({month.year - 1})</p>
              <p className="text-slate-300 font-bold text-lg">{formatCurrency(month.prevYearTotalHT)}</p>
            </div>
            <div className="flex-1 text-right">
              {(() => {
                const diff = month.totalHT - month.prevYearTotalHT
                const pct = month.prevYearTotalHT > 0 ? Math.round((diff / month.prevYearTotalHT) * 100) : 0
                return (
                  <div className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                    <p className="font-bold text-lg">{diff >= 0 ? '+' : ''}{pct}%</p>
                    <p className="text-xs">{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page Component ─────────────────────────────────────────────────────────────

export default function FinancesPage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(11) // index in rolling 12 months (11 = current month)
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
  const [tab, setTab] = useState<'overview' | 'recurrent' | 'ponctuel'>('overview')
  const [ponctuelViewMode, setPonctuelViewMode] = useState<'month' | 'year'>('month')
  const [selectedPonctuelMonth, setSelectedPonctuelMonth] = useState(new Date().getMonth() + 1)

  // Expense modal
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Expense | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>(emptyForm)

  function fetchData() {
    setLoading(true)
    Promise.all([
      fetch(`/api/finances?view=${viewMode}`).then(r => r.json()),
      fetch('/api/expenses').then(r => r.json()),
      fetch('/api/maintenances').then(r => r.json()),
    ]).then(([d, e, m]) => {
      setData(d)
      setExpenses([...e].sort((a: Expense, b: Expense) => b.amount - a.amount))
      setMaintenances(m)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  function refreshData() {
    fetch(`/api/finances?view=${viewMode}`).then(r => r.json()).then(d => setData(d))
  }
  usePolling(refreshData)

  function toMonthly(m: Maintenance): number {
    const price = m.priceHT ?? 0
    if (m.billing === 'ANNUEL') return price / 12
    if (m.billing === 'TRIMESTRIEL') return price / 3
    return price
  }

  const maintenanceIncome = useMemo(() =>
    ['WEB', 'GOOGLE', 'RESEAUX', 'BLOG'].map(type => ({
      type, label: MRR_TYPE_LABELS[type],
      total: maintenances.filter(m => m.type === type && m.active).reduce((s, m) => s + toMonthly(m), 0),
      count: maintenances.filter(m => m.type === type && m.active).length,
    })), [maintenances])

  const totalMaintenanceMonthly = maintenanceIncome.reduce((s, m) => s + m.total, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // Expense CRUD
  function openModal(item?: Expense) {
    if (item) {
      const isCustom = !Object.keys(EXPENSE_CATEGORY_LABELS).includes(item.category)
      setEditItem(item); setForm({
        ...item, amount: item.amount.toString(), customCategory: isCustom ? 'true' : '',
        expenseMonth: item.expenseMonth ? String(item.expenseMonth) : String(new Date().getMonth() + 1),
        expenseYear: item.expenseYear ? String(item.expenseYear) : String(new Date().getFullYear()),
      })
    } else { setEditItem(null); setForm({ ...emptyForm }) }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { customCategory, id, ...rest } = form as Record<string, unknown>
    const isRecurring = rest.recurring as boolean
    const payload = {
      name: rest.name, amount: parseFloat(form.amount as string), category: rest.category, recurring: isRecurring, notes: rest.notes,
      expenseMonth: !isRecurring ? parseInt(form.expenseMonth as string) : null,
      expenseYear: !isRecurring ? parseInt(form.expenseYear as string) : null,
    }
    if (editItem) {
      const res = await fetch(`/api/expenses/${editItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const updated = await res.json()
      setExpenses(prev => prev.map(e => e.id === editItem.id ? updated : e).sort((a, b) => b.amount - a.amount))
    } else {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const created = await res.json()
      setExpenses(prev => [...prev, created].sort((a, b) => b.amount - a.amount))
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette dépense ?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  async function handleGoalUpdate(goal: number) {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'monthlyGoal', value: String(goal) }),
    })
    fetchData()
  }

  const byCategory = Object.entries(
    expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  const yoyChange = data && data.prevYearTotalHT > 0 ? Math.round(((data.totalCAHT - data.prevYearTotalHT) / data.prevYearTotalHT) * 100) : null

  // Selected month from rolling 12 array
  const selectedMonthData = data?.months[selectedIdx]
  const selectedLabel = selectedMonthData ? `${MONTH_FULL[selectedMonthData.month - 1]} ${selectedMonthData.year}` : ''

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Finances</h1>
          <p className="text-slate-400 text-sm mt-1">
            Dashboard financier{tab === 'overview' ? ` — ${viewMode === 'month' ? selectedLabel : new Date().getFullYear()}` : tab === 'recurrent' ? ' — Récurrent' : ' — Ponctuel'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* 1. Month navigator (leftmost) */}
          {tab === 'overview' && viewMode === 'month' && (
            <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl">
              <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))} disabled={selectedIdx === 0}
                className="p-2 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-white text-sm font-medium px-2 min-w-[120px] text-center">{selectedLabel}</span>
              <button onClick={() => setSelectedIdx(i => Math.min(11, i + 1))} disabled={selectedIdx === 11}
                className="p-2 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
            </div>
          )}
          {tab === 'ponctuel' && ponctuelViewMode === 'month' && (
            <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl">
              <button onClick={() => setSelectedPonctuelMonth(m => Math.max(1, m - 1))} disabled={selectedPonctuelMonth <= 1}
                className="p-2 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-white text-sm font-medium px-2 min-w-[120px] text-center">{MONTH_FULL[selectedPonctuelMonth - 1]} {new Date().getFullYear()}</span>
              <button onClick={() => setSelectedPonctuelMonth(m => Math.min(12, m + 1))} disabled={selectedPonctuelMonth >= 12}
                className="p-2 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
            </div>
          )}

          {/* 2. Mois/2026 toggle */}
          {tab === 'overview' && (
            <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
              <button onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
                <Calendar size={13} /> Mois
              </button>
              <button onClick={() => setViewMode('year')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'year' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
                <CalendarDays size={13} /> {new Date().getFullYear()}
              </button>
            </div>
          )}
          {tab === 'ponctuel' && (
            <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
              <button onClick={() => setPonctuelViewMode('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ponctuelViewMode === 'month' ? 'bg-amber-400/10 text-amber-400' : 'text-slate-400 hover:text-white'}`}>
                <Calendar size={13} /> Mois
              </button>
              <button onClick={() => setPonctuelViewMode('year')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ponctuelViewMode === 'year' ? 'bg-amber-400/10 text-amber-400' : 'text-slate-400 hover:text-white'}`}>
                <CalendarDays size={13} /> {new Date().getFullYear()}
              </button>
            </div>
          )}

          {/* 3. Tabs (rightmost) */}
          <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
            <button onClick={() => setTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'overview' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
              <BarChart3 size={13} /> Vue d&apos;ensemble
            </button>
            <button onClick={() => setTab('recurrent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'recurrent' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
              <Receipt size={13} /> Récurrent
            </button>
            <button onClick={() => setTab('ponctuel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'ponctuel' ? 'bg-amber-400/10 text-amber-400' : 'text-slate-400 hover:text-white'}`}>
              <Zap size={13} /> Ponctuel
            </button>
          </div>
        </div>
      </div>

      {loading || !data ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <>
          {/* ════════════════════ TAB: VUE D'ENSEMBLE ════════════════════ */}
          {tab === 'overview' && (
            <>
              {viewMode === 'month' ? (
                <div className="space-y-6">
                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <RevenueChart months={data.months} monthlyGoal={data.monthlyGoal}
                      selectedIdx={selectedIdx} onSelectIdx={setSelectedIdx}
                      title="CA Total vs Objectif vs Charges"
                      curveKeys={['total', 'objectif', 'charges']}
                      totalExpenses={totalExpenses} />
                    <RevenueChart months={data.months} monthlyGoal={data.monthlyGoal}
                      selectedIdx={selectedIdx} onSelectIdx={setSelectedIdx}
                      title="Récurrent vs One-shot"
                      curveKeys={['recurrent', 'oneshot']} />
                  </div>

                  {/* Month detail */}
                  <MonthDetailView data={data} month={data.months[selectedIdx]} expenses={expenses} totalExpenses={totalExpenses} onGoalUpdate={handleGoalUpdate} selectedIdx={selectedIdx} />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Charts first — same position as month view */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <RevenueChart months={data.months} monthlyGoal={data.monthlyGoal}
                      title="CA Total vs Objectif vs Charges"
                      curveKeys={['total', 'objectif', 'charges']}
                      totalExpenses={totalExpenses} />
                    <RevenueChart months={data.months} monthlyGoal={data.monthlyGoal}
                      title="Récurrent vs One-shot"
                      curveKeys={['recurrent', 'oneshot']} />
                  </div>

                  {/* KPIs — calculated from 2026 months only */}
                  {(() => {
                    const currentYear = new Date().getFullYear()
                    const yearMonths = data.months.filter(m => m.year === currentYear)
                    const yearCA = yearMonths.reduce((s, m) => s + m.totalHT, 0)
                    const yearMaintenance = yearMonths.reduce((s, m) => s + m.maintenanceHT, 0)
                    const yearProject = yearMonths.reduce((s, m) => s + m.projectHT, 0)
                    const yearFreelance = yearMonths.reduce((s, m) => s + m.freelanceCosts, 0)
                    const yearRecurringExp = expenses.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0) * yearMonths.length
                    const yearPonctuelExp = expenses.filter(e => !e.recurring && (e.expenseYear || currentYear) === currentYear).reduce((s, e) => s + e.amount, 0)
                    const yearTotalCosts = yearRecurringExp + yearPonctuelExp + yearFreelance
                    const yearNet = yearCA - yearTotalCosts
                    const yearMargin = yearCA > 0 ? Math.round((yearNet / yearCA) * 100) : 0
                    const yearRecPct = yearCA > 0 ? Math.round((yearMaintenance / yearCA) * 100) : 0
                    const yearOnePct = yearCA > 0 ? Math.round((yearProject / yearCA) * 100) : 0
                    const yearPrevCA = yearMonths.reduce((s, m) => s + m.prevYearTotalHT, 0)
                    const yearYoyPct = yearPrevCA > 0 ? Math.round(((yearCA - yearPrevCA) / yearPrevCA) * 100) : null

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <KpiCard label={`CA ${currentYear} HT`} value={formatCurrency(yearCA)}
                            sub={`Récurrent ${formatCurrency(yearMaintenance)} · One-shot ${formatCurrency(yearProject)}`}
                            icon={DollarSign} color="bg-green-400/10 text-green-400"
                            trend={yearYoyPct !== null ? { value: yearYoyPct, label: 'vs N-1' } : undefined} />
                          <KpiCard label="Bénéfice net HT" value={formatCurrency(yearNet)}
                            sub={`Marge : ${yearMargin}% · Freelances ${formatCurrency(yearFreelance)}`}
                            icon={TrendingUp} color={yearNet >= 0 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'} />
                          <KpiCard label="Charges totales" value={formatCurrency(yearTotalCosts)}
                            sub={`Fixes ${formatCurrency(yearRecurringExp)} · Ponctuelles ${formatCurrency(yearPonctuelExp)} · Freelances ${formatCurrency(yearFreelance)}`}
                            icon={TrendingDown} color="bg-red-400/10 text-red-400" />
                        </div>

                        {/* Goal + Donut */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <GoalProgress data={{ ...data, totalCAHT: yearCA, monthsElapsed: yearMonths.length, goalProgress: data.proRataGoal > 0 ? Math.round((yearCA / (data.monthlyGoal * yearMonths.length)) * 100) : 0 }} />
                          <DonutChart recurrentPct={yearRecPct} oneShotPct={yearOnePct}
                            recurrentHT={yearMaintenance} oneShotHT={yearProject} />
                        </div>
                      </>
                    )
                  })()}

                  {/* Monthly detail table */}
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800">
                      <h3 className="text-white font-semibold text-sm">Détail mensuel {new Date().getFullYear()} HT</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="text-left px-4 py-2.5 text-slate-500 text-xs font-medium">Mois</th>
                            <th className="text-right px-4 py-2.5 text-slate-500 text-xs font-medium">Récurrent</th>
                            <th className="text-right px-4 py-2.5 text-slate-500 text-xs font-medium">One-shot</th>
                            <th className="text-right px-4 py-2.5 text-slate-500 text-xs font-medium">Total</th>
                            <th className="text-right px-4 py-2.5 text-slate-500 text-xs font-medium">vs Objectif</th>
                            <th className="text-right px-4 py-2.5 text-slate-500 text-xs font-medium">N-1</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.months.filter(m => m.year === new Date().getFullYear()).map((m, i) => {
                            const goalDiff = m.totalHT - data.monthlyGoal
                            return (
                              <tr key={i} className="border-b border-slate-800/30">
                                <td className="px-4 py-2.5 text-white">{MONTH_FULL[m.month - 1]} {m.year}</td>
                                <td className="px-4 py-2.5 text-right text-[#E14B89]">
                                  {formatCurrency(m.maintenanceHT)}
                                  {m.maintenanceEstimated && <span className="text-slate-600 text-[10px] ml-1">est.</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[#F8903C]">{formatCurrency(m.projectHT)}</td>
                                <td className="px-4 py-2.5 text-right text-white font-medium">{formatCurrency(m.totalHT)}</td>
                                <td className={`px-4 py-2.5 text-right text-xs ${goalDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {(goalDiff >= 0 ? '+' : '') + formatCurrency(goalDiff)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-500">{m.prevYearTotalHT > 0 ? formatCurrency(m.prevYearTotalHT) : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-700 bg-slate-800/20">
                            <td className="px-4 py-3 text-white font-semibold">Total</td>
                            <td className="px-4 py-3 text-right text-[#E14B89] font-semibold">{formatCurrency(data.totalMaintenanceHT)}</td>
                            <td className="px-4 py-3 text-right text-[#F8903C] font-semibold">{formatCurrency(data.totalProjectHT)}</td>
                            <td className="px-4 py-3 text-right text-white font-bold">{formatCurrency(data.totalCAHT)}</td>
                            <td className="px-4 py-3 text-right" />
                            <td className="px-4 py-3 text-right text-slate-400">{data.prevYearTotalHT > 0 ? formatCurrency(data.prevYearTotalHT) : '—'}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════════════ TAB: ENTRÉES / SORTIES ════════════════════ */}
          {tab === 'recurrent' && (() => {
            const recurringOnly = expenses.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0)
            return (
            <div className="space-y-6">
              {/* Summary bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 text-center">
                  <p className="text-slate-400 text-xs mb-1">Entrées mensuelles TTC</p>
                  <p className="text-green-400 text-lg sm:text-xl font-bold">{formatCurrency(totalMaintenanceMonthly * 1.2)}</p>
                </div>
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 text-center">
                  <p className="text-slate-400 text-xs mb-1">Charges fixes mensuelles</p>
                  <p className="text-red-400 text-lg sm:text-xl font-bold">{formatCurrency(recurringOnly)}</p>
                </div>
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 text-center">
                  <p className="text-slate-400 text-xs mb-1">Résultat mensuel net</p>
                  <p className={`text-xl font-bold ${totalMaintenanceMonthly * 1.2 - recurringOnly >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(totalMaintenanceMonthly * 1.2 - recurringOnly)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Entrées ─── */}
                <div>
                  <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-green-400" /> Entrées TTC (mensuel)
                  </h2>
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden mb-4">
                    {maintenanceIncome.map((m, i) => (
                      <div key={m.type} className={`flex items-center justify-between px-5 py-4 ${i < maintenanceIncome.length - 1 ? 'border-b border-slate-800/60' : ''}`}>
                        <div>
                          <p className="text-white text-sm font-medium">{m.label}</p>
                          <p className="text-slate-500 text-xs">{m.count} contrats actifs</p>
                        </div>
                        <span className="text-green-400 font-semibold">{formatCurrency(m.total * 1.2)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700 bg-slate-800/30">
                      <span className="text-white font-semibold">Total entrées TTC</span>
                      <span className="text-green-400 font-bold text-lg">{formatCurrency(totalMaintenanceMonthly * 1.2)}</span>
                    </div>
                  </div>

                  {/* Expense category breakdown */}
                  <h3 className="text-slate-400 text-sm font-medium mb-3 flex items-center gap-2">
                    <PieChart size={14} /> Répartition des dépenses
                  </h3>
                  <div className="space-y-2">
                    {byCategory.map(([cat, amount]) => {
                      const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
                      return (
                        <div key={cat} className="bg-[#111118] border border-slate-800 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${EXPENSE_CATEGORY_COLORS[cat] || 'bg-slate-400/10 text-slate-400'}`}>
                              {EXPENSE_CATEGORY_LABELS[cat] || cat}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 text-xs">{pct}%</span>
                              <span className="text-white text-sm font-medium">{formatCurrency(amount)}</span>
                            </div>
                          </div>
                          <div className="w-full h-1 bg-slate-800 rounded-full">
                            <div className="h-full bg-[#E14B89] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ─── Charges fixes ─── */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                      <TrendingDown size={16} className="text-red-400" /> Charges fixes
                    </h2>
                    <button onClick={() => { setForm({ ...emptyForm, recurring: true }); setEditItem(null); setShowModal(true) }}
                      className="flex items-center gap-1.5 bg-[#E14B89] hover:opacity-90 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors">
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                    {expenses.filter(e => e.recurring).length === 0 ? (
                      <div className="px-5 py-8 text-center text-slate-500 text-sm">Aucune charge fixe</div>
                    ) : (
                      <>
                        {expenses.filter(e => e.recurring).map((expense, i, arr) => (
                          <div key={expense.id}
                            className={`flex items-center gap-3 px-5 py-3.5 group hover:bg-slate-800/20 transition-colors ${i < arr.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm">{expense.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${EXPENSE_CATEGORY_COLORS[expense.category] || 'bg-slate-400/10 text-slate-400'}`}>
                                {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                              </span>
                            </div>
                            <span className="text-red-400 font-medium text-sm">{formatCurrency(expense.amount)}</span>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openModal(expense)} className="p-1.5 text-slate-600 hover:text-white transition-colors"><Pencil size={12} /></button>
                              <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700 bg-slate-800/30">
                          <span className="text-white font-semibold">Total charges fixes</span>
                          <span className="text-red-400 font-bold">{formatCurrency(expenses.filter(e => e.recurring).reduce((s, e) => s + e.amount, 0))}</span>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            </div>
            )
          })()}

          {/* ════════════════════ TAB: PONCTUEL ════════════════════ */}
          {tab === 'ponctuel' && (() => {
            const curYear = new Date().getFullYear()
            const filteredPonctuel = expenses.filter(e => {
              if (e.recurring) return false
              if (ponctuelViewMode === 'year') return (e.expenseYear || curYear) === curYear
              return (e.expenseMonth || selectedPonctuelMonth) === selectedPonctuelMonth && (e.expenseYear || curYear) === curYear
            })
            const totalFiltered = filteredPonctuel.reduce((s, e) => s + e.amount, 0)

            return (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 text-center">
                  <p className="text-slate-400 text-xs mb-1">Total dépenses ponctuelles</p>
                  <p className="text-amber-400 text-xl font-bold">{formatCurrency(totalFiltered)}</p>
                </div>
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 text-center">
                  <p className="text-slate-400 text-xs mb-1">Nombre de dépenses</p>
                  <p className="text-white text-xl font-bold">{filteredPonctuel.length}</p>
                </div>
              </div>

              {/* Liste des dépenses ponctuelles */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" /> Dépenses ponctuelles
                  </h2>
                  <button onClick={() => { setForm({ ...emptyForm, recurring: false, expenseMonth: String(selectedPonctuelMonth), expenseYear: String(curYear) }); setEditItem(null); setShowModal(true) }}
                    className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-3 py-2 rounded-xl text-xs font-medium transition-colors border border-amber-500/30">
                    <Plus size={14} /> Ajouter
                  </button>
                </div>
                <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                  {filteredPonctuel.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-500 text-sm">Aucune dépense ponctuelle{ponctuelViewMode === 'month' ? ` en ${MONTH_FULL[selectedPonctuelMonth - 1]}` : ` en ${curYear}`}</div>
                  ) : (
                    <>
                      {filteredPonctuel.map((expense, i, arr) => (
                        <div key={expense.id}
                          className={`flex items-center gap-3 px-5 py-3.5 group hover:bg-slate-800/20 transition-colors ${i < arr.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white text-sm">{expense.name}</p>
                              {expense.expenseMonth && expense.expenseYear && (
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                  {MONTH_NAMES[expense.expenseMonth - 1]} {expense.expenseYear}
                                </span>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${EXPENSE_CATEGORY_COLORS[expense.category] || 'bg-slate-400/10 text-slate-400'}`}>
                              {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                            </span>
                            {expense.notes && <p className="text-slate-600 text-xs mt-0.5">{expense.notes}</p>}
                          </div>
                          <span className="text-amber-400 font-medium text-sm">{formatCurrency(expense.amount)}</span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openModal(expense)} className="p-1.5 text-slate-600 hover:text-white transition-colors"><Pencil size={12} /></button>
                            <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700 bg-slate-800/30">
                        <span className="text-white font-semibold">Total ponctuelles</span>
                        <span className="text-amber-400 font-bold">{formatCurrency(totalFiltered)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            )
          })()}
        </>
      )}

      {/* ═══ EXPENSE MODAL ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">{editItem ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom *</label>
                <input required value={form.name as string} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Adobe Photoshop"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Montant (€) *</label>
                  <input type="number" step="0.01" required value={form.amount as string} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Catégorie</label>
                  <select value={Object.keys(EXPENSE_CATEGORY_LABELS).includes(form.category as string) ? form.category as string : '__CUSTOM__'}
                    onChange={e => {
                      if (e.target.value === '__CUSTOM__') setForm({ ...form, category: '', customCategory: 'true' })
                      else setForm({ ...form, category: e.target.value, customCategory: '' })
                    }}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    <option value="__CUSTOM__">+ Personnalisé</option>
                  </select>
                  {(form.customCategory === 'true' || (!Object.keys(EXPENSE_CATEGORY_LABELS).includes(form.category as string) && (form.category as string) !== '')) && (
                    <input value={form.category as string} onChange={e => setForm({ ...form, category: e.target.value.toUpperCase().replace(/\s+/g, '_'), customCategory: 'true' })}
                      placeholder="Ex: TRANSPORT"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors mt-2" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring" checked={form.recurring as boolean} onChange={e => setForm({ ...form, recurring: e.target.checked })}
                  className="accent-[#E14B89]" />
                <label htmlFor="recurring" className="text-slate-400 text-sm">Dépense récurrente (mensuelle)</label>
              </div>
              {!form.recurring && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Mois</label>
                    <select value={form.expenseMonth as string} onChange={e => setForm({ ...form, expenseMonth: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                      {MONTH_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Année</label>
                    <select value={form.expenseYear as string} onChange={e => setForm({ ...form, expenseYear: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                      {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <input value={form.notes as string} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {editItem ? 'Sauvegarder' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
