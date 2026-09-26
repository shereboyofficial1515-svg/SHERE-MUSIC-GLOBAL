/**
 * Branded, table-based HTML emails (the layout most email clients render reliably).
 * All dynamic values are escaped.
 */
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const COLORS = { bg: '#0b0f17', card: '#121826', text: '#e6eaf2', muted: '#9aa4b8', sky: '#38bdf8', gold: '#f5b942' };

function layout({ siteName, preheader, heading, paragraphs, cta, notice }) {
  const brand = escapeHtml(siteName);
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">${p}</p>`).join('');
  const button = cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="border-radius:999px;background:${COLORS.sky};">
         <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#04121c;text-decoration:none;border-radius:999px;">${escapeHtml(cta.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:${COLORS.muted};">If the button does not work, copy this link into your browser:<br><a href="${escapeHtml(cta.url)}" style="color:${COLORS.sky};word-break:break-all;">${escapeHtml(cta.url)}</a></p>`
    : '';
  const security = notice
    ? `<div style="margin-top:8px;padding:14px 16px;border-left:3px solid ${COLORS.gold};background:#0f1522;border-radius:6px;font-size:13px;line-height:1.6;color:${COLORS.muted};">${notice}</div>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:32px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
    <tr><td style="padding:0 8px 20px;">
      <span style="font-size:20px;font-weight:800;letter-spacing:2px;color:#ffffff;">${brand.replace(/MUSIC$/, `<span style="color:${COLORS.gold};">MUSIC</span>`)}</span>
    </td></tr>
    <tr><td style="background:${COLORS.card};border-radius:16px;padding:32px 28px;border:1px solid #1f2937;">
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#ffffff;">${escapeHtml(heading)}</h1>
      ${body}${button}${security}
    </td></tr>
    <tr><td style="padding:20px 8px;font-size:12px;line-height:1.6;color:${COLORS.muted};text-align:center;">
      ${brand} &middot; Discover music. Stream music. Download music.<br>
      You are receiving this email because of activity on your ${brand} account.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const textVersion = (lines) => lines.filter(Boolean).join('\n\n');

export function verificationEmail({ siteName, name, url }) {
  return {
    subject: `Verify your ${siteName} account`,
    html: layout({
      siteName,
      preheader: 'Confirm your email address to start listening.',
      heading: 'Confirm your email address',
      paragraphs: [
        `Hi ${escapeHtml(name)},`,
        `Welcome to ${escapeHtml(siteName)}. Please confirm your email address to activate your account. This link expires in 24 hours.`,
      ],
      cta: { label: 'Verify email address', url },
      notice: `If you did not create a ${escapeHtml(siteName)} account, you can safely ignore this email.`,
    }),
    text: textVersion([`Hi ${name},`, `Confirm your ${siteName} email address (link expires in 24 hours):`, url, 'If you did not sign up, ignore this email.']),
  };
}

export function passwordResetEmail({ siteName, name, url }) {
  return {
    subject: `Reset your ${siteName} password`,
    html: layout({
      siteName,
      preheader: 'Use this link to choose a new password.',
      heading: 'Reset your password',
      paragraphs: [
        `Hi ${escapeHtml(name)},`,
        'We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour and can only be used once.',
      ],
      cta: { label: 'Reset password', url },
      notice: 'If you did not request a password reset, ignore this email — your password will not change. For your security, never share this link.',
    }),
    text: textVersion([`Hi ${name},`, 'Reset your password using this link (expires in 1 hour):', url, 'If you did not request this, ignore this email.']),
  };
}

export function accountNotificationEmail({ siteName, name, heading, message, cta }) {
  return {
    subject: `${heading} — ${siteName}`,
    html: layout({
      siteName,
      preheader: message,
      heading,
      paragraphs: [`Hi ${escapeHtml(name)},`, escapeHtml(message)],
      cta,
      notice: `If you did not expect this change, please reset your password immediately${cta ? '' : ' or contact support'}.`,
    }),
    text: textVersion([`Hi ${name},`, message, cta?.url]),
  };
}
