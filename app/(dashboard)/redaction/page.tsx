'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { FileText, Loader2, Search, ChevronDown, Download, FolderKanban, Sparkles, CheckCircle2, ArrowRight, AlertCircle, Clock, Eye, Trash2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  type: string
  status: string
  clientBrief?: string
  client: { name: string; company?: string; website?: string }
  clientForm?: {
    cdcCompleted: boolean
    briefCompleted: boolean
    designCompleted: boolean
    accesCompleted: boolean
    docsCompleted: boolean
    cdcData?: Record<string, unknown>
    briefData?: Record<string, unknown>
  } | null
}

interface RedactionHistory {
  id: string
  projectId: string
  analysis: string
  content?: string | null
  cost?: number | null
  createdAt: string
  project: { id: string; name: string; client: { name: string; company?: string } }
  createdBy: { name: string }
}

const STATUS_LABELS: Record<string, string> = {
  BRIEF: 'Pas validé',
  REDACTION: 'Rédaction',
}

export default function RedactionPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Generation state
  const [step, setStep] = useState<'select' | 'generating-analysis' | 'analysis-done' | 'generating-content' | 'done'>('select')
  const [analysis, setAnalysis] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'analysis' | 'content'>('analysis')
  const [history, setHistory] = useState<RedactionHistory[]>([])
  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [activePage, setActivePage] = useState(0)
  const [totalCost, setTotalCost] = useState<{ analysis: number; redaction: number }>({ analysis: 0, redaction: 0 })
  const [costDetails, setCostDetails] = useState<Record<string, unknown> | null>(null)

  function fetchHistory() {
    fetch('/api/redaction').then(r => r.json()).then(data => { if (Array.isArray(data)) setHistory(data) })
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/redaction').then(r => r.json()),
    ]).then(([projects, hist]) => {
      const filtered = (projects as Project[]).filter(p => ['BRIEF', 'REDACTION'].includes(p.status))
      setProjects(filtered)
      if (Array.isArray(hist)) setHistory(hist)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client.company || p.client.name).toLowerCase().includes(search.toLowerCase())
  )

  const [redactionPhase, setRedactionPhase] = useState<'draft' | 'review' | null>(null)

  async function readStream(res: Response, onChunk: (text: string) => void, onCost?: (cost: Record<string, unknown>) => void): Promise<string> {
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
          if (parsed.phase) { setRedactionPhase(parsed.phase); continue }
          if (parsed.clear) { full = ''; onChunk(''); continue }
          if (parsed.cost && onCost) { onCost(parsed.cost); continue }
          if (parsed.passCost && onCost) { onCost(parsed.passCost); continue }
          if (parsed.text) {
            full += parsed.text
            onChunk(full)
          }
        } catch { /* skip malformed */ }
      }
    }
    return full
  }

  async function startGeneration() {
    if (!selectedProject) return
    setError('')
    setAnalysis('')
    setContent('')
    setStep('generating-analysis')
    setActiveTab('analysis')

    setTotalCost({ analysis: 0, redaction: 0 })
    setCostDetails(null)

    try {
      // Step 1: Analyse SEO
      let analysisCostData: Record<string, unknown> = {}
      const res1 = await fetch('/api/redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id, step: 'analyse' }),
      })
      if (!res1.ok) throw new Error('Erreur API analyse')
      const analysisResult = await readStream(res1, text => setAnalysis(text), cost => {
        analysisCostData = cost
        setTotalCost(prev => ({ ...prev, analysis: (cost.total as number) || 0 }))
      })

      // Step 2: Rédaction (enchaîne automatiquement)
      setStep('generating-content')
      setActiveTab('content')

      let redactionCostData: Record<string, unknown> = {}
      let redactionRunningCost = 0
      const res2 = await fetch('/api/redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id, step: 'redaction', analysis: analysisResult }),
      })
      if (!res2.ok) throw new Error('Erreur API rédaction')
      const contentResult = await readStream(res2, text => setContent(text), cost => {
        if (cost.pass) {
          // Incremental pass cost
          redactionRunningCost += (cost.cost as number) || 0
          setTotalCost(prev => ({ ...prev, redaction: redactionRunningCost }))
        } else if (cost.total) {
          // Final total cost
          redactionCostData = cost
          setTotalCost(prev => ({ ...prev, redaction: (cost.total as number) || redactionRunningCost }))
        }
      })

      const allCostDetails = { analysis: analysisCostData, redaction: redactionCostData }
      const finalCost = ((analysisCostData.total as number) || 0) + ((redactionCostData.total as number) || redactionRunningCost)
      setCostDetails(allCostDetails)
      setStep('done')

      // Auto-save to DB
      try {
        await fetch('/api/redaction', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: selectedProject.id, analysis: analysisResult, content: contentResult || null, cost: finalCost || null, costDetails: allCostDetails }),
        })
        fetchHistory()
      } catch { /* silent */ }
    } catch {
      setError('Erreur lors de la génération')
      if (!analysis) setStep('select')
      else setStep('done')
    }
  }

  function handleDownload(type: 'analysis' | 'content' | 'all' = 'all') {
    const projectName = selectedProject?.name?.replace(/\s+/g, '-').toLowerCase() || 'projet'
    const clientName = selectedProject?.client?.company || selectedProject?.client?.name || ''

    // Build structured HTML for Google Stitch compatibility
    function mdToHtml(md: string): string {
      return md.split('\n').map(line => {
        if (line.startsWith('#### ')) return `<h4>${line.slice(5)}</h4>`
        if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`
        if (/^\d+\.\s/.test(line)) return `<li>${line.replace(/^\d+\.\s/, '')}</li>`
        if (line.startsWith('- ') || line.startsWith('* ')) return `<li>${line.slice(2)}</li>`
        if (line.startsWith('> ')) return `<blockquote>${line.slice(2)}</blockquote>`
        if (line.startsWith('---')) return '<hr>'
        if (line.trim() === '') return '<br>'
        // Bold
        const formatted = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Table rows
        if (formatted.trim().startsWith('|')) {
          const cells = formatted.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`)
          return `<tr>${cells.join('')}</tr>`
        }
        return `<p>${formatted}</p>`
      }).join('\n')
    }

    let htmlContent = ''
    if (type === 'analysis' || type === 'all') {
      htmlContent += `<h1>Analyse SEO — ${clientName}</h1>\n${mdToHtml(analysis)}`
    }
    if (type === 'all') htmlContent += '\n<hr style="page-break-before: always">\n'
    if (type === 'content' || type === 'all') {
      htmlContent += `<h1>Contenu rédactionnel — ${clientName}</h1>\n${mdToHtml(content)}`
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rédaction SEO — ${clientName}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; line-height: 1.7; }
  h1 { font-size: 24px; color: #1a1a2e; border-bottom: 3px solid #E14B89; padding-bottom: 8px; margin-top: 40px; }
  h2 { font-size: 20px; color: #E14B89; margin-top: 32px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  h3 { font-size: 16px; color: #333; margin-top: 24px; }
  h4 { font-size: 14px; color: #555; margin-top: 16px; }
  p { margin: 8px 0; font-size: 14px; }
  li { margin: 4px 0; font-size: 14px; margin-left: 20px; }
  blockquote { border-left: 3px solid #E14B89; padding: 8px 16px; margin: 12px 0; background: #fdf2f8; color: #555; font-style: italic; }
  strong { color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  td, th { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  tr:nth-child(even) { background: #fafafa; }
  hr { border: none; border-top: 1px solid #ddd; margin: 32px 0; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
${htmlContent}
<footer style="margin-top:60px;padding-top:20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">
  Agence Kameo — agence-kameo.fr — Document généré le ${new Date().toLocaleDateString('fr-FR')}
</footer>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const suffix = type === 'analysis' ? '-analyse' : type === 'content' ? '-contenu' : ''
    a.download = `redaction-${projectName}${suffix}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleLink() {
    if (!selectedProject || !analysis) return
    setLinking(true)
    try {
      // Save redaction to DB
      const res = await fetch('/api/redaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id, analysis, content: content || null, cost: totalCost.analysis + totalCost.redaction || null, costDetails: costDetails || null }),
      })
      const redaction = await res.json()

      // Update project's contentUrl to point to the redaction page
      await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentUrl: `/redaction/${redaction.id}` }),
      })

      setLinked(true)
      fetchHistory()
    } catch { /* ignore */ }
    setLinking(false)
  }

  function loadFromHistory(item: RedactionHistory) {
    const proj = projects.find(p => p.id === item.projectId)
    if (proj) setSelectedProject(proj)
    setAnalysis(item.analysis)
    setContent(item.content || '')
    setStep(item.content ? 'done' : 'analysis-done')
    setActiveTab('analysis')
  }

  async function deleteHistory(id: string) {
    if (!confirm('Supprimer cette rédaction ?')) return
    await fetch(`/api/redaction?id=${id}`, { method: 'DELETE' })
    setHistory(prev => prev.filter(h => h.id !== id))
  }

  function reset() {
    setSelectedProject(null)
    setStep('select')
    setAnalysis('')
    setContent('')
    setError('')
    setActiveTab('analysis')
  }

  // Render markdown-like content with basic styling
  // Parse analysis into sections (split on ## headers)
  const analysisSections = useMemo(() => {
    if (!analysis) return []
    const parts = analysis.split(/^## /m)
    if (parts.length <= 1) return [{ title: 'Analyse complète', content: analysis }]
    const sections = []
    for (let i = 1; i < parts.length; i++) {
      const lines = parts[i].split('\n')
      const title = lines[0].trim()
      if (!title) continue
      const content = '## ' + parts[i]
      // Skip sections with less than 20 chars of real content (empty/separator)
      if (content.replace(/^##\s+\S+\n/, '').trim().length < 20) continue
      sections.push({ title, content })
    }
    return sections
  }, [analysis])

  // Parse content into pages (split on # Page or --- separators between pages)
  const contentPages = useMemo(() => {
    if (!content) return []
    // Try to split by page patterns: "# Page:", "# Accueil", "---" between sections with **Slug**
    const pagePattern = /^(?:#{1,2}\s+(?:Page\s*[:—–-]\s*)?(.+)|---\s*\n\s*\*\*Slug\*\*)/m
    const slugPattern = /\*\*Slug\*\*\s*[:—–-]?\s*(.+)/

    // Filter: must have real content (>50 chars after removing headers/separators)
    const hasContent = (block: string) => block.replace(/^#+\s+.*/gm, '').replace(/---/g, '').replace(/\*\*[^*]+\*\*/g, '').trim().length > 50

    // First try: split by H1/H2 that look like page names
    const h1Splits = content.split(/(?=^# [^#])/m).filter(s => s.trim() && hasContent(s))
    if (h1Splits.length > 1) {
      return h1Splits.map(block => {
        const firstLine = block.split('\n')[0]
        const title = firstLine.replace(/^#+\s*/, '').replace(/^Page\s*[:—–-]\s*/, '').trim()
        return { title: title || 'Page', content: block }
      })
    }

    // Second try: split by --- separators
    const hrSplits = content.split(/\n---\n/).filter(s => s.trim() && hasContent(s))
    if (hrSplits.length > 1) {
      return hrSplits.map(block => {
        const slugMatch = block.match(slugPattern)
        const h2Match = block.match(/^##\s+(.+)/m)
        const h1Match = block.match(/^#\s+(.+)/m)
        const title = slugMatch?.[1]?.trim() || h2Match?.[1]?.trim() || h1Match?.[1]?.trim() || 'Page'
        return { title, content: block }
      })
    }

    // Fallback: split by ## headers
    const h2Splits = content.split(/(?=^## )/m).filter(s => s.trim() && hasContent(s))
    if (h2Splits.length > 1) {
      return h2Splits.map(block => {
        const firstLine = block.split('\n')[0]
        const title = firstLine.replace(/^#+\s*/, '').trim()
        return { title: title || 'Section', content: block }
      })
    }

    // No splits found
    return [{ title: 'Contenu complet', content }]
  }, [content])

  function renderMarkdown(md: string) {
    const lines = md.split('\n')
    const elements: React.ReactNode[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      // Table detection (| col | col |)
      if (line.trim().startsWith('|') && line.includes('|', 1)) {
        const tableLines: string[] = []
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i])
          i++
        }
        const rows = tableLines.filter(l => !/^\|[\s-:|]+\|$/.test(l)) // remove separator rows
        if (rows.length > 0) {
          const headerCells = rows[0].split('|').filter(c => c.trim()).map(c => c.trim())
          const bodyRows = rows.slice(1).map(r => r.split('|').filter(c => c.trim()).map(c => c.trim()))
          elements.push(
            <div key={`table-${elements.length}`} className="overflow-x-auto my-4">
              <table className="w-full text-xs border border-slate-800 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-800/50">
                    {headerCells.map((c, ci) => <th key={ci} className="px-3 py-2 text-left text-slate-300 font-semibold border-b border-slate-700">{formatInline(c)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 ? 'bg-slate-800/20' : ''}>
                      {row.map((c, ci) => <td key={ci} className="px-3 py-2 text-slate-300 border-b border-slate-800/50">{formatInline(c)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          continue
        }
      }

      if (line.startsWith('#### ')) { elements.push(<h4 key={i} className="text-slate-200 font-medium text-sm mt-5 mb-1.5">{formatInline(line.slice(5))}</h4>); i++; continue }
      if (line.startsWith('### ')) { elements.push(<h3 key={i} className="text-white font-semibold mt-6 mb-2 text-[15px]">{formatInline(line.slice(4))}</h3>); i++; continue }
      if (line.startsWith('## ')) { elements.push(<h2 key={i} className="text-[#E14B89] font-bold text-lg mt-8 mb-3 pb-2 border-b border-slate-800">{formatInline(line.slice(3))}</h2>); i++; continue }
      if (line.startsWith('# ')) { elements.push(<h1 key={i} className="text-white font-bold text-xl mt-8 mb-4">{formatInline(line.slice(2))}</h1>); i++; continue }
      if (/^\d+\.\s/.test(line)) { elements.push(<li key={i} className="text-slate-300 text-sm ml-5 mb-1 list-decimal leading-relaxed">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>); i++; continue }
      if (line.startsWith('- ') || line.startsWith('* ')) { elements.push(<li key={i} className="text-slate-300 text-sm ml-5 mb-1 list-disc leading-relaxed">{formatInline(line.slice(2))}</li>); i++; continue }
      if (line.startsWith('> ')) { elements.push(<blockquote key={i} className="border-l-2 border-[#E14B89]/50 pl-4 py-1 text-slate-400 text-sm italic my-3 bg-[#E14B89]/5 rounded-r-lg">{formatInline(line.slice(2))}</blockquote>); i++; continue }
      if (line.trim() === '') { elements.push(<div key={i} className="h-3" />); i++; continue }
      if (line.startsWith('---')) { elements.push(<hr key={i} className="border-slate-700/50 my-8" />); i++; continue }
      elements.push(<p key={i} className="text-slate-300 text-sm mb-1.5 leading-[1.7]">{formatInline(line)}</p>)
      i++
    }
    return elements
  }

  function formatInline(text: string) {
    // Bold + inline code
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-slate-800 text-[#F8903C] px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
      }
      return part
    })
  }

  // Estimate API cost based on content length
  // Sonnet: ~$3/M input, ~$15/M output | Opus: ~$15/M input, ~$75/M output | 1 token ≈ 4 chars FR
  function estimateCost(analysisText: string, contentText?: string | null): number {
    const analysisTokens = (analysisText?.length || 0) / 4
    const contentTokens = (contentText?.length || 0) / 4
    // Analysis: Sonnet (seed keywords + clustering + analysis generation)
    const sonnetCost = analysisTokens * 0.015 / 1000 // ~$15/M output
    // DataForSEO: ~$0.50-1.50 flat
    const dataForSeoCost = 1.0
    // Redaction: Opus x2 passes (draft + review) + Sonnet audit
    const opusCost = contentTokens > 0 ? (contentTokens * 2 * 0.075 / 1000) : 0 // ~$75/M output x2
    const auditCost = contentTokens > 0 ? 0.05 : 0
    return Math.round((sonnetCost + dataForSeoCost + opusCost + auditCost) * 100) / 100
  }

  const isGenerating = step === 'generating-analysis' || step === 'generating-content'

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Rédaction SEO</h1>
          <p className="text-slate-400 text-sm mt-1">Analyse SEO + rédaction optimisée pour vos projets</p>
        </div>
        {step !== 'select' && (
          <button onClick={reset}
            className="flex items-center gap-2 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <FolderKanban size={16} /> Changer de projet
          </button>
        )}
      </div>

      {/* Step 1: Project selection */}
      {step === 'select' && (
        <div className="space-y-6">
          {/* Project selector */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-1">Sélectionner un projet</h2>
            <p className="text-slate-500 text-xs mb-4">Projets avec statut &quot;Pas validé&quot; ou &quot;Rédaction&quot;</p>

            {loading ? (
              <div className="text-slate-500 text-sm py-4">Chargement des projets...</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8">
                <FolderKanban size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Aucun projet en &quot;Pas validé&quot; ou &quot;Rédaction&quot;</p>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-left hover:border-slate-600 transition-colors">
                  {selectedProject ? (
                    <div>
                      <span className="text-white font-medium">{selectedProject.name}</span>
                      <span className="text-slate-500 text-xs ml-2">{selectedProject.client.company || selectedProject.client.name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500">Choisir un projet...</span>
                  )}
                  <ChevronDown size={16} className={`text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#111118] border border-slate-700 rounded-xl shadow-2xl z-10 overflow-hidden max-h-[300px] flex flex-col">
                    <div className="p-2 border-b border-slate-800">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89]" />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredProjects.map(p => (
                        <button key={p.id} onClick={() => { setSelectedProject(p); setDropdownOpen(false) }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors text-left border-b border-slate-800/30 last:border-0">
                          <div>
                            <p className="text-white text-sm font-medium">{p.name}</p>
                            <p className="text-slate-500 text-xs">{p.client.company || p.client.name}{(p.clientForm?.cdcData as Record<string, string>)?.siteActuel ? ` · ${(p.clientForm?.cdcData as Record<string, string>).siteActuel}` : ''}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'BRIEF' ? 'bg-slate-800 text-slate-400' : 'bg-blue-500/15 text-blue-400'
                          }`}>{STATUS_LABELS[p.status] || p.status}</span>
                        </button>
                      ))}
                      {filteredProjects.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">Aucun résultat</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected project info */}
          {selectedProject && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FileText size={16} className="text-[#E14B89]" /> Données du projet
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/30 rounded-xl px-4 py-3">
                  <p className="text-slate-500 text-xs mb-0.5">Client</p>
                  <p className="text-white">{selectedProject.client.company || selectedProject.client.name}</p>
                </div>
                <div className="bg-slate-800/30 rounded-xl px-4 py-3">
                  <p className="text-slate-500 text-xs mb-0.5">Type</p>
                  <p className="text-white">{selectedProject.type}</p>
                </div>
                {(selectedProject.clientForm?.cdcData as Record<string, string>)?.siteActuel && (
                  <div className="bg-slate-800/30 rounded-xl px-4 py-3">
                    <p className="text-slate-500 text-xs mb-0.5">Site actuel</p>
                    <p className="text-white">{(selectedProject.clientForm?.cdcData as Record<string, string>).siteActuel}</p>
                  </div>
                )}
                <div className="bg-slate-800/30 rounded-xl px-4 py-3">
                  <p className="text-slate-500 text-xs mb-0.5">Formulaire client</p>
                  {selectedProject.clientForm ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedProject.clientForm.cdcCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Mission</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedProject.clientForm.briefCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Brief</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedProject.clientForm.designCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Design</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedProject.clientForm.accesCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Accès</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedProject.clientForm.docsCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Docs</span>
                    </div>
                  ) : (
                    <p className="text-amber-400 flex items-center gap-1.5 text-sm">
                      <AlertCircle size={12} /> Non envoyé
                    </p>
                  )}
                </div>
              </div>

              <button onClick={startGeneration}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-3 rounded-xl text-sm font-semibold transition-opacity">
                <Sparkles size={16} /> Lancer l&apos;analyse SEO + rédaction
              </button>
            </div>
          )}
        </div>
      )}

      {/* Generating state - show streaming content */}
      {isGenerating && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="text-[#E14B89] animate-spin" />
                <h3 className="text-white font-semibold text-sm">
                  {step === 'generating-analysis' ? 'Analyse SEO + DataForSEO...' : redactionPhase === 'review' ? 'Relecture & amélioration (Opus)...' : 'Rédaction premium (Opus)...'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 text-[11px] ${step === 'generating-analysis' ? 'text-[#E14B89]' : 'text-green-400'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${step === 'generating-analysis' ? 'bg-[#E14B89]/20' : 'bg-green-400/20'}`}>
                    {step === 'generating-analysis' ? <Loader2 size={8} className="animate-spin" /> : <CheckCircle2 size={8} />}
                  </div>
                  Analyse
                </div>
                <ArrowRight size={10} className="text-slate-700" />
                <div className={`flex items-center gap-1 text-[11px] ${step === 'generating-content' && redactionPhase === 'draft' ? 'text-[#F8903C]' : step === 'generating-content' ? 'text-green-400' : 'text-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${step === 'generating-content' && redactionPhase === 'draft' ? 'bg-[#F8903C]/20' : step === 'generating-content' && redactionPhase === 'review' ? 'bg-green-400/20' : 'bg-slate-800'}`}>
                    {step === 'generating-content' && redactionPhase === 'draft' ? <Loader2 size={8} className="animate-spin" /> : redactionPhase === 'review' ? <CheckCircle2 size={8} /> : <span className="text-[7px]">2</span>}
                  </div>
                  Draft
                </div>
                <ArrowRight size={10} className="text-slate-700" />
                <div className={`flex items-center gap-1 text-[11px] ${redactionPhase === 'review' ? 'text-purple-400' : 'text-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${redactionPhase === 'review' ? 'bg-purple-400/20' : 'bg-slate-800'}`}>
                    {redactionPhase === 'review' ? <Loader2 size={8} className="animate-spin" /> : <span className="text-[7px]">3</span>}
                  </div>
                  Relecture
                </div>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full animate-pulse" style={{
                width: step === 'generating-analysis' ? '33%' : redactionPhase === 'draft' ? '55%' : '80%',
                background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)',
              }} />
            </div>
          </div>

          {/* Live preview of streaming content */}
          {(analysis || content) && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 sm:p-8 max-h-[60vh] overflow-y-auto">
              {step === 'generating-analysis' && analysis && renderMarkdown(analysis)}
              {step === 'generating-content' && content && renderMarkdown(content)}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4 flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Results */}
      {step === 'done' && (
        <div className="space-y-4">
          {/* Tabs + actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
                <button onClick={() => setActiveTab('analysis')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'analysis' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
                  <Search size={13} /> Analyse SEO
                </button>
                <button onClick={() => setActiveTab('content')} disabled={!content}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'content' ? 'bg-[#F8903C]/10 text-[#F8903C]' : 'text-slate-400 hover:text-white'} disabled:opacity-30`}>
                  <FileText size={13} /> Contenu rédigé
                </button>
              </div>
              {(totalCost.analysis + totalCost.redaction) > 0 && (
                <span className="text-slate-600 text-[10px] font-mono">Coût réel : {(totalCost.analysis + totalCost.redaction).toFixed(3)} $</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 'done' && (
                <>
                  <button onClick={() => handleDownload(activeTab === 'analysis' ? 'analysis' : 'content')}
                    className="flex items-center gap-1.5 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors">
                    <Download size={13} /> {activeTab === 'analysis' ? 'Analyse' : 'Contenu'}
                  </button>
                  {analysis && content && (
                    <button onClick={() => handleDownload('all')}
                      className="flex items-center gap-1.5 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors">
                      <Download size={13} /> Tout
                    </button>
                  )}
                  <button onClick={handleLink} disabled={linking || linked}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors ${linked ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white'} disabled:opacity-60`}>
                    {linking ? <Loader2 size={13} className="animate-spin" /> : linked ? <CheckCircle2 size={13} /> : <FolderKanban size={13} />}
                    {linking ? 'Liaison...' : linked ? 'Relié au projet !' : 'Relier au projet'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Section/Page filter */}
          {activeTab === 'analysis' && analysisSections.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {analysisSections.map((s, i) => (
                <button key={i} onClick={() => setActiveSection(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    activeSection === i ? 'bg-[#E14B89]/15 text-[#E14B89] border border-[#E14B89]/30' : 'text-slate-500 hover:text-white bg-[#111118] border border-slate-800'
                  }`}>
                  {s.title.length > 30 ? s.title.slice(0, 30) + '...' : s.title}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'content' && contentPages.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {contentPages.map((p, i) => (
                <button key={i} onClick={() => setActivePage(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    activePage === i ? 'bg-[#F8903C]/15 text-[#F8903C] border border-[#F8903C]/30' : 'text-slate-500 hover:text-white bg-[#111118] border border-slate-800'
                  }`}>
                  {p.title.length > 25 ? p.title.slice(0, 25) + '...' : p.title}
                </button>
              ))}
            </div>
          )}

          {/* Content display */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 sm:p-10 max-h-[75vh] overflow-y-auto">
            {activeTab === 'analysis' && analysis && (
              analysisSections.length > 1
                ? renderMarkdown(analysisSections[activeSection]?.content || '')
                : renderMarkdown(analysis)
            )}
            {activeTab === 'content' && content && (
              contentPages.length > 1
                ? renderMarkdown(contentPages[activePage]?.content || '')
                : renderMarkdown(content)
            )}
            {activeTab === 'content' && !content && (
              <div className="text-center py-12 text-slate-500">
                <FileText size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Lancez la génération de contenu pour voir le résultat</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && step === 'select' && (
        <div className="mt-8">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" /> Historique des rédactions
          </h2>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-[#111118] border border-slate-800 rounded-xl px-5 py-4 flex items-center justify-between group hover:border-slate-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{h.project.name}</p>
                  <p className="text-slate-500 text-xs">
                    {h.project.client.company || h.project.client.name} · {h.createdBy.name} · {new Date(h.createdAt).toLocaleDateString('fr-FR')}
                    {h.content ? ' · Analyse + Rédaction' : ' · Analyse uniquement'}
                  </p>
                </div>
                <span className="text-slate-600 text-xs font-mono mr-3">{h.cost ? `${h.cost.toFixed(3)} $` : `~${estimateCost(h.analysis, h.content).toFixed(2)} $`}</span>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => loadFromHistory(h)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                    <Eye size={13} /> Voir
                  </button>
                  <button onClick={() => deleteHistory(h.id)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
