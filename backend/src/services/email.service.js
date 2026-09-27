import { Resend } from 'resend';
import { env } from '../config/env.js';
import { getSettings } from './settings.service.js';
import { accountNotificationEmail, changeEmailEmail, passwordResetEmail, verificationEmail } from './emailTemplates.js';

const resend = env.resend.apiKey ? new Resend(env.resend.apiKey) : null;

async function send(to, { subject, html, text }) {
  if (!resend) {
    // Development fallback only (production refuses to start without RESEND_API_KEY).
    console.log(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n${text}\n`);
    return;
  }
  const { error } = await resend.emails.send({ from: env.resend.from, to, subject, html, text });
  if (error) throw new Error(`Resend error: ${error.message || error.name}`);
}

/** Fire-and-log wrapper for emails that must not fail the request that triggered them. */
async function sendSafely(to, message) {
  try {
    await send(to, message);
  } catch (err) {
    console.error(`[email] Failed to send "${message.subject}" to ${to}:`, err.message);
  }
}

const link = (path, token) => `${env.frontendUrl}${path}?token=${encodeURIComponent(token)}`;

export async function sendVerificationEmail(user, token) {
  const { site_name: siteName } = await getSettings();
  await send(user.email, verificationEmail({ siteName, name: user.name, url: link('/verify-email', token) }));
}

export async function sendPasswordResetEmail(user, token) {
  const { site_name: siteName } = await getSettings();
  await send(user.email, passwordResetEmail({ siteName, name: user.name, url: link('/reset-password', token) }));
}

export async function sendAccountNotification(user, { heading, message, withLoginLink = false }) {
  const { site_name: siteName } = await getSettings();
  const cta = withLoginLink ? { label: `Open ${siteName}`, url: `${env.frontendUrl}/login` } : undefined;
  await sendSafely(user.email, accountNotificationEmail({ siteName, name: user.name, heading, message, cta }));
}

/** Confirm an email change: the link goes to the NEW address. */
export async function sendEmailChangeConfirmation(user, newEmail, token) {
  const { site_name: siteName } = await getSettings();
  await send(newEmail, changeEmailEmail({ siteName, name: user.name, newEmail, url: link('/confirm-email', token) }));
}

/** Send many emails (Resend batch API, 100 per request). Failures are logged. */
export async function sendBatch(messages) {
  if (!messages.length) return;
  if (!resend) {
    for (const m of messages) console.log(`\n[email:dev] To: ${m.to}\n[email:dev] Subject: ${m.subject}\n${m.text}\n`);
    return;
  }
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map(({ to, subject, html, text }) => ({ from: env.resend.from, to, subject, html, text }));
    const { error } = await resend.batch.send(chunk);
    if (error) console.error('[email] Batch send failed:', error.message || error.name);
  }
}
