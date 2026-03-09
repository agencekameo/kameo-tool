import { Handshake } from 'lucide-react'

export default function PartenairesPage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Partenaires</h1>
        <p className="text-slate-400 mt-1 text-sm">Gestion des partenaires commerciaux</p>
      </div>

      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
          <Handshake size={28} className="text-slate-500" />
        </div>
        <p className="text-slate-500 text-sm">Page en construction</p>
      </div>
    </div>
  )
}
