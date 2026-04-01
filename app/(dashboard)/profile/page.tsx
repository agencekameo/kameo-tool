'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Save, Camera, Lock, User, Upload, Eye, EyeOff } from 'lucide-react'
import { ROLE_LABELS, ROLE_AVATAR_COLORS } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

/**
 * Compress and normalize an image through Canvas.
 * Fixes the "too bright / luminous" issue from modern phone cameras
 * (Display P3 wide-gamut color profiles) by converting to sRGB via canvas.
 * Also resizes to max 400 px and encodes as JPEG 80%.
 */
async function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const MAX = 400
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width)
          width = MAX
        } else {
          width = Math.round((width * MAX) / height)
          height = MAX
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [form, setForm] = useState({ name: '', email: '', avatar: '' })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false })
  const [msg, setMsg] = useState('')
  const [msgPw, setMsgPw] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Fetch profile from the API (not from session).
   * Avatar is NOT stored in the JWT (cookie size limit), so we always fetch
   * it from the DB via /api/profile.
   * Dependency: session?.user?.id — only re-runs on login/logout,
   * NOT when session.name/email are updated via update(), preventing the
   * "avatar disappears" bug.
   */
  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setForm({
          name: data.name ?? '',
          email: data.email ?? '',
          avatar: data.avatar ?? '',
        })
      })
      .catch(() => {})
  }, [session?.user?.id])

  function refreshProfile() {
    if (!session?.user?.id) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setForm({
          name: data.name ?? '',
          email: data.email ?? '',
          avatar: data.avatar ?? '',
        })
      })
      .catch(() => {})
  }
  usePolling(refreshProfile)

  function handlePhotoClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMsg('Fichier invalide — choisissez une image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg('Image trop lourde (max 5 Mo)')
      return
    }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const raw = reader.result as string
        // Compress + normalize color space via Canvas (fixes wide-gamut / "trop lumineuse")
        const compressed = await compressImage(raw)
        setForm(prev => ({ ...prev, avatar: compressed }))

        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: compressed }),
        })

        if (res.ok) {
          setMsg('Photo mise à jour ✓')
          // Notify sidebar (and any other listener) to refresh avatar
          window.dispatchEvent(
            new CustomEvent('kameo:avatar-updated', { detail: { avatar: compressed } })
          )
          // ⚠️ Do NOT call update({}) here — it triggers the session refresh,
          //    which would reset form.avatar to empty (avatar is not in JWT).
        } else {
          let errMsg = `Erreur ${res.status} lors de l'upload`
          try {
            const errData = await res.json()
            if (errData?.error) errMsg = errData.error
          } catch { /* response was not JSON (likely a 500 HTML page) */ }
          setMsg(errMsg)
          setForm(prev => ({ ...prev, avatar: '' }))
        }
      } catch {
        setMsg("Erreur lors du traitement de l'image")
      } finally {
        setUploading(false)
      }
    }
    reader.onerror = () => {
      setMsg('Impossible de lire le fichier')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email }),
    })
    if (res.ok) {
      // update() only refreshes name/email in JWT — NOT avatar (cookie size limit).
      // Since useEffect depends on session?.user?.id (not session), this update
      // won't reset form.avatar.
      await update({ name: form.name, email: form.email })
      setMsg('Profil mis à jour ✓')
    } else {
      setMsg('Erreur lors de la mise à jour')
    }
    setSaving(false)
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) {
      setMsgPw('Les mots de passe ne correspondent pas')
      return
    }
    if (pwForm.newPassword.length < 8) {
      setMsgPw('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
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
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Mon profil</h1>
        <p className="text-slate-400 text-sm mt-1">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar + role */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="relative group cursor-pointer flex-shrink-0" onClick={handlePhotoClick}>
          {form.avatar ? (
            <img
              src={form.avatar}
              alt={form.name}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-slate-700 group-hover:ring-[#E14B89] transition-all"
            />
          ) : (
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center ring-2 ring-slate-700 group-hover:ring-[#E14B89] transition-all`}
            >
              <span className="text-white font-bold text-2xl">{initial}</span>
            </div>
          )}
          <div
            className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${uploading ? 'opacity-100' : ''}`}
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera size={18} className="text-white" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#E14B89] rounded-full flex items-center justify-center border-2 border-[#0d0d14]">
            <Upload size={12} className="text-white" />
          </div>
        </div>

        <div className="text-center sm:text-left">
          <p className="text-white font-semibold text-lg">{form.name}</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20">
            {ROLE_LABELS[role] ?? role}
          </span>
          <p className="text-slate-500 text-xs mt-2">Cliquez sur la photo pour en changer</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Profile + Password side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Profile form */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={16} className="text-[#E14B89]" />
          <h2 className="text-white font-medium">Informations</h2>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Nom complet</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              maxLength={100}
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
            />
          </div>
          {msg && (
            <p
              className={`text-sm px-4 py-3 rounded-xl border ${
                msg.includes('✓')
                  ? 'text-green-400 bg-green-400/10 border-green-400/20'
                  : 'text-red-400 bg-red-400/10 border-red-400/20'
              }`}
            >
              {msg}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Save size={15} />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </form>
      </div>

      {/* Password form */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 self-start">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={16} className="text-[#E14B89]" />
          <h2 className="text-white font-medium">Mot de passe</h2>
        </div>
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showPw.current ? 'text' : 'password'}
                value={pwForm.currentPassword}
                onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                required
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
              />
              <button type="button" onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPw.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPw.new ? 'text' : 'password'}
                value={pwForm.newPassword}
                onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                required
                minLength={8}
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
              />
              <button type="button" onClick={() => setShowPw(s => ({ ...s, new: !s.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPw.new ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Confirmer le mot de passe</label>
            <div className="relative">
              <input
                type={showPw.confirm ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                required
                minLength={8}
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
              />
              <button type="button" onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {msgPw && (
            <p
              className={`text-sm px-4 py-3 rounded-xl border ${
                msgPw.includes('✓')
                  ? 'text-green-400 bg-green-400/10 border-green-400/20'
                  : 'text-red-400 bg-red-400/10 border-red-400/20'
              }`}
            >
              {msgPw}
            </p>
          )}
          <button
            type="submit"
            disabled={savingPw}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Lock size={15} />
            {savingPw ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>

      </div>{/* end grid */}
    </div>
  )
}
