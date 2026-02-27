import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Kameo — Outil interne',
  description: "Outil de gestion interne de l'agence Kameo",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
