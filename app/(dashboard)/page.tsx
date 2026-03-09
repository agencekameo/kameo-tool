import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { FolderKanban, Users, CheckSquare, ArrowRight, Clock } from 'lucide-react'
import { CalendarWidget } from '@/components/calendar-widget'
import { RevenueCard } from '@/components/revenue-card'

const PROSPECT_STATUS_LABELS: Record<string, string> = {
  A_CONTACTER: 'À contacter',
  DEVIS_TRANSMETTRE: 'Devis à transmettre',
  DEVIS_ENVOYE: 'Devis envoyé',
  REFUSE: 'Refusé',
  SIGNE: 'Signé',
}

const PROSPECT_STATUS_COLORS: Record<string, string> = {
  A_CONTACTER: 'text-slate-400',
  DEVIS_TRANSMETTRE: 'text-amber-400',
  DEVIS_ENVOYE: 'text-blue-400',
  REFUSE: 'text-red-400',
  SIGNE: 'text-green-400',
}

const PROSPECT_STATUS_BG: Record<string, string> = {
  A_CONTACTER: 'bg-slate-800',
  DEVIS_TRANSMETTRE: 'bg-amber-500/15',
  DEVIS_ENVOYE: 'bg-blue-500/15',
  REFUSE: 'bg-red-500/15',
  SIGNE: 'bg-green-500/15',
}

async function getDashboardData(userId: string) {
  const [projects, tasks, clients, prospects] = await Promise.all([
    prisma.project.findMany({
      where: { status: { in: ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW'] } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        price: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.task.findMany({
      where: { assigneeId: userId, status: { not: 'DONE' } },
      select: {
        id: true,
        title: true,
        priority: true,
        projectId: true,
        dueDate: true,
        project: {
          select: { client: { select: { name: true } } },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 6,
    }),
    prisma.client.count(),
    prisma.prospect.findMany({ select: { id: true, status: true, budget: true } }),
  ])

  const projectsByStatus = await prisma.project.groupBy({
    by: ['status'],
    _count: true,
    where: { status: { in: ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW'] } },
  })

  return { projects, tasks, clients, projectsByStatus, prospects }
}

export default async function DashboardPage() {
  const session = await auth()
  const { projects, tasks, clients, prospects } = await getDashboardData(session!.user!.id)

  const activeProjects = projects.length
  const pendingTasks = tasks.length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const firstName = session?.user?.name?.split(' ')[0] ?? ''

  // Pipeline stats
  const prospectStatuses = ['A_CONTACTER', 'DEVIS_TRANSMETTRE', 'DEVIS_ENVOYE', 'REFUSE', 'SIGNE']
  const pipelineCounts = prospectStatuses.map(s => ({
    status: s,
    count: prospects.filter(p => p.status === s).length,
  }))
  const signedBudget = prospects
    .filter(p => p.status === 'SIGNE')
    .reduce((sum, p) => sum + (p.budget ?? 0), 0)

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1 text-sm">
          {greeting}, {firstName} 👋 — Voici un aperçu de l&apos;activité de Kameo.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Projets actifs',
            value: activeProjects,
            icon: FolderKanban,
            color: 'text-[#E14B89]',
            bg: 'bg-[#E14B89]/10',
            href: '/projects',
          },
          {
            label: 'Clients',
            value: clients,
            icon: Users,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            href: '/clients',
          },
          {
            label: 'Mes tâches',
            value: pendingTasks,
            icon: CheckSquare,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            href: '/tasks',
          },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon size={20} className={color} />
              </div>
              <ArrowRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </Link>
        ))}
        <RevenueCard />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Projets récents */}
        <div className="col-span-3 bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Projets en cours</h2>
            <Link href="/projects" className="text-[#E14B89] text-sm hover:opacity-80 transition-opacity flex items-center gap-1">
              Voir tout <ArrowRight size={13} />
            </Link>
          </div>
          <div className="space-y-3">
            {projects.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">Aucun projet actif</p>
            )}
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-800/40 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate group-hover:text-[#E14B89] transition-colors">
                    {project.name}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">{project.client.name} · {PROJECT_TYPE_LABELS[project.type]}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PROJECT_STATUS_COLORS[project.status]}`}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                  {project.price && (
                    <span className="text-slate-400 text-xs">{formatCurrency(project.price)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Mes tâches */}
        <div className="col-span-2 bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Mes tâches</h2>
            <Link href="/tasks" className="text-[#E14B89] text-sm hover:opacity-80 transition-opacity flex items-center gap-1">
              Voir tout <ArrowRight size={13} />
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">Aucune tâche en attente</p>
            )}
            {tasks.map(task => (
              <Link
                key={task.id}
                href={task.projectId ? `/projects/${task.projectId}` : '/tasks'}
                className="block p-3 rounded-xl hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${TASK_PRIORITY_COLORS[task.priority]}`}>
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{task.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                      {task.project?.client.name ?? 'Sans projet'}
                      {task.dueDate && (
                        <>
                          <span>·</span>
                          <Clock size={10} />
                          {formatDate(task.dueDate)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline commercial */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Pipeline commercial</h2>
            <Link href="/commercial" className="text-[#E14B89] text-sm hover:opacity-80 transition-opacity flex items-center gap-1">
              Voir tout <ArrowRight size={13} />
            </Link>
          </div>
          <div className="space-y-3 mb-5">
            {pipelineCounts.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 w-36 text-center ${PROSPECT_STATUS_BG[status]} ${PROSPECT_STATUS_COLORS[status]}`}>
                  {PROSPECT_STATUS_LABELS[status]}
                </span>
                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      status === 'SIGNE' ? 'bg-green-400' :
                      status === 'REFUSE' ? 'bg-red-400' :
                      status === 'DEVIS_ENVOYE' ? 'bg-blue-400' :
                      status === 'DEVIS_TRANSMETTRE' ? 'bg-amber-400' :
                      'bg-slate-600'
                    }`}
                    style={{ width: prospects.length > 0 ? `${(count / prospects.length) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-white text-sm font-medium w-5 text-right flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
          {signedBudget > 0 && (
            <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
              <span className="text-slate-400 text-sm">Budget signé total</span>
              <span className="text-green-400 font-semibold">{formatCurrency(signedBudget)}</span>
            </div>
          )}
          {prospects.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">Aucun prospect dans le pipeline</p>
          )}
        </div>

        {/* Rendez-vous */}
        <CalendarWidget />
      </div>
    </div>
  )
}
