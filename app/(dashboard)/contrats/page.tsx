'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, FileText, X, Send, CheckCircle, Clock, Loader2, Search, ChevronRight, ChevronLeft, Download, ArrowLeft, Ban, RotateCcw, Upload } from 'lucide-react'
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

interface Contract {
  id: string
  clientName: string
  clientEmail?: string
  subject?: string
  type: string
  billing: string
  startDate?: string
  endDate?: string
  priceHT?: number
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  notes?: string
  active: boolean
  signatureStatus: string
  sentForSignAt?: string
  clientId?: string
  clientAddress?: string
  clientPostalCode?: string
  clientCity?: string
  clientCountry?: string
  clientPhone?: string
  clientSiren?: string
  duration?: string
  maintenanceLevel?: number
  signatureData?: string
  signedCity?: string
  signerName?: string
  signedAt?: string
  stoppedAt?: string
  createdAt: string
}

interface Client {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  address?: string
  postalCode?: string
  city?: string
  country?: string
  siret?: string
}

// ─── Contract types matching PDFs ────────────────────────────────────────────

const CONTRACT_TYPES = [
  { key: 'PACK_COM', label: 'Pack de communication', icon: '📱', desc: 'Réseaux sociaux + Fiche Google' },
  { key: 'MAINTENANCE_WEB', label: 'Maintenance web', icon: '🔧', desc: 'Hébergement, MAJ, support' },
  { key: 'FICHE_GOOGLE', label: 'Fiche Google', icon: '📍', desc: 'Gestion fiche Google Business' },
  { key: 'ARTICLES_BLOG', label: 'Articles de blog', icon: '✍️', desc: 'Rédaction articles SEO' },
]

const TYPE_LABELS: Record<string, string> = {
  PACK_COM: 'Pack com',
  MAINTENANCE_WEB: 'Maintenance web',
  FICHE_GOOGLE: 'Fiche Google',
  ARTICLES_BLOG: 'Articles blog',
  PRESTATION: 'Prestation',
  MAINTENANCE: 'Maintenance',
  ABONNEMENT: 'Abonnement',
  PARTENARIAT: 'Partenariat',
}
const TYPE_COLORS: Record<string, string> = {
  PACK_COM: 'bg-[#E14B89]/10 text-[#E14B89]',
  MAINTENANCE_WEB: 'bg-amber-400/10 text-amber-400',
  FICHE_GOOGLE: 'bg-blue-400/10 text-blue-400',
  ARTICLES_BLOG: 'bg-green-400/10 text-green-400',
  PRESTATION: 'bg-blue-400/10 text-blue-400',
  MAINTENANCE: 'bg-amber-400/10 text-amber-400',
  ABONNEMENT: 'bg-[#E14B89]/10 text-[#E14B89]',
  PARTENARIAT: 'bg-green-400/10 text-green-400',
}

const SIGN_COLORS: Record<string, string> = {
  BROUILLON: 'bg-slate-800 text-slate-400',
  ENVOYE: 'bg-blue-500/10 text-blue-400',
  SIGNE: 'bg-green-500/10 text-green-400',
}
const SIGN_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYE: 'Envoyé',
  SIGNE: 'Signé',
}

function contractStatus(c: Contract): 'EN_COURS' | 'EN_ATTENTE' | 'TERMINE' {
  // TERMINE = client a arrêté (stoppedAt) ou contrat expiré sans renouvellement
  if (c.stoppedAt) return 'TERMINE'
  if (!c.active) return 'TERMINE'
  // EN_COURS = client a signé
  if (c.signatureStatus === 'SIGNE') return 'EN_COURS'
  // EN_ATTENTE = en attente de signature
  return 'EN_ATTENTE'
}

const TABS = [
  { key: 'EN_COURS', label: 'Actifs', dot: 'bg-green-400', desc: 'Contrats signés' },
  { key: 'EN_ATTENTE', label: 'En attente', dot: 'bg-amber-400', desc: 'En attente de signature' },
  { key: 'TERMINE', label: 'Terminés', dot: 'bg-slate-500', desc: 'Arrêtés ou inactifs' },
]

// ─── PDF Generation ──────────────────────────────────────────────────────────

function getContractSubtitle(type: string) {
  switch (type) {
    case 'PACK_COM': return 'Pack de communication'
    case 'MAINTENANCE_WEB': return 'Maintenance web'
    case 'FICHE_GOOGLE': return 'Fiche Google'
    case 'ARTICLES_BLOG': return 'Articles de blog'
    default: return 'Prestation'
  }
}

const MAINTENANCE_LEVELS: Record<number, { label: string; items: string[] }> = {
  1: { label: 'Niveau 1', items: ['Hébergement web'] },
  2: { label: 'Niveau 2', items: ['Hébergement web', 'Hébergement nom de domaine', 'License Elementor Pro', 'Mises à jour régulières du CMS et des plugins', '1 sauvegarde mensuelle complète du site', 'Support technique 5j/7'] },
  3: { label: 'Niveau 3', items: ['Hébergement web', 'Hébergement nom de domaine', 'License Elementor Pro', 'Mises à jour régulières du CMS et des plugins', '1 sauvegarde mensuelle complète du site', 'Support technique 5j/7', '1h de développement'] },
  4: { label: 'Niveau 4', items: ['Hébergement web', 'Hébergement nom de domaine', 'License Elementor Pro', 'Mises à jour régulières du CMS et des plugins', '1 sauvegarde mensuelle complète du site', 'Support technique 5j/7', '1h de développement', '1 appel trimestriel de suivi'] },
}

