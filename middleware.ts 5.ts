import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

/**
 * Edge-compatible middleware that protects all routes.
 * Redirects unauthenticated users to /login.
 * Uses the edge-compatible authConfig (no Node.js deps).
 */
export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (Next.js static assets)
     * - _next/image  (image optimization)
     * - favicon.ico
     * - Public assets (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/cron/|api/signature/|api/auth/reset-password|signature/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
