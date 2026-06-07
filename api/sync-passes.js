// api/sync-passes.js
// Polls Phorest for clients, generates personalised wallet passes, emails them.
// Triggered by: manual admin panel, or Vercel cron (when re-enabled in vercel.json).
//
// Auth:
//   Manual trigger  — Authorization: Bearer {CRON_SECRET}  (always allowed)
//   Cron trigger    — must also have SYNC_ENABLED=true in Vercel env vars

import { getSentIds, markSent }  from "../lib/kv.js";
import { generatePassBuffer }     from "../lib/generate-pass-buffer.js";

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

  const passBuffer = await generatePassBuffer(`${client.firstName} ${client.lastName}`.trim());

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
      html:    buildEmailHtml(firstName),
      attachments: [
        {
          filename:     "treasury-pass.pkpass",
          content:      passBuffer.toString("base64"),
          content_type: "application/vnd.apple.pkpass",
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Resend failed for ${client.email}: ${await res.text()}`);
  return { sent: true };
}

function buildEmailHtml(firstName) {
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
        Welcome to Treasury Aesthetics. Your personalised loyalty pass is attached to this email — tap it to add it directly to Apple Wallet.
      </p>
      <p style="color:rgba(245,240,232,0.5);font-size:12px;margin:0;">
        Look for <strong style="color:#C9A55A;">treasury-pass.pkpass</strong> below this message.
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
