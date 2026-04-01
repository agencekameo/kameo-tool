'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Pencil, X, Search, ChevronDown } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

interface SmallProject {
  id: string
  name: string
  clientId: string
  price: number
  charges: number
  description?: string
  signedAt: string
  status: 'NON_COMMENCE' | 'EN_COURS' | 'TERMINE'
  freelanceId?: string | null
  client: { id: string; name: string }
  freelance?: { id: string; name: string; avatar?: string | null } | null
}

interface Client { id: string; name: string }
interface UserOption { id: string; name: string; avatar?: string | null }

export default function SmallProjectsPage() {
  const [projects, setProjects] = useState<SmallProject[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<SmallProject | null>(null)
  const [form, setForm] = useState({ name: '', clientId: '', price: '', charges: '0', description: '', signedAt: '', status: 'NON_COMMENCE', freelanceId: '' })
  const [search, setSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

  async function changeStatus(id: string, status: string) {
    setStatusMenuId(null)
    const res = await fetch(`/api/small-projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    setProjects(prev => prev.map(p => p.id === id ? updated : p))
  }

  function fetchData() {
    setLoading(true)
    Promise.all([
      fetch('/api/small-projects').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([p, c, u]) => {
      setProjects(Array.isArray(p) ? p : [])
      setClients(Array.isArray(c) ? c : [])
      setUsers(Array.isArray(u) ? u : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  function refreshData() {
    fetch('/api/small-projects').then(r => r.json()).then(p => setProjects(Array.isArray(p) ? p : []))
  }
  usePolling(refreshData)

  function openModal(item?: SmallProject) {
    if (item) {
      setEditItem(item)
      setForm({
        name: item.name,
        clientId: item.clientId,
        price: String(item.price),
        charges: String(item.charges || 0),
        description: item.description || '',
        signedAt: item.signedAt.slice(0, 7),
        status: item.status,
        freelanceId: item.freelanceId || '',
      })
      setClientSearch(item.client.name)
    } else {
      setEditItem(null)
      setForm({ name: '', clientId: '', price: '', charges: '0', description: '', signedAt: new Date().toISOString().slice(0, 7), status: 'NON_COMMENCE', freelanceId: '' })
      setClientSearch('')
    }
    setShowClientDropdown(false)
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientId) return
    if (editItem) {
      const res = await fetch(`/api/small-projects/${editItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const updated = await res.json()
      setProjects(prev => prev.map(p => p.id === editItem.id ? updated : p))
    } else {
      const res = await fetch('/api/small-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const created = await res.json()
      setProjects(prev => [created, ...prev])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce petit projet ?')) return
    await fetch(`/api/small-projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalHT = filtered.reduce((s, p) => s + p.price, 0)

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Petits projets</h1>
          <p className="text-slate-400 text-sm mt-1">{projects.length} mission{projects.length > 1 ? 's' : ''} - Total: {formatCurrency(totalHT)} HT</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-1.5 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nouveau
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou client..."
          className="w-full max-w-md bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors placeholder:text-slate-600" />
      </div>

      {loading ? <p className="text-slate-500 text-sm">Chargement...</p> : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500 text-sm">Aucun petit projet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-5 py-3 text-slate-500 text-xs font-medium">Projet</th>
                    <th className="text-left px-5 py-3 text-slate-500 text-xs font-medium">Client</th>
                    <th className="text-left px-5 py-3 text-slate-500 text-xs font-medium">Statut</th>
                    <th className="text-center px-5 py-3 text-slate-500 text-xs font-medium">Freelance</th>
                    <th className="text-right px-5 py-3 text-slate-500 text-xs font-medium">Prix HT</th>
                    <th className="text-right px-5 py-3 text-slate-500 text-xs font-medium">Charges</th>
                    <th className="text-left px-5 py-3 text-slate-500 text-xs font-medium">Mois signature</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id} className={`${i < filtered.length - 1 ? 'border-b border-slate-800/30' : ''} hover:bg-slate-800/20 transition-colors`}>
                      <td className="px-5 py-3.5 text-white font-medium">{p.name}</td>
                      <td className="px-5 py-3.5 text-slate-300">{p.client.name}</td>
                      <td className="px-5 py-3.5">
                        <div className="relative">
                          <button onClick={() => setStatusMenuId(statusMenuId === p.id ? null : p.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:ring-1 hover:ring-slate-600 ${
                              p.status === 'TERMINE' ? 'bg-emerald-500/10 text-emerald-400' :
                              p.status === 'EN_COURS' ? 'bg-blue-500/10 text-blue-400' :
                              'bg-slate-500/10 text-slate-400'
                            }`}>
                            {p.status === 'TERMINE' ? 'Terminé' : p.status === 'EN_COURS' ? 'En cours' : 'Non commencé'}
                            <ChevronDown size={10} />
                          </button>
                          {statusMenuId === p.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setStatusMenuId(null)} />
                              <div className="absolute z-50 top-full left-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl overflow-hidden shadow-xl min-w-[140px]">
                                {([['NON_COMMENCE', 'Non commencé', 'bg-slate-500/10 text-slate-400'], ['EN_COURS', 'En cours', 'bg-blue-500/10 text-blue-400'], ['TERMINE', 'Terminé', 'bg-emerald-500/10 text-emerald-400']] as const).map(([val, label, cls]) => (
                                  <button key={val} onClick={() => changeStatus(p.id, val)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center gap-2 ${p.status === val ? 'opacity-50' : ''}`}>
                                    <span className={`inline-block w-2 h-2 rounded-full ${cls.split(' ')[0].replace('/10', '/60')}`} />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {p.freelance ? (
                          p.freelance.avatar ? (
                            <img src={p.freelance.avatar} alt={p.freelance.name} title={p.freelance.name}
                              className="w-7 h-7 rounded-full object-cover mx-auto" />
                          ) : (
                            <div title={p.freelance.name}
                              className="w-7 h-7 rounded-full bg-[#E14B89]/20 text-[#E14B89] flex items-center justify-center text-xs font-medium mx-auto">
                              {p.freelance.name.charAt(0).toUpperCase()}
                            </div>
                          )
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[#F8903C] font-medium">{formatCurrency(p.price)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-400">{p.charges ? formatCurrency(p.charges) : '—'}</td>
                      <td className="px-5 py-3.5 text-slate-400 capitalize">{new Date(p.signedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openModal(p)} className="p-1.5 text-slate-600 hover:text-white transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 bg-slate-800/20">
                    <td className="px-5 py-3 text-white font-semibold">Total</td>
                    <td className="px-5 py-3 text-slate-400">{filtered.length} projet{filtered.length > 1 ? 's' : ''}</td>
                    <td colSpan={2} />
                    <td className="px-5 py-3 text-right text-[#F8903C] font-bold">{formatCurrency(totalHT)}</td>
                    <td className="px-5 py-3 text-right text-slate-400 font-medium">{formatCurrency(filtered.reduce((s, p) => s + (p.charges || 0), 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">{editItem ? 'Modifier' : 'Nouveau petit projet'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du projet *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Refonte page d'accueil"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="relative">
                <label className="block text-slate-400 text-xs mb-1.5">Client *</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); if (!e.target.value) setForm({ ...form, clientId: '' }) }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    placeholder="Rechercher un client..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                  {form.clientId && (
                    <button type="button" onClick={() => { setForm({ ...form, clientId: '' }); setClientSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={14} /></button>
                  )}
                </div>
                {showClientDropdown && (
                  <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl max-h-40 overflow-y-auto shadow-lg">
                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                      <button key={c.id} type="button"
                        onMouseDown={() => { setForm({ ...form, clientId: c.id }); setClientSearch(c.name); setShowClientDropdown(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors first:rounded-t-xl last:rounded-b-xl ${form.clientId === c.id ? 'text-[#E14B89]' : 'text-slate-300'}`}>
                        {c.name}
                      </button>
                    ))}
                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-slate-500 text-xs">Aucun client trouvé</p>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix HT *</label>
                  <input type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Charges</label>
                  <input type="number" step="0.01" value={form.charges} onChange={e => setForm({ ...form, charges: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Mois de signature *</label>
                  <input type="month" required value={form.signedAt} onChange={e => setForm({ ...form, signedAt: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="NON_COMMENCE">Non commencé</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="TERMINE">Terminé</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Freelance</label>
                  <select value={form.freelanceId} onChange={e => setForm({ ...form, freelanceId: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="">— Aucun —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} placeholder="Détail de la mission..."
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
