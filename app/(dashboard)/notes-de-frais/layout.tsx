import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Notes de frais' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
