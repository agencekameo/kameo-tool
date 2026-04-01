'use client'

import { useState } from 'react'
import { Search, Loader2, Globe, Briefcase, MapPin, Users, FileText, CheckCircle2, ArrowRight, Download, Copy, BarChart3, Target, TrendingUp, Zap, Shield } from 'lucide-react'

const SCORE_COLOR = (score: number) =>
  score >= 75 ? 'text-[#95DB7D]' : score >= 50 ? 'text-[#FF9346]' : 'text-[#FF4040]'
const SCORE_BG = (score: number) =>
  score >= 75 ? 'bg-[#95DB7D]' : score >= 50 ? 'bg-[#FF9346]' : 'bg-[#FF4040]'

interface KWItem { keyword: string; search_volume: number | null; competition: string | null; cpc: number | null }
interface SEOData {
  volumes: KWItem[]
  suggestions: KWItem[]
  serp?: { keyword: string; items: { rank: number; domain: string; title: string }[] }[]
  backlinks?: { domain: string; backlinks: number; referring_domains: number; rank: number } | null
  competitorBacklinks?: { domain: string; backlinks: number; referring_domains: number; rank: number }[]
  clusters?: Record<string, string[]>
  pageSpeed?: { mobile: { performance: number; fcp: number; lcp: number; cls: number; tbt: number } | null; desktop: { performance: number; fcp: number; lcp: number; cls: number; tbt: number } | null }
  scrapedPages?: { url: string; title: string; h1: string; meta: string; content: string }[]
}

type Step = 'form' | 'fetching-keywords' | 'generating' | 'done'

