'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, Shield, Clock } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS, ROLE_AVATAR_COLORS } from '@/lib/utils'

interface User {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  lastSeen?: string
  createdAt: string
}

const ROLES = ['ADMIN', 'DEVELOPER', 'REDACTEUR', 'DESIGNER', 'MEMBER']

function timeAgo(date?: string) {
  if (!date) return 'Jamais connecté'
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'À l\'instant'
  if (min < 60) return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `Il y a ${d}j`
  return new Date(date).toLocaleDateString('fr-FR')
}

function isOnline(date?: string) {
  if (!date) return false
  return Date.now() - new Date(date).getTime() < 5 * 60 * 1000
}

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'DEVELOPER' })
  const [error, setError] = useState('')

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erreur'); return }
    setUsers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setShowModal(false)
    setForm({ name: '', email: '', password: '', role: 'DEVELOPER' })
  }

  async function handleRoleChange(userId: string, role: string) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const updated = await res.json()
    setUsers(prev => prev.map(u => u.id === userId ? updated : u))
  }

  async function handleDelete(userId: string) {
    if (!confirm('Supprimer cet utilisateur ?')) return
    await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Utilisateurs</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} membre{users.length > 1 ? 's' : ''} dans l&apos;équipe</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Ajouter un utilisateur
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium">Utilisateur</th>
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium">Email</th>
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium">Rôle</th>
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium">Dernière connexion</th>
                {isAdmin && <th className="px-6 py-4" />}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const gradient = ROLE_AVATAR_COLORS[user.role] ?? 'from-slate-400 to-slate-600'
                const online = isOnline(user.lastSeen)
                return (
                  <tr key={user.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${i === users.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                              <span className="text-white font-semibold text-sm">{user.name[0]?.toUpperCase()}</span>
                            </div>
                          )}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111118] ${online ? 'bg-green-400' : 'bg-slate-600'}`} />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{user.name}</p>
                          {user.id === (session?.user as { id?: string })?.id && (
                            <span className="text-[#E14B89] text-xs">Vous</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{user.email}</td>
                    <td className="px-6 py-4">
                      {isAdmin && user.id !== (session?.user as { id?: string })?.id ? (
                        <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium bg-transparent cursor-pointer ${ROLE_COLORS[user.role]}`}>
                          {ROLES.map(r => <option key={r} value={r} className="bg-[#111118] text-white">{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                        <Clock size={12} />
                        {timeAgo(user.lastSeen)}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {user.id !== (session?.user as { id?: string })?.id && (
                          <button onClick={() => handleDelete(user.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors p-1">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={18} className="text-[#E14B89]" />
              <h2 className="text-white font-semibold text-lg">Nouvel utilisateur</h2>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom complet *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Email *</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Mot de passe *</label>
                <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Rôle</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
