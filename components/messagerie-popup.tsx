'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  MessageSquare, X, Plus, Send, Users, Paperclip, ChevronLeft,
  MoreHorizontal, Trash2, Archive,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

interface ConversationMember {
  lastReadAt?: string | null
  user: { id: string; name: string; avatar?: string | null; lastSeen?: string | null }
}

interface Conversation {
  id: string
  name?: string
  isGroup: boolean
  projectId?: string
  participants: ConversationMember[]
  messages: { content: string | null; createdAt: string; fileType?: string; fileName?: string }[]
  project?: { name: string }
}

interface Message {
  id: string
  content: string | null
  createdAt: string
  fileUrl?: string | null
  fileType?: string | null
  fileName?: string | null
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

function getOtherParticipant(conv: Conversation, currentUserId: string) {
  const others = conv.participants.filter(p => p.user.id !== currentUserId)
  return others.length === 1 ? others[0].user : null
}

function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000 // 5 minutes
}

function formatTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getUnreadCount(conversations: Conversation[], currentUserId: string) {
  return conversations.filter(conv => {
    const myMember = conv.participants.find(p => p.user.id === currentUserId)
    const lastMsg = conv.messages?.[0]
    if (!lastMsg) return false
    if (!myMember?.lastReadAt) return true
    return new Date(lastMsg.createdAt) > new Date(myMember.lastReadAt)
  }).length
}

