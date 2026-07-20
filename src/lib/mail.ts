// Gmail SMTP transport for transactional mail (welcome + admin signup notify).
// Credentials: GMAIL_USER + GMAIL_APP_PASSWORD (Google App Password, not the
// account password). When either is missing, senders no-op and return false.

import nodemailer from "nodemailer";

function transport() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) return null;
  return {
    user,
    transporter: nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    }),
  };
}

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.HEROKU_APP_DEFAULT_DOMAIN_NAME) {
    return `https://${process.env.HEROKU_APP_DEFAULT_DOMAIN_NAME}`;
  }
  return "https://micromanus-sid-8b56d69b5666.herokuapp.com";
}

export async function sendWelcomeEmail(to: string, name?: string | null): Promise<boolean> {
  const t = transport();
  if (!t || !to) return false;
  const first = (name || "").split(" ")[0] || "there";
  const url = appUrl();
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#09090b;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#09090b;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:32px;">
        <tr><td>
          <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#818cf8;font-family:ui-monospace,monospace;">MicroManus</div>
          <h1 style="margin:12px 0 8px;font-size:24px;font-weight:500;color:#fafafa;">Welcome, ${escapeHtml(first)}</h1>
          <p style="margin:0 0 16px;color:#a1a1aa;font-size:15px;line-height:1.55;">
            You just joined a deep-research agent that searches the web, reads sources,
            and can write PDF reports — running on <strong style="color:#fafafa;">your</strong> OpenAI-compatible key.
          </p>
          <ol style="margin:0 0 20px;padding-left:18px;color:#a1a1aa;font-size:14px;line-height:1.6;">
            <li>Unlock with coupon <code style="color:#fbbf24;">SID_DRDROID</code> or a card payment (5 credits).</li>
            <li>Add your API key + model under Settings.</li>
            <li>Ask a research question — watch the think → search → read loop, download the PDF.</li>
          </ol>
          <a href="${url}/chat" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:500;">
            Open MicroManus
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#71717a;font-family:ui-monospace,monospace;">
            1 credit = 1 full research run · bring your own key · no preloaded secrets
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Welcome to MicroManus, ${first}!

Unlock with coupon SID_DRDROID (or card payment) for 5 credits, add your API key in Settings, then start researching.

${url}/chat
`;

  try {
    await t.transporter.sendMail({
      from: `"MicroManus" <${t.user}>`,
      to,
      subject: "Welcome to MicroManus — your research agent is ready",
      text,
      html,
    });
    return true;
  } catch (e) {
    console.error("[mail] welcome failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function sendAdminSignupNotify(email: string): Promise<boolean> {
  const t = transport();
  const admin = process.env.ADMIN_NOTIFY_EMAIL?.trim() || t?.user;
  if (!t || !admin || !email) return false;
  try {
    await t.transporter.sendMail({
      from: `"MicroManus" <${t.user}>`,
      to: admin,
      subject: `[MicroManus] New signup: ${email}`,
      text: `New user signed up.\n\nEmail: ${email}\nTime: ${new Date().toISOString()}\n`,
      html: `<p><strong>New MicroManus signup</strong></p><p>Email: ${escapeHtml(email)}</p><p style="color:#71717a;font-size:12px;">${new Date().toISOString()}</p>`,
    });
    return true;
  } catch (e) {
    console.error("[mail] admin notify failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
