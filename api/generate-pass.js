// api/generate-pass.js
// GET /api/generate-pass?member=Jane+Smith[&referral=ABC-12345&slug=jane-smith]
// Returns a signed .pkpass (application/vnd.apple.pkpass).
// On iOS, the MIME type triggers the native "Add to Wallet" sheet.
// referral + slug personalise the pass identically to the emailed one, so the
// request-pass page's "Add to Wallet now" button downloads the same pass.

import { generatePassBuffer } from "../lib/generate-pass-buffer.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://treasuryaesthetics.ca");

  try {
    const memberName = req.query.member ? decodeURIComponent(req.query.member) : null;
    const referralCode = typeof req.query.referral === "string" ? req.query.referral.trim().slice(0, 40) : null;
    // Slug is interpolated into the plan-page URL — allow only slug characters
    const slug = typeof req.query.slug === "string" && /^[a-z0-9-]{1,80}$/.test(req.query.slug) ? req.query.slug : null;
    const planUrl = slug ? `https://www.treasuryaesthetics.ca/${slug}` : null;
    const pkpassBuffer = await generatePassBuffer({ memberName, referralCode, planUrl });

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
