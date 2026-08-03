# Treasury Aesthetics — Wallet Pass Deployment Guide

> Complete reference for the Apple Wallet loyalty pass system. Read this before touching anything.

---

## Overview

This system automatically generates and emails personalised Apple Wallet `.pkpass` loyalty passes to Treasury Aesthetics patients. There are two flows:

1. **Admin flow** — Staff use `/admin` to view Phorest clients and send passes manually.
2. **Patient self-serve flow** — Patients on their personal plans page click a button, enter their email + Phorest referral code, and receive a pass by email.

**Production URL:** `https://wallet-tau-green.vercel.app`  
**Repository:** `https://github.com/drlatsky-aesthetics/Wallet`  
**Active branch:** `claude/build-apple-wallet-pass-OjGsY`

---

## Git Access

```bash
git clone https://github.com/drlatsky-aesthetics/Wallet.git
cd Wallet
git checkout claude/build-apple-wallet-pass-OjGsY
```

---

## Environment Variables (Vercel)

All secrets are stored as Vercel env vars. To read any of them via API:

```bash
# Get decrypted value of any env var by its ID
curl "https://api.vercel.com/v9/projects/prj_Nf88NJ62XxW0mkRZWK49N0VMZGU9/env/{ENV_VAR_ID}?teamId=team_i2XzT32nSYV58kXQ4JTOAtsT&decrypt=true" \
  -H "Authorization: Bearer {VERCEL_TOKEN}"
```

| Variable | Description | Notes |
|---|---|---|
| `APPLE_PASS_TYPE_ID` | `pass.ca.treasuryhealth.loyalty` | Must match Apple Dev portal |
| `APPLE_TEAM_ID` | 10-char Apple Developer Team ID | From developer.apple.com/account |
| `APPLE_WWDR_CERT` | Base64-encoded WWDR G4 PEM | Apple intermediate CA |
| `APPLE_SIGNER_CERT` | Base64-encoded signer cert PEM | From your .p12 export |
| `APPLE_SIGNER_KEY` | Base64-encoded signer private key PEM | From your .p12 export |
| `APPLE_SIGNER_KEY_PASSPHRASE` | Passphrase for the private key | Empty string if none |
| `PHOREST_USERNAME` | `global/aesthetics@treasuryhealth.ca` | Phorest API user |
| `PHOREST_PASSWORD` | Phorest API password | Env var ID: `JllcHwBZXoLrp5ou` |
| `PHOREST_BUSINESS_ID` | `CPCJEF0k5-6Qf8gqAtuNPQ===` | **Must URL-encode** the `=` signs |
| `RESEND_API_KEY` | Resend API key | For email delivery |
| `RESEND_FROM_EMAIL` | `Treasury Aesthetics <hello@treasuryaesthetics.ca>` | Verified sending domain |
| `CRON_SECRET` | *(secret — retrieve from Vercel dashboard)* | Admin endpoint auth token |
| `PASS_TARGET_URL` | `https://treasuryaesthetics.ca` | Default QR destination |
| `KV_REST_API_URL` | Vercel KV Redis URL | For pass-sent deduplication |
| `KV_REST_API_TOKEN` | Vercel KV auth token | For pass-sent deduplication |

**Vercel project details:**
- Project ID: `prj_Nf88NJ62XxW0mkRZWK49N0VMZGU9`
- Team ID: `team_i2XzT32nSYV58kXQ4JTOAtsT`
- Vercel token: `{VERCEL_TOKEN}`

**Retrieve Phorest password:**
```bash
curl "https://api.vercel.com/v9/projects/prj_Nf88NJ62XxW0mkRZWK49N0VMZGU9/env/JllcHwBZXoLrp5ou?teamId=team_i2XzT32nSYV58kXQ4JTOAtsT&decrypt=true" \
  -H "Authorization: Bearer {VERCEL_TOKEN}"
```

---

## File Structure

