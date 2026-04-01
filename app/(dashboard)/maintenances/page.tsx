'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, ExternalLink, LogIn, Copy, Check, Globe, Search, Share2, BookOpen, ArrowLeft, X, AlertTriangle, Clock, Receipt, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

interface Maintenance {
  id: string
  clientName: string
  clientEmail?: string
  url?: string
  loginUrl?: string
  cms?: string
  level?: number
  type: string
  billing: string
  billingDay?: number
  startDate?: string
  endDate?: string
  priceHT?: number
  commercial?: string
  loginEmail?: string
  loginPassword?: string
  contactName?: string
  contactPhone?: string
  notes?: string
  active: boolean
  manualPaid: boolean
  contractId?: string
  mandatId?: string
}

interface MandatItem { id: string; clientName: string; referenceMandat?: string; descriptionContrat?: string; signatureStatus: string; stoppedAt?: string; contractId?: string }
interface Client { id: string; name: string; company?: string }
interface Invoice {
  id: string
  number: string
  month: number
  year: number
  amountHT: number
  amountTTC: number
  clientName: string
  clientEmail?: string
  sentAt?: string
  createdAt: string
  maintenanceId: string
}

const TABS = [
  { key: 'WEB', label: 'Web', icon: Globe },
  { key: 'GOOGLE', label: 'Google', icon: Search },
  { key: 'RESEAUX', label: 'Réseaux', icon: Share2 },
  { key: 'BLOG', label: 'Blog', icon: BookOpen },
]

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const LEVEL_LABELS: Record<number, string> = {
  1: 'Niveau 1 — Hébergement',
  2: 'Niveau 2 — Technique',
  3: 'Niveau 3 — Contenu',
  4: 'Niveau 4 — SEO',
}

const BILLING_LABELS: Record<string, string> = {
  MENSUEL: 'Mensuel',
  TRIMESTRIEL: 'Trimestriel',
  ANNUEL: 'Annuel',
  MANUEL: 'Manuel',
}

const emptyForm = {
  clientName: '', clientEmail: '', url: '', loginUrl: '', cms: '', level: '', type: 'WEB', billing: 'MENSUEL',
  billingDay: '', startDate: '', endDate: '', priceHT: '', commercial: '', loginEmail: '',
  loginPassword: '', contactName: '', contactPhone: '', notes: '', active: true,
  n8nUrl: '', sheetUrl: '', contractId: '', mandatId: '',
}

