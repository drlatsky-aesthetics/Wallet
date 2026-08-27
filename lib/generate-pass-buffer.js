import { PKPass }            from "passkit-generator";
import { readFileSync }      from "fs";
import { join }              from "path";
import { loadCertificates }  from "./certificates.js";
import { buildPassTemplate } from "./pass-template.js";
import {
  getPlanUrl, getOrCreateAuthToken, savePassMeta, serialForClient,
} from "./pass-store.js";

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

  // Stable serial: same client always gets the same serial → Wallet replaces instead of duplicating
  const serialNumber = clientId
    ? serialForClient(clientId)
    : `treasury-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Per-patient link: if the Treasury agent (or admin panel) has recorded this
  // client's private patient-page URL, the pass links there; otherwise the
  // generic clinic site. The patient page URL is PHIPA-safe by design — a
  // random slug with a DOB/passphrase gate, never the patient's name.
  const planUrl   = clientId ? await getPlanUrl(clientId) : null;
  const targetUrl = planUrl || process.env.PASS_TARGET_URL || "https://treasuryaesthetics.ca";

  // Web service credentials — lets iOS refresh the pass so a changed patient
  // link propagates onto passes already in wallets. Requires KV (token
  // storage) and PASS_BASE_URL; without them the pass is simply static.
  const baseUrl   = process.env.PASS_BASE_URL || null;
  const authToken = baseUrl ? await getOrCreateAuthToken(serialNumber) : null;

  // Persist what's needed to rebuild this exact pass on refresh, and stamp
  // updatedAt so registered devices know when it changed.
  await savePassMeta(serialNumber, {
    memberName: memberName || null,
    tier:       membershipTier,
    clientId:   clientId || null,
  });

  const passJson = buildPassTemplate({
    serialNumber,
    targetUrl,
    memberName:     memberName || null,
    membershipTier: membershipTier,
    isPersonalUrl:  !!planUrl,
    webServiceURL:       authToken ? `${baseUrl.replace(/\/$/, "")}/api/wallet` : null,
    authenticationToken: authToken,
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