export function AuditPremium() {
  const [form, setForm] = useState({ businessName: '', sector: '', city: '', targetAudience: '', services: '', existingUrl: '', hasExistingSite: false })
  const [step, setStep] = useState<Step>('form')
  const [seoData, setSeoData] = useState<SEOData | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState(0)
  const [auditPhase, setAuditPhase] = useState<'draft' | 'review' | null>(null)

  async function readStream(res: Response, onChunk: (text: string) => void): Promise<string> {
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No reader')
    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.error) throw new Error(parsed.error)
          if (parsed.phase) { setAuditPhase(parsed.phase); continue }
          if (parsed.clear) { full = ''; onChunk(''); continue }
          if (parsed.text) { full += parsed.text; onChunk(full) }
        } catch { /* skip */ }
      }
    }
    return full
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAnalysis('')
    setStep('fetching-keywords')
    setProgress(10)

    try {
      // Step 1: Fetch keywords + DataForSEO (+ scrape site if existing)
      const kwRes = await fetch('/api/audit-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, step: 'keywords' }),
      })
      if (!kwRes.ok) { const err = await kwRes.json(); throw new Error(err.error || 'Erreur extraction') }
      const kwData = await kwRes.json()
      setSeoData(kwData.seoData)
      setProgress(40)

      // Use extracted info from scraping if available
      const info = kwData.extractedInfo || form

      // Step 2: Stream analysis with SEO data
      setStep('generating')
      const seoDataStr = formatSEOForHeader(kwData.seoData)

      const analysisRes = await fetch('/api/audit-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: info.businessName || form.businessName,
          sector: info.sector || form.sector,
          city: info.city || form.city,
          targetAudience: info.targetAudience || form.targetAudience,
          services: info.services || form.services,
          existingUrl: form.existingUrl,
          hasExistingSite: form.hasExistingSite,
          step: 'analyse',
          seoDataStr,
        }),
      })
      if (!analysisRes.ok) throw new Error('Erreur analyse')
      await readStream(analysisRes, text => { setAnalysis(text); setProgress(Math.min(95, 40 + text.length / 200)) })
      setProgress(100)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setStep('form')
    }
  }

  function formatSEOForHeader(data: SEOData): string {
    const p: string[] = ['## DONNÉES SEO RÉELLES\n']
    if (data.volumes.length > 0) {
      p.push('### Volumes — Mots-clés principaux')
      p.push('| Mot-clé | Vol/mois | Concurrence | CPC |')
      p.push('|---------|----------|-------------|-----|')
      for (const k of data.volumes) p.push(`| ${k.keyword} | ${k.search_volume ?? 'N/A'} | ${k.competition || 'N/A'} | ${k.cpc ? k.cpc.toFixed(2) + '€' : 'N/A'} |`)
    }
    if (data.suggestions.length > 0) {
      p.push('\n### Mots-clés associés')
      p.push('| Mot-clé | Vol/mois | Concurrence | CPC |')
      p.push('|---------|----------|-------------|-----|')
      for (const k of data.suggestions.slice(0, 30)) p.push(`| ${k.keyword} | ${k.search_volume ?? 'N/A'} | ${k.competition || 'N/A'} | ${k.cpc ? k.cpc.toFixed(2) + '€' : 'N/A'} |`)
    }
    if (data.serp?.length) {
      p.push('\n### Analyse SERP')
      for (const s of data.serp) { p.push(`\n**"${s.keyword}"** :`); for (const it of s.items) p.push(`${it.rank}. ${it.domain} — "${it.title}"`) }
    }
    if (data.backlinks) {
      p.push(`\n### Backlinks — ${data.backlinks.domain}`)
      p.push(`Backlinks: ${data.backlinks.backlinks} · Domaines ref: ${data.backlinks.referring_domains} · Rank: ${data.backlinks.rank}`)
    }
    if (data.competitorBacklinks?.length) {
      p.push('\n### Backlinks concurrents')
      if (data.backlinks) p.push(`**${data.backlinks.domain} (client)** : ${data.backlinks.backlinks} backlinks, ${data.backlinks.referring_domains} domaines`)
      for (const c of data.competitorBacklinks) p.push(`${c.domain} : ${c.backlinks} backlinks, ${c.referring_domains} domaines, rank ${c.rank}`)
    }
    if (data.pageSpeed?.mobile || data.pageSpeed?.desktop) {
      p.push('\n### PageSpeed')
      if (data.pageSpeed.mobile) p.push(`Mobile: ${data.pageSpeed.mobile.performance}/100 · FCP ${(data.pageSpeed.mobile.fcp/1000).toFixed(1)}s · LCP ${(data.pageSpeed.mobile.lcp/1000).toFixed(1)}s · CLS ${data.pageSpeed.mobile.cls.toFixed(3)} · TBT ${Math.round(data.pageSpeed.mobile.tbt)}ms`)
      if (data.pageSpeed.desktop) p.push(`Desktop: ${data.pageSpeed.desktop.performance}/100 · FCP ${(data.pageSpeed.desktop.fcp/1000).toFixed(1)}s · LCP ${(data.pageSpeed.desktop.lcp/1000).toFixed(1)}s · CLS ${data.pageSpeed.desktop.cls.toFixed(3)} · TBT ${Math.round(data.pageSpeed.desktop.tbt)}ms`)
    }
    if (data.clusters && Object.keys(data.clusters).length > 0) {
      p.push('\n### Clusters mots-clés')
      for (const [name, kws] of Object.entries(data.clusters)) p.push(`**${name}** : ${kws.join(', ')}`)
    }
    if (data.scrapedPages?.length) {
      p.push('\n### Contenu site existant')
      for (const pg of data.scrapedPages.slice(0, 8)) p.push(`\n**${pg.url}**\nTitle: ${pg.title} | H1: ${pg.h1} | Meta: ${pg.meta}\n${pg.content.substring(0, 400)}`)
    }
    return p.join('\n')
  }

  function handleDownload() {
    const blob = new Blob([analysis], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-premium-${form.businessName.replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCopy() {
    navigator.clipboard.writeText(analysis)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function renderMarkdown(md: string) {
    return md.split('\n').map((line, i) => {
      if (line.startsWith('#### ')) return <h4 key={i} className="text-white font-medium text-sm mt-4 mb-1">{line.slice(5)}</h4>
      if (line.startsWith('### ')) return <h3 key={i} className="text-white font-semibold mt-5 mb-2">{line.slice(4)}</h3>
      if (line.startsWith('## ')) return <h2 key={i} className="text-[#E14B89] font-bold text-lg mt-6 mb-3 pb-2 border-b border-slate-800">{line.slice(3)}</h2>
      if (line.startsWith('# ')) return <h1 key={i} className="text-white font-bold text-xl mt-6 mb-3">{line.slice(2)}</h1>
      if (line.startsWith('|')) {
        const cells = line.split('|').filter(c => c.trim())
        if (cells.every(c => /^[\s-:]+$/.test(c))) return null
        const isHeader = i > 0 && md.split('\n')[i + 1]?.match(/^\|[\s-:|]+\|/)
        return (
          <div key={i} className={`grid gap-0 text-xs ${isHeader ? 'font-semibold text-white' : 'text-slate-300'}`}
            style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
            {cells.map((c, j) => (
              <div key={j} className="px-2 py-1.5 border-b border-slate-800/50 truncate">{c.trim()}</div>
            ))}
          </div>
        )
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.slice(2)
        const parts = text.split(/(\*\*[^*]+\*\*)/g)
        return <li key={i} className="text-slate-300 text-sm ml-4 mb-0.5 list-disc">{parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong> : p)}</li>
      }
      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-[#E14B89] pl-3 text-slate-400 text-sm italic my-2">{line.slice(2)}</blockquote>
      if (line.trim() === '') return <div key={i} className="h-2" />
      if (line.startsWith('---')) return <hr key={i} className="border-slate-800 my-6" />
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return <p key={i} className="text-slate-300 text-sm mb-1 leading-relaxed">{parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong> : p)}</p>
    })
  }

  function reset() {
    setStep('form')
    setAnalysis('')
    setSeoData(null)
    setError('')
    setProgress(0)
  }

  const isGenerating = step === 'fetching-keywords' || step === 'generating'

  return (
    <div>
      {/* Form */}
      {step === 'form' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#E14B89]/10 to-[#F8903C]/10 border border-[#E14B89]/20 rounded-2xl p-5 flex items-start gap-3">
            <Shield size={20} className="text-[#E14B89] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">Audit SEO Premium</p>
              <p className="text-slate-400 text-xs mt-0.5">Analyse de marché complète avec données DataForSEO réelles. Étude de mots-clés, analyse concurrentielle, stratégie SEO et plan d&apos;action priorisé.</p>
            </div>
          </div>

          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Existing site toggle — first */}
              <div className="bg-[#0d0d14] border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm font-medium">Site existant à analyser ?</span>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {form.hasExistingSite ? 'Les informations seront extraites automatiquement du site' : 'Remplissez les champs ci-dessous manuellement'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, hasExistingSite: !f.hasExistingSite }))}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.hasExistingSite ? 'bg-[#E14B89]' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.hasExistingSite ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                {form.hasExistingSite && (
                  <div className="mt-3">
                    <div className="relative">
                      <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input required value={form.existingUrl} onChange={e => setForm(f => ({ ...f, existingUrl: e.target.value }))}
                        placeholder="https://www.exemple.com" className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>
                )}
              </div>

              {/* Manual fields — only when no existing site */}
              {!form.hasExistingSite && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5"><Briefcase size={12} /> Nom de l&apos;entreprise *</label>
                      <input required value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                        placeholder="DroneSpec" className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5"><Target size={12} /> Secteur d&apos;activité *</label>
                      <input required value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                        placeholder="Inspection par drone" className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5"><MapPin size={12} /> Ville / Zone</label>
                      <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="Paris, Île-de-France" className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5"><Users size={12} /> Cible</label>
                      <input value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                        placeholder="BTP, collectivités, industriels" className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5"><FileText size={12} /> Services / Produits</label>
                    <input value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))}
                      placeholder="Inspection toiture, cartographie, thermographie..." className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
                  </div>
                </>
              )}

              {error && <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

              <button type="submit"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-3.5 rounded-xl text-sm font-semibold transition-opacity">
                <Zap size={16} /> Lancer l&apos;audit premium
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Progress / Generating */}
      {isGenerating && (
        <div className="space-y-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="text-[#E14B89] animate-spin" />
                <h3 className="text-white font-semibold text-sm">
                  {step === 'fetching-keywords' ? (form.hasExistingSite ? 'Scraping + SERP + backlinks + PageSpeed...' : 'Mots-clés + SERP + backlinks...') : auditPhase === 'review' ? 'Relecture & amélioration (Opus)...' : 'Rédaction audit (Opus)...'}
                </h3>
              </div>
              <span className="text-slate-500 text-xs">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{
                width: `${progress}%`,
                background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)',
              }} />
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <div className={`flex items-center gap-1 text-[11px] ${step === 'fetching-keywords' ? 'text-[#E14B89]' : 'text-green-400'}`}>
                {step === 'fetching-keywords' ? <Loader2 size={8} className="animate-spin" /> : <CheckCircle2 size={8} />}
                DataForSEO
              </div>
              <ArrowRight size={8} className="text-slate-700" />
              <div className={`flex items-center gap-1 text-[11px] ${step === 'generating' && auditPhase === 'draft' ? 'text-[#F8903C]' : step === 'generating' && auditPhase === 'review' ? 'text-green-400' : 'text-slate-600'}`}>
                {step === 'generating' && auditPhase === 'draft' ? <Loader2 size={8} className="animate-spin" /> : auditPhase === 'review' ? <CheckCircle2 size={8} /> : <BarChart3 size={8} />}
                Opus Draft
              </div>
              <ArrowRight size={8} className="text-slate-700" />
              <div className={`flex items-center gap-1 text-[11px] ${auditPhase === 'review' ? 'text-purple-400' : 'text-slate-600'}`}>
                {auditPhase === 'review' ? <Loader2 size={8} className="animate-spin" /> : <Shield size={8} />}
                Relecture
              </div>
            </div>
          </div>

          {/* SEO Data preview */}
          {seoData && seoData.volumes.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-green-400" /> Données DataForSEO récupérées
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {seoData.volumes.filter(k => k.search_volume).slice(0, 8).map((k, i) => (
                  <div key={i} className="bg-[#0d0d14] rounded-lg px-3 py-2">
                    <p className="text-white text-xs font-medium truncate">{k.keyword}</p>
                    <p className="text-slate-500 text-[10px]">{k.search_volume}/mois · {k.competition || '?'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live preview */}
          {analysis && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 max-h-[50vh] overflow-y-auto">
              {renderMarkdown(analysis)}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {step === 'done' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center justify-between">
            <button onClick={reset}
              className="flex items-center gap-2 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-colors">
              <Search size={14} /> Nouvel audit
            </button>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors">
                <Copy size={13} /> {copied ? 'Copié !' : 'Copier'}
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors">
                <Download size={13} /> Télécharger
              </button>
            </div>
          </div>

          {/* SEO Data summary */}
          {seoData && seoData.volumes.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-green-400" /> Données DataForSEO — Top mots-clés
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-slate-500 font-medium py-2 px-2">Mot-clé</th>
                      <th className="text-right text-slate-500 font-medium py-2 px-2">Vol/mois</th>
                      <th className="text-right text-slate-500 font-medium py-2 px-2">Concurrence</th>
                      <th className="text-right text-slate-500 font-medium py-2 px-2">CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...seoData.volumes, ...seoData.suggestions]
                      .filter(k => k.search_volume && k.search_volume > 0)
                      .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
                      .slice(0, 15)
                      .map((k, i) => (
                        <tr key={i} className="border-b border-slate-800/30">
                          <td className="py-2 px-2 text-white">{k.keyword}</td>
                          <td className="py-2 px-2 text-right">
                            <span className={SCORE_COLOR(Math.min(100, (k.search_volume || 0) / 50))}>{k.search_volume}</span>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${k.competition === 'HIGH' ? 'bg-red-500/15 text-red-400' : k.competition === 'MEDIUM' ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'}`}>
                              {k.competition || '—'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-slate-400">{k.cpc ? `${k.cpc.toFixed(2)}€` : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analysis */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 sm:p-8 max-h-[70vh] overflow-y-auto">
            {renderMarkdown(analysis)}
          </div>
        </div>
      )}
    </div>
  )
}
