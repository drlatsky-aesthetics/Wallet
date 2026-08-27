// api/pass-url.js
// Coordination endpoint: records each patient's private patient-page URL so
// their wallet pass links to it (and refreshes to it when it changes).
//
//   GET                                → { urls: { clientId: url } }
//   POST { clientId, url }             → set (url null/"" clears)
//   POST { email, url }                → resolve the Phorest client by email, then set
//   POST { fromUrl, toUrl }            → rewrite every stored URL equal to fromUrl
//                                        (used when a patient renames their page;
//                                        toUrl null/"" clears instead)
//
// Called by the Treasury agent (plan link emailed / patient renamed their
// page) and by the admin panel. Auth: Bearer PASS_SYNC_SECRET (falls back to
// CRON_SECRET so no new config is strictly required).
//
// PHIPA note: nothing patient-identifying is logged here — no emails, names,
// or URLs (a plan URL is itself a patient identifier once linkable).

import { setPlanUrl, listPlanUrls, movePlanUrl } from "../lib/pass-store.js";

const PHOREST_BASE = "https://platform.phorest.com/third-party-api-server/api/business";

function phorestAuth() {
  return "Basic " + Buffer.from(
    `${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`
  ).toString("base64");
}

async function findClientIdByEmail(email) {
  const bizId = encodeURIComponent(process.env.PHOREST_BUSINESS_ID);
  const url = `${PHOREST_BASE}/${bizId}/client?email=${encodeURIComponent(email)}&size=20`;
  const res = await fetch(url, {
    headers: { Authorization: phorestAuth(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Phorest lookup failed: ${res.status}`);
  const data = await res.json();
  const clients = data?._embedded?.clients ?? [];
  const wanted = email.toLowerCase();
  const match = clients.find((c) => (c.email ?? "").toLowerCase() === wanted) ?? clients[0] ?? null;
  return match?.clientId ?? null;
}

function validUrl(u) {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const secret = process.env.PASS_SYNC_SECRET || process.env.CRON_SECRET;
  if (!secret || req.headers["authorization"] !== `Bearer ${secret}`) {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ urls: await listPlanUrls() });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body ?? {};

    // Rewrite by URL — no PHI needed at all (used on patient slug renames)
    if (body.fromUrl) {
      if (!validUrl(body.fromUrl) || (body.toUrl && !validUrl(body.toUrl))) {
        return res.status(400).json({ error: "fromUrl/toUrl must be https URLs" });
      }
      const moved = await movePlanUrl(body.fromUrl, body.toUrl || null);
      return res.status(200).json({ ok: true, updated: moved.length });
    }

    const url = body.url ? String(body.url).trim() : null;
    if (url && !validUrl(url)) {
      return res.status(400).json({ error: "url must be an https URL" });
    }

    let clientId = body.clientId ? String(body.clientId).trim() : null;
    if (!clientId && body.email) {
      const email = String(body.email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.status(400).json({ error: "Invalid email" });
      }
      clientId = await findClientIdByEmail(email);
      if (!clientId) {
        return res.status(404).json({ error: "No Phorest client found for that email" });
      }
    }
    if (!clientId) {
      return res.status(400).json({ error: "Provide clientId, email, or fromUrl/toUrl" });
    }

    const ok = await setPlanUrl(clientId, url);
    if (!ok) {
      return res.status(503).json({ error: "KV is not configured — pass links can't be stored" });
    }
    return res.status(200).json({ ok: true, clientId, cleared: !url });
  } catch (err) {
    console.error("[Treasury Wallet] pass-url failed:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
