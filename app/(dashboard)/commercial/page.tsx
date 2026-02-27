'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Euro, Phone, Mail, User } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Prospect {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  notes?: string
  status: string
  budget?: number
  source?: string
  assignedTo?: string
  assignee?: { id: string; name: string }
}

interface User { id: string; name: string }

const COLUMNS = [
  { key: 'A_CONTACTER', label: 'À contacter', color: 'text-slate-400', bg: 'bg-slate-800/40' },
  { key: 'DEVIS_TRANSMETTRE', label: 'Devis à transmettre', color: 'text-blue-400', bg: 'bg-blue-400/5' },
  { key: 'DEVIS_ENVOYE', label: 'Devis envoyé', color: 'text-orange-400', bg: 'bg-orange-400/5' },
  { key: 'REFUSE', label: 'Refusé', color: 'text-red-400', bg: 'bg-red-400/5' },
  { key: 'SIGNE', label: 'Signé', color: 'text-green-400', bg: 'bg-green-400/5' },
]

const emptyForm = {
  name: '', company: '', email: '', phone: '', notes: '', status: 'A_CONTACTER',
  budget: '', source: '', assignedTo: '',
}

export default function CommercialPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Prospect | null>(null)
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/prospects').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([p, u]) => { setProspects(p); setUsers(u) }).finally(() => setLoading(false))
  }, [])

  function openModal(item?: Prospect, defaultStatus?: string) {
    if (item) {
      setEditItem(item)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { assignee, budget, assignedTo, ...rest } = item
      setForm({ ...rest, budget: budget?.toString() ?? '', assignedTo: assignedTo ?? '' })
    } else {
      setEditItem(null)
      setForm({ ...emptyForm, status: defaultStatus ?? 'A_CONTACTER' })
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      budget: form.budget ? parseFloat(form.budget) : null,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
      source: form.source || null,
      assignedTo: form.assignedTo || null,
    }
    if (editItem) {
      const res = await fetch(`/api/prospects/${editItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const updated = await res.json()
      setProspects(prev => prev.map(p => p.id === editItem.id ? updated : p))
    } else {
      const res = await fetch('/api/prospects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json()
      setProspects(prev => [created, ...prev])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce prospect ?')) return
    await fetch(`/api/prospects/${id}`, { method: 'DELETE' })
    setProspects(prev => prev.filter(p => p.id !== id))
  }

  async function handleDrop(status: string) {
    if (!dragId) return
    const prospect = prospects.find(p => p.id === dragId)
    if (!prospect || prospect.status === status) { setDragId(null); return }
    const res = await fetch(`/api/prospects/${dragId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    setProspects(prev => prev.map(p => p.id === dragId ? updated : p))
    setDragId(null)
  }

  return (
    <div className="p-8 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-white">Commercial</h1>
          <p className="text-slate-400 text-sm mt-1">{prospects.filter(p => p.status === 'SIGNE').length} deals signés · {formatCurrency(prospects.filter(p => p.status === 'SIGNE').reduce((s, p) => s + (p.budget ?? 0), 0))} CA potentiel</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Ajouter un prospect
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : (
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colProspects = prospects.filter(p => p.status === col.key)
            return (
              <div key={col.key}
                className={`flex-shrink-0 w-64 rounded-2xl p-3 flex flex-col gap-2 ${col.bg} border border-slate-800/50`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}>
                <div className={`flex items-center justify-between mb-1 ${col.color}`}>
                  <span className="font-medium text-sm">{col.label}</span>
                  <span className="text-xs bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-full">{colProspects.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {colProspects.map(p => (
                    <div key={p.id} draggable onDragStart={() => setDragId(p.id)}
                      className="bg-[#111118] border border-slate-800 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-slate-700 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-white text-sm font-medium leading-tight">{p.name}</p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openModal(p)} className="p-1 text-slate-500 hover:text-white transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {p.company && (
                        <p className="text-slate-500 text-xs mb-2">{p.company}</p>
                      )}
                      <div className="space-y-1">
                        {p.budget && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Euro size={11} />
                            <span>{formatCurrency(p.budget)}</span>
                          </div>
                        )}
                        {p.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Phone size={11} />
                            <span>{p.phone}</span>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Mail size={11} />
                            <span className="truncate">{p.email}</span>
                          </div>
                        )}
                        {p.assignee && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User size={11} />
                            <span>{p.assignee.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => openModal(undefined, col.key)}
                  className="w-full py-2 text-slate-600 hover:text-slate-400 text-xs transition-colors border border-dashed border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-center gap-1">
                  <Plus size={12} /> Ajouter
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-semibold text-lg mb-5">{editItem ? 'Modifier le prospect' : 'Nouveau prospect'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Entreprise</label>
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Téléphone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Budget (€)</label>
                  <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Source</label>
                  <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="LinkedIn, référence..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Assigné à</label>
                  <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="">Non assigné</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
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
