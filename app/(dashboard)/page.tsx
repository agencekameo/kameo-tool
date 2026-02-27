import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { FolderKanban, Users, CheckSquare, TrendingUp, ArrowRight, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

async function getDashboardData(userId: string) {
  const [projects, tasks, clients, totalRevenue] = await Promise.all([
    prisma.project.findMany({
      where: { status: { notIn: ['ARCHIVE'] } },
      include: { client: true, tasks: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.task.findMany({
      where: { assigneeId: userId, status: { not: 'DONE' } },
      include: { project: { include: { client: true } } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 6,
    }),
    prisma.client.count(),
    prisma.project.aggregate({ _sum: { price: true } }),
  ])

  const projectsByStatus = await prisma.project.groupBy({
    by: ['status'],
    _count: true,
    where: { status: { not: 'ARCHIVE' } },
  })

  return { projects, tasks, clients, totalRevenue: totalRevenue._sum.price ?? 0, projectsByStatus }
}

export default async function DashboardPage() {
  const session = await auth()
  const { projects, tasks, clients, totalRevenue } = await getDashboardData(session!.user!.id)

  const activeProjects = projects.length
  const pendingTasks = tasks.length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const firstName = session?.user?.name?.split(' ')[0] ?? ''

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Voici un aperçu de l&apos;activité de Kameo aujourd&apos;hui.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
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
          {
            label: 'CA total',
            value: formatCurrency(totalRevenue),
            icon: TrendingUp,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            href: '/projects',
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
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Projets récents */}
        <div className="col-span-3 bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Projets en cours</h2>
            <Link href="/projects" className="text-[#E14B89] text-sm hover:text-[#F8903C] transition-colors flex items-center gap-1">
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
                  <p className="text-white text-sm font-medium truncate group-hover:text-[#F8903C] transition-colors">
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
            <Link href="/tasks" className="text-[#E14B89] text-sm hover:text-[#F8903C] transition-colors flex items-center gap-1">
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
                href={`/projects/${task.projectId}`}
                className="block p-3 rounded-xl hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${TASK_PRIORITY_COLORS[task.priority]}`}>
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{task.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                      {task.project.client.name}
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
    </div>
  )
}
