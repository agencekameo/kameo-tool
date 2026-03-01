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
  ClipboardList,
} from 'lucide-react'
import { cn, ROLE_LABELS } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

const sections = [
  {
    label: "Vue d'ensemble",
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/finances', label: 'Finances', icon: Wallet },
      { href: '/clients', label: 'Clients', icon: Users },
      { href: '/tasks', label: 'Tâches', icon: CheckSquare },
      { href: '/avis', label: 'Avis', icon: Star },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { href: '/projects', label: 'Projets', icon: FolderKanban },
      { href: '/maintenances', label: 'Maintenances', icon: Wrench },
      { href: '/aysha', label: 'Aysha', icon: ListTodo },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { href: '/commercial', label: 'Prospects', icon: TrendingUp },
      { href: '/devis', label: 'Devis', icon: FileText },
    ],
  },
  {
    label: 'Ressources',
    items: [
      { href: '/wiki', label: 'Wiki', icon: BookOpen },
      { href: '/ressources', label: 'Cahier des charges', icon: ClipboardList },
      { href: '/audit', label: 'Audit SEO', icon: Search },
      { href: '/gmb', label: 'GMB', icon: MapPin },
    ],
  },
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
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const role = (session?.user as { role?: string })?.role ?? ''
  const [sidebarAvatar, setSidebarAvatar] = useState<string | null>(null)

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

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen w-60 bg-[#0d0d14] border-r border-slate-800/60 flex flex-col z-40',
        'transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex-shrink-0">
        <Image
          src={isLight ? '/kameo-logo-light.svg' : '/kameo-logo.svg'}
          alt="Kameo"
          width={112}
          height={36}
          priority
          className="flex-shrink-0"
          style={{ objectFit: 'contain', objectPosition: 'left' }}
        />
        <p className="text-slate-500 text-[10px] mt-0.5">Outil interne</p>
      </div>

      {/* Navigation — flex-1 + min-h-0 prevents overflow on short screens */}
      <nav className="flex-1 min-h-0 px-2 py-2 overflow-y-auto space-y-1.5">
        {sections.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-0.5 text-[9px] font-semibold text-slate-600 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive(href)
                      ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="flex-1 truncate text-[13px]">{label}</span>
                  {isActive(href) && <ChevronRight size={12} className="text-[#E14B89]/60 flex-shrink-0" />}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Admin — admin only */}
        {isAdmin && (
          <div>
            <p className="px-3 mb-0.5 text-[9px] font-semibold text-slate-600 uppercase tracking-wider">
              Admin
            </p>
            <div className="space-y-0.5">
              {[
                { href: '/users', label: 'Équipe', Icon: Users2 },
                { href: '/logs', label: 'Logs', Icon: Activity },
                { href: '/contrats', label: 'Contrats', Icon: FileCheck2 },
                { href: '/backups', label: 'Backups', Icon: HardDrive },
                { href: '/notes-de-frais', label: 'Notes de frais', Icon: Receipt },
              ].map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150',
                    pathname.startsWith(href)
                      ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="flex-1 text-[13px]">{label}</span>
                  {pathname.startsWith(href) && (
                    <ChevronRight size={12} className="text-[#E14B89]/60 flex-shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-1 flex-shrink-0">
        <button
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          title={isLight ? 'Passer en mode sombre' : 'Passer en mode clair'}
          className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-150"
        >
          {isLight ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      {/* User dropdown */}
      <div className="p-2 border-t border-slate-800/60 flex-shrink-0" ref={dropdownRef}>
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
