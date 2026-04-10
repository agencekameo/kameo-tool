'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from './sidebar'
import { MessageriePopup } from './messagerie-popup'
import { Chatbot } from './chatbot'
import { ImpersonationBanner } from './impersonation-banner'
import { Menu, LayoutDashboard, FolderKanban, FileText, Users, Calendar, Bell } from 'lucide-react'
import Image from 'next/image'

function PageTransition({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [visible, setVisible] = useState(true)
  const [displayedChildren, setDisplayedChildren] = useState(children)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      setVisible(false)
      const t = setTimeout(() => {
        setDisplayedChildren(children)
        setVisible(true)
      }, 80)
      return () => clearTimeout(t)
    } else {
      setDisplayedChildren(children)
    }
  }, [pathname, children])

  return (
    <div className={`transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {displayedChildren}
    </div>
  )
}

interface Notification {
  id: string; type: string; title: string; message: string; link?: string; read: boolean; createdAt: string
}

const MOBILE_NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Accueil' },
  { href: '/projects', icon: FolderKanban, label: 'Projets' },
  { href: '/devis', icon: FileText, label: 'Devis' },
  { href: '/clients', icon: Users, label: 'Clients' },
  { href: '/agenda', icon: Calendar, label: 'Agenda' },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sidebar-collapsed') === 'true'
    return false
  })
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNotifications(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 120000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "À l'instant"
    if (mins < 60) return `${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}j`
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed} onToggleCollapse={() => { const next = !sidebarCollapsed; setSidebarCollapsed(next); localStorage.setItem('sidebar-collapsed', String(next)) }} />

      {/* Main content */}
      <main className={`min-h-screen pb-16 md:pb-0 transition-[margin] duration-200 ease-out ${sidebarCollapsed ? 'md:ml-[52px]' : 'md:ml-60'}`}>
        <ImpersonationBanner />

        {/* Mobile top bar: notif left, logo center, hamburger right */}
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-[#0d0d14] border-b border-slate-800/60">
          {/* Left: notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/50 transition-colors relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#E14B89] rounded-full flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </span>
              )}
            </button>

            {/* Mobile notification panel */}
            {notifOpen && (
              <div className="absolute left-0 top-12 w-[calc(100vw-2rem)] max-h-[70vh] bg-[#111118] border border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <h3 className="text-white text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[#E14B89] text-xs hover:underline">Tout marquer lu</button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell size={20} className="mx-auto text-slate-700 mb-2" />
                      <p className="text-slate-500 text-xs">Aucune notification</p>
                    </div>
                  ) : notifications.slice(0, 10).map(n => (
                    <Link key={n.id} href={n.link || '#'} onClick={() => setNotifOpen(false)}
                      className={`block px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 ${!n.read ? 'bg-[#E14B89]/5' : ''}`}>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${n.read ? 'text-slate-400' : 'text-white'}`}>{n.title}</p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#E14B89] flex-shrink-0" />}
                        <span className="text-slate-600 text-[10px] ml-auto flex-shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">{n.message}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center: logo */}
          <Image src="/kameo-logo.svg" alt="Kameo" width={100} height={28} priority />

          {/* Right: hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/50 transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>

        <PageTransition pathname={pathname}>
          {children}
        </PageTransition>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#0d0d14] border-t border-slate-800/60 flex items-center justify-around h-16 px-2 safe-bottom">
        {MOBILE_NAV.map(item => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${active ? 'text-[#E14B89]' : 'text-slate-500'}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {isAdmin ? <Chatbot /> : <MessageriePopup />}
    </>
  )
}
