import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { authConfig } from '@/auth.config'
import { rateLimit } from '@/lib/security'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        impersonationToken: { label: 'Impersonation Token', type: 'text' },
      },
      async authorize(credentials) {
        // ── Impersonation login ──────────────────────────────────────────
        if (credentials?.impersonationToken) {
          const tokenHash = crypto.createHash('sha256').update(String(credentials.impersonationToken)).digest('hex')
          const tokenKey = `impersonate:${tokenHash}`
          const setting = await prisma.setting.findUnique({
            where: { key: tokenKey },
          })

          if (!setting) return null

          const { targetUserId, adminId, expiresAt } = JSON.parse(setting.value)

          // Delete the token immediately (one-time use)
          await prisma.setting.delete({ where: { id: setting.id } })

          // Check expiration
          if (new Date() > new Date(expiresAt)) return null

          const user = await prisma.user.findUnique({
            where: { id: targetUserId },
          })

          if (!user) return null

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            impersonatingFrom: adminId || undefined,
          } as any
        }

        // ── Normal login ─────────────────────────────────────────────────
        if (!credentials?.email || !credentials?.password) return null

        // Rate limit: max 5 attempts per email per 15 minutes
        const email = (credentials.email as string).toLowerCase()
        if (!rateLimit(`login:${email}`, 5, 15 * 60 * 1000)) return null

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    authorized: authConfig.callbacks!.authorized!,
    jwt({ token, user }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role
        token.id = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const impFrom = (user as any).impersonatingFrom
        if (impFrom) {
          token.impersonatingFrom = impFrom
        } else {
          // Clear impersonation flag when logging in normally
          delete token.impersonatingFrom
        }
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).role = token.role as string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (token.impersonatingFrom) {
          ;(session.user as any).impersonatingFrom = token.impersonatingFrom as string
        }
      }
      return session
    },
  },
})
