# Privacy Hardening Playbook — PHIPA / PIPEDA

Distilled from the Treasury Aesthetics compliance program (audited 2026-08-26,
verified 2026-08-28). This is the standard every clinic-agent deployment in
the fleet is held to. The reference implementation is this codebase; the
canonical upstream is `drlatsky-aesthetics/treasury-agent`.

An engineering checklist, not legal advice — have a privacy professional
review each live deployment.

## The checklist

### 1. Secrets
- [ ] No credential, key, passphrase, or token anywhere in the repo — env vars
      only, catalogued in `.env.example`.
- [ ] Nothing secret in git **history** (scan with `git grep <secret> $(git
      rev-list --all)`); scrub with `git filter-repo --replace-text` on a
      **full mirror clone** (never a shallow one — compare per-branch commit
      counts against the remote before force-pushing) and rotate anything that
      was ever committed.
- [ ] No static HTML/docs page carries a password "for convenience".

### 2. Identity never in URLs
- [ ] Plan/record URLs are random tokens (`randomSlug()`, ~10 chars, no
      ambiguous characters) — never derived from a name.
- [ ] No UI builds a URL from a typed name (that makes patient-status
      enumeration a feature).
- [ ] Legacy name URLs bulk-reissued (staff **Secure URLs** button) and staff
      can reissue any single plan (**⟳ New URL**). Old addresses go dark — no
      redirects (a redirect re-leaks the new address).

### 3. No patient-status oracle
- [ ] Missing record and wrong credential return the **same** status, message,
      and delay (uniform 403 + constant-time compare + fixed failure delay).
- [ ] Error logs carry status codes and random slugs only — never names,
      payloads, or transcript fragments.

### 4. Credential gates
- [ ] DOB is bootstrap-only; patients are prompted to replace it with a
      self-chosen passphrase (scrypt hash, staff-resettable, hash carried
      across saves so no save path can wipe it).
- [ ] All rate limiting is durable (Upstash) with in-memory fallback, and
      counts **failures only** (a clinic shares one IP — successful logins
      must never consume quota).
- [ ] Staff tokens expire (`s2.<expiry>.<sig>`); rotating ADMIN_PASSWORD or
      ANTHROPIC_API_KEY revokes everything at once.
- [ ] Admin sign-in is rate-limited and timing-safe.

### 5. PHI ingestion is authenticated
- [ ] Logging endpoints require the signed per-session token issued by the
      chat route (`x-session-token`); anonymous POSTs are rejected.
- [ ] Payloads are size-capped (`lib/log-guards.ts`).

### 6. Encryption at rest
- [ ] Every PHI blob (plans, conversations, consults, sign-ups) is AES-256-GCM
      encrypted under KNOWLEDGE_KEY in a **private** blob store.
- [ ] Versioned writes (`prefix.<timestamp>.json`, prune old) — never
      overwrite a pathname (no read-after-write consistency).
- [ ] Key rotation path exists (KNOWLEDGE_KEY_PREVIOUS fallback); after
      re-saving all blobs, set STRICT_PLAN_ENCRYPTION=1 so plaintext is
      refused.
- [ ] No third-party SaaS holds transcripts (Airtable/Sheets retired).

### 7. Audit trail
- [ ] Every PHI access/change appends to the audit log (actor, action, slug,
      time).

### 8. Wrong-patient guards
- [ ] Any EMR name-match surface (consult notes, email lookup) returns
      **candidates for a human to pick** when more than one client shares the
      name — never auto-selects, never auto-sends.

### 9. Transparency & consent
- [ ] `/privacy` page (PHIPA s.16 / PIPEDA openness): what's collected, the
      named processors, **cross-border processing disclosed**, retention,
      contact. Owner signs off before go-live.
- [ ] Linked from the chat, the plan gate, and emails.
- [ ] Emails never name the unlock credential ("use your date of birth" is
      handing over lock and key together).

### 10. Retention
- [ ] Weekly cron purges conversation logs older than RETENTION_DAYS
      (default 90); CRON_SECRET bearer auth; dry-run mode for verification.

### 11. Headers & indexing
- [ ] HSTS, nosniff, Referrer-Policy site-wide; `X-Robots-Tag: noindex` on
      every patient/staff surface; robots.txt disallow; CORS pinned to real
      origins.

### 12. Third parties
- [ ] Anything leaving your systems (e.g. web-research queries) is stripped of
      contact info server-side, and the tool prompt forbids patient context.
- [ ] Service-provider agreements executed and recorded per deployment:
      Anthropic (zero-data-retention terms), Vercel DPA, Resend DPA, EMR,
      search provider.

## Key files (this repo)

| Concern | File |
|---|---|
| Rate limiting | `lib/rate-limit.ts` |
| Audit log | `lib/audit.ts` |
| Passphrase hashing | `lib/passphrase.ts` |
| Random slugs | `lib/slug.ts`, `randomSlug()` in `lib/patient-plans.ts` |
| Encryption + rotation | `lib/crypto.ts` |
| Encrypted conversation store | `lib/conversation-store.ts` |
| Expiring tokens + session tokens | `lib/staff-auth.ts` |
| Uniform unlock + passphrase | `app/api/plans/[slug]/unlock`, `.../passphrase` |
| Reissue (single + bulk) | `app/api/plans/[slug]/reissue`, `secure-urls` action in `app/api/plans/route.ts` |
| Retention purge | `app/api/retention/route.ts` + `vercel.json` cron |
| Log gating | `app/api/log-conversation`, `app/api/submit-consult`, `lib/log-guards.ts` |
| Headers/noindex | `next.config.js`, `app/robots.ts` |
| Privacy notice | `app/privacy/page.tsx` (templated from `lib/clinic-config.ts`) |

## Per-deployment go-live steps

1. Set env: KNOWLEDGE_KEY (32-byte hex), ADMIN_PASSWORD (long, unique — never
   reused across deployments), ONBOARD_PASSWORD, CRON_SECRET, RETENTION_DAYS,
   UPSTASH_REDIS_REST_URL/TOKEN, clinic identity vars.
2. Owner reviews and signs off `/privacy` (correct contact + jurisdiction).
3. After first real plans exist: verify every blob is encrypted, then set
   STRICT_PLAN_ENCRYPTION=1.
4. Execute vendor agreements (Anthropic ZDR, Vercel DPA, Resend DPA, EMR).
5. Record the review date; re-run this checklist annually and after any
   data-flow change.
