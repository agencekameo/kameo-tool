'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Search, Plus, Send, RefreshCw, Trash2, ExternalLink, Phone, Mail, Star, MapPin, ChevronDown, Check, X, Loader2, Globe, Users, Euro, Calendar, ShieldCheck, ShieldAlert, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'
import Link from 'next/link'

interface Partner {
  id: string
  name: string
  category?: string
  phone?: string
  email?: string
  website?: string
  address?: string
  rating?: number
  reviewCount?: number
  status: string
  notes?: string
  mailSentAt?: string
  relance1At?: string
  relance2At?: string
  mailOpenCount?: number
  lastOpenedAt?: string
  trackingId?: string
  projectId?: string
  commissionRate: number
  commissionAmount?: number
  commissionPaid: boolean
  commissionPaidAt?: string
  search?: { keyword: string; location: string }
  project?: { id: string; name: string; price: number }
  createdAt: string
}

interface PartnerSearch {
  id: string
  name?: string | null
  keyword: string
  location: string
  resultCount: number
  scrapingStatus: string
  scrapedCount: number
  totalToScrape: number
  createdAt: string
  _count: { partners: number }
}

interface ProjectOption { id: string; name: string; price: number | null }

const STATUS_LABELS: Record<string, string> = {
  NOUVEAU: 'Nouveau',
  MAIL_ENVOYE: 'Mail envoyé',
  RELANCE_1: 'Relance 1',
  RELANCE_2: 'Relance 2',
  RDV_PRIS: 'RDV pris',
  SIGNE: 'Signé',
  REFUSE: 'Refusé',
}

const STATUS_COLORS: Record<string, string> = {
  NOUVEAU: 'bg-slate-700 text-slate-300',
  MAIL_ENVOYE: 'bg-blue-500/15 text-blue-400',
  RELANCE_1: 'bg-amber-500/15 text-amber-400',
  RELANCE_2: 'bg-orange-500/15 text-orange-400',
  RDV_PRIS: 'bg-purple-500/15 text-purple-400',
  SIGNE: 'bg-green-500/15 text-green-400',
  REFUSE: 'bg-red-500/15 text-red-400',
}

const LOCATIONS = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg', 'Nice', 'Rennes', 'Montpellier', 'France']

