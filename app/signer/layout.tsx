export default function SignerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-white text-gray-900 overflow-y-auto">
      {children}
    </div>
  )
}
