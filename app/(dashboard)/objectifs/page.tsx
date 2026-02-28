'use client'

import { useEffect, useState } from 'react'
import { Target, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

interface MonthData { month: number; ca: number; count: number }
interface ObjectifsData {
  year: number
  annualGoal: number
  monthlyGoal: number
  months: MonthData[]
  totalCA: number
}

function CircleProgress({ value, goal, label, size = 120, primary = false }: {
  value: number; goal: number; label: string; size?: number; primary?: boolean
}) {
  const pct = Math.min(value / goal, 1)
  const strokeW = primary ? 10 : 7
  const radius = (size - strokeW * 2) / 2
  const circumference = 2 * Math.PI * radius
  const dash = pct * circumference
  const color = pct >= 1 ? '#4ade80' : pct >= 0.7 ? '#E14B89' : pct >= 0.4 ? '#fb923c' : '#475569'
  const textSize = primary ? 'text-2xl' : 'text-base'
  const subTextSize = primary ? 'text-sm' : 'text-xs'
  const currentMonth = new Date().getMonth() + 1

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeW} />
          {pct > 0 && (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={color} strokeWidth={strokeW}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold text-white ${textSize}`}>{Math.round(pct * 100)}%</span>
          <span className={`text-slate-500 ${subTextSize}`}>{formatCurrency(value)}</span>
        </div>
      </div>
      <span className="text-slate-300 text-sm font-medium text-center">{label}</span>
      {!primary && <span className="text-slate-600 text-xs">obj. {formatCurrency(goal)}</span>}
    </div>
  )
}

export default function ObjectifsPage() {
  const [data, setData] = useState<ObjectifsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/objectifs').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-slate-500 text-sm">Chargement...</div>
  if (!data) return null

  const annualPct = Math.round((data.totalCA / data.annualGoal) * 100)
  const currentMonth = new Date().getMonth() // 0-indexed
  const monthsElapsed = currentMonth + 1 // months that have started
  const expectedCA = Math.min(monthsElapsed * data.monthlyGoal, data.annualGoal)
  const pace = expectedCA > 0 ? Math.round((data.totalCA / expectedCA) * 100) : 0

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Objectifs {data.year}</h1>
          <p className="text-slate-400 text-sm mt-1">Objectif annuel : {formatCurrency(data.annualGoal)} · {formatCurrency(data.monthlyGoal)} / mois</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${pace >= 100 ? 'bg-green-500/10 text-green-400' : pace >= 80 ? 'bg-orange-500/10 text-orange-400' : 'bg-red-500/10 text-red-400'}`}>
          <TrendingUp size={16} />
          Rythme : {pace}% de l&apos;objectif
        </div>
      </div>

      {/* Objectif annuel - grand cercle central */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8 mb-8 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Target size={16} className="text-[#E14B89]" />
          <span>Progression annuelle</span>
        </div>
        <CircleProgress value={data.totalCA} goal={data.annualGoal} label={`CA ${data.year}`} size={200} primary />
        <div className="grid grid-cols-3 gap-4 sm:gap-8 w-full max-w-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{formatCurrency(data.totalCA)}</p>
            <p className="text-slate-500 text-xs mt-1">CA réalisé</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-400">{formatCurrency(data.annualGoal - data.totalCA)}</p>
            <p className="text-slate-500 text-xs mt-1">Restant</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${annualPct >= 100 ? 'text-green-400' : annualPct >= 70 ? 'text-[#E14B89]' : 'text-orange-400'}`}>{annualPct}%</p>
            <p className="text-slate-500 text-xs mt-1">Atteint</p>
          </div>
        </div>
      </div>

      {/* Grille des 12 mois */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-6">Détail mensuel — objectif 10 000 € / mois</h2>
        <div className="grid grid-cols-4 gap-6 sm:grid-cols-6 lg:grid-cols-12">
          {data.months.map((m, i) => {
            const isPast = i < currentMonth
            const isCurrent = i === currentMonth
            return (
              <div key={m.month} className={`flex flex-col items-center gap-1 ${isCurrent ? 'opacity-100' : isPast ? 'opacity-90' : 'opacity-40'}`}>
                <CircleProgress
                  value={m.ca}
                  goal={data.monthlyGoal}
                  label={isCurrent ? `${MONTH_LABELS[i]} ←` : MONTH_LABELS[i]}
                  size={72}
                />
                <span className="text-slate-600 text-xs">{m.count} fact.</span>
              </div>
            )
          })}
        </div>

        {/* Légende */}
        <div className="flex gap-4 mt-6 pt-6 border-t border-slate-800 flex-wrap">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-400" /><span className="text-slate-400 text-xs">Objectif atteint (≥ 100%)</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#E14B89]" /><span className="text-slate-400 text-xs">En bonne voie (≥ 70%)</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-400" /><span className="text-slate-400 text-xs">En retard (≥ 40%)</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-600" /><span className="text-slate-400 text-xs">Insuffisant (&lt; 40%)</span></div>
        </div>
      </div>
    </div>
  )
}