```
Wallet/
├── api/
│   ├── generate-pass.js     # GET  /api/generate-pass — direct pass download
│   ├── request-pass.js      # POST /api/request-pass  — patient self-serve (public)
│   ├── send-pass.js         # POST /api/send-pass     — admin bulk sender
│   ├── list-clients.js      # GET  /api/list-clients  — Phorest client list
│   └── sync-passes.js       # Legacy sync (disabled — no cron in vercel.json)
├── lib/
│   ├── generate-pass-buffer.js  # Shared pass builder (used by all send endpoints)
│   ├── pass-template.js         # pass.json structure
│   ├── certificates.js          # Loads Apple certs from env vars
│   └── kv.js                    # Graceful Vercel KV wrapper
├── public/
│   ├── admin.html           # Staff admin panel
│   ├── request-pass.html    # Patient self-serve form
│   └── wallet.html          # Landing page with Add to Wallet button
├── assets/
│   └── pass/                # PNG images for the pass (icon, logo)
├── vercel.json
├── package.json
└── walletdeploy.md          # This file
```

---

## API Endpoints

### `GET /api/generate-pass?member=Jane+Smith`
Returns a signed `.pkpass` file. On iOS, the MIME type (`application/vnd.apple.pkpass`) triggers the native "Add to Wallet" sheet.  
No auth required. `member` param is optional.

### `POST /api/request-pass`
**Public — no auth required.** Called by the patient self-serve form.

Request body:
```json
{
  "email": "patient@example.com",
  "referralCode": "ABC-12345",
  "slug": "jane-smith"
}
```

Flow:
1. Searches Phorest for a client matching the email (used to get their real name)
2. Falls back to slug → formatted name if Phorest lookup fails
3. Builds pass with referral code as QR content
4. Links patient's personal plan page (`https://www.treasuryaesthetics.ca/{slug}`) in back fields
5. Emails `.pkpass` as attachment via Resend

### `GET /api/list-clients?hours=720`
Returns Phorest clients updated in the last N hours, with `sent/unsent/no-email` status from Vercel KV.  
Requires: `Authorization: Bearer {CRON_SECRET}`

### `POST /api/send-pass`
Generates and emails passes to a list of clients. Updates KV dedup set after each successful send.  
Requires: `Authorization: Bearer {CRON_SECRET}`

Request body:
```json
{
  "clients": [
    { "id": "clientId", "firstName": "Jane", "lastName": "Smith", "email": "jane@example.com" }
  ]
}
```

---

## Pages

| URL | Description |
|---|---|
| `/admin` | Staff admin panel — load clients, select, send passes |
| `/request-pass?name=jane-smith` | Patient self-serve form (name pre-fills greeting) |
| `/wallet.html` | Branded landing page with direct Wallet button |

---

## Patient Self-Serve Integration

The patient-facing plans site at `www.treasuryaesthetics.ca/[firstname-lastname]` needs a button that links to the pass request form.

**Button URL format:**
```
https://wallet-tau-green.vercel.app/request-pass?name=firstname-lastname
```

**Example** — for a patient at `www.treasuryaesthetics.ca/jane-smith`:
```
https://wallet-tau-green.vercel.app/request-pass?name=jane-smith
```

The form will greet them as "Hi, Jane." and pre-fill the name context. After they enter their email and referral code, the pass is emailed to them directly.

**Suggested button copy:** `Get My Loyalty Pass` or `Add to Apple Wallet`

---

## Critical Bugs Fixed (Do Not Revert)

### 1. `additionalInfoFields` — Pass Wallet rejection
`passkit-generator` v3 always injects `additionalInfoFields: []` into `storeCard`. Apple's spec doesn't allow this field — iOS Wallet rejects the entire pass silently.

**Fix** in `lib/generate-pass-buffer.js` — strips it via Symbol reflection before `getAsBuffer()`:
```js
for (const sym of Object.getOwnPropertySymbols(pass)) {
  const val = pass[sym];
  if (val && typeof val === "object" && val.storeCard) {
    delete val.storeCard.additionalInfoFields;
    break;
  }
}
```

### 2. `dateStyle: "PKDateStyleNone"` — Pass Wallet rejection
Adding `dateStyle` to a plain string field (non-date value) causes Apple Wallet to reject the entire pass.

**Fix** in `lib/pass-template.js` — the `issued` auxiliaryField has no `dateStyle` property.

### 3. `Content-Disposition: attachment` — iOS WKWebView blocks download
When the `.pkpass` response includes `Content-Disposition: attachment`, iOS Mail's in-app browser (WKWebView) treats it as a blocked file download instead of routing it to Wallet.

**Fix** in `api/generate-pass.js` — no `Content-Disposition` header. Pass delivery via email attachment is the only reliable iOS method.

### 4. Phorest 401 — Business ID not URL-encoded
The business ID `CPCJEF0k5-6Qf8gqAtuNPQ===` contains `=` characters that must be URL-encoded before use in a path segment.

