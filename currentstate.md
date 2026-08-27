# Treasury Aesthetics — Apple Wallet Pass System · Current State

_Last updated: 2026-08-27_

---

## What This Project Does

Automatically emails personalised Apple Wallet loyalty passes to new Treasury Aesthetics patients. When a new client is added in Phorest (the clinic's booking system), they receive a branded email with an "Add to Apple Wallet" button. Tapping it adds a signed `.pkpass` to their iPhone Wallet. An admin panel at `/admin.html` lets staff manually trigger syncs and select exactly which clients receive a pass.

---

## Architecture

```
Phorest (booking system)
    ↓  REST API poll (hourly cron or manual)
api/sync-passes.js  ──→  Resend (email)  ──→  Patient inbox
                                                    ↓
                                        wallet.html (branded landing page)
                                                    ↓  fetch → blob
                                        api/generate-pass.js
                                                    ↓
                                        .pkpass signed with Apple certs
                                                    ↓
                                        iOS Wallet sheet
```

**Deduplication:** Vercel KV (Redis) stores a set of client IDs that have already received a pass. Every sync checks this set before sending.

---

## Live URLs

| Purpose | URL |
|---|---|
| Pass landing page | `https://wallet-tau-green.vercel.app/wallet.html` |
| Admin panel | `https://wallet-tau-green.vercel.app/admin.html` |
| Pass API | `https://wallet-tau-green.vercel.app/api/generate-pass` |
| Sync API | `https://wallet-tau-green.vercel.app/api/sync-passes` |
| GitHub repo | `https://github.com/drlatsky-aesthetics/Wallet` |
| Vercel project | `prj_Nf88NJ62XxW0mkRZWK49N0VMZGU9` |
| Vercel team | `team_i2XzT32nSYV58kXQ4JTOAtsT` |

---

## File Map

### API (Vercel Serverless Functions)

| File | Purpose |
|---|---|
| `api/generate-pass.js` | Signs and streams a `.pkpass` file. Called when patient taps "Add to Apple Wallet". Returns `Content-Type: application/vnd.apple.pkpass` with no `Content-Disposition` so iOS routes it to Wallet. |
| `api/sync-passes.js` | Polls Phorest for updated clients, emails passes via Resend. Protected by `CRON_SECRET` (manual) or `SYNC_ENABLED=true` (cron). Cron is currently **disabled** in `vercel.json`. |
| `api/list-clients.js` | Read-only: fetches clients from Phorest + their KV sent-status. Used by admin panel "Find Clients" button. No emails sent. |
| `api/send-pass.js` | Sends passes to a specific POST-supplied list of clients. Used by admin panel "Send Passes" button. Marks each sent ID in KV. |

### Library

| File | Purpose |
|---|---|
| `lib/pass-template.js` | Builds the `pass.json` payload. `storeCard` type, charcoal/gold/cream brand colours. QR encodes `PASS_TARGET_URL`. Supports `memberName` personalisation. |
| `lib/certificates.js` | Loads Apple signing certs from base64-encoded Vercel env vars. Conditionally spreads `signerKeyPassphrase` only when non-empty (passkit-generator v3 rejects empty string). |

### Public Pages

| File | Purpose |
|---|---|
| `public/wallet.html` | Patient-facing branded landing page. Animated pass card with gold QR, "Add to Apple Wallet" button. Button uses `fetch()→blob URL` approach (more reliable than raw `<a href>` for pkpass on iOS Safari). Links to `treasuryaesthetics.ca`. |
| `public/admin.html` | Staff-only admin panel. Two-phase: **Find Clients** (fetches Phorest + KV status, shows checkboxes) → **Send Passes** (sends only to checked clients). Pre-checks unsent/error clients; already-sent clients unchecked but re-selectable. Access key required (= `CRON_SECRET`). |

### Config & Scripts

| File | Purpose |
|---|---|
| `vercel.json` | Vercel config. Cron **removed** (was causing spam). Function timeouts: generate-pass 10s, others 30–60s. |
| `package.json` | ESM (`"type": "module"`). Deps: `passkit-generator ^3.2.0`, `@vercel/kv ^3.0.0`. |
| `lib/pass-template.js` | Pass JSON structure — edit here to change what appears on the card. |
| `scripts/generate-pass-images.js` | Local-only script (not deployed) for generating brand PNG assets via canvas. |

### Certificates / Secrets

| File | Purpose |
|---|---|
| `certificates/vercel.token.enc` | AES-256-CBC encrypted Vercel API token. Passphrase: `2896Laser`. |
| `certificates/resend.enc` | Encrypted Resend API key. |
| `certificates/phorest.enc` | Encrypted Phorest credentials. |
| `certificates/README.md` | Setup instructions for Apple certs. |

---

## Environment Variables (set in Vercel)

### Apple Wallet Signing (required)

| Variable | Description |
|---|---|
| `APPLE_WWDR_CERT` | Apple WWDR G4 cert, base64-encoded PEM |
| `APPLE_SIGNER_CERT` | Pass Type cert from Apple Dev portal, base64-encoded PEM |
| `APPLE_SIGNER_KEY` | Private key matching the signer cert, base64-encoded PEM |
| `APPLE_SIGNER_KEY_PASSPHRASE` | Key passphrase — **omit entirely** if key has no passphrase |
| `APPLE_TEAM_ID` | `MG5DN8USG7` |
| `APPLE_PASS_TYPE_ID` | `pass.ca.treasuryhealth.loyalty` |

### Email (required)

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key (from `certificates/resend.enc`) |
| `RESEND_FROM_EMAIL` | `Treasury Aesthetics <hello@treasuryaesthetics.ca>` |

### Phorest (required for sync)

| Variable | Description |
|---|---|
| `PHOREST_USERNAME` | `global/aesthetics@treasuryhealth.ca` |
| `PHOREST_PASSWORD` | (from `certificates/phorest.enc`) |
| `PHOREST_BUSINESS_ID` | `CPCJEF0k5-6Qf8gqAtuNPQ===` |

### Vercel KV (required for deduplication)

Set automatically by Vercel when you create a KV store and link it to the project (Storage tab in Vercel dashboard):

| Variable | Description |
|---|---|
| `KV_REST_API_URL` | Auto-set by Vercel KV |
| `KV_REST_API_TOKEN` | Auto-set by Vercel KV |

### Auth & Routing (required)

| Variable | Description |
|---|---|
| `CRON_SECRET` | Password for admin panel access key field + cron auth header |
| `PASS_BASE_URL` | Production URL, e.g. `https://wallet-tau-green.vercel.app` |
| `PASS_TARGET_URL` | URL encoded in QR code, e.g. `https://treasuryhealth.ca` |

### Optional / Automation

| Variable | Description |
|---|---|
| `SYNC_ENABLED` | Set `true` to allow cron to fire when re-added to `vercel.json` |
| `ALLOWED_ORIGIN` | CORS origin for generate-pass (default: `https://treasuryhealth.ca`) |

---

## Deduplication (Vercel KV)

- KV Redis set key: `treasury:sent_client_ids`
- Each successfully emailed client's Phorest `clientId` is added via `SADD`
- On every sync/send, `SMEMBERS` is checked before sending
- **Setup required:** Create a KV store in Vercel dashboard → Storage → Create Database → KV → link to project. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

---

## Admin Panel Flow

1. Visit `https://wallet-tau-green.vercel.app/admin.html`
2. Enter `CRON_SECRET` value as access key
3. Choose lookback window (default 30 days)
4. Click **Find Clients** → see all Phorest clients with status:
   - **NOT SENT** (gold) — pre-checked ✓
   - **SENT** (green) — unchecked (can re-check to re-send)
   - **NO EMAIL** (grey) — disabled
5. Adjust checkboxes, click **Send Passes**
6. Pills update live; summary shows sent / errors

---

## Cron (currently disabled)

The hourly cron was removed from `vercel.json` after it was discovered to be emailing real clients every hour (deduplication via env var was broken — env vars don't update in-process in serverless).

**To re-enable cron:**
1. Ensure Vercel KV is set up (deduplication will then actually work)
2. Set `SYNC_ENABLED=true` in Vercel env vars
3. Add back to `vercel.json`:
   ```json
   "crons": [{ "path": "/api/sync-passes", "schedule": "0 * * * *" }]
   ```

---

## Patient Plan Link Coordination (added 2026-08-27)

**Owner's question (answered this session):** _"So the pass is generated from
the website that is made for patient plans. Can the wallet pass copy the URL
of the patient page at time of creation and track it so that it can be
updated if the patient changes the url?"_

**Answer: yes — that is exactly how it now works,** with one clarification:
the pass is generated by THIS Wallet app (not by the plans website), but it
copies the patient's plan-page URL at creation time and tracks it afterward:

1. **Copy at creation** — `lib/generate-pass-buffer.js` looks up the client's
   plan URL in KV (`treasury:pass_plan_urls`, keyed by Phorest `clientId`)
   and bakes it into the QR code + "Your Patient Page" back field. Falls back
   to `PASS_TARGET_URL` when no link is recorded.
2. **Track changes** — the treasury-agent app notifies `POST /api/pass-url`
   here whenever: staff email a plan link (keyed by patient email → resolved
   to `clientId` via Phorest), a patient renames/reverts their page URL
   (old URL → new URL rewrite, no PHI crosses), or staff delete a plan
   (link cleared). The admin panel's "Patient Page Link" card is the manual
   override. Every change bumps the pass's `updatedAt` stamp.
3. **Update on refresh** — passes embed `webServiceURL` + a per-pass auth
   token; `api/wallet/[...path].js` implements the Apple PassKit web service.
   When the patient pulls down on the back of the pass, iOS re-fetches it and
   the pass is REBUILT server-side with the current URL. The pass in the
   wallet is never edited in place — it is regenerated from tracked state.

Key facts:
- Pass serial = `treasury-<PhorestClientId>` → same client always replaces
  their existing pass instead of duplicating, and the serial is how a refresh
  request maps back to the client (via `treasury:pass_meta` in KV).
- The plan URL is PHIPA-safe by design: random slug, DOB/passphrase-gated,
  never contains the patient's name.
- Passes issued BEFORE this feature carry no web-service credentials and
  cannot refresh — re-send once from the admin panel to upgrade them.
- Automatic push (APNs) is NOT implemented — updates land on manual refresh.
  Device registrations are already stored, so APNs can be added later.
- Env: Wallet needs `PASS_SYNC_SECRET` (falls back to `CRON_SECRET`) + KV;
  treasury-agent needs `WALLET_SYNC_URL` + `WALLET_SYNC_SECRET`.
- Code lives on branch `claude/wallet-pass-patient-html-zaawtp` in BOTH the
  Wallet and treasury-agent repos — merge to `main` to deploy.

---

## Pending Issues

| Issue | Status | Notes |
|---|---|---|
| "Safari cannot download this item" | **Open** | wallet.html button now uses `fetch()→blob URL` which should fix it — not yet confirmed by user |
| Vercel KV setup | **Required** | User must create KV store in Vercel dashboard before deduplication works |
| `CRON_SECRET` env var | **Required** | Must be set in Vercel for admin panel to work |
| Apple Wallet pass validation | **Suspected** | If blob approach still fails, the signed pass itself may be invalid (cert mismatch or expired) |

---

## Brand

| Token | Value |
|---|---|
| Charcoal | `#161614` / `rgb(22,22,20)` |
| Gold | `#C9A55A` / `rgb(201,165,90)` |
| Cream | `#F5F0E8` / `rgb(245,240,232)` |
| Font | Georgia (serif) for headings, system-ui for data |

---

## Encrypted Credentials

All `.enc` files are AES-256-CBC with pbkdf2. Decrypt with:
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -a -in certificates/filename.enc -pass pass:2896Laser
```

---

## Recent Changes (this session)

- Stopped hourly cron spam — removed from `vercel.json`, added `SYNC_ENABLED` guard
- Switched email deduplication from broken env-var approach to Vercel KV
- Admin panel rebuilt: two-phase find/select/send with live checkbox UI
- Email "Add to Apple Wallet" border now on the button itself only
- Footer links corrected to `treasuryaesthetics.ca`
- wallet.html "Visit Site" corrected to `treasuryaesthetics.ca`
- wallet.html button switched to `fetch()→blob` to avoid Safari "cannot download" error
- `Content-Disposition` header removed from pass response (MIME type alone triggers Wallet)
- Added `api/list-clients.js` and `api/send-pass.js` endpoints
