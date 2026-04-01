/**
 * Shared security utilities
 */

const BCRYPT_COST = 12

export { BCRYPT_COST }

/** Validate password strength: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères'
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule'
  if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule'
  if (!/\d/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre'
  return null
}

/** Validate email format strictly (no CRLF, no spaces) */
export function isValidEmail(email: string): boolean {
  return /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]{2,}$/.test(email)
}

/** In-memory rate limiter (per key, sliding window) */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true // allowed
  }
  if (entry.count >= maxAttempts) return false // blocked
  entry.count++
  return true // allowed
}

/** CSRF protection: verify Origin or Referer header matches our domain */
export function csrfCheck(req: { headers: { get(name: string): string | null } }): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')

  // In development, allow localhost
  if (host?.startsWith('localhost') || host?.startsWith('127.0.0.1')) return true

  // Check Origin header first (most reliable)
  if (origin) {
    try {
      const originHost = new URL(origin).host
      return originHost === host
    } catch {
      return false
    }
  }

  // Fallback to Referer header
  if (referer) {
    try {
      const refererHost = new URL(referer).host
      return refererHost === host
    } catch {
      return false
    }
  }

  // No Origin or Referer — block (could be direct API call)
  return false
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key)
  }
}, 5 * 60 * 1000)