**Fix** in all Phorest callers — `encodeURIComponent(process.env.PHOREST_BUSINESS_ID)`.

### 5. `@vercel/kv` crash — missing env vars
Top-level `import { kv } from "@vercel/kv"` throws at module load time when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are absent.

**Fix** in `lib/kv.js` — `kvConfigured()` guard + `await import("@vercel/kv")` inside async functions only.

---

## Apple Certificates

Certs are stored as base64-encoded PEM strings in Vercel env vars (not in the repo).

**To encode a cert for Vercel:**
```bash
base64 -i your-cert.pem | tr -d '\n'
```

**To decode and inspect locally:**
```bash
echo "$APPLE_SIGNER_CERT" | base64 -d | openssl x509 -noout -text
```

**Cert chain:**
- Apple Root CA → WWDR G4 (`APPLE_WWDR_CERT`) → `pass.ca.treasuryhealth.loyalty` signer cert
- Signer cert expires: **July 2027**

**Encrypted cert backups** (passphrase: `2896Laser`):
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -a -in certificates/filename.enc -pass pass:2896Laser
```

---

## Phorest API

**Base URL:** `https://platform.phorest.com/third-party-api-server/api/business`  
**Auth:** HTTP Basic — `global/aesthetics@treasuryhealth.ca` : `{PHOREST_PASSWORD}`

**List clients updated since a timestamp:**
```
GET /api/business/{encodedBizId}/client?updatedAt={ISO8601}&page=0&size=100
```

Response shape:
```json
{
  "_embedded": {
    "clients": [
      { "clientId": "...", "firstName": "Jane", "lastName": "Smith", "email": "..." }
    ]
  },
  "page": { "totalPages": 3 }
}
```

> **Note:** Phorest's third-party API does **not** expose referral codes. These are part of the Phorest Grow product and are not available via API. Patients must paste their own code from the Phorest app (Account → Refer a Friend).

---

## Email Delivery

All emails are sent via [Resend](https://resend.com). The `.pkpass` file is sent as a base64-encoded attachment with `content_type: "application/vnd.apple.pkpass"`.

iOS Mail handles `.pkpass` attachments natively — the patient sees an "Add to Wallet" prompt directly in the email. This is the **only** reliable iOS delivery method; link-based approaches fail in Mail's WKWebView.

---

## Vercel KV (Deduplication)

Clients who have been sent a pass are tracked in a Redis set at key `treasury:sent_client_ids` in Vercel KV.

- `getSentIds()` — returns a `Set` of sent client IDs
- `markSent(clientId)` — adds a client ID to the set
- `getSentList()` — returns array of all sent IDs (for admin display)

The KV wrapper fails gracefully if env vars are missing — passes will still send, just without deduplication.

---

## Deploying Changes

```bash
# Make changes on the working branch
git add .
git commit -m "Your message"
git push -u origin claude/build-apple-wallet-pass-OjGsY
```

Vercel auto-deploys on push. Production URL remains `https://wallet-tau-green.vercel.app`.

---

## Pass Design

| Field | Value |
|---|---|
| Type | `storeCard` |
| Background | `rgb(22, 22, 20)` — charcoal `#161614` |
| Foreground | `rgb(245, 240, 232)` — cream `#F5F0E8` |
| Labels | `rgb(201, 165, 90)` — gold `#C9A55A` |
| Logo text | `Treasury Aesthetics` |
| Header | `MEMBER` (right-aligned) |
| Primary field | Patient name (or `Treasury Aesthetics` if unknown) |
| Secondary fields | Location: `Toronto, ON` · Portal: `treasuryaesthetics.ca` |
| Auxiliary fields | Issue date · Pass type: `Loyalty Pass` |
| QR content | Referral code (self-serve) or `PASS_TARGET_URL` (admin) |
| Back — plan link | Patient's personal plan URL (`www.treasuryaesthetics.ca/slug`) |
| Back — contact | `aesthetics@treasuryhealth.ca` |

Pass images live in `assets/pass/` — `icon.png` (29×29), `icon@2x.png` (58×58), `icon@3x.png` (87×87), `logo.png` (160×50), `logo@2x.png` (320×100).

---

## Claude Code Memory

When Dr. Latsky says **"update my PC"**, that means:
1. Update `currentstate.md` with the current project state
2. Commit: `git commit -m "Update currentstate.md"`
3. Push to the active branch
