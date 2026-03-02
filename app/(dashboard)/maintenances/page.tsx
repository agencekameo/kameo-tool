'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, ExternalLink, LogIn, Copy, Check, Globe, Search, Share2, BookOpen } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Maintenance {
  id: string
  clientName: string
  url?: string
  loginUrl?: string
  cms?: string
  type: string
  billing: string
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
}

interface Client { id: string; name: string; company?: string }

const TABS = [
  { key: 'WEB', label: 'Web', icon: Globe },
  { key: 'GOOGLE', label: 'Google', icon: Search },
  { key: 'RESEAUX', label: 'Réseaux', icon: Share2 },
  { key: 'BLOG', label: 'Blog', icon: BookOpen },
]

const BILLING_LABELS: Record<string, string> = {
  MENSUEL: 'Mensuel',
  TRIMESTRIEL: 'Trimestriel',
  ANNUEL: 'Annuel',
}

const emptyForm = {
  clientName: '', url: '', loginUrl: '', cms: '', type: 'WEB', billing: 'MENSUEL',
  startDate: '', endDate: '', priceHT: '', commercial: '', loginEmail: '',
  loginPassword: '', contactName: '', contactPhone: '', notes: '', active: true,
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
  const [showCreds, setShowCreds] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/maintenances').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([m, c]) => { setMaintenances(m); setClients(c) }).finally(() => setLoading(false))
  }, [])

  const filtered = maintenances.filter(m => m.type === activeTab)
  const totalByTab = maintenances.filter(m => m.type === activeTab && m.active).reduce((s, m) => s + (m.priceHT ?? 0), 0)

  function openModal(item?: Maintenance) {
    if (item) {
      setEditItem(item)
      setForm({
        ...item,
        priceHT: item.priceHT?.toString() ?? '',
        startDate: item.startDate ? item.startDate.split('T')[0] : '',
        endDate: item.endDate ? item.endDate.split('T')[0] : '',
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
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      url: form.url || null,
      loginUrl: form.loginUrl || null,
      cms: form.cms || null,
      commercial: form.commercial || null,
      loginEmail: form.loginEmail || null,
      loginPassword: form.loginPassword || null,
      contactName: form.contactName || null,
      contactPhone: form.contactPhone || null,
      notes: form.notes || null,
    }
    if (editItem) {
      const res = await fetch(`/api/maintenances/${editItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const updated = await res.json()
      setMaintenances(prev => prev.map(m => m.id === editItem.id ? updated : m))
    } else {
      const res = await fetch('/api/maintenances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json()
      setMaintenances(prev => [...prev, created])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce contrat ?')) return
    await fetch(`/api/maintenances/${id}`, { method: 'DELETE' })
    setMaintenances(prev => prev.filter(m => m.id !== id))
  }

  async function handleAutoLogin(m: Maintenance) {
    if (m.loginUrl) window.open(m.loginUrl, '_blank')
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
          <p className="text-slate-400 text-sm mt-1">{maintenances.filter(m => m.active).length} contrats actifs</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Ajouter
        </button>
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
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3.5 text-slate-400 text-xs font-medium">Client</th>
                <th className="text-left px-5 py-3.5 text-slate-400 text-xs font-medium">URL</th>
                <th className="text-left px-5 py-3.5 text-slate-400 text-xs font-medium">CMS</th>
                <th className="text-left px-5 py-3.5 text-slate-400 text-xs font-medium">Facturation</th>
                <th className="text-left px-5 py-3.5 text-slate-400 text-xs font-medium">Prix HT</th>
                <th className="text-left px-5 py-3.5 text-slate-400 text-xs font-medium">Fin</th>
                <th className="text-left px-5 py-3.5 text-slate-400 text-xs font-medium">Statut</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 group ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3.5">
                    <p className="text-white text-sm font-medium">{m.clientName}</p>
                    {m.contactName && <p className="text-slate-500 text-xs">{m.contactName}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    {m.url ? (
                      <a href={m.url} target="_blank" rel="noopener noreferrer"
                        className="text-[#E14B89] hover:text-[#F8903C] text-xs flex items-center gap-1 transition-colors">
                        <ExternalLink size={11} />
                        {m.url.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 25)}
                      </a>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-sm">{m.cms || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-slate-400">{BILLING_LABELS[m.billing]}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-white text-sm font-medium">{m.priceHT ? formatCurrency(m.priceHT) : '—'}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{m.endDate ? formatDate(m.endDate) : '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m.active ? 'bg-green-400/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                      {m.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      {(m.loginUrl || m.loginEmail) && (
                        <button onClick={() => handleAutoLogin(m)} title="Auto-login"
                          className="p-1.5 text-slate-500 hover:text-[#E14B89] transition-colors relative">
                          {copied === m.id ? <Check size={14} className="text-green-400" /> : <LogIn size={14} />}
                        </button>
                      )}
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
              ))}
              {showCreds && (() => {
                const m = filtered.find(x => x.id === showCreds)
                if (!m) return null
                return (
                  <tr>
                    <td colSpan={8} className="px-5 py-4 bg-slate-800/30 border-b border-slate-800/50">
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
            <h2 className="text-white font-semibold text-lg mb-5">{editItem ? 'Modifier le contrat' : 'Nouveau contrat'}</h2>
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">CMS</label>
                  <input value={form.cms as string} onChange={e => setForm({ ...form, cms: e.target.value })} placeholder="WordPress, Framer..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Facturation</label>
                  <select value={form.billing as string} onChange={e => setForm({ ...form, billing: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="MENSUEL">Mensuel</option>
                    <option value="TRIMESTRIEL">Trimestriel</option>
                    <option value="ANNUEL">Annuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix HT (€)</label>
                  <input type="number" step="0.01" value={form.priceHT as string} onChange={e => setForm({ ...form, priceHT: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Contact nom</label>
                  <input value={form.contactName as string} onChange={e => setForm({ ...form, contactName: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Contact téléphone</label>
                  <input value={form.contactPhone as string} onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Commercial</label>
                <input value={form.commercial as string} onChange={e => setForm({ ...form, commercial: e.target.value })} placeholder="Nom du commercial"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes as string} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active as boolean} onChange={e => setForm({ ...form, active: e.target.checked })}
                  className="accent-[#E14B89]" />
                <label htmlFor="active" className="text-slate-400 text-sm">Contrat actif</label>
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
