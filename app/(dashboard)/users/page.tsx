'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Plus, Trash2, Clock, Eye, X, Users2, Shield, Check, Save, Loader2 } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS, ROLE_AVATAR_COLORS } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

interface User {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  lastSeen?: string
  createdAt: string
}

const ROLES = ['ADMIN', 'DEVELOPER', 'REDACTEUR', 'DESIGNER', 'COMMERCIAL']
const ROLE_ORDER: Record<string, number> = { ADMIN: 0, DESIGNER: 1, DEVELOPER: 2, REDACTEUR: 3, COMMERCIAL: 4 }
const sortByRole = (a: User, b: User) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)

const ALL_PAGES = [
  'Dashboard', 'Finances', 'Clients', 'Tâches', 'Avis', 'Agenda',
  'Projets', 'Petits projets', 'Maintenances', 'Aysha',
  'Prospects', 'Commerciaux', 'Devis', 'Skills', 'Partenaires',
  'Wiki', 'Audit SEO', 'Rédaction', 'Fiches Google',
  'Paramètres', 'Contrats', 'Mandats',
  'Messagerie',
]

const DEFAULT_ROLE_ACCESS: Record<string, string[]> = {
  ADMIN: ALL_PAGES,
  DEVELOPER: ['Projets', 'Wiki', 'Audit SEO', 'Messagerie'],
  REDACTEUR: ['Projets', 'Wiki', 'Audit SEO', 'Rédaction', 'Messagerie'],
  DESIGNER: ['Projets', 'Wiki', 'Audit SEO', 'Aysha', 'Fiches Google', 'Messagerie'],
  COMMERCIAL: ['Dashboard', 'Prospects', 'Commerciaux', 'Devis', 'Audit SEO', 'Partenaires', 'Messagerie'],
}

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

