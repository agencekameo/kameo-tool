'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Save, Camera, Lock, User } from 'lucide-react'
import { ROLE_LABELS, ROLE_AVATAR_COLORS } from '@/lib/utils'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [form, setForm] = useState({ name: '', email: '', avatar: '' })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgPw, setMsgPw] = useState('')

  useEffect(() => {
    if (session?.user) {
      setForm({ name: session.user.name ?? '', email: session.user.email ?? '', avatar: (session.user as { avatar?: string }).avatar ?? '' })
    }
  }, [session])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, avatar: form.avatar }),
    })
    if (res.ok) {
      await update({ name: form.name, email: form.email })
      setMsg('Profil mis à jour ✓')
    } else {
      setMsg('Erreur lors de la mise à jour')
    }
    setSaving(false)
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) { setMsgPw('Les mots de passe ne correspondent pas'); return }
    setSavingPw(true)
    setMsgPw('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsgPw('Mot de passe modifié ✓')
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
    } else {
      setMsgPw(data.error || 'Erreur')
    }
    setSavingPw(false)
  }

  const role = (session?.user as { role?: string })?.role ?? ''
  const avatarGradient = ROLE_AVATAR_COLORS[role] ?? 'from-slate-400 to-slate-600'
  const initial = form.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Mon profil</h1>
        <p className="text-slate-400 text-sm mt-1">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar + role */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-6 flex items-center gap-5">
        <div className="relative">
          {form.avatar ? (
            <img src={form.avatar} alt={form.name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center`}>
              <span className="text-white font-bold text-xl">{initial}</span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#E14B89] rounded-full flex items-center justify-center">
            <Camera size={11} className="text-white" />
          </div>
        </div>
        <div>
          <p className="text-white font-semibold text-lg">{form.name}</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20">
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={16} className="text-[#E14B89]" />
          <h2 className="text-white font-medium">Informations</h2>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Nom complet</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">URL avatar (optionnel)</label>
            <input value={form.avatar} onChange={e => setForm({ ...form, avatar: e.target.value })} placeholder="https://..."
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>
          {msg && (
            <p className={`text-sm px-4 py-3 rounded-xl border ${msg.includes('✓') ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'}`}>{msg}</p>
          )}
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Save size={15} />{saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </form>
      </div>

      {/* Password form */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={16} className="text-[#E14B89]" />
          <h2 className="text-white font-medium">Mot de passe</h2>
        </div>
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Mot de passe actuel</label>
            <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} required
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Nouveau mot de passe</label>
            <input type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} required
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Confirmer le mot de passe</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} required
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>
          {msgPw && (
            <p className={`text-sm px-4 py-3 rounded-xl border ${msgPw.includes('✓') ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'}`}>{msgPw}</p>
          )}
          <button type="submit" disabled={savingPw}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Lock size={15} />{savingPw ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
