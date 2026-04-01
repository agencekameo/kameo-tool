export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-40 bg-slate-800 rounded-lg mb-2" />
          <div className="h-4 w-56 bg-slate-800/60 rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-slate-800 rounded-xl" />
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[#111118] border border-slate-800 rounded-2xl p-5 h-28" />
        ))}
      </div>
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 h-64" />
    </div>
  )
}
