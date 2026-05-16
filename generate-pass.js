// api/generate-pass.js
// ─────────────────────────────────────────────────────────────────────────────
// Vercel serverless function — generates and returns a signed .pkpass file.
//
// GET  /api/generate-pass
//   → Returns application/vnd.apple.pkpass  (triggers iOS Wallet prompt)
//
// GET  /api/generate-pass?member=Jane+Smith
//   → Personalises the pass with the member's name (optional)
//
// Deployment: Vercel (Node 18+, ESM)
// Package:    passkit-generator ^3.2.0
// ─────────────────────────────────────────────────────────────────────────────

import { PKPass }           from "passkit-generator";
import { readFileSync }     from "fs";
import { join }             from "path";
import { loadCertificates } from "../lib/certificates.js";
import { buildPassTemplate } from "../lib/pass-template.js";

// ── Pass image assets ─────────────────────────────────────────────────────────
// Required files in /assets/pass/ — see README.md for exact specs.
// Generate them by running: npm run generate-images
function loadPassImages() {
  const assetsDir = join(process.cwd(), "assets", "pass");
  const load = (filename) => {
    try {
      return readFileSync(join(assetsDir, filename));
    } catch {
      // Return a 1x1 transparent PNG as fallback so the pass still generates
      // during development before real brand assets are ready.
      // Replace with actual brand assets before production deployment.
      return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
    }
  };

  return {
    "icon.png":      load("icon.png"),
    "icon@2x.png":   load("icon@2x.png"),
    "icon@3x.png":   load("icon@3x.png"),
    "logo.png":      load("logo.png"),
    "logo@2x.png":   load("logo@2x.png"),
    // Optional — charcoal strip image behind QR code area
    // "strip.png":  load("strip.png"),
    // "strip@2x.png": load("strip@2x.png"),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {

  // Only GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional CORS for web-based "Add to Wallet" flows
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://treasuryhealth.ca");

  try {
    // 1 ── Load certificates from Vercel env vars
    const certificates = loadCertificates();

    // 2 ── Build the pass.json payload
    const passJson = buildPassTemplate({
      serialNumber: `treasury-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      targetUrl:    process.env.PASS_TARGET_URL || "https://treasuryhealth.ca",
      memberName:   req.query.member ? decodeURIComponent(req.query.member) : null,
    });

    // 3 ── Load pass image assets
    const images = loadPassImages();

    // 4 ── Assemble and sign the PKPass
    //      PKPass constructor: (bufferMap, certificates, overrides?)
    const pass = new PKPass(
      {
        "pass.json": Buffer.from(JSON.stringify(passJson, null, 2)),
        ...images,
      },
      certificates
    );

    // 5 ── Serialise to buffer
    const pkpassBuffer = await pass.getAsBuffer();

    // 6 ── Stream back to client
    //      MIME type triggers the "Add to Wallet" sheet on iOS
    res.setHeader("Content-Type",        "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", "attachment; filename=treasury-aesthetics.pkpass");
    res.setHeader("Content-Length",      pkpassBuffer.length);
    res.setHeader("Cache-Control",       "no-store");

    return res.status(200).send(pkpassBuffer);

  } catch (error) {
    console.error("[Treasury Wallet] PKPass generation failed:", error);

    // Differentiate cert config errors from generation errors
    const isCertError = error.message.includes("environment variables");
    return res.status(isCertError ? 503 : 500).json({
      error:   isCertError ? "Pass service not configured" : "Failed to generate pass",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
