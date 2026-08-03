// api/generate-pass.js
// GET /api/generate-pass?member=Jane+Smith
// Returns a signed .pkpass (application/vnd.apple.pkpass).
// On iOS, the MIME type triggers the native "Add to Wallet" sheet.

import { generatePassBuffer } from "../lib/generate-pass-buffer.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://treasuryaesthetics.ca");

  try {
    const memberName = req.query.member ? decodeURIComponent(req.query.member) : null;
    const pkpassBuffer = await generatePassBuffer({ memberName });

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
