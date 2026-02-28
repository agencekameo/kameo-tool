'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, HardDrive, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Backup {
  id: string
  clientName: string
  clientId?: string
  url?: string
  provider?: string
  type: string
  size?: string
  status: string
  backupDate: string
  notes?: string
  client?: { id: string; name: string }
}

interface Client { id: string; name: string }

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  OK: { label: 'OK', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
  PARTIAL: { label: 'Partiel', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  FAILED: { label: 'Échec', icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  EN_COURS: { label: 'En cours', icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
}

const emptyForm = { clientName: '', clientId: '', url: '', provider: '', type: 'FULL', size: '', status: 'OK', backupDate: new Date().toISOString().split('T')[0], notes: '' }

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Backup | null>(null)
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/backups').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([b, c]) => { setBackups(b); setClients(c) }).finally(() => setLoading(false))
  }, [])

  function openModal(item?: Backup) {
    if (item) {
      setEditItem(item)
      setForm({ clientName: item.clientName, clientId: item.clientId ?? '', url: item.url ?? '', provider: item.provider ?? '', type: item.type, size: item.size ?? '', status: item.status, backupDate: item.backupDate.split('T')[0], notes: item.notes ?? '' })
    } else {
      setEditItem(null)
      setForm(emptyForm)
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, clientId: form.clientId || null, url: form.url || null, provider: form.provider || null, size: form.size || null, notes: form.notes || null }
    if (editItem) {
      const res = await fetch(`/api/backups/${editItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const updated = await res.json()
      setBackups(prev => prev.map(b => b.id === editItem.id ? updated : b))
    } else {
      const res = await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const created = await res.json()
      setBackups(prev => [created, ...prev])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce backup ?')) return
    await fetch(`/api/backups/${id}`, { method: 'DELETE' })
    setBackups(prev => prev.filter(b => b.id !== id))
  }

  const filtered = backups.filter(b => b.clientName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Backups</h1>
          <p className="text-slate-400 text-sm mt-1">{backups.length} sauvegardes · {backups.filter(b => b.status === 'OK').length} OK</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client..."
          className="bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] w-full sm:w-80 transition-colors placeholder:text-slate-600" />
      </div>

      {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">Aucun backup</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Client</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden sm:table-cell">Hébergeur</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Taille</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Statut</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const s = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.OK
                  const Icon = s.icon
                  return (
                    <tr key={b.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-white text-sm font-medium">{b.clientName}</p>
                        {b.url && <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 text-xs hover:text-[#E14B89] transition-colors truncate block max-w-[150px]">{b.url.replace(/^https?:\/\//, '')}</a>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm">{b.type}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm hidden sm:table-cell">{b.provider ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">{b.size ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit ${s.bg} ${s.color}`}>
                          <Icon size={11} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm hidden sm:table-cell">{formatDate(b.backupDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(b)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(b.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-colors"><Trash2 size={13} /></button>
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
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-5">
              <HardDrive size={18} className="text-[#E14B89]" />
              <h2 className="text-white font-semibold text-lg">{editItem ? 'Modifier le backup' : 'Nouveau backup'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Client *</label>
                <select value={form.clientId} onChange={e => {
                  const client = clients.find(c => c.id === e.target.value)
                  setForm({ ...form, clientId: e.target.value, clientName: client?.name ?? form.clientName })
                }} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="">Saisir manuellement</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!form.clientId && (
                  <input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} placeholder="Nom du client" required
                    className="mt-2 w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="FULL">Complet</option>
                    <option value="INCREMENTAL">Incrémental</option>
                    <option value="DATABASE">Base de données</option>
                    <option value="FICHIERS">Fichiers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="OK">OK</option>
                    <option value="PARTIAL">Partiel</option>
                    <option value="FAILED">Échec</option>
                    <option value="EN_COURS">En cours</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Hébergeur</label>
                  <input value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="OVH, o2switch..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Taille</label>
                  <input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="2.3 GB"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">URL du site</label>
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Date du backup *</label>
                <input type="date" required value={form.backupDate} onChange={e => setForm({ ...form, backupDate: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
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
