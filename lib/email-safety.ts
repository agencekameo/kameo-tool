import dns from 'dns'
import { prisma } from '@/lib/db'

// ── Disposable email domains (common ones) ──
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'throwaway.email', 'guerrillamail.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'guerrillamail.net', 'yopmail.com', 'yopmail.fr', 'trashmail.com',
  'trashmail.me', 'dispostable.com', 'maildrop.cc', 'mailnesia.com',
  'tempail.com', 'tempmailaddress.com', 'temp-mail.org', 'fakeinbox.com',
  'mailcatch.com', 'mintemail.com', 'mohmal.com', 'burner.kiwi',
  'getairmail.com', 'mailforspam.com', 'safetymail.info',
])

// ── Warm-up schedule (days since first send → max per day) ──
const WARMUP_SCHEDULE = [
  { days: 7, max: 5 },     // Week 1: 5/day
  { days: 14, max: 10 },   // Week 2: 10/day
  { days: 21, max: 20 },   // Week 3: 20/day
  { days: Infinity, max: 30 }, // Week 4+: 30/day
]

// ── Sending config ──
export const SEND_CONFIG = {
  BATCH_SIZE: 15,                    // Max emails per batch
  DELAY_BETWEEN_EMAILS_MIN: 30_000,  // 30s min between emails
  DELAY_BETWEEN_EMAILS_MAX: 90_000,  // 90s max between emails
  DELAY_BETWEEN_BATCHES: 3_600_000,  // 1h between batches
  MAX_BOUNCE_RATE: 0.05,             // 5% bounce → auto-stop
  MAX_PER_DAY_ABSOLUTE: 30,          // Hard cap per day (all accounts)
}

/**
 * Validate email syntax
 */
export function isValidEmailSyntax(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email) && email.length <= 254
}

/**
 * Check if email domain is disposable
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ? DISPOSABLE_DOMAINS.has(domain) : true
}

/**
 * Verify domain has MX records (mail server exists)
 */
export function verifyMX(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

/**
 * Full email validation: syntax + not disposable + MX check
 */
export async function validateEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
  if (!isValidEmailSyntax(email)) {
    return { valid: false, reason: 'Syntaxe email invalide' }
  }

  if (isDisposableEmail(email)) {
    return { valid: false, reason: 'Email jetable détecté' }
  }

  const domain = email.split('@')[1]
  const hasMX = await verifyMX(domain)
  if (!hasMX) {
    return { valid: false, reason: `Domaine ${domain} n'a pas de serveur mail (MX)` }
  }

  return { valid: true }
}

/**
 * Batch validate emails, returns valid and invalid lists
 */
export async function validateEmails(emails: { id: string; email: string }[]): Promise<{
  valid: { id: string; email: string }[]
  invalid: { id: string; email: string; reason: string }[]
}> {
  const valid: { id: string; email: string }[] = []
  const invalid: { id: string; email: string; reason: string }[] = []

  // Cache MX results per domain to avoid redundant lookups
  const mxCache = new Map<string, boolean>()

  for (const item of emails) {
    if (!isValidEmailSyntax(item.email)) {
      invalid.push({ ...item, reason: 'Syntaxe invalide' })
      continue
    }

    if (isDisposableEmail(item.email)) {
      invalid.push({ ...item, reason: 'Email jetable' })
      continue
    }

    const domain = item.email.split('@')[1]
    let hasMX = mxCache.get(domain)
    if (hasMX === undefined) {
      hasMX = await verifyMX(domain)
      mxCache.set(domain, hasMX)
    }

    if (!hasMX) {
      invalid.push({ ...item, reason: `Domaine ${domain} sans serveur mail` })
    } else {
      valid.push(item)
    }
  }

  return { valid, invalid }
}

/**
 * Get today's quota usage for a specific account
 */
