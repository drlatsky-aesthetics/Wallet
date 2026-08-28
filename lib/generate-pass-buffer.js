import { PKPass }            from "passkit-generator";
import { readFileSync }      from "fs";
import { join }              from "path";
import { loadCertificates }  from "./certificates.js";
import { buildPassTemplate } from "./pass-template.js";
import { planLinkUrl }       from "./plan-link.js";

function loadPassImages() {
  const assetsDir = join(process.cwd(), "assets", "pass");
  const load = (filename) => {
    try {
      return readFileSync(join(assetsDir, filename));
    } catch {
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
    // strip.png: full-width banner behind primaryFields (Option C layout)
    "strip.png":    load("strip.png"),
    "strip@2x.png": load("strip@2x.png"),
  };
}

export async function generatePassBuffer(memberName, membershipTier = "standard", clientId = null) {
  const certificates = loadCertificates();
  const passJson = buildPassTemplate({
    // Stable serial: same client always gets the same serial → Wallet replaces instead of duplicating
    serialNumber:   clientId ? `treasury-${clientId}` : `treasury-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    // Per-client permanent plan pointer (/w/<wid> — see lib/plan-link.js):
    // the QR opens the client's current treatment-plan page, and keeps
    // working when the plan's URL changes. Falls back to the global target
    // when there's no clientId or PASS_LINK_SECRET isn't configured.
    targetUrl:      (clientId && planLinkUrl(clientId)) ||
                    process.env.PASS_TARGET_URL || "https://treasuryaesthetics.ca",
    memberName:     memberName || null,
    membershipTier: membershipTier,
  });

  const pass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(passJson, null, 2)), ...loadPassImages() },
    certificates
  );

  // passkit-generator v3 injects additionalInfoFields:[] into storeCard —
  // not in Apple's spec, causes Wallet to reject the pass. Strip via reflection.
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
