import dotenv from 'dotenv';

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Werkethiek.nl <noreply@werkethiek.nl>';

export async function sendResetEmail(to, resetUrl) {
  if (!RESEND_API_KEY) {
    // Fallback until an API key is configured: the link is still usable by
    // pulling it out of the backend logs (docker logs kanban-backend-1).
    console.log(`[mail] RESEND_API_KEY not set — password reset link for ${to}: ${resetUrl}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: 'Reset your Werkethiek.nl password',
        text: `Hi,\n\nSomeone requested a password reset for your Werkethiek.nl account.\n\nOpen this link to choose a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.\n`,
        html: `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:420px;color:#171717">
            <h2 style="font-size:18px;font-weight:600;letter-spacing:-0.02em">Reset your password</h2>
            <p style="font-size:14px;color:#525252">Someone requested a password reset for your Werkethiek.nl account. This link is valid for 1 hour.</p>
            <p><a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#171717;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Choose a new password</a></p>
            <p style="font-size:12px;color:#a3a3a3">If you didn't request this, you can ignore this email.</p>
          </div>`
      })
    });
    if (!res.ok) {
      console.error('[mail] Resend failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('[mail] Failed to send reset email', err);
  }
}
