// api/sync-passes.js
// Polls Phorest for clients, generates personalised wallet passes, emails them.
// Triggered by: manual admin panel, or Vercel cron (when re-enabled in vercel.json).
//
// Auth:
//   Manual trigger  — Authorization: Bearer {CRON_SECRET}  (always allowed)
//   Cron trigger    — must also have SYNC_ENABLED=true in Vercel env vars

import { getSentIds, markSent } from "../lib/kv.js";
import { buildPassTemplate }    from "../lib/pass-template.js";

const PHOREST_BASE = "https://platform.phorest.com/third-party-api-server/api/business";

// ── Phorest ───────────────────────────────────────────────────────────────────

function phorestAuth() {
  return "Basic " + Buffer.from(
    `${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`
  ).toString("base64");
}

async function fetchClients(sinceISO) {
  const bizId = encodeURIComponent(process.env.PHOREST_BUSINESS_ID);
  const url   = `${PHOREST_BASE}/${bizId}/client?updatedAt=${sinceISO}&page=0&size=200`;
  const res   = await fetch(url, {
    headers: { Authorization: phorestAuth(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Phorest fetch failed: ${res.status}`);
  const data  = await res.json();
  return data?._embedded?.clients ?? [];
}

// ── Email delivery ────────────────────────────────────────────────────────────

async function sendPassEmail(client) {
  const firstName = client.firstName || "there";
  if (!client.email) return { skipped: true, reason: "no email" };

  const base    = process.env.PASS_BASE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const passUrl = `${base}/api/generate-pass?member=${encodeURIComponent(`${client.firstName} ${client.lastName}`.trim())}`;

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    process.env.RESEND_FROM_EMAIL || "Treasury Aesthetics <hello@treasuryaesthetics.ca>",
      to:      [client.email],
      subject: "Your Treasury Aesthetics Loyalty Pass",
      html:    buildEmailHtml(firstName, passUrl),
    }),
  });

  if (!res.ok) throw new Error(`Resend failed for ${client.email}: ${await res.text()}`);
  return { sent: true };
}

function buildEmailHtml(firstName, passUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#161614;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;padding:40px 20px;">
    <tr><td style="text-align:center;padding-bottom:8px;">
      <p style="font-size:10px;letter-spacing:4px;color:#C9A55A;margin:0;">TREASURY AESTHETICS</p>
    </td></tr>
    <tr><td style="text-align:center;padding-bottom:32px;">
      <h1 style="font-size:28px;font-weight:400;color:#F5F0E8;margin:8px 0;">Your Loyalty Pass<br>is Ready</h1>
      <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,#C9A55A,transparent);margin:16px auto;"></div>
    </td></tr>
    <tr><td style="background:#1E1E1C;border-radius:16px;border:1px solid rgba(201,165,90,0.2);padding:32px;text-align:center;">
      <p style="color:#F5F0E8;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Hi ${firstName},<br><br>
        Welcome to Treasury Aesthetics. Tap the button below on your iPhone to add your personalised loyalty pass directly to Apple Wallet.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:#000000;border-radius:10px;border:1px solid rgba(201,165,90,0.5);">
            <a href="${passUrl}" style="display:block;padding:11px 18px;text-decoration:none;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:9px;vertical-align:middle;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="22" viewBox="0 0 814 1000">
                      <path fill="#fff" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-103.4C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.5 269-317.5 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49.1 188.8-49.1 30.5.1 111.9 2.9 166.8 72.3zm-256.6-166.5c31.4-37.9 53.5-90.8 53.5-143.7 0-7.3-.6-14.6-1.9-21.2-50.7 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 137.2 0 8.2 1.4 16.4 1.9 19.2 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.1-68.6z"/>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:10px;color:#ffffff;letter-spacing:0.4px;line-height:1.2;">Add to</span>
                    <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:17px;font-weight:600;color:#ffffff;white-space:nowrap;line-height:1.3;">Apple Wallet</span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
      </table>
      <p style="color:rgba(245,240,232,0.35);font-size:11px;margin:20px 0 0;">
        Open this email on your iPhone for the best experience.
      </p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:32px;">
      <p style="color:rgba(245,240,232,0.3);font-size:11px;letter-spacing:0.3px;margin:0;">
        Physician-led medical aesthetics · Toronto, ON<br>
        <a href="https://treasuryaesthetics.ca" style="color:#C9A55A;">treasuryaesthetics.ca</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const secret       = process.env.CRON_SECRET;
  const hasValidAuth = secret && req.headers["authorization"] === `Bearer ${secret}`;
  const cronEnabled  = process.env.SYNC_ENABLED === "true";

  // Manual admin trigger (valid secret) always allowed.
  // Cron trigger (no auth header) only allowed when SYNC_ENABLED=true.
  if (!hasValidAuth && !cronEnabled) {
    return res.status(403).json({
      error: "Not authorized. Use the admin panel or set SYNC_ENABLED=true for cron.",
    });
  }

  // Look back further on manual triggers so the admin catches any gaps
  const defaultHours = hasValidAuth ? 720 : 1; // 30 days manual, 1 hour cron
  const sinceHours   = parseInt(req.query.hours ?? defaultHours, 10);
  const since        = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  try {
    const [clients, sentIds] = await Promise.all([fetchClients(since), getSentIds()]);
    const results = { sent: [], skipped: [], errors: [] };

    for (const client of clients) {
      const id = client.clientId;

      if (sentIds.has(id)) {
        results.skipped.push({ id, name: `${client.firstName} ${client.lastName}`, reason: "already sent" });
        continue;
      }
      if (!client.email) {
        results.skipped.push({ id, name: `${client.firstName} ${client.lastName}`, reason: "no email" });
        continue;
      }

      try {
        await sendPassEmail(client);
        await markSent(id);
        sentIds.add(id); // prevent duplicates within a single run
        results.sent.push({ id, name: `${client.firstName} ${client.lastName}`, email: client.email });
      } catch (err) {
        results.errors.push({ id, name: `${client.firstName} ${client.lastName}`, error: err.message });
      }
    }

    console.log("[Treasury Wallet] Sync complete:", results);
    return res.status(200).json({ since, sinceHours, total: clients.length, ...results });

  } catch (err) {
    console.error("[Treasury Wallet] Sync failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
