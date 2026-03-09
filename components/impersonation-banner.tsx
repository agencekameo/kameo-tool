'use client'

import { useSession, signIn } from 'next-auth/react'
import { useState } from 'react'
import { Eye, ArrowLeft, Loader2 } from 'lucide-react'

export function ImpersonationBanner() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)

  const impersonatingFrom = (session?.user as { impersonatingFrom?: string })?.impersonatingFrom
  const userName = session?.user?.name

  if (!impersonatingFrom) return null

  async function handleStop() {
    setLoading(true)
    try {
      const res = await fetch('/api/impersonate/stop', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Erreur')
        setLoading(false)
        return
      }

      // Sign in as the original admin using the reverse token
      await signIn('credentials', {
        impersonationToken: data.token,
        redirect: false,
      })

      // Reload to refresh the entire app state
      window.location.href = '/'
    } catch {
      alert('Erreur lors du retour au compte admin.')
      setLoading(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-gradient-to-r from-[#E14B89] to-[#F8903C] px-4 py-2 text-white text-sm font-medium shadow-lg">
      <Eye size={15} className="flex-shrink-0" />
      <span>
        Vous voyez l&apos;application en tant que <strong>{userName}</strong>
      </span>
      <button
        onClick={handleStop}
        disabled={loading}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ml-2"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <ArrowLeft size={12} />
        )}
        Revenir à mon compte
      </button>
    </div>
  )
}
