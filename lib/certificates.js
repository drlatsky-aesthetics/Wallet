// lib/certificates.js
// ─────────────────────────────────────────────────────────────────────────────
// Loads and validates Apple signing certificates from Vercel environment vars.
//
// All three certs are stored as base64-encoded PEM strings in Vercel env vars
// so they survive JSON serialisation and contain no raw newlines.
//
// HOW TO ENCODE YOUR CERTS FOR VERCEL:
//   macOS/Linux:  base64 -i your-cert.pem | tr -d '\n'
//   Then paste the output as the Vercel env var value.
//
// CERT ACQUISITION STEPS (see README.md for full walkthrough):
//   1. WWDR G4:     Download from https://www.apple.com/certificateauthority/
//                   File: AppleWWDRCAG4.cer  →  convert to PEM
//   2. Signer Cert: Download from developer.apple.com → Certificates
//                   Export as .p12, then: openssl pkcs12 -in cert.p12 -clcerts -nokeys -out signer.pem
//   3. Signer Key:  openssl pkcs12 -in cert.p12 -nocerts -out key.pem
// ─────────────────────────────────────────────────────────────────────────────

export function loadCertificates() {
  const required = [
    "APPLE_WWDR_CERT",
    "APPLE_SIGNER_CERT",
    "APPLE_SIGNER_KEY",
    "APPLE_TEAM_ID",
    "APPLE_PASS_TYPE_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
      "See README.md for setup instructions."
    );
  }

  const decode = (envKey) =>
    Buffer.from(process.env[envKey], "base64").toString("utf8");

  return {
    wwdr:                 decode("APPLE_WWDR_CERT"),
    signerCert:           decode("APPLE_SIGNER_CERT"),
    signerKey:            decode("APPLE_SIGNER_KEY"),
    ...(process.env.APPLE_SIGNER_KEY_PASSPHRASE
      ? { signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE }
      : {}),
  };
}