function getServiceDescriptionHtml(type: string, maintenanceLevel?: number) {
  switch (type) {
    case 'PACK_COM':
      return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div style="background:#f9fafb;border-radius:12px;padding:24px">
          <div style="font-weight:700;font-size:15px;color:#111;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">Réseaux Sociaux</div>
          <ul style="list-style:disc;padding-left:18px;color:#4b5563;font-size:13px;line-height:2">
            <li>Création des réseaux sociaux (si nécessaire)</li>
            <li>Optimisation et refonte visuelle des comptes</li>
            <li>Animation des réseaux (réponse aux messages, aux commentaires, etc.)</li>
            <li>Publication de 2 posts / semaine (2 réseaux sociaux)</li>
          </ul>
        </div>
        <div style="background:#f9fafb;border-radius:12px;padding:24px">
          <div style="font-weight:700;font-size:15px;color:#111;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">Fiche Google</div>
          <ul style="list-style:disc;padding-left:18px;color:#4b5563;font-size:13px;line-height:2">
            <li>Création de la fiche Google (offert)</li>
            <li>Rédaction et publication d'articles sur la fiche Google</li>
            <li>Planification de photos Google</li>
            <li>Réponses aux avis Google</li>
            <li>2 plaquettes Google offertes afin de récolter des avis clients</li>
          </ul>
        </div>
      </div>`
    case 'MAINTENANCE_WEB': {
      const level = MAINTENANCE_LEVELS[maintenanceLevel ?? 2]
      const items = level?.items ?? MAINTENANCE_LEVELS[2].items
      return `<div style="background:#f9fafb;border-radius:12px;padding:24px;max-width:400px">
        <div style="font-weight:700;font-size:15px;color:#111;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">Maintenance web — ${level?.label ?? 'Niveau 2'}</div>
        <ul style="list-style:disc;padding-left:18px;color:#4b5563;font-size:13px;line-height:2">
          ${items.map(item => `<li>${item}</li>`).join('\n          ')}
        </ul>
      </div>`
    }
    case 'FICHE_GOOGLE':
      return `<div style="background:#f9fafb;border-radius:12px;padding:24px;max-width:400px">
        <div style="font-weight:700;font-size:15px;color:#111;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">Fiche Google</div>
        <ul style="list-style:disc;padding-left:18px;color:#4b5563;font-size:13px;line-height:2">
          <li>Création de la fiche Google (offert)</li>
          <li>Rédaction et publication d'articles sur la fiche Google</li>
          <li>Planification de photos Google</li>
          <li>Réponses aux avis Google</li>
          <li>2 plaquettes Google offertes afin de récolter des avis clients</li>
        </ul>
      </div>`
    case 'ARTICLES_BLOG':
      return `<div style="background:#f9fafb;border-radius:12px;padding:24px;max-width:400px">
        <div style="font-weight:700;font-size:15px;color:#111;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb">Articles de blog</div>
        <ul style="list-style:disc;padding-left:18px;color:#4b5563;font-size:13px;line-height:2">
          <li>Rédaction et mise en ligne de 8 articles de blog par mois</li>
        </ul>
      </div>`
    default:
      return ''
  }
}

function buildContractPdfHtml(c: Contract) {
  const logoUrl = `${window.location.origin}/kameo-logo-light.svg`
  const subtitle = getContractSubtitle(c.type)
  const serviceHtml = getServiceDescriptionHtml(c.type, c.maintenanceLevel)
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u202F/g, ' ')
  const priceHT = c.priceHT ?? 0
  const tva = priceHT * 0.2

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contrat - ${c.clientName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; font-size:14px; line-height:1.7; }
  @page { margin: 0; size: A4; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
  .page { padding: 48px 56px; }
  .section-box { background:#f9fafb; border-radius:12px; padding:28px; margin-bottom:20px; }
  .article-badge { display:inline-block; background:#f3f4f6; border-radius:8px; padding:6px 16px; font-weight:600; font-size:14px; color:#374151; margin-bottom:16px; border-left:3px solid #E14B89; }
  h2.article-title { font-size:14px; font-weight:700; color:#111; margin-bottom:12px; }
  .field-line { display:flex; gap:16px; margin-bottom:8px; }
  .field-label { font-size:12px; color:#6b7280; min-width:120px; }
  .field-value { flex:1; border-bottom:1px solid #d1d5db; min-height:22px; font-size:13px; color:#111; padding-bottom:2px; }
</style></head><body>

<!-- PAGE 1: Cover -->
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;page-break-after:always;text-align:center;padding:60px">
  <img src="${logoUrl}" style="height:48px;margin-bottom:48px" />
  <div style="font-size:42px;font-weight:800;color:#111;margin-bottom:8px;font-family:system-ui">Contrat d'abonnement.</div>
  <div style="font-size:18px;color:#6b7280;margin-bottom:64px">${subtitle}</div>

  <!-- ENTRE LES SOUSSIGNÉS -->
  <div style="width:100%;text-align:left">
    <div class="section-box">
      <div style="font-weight:800;font-size:16px;margin-bottom:16px;text-decoration:underline">ENTRE LES SOUSSIGNÉS :</div>
      <p style="color:#4b5563;font-size:13px;line-height:1.8">
        <strong>1. Kameo,</strong> SAS, dont le siège social est situé 1862 RUE LA LAURAGAISE 31670 LABÈGE,
        immatriculée au registre du commerce et des sociétés sous le numéro d'identification 980 573 984 RCS Toulouse,
        représentée par Benjamin Dayan en sa qualité de Président, dûment habilité ;
      </p>
      <p style="color:#4b5563;font-size:13px;margin-top:12px">Ci-après dénommé le "<strong style="text-decoration:underline">Prestataire</strong>".</p>
    </div>

    <div class="section-box">
      <div style="font-weight:800;font-size:16px;margin-bottom:20px">ET :</div>
      <div class="field-line"><span class="field-label">Nom ou dénomination sociale :</span><span class="field-value">${c.clientName || ''}</span></div>
      <div class="field-line"><span class="field-label">Adresse :</span><span class="field-value">${c.clientAddress || ''}</span></div>
      <div style="display:flex;gap:24px;margin-bottom:8px">
        <div style="flex:1;display:flex;gap:8px"><span class="field-label" style="min-width:90px">Code Postal :</span><span class="field-value">${c.clientPostalCode || ''}</span></div>
        <div style="flex:1;display:flex;gap:8px"><span class="field-label" style="min-width:50px">Ville :</span><span class="field-value">${c.clientCity || ''}</span></div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:8px">
        <div style="flex:1;display:flex;gap:8px"><span class="field-label" style="min-width:90px">Pays :</span><span class="field-value">${c.clientCountry || 'France'}</span></div>
        <div style="flex:1;display:flex;gap:8px"><span class="field-label" style="min-width:90px">Téléphone :</span><span class="field-value">${c.clientPhone || ''}</span></div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:8px">
        <div style="flex:1;display:flex;gap:8px"><span class="field-label" style="min-width:90px">Email :</span><span class="field-value">${c.clientEmail || ''}</span></div>
        <div style="flex:1;display:flex;gap:8px"><span class="field-label" style="min-width:90px">SIREN :</span><span class="field-value">${c.clientSiren || ''}</span></div>
      </div>
      <p style="color:#4b5563;font-size:13px;margin-top:12px">Ci-après dénommé le "<strong style="text-decoration:underline">Client</strong>".</p>
    </div>

    <!-- COÛT DU SERVICE -->
    <div class="section-box">
      <div style="font-weight:800;font-size:14px;margin-bottom:16px">COÛT DU SERVICE</div>
      <div style="display:flex;gap:32px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb">
        <div style="display:flex;gap:8px;align-items:baseline">
          <span style="font-size:13px;color:#E14B89;font-weight:600">Coût de l'abonnement mensuel HT :</span>
          <span style="font-weight:700;font-size:15px">${c.priceHT ? fmt(priceHT) : '___________'}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline">
          <span style="font-size:13px;color:#E14B89;font-weight:600">TVA (taux de 20%) :</span>
          <span style="font-weight:700;font-size:15px">${c.priceHT ? fmt(tva) : '___________'}</span>
        </div>
      </div>
      <p style="font-size:12px;color:#4b5563;line-height:1.8">
        Le paiement s'effectuera par <strong>prélèvement automatique SEPA</strong>, avec des prélèvements mensuels.
        Le Débiteur s'engage à fournir un mandat de prélèvement dûment signé et à maintenir des informations bancaires à jour.
        Pour chaque prélèvement refusé par la banque, un <strong>malus de 20€</strong> sera prélevé en supplément.
      </p>
    </div>
  </div>
</div>

<!-- PAGE 2+: Conditions Générales -->
<div class="page" style="page-break-after:always">
  <div style="color:#E14B89;font-size:28px;font-weight:800;margin-bottom:4px">❝</div>
  <div style="font-size:36px;font-weight:800;margin-bottom:32px;font-family:system-ui">Conditions Générales.</div>

  <div class="article-badge">Article 1 : OBJET</div>
  <p style="margin-bottom:24px;font-size:13px;color:#374151;line-height:1.8">
    Les présentes Conditions Générales définissent les droits et obligations respectifs de l'agence digitale KAMEO et du CLIENT dans le cadre de la fourniture par KAMEO SAS d'un service d'hébergement du site internet du CLIENT. Elles définissent notamment les Conditions spécifiques d'utilisation de ce service par le CLIENT ici comme ses termes et conditions particulières. Tout accomplissement par l'Agence Digitale KAMEO d'une prestation de ce service tel que décrites à l'article 3 implique donc l'acceptation sans réserve du CLIENT des présentes conditions générales. Le CLIENT atteste du pouvoir, de l'autorité et de la capacité nécessaires à la concluante et à l'exécution des obligations prévues aux présentes.
  </p>

  <div class="article-badge">Article 2 : DÉFINITIONS</div>
  <p style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.8">Dans les présentes Conditions Générales, les termes évoqués ci-dessous ont, sauf précision contraire, la définition suivante :</p>
  <ul style="list-style:none;padding:0;margin-bottom:24px">
    <li style="font-size:13px;color:#374151;margin-bottom:8px;padding-left:16px;line-height:1.8"><span style="color:#E14B89;font-weight:700">●</span> <strong>CLIENT :</strong> la personne physique ou morale ayant souscrit au Service dispensé par l'Agence Digitale KAMEO pour ses besoins propres ou celui de son activité.</li>
    <li style="font-size:13px;color:#374151;margin-bottom:8px;padding-left:16px;line-height:1.8"><span style="color:#E14B89;font-weight:700">●</span> <strong>CONTRAT :</strong> les présentes Conditions Générales et les Conditions Particulières du Service, les unes et les autres constituant d'accord exprès entre les parties un ensemble indivisible.</li>
    <li style="font-size:13px;color:#374151;padding-left:16px;line-height:1.8"><span style="color:#E14B89;font-weight:700">●</span> <strong>SERVICE :</strong> prestation de communication fournie par l'Agence Digitale KAMEO à son CLIENT.</li>
  </ul>

  <div class="article-badge">Article 3 : DESCRIPTION DU SERVICE</div>
  <p style="margin-bottom:16px;font-size:13px;color:#374151;line-height:1.8">
    Durant la période d'exécution du contrat, l'Agence Digitale KAMEO s'engage à fournir au CLIENT une prestation complète de gestion de communication digitale, incluant les services suivants :
  </p>
  ${serviceHtml}
</div>

<!-- PAGE 3: Articles 4-8 -->
<div class="page" style="page-break-after:always">
  <div class="article-badge">Article 4 : MODALITÉS D'EXÉCUTION DU SERVICE</div>
  <p style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.8"><strong>4.1 –</strong> L'Agence Digitale KAMEO est responsable de la mise en place des moyens nécessaires à la bonne exécution du Service.</p>
  <p style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.8"><strong>4.2 –</strong> L'Agence Digitale KAMEO met à disposition du CLIENT les coordonnées téléphoniques et mail nécessaires à l'exécution du SERVICE.</p>
  <p style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.8"><strong>4.3 –</strong> L'Agence Digitale KAMEO s'engage à prendre en charge la demande de son CLIENT dans les quarante-huit (48) heures suivantes sa réception, sous réserve des heures d'ouverture de l'Agence, et à y apporter une réponse écrite circonstanciée dans les huit (8) jours ouvrés suivants cette prise en charge. Les heures d'ouverture de l'Agence sont : de <strong>09h00</strong> à <strong>18h00</strong>.</p>
  <p style="margin-bottom:24px;font-size:13px;color:#374151;line-height:1.8"><strong>4.4 –</strong> L'Agence Digitale KAMEO prend les mesures propres à assurer la continuité et la qualité du Service, en particulier pendant ses périodes de fermeture pour cause de congés, ou des périodes de congés de son personnel.</p>

  <div class="article-badge">Article 5 : DURÉE</div>
  <p style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.8">
    Le présent contrat est conclu pour une durée de <strong style="border-bottom:1px solid #111;padding:0 4px">${c.duration || '____________'}</strong> sauf dénonciation par l'une des parties dans les conditions et modalités figurant à l'article 6.
  </p>
  <p style="margin-bottom:24px;font-size:13px;color:#374151;line-height:1.8">
    Il sera tacitement reconduit aux termes de la période contractuelle pour une durée d'un (1) an, excepté dénonciation par l'une ou l'autre des parties respectant un délai de préavis d'un (1) mois avant la date de reconduction effective.
  </p>

  <div class="article-badge">Article 6 : RÉSILIATION ANTICIPÉE</div>
  <p style="font-weight:600;font-size:13px;color:#111;margin-bottom:8px;text-decoration:underline">Résiliation pour motif légitime :</p>
  <p style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.8">Sans préjudice de l'article 10, le contrat d'abonnement pourra être résilié en cas de manquement par l'une ou l'autre des parties à ses obligations, charges et conditions décrites aux Conditions Particulières et Générales du Service ou à leurs modifications éventuelles et, particulièrement, en cas de violation des articles 3, 4 et 7.</p>
  <p style="margin-bottom:24px;font-size:13px;color:#374151;line-height:1.8">Cette résiliation de plein droit prendra effet passé un délai de quinze (15) jours à compter de la réception, par la partie à l'encontre de laquelle cette faculté de résiliation est employée, d'une lettre recommandée avec accusé de réception en exposant les motifs.</p>

  <div class="article-badge">Article 7 : PRÉLÈVEMENTS</div>
  <p style="margin-bottom:24px;font-size:13px;color:#374151;line-height:1.8">En cas de rejet du prélèvement bancaire pour quelque motif que ce soit (provision insuffisante, opposition, compte clôturé, etc.), des frais d'un montant de 19,60 € TTC seront facturés au client. Ces frais correspondent aux pénalités bancaires appliquées par l'établissement financier et non à des frais de gestion de l'agence.</p>

  <div class="article-badge">Article 8 : RESPONSABILITÉS</div>
  <p style="font-size:13px;color:#374151;line-height:1.8">Sauf conclusion d'un contrat de représentation distinct, le CLIENT sera seul responsable des informations contenues dans son site internet ou tout autre support digital fourni par l'Agence Digitale KAMEO dans l'accomplissement du Service.</p>
</div>

<!-- PAGE 4: Articles 9-11 + Signature -->
<div class="page">
  <div class="article-badge">Article 9 : MODIFICATION DU CONTRAT</div>
  <p style="margin-bottom:24px;font-size:13px;color:#374151;line-height:1.8">L'Agence Digitale KAMEO peut être amené, y compris pendant la période initiale d'abonnement, à procéder à des modifications de prix ou des caractéristiques du Service. Le CLIENT sera informé par tous moyens de toute modification le concernant un (1) mois avant son entrée en vigueur. Il pourra résilier le contrat dans les deux (2) mois à compter de l'entrée en vigueur de la modification par lettre recommandée avec accusé de réception.</p>

  <div class="article-badge">Article 10 : LIVRAISON, RÉCEPTION ET MISE EN DEMEURE</div>
  <p style="margin-bottom:12px;font-size:13px;color:#374151;line-height:1.8"><strong>10.1 –</strong> La livraison du projet intervient par mise à disposition du Client sur les serveurs du Prestataire et notification par email. Le Client dispose d'un délai de <strong>trente (30) jours</strong> calendaires à compter de la date de livraison pour :</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:16px">
    <ul style="list-style:disc;padding-left:18px;font-size:13px;color:#4b5563;line-height:2">
      <li>Formuler ses demandes de modifications dans le cadre des corrections prévues au contrat.</li>
      <li>Procéder au paiement du solde conformément aux conditions de paiement stipulées.</li>
    </ul>
  </div>
  <p style="margin-bottom:12px;font-size:13px;color:#374151;line-height:1.8"><strong>10.2 –</strong> À l'expiration du délai de trente (30) jours sans retour du Client et/ou sans réception du paiement du solde, le Prestataire se réserve le droit de :</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div style="background:#f9fafb;border-radius:8px;padding:16px">
      <div style="font-weight:700;font-size:14px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">1.</div>
      <p style="font-size:12px;color:#4b5563;line-height:1.7">Adresser au Client une <strong>mise en demeure par lettre recommandée avec accusé de réception</strong> lui impartissant un délai supplémentaire de <strong>quinze (15) jours</strong> pour régulariser sa situation.</p>
    </div>
    <div style="background:#f9fafb;border-radius:8px;padding:16px">
      <div style="font-weight:700;font-size:14px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">2.</div>
      <p style="font-size:12px;color:#4b5563;line-height:1.7">Suspendre immédiatement l'hébergement du projet et <strong>retirer celui-ci de ses serveurs.</strong></p>
    </div>
  </div>
  <p style="margin-bottom:12px;font-size:13px;color:#374151;line-height:1.8"><strong>10.3 –</strong> En cas de retrait du projet des serveurs du Prestataire pour défaut de réponse et/ou de paiement, toute demande ultérieure de remise en ligne nécessitera :</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:16px">
    <ul style="list-style:disc;padding-left:18px;font-size:13px;color:#4b5563;line-height:2">
      <li>La régularisation complète du paiement du solde restant dû.</li>
      <li>Le paiement de <strong>frais de dossier et de remise en service d'un montant de 75,00 € HT</strong> (soit 90,00 € TTC au taux de TVA en vigueur)</li>
    </ul>
  </div>
  <p style="font-size:12px;color:#6b7280;line-height:1.7;margin-bottom:16px">Ces frais couvrent les opérations techniques de restauration, reconfiguration et redéploiement du projet sur les serveurs du Prestataire.</p>
  <p style="margin-bottom:8px;font-size:13px;color:#374151;line-height:1.8"><strong>10.4 –</strong> Le Prestataire conserve une sauvegarde sécurisée du projet pendant une durée de <strong>quatre-vingt-dix (90) jours</strong> suivant le retrait des serveurs. Passé ce délai, le Prestataire ne garantit plus la disponibilité des fichiers et ne pourra être tenu responsable de leur perte définitive.</p>
  <p style="margin-bottom:24px;font-size:13px;color:#374151;line-height:1.8"><strong>10.5 –</strong> L'absence de retour du Client dans le délai de trente (30) jours susmentionné vaut <strong>acceptation tacite et sans réserve</strong> du projet livré dans son état actuel, sous réserve du paiement effectif du solde</p>

  <div class="article-badge">Article 11 : DISPOSITIONS DIVERSES</div>
  <p style="margin-bottom:48px;font-size:13px;color:#374151;line-height:1.8">Le contrat d'abonnement est régi par le droit français. Tout litige le concernant relèvera de la compétence des juridictions françaises.</p>

  <div style="margin-bottom:16px;font-size:13px;color:#4b5563">
    <span>Fait à ${c.signedCity || '___________________'}</span>
    <span style="margin-left:64px">le ${c.signedAt ? new Date(c.signedAt).toLocaleDateString('fr-FR') : '___________________'}</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:24px;min-height:140px">
      <div style="font-weight:700;font-size:16px;margin-bottom:24px">KAMEO SAS</div>
      <div style="font-family:'Dancing Script',cursive;font-size:24px;color:#374151;font-style:italic">Dayan</div>
      <div style="border-top:1px solid #d1d5db;margin-top:24px;padding-top:8px;text-align:center;font-size:11px;color:#9ca3af;font-style:italic">Signature</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:24px;min-height:140px">
      <div style="font-weight:700;font-size:16px;margin-bottom:24px">LE CLIENT</div>
      ${c.signatureData
        ? `<img src="${c.signatureData}" style="max-width:200px;max-height:60px;margin:8px 0" />`
        : '<div style="min-height:48px"></div>'}
      ${c.signerName ? `<div style="font-size:13px;color:#374151;margin-bottom:4px">${c.signerName}</div>` : ''}
      <div style="border-top:1px solid #d1d5db;margin-top:8px;padding-top:8px;text-align:center;font-size:11px;color:#9ca3af;font-style:italic">${c.signatureStatus === 'SIGNE' ? 'Signé' : 'Signature'}</div>
    </div>
  </div>
</div>

</body></html>`
}

function downloadContractPdf(c: Contract) {
  const html = buildContractPdfHtml(c)
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 500)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContratsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'EN_COURS' | 'EN_ATTENTE' | 'TERMINE'>('EN_COURS')

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [maintenanceLevel, setMaintenanceLevel] = useState<number>(0)
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientAddress: '', clientPostalCode: '', clientCity: '',
    clientCountry: 'France', clientPhone: '', clientSiren: '', priceHT: '', duration: '12 mois',
    startDate: '', endDate: '',
  })

  // Edit mode
  const [editItem, setEditItem] = useState<Contract | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // Signature
  const [signModal, setSignModal] = useState<Contract | null>(null)
  const [signEmail, setSignEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)

  // Mandat creation from contract step 4
  const [mandatForm, setMandatForm] = useState({ email: '', referenceContrat: '', descriptionContrat: '' })
  const [creatingMandat, setCreatingMandat] = useState(false)
  const [mandatCreated, setMandatCreated] = useState(false)
  const [sendingBoth, setSendingBoth] = useState(false)

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ filename: string; success: boolean; error?: string }[]>([])
  const importRef = useRef<HTMLInputElement>(null)

  const searchRef = useRef<HTMLDivElement>(null)
  const [showClientDetails, setShowClientDetails] = useState(false)

  function pollData() {
    fetch('/api/contracts').then(r => r.json()).then(c => setContracts(c))
  }
  usePolling(pollData)

  useEffect(() => {
    Promise.all([
      fetch('/api/contracts').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([c, cl]) => { setContracts(c); setClients(cl) }).finally(() => setLoading(false))
  }, [])

  // ─── Wizard handlers ────────────────────────────────────────────────────

  function openWizard() {
    setWizardStep(1)
    setSelectedClient(null)
    setClientSearch('')
    setSelectedType('')
    setForm({ clientName: '', clientEmail: '', clientAddress: '', clientPostalCode: '', clientCity: '', clientCountry: 'France', clientPhone: '', clientSiren: '', priceHT: '', duration: '12 mois', startDate: '', endDate: '' })
    setShowWizard(true)
  }

  function selectClient(client: Client) {
    setSelectedClient(client)
    setForm(prev => ({
      ...prev,
      clientName: client.company || client.name,
      clientEmail: client.email || '',
      clientAddress: client.address || '',
      clientPostalCode: client.postalCode || '',
      clientCity: client.city || '',
      clientCountry: client.country || 'France',
      clientPhone: client.phone || '',
      clientSiren: client.siret || '',
    }))
    setWizardStep(2)
  }

  function selectType(type: string) {
    setSelectedType(type)
    if (type === 'MAINTENANCE_WEB') {
      setMaintenanceLevel(0) // reset, force pick
    } else {
      setMaintenanceLevel(0)
      setWizardStep(3)
    }
  }

  async function handleCreateContract() {
    setSaving(true)
    try {
      const payload = {
        clientName: form.clientName,
        clientEmail: form.clientEmail || null,
        subject: getContractSubtitle(selectedType),
        type: selectedType,
        billing: 'MENSUEL',
        priceHT: form.priceHT ? parseFloat(form.priceHT) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        active: true,
        clientId: selectedClient?.id || null,
        clientAddress: form.clientAddress || null,
        clientPostalCode: form.clientPostalCode || null,
        clientCity: form.clientCity || null,
        clientCountry: form.clientCountry || null,
        clientPhone: form.clientPhone || null,
        clientSiren: form.clientSiren || null,
        duration: form.duration || null,
        maintenanceLevel: selectedType === 'MAINTENANCE_WEB' && maintenanceLevel ? maintenanceLevel : null,
      }
      const res = await fetch('/api/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json()
      setContracts(prev => [created, ...prev])
      setMandatForm({
        email: form.clientEmail || '',
        referenceContrat: '',
        descriptionContrat: getContractSubtitle(selectedType),
      })
      setWizardStep(4)
    } catch { alert('Erreur lors de la création') }
    finally { setSaving(false) }
  }

  async function handleCreateMandatAndSendBoth() {
    if (!lastCreated || !mandatForm.email) return
    setSendingBoth(true)
    try {
      // 1. Create the mandat
      const mandatPayload = {
        clientName: lastCreated.clientName,
        clientEmail: mandatForm.email,
        subject: 'Mandat de prélèvement SEPA',
        billing: 'MENSUEL',
        active: true,
        clientId: lastCreated.clientId || null,
        contractId: lastCreated.id,
        referenceContrat: mandatForm.referenceContrat || null,
        descriptionContrat: mandatForm.descriptionContrat || null,
      }
      const mandatRes = await fetch('/api/mandats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mandatPayload),
      })
      const createdMandat = await mandatRes.json()
      setMandatCreated(true)

      // 2. Send contract for signature
      await fetch(`/api/contracts/${lastCreated.id}/send-signature`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mandatForm.email }),
      })
      setContracts(prev => prev.map(c => c.id === lastCreated.id ? { ...c, signatureStatus: 'ENVOYE', sentForSignAt: new Date().toISOString() } : c))

      // 3. Send mandat for signature
      await fetch(`/api/mandats/${createdMandat.id}/send-signature`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mandatForm.email }),
      })

      alert('Contrat + Mandat envoyés pour signature !')
      setShowWizard(false)
    } catch { alert('Erreur lors de l\'envoi') }
    finally { setSendingBoth(false) }
  }

  async function handleSendSignature() {
    if (!signModal || !signEmail) return
    setSending(true)
    try {
      const res = await fetch(`/api/contracts/${signModal.id}/send-signature`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signEmail }),
      })
      if (!res.ok) { const err = await res.json(); alert(err.error || 'Erreur'); return }
      setContracts(prev => prev.map(c => c.id === signModal.id ? { ...c, signatureStatus: 'ENVOYE', sentForSignAt: new Date().toISOString() } : c))
      setSignModal(null)
      alert('Email envoyé avec succès !')
    } catch { alert('Erreur réseau') }
    finally { setSending(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce contrat ?')) return
    await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    setContracts(prev => prev.filter(c => c.id !== id))
  }

  async function handleStopContract(id: string) {
    if (!confirm('Marquer ce contrat comme arrêté par le client ? (pas de reconduction tacite)')) return
    const res = await fetch(`/api/contracts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    })
    if (res.ok) {
      setContracts(prev => prev.map(c => c.id === id ? { ...c, stoppedAt: new Date().toISOString() } : c))
    }
  }

  async function handleReactivateContract(id: string) {
    if (!confirm('Réactiver ce contrat ?')) return
    const res = await fetch(`/api/contracts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stoppedAt: null }),
    })
    if (res.ok) {
      setContracts(prev => prev.map(c => c.id === id ? { ...c, stoppedAt: undefined } : c))
    }
  }

  async function handleImportContracts(files: FileList) {
    setImporting(true)
    setImportResults([])
    try {
      const formData = new FormData()
      Array.from(files).forEach(f => formData.append('files', f))
      const res = await fetch('/api/contracts/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.results) {
        setImportResults(data.results)
        // Refresh contracts list
        const refreshed = await fetch('/api/contracts').then(r => r.json())
        setContracts(refreshed)
      } else {
        setImportResults([{ filename: 'Erreur', success: false, error: data.error }])
      }
    } catch { setImportResults([{ filename: 'Erreur', success: false, error: 'Erreur réseau' }]) }
    finally { setImporting(false) }
  }

  const filteredClients = clientSearch.length >= 1
    ? clients.filter(c => (c.name + ' ' + (c.company || '')).toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
    : []

  const filtered = contracts.filter(c => contractStatus(c) === tab)
  const totalMRC = contracts.filter(c => contractStatus(c) === 'EN_COURS').reduce((s, c) => s + (c.priceHT ?? 0), 0)

  // Last created contract (for step 4)
  const lastCreated = contracts[0]

  const inputClass = "w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
  const inputError = "w-full bg-[#1a1a24] border border-red-500/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-400 transition-colors"
  const labelClass = "block text-slate-400 text-xs mb-1.5"

  // Field validations
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailValid = !form.clientEmail || emailRegex.test(form.clientEmail)
  const postalValid = !form.clientPostalCode || /^\d{5}$/.test(form.clientPostalCode)
  const sirenValid = !form.clientSiren || /^\d{9}$/.test(form.clientSiren)
  const mandatEmailValid = !mandatForm.email || emailRegex.test(mandatForm.email)
  const signEmailValid = !signEmail || emailRegex.test(signEmail)

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Contrats</h1>
          <p className="text-slate-400 text-sm mt-1">
            {contracts.filter(c => contractStatus(c) === 'EN_COURS').length} actifs
            {totalMRC > 0 && <> · {formatCurrency(totalMRC)}/mois récurrent</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowImport(true); setImportResults([]) }}
            className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Upload size={16} /> Importer
          </button>
          <button onClick={openWizard}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Nouveau contrat
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111118] border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const count = contracts.filter(c => contractStatus(c) === t.key).length
          return (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
              {t.label}
              <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">Aucun contrat dans cette catégorie</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Client</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Prix HT</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Durée</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Début</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Signature</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{c.clientName}</p>
                      {c.subject && <p className="text-slate-500 text-xs">{c.subject}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[c.type] ?? 'bg-slate-800 text-slate-400'}`}>{TYPE_LABELS[c.type] ?? c.type}</span>
                    </td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{c.priceHT ? formatCurrency(c.priceHT) + '/mois' : '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">{c.duration || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{c.startDate ? formatDate(c.startDate) : '—'}</td>
                    <td className="px-4 py-3">
                      {c.stoppedAt ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                          <Ban size={10} className="inline mr-1" />Arrêté
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SIGN_COLORS[c.signatureStatus] ?? 'bg-slate-800 text-slate-400'}`}>
                          {c.signatureStatus === 'SIGNE' && <CheckCircle size={10} className="inline mr-1" />}
                          {c.signatureStatus === 'ENVOYE' && <Clock size={10} className="inline mr-1" />}
                          {SIGN_LABELS[c.signatureStatus] ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => downloadContractPdf(c)}
                          className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors" title="Télécharger PDF">
                          <Download size={13} />
                        </button>
                        {c.signatureStatus !== 'SIGNE' && !c.stoppedAt && (
                          <button onClick={() => { setSignModal(c); setSignEmail(c.clientEmail || '') }}
                            className="p-1.5 text-blue-400 hover:text-blue-300 rounded-lg hover:bg-blue-400/5 transition-colors" title="Envoyer pour signature">
                            <Send size={13} />
                          </button>
                        )}
                        {c.signatureStatus === 'SIGNE' && !c.stoppedAt && (
                          <button onClick={() => handleStopContract(c.id)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-amber-400/5 transition-colors" title="Client veut arrêter">
                            <Ban size={13} />
                          </button>
                        )}
                        {c.stoppedAt && (
                          <button onClick={() => handleReactivateContract(c.id)}
                            className="p-1.5 text-green-400 hover:text-green-300 rounded-lg hover:bg-green-400/5 transition-colors" title="Réactiver le contrat">
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ WIZARD MODAL ═══ */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                {wizardStep > 1 && wizardStep < 4 && (
                  <button onClick={() => setWizardStep(wizardStep - 1)} className="text-slate-500 hover:text-white transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div>
                  <h2 className="text-white font-semibold text-lg">Nouveau contrat</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Étape {Math.min(wizardStep, 4)} / 4</p>
                </div>
              </div>
              <button onClick={() => setShowWizard(false)} className="text-slate-500 hover:text-white transition-colors p-1"><X size={18} /></button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 px-6 pt-4">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= wizardStep ? 'bg-[#E14B89]' : 'bg-slate-800'}`} />
              ))}
            </div>

            <div className="p-6">
              {/* ─── Step 1: Select Client ─── */}
              {wizardStep === 1 && (
                <div>
                  <h3 className="text-white font-medium mb-1">Sélectionner un client</h3>
                  <p className="text-slate-500 text-sm mb-4">Recherchez et sélectionnez le client pour ce contrat</p>

                  <div className="relative" ref={searchRef}>
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                      placeholder="Rechercher un client par nom ou entreprise..."
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      autoFocus
                    />
                  </div>

                  {filteredClients.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {filteredClients.map(c => (
                        <button key={c.id} onClick={() => selectClient(c)}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                          <div>
                            <p className="text-white text-sm font-medium">{c.company || c.name}</p>
                            <p className="text-slate-500 text-xs">{[c.email, c.city].filter(Boolean).join(' · ')}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-600 group-hover:text-[#E14B89] transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}

                  {clientSearch.length >= 2 && filteredClients.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">Aucun client trouvé</div>
                  )}
                </div>
              )}

              {/* ─── Step 2: Select Type ─── */}
              {wizardStep === 2 && (
                <div>
                  <h3 className="text-white font-medium mb-1">Type de contrat</h3>
                  <p className="text-slate-500 text-sm mb-4">
                    Client : <span className="text-white">{form.clientName}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {CONTRACT_TYPES.map(t => (
                      <button key={t.key} onClick={() => selectType(t.key)}
                        className={`text-left p-5 rounded-xl border transition-all hover:border-[#E14B89]/50 hover:bg-[#E14B89]/5 ${
                          selectedType === t.key ? 'border-[#E14B89] bg-[#E14B89]/10' : 'border-slate-800 bg-[#1a1a24]'
                        }`}>
                        <div className="text-2xl mb-2">{t.icon}</div>
                        <div className="text-white font-medium text-sm">{t.label}</div>
                        <div className="text-slate-500 text-xs mt-1">{t.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Maintenance web level selector */}
                  {selectedType === 'MAINTENANCE_WEB' && (
                    <div className="mt-6">
                      <h4 className="text-white font-medium mb-1">Niveau de maintenance</h4>
                      <p className="text-slate-500 text-xs mb-3">Choisissez le niveau de services inclus</p>
                      <div className="space-y-2">
                        {([1, 2, 3, 4] as const).map(lvl => {
                          const info = MAINTENANCE_LEVELS[lvl]
                          return (
                            <button key={lvl} onClick={() => { setMaintenanceLevel(lvl); setWizardStep(3) }}
                              className={`w-full text-left p-4 rounded-xl border transition-all hover:border-[#E14B89]/50 hover:bg-[#E14B89]/5 ${
                                maintenanceLevel === lvl ? 'border-[#E14B89] bg-[#E14B89]/10' : 'border-slate-800 bg-[#1a1a24]'
                              }`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-medium text-sm">{info.label}</span>
                                <span className="text-slate-500 text-xs">{info.items.length} service{info.items.length > 1 ? 's' : ''}</span>
                              </div>
                              <div className="text-slate-400 text-xs">{info.items.join(' · ')}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Step 3: Fill Info ─── */}
              {wizardStep === 3 && (
                <div>
                  <h3 className="text-white font-medium mb-1">Informations du contrat</h3>
                  <p className="text-slate-500 text-sm mb-4">
                    {getContractSubtitle(selectedType)} — <span className="text-white">{form.clientName}</span>
                  </p>

                  <div className="space-y-3">
                    {/* Client info recap (collapsible) */}
                    <div className="bg-[#1a1a24] border border-slate-700 rounded-xl overflow-hidden">
                      <button type="button" onClick={() => setShowClientDetails(!showClientDetails)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">{form.clientName}</div>
                          <div className="text-slate-500 text-xs truncate">
                            {[form.clientEmail, form.clientAddress, form.clientCity].filter(Boolean).join(' · ') || 'Aucune info client'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          {form.clientEmail && form.clientAddress && form.clientCity ? (
                            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Complet</span>
                          ) : (
                            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Incomplet</span>
                          )}
                          <ChevronRight size={14} className={`text-slate-500 transition-transform ${showClientDetails ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                      {showClientDetails && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-800 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Nom / Dénomination sociale *</label>
                              <input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} className={inputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>Email client</label>
                              <input type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} className={emailValid ? inputClass : inputError} />
                              {!emailValid && <p className="text-red-400 text-[11px] mt-1">Format email invalide</p>}
                            </div>
                          </div>
                          <div>
                            <label className={labelClass}>Adresse</label>
                            <input value={form.clientAddress} onChange={e => setForm({ ...form, clientAddress: e.target.value })} className={inputClass} />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className={labelClass}>Code postal</label>
                              <input value={form.clientPostalCode} onChange={e => setForm({ ...form, clientPostalCode: e.target.value.replace(/\D/g, '').slice(0, 5) })} className={postalValid ? inputClass : inputError} inputMode="numeric" maxLength={5} />
                              {!postalValid && <p className="text-red-400 text-[11px] mt-1">5 chiffres attendus</p>}
                            </div>
                            <div>
                              <label className={labelClass}>Ville</label>
                              <input value={form.clientCity} onChange={e => setForm({ ...form, clientCity: e.target.value })} className={inputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>Pays</label>
                              <input value={form.clientCountry} onChange={e => setForm({ ...form, clientCountry: e.target.value })} className={inputClass} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Téléphone</label>
                              <input value={form.clientPhone} onChange={e => setForm({ ...form, clientPhone: formatPhone(e.target.value) })} className={inputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>SIREN</label>
                              <input value={form.clientSiren} onChange={e => setForm({ ...form, clientSiren: e.target.value.replace(/\D/g, '').slice(0, 9) })} className={sirenValid ? inputClass : inputError} inputMode="numeric" maxLength={9} />
                              {!sirenValid && <p className="text-red-400 text-[11px] mt-1">9 chiffres attendus</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Contract-specific fields */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Prix HT mensuel (€) *</label>
                        <input type="number" step="0.01" value={form.priceHT} onChange={e => setForm({ ...form, priceHT: e.target.value })} className={inputClass} placeholder="ex: 250" autoFocus />
                      </div>
                      <div>
                        <label className={labelClass}>Durée du contrat</label>
                        <input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className={inputClass} placeholder="ex: 12 mois" />
                      </div>
                      <div>
                        <label className={labelClass}>Date de début</label>
                        <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setWizardStep(2)}
                      className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                      Retour
                    </button>
                    <button onClick={handleCreateContract} disabled={saving || !form.clientName || !emailValid || !postalValid || !sirenValid}
                      className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Créer le contrat
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Step 4: Actions + Mandat ─── */}
              {wizardStep === 4 && lastCreated && (
                <div>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-green-400" />
                    </div>
                    <h3 className="text-white font-semibold text-lg mb-2">Contrat créé !</h3>
                    <p className="text-slate-400 text-sm">
                      {getContractSubtitle(lastCreated.type)} pour <strong className="text-white">{lastCreated.clientName}</strong>
                    </p>
                  </div>

                  <div className="flex gap-3 max-w-sm mx-auto mb-6">
                    <button onClick={() => downloadContractPdf(lastCreated)}
                      className="flex-1 flex items-center justify-center gap-2 border border-slate-700 text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors hover:bg-slate-800/50">
                      <Download size={16} /> Télécharger
                    </button>
                    <button onClick={() => { setShowWizard(false); setSignModal(lastCreated); setSignEmail(lastCreated.clientEmail || '') }}
                      className="flex-1 flex items-center justify-center gap-2 border border-slate-700 text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors hover:bg-slate-800/50">
                      <Send size={16} /> Envoyer contrat seul
                    </button>
                  </div>

                  {/* Create mandat + send both */}
                  <div className="border border-[#E14B89]/30 bg-[#E14B89]/5 rounded-xl p-5">
                    <h4 className="text-white font-medium text-sm mb-1">Créer un mandat SEPA et tout envoyer</h4>
                    <p className="text-slate-400 text-xs mb-4">Le client recevra le contrat + le mandat de prélèvement à signer</p>
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Email du client *</label>
                        <input type="email" value={mandatForm.email} onChange={e => setMandatForm({ ...mandatForm, email: e.target.value })}
                          className={mandatEmailValid ? inputClass : inputError} placeholder="client@example.com" />
                        {!mandatEmailValid && <p className="text-red-400 text-[11px] mt-1">Format email invalide</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Référence mandat</label>
                          <input value={mandatForm.referenceContrat} onChange={e => setMandatForm({ ...mandatForm, referenceContrat: e.target.value })}
                            className={inputClass} placeholder="KAMEO-2026-001" />
                        </div>
                        <div>
                          <label className={labelClass}>Description</label>
                          <input value={mandatForm.descriptionContrat} disabled
                            className="w-full bg-[#1a1a24] border border-slate-700/50 rounded-xl px-3 py-2.5 text-slate-400 text-sm" />
                        </div>
                      </div>
                    </div>
                    <button onClick={handleCreateMandatAndSendBoth} disabled={sendingBoth || !mandatForm.email || !mandatEmailValid}
                      className="w-full mt-4 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      {sendingBoth ? <Loader2 size={14} className="animate-spin" /> : <Send size={16} />}
                      {sendingBoth ? 'Envoi en cours...' : 'Créer mandat + Envoyer les 2'}
                    </button>
                  </div>

                  <button onClick={() => setShowWizard(false)} className="text-slate-500 hover:text-white text-sm mt-4 transition-colors block mx-auto">
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SIGNATURE MODAL ═══ */}
      {signModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Envoyer pour signature</h2>
              <button onClick={() => setSignModal(null)} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Un lien de signature sera envoyé au client <strong className="text-white">{signModal.clientName}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-slate-400 text-xs mb-1.5">Email du client *</label>
              <input type="email" required value={signEmail} onChange={e => setSignEmail(e.target.value)} className={signEmailValid ? inputClass : inputError} />
              {!signEmailValid && <p className="text-red-400 text-[11px] mt-1">Format email invalide</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSignModal(null)} className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
              <button onClick={handleSendSignature} disabled={sending || !signEmail || !signEmailValid}
                className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ IMPORT MODAL ═══ */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Importer des contrats</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Importez un ou plusieurs contrats au format PDF. L&apos;IA analysera chaque document pour en extraire les informations et créer les contrats automatiquement.
            </p>

            <input ref={importRef} type="file" accept=".pdf" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) handleImportContracts(e.target.files) }} />

            {!importing && importResults.length === 0 && (
              <button onClick={() => importRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-700 hover:border-[#E14B89]/50 rounded-xl py-12 flex flex-col items-center gap-3 transition-colors group">
                <Upload size={32} className="text-slate-500 group-hover:text-[#E14B89] transition-colors" />
                <span className="text-slate-400 text-sm">Cliquez pour sélectionner des fichiers PDF</span>
              </button>
            )}

            {importing && (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 size={32} className="text-[#E14B89] animate-spin" />
                <p className="text-slate-400 text-sm">Analyse des PDFs en cours...</p>
                <p className="text-slate-500 text-xs">Cela peut prendre quelques secondes par fichier</p>
              </div>
            )}

            {importResults.length > 0 && (
              <div className="space-y-2">
                {importResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${r.success ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    {r.success ? <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" /> : <X size={16} className="text-red-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${r.success ? 'text-emerald-400' : 'text-red-400'}`}>{r.filename}</p>
                      {r.error && <p className="text-red-400/70 text-xs truncate">{r.error}</p>}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setImportResults([]); importRef.current?.click() }}
                    className="flex-1 border border-slate-700 text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                    Importer d&apos;autres
                  </button>
                  <button onClick={() => setShowImport(false)}
                    className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