export default function PartenairesPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [searches, setSearches] = useState<PartnerSearch[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSearch, setFilterSearch] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [tab, setTab] = useState<'list' | 'signed'>('list')
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)

  // Scraping form
  const [showScrape, setShowScrape] = useState(false)
  const [scrapeName, setScrapeName] = useState('')
  const [scrapeKeyword, setScrapeKeyword] = useState('')
  const [scrapeLocations, setScrapeLocations] = useState<string[]>(['Paris'])
  const [scraping, setScraping] = useState(false)
  const [scrapeCurrentCity, setScrapeCurrentCity] = useState('')
  const [scrapeAbort, setScrapeAbort] = useState<AbortController | null>(null)
  const [scrapeFilters, setScrapeFilters] = useState({ website: 'with' as string, address: 'all' as string, type: 'company' as string, minRating: 0, minReviews: 0 })

  // Email
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [mailType, setMailType] = useState<'initial' | 'relance1' | 'relance2'>('initial')
  const [showMailPreview, setShowMailPreview] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [senderId, setSenderId] = useState<'benjamin' | 'kameo' | 'louison'>('benjamin')

  const SENDERS = {
    benjamin: { label: 'Benjamin Dayan', email: 'contact@agence-kameo.fr' },
    kameo: { label: 'Agence Kameo', email: 'contact@agence-kameo.fr' },
    louison: { label: 'Louison', email: 'louison@agence-kameo.fr' },
  }

  const DEFAULT_SUBJECTS: Record<string, string> = {
    initial: 'Proposition de partenariat',
    relance1: 'Suite à notre proposition de partenariat',
    relance2: 'Dernière relance | Partenariat Agence Kameo',
  }

  // Safe sending state
  const [quota, setQuota] = useState<{ sent: number; remaining: number; maxToday: number; bounceRate: number } | null>(null)
  const [riskInfo, setRiskInfo] = useState<{ level: string; message: string; color: string } | null>(null)
  const [sendEstimate, setSendEstimate] = useState<{ minutes: number; batches: number; description: string } | null>(null)
  const [sendProgress, setSendProgress] = useState<{ step: string; message: string; progress: number; sent?: number; failed?: number; total?: number; bounced?: number; skippedInvalid?: number; invalidEmails?: { email: string; reason: string }[] } | null>(null)
  const [sendAbort, setSendAbort] = useState<AbortController | null>(null)

  // Edit partner
  const [editPartner, setEditPartner] = useState<Partner | null>(null)
  const [editForm, setEditForm] = useState({ email: '', notes: '', projectId: '', commissionPaid: false })

  function fetchData() {
    Promise.all([
      fetch('/api/partners').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([data, proj]) => {
      if (data.partners) setPartners(data.partners)
      if (data.searches) setSearches(data.searches)
      setProjects(Array.isArray(proj) ? proj : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])
  usePolling(() => {
    fetch('/api/partners').then(r => r.json()).then(data => {
      if (data.partners) setPartners(data.partners)
      if (data.searches) setSearches(data.searches)
    })
  })

  const [scrapeProgress, setScrapeProgress] = useState(0)
  const [scrapeMessage, setScrapeMessage] = useState('')

  async function readSSEStream(res: Response): Promise<string | null> {
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let searchId: string | null = null

    if (reader) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.progress !== undefined) setScrapeProgress(data.progress)
            if (data.message) setScrapeMessage(data.message)
            if (data.searchId) searchId = data.searchId
            if (data.step === 'error') throw new Error(data.message)
          } catch (err) {
            if (err instanceof Error && err.message !== 'Unexpected end of JSON input') throw err
          }
        }
      }
    }
    return searchId
  }

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault()
    if (!scrapeKeyword.trim() || scrapeLocations.length === 0) return
    setScraping(true)
    setScrapeProgress(0)
    setScrapeMessage('Lancement...')
    let lastSearchId: string | null = null

    const abort = new AbortController()
    setScrapeAbort(abort)

    try {
      for (let i = 0; i < scrapeLocations.length; i++) {
        if (abort.signal.aborted) break
        const loc = scrapeLocations[i]
        setScrapeCurrentCity(loc)
        setScrapeMessage(`${loc} : Recherche Google Maps...`)
        setScrapeProgress(0)

        const res = await fetch('/api/partners/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: scrapeKeyword, location: loc, listName: scrapeName.trim() || undefined, filters: scrapeFilters }),
          signal: abort.signal,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erreur' }))
          alert(`${loc} : ${err.error || 'Erreur'}`)
          continue
        }

        const searchId = await readSSEStream(res)
        if (searchId) lastSearchId = searchId
      }

      fetchData()
      if (!abort.signal.aborted) {
        setShowScrape(false)
        setScrapeKeyword('')
      }
      if (lastSearchId) {
        setActiveSearchId(lastSearchId)
        // Launch batch scraping in background
        launchBatchScraping(lastSearchId)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setScrapeMessage('Recherche annulée')
        fetchData()
      } else {
        alert(err instanceof Error ? err.message : 'Erreur lors du scraping')
      }
    } finally {
      setScraping(false)
      setScrapeAbort(null)
      setScrapeProgress(0)
      setScrapeCurrentCity('')
    }
  }

  function handleCancelScrape() {
    if (scrapeAbort) {
      scrapeAbort.abort()
      setScrapeAbort(null)
    }
  }

  // Track which searches are actively being scraped to avoid duplicates
  const activeScraping = useRef(new Set<string>())

  // Launch batch email scraping for a search (calls itself recursively until done)
  async function launchBatchScraping(searchId: string) {
    if (activeScraping.current.has(searchId)) return
    activeScraping.current.add(searchId)

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch('/api/partners/scrape-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchId }),
        })
        const data = await res.json()
        fetchData()

        if (data.status !== 'scraping') break
        // Small delay to avoid overwhelming the server
        await new Promise(r => setTimeout(r, 500))
      }
    } catch {
      fetchData()
    } finally {
      activeScraping.current.delete(searchId)
    }
  }

  // On load, check if any searches are still scraping and resume
  useEffect(() => {
    const scrapingSearches = searches.filter(s => s.scrapingStatus === 'SCRAPING')
    for (const s of scrapingSearches) {
      launchBatchScraping(s.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searches.length])

  // Fetch quota when mail preview opens
  async function fetchQuota(count: number) {
    try {
      const res = await fetch('/api/partners/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      })
      const data = await res.json()
      setQuota(data.quota)
      setRiskInfo(data.risk)
      setSendEstimate(data.estimate)
    } catch { /* ignore */ }
  }

  async function handleSendMails() {
    if (selectedIds.size === 0) return
    const noEmail = filtered.filter(p => selectedIds.has(p.id) && !p.email)
    if (noEmail.length > 0) {
      alert(`${noEmail.length} partenaire(s) sans email. Ajoutez leur email d'abord.`)
      return
    }

    setSending(true)
    setSendProgress({ step: 'init', message: 'Lancement...', progress: 0 })

    const abort = new AbortController()
    setSendAbort(abort)

    try {
      const res = await fetch('/api/partners/send-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerIds: Array.from(selectedIds), type: mailType, senderId, customSubject: customSubject || undefined }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }))
        alert(err.error || 'Erreur')
        setSending(false)
        setSendProgress(null)
        return
      }

      // Read SSE stream
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              setSendProgress(data)
              if (data.step === 'done' || data.step === 'auto_stop') {
                // Done
              }
            } catch { /* partial JSON */ }
          }
        }
      }

      setSelectedIds(new Set())
      fetchData()
      // Refresh quota
      fetchQuota(0)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setSendProgress(prev => prev ? { ...prev, step: 'cancelled', message: 'Envoi annulé par l\'utilisateur' } : null)
      }
    } finally {
      setSending(false)
      setSendAbort(null)
    }
  }

  function handleCancelSend() {
    if (sendAbort) {
      sendAbort.abort()
      setSendAbort(null)
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    await fetch(`/api/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setPartners(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce partenaire ?')) return
    await fetch(`/api/partners/${id}`, { method: 'DELETE' })
    setPartners(prev => prev.filter(p => p.id !== id))
  }

  function openEdit(p: Partner) {
    setEditPartner(p)
    setEditForm({ email: p.email || '', notes: p.notes || '', projectId: p.projectId || '', commissionPaid: p.commissionPaid })
  }

  async function handleEditSave() {
    if (!editPartner) return
    const data: Record<string, unknown> = {
      email: editForm.email || null,
      notes: editForm.notes || null,
      projectId: editForm.projectId || null,
      commissionPaid: editForm.commissionPaid,
    }
    // Auto-calculate commission if project assigned
    if (editForm.projectId) {
      const proj = projects.find(p => p.id === editForm.projectId)
      if (proj?.price) {
        data.commissionAmount = Math.round(proj.price * 0.2 * 100) / 100
      }
    }
    if (editForm.commissionPaid && !editPartner.commissionPaid) {
      data.commissionPaidAt = new Date().toISOString()
    }
    const res = await fetch(`/api/partners/${editPartner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const updated = await res.json()
    setPartners(prev => prev.map(p => p.id === editPartner.id ? updated : p))
    setEditPartner(null)
  }

  async function handleDeleteSearch(id: string) {
    if (!confirm('Supprimer cette recherche et tous ses partenaires ?')) return
    // Delete all partners of this search, then delete search
    const searchPartners = partners.filter(p => p.search?.keyword && searches.find(s => s.id === id))
    for (const p of searchPartners) {
      await fetch(`/api/partners/${p.id}`, { method: 'DELETE' })
    }
    // For now just refresh
    fetchData()
  }

  // Partners for the active search
  const activeSearchPartners = useMemo(() => {
    if (!activeSearchId) return []
    const s = searches.find(s2 => s2.id === activeSearchId)
    if (!s) return []
    return partners.filter(p => p.search?.keyword === s.keyword && p.search?.location === s.location)
  }, [partners, activeSearchId, searches])

  const filtered = useMemo(() => {
    const base = activeSearchId ? activeSearchPartners : partners
    return base.filter(p => {
      if (filterStatus && p.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q)
      }
      return true
    })
  }, [partners, activeSearchPartners, activeSearchId, search, filterStatus])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(p => p.id)))
  }

  // Sub-tab for search detail view
  const [searchSubTab, setSearchSubTab] = useState<'liste' | 'stats'>('liste')

  // Stats computed for the active search (or all if none)
  const statsSource = activeSearchId ? activeSearchPartners : partners
  const contacted = statsSource.filter(p => ['MAIL_ENVOYE', 'RELANCE_1', 'RELANCE_2'].includes(p.status))
  const totalMailsSent = statsSource.filter(p => p.mailSentAt).length
  const totalOpens = statsSource.reduce((s, p) => s + (p.mailOpenCount || 0), 0)
  const uniqueOpens = statsSource.filter(p => (p.mailOpenCount || 0) > 0).length
  const openRate = totalMailsSent > 0 ? Math.round((uniqueOpens / totalMailsSent) * 100) : 0
  const stats = {
    total: statsSource.length,
    nouveau: statsSource.filter(p => p.status === 'NOUVEAU').length,
    mailEnvoye: contacted.length,
    totalMailsSent,
    totalOpens,
    uniqueOpens,
    openRate,
    rdvPris: statsSource.filter(p => p.status === 'RDV_PRIS').length,
    signe: statsSource.filter(p => p.status === 'SIGNE').length,
    refuse: statsSource.filter(p => p.status === 'REFUSE').length,
    totalCommission: statsSource.filter(p => p.commissionAmount).reduce((s, p) => s + (p.commissionAmount || 0), 0),
    paidCommission: statsSource.filter(p => p.commissionPaid && p.commissionAmount).reduce((s, p) => s + (p.commissionAmount || 0), 0),
    clientsRamenes: statsSource.filter(p => p.status === 'SIGNE' && p.projectId).length,
  }

  // Signed partners (nos partenaires)
  const signedPartners = partners.filter(p => p.status === 'SIGNE')

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Mailings</h1>
          {!activeSearchId && <p className="text-slate-400 text-sm mt-1">{partners.length} prospects · {signedPartners.length} signés</p>}
        </div>
        <button onClick={() => setShowScrape(true)}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Search size={16} /> Nouvelle liste
        </button>
      </div>

      {/* Main Tabs — hidden when inside a search */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {!(tab === 'list' && activeSearchId) && (
          <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
            <button onClick={() => { setTab('list'); setActiveSearchId(null); setSearchSubTab('liste') }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'list' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
              <Search size={13} className="inline mr-1" /> Recherches
            </button>
            <button onClick={() => setTab('signed')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'signed' ? 'bg-green-400/10 text-green-400' : 'text-slate-400 hover:text-white'}`}>
              <Users size={13} className="inline mr-1" /> Nos partenaires ({signedPartners.length})
            </button>
          </div>
        )}

        {tab === 'list' && activeSearchId && (
          <>
            <button onClick={() => { setActiveSearchId(null); setSearchSubTab('liste') }} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl px-3 py-2">
              <ChevronDown size={12} className="rotate-90" /> Retour
            </button>
            {/* Sub-tabs for search detail */}
            <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
              <button onClick={() => setSearchSubTab('liste')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchSubTab === 'liste' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-white'}`}>
                Liste
              </button>
              <button onClick={() => setSearchSubTab('stats')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchSubTab === 'stats' ? 'bg-cyan-400/10 text-cyan-400' : 'text-slate-400 hover:text-white'}`}>
                Statistiques
              </button>
            </div>
            {searchSubTab === 'liste' && (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                    className="bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors w-44" />
                </div>
                <select value={filterStatus || ''} onChange={e => setFilterStatus(e.target.value || null)}
                  className="bg-[#111118] border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="">Tous statuts</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </>
            )}
          </>
        )}
      </div>

      {/* ── LIST TAB ── */}
      {tab === 'list' && !activeSearchId && (
        /* ── Search cards view ── */
        <div className="space-y-3">
          {searches.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Search size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-3">Aucune recherche effectuée</p>
              <button onClick={() => setShowScrape(true)} className="text-[#E14B89] text-sm hover:opacity-80">Lancer une recherche</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searches.map(s => {
                const isScraping = s.scrapingStatus === 'SCRAPING'
                const scrapePercent = s.totalToScrape > 0 ? Math.min(99, Math.round((s.scrapedCount / s.totalToScrape) * 100)) : 0
                const searchPartners = partners.filter(p => p.search?.keyword === s.keyword && p.search?.location === s.location)
                const withEmail = searchPartners.filter(p => p.email).length
                const mailsSent = searchPartners.filter(p => p.mailSentAt).length
                const opens = searchPartners.filter(p => (p.mailOpenCount || 0) > 0).length
                const rdv = searchPartners.filter(p => p.status === 'RDV_PRIS').length
                const signe = searchPartners.filter(p => p.status === 'SIGNE').length
                const openRate = mailsSent > 0 ? Math.round((opens / mailsSent) * 100) : 0
                return (
                  <div key={s.id} className={`bg-[#111118] border rounded-2xl p-5 text-left transition-colors group relative ${isScraping ? 'border-[#E14B89]/30' : 'border-slate-800 hover:border-slate-700'}`}>
                    {isScraping ? (
                      /* ── Scraping in progress — blocked ── */
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-white font-semibold">{s.keyword}</h3>
                            <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5"><MapPin size={10} />{s.location}</p>
                          </div>
                          <span className="text-xs text-[#E14B89] bg-[#E14B89]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> Scraping
                          </span>
                        </div>
                        <div className="mb-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Recherche des emails...</span>
                            <span className="text-white font-medium">{scrapePercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${scrapePercent}%`, background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }} />
                          </div>
                          <p className="text-slate-600 text-[10px] mt-1">{Math.min(s.scrapedCount, s.totalToScrape)}/{s.totalToScrape} analyses · {withEmail} emails trouves</p>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal card — clickable ── */
                      <>
                        <button onClick={() => setActiveSearchId(s.id)} className="w-full text-left">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-white font-semibold group-hover:text-[#E14B89] transition-colors">{s.keyword}</h3>
                            <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5"><MapPin size={10} />{s.location}</p>
                          </div>
                          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{searchPartners.length}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center">
                            <p className="text-blue-400 font-bold text-sm">{mailsSent}</p>
                            <p className="text-slate-600 text-[9px]">Envoyés</p>
                          </div>
                          <div className="text-center">
                            <p className="text-cyan-400 font-bold text-sm">{openRate}%</p>
                            <p className="text-slate-600 text-[9px]">Ouverture</p>
                          </div>
                          <div className="text-center">
                            <p className="text-purple-400 font-bold text-sm">{rdv}</p>
                            <p className="text-slate-600 text-[9px]">RDV</p>
                          </div>
                          <div className="text-center">
                            <p className="text-green-400 font-bold text-sm">{signe}</p>
                            <p className="text-slate-600 text-[9px]">Signés</p>
                          </div>
                        </div>
                        <p className="text-slate-600 text-[10px] mt-3">{formatDate(s.createdAt)}</p>
                        </button>
                        <button onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm(`Supprimer la liste "${s.keyword} | ${s.location}" et tous ses partenaires ?`)) return
                          await fetch(`/api/partners/search/${s.id}`, { method: 'DELETE' })
                          fetchData()
                        }}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'list' && activeSearchId && (
        <>
          {/* Search header */}
          {(() => {
            const s = searches.find(s2 => s2.id === activeSearchId)
            const withEmailCount = filtered.filter(p => p.email).length
            return s ? (
              <div className="bg-[#111118] border border-slate-800 rounded-xl p-4 mb-4">
                <h3 className="text-white font-semibold">{s.name || `${s.keyword} | ${s.location}`}</h3>
                <p className="text-slate-500 text-xs">{filtered.length} résultats · {withEmailCount} avec email · {formatDate(s.createdAt)}</p>
              </div>
            ) : null
          })()}

          {/* ── Stats sub-tab ── */}
          {searchSubTab === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {[
                  { label: 'Total', value: stats.total, color: 'text-white' },
                  { label: 'Mails envoyés', value: stats.totalMailsSent, color: 'text-blue-400' },
                  { label: 'Ouvertures', value: `${stats.uniqueOpens} (${stats.openRate}%)`, color: 'text-cyan-400' },
                  { label: 'Contactés', value: stats.mailEnvoye, color: 'text-amber-400' },
                  { label: 'RDV pris', value: stats.rdvPris, color: 'text-purple-400' },
                  { label: 'Signés', value: stats.signe, color: 'text-green-400' },
                  { label: 'Refusés', value: stats.refuse, color: 'text-red-400' },
                  { label: 'Nouveaux', value: stats.nouveau, color: 'text-slate-400' },
                ].map(s => (
                  <div key={s.label} className="bg-[#111118] border border-slate-800 rounded-xl p-3 text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-slate-500 text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Conversion funnel */}
              <div className="bg-[#111118] border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">Entonnoir de conversion</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Prospects', count: stats.total, color: 'bg-slate-500' },
                    { label: 'Mail envoyé', count: stats.totalMailsSent, color: 'bg-blue-500' },
                    { label: 'Ouvert', count: stats.uniqueOpens, color: 'bg-cyan-500' },
                    { label: 'RDV pris', count: stats.rdvPris, color: 'bg-purple-500' },
                    { label: 'Signé', count: stats.signe, color: 'bg-green-500' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs w-24 text-right">{s.label}</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full flex items-center justify-end pr-2 transition-all`}
                          style={{ width: `${stats.total > 0 ? Math.max(2, (s.count / stats.total) * 100) : 0}%` }}>
                          {s.count > 0 && <span className="text-white text-[10px] font-medium">{s.count}</span>}
                        </div>
                      </div>
                      <span className="text-slate-500 text-[10px] w-12">{stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status breakdown */}
              <div className="bg-[#111118] border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-3">Répartition par statut</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => {
                    const count = statsSource.filter(p => p.status === key).length
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[key]}`}>{label}</span>
                        <span className="text-slate-400 text-xs">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Liste sub-tab ── */}
          {searchSubTab === 'liste' && <>
          {/* Bulk actions */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <button onClick={selectAll} className="text-xs text-slate-400 hover:text-white transition-colors">
                {selectedIds.size === filtered.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{selectedIds.size} sélectionné(s)</span>
                  <select value={mailType} onChange={e => setMailType(e.target.value as 'initial' | 'relance1' | 'relance2')}
                    className="bg-[#111118] border border-slate-800 rounded-lg px-2 py-1 text-white text-xs">
                    <option value="initial">Mail initial</option>
                    <option value="relance1">Relance 1</option>
                    <option value="relance2">Relance 2</option>
                  </select>
                  <button onClick={() => { setShowMailPreview(true); setScheduleDate(''); setSendProgress(null); fetchQuota(selectedIds.size) }} disabled={sending}
                    className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                    <Send size={12} /> Envoyer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-3 py-2.5 text-slate-500 text-xs w-8">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={selectAll} className="rounded border-slate-600" />
                    </th>
                    <th className="text-left px-3 py-2.5 text-slate-500 text-xs">Entreprise</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 text-xs">Secteur</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 text-xs">Contact</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 text-xs">Statut</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 text-xs">Note</th>
                    <th className="text-right px-3 py-2.5 text-slate-500 text-xs w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded border-slate-600" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-white font-medium text-sm">{p.name}</p>
                            {p.address && <p className="text-slate-500 text-[10px] flex items-center gap-1"><MapPin size={8} />{p.address.slice(0, 40)}</p>}
                            {p.rating && (
                              <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                <Star size={8} fill="currentColor" />{p.rating} ({p.reviewCount})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{p.category || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          {p.phone && (
                            <a href={`tel:${p.phone}`} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                              <Phone size={10} />{p.phone}
                            </a>
                          )}
                          {p.email ? (
                            <span className="text-xs text-slate-400 flex items-center gap-1"><Mail size={10} />{p.email}</span>
                          ) : (
                            <button onClick={() => openEdit(p)} className="text-[10px] text-amber-400 hover:text-amber-300">+ email</button>
                          )}
                          {p.website && (
                            <a href={p.website} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                              <Globe size={10} />Site
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="relative group">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer ${STATUS_COLORS[p.status]}`}>
                            {STATUS_LABELS[p.status]}
                          </span>
                          <div className="absolute left-0 top-full mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl shadow-xl z-20 py-1 w-32 hidden group-hover:block">
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <button key={k} onClick={() => handleUpdateStatus(p.id, k)}
                                className={`w-full text-left px-3 py-1 text-xs hover:bg-slate-800 ${p.status === k ? 'text-[#E14B89]' : 'text-slate-300'}`}>
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                        {p.mailSentAt && <p className="text-[9px] text-slate-600 mt-0.5">Envoyé {formatDate(p.mailSentAt)}</p>}
                        {(p.mailOpenCount ?? 0) > 0 && <p className="text-[9px] text-cyan-400 mt-0.5">Ouvert {p.mailOpenCount}x</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[120px] truncate">{p.notes || ''}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(p)} className="p-1 text-slate-600 hover:text-white transition-colors">
                            <Mail size={12} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">Aucun partenaire trouvé</div>
            )}
          </div>
          </>}
        </>
      )}

      {/* ── NOS PARTENAIRES TAB ── */}
      {tab === 'signed' && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-green-400">{signedPartners.length}</p>
              <p className="text-slate-500 text-xs">Partenaires signés</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-[#E14B89]">{signedPartners.filter(p => p.projectId).length}</p>
              <p className="text-slate-500 text-xs">Clients ramenés</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-[#F8903C]">{formatCurrency(signedPartners.reduce((s, p) => s + (p.commissionAmount || 0), 0))}</p>
              <p className="text-slate-500 text-xs">Total commissions</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-amber-400">{formatCurrency(signedPartners.filter(p => !p.commissionPaid).reduce((s, p) => s + (p.commissionAmount || 0), 0))}</p>
              <p className="text-slate-500 text-xs">En attente de paiement</p>
            </div>
          </div>

          {/* Partners cards */}
          {signedPartners.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Users size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun partenaire signé pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {signedPartners.map(p => (
                <div key={p.id} className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-lg">{p.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {p.category && <span className="text-slate-500 text-xs">{p.category}</span>}
                        {p.email && <a href={`mailto:${p.email}`} className="text-xs text-slate-400 hover:text-white flex items-center gap-1"><Mail size={10} />{p.email}</a>}
                        {p.phone && <a href={`tel:${p.phone}`} className="text-xs text-slate-400 hover:text-white flex items-center gap-1"><Phone size={10} />{p.phone}</a>}
                        {p.website && <a href={p.website} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Globe size={10} />Site</a>}
                      </div>
                    </div>
                    <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                      <Mail size={14} />
                    </button>
                  </div>

                  {/* Commission & project info */}
                  {p.project ? (
                    <div className="bg-[#0d0d14] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs">Client ramené</span>
                        <Link href={`/projects/${p.project.id}`} className="text-blue-400 hover:text-blue-300 text-sm font-medium">{p.project.name}</Link>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-slate-500 text-[10px]">Prix projet</p>
                          <p className="text-white text-sm font-medium">{formatCurrency(p.project.price)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px]">Commission ({p.commissionRate}%)</p>
                          <p className="text-[#E14B89] text-sm font-medium">{formatCurrency(p.commissionAmount || 0)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px]">Statut</p>
                          {p.commissionPaid ? (
                            <span className="text-green-400 text-sm flex items-center gap-1"><Check size={12} />Payée{p.commissionPaidAt && <span className="text-slate-600 text-[10px] ml-1">{formatDate(p.commissionPaidAt)}</span>}</span>
                          ) : (
                            <button onClick={() => { openEdit(p); setEditForm(f => ({ ...f, commissionPaid: true })) }}
                              className="text-amber-400 text-sm hover:text-amber-300 font-medium">Marquer payée</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#0d0d14] rounded-xl p-4 flex items-center justify-between">
                      <span className="text-slate-500 text-xs">Aucun client ramené pour le moment</span>
                      <button onClick={() => openEdit(p)} className="text-[#E14B89] text-xs hover:opacity-80">Assigner un projet</button>
                    </div>
                  )}

                  {p.notes && <p className="text-slate-500 text-xs mt-3">{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MAIL PREVIEW MODAL ── */}
      {showMailPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => { if (!sending) { setShowMailPreview(false); setSendProgress(null) } }} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={18} /></button>

            <div className="p-6">
              {/* ── SENDING PROGRESS VIEW ── */}
              {sendProgress ? (
                <div>
                  <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                    {sendProgress.step === 'done' ? <ShieldCheck size={20} className="text-green-400" /> :
                     sendProgress.step === 'auto_stop' ? <ShieldAlert size={20} className="text-red-400" /> :
                     sendProgress.step === 'cancelled' ? <X size={20} className="text-amber-400" /> :
                     <Loader2 size={20} className="animate-spin text-blue-400" />}
                    {sendProgress.step === 'done' ? 'Envoi terminé' :
                     sendProgress.step === 'auto_stop' ? 'Envoi stoppé' :
                     sendProgress.step === 'cancelled' ? 'Envoi annulé' :
                     'Envoi en cours...'}
                  </h2>

                  {/* Progress bar */}
                  <div className="bg-slate-800 rounded-full h-3 mb-4 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${sendProgress.progress || 0}%`,
                        background: sendProgress.step === 'auto_stop' ? '#ef4444' :
                                   sendProgress.step === 'done' ? '#22c55e' :
                                   'linear-gradient(135deg, #E14B89, #F8903C)',
                      }} />
                  </div>

                  {/* Current status message */}
                  <p className={`text-sm mb-4 ${
                    sendProgress.step === 'auto_stop' ? 'text-red-400' :
                    sendProgress.step === 'error' ? 'text-red-400' :
                    sendProgress.step === 'sent' ? 'text-green-400' :
                    sendProgress.step === 'waiting' || sendProgress.step === 'batch_pause' ? 'text-amber-400' :
                    'text-slate-400'
                  }`}>{sendProgress.message}</p>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-[#0d0d14] rounded-lg p-3 text-center">
                      <p className="text-green-400 font-bold text-lg">{sendProgress.sent || 0}</p>
                      <p className="text-slate-500 text-[10px]">Envoyés</p>
                    </div>
                    <div className="bg-[#0d0d14] rounded-lg p-3 text-center">
                      <p className="text-red-400 font-bold text-lg">{sendProgress.failed || 0}</p>
                      <p className="text-slate-500 text-[10px]">Echecs</p>
                    </div>
                    <div className="bg-[#0d0d14] rounded-lg p-3 text-center">
                      <p className="text-amber-400 font-bold text-lg">{sendProgress.bounced || 0}</p>
                      <p className="text-slate-500 text-[10px]">Bounce</p>
                    </div>
                    <div className="bg-[#0d0d14] rounded-lg p-3 text-center">
                      <p className="text-slate-400 font-bold text-lg">{sendProgress.skippedInvalid || 0}</p>
                      <p className="text-slate-500 text-[10px]">Invalides</p>
                    </div>
                  </div>

                  {/* Invalid emails detail */}
                  {sendProgress.invalidEmails && sendProgress.invalidEmails.length > 0 && (
                    <div className="bg-[#0d0d14] rounded-xl p-3 mb-4">
                      <p className="text-amber-400 text-xs font-medium mb-2">Emails invalides retirés :</p>
                      <div className="max-h-20 overflow-y-auto space-y-1">
                        {sendProgress.invalidEmails.map((e, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">{e.email}</span>
                            <span className="text-red-400">{e.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    {sending ? (
                      <button onClick={handleCancelSend}
                        className="flex-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                        <X size={14} /> Annuler l&apos;envoi
                      </button>
                    ) : (
                      <button onClick={() => { setShowMailPreview(false); setSendProgress(null) }}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl text-sm transition-colors">
                        Fermer
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ── PREVIEW VIEW (before sending) ── */
                <>
                  <h2 className="text-white font-semibold text-lg mb-4">Envoyer des mails</h2>

                  {/* 1. Sender selector */}
                  <div className="bg-[#0d0d14] rounded-xl p-4 mb-3">
                    <label className="block text-slate-400 text-xs mb-2">Expéditeur</label>
                    <div className="flex gap-2">
                      {(Object.entries(SENDERS) as [keyof typeof SENDERS, typeof SENDERS[keyof typeof SENDERS]][]).map(([key, s]) => (
                        <button key={key} onClick={() => setSenderId(key)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${senderId === key ? 'bg-[#E14B89]/15 text-[#E14B89] border border-[#E14B89]/30' : 'bg-slate-800 text-slate-400 border border-transparent hover:text-white'}`}>
                          <span className="block">{s.label}</span>
                          <span className="block text-[10px] opacity-60 mt-0.5">{s.email}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Subject (editable) */}
                  <div className="bg-[#0d0d14] rounded-xl px-4 py-3 mb-3">
                    <label className="block text-slate-400 text-xs mb-1.5">Objet</label>
                    <input
                      type="text"
                      value={customSubject || DEFAULT_SUBJECTS[mailType]}
                      onChange={e => setCustomSubject(e.target.value)}
                      placeholder={DEFAULT_SUBJECTS[mailType]}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89]"
                    />
                  </div>

                  {/* 3. Mail type selector */}
                  <div className="bg-[#0d0d14] rounded-xl p-4 mb-3">
                    <label className="block text-slate-400 text-xs mb-2">Type de mail</label>
                    <div className="flex gap-2">
                      {[
                        { key: 'initial' as const, label: 'Initial' },
                        { key: 'relance1' as const, label: 'Relance 1' },
                        { key: 'relance2' as const, label: 'Relance 2' },
                      ].map(t => (
                        <button key={t.key} onClick={() => { setMailType(t.key); setCustomSubject('') }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mailType === t.key ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 bg-slate-800 hover:text-white'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Recipients summary */}
                  <div className="bg-[#0d0d14] rounded-xl p-4 mb-3">
                    <p className="text-slate-400 text-xs mb-2">Destinataires ({selectedIds.size})</p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {filtered.filter(p => selectedIds.has(p.id)).map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-white">{p.name}</span>
                          <span className={p.email ? 'text-slate-400' : 'text-red-400'}>{p.email || 'Pas d\'email'}</span>
                        </div>
                      ))}
                    </div>
                    {filtered.filter(p => selectedIds.has(p.id) && !p.email).length > 0 && (
                      <p className="text-amber-400 text-[10px] mt-2">{filtered.filter(p => selectedIds.has(p.id) && !p.email).length} partenaire(s) sans email seront ignorés</p>
                    )}
                  </div>

                  {/* 5. Risk gauge */}
                  {riskInfo && (
                    <div className="rounded-xl px-4 py-3 mb-3 flex items-center gap-3" style={{ background: `${riskInfo.color}10`, border: `1px solid ${riskInfo.color}30` }}>
                      {riskInfo.level === 'safe' ? <ShieldCheck size={18} style={{ color: riskInfo.color }} /> :
                       riskInfo.level === 'warning' ? <AlertTriangle size={18} style={{ color: riskInfo.color }} /> :
                       <ShieldAlert size={18} style={{ color: riskInfo.color }} />}
                      <div className="flex-1">
                        <p className="text-xs font-medium" style={{ color: riskInfo.color }}>{riskInfo.message}</p>
                        {sendEstimate && (
                          <p className="text-slate-500 text-[10px] mt-0.5 flex items-center gap-1">
                            <Clock size={10} /> Durée estimée : {sendEstimate.description} ({sendEstimate.batches} vague{sendEstimate.batches > 1 ? 's' : ''})
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 6. Quota info */}
                  {quota && (
                    <div className="bg-[#0d0d14] rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
                      <span className="text-slate-500 text-xs">Quota du jour</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-800 rounded-full h-1.5">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, (quota.sent / quota.maxToday) * 100)}%`,
                            background: quota.sent / quota.maxToday > 0.8 ? '#ef4444' : quota.sent / quota.maxToday > 0.5 ? '#f59e0b' : '#22c55e',
                          }} />
                        </div>
                        <span className="text-xs text-slate-400">{quota.sent}/{quota.maxToday} envoyés · {quota.remaining} restant{quota.remaining > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}

                  {/* 7. Action plan summary */}
                  <div className="bg-[#0d0d14] rounded-xl p-4 mb-4">
                    <p className="text-slate-400 text-xs mb-2.5 flex items-center gap-1.5"><ShieldCheck size={12} className="text-green-400" /> Plan d&apos;action</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded px-1.5 py-0.5 font-mono flex-shrink-0">1</span>
                        <p className="text-slate-400 text-[11px]">Vérification de {selectedIds.size} email(s) — syntaxe, domaine MX, jetables retirés automatiquement</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded px-1.5 py-0.5 font-mono flex-shrink-0">2</span>
                        <p className="text-slate-400 text-[11px]">
                          Envoi en {sendEstimate ? sendEstimate.batches : Math.ceil(selectedIds.size / 15)} vague(s) de 15 max
                          {sendEstimate && sendEstimate.batches > 1 && <> — pause de 1h entre chaque vague</>}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded px-1.5 py-0.5 font-mono flex-shrink-0">3</span>
                        <p className="text-slate-400 text-[11px]">Délai aléatoire de 30 à 90 secondes entre chaque email (pattern humain)</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded px-1.5 py-0.5 font-mono flex-shrink-0">4</span>
                        <p className="text-slate-400 text-[11px]">Surveillance en temps réel — arrêt automatique si taux de bounce &gt; 5%</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded px-1.5 py-0.5 font-mono flex-shrink-0">5</span>
                        <p className="text-slate-400 text-[11px]">Chaque mail contient un lien de désinscription (RGPD) + tracking pixel</p>
                      </div>
                      {quota && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded px-1.5 py-0.5 font-mono flex-shrink-0">6</span>
                          <p className="text-slate-400 text-[11px]">
                            Quota : {quota.remaining} mail(s) restant(s) aujourd&apos;hui sur {quota.maxToday} max
                            {selectedIds.size > quota.remaining && <span className="text-red-400"> — seuls les {quota.remaining} premiers seront envoyés</span>}
                          </p>
                        </div>
                      )}
                    </div>
                    {sendEstimate && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800">
                        <p className="text-xs text-white flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-500" />
                          Durée totale estimée : <strong>{sendEstimate.description}</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 8. Mail preview (last, collapsible) */}
                  <details className="mb-4 group">
                    <summary className="text-slate-400 text-xs cursor-pointer hover:text-white transition-colors flex items-center gap-1.5 mb-2">
                      <ChevronDown size={12} className="group-open:rotate-180 transition-transform" /> Aperçu du contenu
                    </summary>
                    <div className="bg-white rounded-xl overflow-hidden">
                      <div className="h-1" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }} />
                      <div className="p-6">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/kameo-logo-light.svg" alt="Kameo" className="h-6 mx-auto mb-5" />

                        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                          {mailType === 'initial' && <><strong className="text-gray-900">Chaque mois, des clients vous sollicitent pour des projets web que vous ne pouvez pas traiter, et ce chiffre d&apos;affaires vous échappe.</strong><br/><br/>Je me permets de vous contacter car je sais que <strong className="text-gray-900">[Nom entreprise]</strong> reçoit ce type de demandes. Résultat : <strong className="text-gray-900">le client part ailleurs, et vous perdez une opportunité de revenus</strong>.</>}
                          {mailType === 'relance1' && <>Je reviens vers vous suite à mon précédent message. J&apos;imagine que votre planning est chargé, c&apos;est justement pour ça que notre partenariat ne vous demande aucun temps.</>}
                          {mailType === 'relance2' && <>Dernier message de ma part. Si le timing n&apos;est pas le bon, gardez simplement mes coordonnées.</>}
                        </p>

                        <p className="text-gray-600 text-sm mb-5 leading-relaxed">Nous sommes <strong className="text-gray-900">Agence Kameo</strong>, spécialisée dans la <strong className="text-gray-900">création de sites internet haut de gamme et de web apps personnalisées</strong>. On s&apos;occupe de tout.</p>

                        <div className="bg-gray-50 rounded-lg p-5 mb-5">
                          <h4 className="text-gray-900 font-medium text-sm mb-3">Ce que ça change pour vous :</h4>
                          <ul className="text-gray-600 text-xs space-y-2 list-disc pl-4 leading-relaxed">
                            <li><strong>Vous ne perdez plus de clients</strong> : transmettez-nous la demande</li>
                            <li><strong className="bg-gradient-to-r from-[#E14B89] to-[#F8903C] bg-clip-text text-transparent">20% de commission</strong> sur chaque mission (sites a partir de 2 000&#8364;)</li>
                            <li><strong>Commission payée sous 48h</strong> après paiement du client</li>
                            <li><strong>Zéro effort, zéro temps</strong> : un message suffit</li>
                            <li><strong>Concrètement</strong> : un seul client transmis peut vous rapporter <strong className="bg-gradient-to-r from-[#E14B89] to-[#F8903C] bg-clip-text text-transparent">entre 400&#8364; et 2 000&#8364;</strong></li>
                          </ul>
                        </div>

                        <div className="flex gap-2 justify-center mb-5">
                          <span className="inline-block text-white text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
                            Prendre rendez-vous
                          </span>
                          <span className="inline-block text-white text-xs font-semibold px-4 py-2 rounded-lg bg-[#25D366]">
                            WhatsApp
                          </span>
                        </div>

                        {/* Signature */}
                        <div className="border-t border-gray-200 pt-5 flex items-start gap-7">
                          <div className="flex flex-col items-center gap-4 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/benjamin-dayan.png" alt="Benjamin" className="w-14 h-14 rounded-full object-cover" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/kameo-logo-light.png" alt="Kameo" className="w-10 rounded-lg" />
                          </div>
                          <div>
                            <p className="text-gray-900 text-sm font-semibold">Benjamin Dayan</p>
                            <p className="text-gray-500 text-[11px] mt-1">Directeur commercial</p>
                            <p className="text-gray-500 text-[11px] mt-1">Agence Kameo</p>
                            <div className="mt-3.5">
                              <p className="text-gray-500 text-[11px]">06 62 37 99 85</p>
                              <p className="text-gray-500 text-[11px] mt-1">contact@agence-kameo.fr</p>
                              <a href="https://www.agence-kameo.fr" target="_blank" rel="noopener" className="text-[11px] mt-1 block bg-gradient-to-r from-[#E14B89] to-[#F8903C] bg-clip-text text-transparent font-medium">www.agence-kameo.fr</a>
                            </div>
                          </div>
                        </div>

                        {/* Unsubscribe footer preview */}
                        <div className="border-t border-gray-200 mt-5 pt-3 text-center">
                          <p className="text-gray-300 text-[10px]">Se désinscrire</p>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* 9. Action buttons */}
                  <div className="flex gap-3">
                    <button onClick={() => { setShowMailPreview(false); setSendProgress(null) }}
                      className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                      Annuler
                    </button>
                    <button onClick={handleSendMails} disabled={sending || (riskInfo?.level === 'danger')}
                      className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                      {sending ? <><Loader2 size={14} className="animate-spin" /> Envoi...</> : <><Send size={14} /> Envoyer ({selectedIds.size})</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SCRAPE MODAL ── */}
      {showScrape && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md relative">
            <button onClick={() => { if (!scraping) setShowScrape(false) }} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={18} /></button>
            <h2 className="text-white font-semibold text-lg mb-4">Recherche Google Maps</h2>
            <form onSubmit={handleScrape} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom de la liste</label>
                <input value={scrapeName} onChange={e => setScrapeName(e.target.value)} placeholder="Ex: Comptables IDF mars 2026"
                  disabled={scraping}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] disabled:opacity-50 disabled:cursor-not-allowed" autoFocus />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Secteur d&apos;activite / Mot-cle *</label>
                <input value={scrapeKeyword} onChange={e => setScrapeKeyword(e.target.value)} placeholder="Ex: agence immobiliere, architecte, comptable..."
                  disabled={scraping}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Villes / Zones * <span className="text-slate-600">({scrapeLocations.length} sélectionnée{scrapeLocations.length > 1 ? 's' : ''})</span></label>
                <div className={`grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto ${scraping ? 'opacity-50 pointer-events-none' : ''}`}>
                  {LOCATIONS.map(l => {
                    const selected = scrapeLocations.includes(l)
                    return (
                      <button key={l} type="button"
                        onClick={() => setScrapeLocations(prev => selected ? prev.filter(x => x !== l) : [...prev, l])}
                        disabled={scraping}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                          selected ? 'bg-[#E14B89]/15 border border-[#E14B89]/40 text-white' : 'bg-[#1a1a24] border border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}>
                        {l}
                      </button>
                    )
                  })}
                </div>
                {!scraping && (
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => setScrapeLocations([...LOCATIONS])} className="text-[10px] text-slate-500 hover:text-white">Tout sélectionner</button>
                    <button type="button" onClick={() => setScrapeLocations([])} className="text-[10px] text-slate-500 hover:text-white">Tout désélectionner</button>
                  </div>
                )}
              </div>
              {!scraping && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Filtres</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'website', label: 'Site web', options: [['all','Tous'],['with','Avec'],['without','Sans']] },
                      { key: 'address', label: 'Adresse', options: [['all','Tous'],['with','Avec'],['without','Sans']] },
                      { key: 'type', label: 'Type', options: [['all','Tous'],['company','Societes'],['freelance','Independants']] },
                    ].map(f => (
                      <div key={f.key} className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">{f.label}</span>
                        <select value={(scrapeFilters as Record<string, unknown>)[f.key] as string} onChange={e => setScrapeFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="flex-1 bg-transparent text-white text-xs focus:outline-none min-w-0">
                          {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">Note</span>
                      <select value={scrapeFilters.minRating} onChange={e => setScrapeFilters(f => ({ ...f, minRating: Number(e.target.value) }))}
                        className="flex-1 bg-transparent text-white text-xs focus:outline-none min-w-0">
                        <option value={0}>Toutes</option><option value={3}>3+</option><option value={3.5}>3.5+</option><option value={4}>4+</option><option value={4.5}>4.5+</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">Avis</span>
                      <select value={scrapeFilters.minReviews} onChange={e => setScrapeFilters(f => ({ ...f, minReviews: Number(e.target.value) }))}
                        className="flex-1 bg-transparent text-white text-xs focus:outline-none min-w-0">
                        <option value={0}>Tous</option><option value={1}>1+</option><option value={3}>3+</option><option value={5}>5+</option><option value={10}>10+</option><option value={20}>20+</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {scraping && (
                <div className="space-y-2">
                  {scrapeLocations.length > 1 && scrapeCurrentCity && (
                    <p className="text-[#E14B89] text-xs font-medium">{scrapeCurrentCity} ({scrapeLocations.indexOf(scrapeCurrentCity) + 1}/{scrapeLocations.length})</p>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{scrapeMessage}</span>
                    <span className="text-white font-medium">{scrapeProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${scrapeProgress}%`, background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }} />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                {scraping ? (
                  <>
                    <button type="button" onClick={handleCancelScrape}
                      className="flex-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      <X size={14} /> Annuler
                    </button>
                    <div className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] opacity-70 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> En cours...
                    </div>
                  </>
                ) : (
                  <button type="submit" disabled={!scrapeKeyword.trim() || scrapeLocations.length === 0}
                    className="w-full bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                    <Search size={14} /> Lancer la recherche
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editPartner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md relative">
            <button onClick={() => setEditPartner(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={18} /></button>
            <h2 className="text-white font-semibold mb-4">{editPartner.name}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Email</label>
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemple.fr" type="email"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89]" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] resize-none" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Projet lié</label>
                <select value={editForm.projectId} onChange={e => setEditForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="">Aucun</option>
                  {projects.filter(p => p.price).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price!)})</option>
                  ))}
                </select>
              </div>
              {editForm.projectId && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.commissionPaid} onChange={e => setEditForm(f => ({ ...f, commissionPaid: e.target.checked }))}
                    className="rounded border-slate-700 bg-[#1a1a24] text-[#E14B89]" />
                  <span className="text-slate-300 text-sm">Commission payée</span>
                </label>
              )}
              <button onClick={handleEditSave}
                className="w-full bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
