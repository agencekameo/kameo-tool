'use client'

import { useState } from 'react'
import { Send, Mail, User, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export default function EmailPage() {
  const [form, setForm] = useState({ to: '', subject: '', body: '' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult(null)
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setResult({ ok: true, msg: `Email envoyé à ${form.to} ✓` })
      setForm(prev => ({ ...prev, to: '', subject: '', body: '' }))
    } else {
      setResult({ ok: false, msg: data.error || 'Erreur lors de l\'envoi' })
    }
    setSending(false)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Composer un email</h1>
        <p className="text-slate-400 text-sm mt-1">Envoi depuis l&apos;adresse Gmail configurée</p>
      </div>

      {/* Config notice */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
        <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-blue-300 font-medium mb-1">Configuration Gmail requise</p>
          <p className="text-blue-400/80 text-xs">
            Pour activer l&apos;envoi, ajoutez dans Vercel → Settings → Environment Variables :<br />
            <code className="text-blue-300">GMAIL_USER</code> = votre adresse Gmail (ex: aysha@agence-kameo.fr)<br />
            <code className="text-blue-300">GMAIL_APP_PASSWORD</code> = mot de passe d&apos;application Google
            <br /><span className="text-blue-400/60 mt-1 block">Générez-le sur myaccount.google.com → Sécurité → Mots de passe des applications</span>
          </p>
        </div>
      </div>

      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5">
              <User size={12} /> Destinataire
            </label>
            <input
              type="email" required
              value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}
              placeholder="client@exemple.fr"
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5">
              <FileText size={12} /> Objet
            </label>
            <input
              required
              value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="Objet de l'email"
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5">
              <Mail size={12} /> Message
            </label>
            <textarea
              required rows={10}
              value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder="Rédigez votre message ici..."
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
            />
          </div>

          {result && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm ${result.ok ? 'bg-green-400/10 border-green-400/20 text-green-400' : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
              {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {result.msg}
            </div>
          )}

          <button
            type="submit" disabled={sending}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            {sending ? <><Loader2 size={15} className="animate-spin" /> Envoi en cours...</> : <><Send size={15} /> Envoyer</>}
          </button>
        </form>
      </div>
    </div>
  )
}
