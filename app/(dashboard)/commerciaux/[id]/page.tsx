'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Pencil, Phone, Mail, Users2, Play, FileText,
  Euro, Upload, Check, X, ChevronDown, Loader2, Briefcase, Calendar,
  DollarSign, CheckCircle2,
} from 'lucide-react'
import { formatCurrency, formatDate, formatPhone, ROLE_AVATAR_COLORS } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prospect {
  id: string; name: string; company?: string; email?: string; phone?: string
  status: string; budget?: number; source?: string; notes?: string; assignedTo?: string
}

interface Relance {
  id: string; prospectId: string; userId: string; type: string; date: string
  notes?: string; done: boolean; prospect: { name: string; company?: string }
}

interface Video {
  id: string; title: string; url: string; description?: string; category?: string
}

interface Speech {
  id: string; userId: string; title: string; content: string; updatedAt: string
}

interface Commission {
  id: string; userId: string; prospectId?: string; amount: number; type: string
  date: string; notes?: string; paid: boolean; prospect?: { name: string }
}

interface UserInfo {
  id: string; name: string; email: string; role: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Tab = 'leads' | 'relances' | 'videos' | 'speech' | 'commissions'

const TABS: { key: Tab; label: string }[] = [
  { key: 'leads', label: 'Leads' },
  { key: 'relances', label: 'Relances' },
  { key: 'videos', label: 'Videos' },
  { key: 'speech', label: 'Speech' },
  { key: 'commissions', label: 'Commissions' },
]

const STATUS_LABELS: Record<string, string> = {
  A_CONTACTER: 'A contacter',
  A_RAPPELER: 'A rappeler',
  VISIO_PLANIFIE: 'Visio planifiée',
  DEVIS_TRANSMETTRE: 'Devis à transmettre',
  DEVIS_ENVOYE: 'Devis envoyé',
  A_RELANCER: 'A relancer',
  REFUSE: 'Refusé',
  SIGNE: 'Signé',
}

const STATUS_COLORS: Record<string, string> = {
  A_CONTACTER: 'bg-slate-500/15 text-slate-400',
  A_RAPPELER: 'bg-yellow-500/15 text-yellow-400',
  VISIO_PLANIFIE: 'bg-indigo-500/15 text-indigo-400',
  DEVIS_TRANSMETTRE: 'bg-blue-500/15 text-blue-400',
  DEVIS_ENVOYE: 'bg-orange-500/15 text-orange-400',
  A_RELANCER: 'bg-amber-500/15 text-amber-400',
  REFUSE: 'bg-red-500/15 text-red-400',
  SIGNE: 'bg-green-500/15 text-green-400',
}

const RELANCE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  APPEL: { label: 'Appel', icon: Phone, color: 'bg-blue-500/15 text-blue-400' },
  EMAIL: { label: 'Email', icon: Mail, color: 'bg-green-500/15 text-green-400' },
  REUNION: { label: 'Reunion', icon: Users2, color: 'bg-purple-500/15 text-purple-400' },
}

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  SIGNATURE: 'Signature',
  BONUS: 'Bonus',
  PARRAINAGE: 'Parrainage',
}

const COMMISSION_TYPE_COLORS: Record<string, string> = {
  SIGNATURE: 'bg-emerald-500/15 text-emerald-400',
  BONUS: 'bg-amber-500/15 text-amber-400',
  PARRAINAGE: 'bg-purple-500/15 text-purple-400',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]{11})/)
  return m ? m[1] : null
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------

const inputClass =
  'w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors'
