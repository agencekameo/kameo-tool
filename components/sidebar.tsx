'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  BookOpen,
  Search,
  LogOut,
  ChevronRight,
  Wrench,
  ListTodo,
  Wallet,
  User,
  ChevronUp,
  Mail,
  Activity,
  Sun,
  Moon,
  TrendingUp,
  FileText,
  Users2,
  HardDrive,
  Receipt,
  FileCheck2,
  Star,
  MapPin,
  Calendar,
  Bell,
  FolderKanban as MissionIcon,
  MessageSquare,
  CheckCheck,
  X,
  Briefcase,
  Handshake,
} from 'lucide-react'
import { cn, ROLE_LABELS } from '@/lib/utils'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
}

const NOTIF_ICONS: Record<string, typeof Bell> = {
  MISSION_NEW: MissionIcon,
  MISSION_ACCEPTED: CheckCheck,
  MISSION_COUNTER: MissionIcon,
  MISSION_REFUSED: X,
  MISSION_REVIEW: MissionIcon,
  MESSAGE: MessageSquare,
  PROJECT_NEW: FolderKanban,
}

const NOTIF_COLORS: Record<string, string> = {
  MISSION_NEW: 'bg-[#E14B89]/20 text-[#E14B89]',
  MISSION_ACCEPTED: 'bg-green-500/20 text-green-400',
  MISSION_COUNTER: 'bg-amber-500/20 text-amber-400',
  MISSION_REFUSED: 'bg-red-500/20 text-red-400',
  MISSION_REVIEW: 'bg-blue-500/20 text-blue-400',
  MESSAGE: 'bg-purple-500/20 text-purple-400',
  PROJECT_NEW: 'bg-emerald-500/20 text-emerald-400',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days}j`
}

// ─── Role-based access ───────────────────────────────────────────────────────
// Pages each restricted role can see (ADMIN sees everything)
const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  DEVELOPER:  ['/projects', '/wiki', '/audit'],
  REDACTEUR:  ['/projects', '/wiki', '/audit'],
  DESIGNER:   ['/projects', '/wiki', '/audit', '/aysha', '/gmb'],
  COMMERCIAL: ['/commerciaux', '/devis', '/audit'],
}

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/finances', label: 'Finances', icon: Wallet },
      { href: '/clients', label: 'Clients', icon: Users },
      { href: '/tasks', label: 'Tâches', icon: CheckSquare },
      { href: '/avis', label: 'Avis', icon: Star },
      { href: '/agenda', label: 'Agenda', icon: Calendar },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { href: '/projects', label: 'Projets', icon: FolderKanban },
      { href: '/maintenances', label: 'Maint.', icon: Wrench },
      { href: '/aysha', label: 'Aysha', icon: ListTodo },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { href: '/commercial', label: 'Prospects', icon: TrendingUp },
      { href: '/commerciaux', label: 'Commerciaux', icon: Briefcase },
      { href: '/devis', label: 'Devis', icon: FileText },
      { href: '/skills', label: 'Skills', icon: BookOpen },
      { href: '/partenaires', label: 'Partenaires', icon: Handshake },
    ],
  },
  {
    label: 'Ressources',
    items: [
      { href: '/wiki', label: 'Wiki', icon: BookOpen },
      { href: '/audit', label: 'Audit SEO', icon: Search },
      { href: '/gmb', label: 'GMB', icon: MapPin },
    ],
  },
]

const adminItems: { href: string; label: string; Icon: typeof LayoutDashboard }[] = [
  { href: '/users', label: 'Équipe', Icon: Users2 },
  { href: '/logs', label: 'Logs', Icon: Activity },
  { href: '/contrats', label: 'Contrats', Icon: FileCheck2 },
  { href: '/backups', label: 'Backups', Icon: HardDrive },
  { href: '/notes-de-frais', label: 'Frais', Icon: Receipt },
]

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const role = (session?.user as { role?: string })?.role ?? ''
  const isAdmin = role === 'ADMIN'
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [sidebarAvatar, setSidebarAvatar] = useState<string | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNotifications(data) })
      .catch(() => {})
  }, [])

  // Fetch notifications on mount + poll every 30s
  useEffect(() => {
    if (!session?.user?.id) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [session?.user?.id, fetchNotifications])

  // Close notif panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleNotifClick(notif: Notification) {
    if (!notif.read) {
      fetch(`/api/notifications/${notif.id}`, { method: 'PATCH' })
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    }
    setNotifOpen(false)
    if (notif.link) router.push(notif.link)
  }

  // Filter sections based on role
  const filteredSections = useMemo(() => {
    if (isAdmin) return sections
    const allowed = ROLE_ALLOWED_PATHS[role]
    if (!allowed) return sections // fallback: show all for unknown roles
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => allowed.includes(item.href)),
      }))
      .filter(section => section.items.length > 0)
  }, [role, isAdmin])

  // Fetch avatar from API (not from session — avatar is NOT stored in JWT)
  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => { if (data?.avatar) setSidebarAvatar(data.avatar) })
      .catch(() => {})
  }, [session?.user?.id])

  // Listen for avatar updates dispatched from the profile page
  useEffect(() => {
    function handleAvatarUpdate(e: Event) {
      const ev = e as CustomEvent<{ avatar: string }>
      setSidebarAvatar(ev.detail.avatar)
    }
    window.addEventListener('kameo:avatar-updated', handleAvatarUpdate)
    return () => window.removeEventListener('kameo:avatar-updated', handleAvatarUpdate)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  const isLight = theme === 'light'

  // ─── Dynamic nav sizing: auto-shrink items to fit without scrolling ────────
  const navRef = useRef<HTMLElement>(null)
  const [navPy, setNavPy] = useState(3)
  const [navGap, setNavGap] = useState(8)
  const [headerSize, setHeaderSize] = useState(20)

  const totalNavItems = useMemo(() => {
    return filteredSections.reduce((acc, s) => acc + s.items.length, 0) + (isAdmin ? adminItems.length : 0)
  }, [filteredSections, isAdmin])

  const totalSections = filteredSections.length + (isAdmin ? 1 : 0)

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const recalc = () => {
      const h = el.clientHeight
      const lineH = 15
      // Start with comfortable values and shrink until it fits
      let py = 4, gap = 8, hdr = 20
      for (let attempt = 0; attempt < 10; attempt++) {
        const total = totalNavItems * (lineH + py * 2) + totalSections * hdr + (totalSections - 1) * gap + 8
        if (total <= h) break
        if (py > 1) { py--; continue }
        if (gap > 2) { gap--; continue }
        if (hdr > 14) { hdr -= 2; continue }
        break
      }
      setNavPy(py)
      setNavGap(gap)
      setHeaderSize(hdr)
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [totalNavItems, totalSections])

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen w-60 bg-[#0d0d14] border-r border-slate-800/60 flex flex-col z-40',
        'transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}
    >
      {/* Logo + Notifications */}
      <div className="px-4 py-2.5 border-b border-slate-800/60 flex-shrink-0 flex items-center justify-between" ref={notifRef}>
        <Image
          src={isLight ? '/kameo-logo-light.svg' : '/kameo-logo.svg'}
          alt="Kameo"
          width={100}
          height={28}
          priority
          className="flex-shrink-0"
          style={{ objectFit: 'contain', objectPosition: 'left' }}
        />
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E14B89] rounded-full flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
            </span>
          )}
        </button>

        {/* Notification panel */}
        {notifOpen && (
          <div className="absolute left-60 top-0 w-80 max-h-[80vh] bg-[#111118] border border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-white text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[#E14B89] text-xs hover:underline">
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell size={24} className="mx-auto text-slate-700 mb-2" />
                  <p className="text-slate-500 text-xs">Aucune notification</p>
                </div>
              ) : (
                notifications.map(notif => {
                  const IconComp = NOTIF_ICONS[notif.type] ?? Bell
                  const colorClass = NOTIF_COLORS[notif.type] ?? 'bg-slate-500/20 text-slate-400'
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors border-b border-slate-800/50',
                        !notif.read && 'bg-[#E14B89]/5'
                      )}
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
                        <IconComp size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-xs font-medium truncate', notif.read ? 'text-slate-400' : 'text-white')}>{notif.title}</p>
                          {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-[#E14B89] flex-shrink-0" />}
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-slate-600 text-[10px] mt-1">{timeAgo(notif.createdAt)}</p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 min-h-0 px-2 py-1 overflow-hidden flex flex-col" style={{ gap: `${navGap}px` }}>
        {filteredSections.map(section => (
          <div key={section.label}>
            <p className="px-3 text-[9px] font-semibold text-slate-600 uppercase tracking-wider" style={{ height: `${headerSize}px`, lineHeight: `${headerSize}px` }}>
              {section.label}
            </p>
            {section.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                style={{ paddingTop: `${navPy}px`, paddingBottom: `${navPy}px` }}
                className={cn(
                  'flex items-center gap-2 px-3 rounded-lg text-[12px] font-medium transition-all duration-150',
                  isActive(href)
                    ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}
              >
                <Icon size={13} className="flex-shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {isActive(href) && <ChevronRight size={10} className="text-[#E14B89]/60 flex-shrink-0" />}
              </Link>
            ))}
          </div>
        ))}

        {/* Admin section — admin only */}
        {isAdmin && (
          <div>
            <p className="px-3 text-[9px] font-semibold text-slate-600 uppercase tracking-wider" style={{ height: `${headerSize}px`, lineHeight: `${headerSize}px` }}>
              Admin
            </p>
            {adminItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                style={{ paddingTop: `${navPy}px`, paddingBottom: `${navPy}px` }}
                className={cn(
                  'flex items-center gap-2 px-3 rounded-lg text-[12px] font-medium transition-all duration-150',
                  pathname.startsWith(href)
                    ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}
              >
                <Icon size={13} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {pathname.startsWith(href) && (
                  <ChevronRight size={10} className="text-[#E14B89]/60 flex-shrink-0" />
                )}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* User dropdown */}
      <div className="px-2 py-1.5 border-t border-slate-800/60 flex-shrink-0" ref={dropdownRef}>
        {dropdownOpen && (
          <div className="mb-2 bg-[#111118] border border-slate-700 rounded-xl overflow-hidden shadow-xl">
            <Link
              href="/profile"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors text-sm"
            >
              <User size={14} />
              Mon profil
            </Link>
            <Link
              href="/email"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors text-sm"
            >
              <Mail size={14} />
              Composer un email
            </Link>
            <button
              onClick={() => { setTheme(isLight ? 'dark' : 'light'); setDropdownOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors text-sm"
            >
              {isLight ? <Moon size={14} /> : <Sun size={14} />}
              {isLight ? 'Mode sombre' : 'Mode clair'}
            </button>
            <div className="border-t border-slate-800" />
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors text-sm"
            >
              <LogOut size={14} />
              Se déconnecter
            </button>
          </div>
        )}

        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl transition-all w-full group',
            dropdownOpen ? 'bg-slate-800/70' : 'hover:bg-slate-800/50'
          )}
        >
          <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden">
            {sidebarAvatar ? (
              <img
                src={sidebarAvatar}
                alt={session?.user?.name ?? ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#E14B89] to-[#F8903C] flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-slate-500 text-xs truncate">{ROLE_LABELS[role] ?? role}</p>
          </div>
          <ChevronUp
            size={13}
            className={cn(
              'text-slate-600 flex-shrink-0 transition-transform',
              dropdownOpen ? 'rotate-0' : 'rotate-180'
            )}
          />
        </button>
      </div>
    </aside>
  )
}
