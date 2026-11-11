import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { logEvent } from '@/lib/log';

export type EmailResult = { sent: boolean; reason?: string };

/**
 * Sends through Resend. Without RESEND_API_KEY it does NOT fail: in development it writes the rendered
 * email to ./.outbox so you can open it in a browser, and in production it logs and returns.
 * Email problems must never block or roll back a payment, so this never throws.
 */
export async function sendEmail(o: { to: string; subject: string; react: ReactElement; tag: string }): Promise<EmailResult> {
  try {
    const html = await render(o.react);
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      if (process.env.NODE_ENV !== 'production') {
        const dir = path.join(process.cwd(), '.outbox');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, `${Date.now()}-${o.tag}-${o.to.replace(/[^a-z0-9@.]/gi, '_')}.html`), `<!-- to: ${o.to} | subject: ${o.subject} -->\n${html}`);
      }
      logEvent('email.skipped', { tag: o.tag, reason: 'RESEND_API_KEY not set' });
      return { sent: false, reason: 'not_configured' };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'Pemart <onboarding@resend.dev>', to: [o.to], subject: o.subject, html, tags: [{ name: 'type', value: o.tag }] }),
    });
    if (!res.ok) { logEvent('email.failed', { tag: o.tag, status: res.status }); return { sent: false, reason: `status_${res.status}` }; }
    logEvent('email.sent', { tag: o.tag });
    return { sent: true };
  } catch (e) {
    logEvent('email.error', { tag: o.tag, error: (e as Error).message });
    return { sent: false, reason: 'error' };
  }
}
