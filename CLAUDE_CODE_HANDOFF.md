# Claude Code Handoff — Treasury Aesthetics Apple Wallet Pass
**Project:** `treasury-wallet-native`
**Prepared by:** Claude (claude.ai project session)
**Status:** Code complete · Awaiting Apple Developer certificates + brand image assets

---

## What This Project Does

Generates and serves native Apple Wallet `.pkpass` files for Treasury Aesthetics — a physician-led medical aesthetics clinic in Toronto. When a patient taps "Add to Apple Wallet," their iPhone receives the branded pass (charcoal + gold, clinic branding) containing a QR code that currently links to `https://treasuryhealth.ca`. That URL will be swapped for a patient sign-in portal URL in a future iteration — one env var change, no code edits.

No third-party pass services (Badge API, PassKit, etc.) are used. Everything is generated natively using `passkit-generator` (npm).

---

## Repo Structure

```
treasury-wallet-native/
├── api/
│   └── generate-pass.js        ← Vercel serverless function (the core)
├── lib/
│   ├── pass-template.js        ← pass.json builder — all brand/content config
│   └── certificates.js         ← loads Apple certs from Vercel env vars
├── public/
│   └── wallet.html             ← branded patient-facing "Add to Wallet" page
├── assets/
│   └── pass/                   ← [EMPTY] brand PNG assets go here (see below)
├── .env.example                ← all required env vars, fully documented
├── package.json
└── README.md                   ← full Apple cert setup walkthrough (terminal commands)
```

---

## Current State — What's Done vs. What's Needed

### ✅ Done (code complete, no changes needed)

| File | Notes |
|---|---|
| `api/generate-pass.js` | Vercel serverless handler — signs and streams `.pkpass` |
| `lib/pass-template.js` | Full `pass.json` with Treasury branding, all pass fields, QR, back-of-pass |
| `lib/certificates.js` | Cert loader with validation and clear error messages |
| `public/wallet.html` | Branded page — charcoal/gold, animated pass card, QR preview |
| `.env.example` | Every env var documented with exact OpenSSL commands |
| `package.json` | Single dependency: `passkit-generator ^3.2.0` |
| `README.md` | Step-by-step Apple cert setup (5-step walkthrough) |

### ⛔ Blocked — Required Before Deploy

**1. Apple Developer certificates** (Dr. Latsky to complete — needs Mac + Apple Dev account)

These are the only things that require Apple. All commands are in `README.md` and `.env.example`.

```
APPLE_TEAM_ID              → 10-char ID from developer.apple.com/account
APPLE_PASS_TYPE_ID         → "pass.ca.treasuryhealth.loyalty" (register in Dev portal first)
APPLE_WWDR_CERT            → base64-encoded WWDR G4 PEM (public Apple cert)
APPLE_SIGNER_CERT          → base64-encoded signing cert PEM
APPLE_SIGNER_KEY           → base64-encoded private key PEM
APPLE_SIGNER_KEY_PASSPHRASE → passphrase used when exporting .p12 (can be blank)
```

**2. Brand image assets** — place PNGs in `/assets/pass/`

