'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Plus, Users, MessageSquare, X, UserPlus } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface Conversation {
  id: string
  name?: string
  isGroup: boolean
  projectId?: string
  participants: { user: { id: string; name: string; avatar?: string } }[]
  messages: { content: string; createdAt: string }[]
  project?: { name: string }
}

interface Message {
  id: string
  content: string
  createdAt: string
  sender: { id: string; name: string; avatar?: string }
}

interface User {
  id: string
  name: string
  avatar?: string
}

function getConversationName(conv: Conversation, currentUserId: string) {
  if (conv.name) return conv.name
  if (conv.project) return conv.project.name
  const others = conv.participants.filter(p => p.user.id !== currentUserId)
  if (others.length === 0) return 'Moi'
  if (others.length === 1) return others[0].user.name
  return others.map(p => p.user.name).join(', ')
}

function formatTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatMessageTime(iso: string) {
  const date = new Date(iso)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function MessageriePage() {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string })?.id ?? ''

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [showNewConvModal, setShowNewConvModal] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [newConvName, setNewConvName] = useState('')
  const [showParticipants, setShowParticipants] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(Array.isArray(data) ? data : [])
    } catch {
      // silent
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!selectedConvId) return
    try {
      const res = await fetch(`/api/conversations/${selectedConvId}/messages`)
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch {
      // silent
    }
  }, [selectedConvId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (!selectedConvId) return
    setShowParticipants(false)
    setShowAddMember(false)
    setLoadingMessages(true)
    fetchMessages().finally(() => setLoadingMessages(false))

    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [selectedConvId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || !selectedConvId || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      // Refresh conversations to update last message preview
      fetchConversations()
    } catch {
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function openNewConvModal() {
    setShowNewConvModal(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setAllUsers(Array.isArray(data) ? data.filter((u: User) => u.id !== currentUserId) : [])
    } catch {
      // silent
    }
  }

  async function handleCreateConversation(e: React.FormEvent) {
    e.preventDefault()
    if (selectedParticipants.length === 0) return
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newConvName || null,
          participantIds: [...selectedParticipants, currentUserId],
          isGroup: selectedParticipants.length > 1 || !!newConvName,
        }),
      })
      const conv = await res.json()
      setConversations(prev => [conv, ...prev])
      setSelectedConvId(conv.id)
      setShowNewConvModal(false)
      setSelectedParticipants([])
      setNewConvName('')
    } catch {
      // silent
    }
  }

  async function addMemberToConv(userId: string) {
    if (!selectedConvId) return
    try {
      const res = await fetch(`/api/conversations/${selectedConvId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setConversations(prev => prev.map(c => c.id === updated.id ? updated : c))
        setShowAddMember(false)
      }
    } catch { /* silent */ }
  }

  function toggleParticipant(userId: string) {
    setSelectedParticipants(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col bg-[#0d0d14]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[#E14B89]" />
            <h1 className="text-white font-semibold text-base">Messagerie</h1>
          </div>
          <button
            onClick={openNewConvModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            title="Nouvelle conversation">
            <Plus size={16} />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-4 text-slate-500 text-sm">Chargement...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-slate-500 text-sm">Aucune conversation</p>
              <button onClick={openNewConvModal}
                className="mt-3 text-[#E14B89] text-xs hover:underline">
                Démarrer une conversation
              </button>
            </div>
          ) : (
            conversations.map(conv => {
              const name = getConversationName(conv, currentUserId)
              const lastMsg = conv.messages?.[0]
              const isSelected = conv.id === selectedConvId
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors flex items-start gap-3 ${isSelected ? 'bg-[#E14B89]/10 border-l-2 border-l-[#E14B89]' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${
                    isSelected ? 'bg-[#E14B89]/20 text-[#E14B89]' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {conv.isGroup ? <Users size={15} /> : getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {name}
                      </p>
                      {lastMsg && (
                        <span className="text-slate-600 text-xs flex-shrink-0">{formatTime(lastMsg.createdAt)}</span>
                      )}
                    </div>
                    {lastMsg && (
                      <p className="text-slate-500 text-xs truncate mt-0.5">{lastMsg.content}</p>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={40} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Sélectionnez une conversation</p>
              <p className="text-slate-600 text-xs mt-1">ou créez-en une nouvelle</p>
            </div>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E14B89]/20 flex items-center justify-center text-xs font-semibold text-[#E14B89] flex-shrink-0">
                  {selectedConv.isGroup
                    ? <Users size={15} />
                    : getInitials(getConversationName(selectedConv, currentUserId))
                  }
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {getConversationName(selectedConv, currentUserId)}
                  </p>
                  <button
                    onClick={() => setShowParticipants(v => !v)}
                    className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
                  >
                    {selectedConv.participants.length} participant{selectedConv.participants.length > 1 ? 's' : ''}
                    {selectedConv.project && ` · ${selectedConv.project.name}`}
                  </button>
                </div>
              </div>
              {selectedConv.isGroup && (
                <button
                  onClick={() => { setShowAddMember(true); if (allUsers.length === 0) fetch('/api/users').then(r => r.json()).then(d => setAllUsers(Array.isArray(d) ? d.filter((u: User) => u.id !== currentUserId) : [])).catch(() => {}) }}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"
                  title="Ajouter un participant"
                >
                  <UserPlus size={16} />
                </button>
              )}
            </div>

            {/* Participants panel */}
            {showParticipants && (
              <div className="px-6 py-3 border-b border-slate-800 bg-[#0d0d14]/50 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs font-medium">Participants ({selectedConv.participants.length})</span>
                  <button onClick={() => setShowParticipants(false)} className="text-slate-600 hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedConv.participants.map(p => (
                    <div key={p.user.id} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
                      {p.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white">
                          {getInitials(p.user.name)}
                        </div>
                      )}
                      <span className="text-slate-300 text-xs">{p.user.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add member modal */}
            {showAddMember && selectedConv.isGroup && (
              <div className="px-6 py-3 border-b border-slate-800 bg-[#0d0d14]/50 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs font-medium">Ajouter un participant</span>
                  <button onClick={() => setShowAddMember(false)} className="text-slate-600 hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {allUsers
                    .filter(u => !selectedConv.participants.some(p => p.user.id === u.id))
                    .map(user => (
                      <button
                        key={user.id}
                        onClick={() => addMemberToConv(user.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                      >
                        {user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white">
                            {getInitials(user.name)}
                          </div>
                        )}
                        <span className="text-slate-300 text-sm">{user.name}</span>
                        <Plus size={12} className="ml-auto text-slate-600" />
                      </button>
                    ))}
                  {allUsers.filter(u => !selectedConv.participants.some(p => p.user.id === u.id)).length === 0 && (
                    <p className="text-slate-600 text-xs text-center py-2">Tous les utilisateurs sont déjà dans le groupe</p>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loadingMessages ? (
                <div className="text-slate-500 text-sm text-center pt-8">Chargement...</div>
              ) : messages.length === 0 ? (
                <div className="text-center pt-12">
                  <p className="text-slate-600 text-sm">Aucun message</p>
                  <p className="text-slate-700 text-xs mt-1">Soyez le premier à écrire</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.sender.id === currentUserId
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOwn && (
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-400 flex-shrink-0 mb-1">
                          {getInitials(msg.sender.name)}
                        </div>
                      )}
                      <div className={`max-w-[65%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {!isOwn && (
                          <span className="text-slate-500 text-xs px-1">{msg.sender.name}</span>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                          isOwn
                            ? 'bg-[#E14B89]/20 text-white rounded-br-sm'
                            : 'bg-[#111118] text-slate-200 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-slate-600 text-xs px-1">{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3 bg-[#111118] border border-slate-800 rounded-2xl px-4 py-2.5 focus-within:border-slate-700 transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrivez un message..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#E14B89] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                  <Send size={16} />
                </button>
              </div>
              <p className="text-slate-700 text-xs mt-2 pl-1">Appuyez sur Entrée pour envoyer</p>
            </div>
          </>
        )}
      </div>

      {/* New conversation modal */}
      {showNewConvModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Nouvelle conversation</h2>
              <button onClick={() => { setShowNewConvModal(false); setSelectedParticipants([]); setNewConvName('') }}
                className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateConversation} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du groupe (optionnel)</label>
                <input
                  type="text"
                  value={newConvName}
                  onChange={e => setNewConvName(e.target.value)}
                  placeholder="Nom de la conversation..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">
                  Participants * ({selectedParticipants.length} sélectionné{selectedParticipants.length > 1 ? 's' : ''})
                </label>
                <div className="bg-[#1a1a24] border border-slate-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  {allUsers.length === 0 ? (
                    <div className="p-3 text-slate-500 text-sm text-center">Chargement...</div>
                  ) : (
                    allUsers.map(user => {
                      const selected = selectedParticipants.includes(user.id)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleParticipant(user.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors ${selected ? 'bg-[#E14B89]/10' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                            selected ? 'bg-[#E14B89] text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {getInitials(user.name)}
                          </div>
                          <span className={`text-sm ${selected ? 'text-white' : 'text-slate-300'}`}>{user.name}</span>
                          {selected && <span className="ml-auto text-[#E14B89] text-xs">✓</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={() => { setShowNewConvModal(false); setSelectedParticipants([]); setNewConvName('') }}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                  Annuler
                </button>
                <button type="submit"
                  disabled={selectedParticipants.length === 0}
                  className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
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
