// lib/generate-pass-buffer.js
// Shared helper — assembles and signs a PKPass, returns a Buffer.
// Used by api/send-pass.js, api/request-pass.js, and api/generate-pass.js.

import { PKPass }            from "passkit-generator";
import { readFileSync }      from "fs";
import { join }              from "path";
import { loadCertificates }  from "./certificates.js";
import { buildPassTemplate } from "./pass-template.js";

function loadPassImages() {
  const assetsDir = join(process.cwd(), "assets", "pass");
  const load = (filename) => {
    try {
      return readFileSync(join(assetsDir, filename));
    } catch {
      // 1×1 transparent PNG fallback — replaced by real brand assets in production
      return Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
    }
  };
  return {
    "icon.png":     load("icon.png"),
    "icon@2x.png":  load("icon@2x.png"),
    "icon@3x.png":  load("icon@3x.png"),
    "logo.png":     load("logo.png"),
    "logo@2x.png":  load("logo@2x.png"),
    // Strip artwork: gold hairline borders + serif TA watermark + tagline —
    // the member name (primary field) renders on top of it.
    "strip.png":    load("strip.png"),
    "strip@2x.png": load("strip@2x.png"),
    "strip@3x.png": load("strip@3x.png"),
  };
}

// memberName  — shown in primaryField (e.g. "Jane Smith")
// referralCode — encoded in QR barcode (optional; falls back to targetUrl)
// planUrl      — patient's personal plan page, shown in back fields (optional)
// clientId     — Phorest client ID; gives a stable serial so a re-sent pass
//                replaces the one in Wallet instead of duplicating
export async function generatePassBuffer({ memberName, referralCode, planUrl, clientId } = {}) {
  const certificates = loadCertificates();
  const passJson = buildPassTemplate({
    serialNumber: clientId ? `treasury-${clientId}` : `treasury-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    targetUrl:    process.env.PASS_TARGET_URL || "https://treasuryaesthetics.ca",
    memberName:   memberName || null,
    referralCode: referralCode || null,
    planUrl:      planUrl || null,
  });

  const pass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(passJson, null, 2)), ...loadPassImages() },
    certificates
  );

  // CRITICAL: passkit-generator v3 always injects additionalInfoFields:[] into
  // storeCard, but Apple's spec doesn't allow it — causes Wallet to reject the pass.
  // Strip it via Symbol reflection before serialising.
  try {
    for (const sym of Object.getOwnPropertySymbols(pass)) {
      const val = pass[sym];
      if (val && typeof val === "object" && val.storeCard) {
        delete val.storeCard.additionalInfoFields;
        break;
      }
    }
  } catch (_) {}

  return pass.getAsBuffer();
}
