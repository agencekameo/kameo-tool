'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Veuillez renseigner votre email.'); return }
    setResetLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res.ok) {
        setResetSent(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erreur lors de l\'envoi.')
      }
    } catch {
      setError('Erreur réseau.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-2">
            <Image src="/kameo-logo.svg" alt="Kameo" width={140} height={44} style={{ objectFit: 'contain' }} />
          </div>
          <p className="text-slate-500 text-sm mt-1">Outil interne de l&apos;équipe</p>
        </div>

        {/* Card */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8">
          {resetMode ? (
            <>
              <h1 className="text-white font-semibold text-lg mb-2">Mot de passe oublié</h1>
              <p className="text-slate-500 text-sm mb-6">Un nouveau mot de passe vous sera envoyé par email.</p>

              {resetSent ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-green-400 font-medium text-sm">Email envoyé</p>
                  <p className="text-slate-500 text-xs mt-2">Vérifiez votre boîte de réception.</p>
                  <button onClick={() => { setResetMode(false); setResetSent(false) }}
                    className="mt-4 text-[#E14B89] text-sm hover:underline">
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
                      placeholder="vous@agence-kameo.fr"
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {resetLoading ? <><Loader2 size={16} className="animate-spin" /> Envoi...</> : 'Envoyer un nouveau mot de passe'}
                  </button>

                  <button type="button" onClick={() => { setResetMode(false); setError('') }}
                    className="w-full text-slate-500 text-sm hover:text-white transition-colors py-2">
                    Retour à la connexion
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h1 className="text-white font-semibold text-lg mb-6">Connexion</h1>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
                    placeholder="vous@agence-kameo.fr"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-sm mb-2">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
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
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>

                <button type="button" onClick={() => { setResetMode(true); setError('') }}
                  className="w-full text-slate-500 text-sm hover:text-[#E14B89] transition-colors py-1">
                  Mot de passe oublié ?
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
