'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Globe, Mail, Phone, ChevronRight, Wrench } from 'lucide-react'
import Link from 'next/link'
import { MAINTENANCE_LABELS } from '@/lib/utils'

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  website?: string
  maintenancePlan: string
  maintenancePrice?: number
  projects: { id: string }[]
}

const MAINTENANCE_COLORS: Record<string, string> = {
  NONE: 'bg-slate-800 text-slate-400',
  ESSENTIELLE: 'bg-teal-500/15 text-teal-400',
  DEVELOPPEMENT: 'bg-blue-500/15 text-blue-400',
  SEO: 'bg-violet-500/15 text-violet-400',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', website: '', notes: '',
    maintenancePlan: 'NONE', maintenancePrice: '',
  })

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).finally(() => setLoading(false))
  }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        maintenancePrice: form.maintenancePrice ? parseFloat(form.maintenancePrice) : null,
      }),
    })
    const client = await res.json()
    setClients(prev => [client, ...prev])
    setShowModal(false)
    setForm({ name: '', email: '', phone: '', company: '', website: '', notes: '', maintenancePlan: 'NONE', maintenancePrice: '' })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">{clients.length} client{clients.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouveau client
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          className="w-full max-w-sm bg-[#111118] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(client => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-700/20 border border-violet-500/20 flex items-center justify-center">
                  <span className="text-violet-400 font-semibold text-sm">{client.name[0].toUpperCase()}</span>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              <h3 className="text-white font-medium">{client.name}</h3>
              {client.company && <p className="text-slate-400 text-sm mt-0.5">{client.company}</p>}
              <div className="mt-3 space-y-1.5">
                {client.email && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Mail size={12} /><span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Phone size={12} /><span>{client.phone}</span>
                  </div>
                )}
                {client.website && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Globe size={12} /><span className="truncate">{client.website}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${MAINTENANCE_COLORS[client.maintenancePlan]}`}>
                  {client.maintenancePlan !== 'NONE' && <Wrench size={10} />}
                  {MAINTENANCE_LABELS[client.maintenancePlan]}
                </span>
                <span className="text-slate-500 text-xs">{client.projects.length} projet{client.projects.length > 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="col-span-3 text-center py-16 text-slate-500">Aucun client trouvé</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white font-semibold text-lg mb-5">Nouveau client</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Nom *</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Entreprise</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Téléphone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Site web</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Maintenance</label>
                  <select value={form.maintenancePlan} onChange={e => setForm({ ...form, maintenancePlan: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    <option value="NONE">Aucune</option>
                    <option value="ESSENTIELLE">Essentielle (59,99€)</option>
                    <option value="DEVELOPPEMENT">Développement (99,99€)</option>
                    <option value="SEO">SEO (179,99€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix mensuel (€)</label>
                  <input type="number" value={form.maintenancePrice} onChange={e => setForm({ ...form, maintenancePrice: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  Créer le client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
