import { Resend } from 'resend';
import { env } from '../config/env.js';
import { getSettings } from './settings.service.js';
import { accountNotificationEmail, passwordResetEmail, verificationEmail } from './emailTemplates.js';

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
