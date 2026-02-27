import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  BRIEF: 'Brief',
  REDACTION: 'Rédaction',
  MAQUETTE: 'Maquette',
  DEVELOPPEMENT: 'Développement',
  REVIEW: 'Review',
  LIVRAISON: 'Livraison',
  MAINTENANCE: 'Maintenance',
  ARCHIVE: 'Archivé',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  BRIEF: 'bg-slate-100 text-slate-700',
  REDACTION: 'bg-amber-100 text-amber-700',
  MAQUETTE: 'bg-purple-100 text-purple-700',
  DEVELOPPEMENT: 'bg-blue-100 text-blue-700',
  REVIEW: 'bg-orange-100 text-orange-700',
  LIVRAISON: 'bg-green-100 text-green-700',
  MAINTENANCE: 'bg-teal-100 text-teal-700',
  ARCHIVE: 'bg-gray-100 text-gray-500',
}

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  WORDPRESS: 'WordPress',
  FRAMER: 'Framer',
  CUSTOM: 'Sur mesure',
  ECOMMERCE: 'E-commerce',
}

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  WORDPRESS: 'bg-blue-50 text-blue-600',
  FRAMER: 'bg-[#E14B89]/10 text-[#E14B89]',
  CUSTOM: 'bg-amber-50 text-amber-600',
  ECOMMERCE: 'bg-green-50 text-green-600',
}

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Normale',
  HIGH: 'Haute',
  CRITICAL: 'Critique',
}

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  CRITICAL: 'bg-red-100 text-red-600',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  REVIEW: 'En review',
  DONE: 'Terminé',
}

export const MAINTENANCE_LABELS: Record<string, string> = {
  NONE: 'Aucune',
  ESSENTIELLE: 'Essentielle',
  DEVELOPPEMENT: 'Développement',
  SEO: 'SEO',
}

export const RESOURCE_CATEGORY_LABELS: Record<string, string> = {
  PROCESS: 'Process',
  CAHIER_CHARGES: 'Cahier des charges',
  PLUGIN: 'Plugins',
  GUIDE: 'Guide',
  PROMPT: 'Prompt',
  SEO: 'SEO',
  AUTRE: 'Autres',
}

export const RESOURCE_CATEGORY_COLORS: Record<string, string> = {
  PROCESS: 'bg-blue-500/15 text-blue-400',
  CAHIER_CHARGES: 'bg-purple-500/15 text-purple-400',
  PLUGIN: 'bg-green-500/15 text-green-400',
  GUIDE: 'bg-teal-500/15 text-teal-400',
  PROMPT: 'bg-[#E14B89]/15 text-[#E14B89]',
  SEO: 'bg-yellow-500/15 text-yellow-400',
  AUTRE: 'bg-slate-500/15 text-slate-400',
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Président',
  DEVELOPER: 'Développeur',
  REDACTEUR: 'Rédacteur',
  DESIGNER: 'Designer',
}

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-[#E14B89]/10 text-[#E14B89] border-[#E14B89]/20',
  DEVELOPER: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  REDACTEUR: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  DESIGNER: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
}

export const ROLE_AVATAR_COLORS: Record<string, string> = {
  ADMIN: 'from-[#E14B89] to-[#F8903C]',
  DEVELOPER: 'from-blue-400 to-blue-600',
  REDACTEUR: 'from-amber-400 to-amber-600',
  DESIGNER: 'from-pink-400 to-pink-600',
}
