'use client'

import { useEffect, useState } from 'react'
import { Loader2, Cpu, Database, MessageCircle, FileText, Search, ChevronDown, Euro, Calendar } from 'lucide-react'

const MONTH_NAMES_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const USD_TO_EUR = 0.92 // Taux approximatif

interface MonthData {
  anthropic: number
  dataforseo: number
  total: number
  details: { service: string; action: string; cost: number; date: string }[]
}

interface CostsData {
  year: number
  months: Record<string, MonthData>
  totals: { total: number; anthropic: number; dataforseo: number }
  counts: { audits: number; redactions: number; chats: number }
  apiStatus?: { anthropic: 'active' | 'no_credits' | 'error' }
}

function eur(usd: number) {
  const val = usd * USD_TO_EUR
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

const ACTION_LABELS: Record<string, string> = {
  'audit-seo': 'Audit SEO',
  'redaction-seo': 'Rédaction SEO',
  'chat': 'KameoBot',
  'scraping': 'Scraping leads',
  'email': 'Envoi email',
}

const SERVICE_ICONS: Record<string, typeof Cpu> = { anthropic: Cpu, dataforseo: Database, audit: Search, redaction: FileText, chat: MessageCircle }
const SERVICE_COLORS: Record<string, string> = { anthropic: 'text-purple-400', dataforseo: 'text-blue-400', audit: 'text-amber-400', redaction: 'text-emerald-400', chat: 'text-[#E14B89]' }

export default function CostsPage() {
  const [data, setData] = useState<CostsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'month' | 'year'>('month')

  useEffect(() => {
    fetch('/api/costs').then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={24} className="animate-spin text-slate-500" /></div>
  if (!data) return <div className="p-8 text-slate-500">Erreur de chargement</div>

  const now = new Date()
  const currentMonthKey = `${data.year}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonth = data.months[currentMonthKey] || { anthropic: 0, dataforseo: 0, total: 0, details: [] }
  const currentMonthName = MONTH_NAMES_FULL[now.getMonth()]

  const maxMonthTotal = Math.max(...Object.values(data.months).map(m => m.total), 0.01)

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E14B89]/10 flex items-center justify-center">
            <Euro size={20} className="text-[#E14B89]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Coûts IA</h1>
            <p className="text-slate-400 text-sm mt-0.5">Suivi des depenses API — {view === 'month' ? `${currentMonthName} ${data.year}` : data.year}</p>
          </div>
        </div>
        <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
          <button onClick={() => setView('month')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${view === 'month' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
            <Calendar size={12} className="inline mr-1.5" />Ce mois
          </button>
          <button onClick={() => setView('year')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${view === 'year' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
            Année {data.year}
          </button>
        </div>
      </div>

      {/* API Status */}
      {data.apiStatus && (
        <div className={`mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border ${
          data.apiStatus.anthropic === 'active' ? 'bg-emerald-500/5 border-emerald-500/20' :
          data.apiStatus.anthropic === 'no_credits' ? 'bg-red-500/5 border-red-500/20' :
          'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            data.apiStatus.anthropic === 'active' ? 'bg-emerald-400' :
            data.apiStatus.anthropic === 'no_credits' ? 'bg-red-400 animate-pulse' :
            'bg-amber-400'
          }`} />
          <span className="text-xs text-slate-300">
            Anthropic : {data.apiStatus.anthropic === 'active' ? 'Actif' : data.apiStatus.anthropic === 'no_credits' ? 'Credits epuises' : 'Erreur de connexion'}
          </span>
          <a href="https://platform.claude.com/settings/billing" target="_blank" rel="noopener noreferrer"
            className="text-[#E14B89] text-xs font-medium hover:underline ml-auto">
            {data.apiStatus.anthropic === 'no_credits' ? 'Recharger →' : 'Voir le solde →'}
          </a>
        </div>
      )}

      {view === 'month' ? (
        <>
          {/* Current month summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <p className="text-slate-500 text-xs mb-2">Total {currentMonthName}</p>
              <p className="text-white text-2xl font-bold">{eur(currentMonth.total)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-1.5 mb-2"><Cpu size={12} className="text-purple-400" /><span className="text-slate-500 text-xs">Anthropic</span></div>
              <p className="text-purple-400 text-xl font-bold">{eur(currentMonth.anthropic)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-1.5 mb-2"><Database size={12} className="text-blue-400" /><span className="text-slate-500 text-xs">DataForSEO</span></div>
              <p className="text-blue-400 text-xl font-bold">{eur(currentMonth.dataforseo)}</p>
            </div>
          </div>

          {/* Current month details */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Detail des operations — {currentMonthName}</h2>
              <span className="text-slate-600 text-xs">{currentMonth.details.length} operation{currentMonth.details.length > 1 ? 's' : ''}</span>
            </div>
            {currentMonth.details.length === 0 ? (
              <div className="py-12 text-center">
                <Euro size={28} className="mx-auto text-slate-700 mb-2" />
                <p className="text-slate-500 text-xs">Aucune depense ce mois-ci</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {currentMonth.details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((d, i) => {
                  const Icon = SERVICE_ICONS[d.service] || Cpu
                  const color = SERVICE_COLORS[d.service] || 'text-slate-400'
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={`w-7 h-7 rounded-lg bg-slate-800/50 flex items-center justify-center ${color}`}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium">{ACTION_LABELS[d.action] || d.action}</p>
                        <p className="text-slate-600 text-[10px] mt-0.5">{d.service === 'audit' || d.service === 'redaction' ? 'Anthropic + DataForSEO' : d.service}</p>
                      </div>
                      <span className="text-white text-xs font-mono font-semibold">{eur(d.cost)}</span>
                      <span className="text-slate-600 text-[10px] w-16 text-right">{new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Year summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <p className="text-slate-500 text-xs mb-2">Total {data.year}</p>
              <p className="text-white text-2xl font-bold">{eur(data.totals.total)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-1.5 mb-2"><Cpu size={12} className="text-purple-400" /><span className="text-slate-500 text-xs">Anthropic</span></div>
              <p className="text-purple-400 text-xl font-bold">{eur(data.totals.anthropic)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-1.5 mb-2"><Database size={12} className="text-blue-400" /><span className="text-slate-500 text-xs">DataForSEO</span></div>
              <p className="text-blue-400 text-xl font-bold">{eur(data.totals.dataforseo)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <p className="text-slate-500 text-xs mb-2">Utilisation</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-white"><span className="text-emerald-400 font-bold">{data.counts.audits}</span> audits</span>
                <span className="text-white"><span className="text-emerald-400 font-bold">{data.counts.redactions}</span> redac.</span>
                <span className="text-white"><span className="text-emerald-400 font-bold">{data.counts.chats}</span> chats</span>
              </div>
            </div>
          </div>

          {/* Year monthly table */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold text-sm">Recap mensuel — {data.year}</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs">
                  <th className="text-left px-5 py-3 font-medium">Mois</th>
                  <th className="text-right px-4 py-3 font-medium">Anthropic</th>
                  <th className="text-right px-4 py-3 font-medium">DataForSEO</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Operations</th>
                  <th className="px-5 py-3 w-[160px]"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.months).map(([key, month]) => {
                  const monthIdx = parseInt(key.split('-')[1]) - 1
                  const barWidth = maxMonthTotal > 0 ? (month.total / maxMonthTotal) * 100 : 0
                  const isCurrent = key === currentMonthKey
                  return (
                    <tr key={key} className={`border-b border-slate-800/50 ${month.total > 0 ? '' : 'opacity-30'} ${isCurrent ? 'bg-[#E14B89]/5' : ''}`}>
                      <td className="px-5 py-3 font-medium text-white text-xs">
                        {MONTH_NAMES_FULL[monthIdx]}
                        {isCurrent && <span className="ml-2 text-[9px] text-[#E14B89] bg-[#E14B89]/10 px-1.5 py-0.5 rounded-full">en cours</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-purple-400 font-mono text-xs">{month.anthropic > 0 ? eur(month.anthropic) : '—'}</td>
                      <td className="px-4 py-3 text-right text-blue-400 font-mono text-xs">{month.dataforseo > 0 ? eur(month.dataforseo) : '—'}</td>
                      <td className="px-4 py-3 text-right text-white font-semibold font-mono text-xs">{month.total > 0 ? eur(month.total) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">{month.details.length || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: 'linear-gradient(135deg, #E14B89, #F8903C)' }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800/30">
                  <td className="px-5 py-3 font-bold text-white text-xs">Total {data.year}</td>
                  <td className="px-4 py-3 text-right text-purple-400 font-bold font-mono text-xs">{eur(data.totals.anthropic)}</td>
                  <td className="px-4 py-3 text-right text-blue-400 font-bold font-mono text-xs">{eur(data.totals.dataforseo)}</td>
                  <td className="px-4 py-3 text-right text-white font-bold font-mono text-xs">{eur(data.totals.total)}</td>
                  <td></td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Cost estimation note */}
      <p className="text-slate-600 text-[10px] mt-4 text-center">
        Conversion USD → EUR au taux fixe de {USD_TO_EUR}. Couts reels Anthropic bases sur les tokens consommes. DataForSEO estime a ~0.30€/audit, ~0.40€/redaction.
      </p>
    </div>
  )
}
