/**
 * HTML email templates for Kameo Tool
 */

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

interface SignatureEmailParams {
  signerFirstName: string
  signerLastName: string
  quoteNumber: string
  subject: string
  signingUrl: string
  expiresAt: string // formatted date string
  tone?: 'tu' | 'vous'
  nameDisplay?: 'prenom' | 'nom'
}

export function buildSignatureEmailHtml(params: SignatureEmailParams): string {
  const { signerFirstName, signerLastName, quoteNumber, subject, signingUrl, expiresAt, tone = 'vous', nameDisplay = 'prenom' } = params
  const displayName = nameDisplay === 'prenom' ? esc(signerFirstName) : `M. ${esc(signerLastName)}`
  const isTu = tone === 'tu'

  const introText = isTu
    ? `Suite à notre échange, je te transmets notre proposition commerciale <strong style="color:#1a1a2e;">N° ${esc(quoteNumber)}</strong> concernant :`
    : `Suite à notre échange, nous avons le plaisir de vous transmettre notre proposition commerciale <strong style="color:#1a1a2e;">N° ${esc(quoteNumber)}</strong> concernant :`

  const ctaText = isTu
    ? 'Tu peux consulter le détail de cette proposition et la valider directement en ligne en cliquant sur le bouton ci-dessous.'
    : 'Vous pouvez consulter le détail de cette proposition et la valider directement en ligne en cliquant sur le bouton ci-dessous.'

  const closingText = isTu
    ? 'N\'hésite pas si tu as la moindre question.'
    : 'N\'hésitez pas à nous contacter pour toute question.'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposition commerciale ${quoteNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Gradient Header -->
          <tr>
            <td style="height:5px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);"></td>
          </tr>

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:32px 40px 20px 40px;">
              <img src="https://kameo-tool.vercel.app/kameo-logo-light.svg" alt="Agence Kameo" height="32" style="height:32px;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px 0;font-weight:600;">Proposition commerciale</h1>

              <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">
                Bonjour ${displayName},
              </p>

              <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">
                ${introText}
              </p>

              <div style="background-color:#f8f9fa;border-left:4px solid #F8903C;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 24px 0;">
                <p style="font-size:15px;color:#1a1a2e;margin:0;font-weight:600;">${esc(subject)}</p>
              </div>

              <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 28px 0;">
                ${ctaText}
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${signingUrl}" target="_blank"
                       style="display:inline-block;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                      Consulter et signer la proposition
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px;color:#444;line-height:1.6;margin:24px 0 0 0;">
                ${closingText}
              </p>

              <p style="font-size:13px;color:#888;line-height:1.5;margin:20px 0 0 0;text-align:center;">
                Ce lien est valable jusqu'au <strong>${esc(expiresAt)}</strong>.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #eee;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px 40px;text-align:center;">
              <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
                Agence Kameo — 9 rue des colonnes, Paris 75002<br>
                contact@agencekameo.fr — 06 76 23 00 37<br>
                SIRET : 980 573 984 00013
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildSignatureEmailText(params: SignatureEmailParams): string {
  const { signerFirstName, signerLastName, quoteNumber, subject, signingUrl, expiresAt, tone = 'vous', nameDisplay = 'prenom' } = params
  const displayName = nameDisplay === 'prenom' ? signerFirstName : `M. ${signerLastName}`
  const isTu = tone === 'tu'

  return `Bonjour ${displayName},

${isTu
  ? `Suite à notre échange, je te transmets notre proposition commerciale N° ${quoteNumber} concernant : ${subject}`
  : `Suite à notre échange, nous avons le plaisir de vous transmettre notre proposition commerciale N° ${quoteNumber} concernant : ${subject}`
}

${isTu
  ? 'Tu peux consulter le détail et valider en ligne :'
  : 'Vous pouvez consulter le détail et valider en ligne :'
}
${signingUrl}

${isTu ? "N'hésite pas si tu as la moindre question." : "N'hésitez pas à nous contacter pour toute question."}

Ce lien est valable jusqu'au ${expiresAt}.

---
Agence Kameo — 9 rue des colonnes, Paris 75002
contact@agencekameo.fr — 06 76 23 00 37
SIRET : 980 573 984 00013`
}

// ── Contract / Mandat signature email ──

interface ContractSignatureEmailParams {
  clientName: string
  subject: string
  type: string
  signingUrl: string
}

const TYPE_LABELS: Record<string, string> = {
  PRESTATION: 'Contrat de prestation',
  MAINTENANCE: 'Contrat de maintenance',
  ABONNEMENT: "Contrat d'abonnement",
  PARTENARIAT: 'Contrat de partenariat',
  PACK_COM: "Contrat d'abonnement — Pack de communication",
  MAINTENANCE_WEB: "Contrat d'abonnement — Maintenance web",
  FICHE_GOOGLE: "Contrat d'abonnement — Fiche Google",
  ARTICLES_BLOG: "Contrat d'abonnement — Articles de blog",
  MANDAT: 'Mandat de prélèvement',
}

export function buildContractSignatureEmailHtml(params: ContractSignatureEmailParams): string {
  const { clientName, subject, type, signingUrl } = params
  const typeLabel = TYPE_LABELS[type] || 'Contrat'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(typeLabel)}</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="height:5px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);"></td></tr>
        <tr><td align="center" style="padding:32px 40px 20px 40px;">
          <img src="https://kameo-tool.vercel.app/kameo-logo-light.svg" alt="Agence Kameo" height="32" style="height:32px;" />
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;">
          <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px 0;font-weight:600;">${esc(typeLabel)}</h1>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">Bonjour ${esc(clientName)},</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">
            Veuillez trouver ci-dessous votre ${esc(typeLabel.toLowerCase())} concernant :
          </p>
          <div style="background-color:#f8f9fa;border-left:4px solid #E14B89;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 24px 0;">
            <p style="font-size:15px;color:#1a1a2e;margin:0;font-weight:600;">${esc(subject)}</p>
          </div>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 28px 0;">
            Vous pouvez consulter et signer ce document en cliquant sur le bouton ci-dessous.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${signingUrl}" target="_blank"
               style="display:inline-block;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
              Consulter et signer
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
        <tr><td style="padding:24px 40px 32px 40px;text-align:center;">
          <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
            Agence Kameo — 9 rue des colonnes, Paris 75002<br>
            contact@agencekameo.fr — 06 76 23 00 37<br>
            SIRET : 980 573 984 00013
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// ── Maintenance invoice email ──

interface InvoiceEmailParams {
  clientName: string
  invoiceNumber: string
  amountHT: string
  amountTTC: string
  month: string
  year: number
  maintenanceType?: string
}

export function buildInvoiceEmailHtml(params: InvoiceEmailParams): string {
  const { clientName, invoiceNumber, amountHT, amountTTC, month, year, maintenanceType } = params
  const TYPE_LABELS: Record<string, string> = { WEB: 'Web', GOOGLE: 'Fiche Google', RESEAUX: 'Réseaux sociaux', BLOG: 'Blog' }
  const typeLabel = maintenanceType ? TYPE_LABELS[maintenanceType] || maintenanceType : 'Web'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Facture ${esc(invoiceNumber)}</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="height:5px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);"></td></tr>
        <tr><td align="center" style="padding:32px 40px 20px 40px;">
          <img src="https://kameo-tool.vercel.app/kameo-logo-light.svg" alt="Agence Kameo" height="32" style="height:32px;" />
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;">
          <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 8px 0;font-weight:600;">Facture de maintenance</h1>
          <div style="height:3px;width:80px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);border-radius:2px;margin:0 0 16px 0;"></div>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">Bonjour ${esc(clientName)},</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">
            Veuillez trouver ci-joint votre facture de maintenance <strong>${esc(typeLabel)}</strong> pour le mois de <strong>${esc(month)} ${year}</strong>.
          </p>
          <div style="background-color:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 24px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">N° Facture</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;text-align:right;padding:4px 0;">${esc(invoiceNumber)}</td></tr>
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">Prestation</td><td style="font-size:14px;color:#1a1a2e;text-align:right;padding:4px 0;">Maintenance ${esc(typeLabel)} — ${esc(month)} ${year}</td></tr>
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">Montant HT</td><td style="font-size:14px;color:#1a1a2e;font-weight:500;text-align:right;padding:4px 0;">${esc(amountHT)}</td></tr>
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">TVA (20%)</td><td style="font-size:14px;color:#888;text-align:right;padding:4px 0;">${esc((parseFloat(amountTTC.replace(/[^\d.,]/g, '').replace(',', '.')) - parseFloat(amountHT.replace(/[^\d.,]/g, '').replace(',', '.'))).toFixed(2))} EUR</td></tr>
              <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px;margin-top:8px;"></td></tr>
              <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;padding:4px 0;">Total TTC</td><td style="font-size:16px;color:#E14B89;font-weight:700;text-align:right;padding:4px 0;">${esc(amountTTC)}</td></tr>
            </table>
          </div>
          <div style="background-color:#f8f9fa;border-left:4px solid #E14B89;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px 0;">
            <p style="font-size:13px;color:#444;margin:0;line-height:1.6;">
              <strong>Règlement :</strong> Virement bancaire<br>
              <span style="font-family:monospace;font-size:12px;">IBAN : FR76 1310 6005 0030 0406 5882 074</span><br>
              <span style="font-family:monospace;font-size:12px;">BIC : AGRIFRPP831</span>
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
        <tr><td style="padding:24px 40px 32px 40px;text-align:center;">
          <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
            Agence Kameo — 9 rue des colonnes, Paris 75002<br>
            contact@agencekameo.fr — 06 76 23 00 37<br>
            SIRET : 980 573 984 00013 — TVA : FR54980573984
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
