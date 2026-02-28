'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FileText, Calendar, Euro, Globe, Phone } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Contract {
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
  contactName?: string
  contactPhone?: string
  notes?: string
  active: boolean
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = { WEB: 'Web', GOOGLE: 'Google', RESEAUX: 'Réseaux', BLOG: 'Blog' }
const BILLING_LABELS: Record<string, string> = { MENSUEL: 'Mensuel', TRIMESTRIEL: 'Trimestriel', ANNUEL: 'Annuel' }
const TYPE_COLORS: Record<string, string> = {
  WEB: 'bg-blue-400/10 text-blue-400',
  GOOGLE: 'bg-amber-400/10 text-amber-400',
  RESEAUX: 'bg-[#E14B89]/10 text-[#E14B89]',
  BLOG: 'bg-green-400/10 text-green-400',
}

const emptyForm = {
  clientName: '', url: '', loginUrl: '', cms: '', type: 'WEB', billing: 'MENSUEL',
  startDate: '', endDate: '', priceHT: '', commercial: '', contactName: '', contactPhone: '', notes: '', active: true,
}

function contractStatus(c: Contract): 'EN_COURS' | 'EN_ATTENTE' | 'TERMINE' {
  const now = new Date()
  if (!c.active) return 'TERMINE'
  if (c.endDate && new Date(c.endDate) < now) return 'TERMINE'
  if (c.startDate && new Date(c.startDate) > now) return 'EN_ATTENTE'
  return 'EN_COURS'
}

const TABS = [
  { key: 'EN_COURS', label: 'En cours', color: 'text-green-400', dot: 'bg-green-400' },
  { key: 'EN_ATTENTE', label: 'En attente', color: 'text-amber-400', dot: 'bg-amber-400' },
  { key: 'TERMINE', label: 'Terminés', color: 'text-slate-400', dot: 'bg-slate-500' },
]

export default function ContratsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'EN_COURS' | 'EN_ATTENTE' | 'TERMINE'>('EN_COURS')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Contract | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>(emptyForm)

  useEffect(() => {
    fetch('/api/maintenances').then(r => r.json()).then(setContracts).finally(() => setLoading(false))
  }, [])

  function openModal(item?: Contract) {
    if (item) {
      setEditItem(item)
      setForm({
        clientName: item.clientName, url: item.url ?? '', loginUrl: item.loginUrl ?? '',
        cms: item.cms ?? '', type: item.type, billing: item.billing,
        startDate: item.startDate ? item.startDate.split('T')[0] : '',
        endDate: item.endDate ? item.endDate.split('T')[0] : '',
        priceHT: item.priceHT?.toString() ?? '', commercial: item.commercial ?? '',
        contactName: item.contactName ?? '', contactPhone: item.contactPhone ?? '',
        notes: item.notes ?? '', active: item.active,
      })
    } else {
      setEditItem(null)
      setForm(emptyForm)
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
      url: form.url || null, loginUrl: form.loginUrl || null,
      cms: form.cms || null, commercial: form.commercial || null,
      contactName: form.contactName || null, contactPhone: form.contactPhone || null,
      notes: form.notes || null,
    }
    if (editItem) {
      const res = await fetch(`/api/maintenances/${editItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const updated = await res.json()
      setContracts(prev => prev.map(c => c.id === editItem.id ? updated : c))
    } else {
      const res = await fetch('/api/maintenances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json()
      setContracts(prev => [created, ...prev])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce contrat ?')) return
    await fetch(`/api/maintenances/${id}`, { method: 'DELETE' })
    setContracts(prev => prev.filter(c => c.id !== id))
  }

  const filtered = contracts.filter(c => contractStatus(c) === tab)
  const totalMRC = contracts.filter(c => contractStatus(c) === 'EN_COURS').reduce((s, c) => s + (c.priceHT ?? 0), 0)

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Contrats</h1>
          <p className="text-slate-400 text-sm mt-1">
            {contracts.filter(c => contractStatus(c) === 'EN_COURS').length} actifs · {formatCurrency(totalMRC)}/mois
          </p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nouveau contrat
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111118] border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const count = contracts.filter(c => contractStatus(c) === t.key).length
          return (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
              {t.label}
              <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">Aucun contrat dans cette catégorie</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Client</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Facturation</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Prix HT</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Début</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Fin</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">{c.clientName}</p>
                        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 text-xs flex items-center gap-1 hover:text-[#E14B89] transition-colors"><Globe size={10} />{c.url.replace(/^https?:\/\//, '')}</a>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[c.type] ?? 'bg-slate-800 text-slate-400'}`}>{TYPE_LABELS[c.type] ?? c.type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{BILLING_LABELS[c.billing] ?? c.billing}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{c.priceHT ? formatCurrency(c.priceHT) : '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{c.startDate ? formatDate(c.startDate) : '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{c.endDate ? formatDate(c.endDate) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(c)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-5">
              <FileText size={18} className="text-[#E14B89]" />
              <h2 className="text-white font-semibold text-lg">{editItem ? 'Modifier le contrat' : 'Nouveau contrat'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom client *</label>
                <input required value={form.clientName as string} onChange={e => setForm({ ...form, clientName: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Type</label>
                  <select value={form.type as string} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="WEB">Web</option>
                    <option value="GOOGLE">Google</option>
                    <option value="RESEAUX">Réseaux sociaux</option>
                    <option value="BLOG">Blog</option>
                  </select>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix HT (€)</label>
                  <input type="number" step="0.01" value={form.priceHT as string} onChange={e => setForm({ ...form, priceHT: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">CMS</label>
                  <input value={form.cms as string} onChange={e => setForm({ ...form, cms: e.target.value })} placeholder="WordPress, Framer..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">URL du site</label>
                <input value={form.url as string} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Contact</label>
                  <input value={form.contactName as string} onChange={e => setForm({ ...form, contactName: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Téléphone</label>
                  <input value={form.contactPhone as string} onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes as string} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.active as boolean} onChange={e => setForm({ ...form, active: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#E14B89]"></div>
                </label>
                <span className="text-slate-400 text-sm">Contrat actif</span>
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
