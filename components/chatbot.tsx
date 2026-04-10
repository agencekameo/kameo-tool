'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any }
}
type SpeechRecognition = any
type SpeechRecognitionEvent = any

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, CheckCircle2, AlertCircle, Bot, Mic, MicOff } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  tools?: { name: string; status: string; result?: Record<string, unknown> }[]
}

export function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function toggleVoice() {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) { alert('La reconnaissance vocale necessite Chrome ou Edge.'); return }
      const recognition = new SpeechRecognition()
      recognition.lang = 'fr-FR'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('')
        setInput(transcript)
      }
      recognition.onend = () => setRecording(false)
      recognition.onerror = (e: any) => { console.error('Speech error:', e.error); setRecording(false) }
      recognitionRef.current = recognition
      recognition.start()
      setRecording(true)
    } catch (e) {
      console.error('Speech recognition error:', e)
      alert('Erreur de reconnaissance vocale. Verifiez les permissions du micro.')
    }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    // Add placeholder assistant message
    const assistantMsg: Message = { role: 'assistant', content: '', tools: [] }
    setMessages([...newMessages, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        setMessages([...newMessages, { role: 'assistant', content: `Erreur ${res.status}: ${errBody || 'Connexion impossible'}` }])
        setLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let fullText = ''
      const toolsList: { name: string; status: string; result?: Record<string, unknown> }[] = []
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) {
              fullText = `Erreur : ${data.error}`
              setMessages(prev => { const updated = [...prev]; updated[updated.length - 1] = { role: 'assistant', content: fullText }; return updated })
              continue
            }
            if (data.text) {
              fullText += data.text
              setMessages(prev => { const updated = [...prev]; updated[updated.length - 1] = { role: 'assistant', content: fullText, tools: toolsList }; return updated })
            }
            if (data.tool) {
              const existing = toolsList.find(t => t.name === data.tool && t.status === 'executing')
              if (existing) { existing.status = data.status; if (data.result) existing.result = data.result }
              else toolsList.push({ name: data.tool, status: data.status, result: data.result })
              setMessages(prev => { const updated = [...prev]; updated[updated.length - 1] = { role: 'assistant', content: fullText, tools: [...toolsList] }; return updated })
            }
          } catch { /* skip */ }
        }
      }

      // Final update
      setMessages(prev => { const updated = [...prev]; updated[updated.length - 1] = { role: 'assistant', content: fullText, tools: toolsList.length > 0 ? toolsList : undefined }; return updated })
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Erreur de connexion.' }])
    }
    setLoading(false)
  }

  const TOOL_LABELS: Record<string, string> = {
    create_quote: 'Creation devis',
    create_client: 'Creation client',
    list_quotes: 'Liste devis',
    list_clients: 'Liste clients',
    list_projects: 'Liste projets',
    get_stats: 'Statistiques',
    update_quote_status: 'Mise a jour devis',
    search_prospects: 'Recherche prospects',
    run_audit: 'Audit SEO',
  }

  function renderMarkdown(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) return <h3 key={i} className="text-white font-semibold text-xs mt-2 mb-1">{line.slice(4)}</h3>
      if (line.startsWith('## ')) return <h2 key={i} className="text-[#E14B89] font-bold text-sm mt-3 mb-1">{line.slice(3)}</h2>
      if (line.startsWith('# ')) return <h1 key={i} className="text-white font-bold text-sm mt-3 mb-1">{line.slice(2)}</h1>
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const parts = line.slice(2).split(/(\*\*[^*]+\*\*)/g)
        return <li key={i} className="text-xs ml-3 mb-0.5 list-disc text-slate-300">{parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-white">{p.slice(2, -2)}</strong> : p)}</li>
      }
      if (line.trim() === '') return <div key={i} className="h-1" />
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return <p key={i} className="text-xs text-slate-300 mb-0.5 leading-relaxed">{parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-white">{p.slice(2, -2)}</strong> : p)}</p>
    })
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-r from-[#E14B89] to-[#F8903C] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all z-50 flex items-center justify-center"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 w-[380px] h-[550px] bg-[#0d0d14] border border-slate-800 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#E14B89] to-[#F8903C] flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">KameoBot</h3>
              <p className="text-slate-500 text-[10px]">{loading ? <span className="text-[#E14B89] animate-pulse">En train de reflechir...</span> : 'IA · Devis, clients, projets...'}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot size={28} className="mx-auto text-slate-700 mb-2" />
                <p className="text-slate-500 text-xs">Comment puis-je vous aider ?</p>
                <div className="mt-3 space-y-1.5">
                  {['Combien de devis en attente ?', 'Crée un client Jean Dupont', 'Liste les projets en cours'].map(s => (
                    <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                      className="block w-full text-left text-[11px] text-slate-400 hover:text-white bg-[#111118] border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-2 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${msg.role === 'user' ? 'bg-[#E14B89]/20 text-white' : 'bg-[#111118] border border-slate-800'}`}>
                  {/* Tool executions */}
                  {msg.tools && msg.tools.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {msg.tools.map((t, ti) => (
                        <div key={ti} className="flex items-center gap-1.5 text-[10px]">
                          {t.status === 'executing' ? <Loader2 size={10} className="animate-spin text-[#F8903C]" /> : t.status === 'error' ? <AlertCircle size={10} className="text-red-400" /> : <CheckCircle2 size={10} className="text-emerald-400" />}
                          <span className={t.status === 'executing' ? 'text-[#F8903C]' : t.status === 'error' ? 'text-red-400' : 'text-emerald-400'}>
                            {TOOL_LABELS[t.name] || t.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Message content */}
                  {msg.role === 'user' ? (
                    <p className="text-xs">{msg.content}</p>
                  ) : msg.content ? (
                    <div>{renderMarkdown(msg.content)}</div>
                  ) : loading && i === messages.length - 1 ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 size={14} className="animate-spin text-[#E14B89]" />
                      <span className="text-[11px] text-slate-400 animate-pulse">Reflexion en cours...</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="px-3 py-3 border-t border-slate-800 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Demandez quelque chose..."
                disabled={loading}
                className="flex-1 bg-[#111118] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] disabled:opacity-50"
              />
              <button type="button" onClick={toggleVoice} disabled={loading}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#111118] border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'} disabled:opacity-30`}>
                {recording ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button type="submit" disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#E14B89] to-[#F8903C] flex items-center justify-center text-white disabled:opacity-30 hover:opacity-90 transition-opacity flex-shrink-0">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
