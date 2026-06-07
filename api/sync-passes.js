// api/sync-passes.js
// Vercel cron function — runs hourly, polls Phorest for new clients,
// generates a personalised wallet pass and emails it to each new client.
//
// Cron schedule: 0 * * * *  (top of every hour)
// Trigger:       GET /api/sync-passes  (Vercel invokes automatically)

import { buildPassTemplate } from "../lib/pass-template.js";
import { loadCertificates }  from "../lib/certificates.js";
import { PKPass }            from "passkit-generator";
import { readFileSync }      from "fs";
import { join }              from "path";

const PHOREST_BASE = "https://platform.phorest.com/third-party-api-server/api/business";

// ── Phorest helpers ───────────────────────────────────────────────────────────

function phorestAuth() {
  const user = process.env.PHOREST_USERNAME;
  const pass = process.env.PHOREST_PASSWORD;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function fetchNewClients(sinceISO) {
  const bizId   = process.env.PHOREST_BUSINESS_ID;
  const url     = `${PHOREST_BASE}/${bizId}/client?updatedAt=${sinceISO}&page=0&size=100`;
  const res     = await fetch(url, { headers: { Authorization: phorestAuth(), Accept: "application/json" } });
  if (!res.ok) throw new Error(`Phorest client fetch failed: ${res.status}`);
  const data    = await res.json();
  return data?._embedded?.clients ?? [];
}

// ── Pass generation ───────────────────────────────────────────────────────────

function loadPassImages() {
  const dir  = join(process.cwd(), "assets", "pass");
  const load = (f) => {
    try { return readFileSync(join(dir, f)); } catch {
      return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
    }
  };
  return {
    "icon.png":    load("icon.png"),
    "icon@2x.png": load("icon@2x.png"),
    "icon@3x.png": load("icon@3x.png"),
    "logo.png":    load("logo.png"),
    "logo@2x.png": load("logo@2x.png"),
  };
}

async function generatePassBuffer(client) {
  const certificates = loadCertificates();
  const passJson     = buildPassTemplate({
    serialNumber: `treasury-${client.clientId}-${Date.now()}`,
    targetUrl:    process.env.PASS_TARGET_URL || "https://treasuryhealth.ca",
    memberName:   `${client.firstName} ${client.lastName}`.trim() || null,
  });

  const pass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(passJson, null, 2)), ...loadPassImages() },
    certificates
  );
  return pass.getAsBuffer();
}

// ── Resend email delivery ─────────────────────────────────────────────────────

async function sendPassEmail(client) {
  const firstName = client.firstName || "there";
  const email     = client.email;
  if (!email) return { skipped: true, reason: "no email" };

  const baseUrl  = process.env.PASS_BASE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const passUrl  = `${baseUrl}/api/generate-pass?member=${encodeURIComponent(`${client.firstName} ${client.lastName}`.trim())}`;

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    process.env.RESEND_FROM_EMAIL || "Treasury Aesthetics <hello@treasuryaesthetics.ca>",
      to:      [email],
      subject: "Your Treasury Aesthetics Loyalty Pass",
      html:    buildEmailHtml(firstName, passUrl),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend failed for ${email}: ${err}`);
  }
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
      <a href="${passUrl}" style="display:inline-block;text-decoration:none;">
        <img
          src="https://apple-wallet-badge.vercel.app/en_US/add-to-apple-wallet.svg"
          alt="Add to Apple Wallet"
          width="160"
          height="52"
          style="display:block;border:0;"
        />
      </a>
      <p style="color:rgba(245,240,232,0.35);font-size:11px;margin:20px 0 0;">
        Open this email on your iPhone for the best experience.
      </p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:32px;">
      <p style="color:rgba(245,240,232,0.3);font-size:11px;letter-spacing:0.3px;margin:0;">
        Physician-led medical aesthetics · Toronto, ON<br>
        <a href="https://treasuryhealth.ca" style="color:#C9A55A;">treasuryhealth.ca</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── State tracking via Vercel KV ──────────────────────────────────────────────
// Uses SENT_PASS_IDS env var as a simple comma-separated list of client IDs
// that have already received a pass. For larger volumes, swap for Vercel KV.

function getSentIds() {
  return new Set((process.env.SENT_PASS_IDS || "").split(",").filter(Boolean));
}

async function markSent(clientId, token, projectId, teamId) {
  const current = process.env.SENT_PASS_IDS || "";
  const updated = current ? `${current},${clientId}` : clientId;

  await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}&upsert=true`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        key:    "SENT_PASS_IDS",
        value:  updated,
        type:   "encrypted",
        target: ["production", "preview", "development"],
      }),
    }
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Allow Vercel cron or manual GET trigger
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers["authorization"] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sinceHours = parseInt(req.query.hours || "1", 10);
  const since      = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  try {
    const clients = await fetchNewClients(since);
    const sentIds = getSentIds();

    const results = { sent: [], skipped: [], errors: [] };

    for (const client of clients) {
      const id = client.clientId;
      if (sentIds.has(id)) { results.skipped.push({ id, reason: "already sent" }); continue; }
      if (!client.email)   { results.skipped.push({ id, reason: "no email" });     continue; }

      try {
        await sendPassEmail(client);
        await markSent(id, process.env.VERCEL_TOKEN, process.env.VERCEL_PROJECT_ID, process.env.VERCEL_TEAM_ID);
        results.sent.push({ id, name: `${client.firstName} ${client.lastName}`, email: client.email });
      } catch (err) {
        results.errors.push({ id, error: err.message });
      }
    }

    console.log("[Treasury Wallet] Sync complete:", results);
    return res.status(200).json({ since, total: clients.length, ...results });

  } catch (err) {
    console.error("[Treasury Wallet] Sync failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
