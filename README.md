# Treasury Aesthetics · Apple Wallet Pass

Native PKPass generator — no third-party services required.
Runs as a single Vercel serverless function.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Apple Developer Account | $99 USD/year — needed for signing certificates only |
| Vercel account | Free tier works for this volume |
| Node.js 18+ | For local testing |

---

## Setup in 5 Steps

### 1 — Register a Pass Type ID

1. Go to **developer.apple.com → Certificates, IDs & Profiles → Identifiers**
2. Click **+** → choose **Pass Type IDs**
3. Description: `Treasury Aesthetics Loyalty Pass`
4. Identifier: `pass.ca.treasuryhealth.loyalty`
5. Register

### 2 — Create and download the signing certificate

1. Still in Apple Developer → **Certificates** → **+**
2. Choose **Pass Type ID Certificate**
3. Select your Pass Type ID from step 1
4. Generate a Certificate Signing Request (CSR) from Keychain Access on your Mac
5. Upload the CSR, download the resulting `.cer` file
6. Double-click the `.cer` to add it to your Keychain

### 3 — Export and convert certificates to PEM

Run these commands in Terminal — you will need the `.cer` files and Keychain export:

```bash
# 1. Download WWDR G4 from Apple (public certificate)
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer

# 2. Convert WWDR to PEM
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem

# 3. Export your signing cert from Keychain as .p12
#    Keychain Access → My Certificates → right-click → Export → .p12
#    Set a passphrase when prompted

# 4. Extract signing cert PEM
openssl pkcs12 -in cert.p12 -clcerts -nokeys -out signer.pem -legacy

# 5. Extract private key PEM (remove passphrase for simpler env var)
openssl pkcs12 -in cert.p12 -nocerts -nodes -out key.pem -legacy

# 6. Encode all three to base64 (single-line, no newlines)
base64 -i wwdr.pem   | tr -d '\n' > wwdr.b64
base64 -i signer.pem | tr -d '\n' > signer.b64
base64 -i key.pem    | tr -d '\n' > key.b64
```

### 4 — Prepare brand image assets

Place these PNG files in `/assets/pass/` before deploying.
Without them the pass still generates (transparent fallbacks), but won't look branded.

| File | Size | Notes |
|---|---|---|
| `icon.png` | 29×29 px | Small icon — use T or TA monogram |
| `icon@2x.png` | 58×58 px | Retina version |
| `icon@3x.png` | 87×87 px | Super Retina |
| `logo.png` | 160×50 px max | Wordmark on white strip at top |
| `logo@2x.png` | 320×100 px max | Retina wordmark |

All images must be PNG. Background should match `--charcoal` (#161614) for a seamless look.

### 5 — Deploy to Vercel

```bash
# Install dependencies
npm install

# Add environment variables
cp .env.example .env.local
# → Fill in your values from the base64 files above

# Test locally
npm run dev

# Deploy
npm run deploy
```

Set all `.env.example` variables in **Vercel Dashboard → Settings → Environment Variables**.

---

## How it Works

```
Patient taps "Add to Apple Wallet"
        ↓
GET /api/generate-pass
        ↓
loadCertificates()   — decodes PEM strings from env vars
buildPassTemplate()  — constructs pass.json with brand config
loadPassImages()     — reads PNG assets from /assets/pass/
new PKPass(...)      — passkit-generator assembles + signs the ZIP
        ↓
Response: application/vnd.apple.pkpass
        ↓
iOS detects MIME type → shows native "Add to Wallet" sheet
```

---

## Personalisation

Append `?member=Patient+Name` to the URL to personalise the pass:

```
https://treasuryhealth.ca/wallet.html?member=Jane+Smith
```

The serverless function reads this and injects it into the `primaryFields` of the pass.

---

## Swapping the QR Destination

When the patient sign-in portal is live, update a single env var:

```
PASS_TARGET_URL=https://app.treasuryhealth.ca/signin
```

No code changes required. Redeploy and all new passes will encode the new URL.

---

## Future: Push Updates to Issued Passes

To update passes already in patients' wallets (e.g. show loyalty credit balance),
uncomment the `webServiceURL` and `authenticationToken` fields in `lib/pass-template.js`
and implement the Apple Wallet web service protocol — a separate Vercel API route set.

---

## File Structure

```
treasury-wallet-native/
├── api/
│   └── generate-pass.js     ← Vercel serverless function
├── lib/
│   ├── pass-template.js     ← pass.json builder (brand config)
│   └── certificates.js      ← cert loading from env vars
├── public/
│   └── wallet.html          ← branded "Add to Wallet" page
├── assets/
│   └── pass/
│       ├── icon.png         ← place brand assets here
│       ├── icon@2x.png
│       ├── logo.png
│       └── logo@2x.png
├── .env.example             ← template (never commit actual values)
├── package.json
└── README.md
```
