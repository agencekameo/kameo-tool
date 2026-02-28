'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Receipt, Check, Clock, X } from 'lucide-react'
import { formatCurrency, formatDate, ROLE_AVATAR_COLORS } from '@/lib/utils'
import { useSession } from 'next-auth/react'

interface ExpenseReport {
  id: string
  userId: string
  date: string
  amount: number
  description: string
  category: string
  status: string
  notes?: string
  user: { id: string; name: string; avatar?: string }
}

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport', REPAS: 'Repas', HEBERGEMENT: 'Hébergement',
  MATERIEL: 'Matériel', LOGICIEL: 'Logiciel', AUTRE: 'Autre'
}
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  EN_ATTENTE: { label: 'En attente', color: 'text-amber-400 bg-amber-400/10', icon: Clock },
  VALIDE: { label: 'Validé', color: 'text-green-400 bg-green-400/10', icon: Check },
  REMBOURSE: { label: 'Remboursé', color: 'text-blue-400 bg-blue-400/10', icon: Check },
  REFUSE: { label: 'Refusé', color: 'text-red-400 bg-red-400/10', icon: X },
}

const emptyForm = { date: new Date().toISOString().split('T')[0], amount: '', description: '', category: 'AUTRE', notes: '', userId: '' }

export default function NotesDefraisPage() {
  const { data: session } = useSession()
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [users, setUsers] = useState<{id: string; name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<ExpenseReport | null>(null)
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [filterUser, setFilterUser] = useState('')

  const isAdmin = (session?.user as {role?: string})?.role === 'ADMIN'

  useEffect(() => {
    Promise.all([
      fetch('/api/expense-reports').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([r, u]) => { setReports(r); setUsers(u) }).finally(() => setLoading(false))
  }, [])

  function openModal(item?: ExpenseReport) {
    if (item) {
      setEditItem(item)
      setForm({ date: item.date.split('T')[0], amount: item.amount.toString(), description: item.description, category: item.category, notes: item.notes ?? '', userId: item.userId })
    } else {
      setEditItem(null)
      setForm({ ...emptyForm, userId: session?.user?.id ?? '' })
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, amount: parseFloat(form.amount), notes: form.notes || null }
    if (editItem) {
      const res = await fetch(`/api/expense-reports/${editItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const updated = await res.json()
      setReports(prev => prev.map(r => r.id === editItem.id ? updated : r))
    } else {
      const res = await fetch('/api/expense-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const created = await res.json()
      setReports(prev => [created, ...prev])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette note de frais ?')) return
    await fetch(`/api/expense-reports/${id}`, { method: 'DELETE' })
    setReports(prev => prev.filter(r => r.id !== id))
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/expense-reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const updated = await res.json()
    setReports(prev => prev.map(r => r.id === id ? updated : r))
  }

  const filtered = reports.filter(r => !filterUser || r.userId === filterUser)
  const totalPending = filtered.filter(r => r.status === 'EN_ATTENTE').reduce((s, r) => s + r.amount, 0)
  const totalReimbursed = filtered.filter(r => r.status === 'REMBOURSE').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Notes de frais</h1>
          <p className="text-slate-400 text-sm mt-1">{formatCurrency(totalPending)} en attente · {formatCurrency(totalReimbursed)} remboursé</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <div className="mb-4">
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          className="bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
          <option value="">Tous les membres</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">Aucune note de frais</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Membre</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden sm:table-cell">Catégorie</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Montant</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.EN_ATTENTE
                  const Icon = s.icon
                  const gradient = ROLE_AVATAR_COLORS['DEVELOPER']
                  return (
                    <tr key={r.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.user.avatar ? (
                            <img src={r.user.avatar} alt={r.user.name} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                              <span className="text-white text-xs font-semibold">{r.user.name[0]}</span>
                            </div>
                          )}
                          <span className="text-white text-sm">{r.user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{r.description}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm hidden sm:table-cell">{CATEGORY_LABELS[r.category] ?? r.category}</td>
                      <td className="px-4 py-3 text-white text-sm font-medium">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">{formatDate(r.date)}</td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${s.color} bg-transparent`}>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k} className="bg-[#111118] text-white">{v.label}</option>)}
                          </select>
                        ) : (
                          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit ${s.color}`}>
                            <Icon size={10} />{s.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(r)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-5">
              <Receipt size={18} className="text-[#E14B89]" />
              <h2 className="text-white font-semibold text-lg">{editItem ? 'Modifier' : 'Nouvelle note de frais'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isAdmin && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Membre</label>
                  <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Description *</label>
                <input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Montant (€) *</label>
                  <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Catégorie</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Date *</label>
                <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">{editItem ? 'Sauvegarder' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