export async function getQuotaForToday(account: string = 'default'): Promise<{
  sent: number
  bounced: number
  failed: number
  remaining: number
  maxToday: number
  bounceRate: number
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const quota = await prisma.emailQuota.findUnique({
    where: { date_account: { date: today, account } },
  })

  const maxToday = await getDailyLimit()
  const sent = quota?.sentCount || 0
  const bounced = quota?.bounceCount || 0
  const failed = quota?.failCount || 0
  const bounceRate = sent > 0 ? bounced / sent : 0

  return {
    sent,
    bounced,
    failed,
    remaining: Math.max(0, maxToday - sent),
    maxToday,
    bounceRate,
  }
}

/**
 * Get daily limit based on warm-up schedule
 */
export async function getDailyLimit(): Promise<number> {
  // Find the earliest email ever sent
  const firstQuota = await prisma.emailQuota.findFirst({
    where: { sentCount: { gt: 0 } },
    orderBy: { date: 'asc' },
  })

  if (!firstQuota) {
    // Never sent before → start of warm-up
    return WARMUP_SCHEDULE[0].max
  }

  const daysSinceFirst = Math.floor(
    (Date.now() - firstQuota.date.getTime()) / (1000 * 60 * 60 * 24)
  )

  for (const tier of WARMUP_SCHEDULE) {
    if (daysSinceFirst < tier.days) {
      return tier.max
    }
  }

  return SEND_CONFIG.MAX_PER_DAY_ABSOLUTE
}

/**
 * Increment sent count for today
 */
export async function incrementQuota(account: string = 'default', type: 'sent' | 'bounce' | 'fail' = 'sent'): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const field = type === 'sent' ? 'sentCount' : type === 'bounce' ? 'bounceCount' : 'failCount'

  await prisma.emailQuota.upsert({
    where: { date_account: { date: today, account } },
    create: { date: today, account, [field]: 1 },
    update: { [field]: { increment: 1 } },
  })
}

/**
 * Calculate random delay between emails (human-like)
 */
export function getRandomDelay(): number {
  const min = SEND_CONFIG.DELAY_BETWEEN_EMAILS_MIN
  const max = SEND_CONFIG.DELAY_BETWEEN_EMAILS_MAX
  return Math.floor(Math.random() * (max - min) + min)
}

/**
 * Get estimated total time for sending N emails
 */
export function estimateSendTime(count: number): {
  minutes: number
  batches: number
  description: string
} {
  const batches = Math.ceil(count / SEND_CONFIG.BATCH_SIZE)
  const avgDelay = (SEND_CONFIG.DELAY_BETWEEN_EMAILS_MIN + SEND_CONFIG.DELAY_BETWEEN_EMAILS_MAX) / 2
  const emailTime = count * avgDelay
  const batchPauses = Math.max(0, batches - 1) * SEND_CONFIG.DELAY_BETWEEN_BATCHES
  const totalMs = emailTime + batchPauses
  const minutes = Math.ceil(totalMs / 60_000)

  let description: string
  if (minutes < 60) {
    description = `~${minutes} minutes`
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    description = `~${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`
  } else {
    const days = Math.floor(minutes / 1440)
    const remainHours = Math.floor((minutes % 1440) / 60)
    description = `~${days} jour${days > 1 ? 's' : ''}${remainHours > 0 ? ` ${remainHours}h` : ''}`
  }

  return { minutes, batches, description }
}

/**
 * Risk level for a given send count
 */
export function getRiskLevel(count: number, dailyRemaining: number): {
  level: 'safe' | 'warning' | 'danger'
  message: string
  color: string
} {
  if (count > dailyRemaining) {
    return {
      level: 'danger',
      message: `Dépasse le quota du jour (${dailyRemaining} restant${dailyRemaining > 1 ? 's' : ''})`,
      color: '#ef4444',
    }
  }

  if (count > 20) {
    return {
      level: 'warning',
      message: 'Volume élevé — recommandé d\'étaler sur plusieurs jours',
      color: '#f59e0b',
    }
  }

  if (count > 10) {
    return {
      level: 'warning',
      message: 'Volume modéré — envoi étalé automatiquement',
      color: '#f59e0b',
    }
  }

  return {
    level: 'safe',
    message: 'Volume sûr',
    color: '#22c55e',
  }
}