// Page categories for the matrix display
const PAGE_GROUPS = [
  { label: "Vue d'ensemble", pages: ['Dashboard', 'Finances', 'Clients', 'Tâches', 'Avis', 'Agenda'] },
  { label: 'Suivi', pages: ['Projets', 'Petits projets', 'Maintenances', 'Aysha'] },
  { label: 'Commercial', pages: ['Prospects', 'Commerciaux', 'Devis', 'Skills', 'Partenaires'] },
  { label: 'Ressources', pages: ['Wiki', 'Audit SEO', 'Rédaction', 'Fiches Google'] },
  { label: 'Communication', pages: ['Messagerie'] },
  { label: 'Admin', pages: ['Paramètres', 'Contrats', 'Mandats'] },
]

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showRolesModal, setShowRolesModal] = useState(false)
  const [previewUser, setPreviewUser] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'DEVELOPER' })
  const [error, setError] = useState('')
  const [impersonating, setImpersonating] = useState<string | null>(null) // userId being impersonated

  // Role permissions state
  const [roleAccess, setRoleAccess] = useState<Record<string, string[]>>(DEFAULT_ROLE_ACCESS)
  const [savingRoles, setSavingRoles] = useState(false)
  const [rolesSaved, setRolesSaved] = useState(false)

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  const loadRolePermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/settings?key=rolePermissions')
      const data = await res.json()
      if (data.value) {
        setRoleAccess(JSON.parse(data.value))
      }
    } catch {
      // fallback to defaults
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r => r.json()).then((data: User[]) => setUsers(data.sort(sortByRole))),
      loadRolePermissions(),
    ]).finally(() => setLoading(false))
  }, [loadRolePermissions])

  function refreshData() {
    Promise.all([
      fetch('/api/users').then(r => r.json()).then((data: User[]) => setUsers(data.sort(sortByRole))),
      loadRolePermissions(),
    ])
  }
  usePolling(refreshData)

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
    setUsers(prev => [...prev, data].sort(sortByRole))
    setShowModal(false)
    setForm({ name: '', email: '', password: '', role: 'DEVELOPER' })
  }

  async function handleRoleChange(userId: string, role: string) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) return // ignore failed role changes
    const updated = await res.json()
    setUsers(prev => prev.map(u => u.id === userId ? updated : u).sort(sortByRole))
  }

  async function handleDelete(userId: string) {
    if (!confirm('Supprimer cet utilisateur ?')) return
    await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  function togglePageAccess(role: string, page: string) {
    setRoleAccess(prev => {
      const current = prev[role] ?? []
      const has = current.includes(page)
      return {
        ...prev,
        [role]: has ? current.filter(p => p !== page) : [...current, page],
      }
    })
    setRolesSaved(false)
  }

  async function saveRolePermissions() {
    setSavingRoles(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'rolePermissions', value: JSON.stringify(roleAccess) }),
      })
      setRolesSaved(true)
      setTimeout(() => setRolesSaved(false), 2000)
    } finally {
      setSavingRoles(false)
    }
  }

  async function handleImpersonate(userId: string) {
    setImpersonating(userId)
    try {
      const res = await fetch(`/api/users/${userId}/impersonate`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Erreur lors de l\'impersonation.')
        setImpersonating(null)
        return
      }

      // Sign in as the target user using the impersonation token
      await signIn('credentials', {
        impersonationToken: data.token,
        redirect: false,
      })

      // Redirect to home to see the app as the impersonated user
      window.location.href = '/'
    } catch {
      alert('Erreur lors de la connexion.')
      setImpersonating(null)
    }
  }

  const accessPages = previewUser
    ? (roleAccess[previewUser.role] ?? [])
    : []

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Équipe</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} membre{users.length > 1 ? 's' : ''} dans l&apos;équipe</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowRolesModal(true)}
              className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Shield size={15} />
              Rôles
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium">Utilisateur</th>
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium hidden sm:table-cell">Email</th>
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium">Rôle</th>
                <th className="text-left px-6 py-4 text-slate-400 text-xs font-medium hidden md:table-cell">Dernière connexion</th>
                {isAdmin && <th className="px-6 py-4" />}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const gradient = ROLE_AVATAR_COLORS[user.role] ?? 'from-slate-400 to-slate-600'
                const online = isOnline(user.lastSeen)
                return (
                  <tr
                    key={user.id}
                    className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${i === users.length - 1 ? 'border-0' : ''}`}
                  >
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
                    <td className="px-6 py-4 text-slate-400 text-sm hidden sm:table-cell">{user.email}</td>
                    <td className="px-6 py-4">
                      {isAdmin && user.id !== (session?.user as { id?: string })?.id ? (
                        <select
                          value={user.role}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium bg-transparent cursor-pointer ${ROLE_COLORS[user.role]}`}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r} className="bg-[#111118] text-white">{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                        <Clock size={12} />
                        {timeAgo(user.lastSeen)}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleImpersonate(user.id)}
                            disabled={impersonating === user.id}
                            title={`Se connecter en tant que ${user.name}`}
                            className="text-slate-600 hover:text-blue-400 disabled:opacity-50 transition-colors p-1"
                          >
                            {impersonating === user.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                          {user.id !== (session?.user as { id?: string })?.id && (
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="text-slate-600 hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Roles management modal ──────────────────────────────────────────── */}
      {showRolesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-5xl my-8">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-[#E14B89]" />
                <div>
                  <h2 className="text-white font-semibold">Gestion des rôles</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Définissez les pages accessibles par rôle</p>
                </div>
              </div>
              <button onClick={() => setShowRolesModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Roles legend */}
            <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap gap-3">
              {['ADMIN', 'DEVELOPER', 'DESIGNER', 'REDACTEUR', 'COMMERCIAL'].map(r => (
                <div key={r} className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ROLE_COLORS[r] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                    {ROLE_LABELS[r] ?? r}
                  </span>
                  <span className="text-slate-500 text-xs">{(roleAccess[r] ?? []).length} pages</span>
                </div>
              ))}
            </div>

            {/* Permission matrix */}
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: '620px' }}>
                <thead>
                  <tr>
                    <th className="text-left text-slate-500 font-medium pb-3 pr-4 w-40">Page</th>
                    {['ADMIN', 'DEVELOPER', 'DESIGNER', 'REDACTEUR', 'COMMERCIAL'].map(r => (
                      <th key={r} className="text-center pb-3 px-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[r] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                          {ROLE_LABELS[r] ?? r}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PAGE_GROUPS.map(group => (
                    <>
                      <tr key={`group-${group.label}`}>
                        <td colSpan={7} className="py-2 pt-4">
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                            {group.label}
                          </span>
                        </td>
                      </tr>
                      {group.pages.map(page => (
                        <tr key={page} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                          <td className="py-2.5 pr-4 text-slate-300 font-medium">{page}</td>
                          {['ADMIN', 'DEVELOPER', 'DESIGNER', 'REDACTEUR', 'COMMERCIAL'].map(r => {
                            const hasAccess = (roleAccess[r] ?? []).includes(page)
                            const isAdminRole = r === 'ADMIN'
                            return (
                              <td key={r} className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => !isAdminRole && togglePageAccess(r, page)}
                                  disabled={isAdminRole}
                                  title={isAdminRole ? 'Admin a toujours accès à tout' : hasAccess ? 'Retirer l\'accès' : 'Donner l\'accès'}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                    hasAccess
                                      ? 'bg-[#E14B89]/15 border border-[#E14B89]/30 text-[#E14B89]'
                                      : 'bg-slate-800/50 border border-slate-700/50 text-slate-600'
                                  } ${isAdminRole ? 'opacity-60 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}`}
                                >
                                  {hasAccess ? <Check size={12} /> : <span className="text-[10px]">–</span>}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
              <p className="text-slate-500 text-xs">
                Les modifications s&apos;appliquent à la prévisualisation des accès.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setRoleAccess(DEFAULT_ROLE_ACCESS); setRolesSaved(false) }}
                  className="text-slate-400 hover:text-white text-sm transition-colors px-4 py-2 rounded-xl hover:bg-slate-800/50"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => setShowRolesModal(false)}
                  className="border border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={saveRolePermissions}
                  disabled={savingRoles}
                  className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity"
                >
                  {rolesSaved ? (
                    <><Check size={14} /> Enregistré</>
                  ) : (
                    <><Save size={14} /> {savingRoles ? 'Enregistrement...' : 'Enregistrer'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Access preview modal ────────────────────────────────────────────── */}
      {previewUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${ROLE_AVATAR_COLORS[previewUser.role] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center`}>
                  <span className="text-white font-semibold text-sm">{previewUser.name[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{previewUser.name}</p>
                  <p className="text-slate-500 text-xs">{ROLE_LABELS[previewUser.role] ?? previewUser.role}</p>
                </div>
              </div>
              <button onClick={() => setPreviewUser(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Users2 size={15} className="text-[#E14B89]" />
              <p className="text-white text-sm font-medium">Pages accessibles</p>
              <span className="ml-auto text-xs text-slate-500">{accessPages.length} page{accessPages.length > 1 ? 's' : ''}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {accessPages.map(page => (
                <div
                  key={page}
                  className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-xl px-3 py-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E14B89] flex-shrink-0" />
                  <span className="text-slate-300 text-xs">{page}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPreviewUser(null)}
              className="w-full mt-5 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── Create user modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-5">
              <Users2 size={18} className="text-[#E14B89]" />
              <h2 className="text-white font-semibold text-lg">Nouvel utilisateur</h2>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom complet *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Mot de passe *</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Rôle</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