export default function MaintenancesPage() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('WEB')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Maintenance | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>(emptyForm)
  const [copied, setCopied] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [mandats, setMandats] = useState<MandatItem[]>([])
  const [showCreds, setShowCreds] = useState<string | null>(null)

  // Invoices modal
  const [showInvoices, setShowInvoices] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1)
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear())
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/maintenances').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/mandats').then(r => r.json()),
    ]).then(([m, c, md]) => { setMaintenances(m); setClients(c); setMandats(md) }).finally(() => setLoading(false))
  }, [])

  function refreshData() {
    Promise.all([
      fetch('/api/maintenances').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/mandats').then(r => r.json()),
    ]).then(([m, c, md]) => { setMaintenances(m); setClients(c); setMandats(md) })
  }
  usePolling(refreshData)

  async function fetchInvoices(month: number, year: number) {
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/maintenances/invoices?month=${month}&year=${year}`)
      const data = await res.json()
      setInvoices(data)
    } catch { setInvoices([]) }
    finally { setLoadingInvoices(false) }
  }

  function openInvoices() {
    const m = new Date().getMonth() + 1
    const y = new Date().getFullYear()
    setInvoiceMonth(m)
    setInvoiceYear(y)
    setShowInvoices(true)
    fetchInvoices(m, y)
  }

  function changeInvoiceMonth(delta: number) {
    let m = invoiceMonth + delta
    let y = invoiceYear
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setInvoiceMonth(m)
    setInvoiceYear(y)
    fetchInvoices(m, y)
  }

  const filtered = maintenances.filter(m => m.type === activeTab)
  function toMonthly(m: Maintenance): number {
    const price = m.priceHT ?? 0
    if (m.billing === 'MANUEL') return 0
    if (m.billing === 'ANNUEL') return price / 12
    if (m.billing === 'TRIMESTRIEL') return price / 3
    return price
  }
  const totalByTab = maintenances.filter(m => m.type === activeTab && m.active).reduce((s, m) => s + toMonthly(m), 0)

  function openModal(item?: Maintenance) {
    if (item) {
      setEditItem(item)
      setForm({
        ...item,
        priceHT: item.priceHT?.toString() ?? '',
        billingDay: item.billingDay?.toString() ?? '',
        clientEmail: item.clientEmail ?? '',
        startDate: item.startDate ? item.startDate.split('T')[0] : '',
        endDate: item.endDate ? item.endDate.split('T')[0] : '',
        contractId: item.contractId ?? '',
        mandatId: item.mandatId ?? '',
        level: item.level?.toString() ?? '',
      })
    } else {
      setEditItem(null)
      setForm({ ...emptyForm, type: activeTab })
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      priceHT: form.priceHT ? parseFloat(form.priceHT as string) : null,
      billingDay: form.billingDay ? parseInt(form.billingDay as string) : null,
      clientEmail: form.clientEmail || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      url: form.url || null,
      loginUrl: form.loginUrl || null,
      cms: form.cms || null,
      level: form.level ? parseInt(form.level as string) : null,
      commercial: form.commercial || null,
      loginEmail: form.loginEmail || null,
      loginPassword: form.loginPassword || null,
      contactName: form.contactName || null,
      contactPhone: form.contactPhone || null,
      notes: form.notes || null,
      n8nUrl: form.n8nUrl || null,
      sheetUrl: form.sheetUrl || null,
      contractId: form.contractId || null,
      mandatId: form.mandatId || null,
    }
    try {
      if (editItem) {
        const res = await fetch(`/api/maintenances/${editItem.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Erreur lors de la modification'); return }
        const updated = await res.json()
        setMaintenances(prev => prev.map(m => m.id === editItem.id ? updated : m))
      } else {
        const res = await fetch('/api/maintenances', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Erreur lors de la création'); return }
        const created = await res.json()
        setMaintenances(prev => [...prev, created])
      }
      setShowModal(false)
    } catch (err) {
      console.error('Maintenance submit error:', err)
      alert('Erreur réseau')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce contrat ?')) return
    await fetch(`/api/maintenances/${id}`, { method: 'DELETE' })
    setMaintenances(prev => prev.filter(m => m.id !== id))
  }

  async function handleAutoLogin(m: Maintenance) {
    if (m.loginUrl) {
      const url = m.loginUrl.startsWith('http') ? m.loginUrl : `https://${m.loginUrl}`
      window.open(url, '_blank')
    }
    if (m.loginEmail || m.loginPassword) {
      const text = [m.loginEmail, m.loginPassword].filter(Boolean).join('\n')
      await navigator.clipboard.writeText(text)
      setCopied(m.id)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Maintenances</h1>
          <p className="text-slate-400 text-sm mt-1">{maintenances.filter(m => m.active).length} effectués ce mois-ci</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openInvoices}
            className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Receipt size={16} /> Factures auto
          </button>
          <button onClick={() => openModal()}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === key ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}>
            <Icon size={15} />
            {label}
            <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
              {maintenances.filter(m => m.type === key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Revenue summary */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between">
        <span className="text-slate-400 text-sm">Revenus {TABS.find(t => t.key === activeTab)?.label} mensuels</span>
        <span className="text-white font-semibold text-lg">{formatCurrency(totalByTab)}</span>
      </div>

      {/* Alerte jour de prélèvement manquant */}
      {(() => {
        const missingBillingDay = maintenances.filter(m => m.active && m.billing === 'MENSUEL' && m.clientEmail && !m.billingDay)
        if (missingBillingDay.length === 0) return null
        return (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-5 py-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-orange-400" />
              <span className="text-orange-400 text-sm font-medium">Jour de prélèvement manquant ({missingBillingDay.length})</span>
            </div>
            <p className="text-slate-400 text-xs mb-3">Aucune facture ne sera envoyée tant qu&apos;un jour de prélèvement n&apos;est pas renseigné.</p>
            <div className="space-y-2">
              {missingBillingDay.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-white">{m.clientName} <span className="text-slate-500">({TABS.find(t => t.key === m.type)?.label})</span></span>
                  <button onClick={() => openModal(m)} className="text-orange-400 hover:text-orange-300 text-xs transition-colors">Configurer</button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Alertes expiration */}
      {(() => {
        const now = new Date()
        const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const expiring = maintenances.filter(m => m.active && m.endDate && new Date(m.endDate) <= in30d && new Date(m.endDate) >= now)
        const expired = maintenances.filter(m => m.active && m.endDate && new Date(m.endDate) < now)
        if (expiring.length === 0 && expired.length === 0) return null
        return (
          <div className="space-y-3 mb-6">
            {expired.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-red-400 text-sm font-medium">Maintenances expirées ({expired.length})</span>
                </div>
                <div className="space-y-2">
                  {expired.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-white">{m.clientName} <span className="text-slate-500">({TABS.find(t => t.key === m.type)?.label})</span></span>
                      <span className="text-red-400 text-xs">Expiré le {formatDate(m.endDate!)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {expiring.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-amber-400" />
                  <span className="text-amber-400 text-sm font-medium">Expire bientôt ({expiring.length})</span>
                </div>
                <div className="space-y-2">
                  {expiring.map(m => {
                    const days = Math.ceil((new Date(m.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <span className="text-white">{m.clientName} <span className="text-slate-500">({TABS.find(t => t.key === m.type)?.label})</span></span>
                        <span className="text-amber-400 text-xs">Expire dans {days} jour{days > 1 ? 's' : ''} ({formatDate(m.endDate!)})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">Aucun contrat de maintenance</p>
          <button onClick={() => openModal()} className="mt-4 text-[#E14B89] text-sm hover:text-[#F8903C] transition-colors">
            + Ajouter le premier
          </button>
        </div>
      ) : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Client</th>
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">URL</th>
                {activeTab === 'WEB' && <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Niveau</th>}
                {activeTab === 'WEB' && <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">CMS</th>}
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Fact.</th>
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Prélèvement</th>
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Prix</th>
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Fin</th>
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Mandat</th>
                <th className="text-left px-3 py-3 text-slate-400 text-xs font-medium">Statut</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const isManualDue = (m.billing === 'MANUEL' || m.billing === 'ANNUEL' || m.billing === 'TRIMESTRIEL') && m.active && !m.manualPaid && m.endDate && new Date(m.endDate) <= new Date()
                return (
                <tr key={m.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 group ${i === filtered.length - 1 ? 'border-0' : ''} ${isManualDue ? 'bg-red-500/8 border-l-2 border-l-red-500/60' : m.active && m.billing === 'MENSUEL' && !m.billingDay ? 'bg-amber-500/5 border-l-2 border-l-amber-500/40' : ''}`}>
                  <td className="px-3 py-2.5">
                    <p className="text-white text-sm font-medium">{clients.find(c => c.name === m.clientName)?.company || m.clientName}</p>
                    <p className="text-slate-500 text-xs">{m.clientName}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {m.url ? (
                      <a href={m.url.startsWith('http') ? m.url : `https://${m.url}`} target="_blank" rel="noopener noreferrer"
                        className="text-[#E14B89] hover:text-[#F8903C] text-xs flex items-center gap-1 transition-colors">
                        <ExternalLink size={11} />
                        {m.url.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 20)}
                      </a>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  {activeTab === 'WEB' && (
                    <td className="px-3 py-2.5">
                      <select value={m.level || ''} onChange={async e => {
                        const val = e.target.value ? parseInt(e.target.value) : null
                        const res = await fetch(`/api/maintenances/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: val }) })
                        if (res.ok) setMaintenances(prev => prev.map(x => x.id === m.id ? { ...x, level: val ?? undefined } : x))
                      }} className="bg-transparent border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 hover:border-slate-600 focus:border-[#E14B89] focus:outline-none cursor-pointer transition-colors">
                        <option value="">—</option>
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{LEVEL_LABELS[n]}</option>)}
                      </select>
                    </td>
                  )}
                  {activeTab === 'WEB' && <td className="px-3 py-2.5 text-slate-400 text-xs">{m.cms || '—'}</td>}
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-slate-400">{BILLING_LABELS[m.billing]}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {m.billing === 'MENSUEL' && m.billingDay ? (
                      <span className="text-xs text-white font-medium">Le {m.billingDay}</span>
                    ) : m.endDate && (m.billing === 'ANNUEL' || m.billing === 'TRIMESTRIEL') ? (
                      <span className="text-xs text-slate-400">{formatDate(m.endDate)}</span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {m.billing === 'MANUEL' ? (
                      <>
                        <span className="text-white text-sm font-medium">{m.priceHT ? formatCurrency(m.priceHT) : '—'}</span>
                        {m.priceHT ? <span className="text-green-400/70 text-xs block">{formatCurrency(m.priceHT * 1.2)} TTC</span> : null}
                      </>
                    ) : (
                      <>
                        <span className="text-white text-sm font-medium">{m.priceHT ? formatCurrency(toMonthly(m)) : '—'}</span>
                        {m.priceHT ? <span className="text-green-400/70 text-xs block">{formatCurrency(toMonthly(m) * 1.2)} TTC</span> : null}
                        {m.priceHT && m.billing !== 'MENSUEL' ? <span className="text-slate-500 text-xs block">{formatCurrency(m.priceHT)}/{m.billing === 'ANNUEL' ? 'an' : 'trim.'}</span> : null}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {m.endDate ? (
                      <span className={`text-xs ${isManualDue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>{formatDate(m.endDate)}</span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                    {isManualDue && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/maintenances/${m.id}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ manualPaid: true }),
                          })
                          setMaintenances(prev => prev.map(x => x.id === m.id ? { ...x, manualPaid: true } : x))
                        }}
                        className="flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <CreditCard size={11} /> Marquer payé
                      </button>
                    )}
                    {(m.billing === 'MANUEL' || m.billing === 'ANNUEL' || m.billing === 'TRIMESTRIEL') && m.manualPaid && (
                      <span className="flex items-center gap-1 mt-1 text-xs text-green-400"><Check size={11} /> Payé</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {m.mandatId ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#E14B89]/10 text-[#E14B89]">
                        {mandats.find(md => md.id === m.mandatId)?.referenceMandat || 'Lié'}
                      </span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={m.active ? 'true' : 'false'}
                      onChange={async (e) => {
                        const newActive = e.target.value === 'true'
                        await fetch(`/api/maintenances/${m.id}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ active: newActive }),
                        })
                        setMaintenances(prev => prev.map(x => x.id === m.id ? { ...x, active: newActive } : x))
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${m.active ? 'bg-green-400/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}
                    >
                      <option value="true">Effectué</option>
                      <option value="false">Pas encore</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => setShowCreds(showCreds === m.id ? null : m.id)}
                        className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                        <Copy size={14} />
                      </button>
                      <button onClick={() => openModal(m)} className="p-1.5 text-slate-500 hover:text-white transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
              {showCreds && (() => {
                const m = filtered.find(x => x.id === showCreds)
                if (!m) return null
                return (
                  <tr>
                    <td colSpan={12} className="px-3 py-3 bg-slate-800/30 border-b border-slate-800/50">
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-slate-500 text-xs block mb-1">Email</span>
                          <span className="text-white font-mono">{m.loginEmail || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs block mb-1">Mot de passe</span>
                          <span className="text-white font-mono">{m.loginPassword || '—'}</span>
                        </div>
                        <button onClick={async () => {
                          await navigator.clipboard.writeText(`${m.loginEmail}\n${m.loginPassword}`)
                          setCopied(m.id)
                          setTimeout(() => setCopied(null), 2000)
                        }} className="ml-auto flex items-center gap-1.5 text-xs text-[#E14B89] hover:text-[#F8903C] transition-colors">
                          {copied === m.id ? <><Check size={12} />Copié</> : <><Copy size={12} />Copier</>}
                        </button>
                        <button onClick={() => setShowCreds(null)}
                          className="text-slate-500 hover:text-white transition-colors p-1">
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">{editItem ? 'Modifier le contrat' : 'Nouveau contrat'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors p-1">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Client *</label>
                  <select required value={form.clientName as string} onChange={e => setForm({ ...form, clientName: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="">Sélectionner un client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.name}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Type</label>
                  <select value={form.type as string} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="WEB">Web</option>
                    <option value="GOOGLE">Google</option>
                    <option value="RESEAUX">Réseaux</option>
                    <option value="BLOG">Blog</option>
                  </select>
                </div>
              </div>

              {/* Champs spécifiques WEB */}
              {(form.type as string) === 'WEB' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">URL du site</label>
                      <input value={form.url as string} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">URL de connexion</label>
                      <input value={form.loginUrl as string} onChange={e => setForm({ ...form, loginUrl: e.target.value })} placeholder="https://.../wp-admin"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Email de connexion</label>
                      <input value={form.loginEmail as string} onChange={e => setForm({ ...form, loginEmail: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Mot de passe</label>
                      <input value={form.loginPassword as string} onChange={e => setForm({ ...form, loginPassword: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>
                  {(form.type === 'WEB') && (
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Niveau de maintenance</label>
                      <select value={form.level as string} onChange={e => setForm({ ...form, level: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                        <option value="">— Aucun —</option>
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{LEVEL_LABELS[n]}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">CMS</label>
                      <select value={form.cms as string} onChange={e => setForm({ ...form, cms: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                        <option value="">— Aucun —</option>
                        <option value="WordPress">WordPress</option>
                        <option value="Framer">Framer</option>
                        <option value="Webflow">Webflow</option>
                        <option value="Shopify">Shopify</option>
                        <option value="WooCommerce">WooCommerce</option>
                        <option value="Prestashop">Prestashop</option>
                        <option value="Sur mesure">Sur mesure</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Facturation</label>
                      <select value={form.billing as string} onChange={e => setForm({ ...form, billing: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                        <option value="MENSUEL">Mensuel</option>
                        <option value="TRIMESTRIEL">Trimestriel</option>
                        <option value="ANNUEL">Annuel</option>
                        <option value="MANUEL">Manuel</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Prix HT (€)</label>
                      <input type="number" step="0.01" value={form.priceHT as string} onChange={e => setForm({ ...form, priceHT: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>
                </>
              )}

              {/* Champs spécifiques GOOGLE / RESEAUX */}
              {((form.type as string) === 'GOOGLE' || (form.type as string) === 'RESEAUX') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">URL du site</label>
                      <input value={form.url as string} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Facturation</label>
                      <select value={form.billing as string} onChange={e => setForm({ ...form, billing: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                        <option value="MENSUEL">Mensuel</option>
                        <option value="TRIMESTRIEL">Trimestriel</option>
                        <option value="ANNUEL">Annuel</option>
                        <option value="MANUEL">Manuel</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Prix HT (€)</label>
                    <input type="number" step="0.01" value={form.priceHT as string} onChange={e => setForm({ ...form, priceHT: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                  </div>
                </>
              )}

              {/* Champs spécifiques BLOG */}
              {(form.type as string) === 'BLOG' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">URL du site</label>
                      <input value={form.url as string} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Facturation</label>
                      <select value={form.billing as string} onChange={e => setForm({ ...form, billing: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                        <option value="MENSUEL">Mensuel</option>
                        <option value="TRIMESTRIEL">Trimestriel</option>
                        <option value="ANNUEL">Annuel</option>
                        <option value="MANUEL">Manuel</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Prix HT (€)</label>
                    <input type="number" step="0.01" value={form.priceHT as string} onChange={e => setForm({ ...form, priceHT: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Lien n8n (automatisation)</label>
                      <input value={form.n8nUrl as string} onChange={e => setForm({ ...form, n8nUrl: e.target.value })} placeholder="https://n8n.io/..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Lien Google Sheet (titres articles)</label>
                      <input value={form.sheetUrl as string} onChange={e => setForm({ ...form, sheetUrl: e.target.value })} placeholder="https://docs.google.com/..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Email de connexion</label>
                      <input value={form.loginEmail as string} onChange={e => setForm({ ...form, loginEmail: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Mot de passe</label>
                      <input value={form.loginPassword as string} onChange={e => setForm({ ...form, loginPassword: e.target.value })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                  </div>
                </>
              )}

              {/* Mandat lié */}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Mandat lié</label>
                <select value={form.mandatId as string} onChange={e => setForm({ ...form, mandatId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="">— Aucun mandat —</option>
                  {mandats.filter(md => !md.stoppedAt).map(md => (
                    <option key={md.id} value={md.id}>{md.clientName} — {md.referenceMandat || 'Sans réf.'}{md.signatureStatus === 'SIGNE' ? ' ✓' : ''}</option>
                  ))}
                </select>
                <p className="text-slate-500 text-[11px] mt-1">La suppression de cette maintenance arrêtera le mandat lié (et son contrat si applicable)</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Date début</label>
                  <input type="date" value={form.startDate as string} onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Date fin</label>
                  <input type="date" value={form.endDate as string} onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Jour de prélèvement</label>
                  <input type="number" min="1" max="31" value={form.billingDay as string} onChange={e => setForm({ ...form, billingDay: e.target.value })} placeholder="1"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Email client (pour factures auto)</label>
                  <input type="email" value={form.clientEmail as string} onChange={e => setForm({ ...form, clientEmail: e.target.value })} placeholder="client@example.com"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Commercial</label>
                  <input value={form.commercial as string} onChange={e => setForm({ ...form, commercial: e.target.value })} placeholder="Nom du commercial"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes as string} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active as boolean} onChange={e => setForm({ ...form, active: e.target.checked })}
                  className="accent-[#E14B89]" />
                <label htmlFor="active" className="text-slate-400 text-sm">Maintenance active</label>
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

      {/* ═══ FACTURES AUTO MODAL ═══ */}
      {showInvoices && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-white font-semibold text-lg">Factures automatiques</h2>
                <p className="text-slate-500 text-xs mt-0.5">Factures envoyées automatiquement par le cron</p>
              </div>
              <button onClick={() => setShowInvoices(false)} className="text-slate-500 hover:text-white transition-colors p-1"><X size={18} /></button>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
              <button onClick={() => changeInvoiceMonth(-1)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <span className="text-white font-semibold">{MONTH_NAMES[invoiceMonth - 1]} {invoiceYear}</span>
                <span className="text-slate-500 text-xs ml-2">({invoices.length} facture{invoices.length !== 1 ? 's' : ''})</span>
              </div>
              <button onClick={() => changeInvoiceMonth(1)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Totals */}
            {invoices.length > 0 && (
              <div className="px-6 py-3 border-b border-slate-800/50 flex items-center gap-6">
                <div>
                  <span className="text-slate-500 text-xs">Total HT</span>
                  <span className="text-white font-semibold text-sm ml-2">{formatCurrency(invoices.reduce((s, inv) => s + inv.amountHT, 0))}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Total TTC</span>
                  <span className="text-green-400 font-semibold text-sm ml-2">{formatCurrency(invoices.reduce((s, inv) => s + inv.amountTTC, 0))}</span>
                </div>
              </div>
            )}

            {/* Invoice list */}
            <div className="flex-1 overflow-y-auto">
              {loadingInvoices ? (
                <div className="p-12 text-center text-slate-500 text-sm">Chargement...</div>
              ) : invoices.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">Aucune facture pour ce mois</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium">N° Facture</th>
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium">Client</th>
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium">Email</th>
                      <th className="text-right px-5 py-3 text-slate-400 text-xs font-medium">HT</th>
                      <th className="text-right px-5 py-3 text-slate-400 text-xs font-medium">TTC</th>
                      <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium">Envoyé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr key={inv.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 ${i === invoices.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-5 py-3">
                          <span className="text-[#E14B89] text-sm font-mono">{inv.number}</span>
                        </td>
                        <td className="px-5 py-3 text-white text-sm">{inv.clientName}</td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{inv.clientEmail || '—'}</td>
                        <td className="px-5 py-3 text-right text-white text-sm">{formatCurrency(inv.amountHT)}</td>
                        <td className="px-5 py-3 text-right text-green-400 text-sm font-medium">{formatCurrency(inv.amountTTC)}</td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
