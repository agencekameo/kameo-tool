import 'dotenv/config'
import nodemailer from 'nodemailer'

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function formatCurrency(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u202F/g, ' ')
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const now = new Date()
const month = MONTH_NAMES[now.getMonth()]
const year = now.getFullYear()
const clientName = 'Andrea Production'
const maintenanceType = 'WEB'
const typeLabel = 'Web'
const amountHT = 89
const amountTTC = amountHT * 1.2
const invoiceNumber = `FAC-TEST-${year}${String(now.getMonth() + 1).padStart(2, '0')}-001`

const html = `<!DOCTYPE html>
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
          <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px 0;font-weight:600;">Facture de maintenance</h1>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">Bonjour ${esc(clientName)},</p>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">
            Veuillez trouver ci-dessous votre facture de maintenance <strong>${esc(typeLabel)}</strong> pour le mois de <strong>${esc(month)} ${year}</strong>.
          </p>
          <div style="background-color:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 24px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">N° Facture</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;text-align:right;padding:4px 0;">${esc(invoiceNumber)}</td></tr>
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">Prestation</td><td style="font-size:14px;color:#1a1a2e;text-align:right;padding:4px 0;">Maintenance ${esc(typeLabel)} — ${esc(month)} ${year}</td></tr>
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">Montant HT</td><td style="font-size:14px;color:#1a1a2e;font-weight:500;text-align:right;padding:4px 0;">${esc(formatCurrency(amountHT))}</td></tr>
              <tr><td style="font-size:13px;color:#888;padding:4px 0;">TVA (20%)</td><td style="font-size:14px;color:#888;text-align:right;padding:4px 0;">${(amountTTC - amountHT).toFixed(2)} EUR</td></tr>
              <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px;margin-top:8px;"></td></tr>
              <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;padding:4px 0;">Total TTC</td><td style="font-size:16px;color:#E14B89;font-weight:700;text-align:right;padding:4px 0;">${esc(formatCurrency(amountTTC))}</td></tr>
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

const gmailUser = process.env.GMAIL_USER
const gmailPass = process.env.GMAIL_APP_PASSWORD

if (!gmailUser || !gmailPass) {
  console.error('GMAIL_USER ou GMAIL_APP_PASSWORD manquant dans .env.local')
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: gmailUser, pass: gmailPass },
})

try {
  await transporter.sendMail({
    from: `"Agence Kameo" <${gmailUser}>`,
    to: 'contact@agence-kameo.fr',
    subject: `[TEST] Facture maintenance ${typeLabel} — ${month} ${year} — ${clientName}`,
    html,
  })
  console.log('Facture test envoyée à contact@agence-kameo.fr')
} catch (err) {
  console.error('Erreur envoi:', err.message)
}
