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
  MAQUETTE: 'Maquette',
  DEVELOPPEMENT: 'Développement',
  REVIEW: 'Review',
  LIVRAISON: 'Livraison',
  MAINTENANCE: 'Maintenance',
  ARCHIVE: 'Archivé',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  BRIEF: 'bg-slate-100 text-slate-700',
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
  FRAMER: 'bg-violet-50 text-violet-600',
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
  PROMPT: 'Prompt',
  PLUGIN: 'Plugin',
  GUIDE: 'Guide',
  TEMPLATE: 'Template',
  OUTIL: 'Outil',
  SEO: 'SEO',
  DESIGN: 'Design',
  DEVELOPPEMENT: 'Développement',
  AUTRE: 'Autre',
}

export const RESOURCE_CATEGORY_COLORS: Record<string, string> = {
  PROMPT: 'bg-violet-100 text-violet-700',
  PLUGIN: 'bg-green-100 text-green-700',
  GUIDE: 'bg-blue-100 text-blue-700',
  TEMPLATE: 'bg-orange-100 text-orange-700',
  OUTIL: 'bg-teal-100 text-teal-700',
  SEO: 'bg-yellow-100 text-yellow-700',
  DESIGN: 'bg-pink-100 text-pink-700',
  DEVELOPPEMENT: 'bg-cyan-100 text-cyan-700',
  AUTRE: 'bg-gray-100 text-gray-700',
}