const selectClass = inputClass
const textareaClass = inputClass + ' resize-none'
const labelClass = 'block text-slate-400 text-xs mb-1.5'

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CommercialDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  // ---- State ----
  const [user, setUser] = useState<UserInfo | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('leads')
  const [loading, setLoading] = useState(true)

  // Leads
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [leadFilter, setLeadFilter] = useState<string>('ALL')
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [editLead, setEditLead] = useState<Prospect | null>(null)
  const [leadForm, setLeadForm] = useState({ firstName: '', lastName: '', company: '', email: '', phone: '', budget: '', source: '', notes: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // Relances
  const [relances, setRelances] = useState<Relance[]>([])
  const [showRelanceModal, setShowRelanceModal] = useState(false)
  const [relanceForm, setRelanceForm] = useState({ prospectId: '', type: 'APPEL', date: '', notes: '' })

  // Videos
  const [videos, setVideos] = useState<Video[]>([])
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoForm, setVideoForm] = useState({ title: '', url: '', description: '', category: '' })

  // Speech
  const [speeches, setSpeeches] = useState<Speech[]>([])
  const [showSpeechModal, setShowSpeechModal] = useState(false)
  const [editSpeech, setEditSpeech] = useState<Speech | null>(null)
  const [speechForm, setSpeechForm] = useState({ title: '', content: '' })
  const [expandedSpeech, setExpandedSpeech] = useState<string | null>(null)

  // Commissions
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [showCommissionModal, setShowCommissionModal] = useState(false)
  const [commissionForm, setCommissionForm] = useState({ amount: '', type: 'SIGNATURE', date: '', prospectId: '', notes: '', paid: false })

  // ---- Load user info ----
  useEffect(() => {
    if (!id) return
    async function loadUser() {
      try {
        const res = await fetch('/api/users')
        const users: UserInfo[] = await res.json()
        const found = users.find(u => u.id === id)
        setUser(found ?? null)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [id])

  // ---- Load tab data ----
  const loadLeads = useCallback(async () => {
    const res = await fetch(`/api/prospects?userId=${id}`)
    const data = await res.json()
    if (Array.isArray(data)) setProspects(data)
  }, [id])

  const loadRelances = useCallback(async () => {
    const res = await fetch(`/api/relances?userId=${id}`)
    const data = await res.json()
    if (Array.isArray(data)) setRelances(data)
  }, [id])

  const loadVideos = useCallback(async () => {
    const res = await fetch('/api/commercial-videos')
    const data = await res.json()
    if (Array.isArray(data)) setVideos(data)
  }, [])

  const loadSpeeches = useCallback(async () => {
    const res = await fetch(`/api/speeches?userId=${id}`)
    const data = await res.json()
    if (Array.isArray(data)) setSpeeches(data)
  }, [id])

  const loadCommissions = useCallback(async () => {
    const res = await fetch(`/api/commissions?userId=${id}`)
    const data = await res.json()
    if (Array.isArray(data)) setCommissions(data)
  }, [id])

  useEffect(() => {
    if (!id) return
    if (activeTab === 'leads') loadLeads()
    else if (activeTab === 'relances') { loadRelances(); loadLeads() }
    else if (activeTab === 'videos') loadVideos()
    else if (activeTab === 'speech') loadSpeeches()
    else if (activeTab === 'commissions') { loadCommissions(); loadLeads() }
  }, [activeTab, id, loadLeads, loadRelances, loadVideos, loadSpeeches, loadCommissions])

  // ---- Lead handlers ----
  function openLeadModal(item?: Prospect) {
    if (item) {
      setEditLead(item)
      const parts = item.name.split(' ')
      const firstName = parts[0] ?? ''
      const lastName = parts.slice(1).join(' ')
      setLeadForm({
        firstName,
        lastName,
        company: item.company ?? '',
        email: item.email ?? '',
        phone: item.phone ?? '',
        budget: item.budget?.toString() ?? '',
        source: item.source ?? '',
        notes: item.notes ?? '',
      })
    } else {
      setEditLead(null)
      setLeadForm({ firstName: '', lastName: '', company: '', email: '', phone: '', budget: '', source: '', notes: '' })
    }
    setShowLeadModal(true)
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: `${leadForm.firstName.trim()} ${leadForm.lastName.trim()}`.trim(),
      company: leadForm.company || null,
      email: leadForm.email || null,
      phone: leadForm.phone || null,
      budget: leadForm.budget ? parseFloat(leadForm.budget) : null,
      source: leadForm.source || null,
      notes: leadForm.notes || null,
      assignedTo: id,
      status: editLead?.status ?? 'A_CONTACTER',
    }
    if (editLead) {
      const res = await fetch(`/api/prospects/${editLead.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const updated = await res.json()
      setProspects(prev => prev.map(p => p.id === editLead.id ? updated : p))
    } else {
      const res = await fetch('/api/prospects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json()
      setProspects(prev => [created, ...prev])
    }
    setShowLeadModal(false)
  }

  async function deleteLead(leadId: string) {
    if (!confirm('Supprimer ce lead ?')) return
    await fetch(`/api/prospects/${leadId}`, { method: 'DELETE' })
    setProspects(prev => prev.filter(p => p.id !== leadId))
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('userId', id)
      const res = await fetch('/api/prospects/import', { method: 'POST', body: fd })
      if (res.ok) {
        await loadLeads()
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur lors de l\'import')
      }
    } catch {
      alert('Erreur lors de l\'import')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ---- Inline status change ----
  async function changeLeadStatus(leadId: string, newStatus: string) {
    setStatusDropdownId(null)
    const res = await fetch(`/api/prospects/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProspects(prev => prev.map(p => p.id === leadId ? updated : p))
    }
  }

  // Close status dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownId(null)
      }
    }
    if (statusDropdownId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownId])

  // ---- Relance handlers ----
  function openRelanceModal() {
    setRelanceForm({ prospectId: prospects[0]?.id ?? '', type: 'APPEL', date: new Date().toISOString().slice(0, 10), notes: '' })
    setShowRelanceModal(true)
  }

  async function submitRelance(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/relances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...relanceForm, userId: id }),
    })
    const created = await res.json()
    setRelances(prev => [...prev, created])
    setShowRelanceModal(false)
  }

  async function toggleRelanceDone(relance: Relance) {
    const res = await fetch(`/api/relances/${relance.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !relance.done }),
    })
    const updated = await res.json()
    setRelances(prev => prev.map(r => r.id === relance.id ? updated : r))
  }

  async function deleteRelance(relanceId: string) {
    if (!confirm('Supprimer cette relance ?')) return
    await fetch(`/api/relances/${relanceId}`, { method: 'DELETE' })
    setRelances(prev => prev.filter(r => r.id !== relanceId))
  }

  // ---- Video handlers ----
  function openVideoModal() {
    setVideoForm({ title: '', url: '', description: '', category: '' })
    setShowVideoModal(true)
  }

  async function submitVideo(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/commercial-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoForm),
    })
    const created = await res.json()
    setVideos(prev => [created, ...prev])
    setShowVideoModal(false)
  }

  async function deleteVideo(videoId: string) {
    if (!confirm('Supprimer cette video ?')) return
    await fetch(`/api/commercial-videos/${videoId}`, { method: 'DELETE' })
    setVideos(prev => prev.filter(v => v.id !== videoId))
  }

  // ---- Speech handlers ----
  function openSpeechModal(item?: Speech) {
    if (item) {
      setEditSpeech(item)
      setSpeechForm({ title: item.title, content: item.content })
    } else {
      setEditSpeech(null)
      setSpeechForm({ title: '', content: '' })
    }
    setShowSpeechModal(true)
  }

  async function submitSpeech(e: React.FormEvent) {
    e.preventDefault()
    if (editSpeech) {
      const res = await fetch(`/api/speeches/${editSpeech.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(speechForm),
      })
      const updated = await res.json()
      setSpeeches(prev => prev.map(s => s.id === editSpeech.id ? updated : s))
    } else {
      const res = await fetch('/api/speeches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...speechForm, userId: id }),
      })
      const created = await res.json()
      setSpeeches(prev => [created, ...prev])
    }
    setShowSpeechModal(false)
  }

  async function deleteSpeech(speechId: string) {
    if (!confirm('Supprimer ce speech ?')) return
    await fetch(`/api/speeches/${speechId}`, { method: 'DELETE' })
    setSpeeches(prev => prev.filter(s => s.id !== speechId))
  }

  // ---- Commission handlers ----
  function openCommissionModal() {
    setCommissionForm({ amount: '', type: 'SIGNATURE', date: new Date().toISOString().slice(0, 10), prospectId: '', notes: '', paid: false })
    setShowCommissionModal(true)
  }

  async function submitCommission(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: id,
        amount: parseFloat(commissionForm.amount),
        type: commissionForm.type,
        date: commissionForm.date,
        prospectId: commissionForm.prospectId || null,
        notes: commissionForm.notes || null,
        paid: commissionForm.paid,
      }),
    })
    const created = await res.json()
    setCommissions(prev => [created, ...prev])
    setShowCommissionModal(false)
  }

  async function toggleCommissionPaid(commission: Commission) {
    const res = await fetch(`/api/commissions/${commission.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: !commission.paid }),
    })
    const updated = await res.json()
    setCommissions(prev => prev.map(c => c.id === commission.id ? updated : c))
  }

  async function deleteCommission(commissionId: string) {
    if (!confirm('Supprimer cette commission ?')) return
    await fetch(`/api/commissions/${commissionId}`, { method: 'DELETE' })
    setCommissions(prev => prev.filter(c => c.id !== commissionId))
  }

  // ---- Filtered leads ----
  const filteredLeads = leadFilter === 'ALL'
    ? prospects
    : prospects.filter(p => p.status === leadFilter)

  // ---- Commission summary ----
  const totalCommissions = commissions.reduce((s, c) => s + c.amount, 0)
  const paidCommissions = commissions.filter(c => c.paid).reduce((s, c) => s + c.amount, 0)
  const pendingCommissions = commissions.filter(c => !c.paid).reduce((s, c) => s + c.amount, 0)

  // ---- Loading / not found ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a12]">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a12] gap-4">
        <p className="text-slate-400">Utilisateur introuvable</p>
        <Link href="/commerciaux" className="text-sm text-[#E14B89] hover:underline">Retour</Link>
      </div>
    )
  }

  const gradient = ROLE_AVATAR_COLORS[user.role] ?? ROLE_AVATAR_COLORS.COMMERCIAL
  const initials = getInitials(user.name)

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="p-4 sm:p-8 min-h-screen">
      {/* ----------------------------------------------------------------- */}
      {/* HEADER                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/commerciaux" className="p-2 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{user.name}</h1>
          <p className="text-slate-500 text-sm">{user.email}</p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TABS                                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[#E14B89] text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TAB: LEADS                                                        */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'leads' && (
        <div>
          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-3 mb-5 justify-end">
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Importer Excel
            </button>
            <button onClick={() => openLeadModal()} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
              <Plus size={16} /> Ajouter un lead
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[{ key: 'ALL', label: 'Tous' }, ...Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label }))].map(f => (
              <button
                key={f.key}
                onClick={() => setLeadFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  leadFilter === f.key
                    ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                    : 'bg-[#111118] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Leads list */}
          {filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Briefcase size={24} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Aucun lead</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLeads.map(lead => (
                <div
                  key={lead.id}
                  className="bg-[#111118] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group cursor-pointer"
                  onClick={() => openLeadModal(lead)}
                >
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 w-[180px] flex-shrink-0">
                      <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                      {lead.company && <p className="text-slate-500 text-xs truncate">{lead.company}</p>}
                    </div>
                    <div className="relative flex-shrink-0" ref={statusDropdownId === lead.id ? statusDropdownRef : undefined}>
                      <button
                        onClick={e => { e.stopPropagation(); setStatusDropdownId(statusDropdownId === lead.id ? null : lead.id) }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity ${STATUS_COLORS[lead.status] ?? 'bg-slate-500/15 text-slate-400'}`}
                      >
                        {STATUS_LABELS[lead.status] ?? lead.status}
                        <ChevronDown size={12} />
                      </button>
                      {statusDropdownId === lead.id && (
                        <div className="absolute top-full left-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl py-1 z-50 min-w-[180px] shadow-xl">
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={e => { e.stopPropagation(); changeLeadStatus(lead.id, key) }}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                                lead.status === key ? 'text-white bg-slate-700/50' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[key]?.split(' ')[0]?.replace('/15', '') ?? 'bg-slate-500'}`} />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-1" />
                    {lead.phone && (
                      <span className="hidden md:flex items-center gap-1.5 text-slate-500 text-xs flex-shrink-0">
                        <Phone size={12} /> {lead.phone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="hidden lg:flex items-center gap-1.5 text-slate-500 text-xs truncate max-w-[180px] flex-shrink-0">
                        <Mail size={12} /> {lead.email}
                      </span>
                    )}
                    {lead.budget != null && lead.budget > 0 && (
                      <span className="text-slate-400 text-xs flex-shrink-0 hidden sm:block">
                        {formatCurrency(lead.budget)}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteLead(lead.id) }}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lead modal */}
          {showLeadModal && (
            <ModalOverlay onClose={() => setShowLeadModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">{editLead ? 'Modifier le lead' : 'Nouveau lead'}</h2>
              <form onSubmit={submitLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Prénom *</label>
                    <input required value={leadForm.firstName} onChange={e => setLeadForm({ ...leadForm, firstName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nom *</label>
                    <input required value={leadForm.lastName} onChange={e => setLeadForm({ ...leadForm, lastName: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Entreprise</label>
                  <input value={leadForm.company} onChange={e => setLeadForm({ ...leadForm, company: e.target.value })} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Telephone</label>
                    <input value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: formatPhone(e.target.value) })} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Budget (EUR)</label>
                    <input type="number" value={leadForm.budget} onChange={e => setLeadForm({ ...leadForm, budget: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Source</label>
                    <input value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })} placeholder="LinkedIn, reference..." className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={leadForm.notes} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} rows={3} className={textareaClass} />
                </div>
                <ModalActions onCancel={() => setShowLeadModal(false)} submitLabel={editLead ? 'Sauvegarder' : 'Creer'} />
              </form>
            </ModalOverlay>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: RELANCES                                                     */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'relances' && (
        <div>
          <div className="mb-5">
            <button onClick={openRelanceModal} disabled={prospects.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50">
              <Plus size={16} /> Nouvelle relance
            </button>
            {prospects.length === 0 && <p className="text-slate-600 text-xs mt-2">Ajoutez d&apos;abord des leads pour creer des relances</p>}
          </div>

          {/* A faire */}
          <RelanceSection
            title="A faire"
            relances={relances.filter(r => !r.done).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
            onToggle={toggleRelanceDone}
            onDelete={deleteRelance}
            emptyText="Aucune relance en attente"
          />

          {/* Terminee */}
          <RelanceSection
            title="Terminees"
            relances={relances.filter(r => r.done)}
            onToggle={toggleRelanceDone}
            onDelete={deleteRelance}
            emptyText="Aucune relance terminee"
            dimmed
          />

          {/* Relance modal */}
          {showRelanceModal && (
            <ModalOverlay onClose={() => setShowRelanceModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">Nouvelle relance</h2>
              <form onSubmit={submitRelance} className="space-y-4">
                <div>
                  <label className={labelClass}>Prospect *</label>
                  <select required value={relanceForm.prospectId} onChange={e => setRelanceForm({ ...relanceForm, prospectId: e.target.value })} className={selectClass}>
                    <option value="">Selectionner...</option>
                    {prospects.map(p => <option key={p.id} value={p.id}>{p.name}{p.company ? ` (${p.company})` : ''}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Type</label>
                    <select value={relanceForm.type} onChange={e => setRelanceForm({ ...relanceForm, type: e.target.value })} className={selectClass}>
                      <option value="APPEL">Appel</option>
                      <option value="EMAIL">Email</option>
                      <option value="REUNION">Reunion</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Date *</label>
                    <input required type="date" value={relanceForm.date} onChange={e => setRelanceForm({ ...relanceForm, date: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={relanceForm.notes} onChange={e => setRelanceForm({ ...relanceForm, notes: e.target.value })} rows={3} className={textareaClass} />
                </div>
                <ModalActions onCancel={() => setShowRelanceModal(false)} submitLabel="Creer" />
              </form>
            </ModalOverlay>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: VIDEOS                                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'videos' && (
        <div>
          {isAdmin && (
            <div className="mb-5">
              <button onClick={openVideoModal} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
                <Plus size={16} /> Ajouter une video
              </button>
            </div>
          )}

          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Play size={24} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Aucune video</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map(video => {
                const ytId = getYouTubeId(video.url)
                return (
                  <div key={video.id} className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors group">
                    {/* Thumbnail */}
                    <a href={video.url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-[#0a0a12]">
                      {ytId ? (
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play size={40} className="text-slate-700" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                          <Play size={20} className="text-white ml-0.5" />
                        </div>
                      </div>
                    </a>
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-white text-sm font-medium hover:text-[#E14B89] transition-colors line-clamp-1">
                            {video.title}
                          </a>
                          {video.description && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{video.description}</p>}
                        </div>
                        {isAdmin && (
                          <button onClick={() => deleteVideo(video.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {video.category && (
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-500/15 text-slate-400">
                          {video.category}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Video modal */}
          {showVideoModal && (
            <ModalOverlay onClose={() => setShowVideoModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">Ajouter une video</h2>
              <form onSubmit={submitVideo} className="space-y-4">
                <div>
                  <label className={labelClass}>Titre *</label>
                  <input required value={videoForm.title} onChange={e => setVideoForm({ ...videoForm, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>URL (YouTube) *</label>
                  <input required value={videoForm.url} onChange={e => setVideoForm({ ...videoForm, url: e.target.value })} placeholder="https://youtube.com/watch?v=..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea value={videoForm.description} onChange={e => setVideoForm({ ...videoForm, description: e.target.value })} rows={3} className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>Categorie</label>
                  <input value={videoForm.category} onChange={e => setVideoForm({ ...videoForm, category: e.target.value })} placeholder="Formation, Technique..." className={inputClass} />
                </div>
                <ModalActions onCancel={() => setShowVideoModal(false)} submitLabel="Ajouter" />
              </form>
            </ModalOverlay>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: SPEECH                                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'speech' && (
        <div>
          <div className="mb-5">
            <button onClick={() => openSpeechModal()} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
              <Plus size={16} /> Nouveau speech
            </button>
          </div>

          {speeches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText size={24} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Aucun speech</p>
            </div>
          ) : (
            <div className="space-y-3">
              {speeches.map(speech => {
                const isExpanded = expandedSpeech === speech.id
                return (
                  <div
                    key={speech.id}
                    className="bg-[#111118] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
                  >
                    <div
                      className="p-4 cursor-pointer flex items-start justify-between gap-3"
                      onClick={() => setExpandedSpeech(isExpanded ? null : speech.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-slate-600 flex-shrink-0" />
                          <p className="text-white text-sm font-medium truncate">{speech.title}</p>
                        </div>
                        {!isExpanded && (
                          <p className="text-slate-500 text-xs line-clamp-1 ml-[22px]">
                            {speech.content.slice(0, 100)}{speech.content.length > 100 ? '...' : ''}
                          </p>
                        )}
                        <p className="text-slate-600 text-xs mt-1 ml-[22px]">{formatDate(speech.updatedAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); openSpeechModal(speech) }} className="p-1.5 text-slate-600 hover:text-white transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteSpeech(speech.id) }} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                        <ChevronDown size={14} className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="bg-[#0a0a12] rounded-xl p-4 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                          {speech.content}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Speech modal */}
          {showSpeechModal && (
            <ModalOverlay onClose={() => setShowSpeechModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">{editSpeech ? 'Modifier le speech' : 'Nouveau speech'}</h2>
              <form onSubmit={submitSpeech} className="space-y-4">
                <div>
                  <label className={labelClass}>Titre *</label>
                  <input required value={speechForm.title} onChange={e => setSpeechForm({ ...speechForm, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contenu *</label>
                  <textarea required value={speechForm.content} onChange={e => setSpeechForm({ ...speechForm, content: e.target.value })} rows={8} className={textareaClass} />
                </div>
                <ModalActions onCancel={() => setShowSpeechModal(false)} submitLabel={editSpeech ? 'Sauvegarder' : 'Creer'} />
              </form>
            </ModalOverlay>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: COMMISSIONS                                                  */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'commissions' && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-slate-500" />
                <span className="text-slate-500 text-xs">Total commissions</span>
              </div>
              <p className="text-white text-lg font-semibold">{formatCurrency(totalCommissions)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-slate-500 text-xs">Payees</span>
              </div>
              <p className="text-green-400 text-lg font-semibold">{formatCurrency(paidCommissions)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-amber-500" />
                <span className="text-slate-500 text-xs">En attente</span>
              </div>
              <p className="text-amber-400 text-lg font-semibold">{formatCurrency(pendingCommissions)}</p>
            </div>
          </div>

          {/* Add button (admin) */}
          {isAdmin && (
            <div className="mb-5">
              <button onClick={openCommissionModal} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
                <Plus size={16} /> Ajouter
              </button>
            </div>
          )}

          {/* Commissions table */}
          {commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Euro size={24} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Aucune commission</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map(commission => (
                <div key={commission.id} className="bg-[#111118] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="text-slate-500 text-xs flex-shrink-0 w-[80px]">
                        {formatDate(commission.date)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${COMMISSION_TYPE_COLORS[commission.type] ?? 'bg-slate-500/15 text-slate-400'}`}>
                        {COMMISSION_TYPE_LABELS[commission.type] ?? commission.type}
                      </span>
                      <span className="text-white text-sm font-medium flex-shrink-0">
                        {formatCurrency(commission.amount)}
                      </span>
                      {commission.prospect?.name && (
                        <span className="text-slate-500 text-xs truncate hidden sm:block">
                          {commission.prospect.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${commission.paid ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {commission.paid ? 'Paye' : 'En attente'}
                      </span>
                      {commission.notes && (
                        <span className="text-slate-600 text-xs hidden md:block max-w-[150px] truncate" title={commission.notes}>
                          {commission.notes}
                        </span>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => toggleCommissionPaid(commission)}
                            className={`p-1.5 transition-colors ${commission.paid ? 'text-green-500 hover:text-amber-400' : 'text-slate-600 hover:text-green-400'}`}
                            title={commission.paid ? 'Marquer non paye' : 'Marquer paye'}
                          >
                            {commission.paid ? <Check size={14} /> : <CheckCircle2 size={14} />}
                          </button>
                          <button onClick={() => deleteCommission(commission.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Commission modal */}
          {showCommissionModal && (
            <ModalOverlay onClose={() => setShowCommissionModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">Ajouter une commission</h2>
              <form onSubmit={submitCommission} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Montant (EUR) *</label>
                    <input required type="number" step="0.01" value={commissionForm.amount} onChange={e => setCommissionForm({ ...commissionForm, amount: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select value={commissionForm.type} onChange={e => setCommissionForm({ ...commissionForm, type: e.target.value })} className={selectClass}>
                      <option value="SIGNATURE">Signature</option>
                      <option value="BONUS">Bonus</option>
                      <option value="PARRAINAGE">Parrainage</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Date *</label>
                    <input required type="date" value={commissionForm.date} onChange={e => setCommissionForm({ ...commissionForm, date: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Prospect</label>
                    <select value={commissionForm.prospectId} onChange={e => setCommissionForm({ ...commissionForm, prospectId: e.target.value })} className={selectClass}>
                      <option value="">Aucun</option>
                      {prospects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={commissionForm.notes} onChange={e => setCommissionForm({ ...commissionForm, notes: e.target.value })} rows={3} className={textareaClass} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCommissionForm({ ...commissionForm, paid: !commissionForm.paid })}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${commissionForm.paid ? 'bg-green-500 border-green-500' : 'border-slate-700 bg-[#1a1a24]'}`}
                  >
                    {commissionForm.paid && <Check size={12} className="text-white" />}
                  </button>
                  <span className="text-slate-400 text-sm">Deja payee</span>
                </div>
                <ModalActions onCancel={() => setShowCommissionModal(false)} submitLabel="Ajouter" />
              </form>
            </ModalOverlay>
          )}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
        Annuler
      </button>
      <button type="submit" className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity">
        {submitLabel}
      </button>
    </div>
  )
}

function RelanceSection({
  title,
  relances,
  onToggle,
  onDelete,
  emptyText,
  dimmed,
}: {
  title: string
  relances: Relance[]
  onToggle: (r: Relance) => void
  onDelete: (id: string) => void
  emptyText: string
  dimmed?: boolean
}) {
  return (
    <div className="mb-8">
      <h3 className={`text-sm font-medium mb-3 ${dimmed ? 'text-slate-600' : 'text-white'}`}>{title} ({relances.length})</h3>
      {relances.length === 0 ? (
        <p className="text-slate-600 text-xs py-4">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {relances.map(r => {
            const config = RELANCE_TYPE_CONFIG[r.type] ?? RELANCE_TYPE_CONFIG.APPEL
            const Icon = config.icon
            return (
              <div key={r.id} className={`bg-[#111118] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group ${dimmed ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button onClick={() => onToggle(r)} className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${r.done ? 'bg-green-500 border-green-500' : 'border-slate-700 bg-[#1a1a24] hover:border-slate-500'}`}>
                      {r.done && <Check size={12} className="text-white" />}
                    </button>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${config.color}`}>
                      <Icon size={12} className="inline mr-1" />
                      {config.label}
                    </span>
                    <span className="text-white text-sm truncate">{r.prospect?.name}</span>
                    {r.prospect?.company && <span className="text-slate-600 text-xs hidden sm:block">({r.prospect.company})</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-slate-500 text-xs">{formatDate(r.date)}</span>
                    {r.notes && <span className="text-slate-600 text-xs hidden md:block max-w-[150px] truncate" title={r.notes}>{r.notes}</span>}
                    <button onClick={() => onDelete(r.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
