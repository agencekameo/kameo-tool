'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SetupPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [alreadySetup, setAlreadySetup] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Check if setup is still needed
  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        if (!data.needsSetup) setAlreadySetup(true)
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (form.password.length < 8) {
      setError('Mot de passe trop court (min. 8 caractères)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E14B89] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (alreadySetup) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8">
            <p className="text-white font-semibold mb-2">Setup déjà effectué</p>
            <p className="text-slate-400 text-sm mb-6">Des comptes existent déjà dans la base de données.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-[#E14B89] hover:opacity-90 text-white font-medium py-3 rounded-xl text-sm"
            >
              Aller à la connexion
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#111118] border border-green-500/30 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <p className="text-white font-semibold mb-1">Compte créé !</p>
            <p className="text-slate-400 text-sm">Redirection vers la connexion…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-2">
            <Image src="/kameo-logo.svg" alt="Kameo" width={140} height={44} style={{ objectFit: 'contain' }} />
          </div>
          <p className="text-slate-500 text-sm mt-1">Initialisation de la base de données</p>
        </div>

        <div className="bg-[#111118] border border-amber-500/30 rounded-2xl p-8">
          {/* Warning banner */}
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6">
            <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
            <div>
              <p className="text-amber-300 text-sm font-medium">Base de données vide</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Aucun compte n&apos;existe. Créez le premier compte administrateur pour accéder à l&apos;outil.
              </p>
            </div>
          </div>

          <h1 className="text-white font-semibold text-lg mb-6">Créer le compte admin</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-sm mb-2">Nom complet</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Benjamin Dubois"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                placeholder="vous@kameo.fr"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Confirmer le mot de passe</label>
              <input
                type="password"
                value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Création...' : 'Créer le compte admin'}
            </button>
          </form>

          <p className="text-slate-600 text-xs text-center mt-4">
            Les autres membres de l&apos;équipe pourront être ajoutés depuis la page <strong className="text-slate-500">Utilisateurs</strong> une fois connecté.
          </p>
        </div>
      </div>
    </div>
  )
}
