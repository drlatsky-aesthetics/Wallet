// api/generate-pass.js
// GET /api/generate-pass?member=Jane+Smith[&referral=ABC-12345&slug=jane-smith&cid=<clientId>]
// Returns a signed .pkpass (application/vnd.apple.pkpass).
// On iOS, the MIME type triggers the native "Add to Wallet" sheet.
//
// With cid, the pass is built from LIVE Phorest data — current name and
// membership tier (client categories: Vault/Reserve → gold/silver coin) —
// and carries a self-refresh link on its back pointing at this same URL,
// so "Refresh My Pass" always pulls the latest demographics and tier.
// Same clientId → same serial → Wallet replaces the pass in place.

import { generatePassBuffer } from "../lib/generate-pass-buffer.js";
import { getClient, clientTier } from "../lib/phorest.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://treasuryaesthetics.ca");

  try {
    let memberName = req.query.member ? decodeURIComponent(req.query.member) : null;
    const referralCode = typeof req.query.referral === "string" ? req.query.referral.trim().slice(0, 40) : null;
    // Slug is interpolated into the plan-page URL — allow only slug characters
    const slug = typeof req.query.slug === "string" && /^[a-z0-9-]{1,80}$/.test(req.query.slug) ? req.query.slug : null;
    const planUrl = slug ? `https://plans.treasuryaesthetics.ca/${slug}` : null;
    const clientId = typeof req.query.cid === "string" && /^[\w=-]{1,64}$/.test(req.query.cid) ? req.query.cid : null;

    // Live Phorest lookup: freshest name + membership tier
    let membershipTier = "standard";
    let refreshUrl = null;
    if (clientId) {
      const client = await getClient(clientId);
      if (client) {
        const fresh = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
        if (fresh) memberName = fresh;
        membershipTier = await clientTier(client);
      }
      const qs = new URLSearchParams({ cid: clientId });
      if (referralCode) qs.set("referral", referralCode);
      if (slug) qs.set("slug", slug);
      refreshUrl = `https://${req.headers.host}/api/generate-pass?${qs.toString()}`;
    }

    const pkpassBuffer = await generatePassBuffer({ memberName, referralCode, planUrl, clientId, membershipTier, refreshUrl });

    res.setHeader("Content-Type",   "application/vnd.apple.pkpass");
    res.setHeader("Content-Length", pkpassBuffer.length);
    res.setHeader("Cache-Control",  "no-store");
    // NOTE: no Content-Disposition — breaks iOS Wallet routing in WKWebView

    return res.status(200).send(pkpassBuffer);
  } catch (error) {
    console.error("[Treasury Wallet] PKPass generation failed:", error);
    const isCertError = error.message?.includes("environment variables");
    return res.status(isCertError ? 503 : 500).json({
      error:   isCertError ? "Pass service not configured" : "Failed to generate pass",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
