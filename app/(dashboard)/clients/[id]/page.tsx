'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Globe, Mail, Phone, Wrench, FolderKanban, Pencil, Trash2, Save } from 'lucide-react'
import { MAINTENANCE_LABELS, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils'

interface Project {
  id: string
  name: string
  type: string
  status: string
  price?: number
  deadline?: string
}

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  website?: string
  notes?: string
  address?: string
  maintenancePlan: string
  maintenancePrice?: number
  projects: Project[]
  createdAt: string
}

export default function ClientDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})

  useEffect(() => {
    fetch(`/api/clients/${id}`).then(r => r.json()).then(data => {
      setClient(data)
      setForm(data)
    })
  }, [id])

  async function handleSave() {
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const updated = await res.json()
    setClient(updated)
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce client et tous ses projets ?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    router.push('/clients')
  }

  if (!client) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <Link href="/clients" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Retour aux clients
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-700/20 border border-[#E14B89]/20 flex items-center justify-center">
            <span className="text-[#E14B89] font-bold text-xl">{client.name[0].toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{client.name}</h1>
            {client.company && <p className="text-slate-400 mt-0.5">{client.company}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <button onClick={handleSave} className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm transition-colors">
              <Save size={14} /> Sauvegarder
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">
              <Pencil size={14} /> Modifier
            </button>
          )}
          <button onClick={handleDelete} className="flex items-center gap-2 border border-red-900/40 hover:border-red-700 text-red-500 hover:text-red-400 px-3 py-2 rounded-xl text-sm transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-medium mb-4">Informations</h2>
            {editing ? (
              <div className="space-y-3">
                {[
                  { key: 'name', label: 'Nom', type: 'text' },
                  { key: 'company', label: 'Entreprise', type: 'text' },
                  { key: 'email', label: 'Email', type: 'email' },
                  { key: 'phone', label: 'Téléphone', type: 'text' },
                  { key: 'website', label: 'Site web', type: 'text' },
                  { key: 'address', label: 'Adresse', type: 'text' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-slate-400 text-xs mb-1">{label}</label>
                    <input type={type} value={(form as Record<string, string>)[key] ?? ''}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                  </div>
                ))}
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Notes</label>
                  <textarea value={form.notes ?? ''} rows={3} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {client.email && (
                  <div className="flex items-center gap-3 text-sm"><Mail size={15} className="text-slate-500" /><span className="text-slate-300">{client.email}</span></div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-3 text-sm"><Phone size={15} className="text-slate-500" /><span className="text-slate-300">{client.phone}</span></div>
                )}
                {client.website && (
                  <div className="flex items-center gap-3 text-sm"><Globe size={15} className="text-slate-500" /><span className="text-slate-300">{client.website}</span></div>
                )}
                {client.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <p className="text-slate-400 text-xs mb-1">Notes</p>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-medium mb-4 flex items-center gap-2">
              <FolderKanban size={16} className="text-slate-400" />
              Projets ({client.projects.length})
            </h2>
            {client.projects.length === 0 ? (
              <p className="text-slate-500 text-sm">Aucun projet</p>
            ) : (
              <div className="space-y-2">
                {client.projects.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/40 transition-colors group">
                    <div>
                      <p className="text-white text-sm group-hover:text-[#F8903C] transition-colors">{project.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{PROJECT_TYPE_LABELS[project.type]}{project.deadline ? ` · ${formatDate(project.deadline)}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {project.price && <span className="text-slate-400 text-sm">{formatCurrency(project.price)}</span>}
                      <span className={`text-xs px-2.5 py-1 rounded-full ${PROJECT_STATUS_COLORS[project.status]}`}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-medium mb-4 flex items-center gap-2">
              <Wrench size={15} className="text-slate-400" /> Maintenance
            </h2>
            {editing ? (
              <div className="space-y-3">
                <select value={form.maintenancePlan ?? 'NONE'} onChange={e => setForm({ ...form, maintenancePlan: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="NONE">Aucune</option>
                  <option value="ESSENTIELLE">Essentielle</option>
                  <option value="DEVELOPPEMENT">Développement</option>
                  <option value="SEO">SEO</option>
                </select>
                <input type="number" value={form.maintenancePrice ?? ''} placeholder="Prix mensuel €"
                  onChange={e => setForm({ ...form, maintenancePrice: parseFloat(e.target.value) })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
            ) : (
              <div>
                <p className="text-white font-medium">{MAINTENANCE_LABELS[client.maintenancePlan]}</p>
                {client.maintenancePrice && (
                  <p className="text-slate-400 text-sm mt-1">{formatCurrency(client.maintenancePrice)}/mois</p>
                )}
              </div>
            )}
          </div>
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-400 text-xs">Client depuis</p>
            <p className="text-white font-medium mt-1">{formatDate(client.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