export function MessageriePopup() {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string })?.id ?? ''

  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewConvModal, setShowNewConvModal] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [newConvName, setNewConvName] = useState('')
  const [filePreview, setFilePreview] = useState<{ url: string; type: string; name: string } | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [menuConvId, setMenuConvId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null
  const unreadCount = getUnreadCount(conversations, currentUserId)

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [currentUserId])

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`)
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [])

  // Update own lastSeen presence every 60s
  useEffect(() => {
    if (!currentUserId) return
    const ping = () => fetch('/api/lastseen', { method: 'POST' })
    ping()
    const interval = setInterval(ping, 60000)
    return () => clearInterval(interval)
  }, [currentUserId])

  // Poll for unread badge even when popup is closed
  useEffect(() => {
    if (!currentUserId) return
    fetchConversations()
    const interval = setInterval(fetchConversations, 30000)
    return () => clearInterval(interval)
  }, [currentUserId, fetchConversations])

  // Load conversations when popup opens
  useEffect(() => {
    if (!open || !currentUserId) return
    setLoadingConvs(true)
    fetchConversations().finally(() => setLoadingConvs(false))
    const interval = setInterval(fetchConversations, 10000)
    return () => clearInterval(interval)
  }, [open, currentUserId, fetchConversations])

  // Load and poll messages when a conversation is selected
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (!selectedConvId) { setMessages([]); return }
    setLoadingMessages(true)
    fetchMessages(selectedConvId).finally(() => setLoadingMessages(false))
    pollingRef.current = setInterval(() => fetchMessages(selectedConvId), 3000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [selectedConvId, fetchMessages])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 3 Mo)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFilePreview({ url: reader.result as string, type: file.type, name: file.name })
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function sendMessage() {
    if ((!input.trim() && !filePreview) || !selectedConvId || sending) return
    setSending(true)
    const content = input.trim() || null
    const payload = {
      content,
      fileUrl: filePreview?.url ?? null,
      fileType: filePreview?.type ?? null,
      fileName: filePreview?.name ?? null,
    }
    setInput('')
    setFilePreview(null)
    try {
      const res = await fetch(`/api/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      fetchConversations()
    } catch { /* silent */ }
    finally { setSending(false) }
  }

  async function openNewConvModal() {
    setShowNewConvModal(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setAllUsers(Array.isArray(data) ? data.filter((u: User) => u.id !== currentUserId) : [])
    } catch { /* silent */ }
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
    } catch { /* silent */ }
  }

  async function handleArchiveConv(convId: string) {
    setMenuConvId(null)
    await fetch(`/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    })
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (selectedConvId === convId) setSelectedConvId(null)
  }

  async function handleDeleteConv(convId: string) {
    setMenuConvId(null)
    if (!confirm('Supprimer cette conversation ? Cette action est irréversible.')) return
    await fetch(`/api/conversations/${convId}`, { method: 'DELETE' })
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (selectedConvId === convId) setSelectedConvId(null)
  }

  function selectConversation(convId: string) {
    setMenuConvId(null)
    setSelectedConvId(convId)
  }

  if (!currentUserId) return null

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.xls,.xlsx"
        onChange={handleFileSelect}
      />

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200',
          'bg-[#E14B89] text-white hover:scale-105 hover:shadow-[#E14B89]/40 hover:shadow-2xl',
          open && 'scale-90 shadow-md'
        )}
        title="Messagerie"
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popup panel */}
      {open && (
        <div onClick={() => menuConvId && setMenuConvId(null)} className={cn(
          'fixed bottom-24 right-6 z-50',
          'w-[700px] h-[520px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-7rem)]',
          'bg-[#111118] border border-slate-800 rounded-2xl shadow-2xl',
          'flex flex-col overflow-hidden'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              {selectedConv && (
                <button
                  onClick={() => setSelectedConvId(null)}
                  className="sm:hidden p-1 rounded text-slate-400 hover:text-white"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <MessageSquare size={15} className="text-[#E14B89]" />
              <span className="text-white font-semibold text-sm">
                {selectedConv ? getConversationName(selectedConv, currentUserId) : 'Messagerie'}
              </span>
              {unreadCount > 0 && !selectedConv && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#E14B89]/20 text-[#E14B89] text-[10px] font-semibold">
                  {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={openNewConvModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
                title="Nouvelle conversation"
              >
                <Plus size={15} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Body: two-panel */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: conversation list */}
            <div className={cn(
              'w-56 flex-shrink-0 border-r border-slate-800 flex flex-col',
              selectedConv ? 'hidden sm:flex' : 'flex'
            )}>
              {loadingConvs ? (
                <div className="p-4 text-slate-500 text-xs">Chargement...</div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-slate-500 text-xs">Aucune conversation</p>
                  <button onClick={openNewConvModal} className="mt-2 text-[#E14B89] text-xs hover:underline">
                    Démarrer →
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {conversations.map(conv => {
                    const name = getConversationName(conv, currentUserId)
                    const lastMsg = conv.messages?.[0]
                    const isSelected = conv.id === selectedConvId
                    const myMember = conv.participants.find(p => p.user.id === currentUserId)
                    const hasUnread = lastMsg &&
                      (!myMember?.lastReadAt || new Date(lastMsg.createdAt) > new Date(myMember.lastReadAt))
                    const otherUser = conv.isGroup ? null : getOtherParticipant(conv, currentUserId)
                    const online = otherUser ? isOnline(otherUser.lastSeen) : false
                    const menuOpen = menuConvId === conv.id
                    return (
                      <div
                        key={conv.id}
                        className={cn(
                          'relative group border-b border-slate-800/40',
                          isSelected && 'bg-[#E14B89]/10 border-l-2 border-l-[#E14B89]'
                        )}
                      >
                        <button
                          onClick={() => selectConversation(conv.id)}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-800/30 transition-colors flex items-start gap-2.5"
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0 mt-0.5">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold overflow-hidden',
                              isSelected ? 'bg-[#E14B89]/20 text-[#E14B89]' : 'bg-slate-800 text-slate-400'
                            )}>
                              {conv.isGroup
                                ? <Users size={13} />
                                : otherUser?.avatar
                                  ? <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" />
                                  : getInitials(name)
                              }
                            </div>
                            {online && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#111118]" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pr-5">
                            <div className="flex items-center justify-between gap-1">
                              <p className={cn(
                                'text-xs font-medium truncate',
                                isSelected ? 'text-white' : 'text-slate-300',
                                hasUnread && 'font-semibold text-white'
                              )}>
                                {name}
                              </p>
                              {lastMsg && (
                                <span className="text-slate-600 text-[10px] flex-shrink-0">{formatTime(lastMsg.createdAt)}</span>
                              )}
                            </div>
                            {lastMsg ? (
                              <p className={cn('text-[11px] truncate mt-0.5', hasUnread ? 'text-slate-300 font-medium' : 'text-slate-600')}>
                                {lastMsg.content ?? (lastMsg.fileType?.startsWith('image/') ? '📷 Photo' : '📎 Fichier')}
                              </p>
                            ) : online ? (
                              <p className="text-[11px] text-green-400 mt-0.5">En ligne</p>
                            ) : null}
                          </div>
                          {hasUnread && !menuOpen && (
                            <span className="w-2 h-2 rounded-full bg-[#E14B89] flex-shrink-0 mt-2.5 absolute right-3 top-3.5" />
                          )}
                        </button>

                        {/* ··· menu button — visible on hover */}
                        <button
                          onClick={e => { e.stopPropagation(); setMenuConvId(menuOpen ? null : conv.id) }}
                          className={cn(
                            'absolute right-2 top-2.5 p-1 rounded-md transition-all',
                            'text-slate-600 hover:text-slate-300 hover:bg-slate-700/60',
                            menuOpen ? 'opacity-100 bg-slate-700/60' : 'opacity-0 group-hover:opacity-100'
                          )}
                        >
                          <MoreHorizontal size={13} />
                        </button>

                        {/* Dropdown menu */}
                        {menuOpen && (
                          <div className="absolute right-1 top-8 z-50 bg-[#1a1a24] border border-slate-700 rounded-xl shadow-xl overflow-hidden w-40"
                            onMouseLeave={() => setMenuConvId(null)}>
                            <button
                              onClick={() => handleArchiveConv(conv.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700/50 text-xs transition-colors"
                            >
                              <Archive size={13} className="text-amber-400" />
                              Archiver
                            </button>
                            <button
                              onClick={() => handleDeleteConv(conv.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-300 hover:text-red-400 hover:bg-red-500/10 text-xs transition-colors"
                            >
                              <Trash2 size={13} className="text-red-400" />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: message thread */}
            <div className={cn(
              'flex-1 flex flex-col overflow-hidden',
              !selectedConv ? 'hidden sm:flex' : 'flex'
            )}>
              {!selectedConv ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare size={32} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">Sélectionnez une conversation</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Conv header */}
                  {(() => {
                    const convName = getConversationName(selectedConv, currentUserId)
                    const otherUser = selectedConv.isGroup ? null : getOtherParticipant(selectedConv, currentUserId)
                    const online = otherUser ? isOnline(otherUser.lastSeen) : false
                    return (
                      <div className="px-4 py-2.5 border-b border-slate-800 flex-shrink-0 flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-[#E14B89]/20 flex items-center justify-center text-[11px] font-semibold text-[#E14B89] overflow-hidden flex-shrink-0">
                            {selectedConv.isGroup
                              ? <Users size={13} />
                              : otherUser?.avatar
                                ? <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" />
                                : getInitials(convName)
                            }
                          </div>
                          {online && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#111118]" />
                          )}
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium">{convName}</p>
                          <p className="text-[11px]">
                            {online
                              ? <span className="text-green-400">● En ligne</span>
                              : selectedConv.isGroup
                                ? <span className="text-slate-500">{selectedConv.participants.length} participants{selectedConv.project ? ` · ${selectedConv.project.name}` : ''}</span>
                                : <span className="text-slate-500">Hors ligne</span>
                            }
                          </p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                    {loadingMessages ? (
                      <div className="text-slate-500 text-xs text-center pt-6">Chargement...</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center pt-10">
                        <p className="text-slate-600 text-xs">Aucun message</p>
                        <p className="text-slate-700 text-[11px] mt-1">Soyez le premier à écrire</p>
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isOwn = msg.sender.id === currentUserId
                        const isImage = msg.fileType?.startsWith('image/')
                        const hasFile = !!msg.fileUrl
                        return (
                          <div key={msg.id} className={cn('flex items-end gap-1.5', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                            {!isOwn && (
                              <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-semibold text-slate-400 flex-shrink-0 mb-1">
                                {msg.sender.avatar
                                  ? <img src={msg.sender.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                  : getInitials(msg.sender.name)
                                }
                              </div>
                            )}
                            <div className={cn('max-w-[72%] flex flex-col gap-0.5', isOwn ? 'items-end' : 'items-start')}>
                              {!isOwn && (
                                <span className="text-slate-500 text-[10px] px-1">{msg.sender.name}</span>
                              )}
                              {hasFile && isImage && (
                                <img
                                  src={msg.fileUrl!}
                                  alt={msg.fileName ?? 'image'}
                                  className="max-w-[220px] max-h-[180px] rounded-xl object-cover"
                                />
                              )}
                              {hasFile && !isImage && (
                                <a
                                  href={msg.fileUrl!}
                                  download={msg.fileName}
                                  className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors hover:opacity-80',
                                    isOwn ? 'bg-[#E14B89]/20 text-slate-200' : 'bg-slate-800 text-slate-300'
                                  )}
                                >
                                  📎 <span className="truncate max-w-[140px]">{msg.fileName}</span>
                                </a>
                              )}
                              {msg.content && (
                                <div className={cn(
                                  'px-3 py-2 rounded-2xl text-xs leading-relaxed',
                                  isOwn
                                    ? 'bg-[#E14B89]/20 text-white rounded-br-sm'
                                    : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                                )}>
                                  {msg.content}
                                </div>
                              )}
                              <span className="text-slate-600 text-[10px] px-1">
                                {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* File preview */}
                  {filePreview && (
                    <div className="px-3 py-2 border-t border-slate-800 flex items-center gap-2.5 flex-shrink-0 bg-slate-900/50">
                      {filePreview.type.startsWith('image/') ? (
                        <img src={filePreview.url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 text-lg">
                          📎
                        </div>
                      )}
                      <p className="text-slate-300 text-xs truncate flex-1">{filePreview.name}</p>
                      <button onClick={() => setFilePreview(null)} className="text-slate-500 hover:text-white flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Input */}
                  <div className="px-3 py-2.5 border-t border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-slate-600 transition-colors">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                        title="Joindre un fichier (max 3 Mo)"
                      >
                        <Paperclip size={15} />
                      </button>
                      <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder="Message..."
                        className="flex-1 bg-transparent text-white text-xs placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={(!input.trim() && !filePreview) || sending}
                        className="text-slate-500 hover:text-[#E14B89] disabled:opacity-30 transition-colors flex-shrink-0"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New conversation modal */}
      {showNewConvModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-base">Nouvelle conversation</h2>
              <button
                onClick={() => { setShowNewConvModal(false); setSelectedParticipants([]); setNewConvName('') }}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateConversation} className="space-y-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du groupe (optionnel)</label>
                <input
                  type="text"
                  value={newConvName}
                  onChange={e => setNewConvName(e.target.value)}
                  placeholder="Nom de la conversation..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">
                  Participants * ({selectedParticipants.length} sélectionné{selectedParticipants.length > 1 ? 's' : ''})
                </label>
                <div className="bg-[#1a1a24] border border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {allUsers.length === 0 ? (
                    <div className="p-3 text-slate-500 text-sm text-center">Chargement...</div>
                  ) : (
                    allUsers.map(user => {
                      const selected = selectedParticipants.includes(user.id)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedParticipants(prev =>
                            prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]
                          )}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors',
                            selected && 'bg-[#E14B89]/10'
                          )}
                        >
                          <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
                            selected ? 'bg-[#E14B89] text-white' : 'bg-slate-800 text-slate-400'
                          )}>
                            {getInitials(user.name)}
                          </div>
                          <span className={cn('text-sm', selected ? 'text-white' : 'text-slate-300')}>{user.name}</span>
                          {selected && <span className="ml-auto text-[#E14B89] text-xs">✓</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowNewConvModal(false); setSelectedParticipants([]); setNewConvName('') }}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={selectedParticipants.length === 0}
                  className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
