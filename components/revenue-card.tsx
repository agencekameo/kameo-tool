'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, ArrowRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

export function RevenueCard() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [filter, setFilter] = useState(`${currentYear}-${currentMonth}`)
  const [revenue, setRevenue] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function fetchRevenue() {
      const [year, month] = filter.split('-')
      const params = new URLSearchParams({ year })
      if (month !== '0') params.set('month', month)
      const res = await fetch(`/api/dashboard/revenue?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRevenue(data.revenue)
      }
    }
    fetchRevenue()
  }, [filter])

  const options = [
    { value: `${currentYear}-0`, label: `Année ${currentYear}` },
    ...MONTH_LABELS.map((label, i) => ({
      value: `${currentYear}-${i + 1}`,
      label: label,
    })),
  ]

  const selectedLabel = (() => {
    const [, month] = filter.split('-')
    if (month === '0') return `${currentYear}`
    return MONTH_LABELS[parseInt(month, 10) - 1]
  })()

  return (
    <Link
      href="/projects"
      className="bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group relative"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
          <TrendingUp size={20} className="text-green-400" />
        </div>
        <ArrowRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
      <p className="text-2xl font-semibold text-white">
        {revenue !== null ? formatCurrency(revenue) : '...'}
      </p>
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-slate-400 text-sm">CA {selectedLabel.toLowerCase()}</p>
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(!open)
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            {selectedLabel}
            <ChevronDown size={12} />
          </button>
          {open && (
            <div
              className="absolute right-0 bottom-full mb-1 bg-[#1a1a24] border border-slate-700 rounded-xl shadow-xl z-50 py-1 w-40 max-h-60 overflow-y-auto"
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            >
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setFilter(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    filter === opt.value
                      ? 'text-green-400 bg-green-500/10'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