| File | Size | Content |
|---|---|---|
| `icon.png` | 29×29 px | T or TA monogram on charcoal (#161614) background |
| `icon@2x.png` | 58×58 px | same |
| `icon@3x.png` | 87×87 px | same |
| `logo.png` | 160×50 px max | "Treasury Aesthetics" wordmark |
| `logo@2x.png` | 320×100 px max | retina wordmark |

> Transparent PNG fallbacks are already coded — the pass *will* generate without these during testing, just without logo/icon branding. Swap in real assets before patient-facing deployment.

**3. Vercel env vars** — add all of the above to Vercel Dashboard → Project → Settings → Environment Variables. Also set:

```
PASS_TARGET_URL=https://treasuryhealth.ca   ← swap for sign-in URL later
ALLOWED_ORIGIN=https://treasuryhealth.ca
```

---

## Deployment Steps (Claude Code Tasks)

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values (or pull from Vercel)
cp .env.example .env.local

# 3. Test locally — visit http://localhost:3000/api/generate-pass
npm run dev

# 4. Deploy to production
npm run deploy
```

After deploy, the patient-facing URL is:
```
https://your-vercel-domain.vercel.app/wallet.html
```
or mapped to a path on `treasuryhealth.ca` (e.g. `/wallet`).

---

## Key Design Decisions (Context for Claude Code)

**Why native instead of Badge API / PassKit?**
Those services are wrappers around the same Apple signing process — they charge per pass or per month, add a vendor dependency, and offer no capability that `passkit-generator` doesn't provide natively. The only genuine Apple dependency is the signing certificate, which is unavoidable regardless of which approach is used.

**Why storeCard pass type?**
Apple Wallet has five pass types. `storeCard` is the canonical loyalty/membership format — it places the QR code prominently and has the right field layout (primary, secondary, auxiliary, back fields). `generic` was the alternative but has weaker visual hierarchy.

**Why ESM (`"type": "module"` in package.json)?**
Vercel Node 18+ runtime supports ESM natively. `passkit-generator` v3 is ESM-first. Avoids the `require`/`import` interop issues that plagued v2 deployments.

**Certificate storage as base64 env vars — why?**
Vercel env vars are strings. PEM files contain newlines which break naive string storage. Base64-encoding the PEM files produces a single-line string that survives Vercel's env var handling cleanly. The `certificates.js` loader decodes them at runtime.

**QR URL is a single env var (`PASS_TARGET_URL`)**
When the patient sign-in portal is ready, Dr. Latsky updates this one value in Vercel and redeploys — no code changes. Existing issued passes retain their original URL (they're static); only newly generated passes pick up the new destination.

**Personalisation hook is already wired**
`GET /api/generate-pass?member=Jane+Smith` injects the name into the pass primary field. This enables a future Phorest → patient communication → personalised pass flow without any code changes.

---

## Brand Spec (for image asset generation)

| Token | Value |
|---|---|
| Background | `#161614` (rgb 22, 22, 20) |
| Foreground / text | `#F5F0E8` (rgb 245, 240, 232) |
| Label / accent | `#C9A55A` (rgb 201, 165, 90) — Treasury gold |
| Pass type | `storeCard` |
| Logo text | `"Treasury Aesthetics"` |
| Organisation | `"Treasury Aesthetics"` |

Apple Wallet renders the `backgroundColor`, `foregroundColor`, and `labelColor` from the `pass.json` — these are already set correctly in `lib/pass-template.js`. The image assets only need to look correct on a charcoal background.

---

## Future Iterations (Do Not Build Now)

- **Push updates** — Uncomment `webServiceURL` and `authenticationToken` in `pass-template.js` to enable updating passes already in patient wallets (e.g. showing loyalty credit balance). Requires implementing the Apple Wallet web service protocol as additional Vercel API routes.
- **Geofence relevance** — Uncomment the `locations` block in `pass-template.js` and add the clinic's lat/lng. Pass will surface on patient lock screen when near the clinic.
- **Google Wallet** — Structurally equivalent but uses a different API (Google Wallet API, JWT-based). Separate implementation; shares the same `pass-template.js` brand config as a source of truth.
- **Membership tier differentiation** — Pass currently shows "Loyalty Pass." Future: pass `tier=reserve` or `tier=vault` query param to generate tier-specific passes (Treasury Reserve / Treasury Vault) with different field values.

---

## Contact / Context

- **Clinic:** Treasury Aesthetics — `treasuryhealth.ca` — Toronto, ON
- **Owner:** Dr. Jason Latsky
- **Email:** `aesthetics@treasuryhealth.ca`
- **EMR:** Phorest
- **Existing Vercel deployment:** AI chatbot (V5) — this wallet project can share the same Vercel account or deploy as a separate project
- **Apple Developer account:** Dr. Latsky to confirm — needed for Step 1 of cert setup
