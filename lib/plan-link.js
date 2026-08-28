// lib/plan-link.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-client treatment-plan pointer URL for pass QR codes.
//
// Instead of one global PASS_TARGET_URL, each pass encodes a PERMANENT
// pointer — https://plans.treasuryaesthetics.ca/w/<wid> — that the
// treasury-agent app resolves to the client's CURRENT treatment-plan page
// (302). The plan's own URL can change (patient customization, privacy
// reissue) without ever re-issuing a pass; clients with no plan yet are
// redirected to the public clinic site until a plan exists, at which point
// the same QR "lights up" automatically.
//
// wid = HMAC-SHA256(PASS_LINK_SECRET, "wallet-link-v1:" + clientId), first
// 12 bytes mapped onto the shared slug alphabet. MUST stay byte-identical to
// walletLinkId() in treasury-agent's lib/wallet-link.ts (a pinned fixture in
// its tests/wallet-link.test.ts guards the other side) — PASS_LINK_SECRET is
// the same value in both Vercel projects. The HMAC keeps the Phorest client
// ID itself out of the URL.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function planLinkUrl(clientId) {
  const secret = process.env.PASS_LINK_SECRET;
  const id = String(clientId ?? "").trim();
  if (!secret || !id) return null;
  const digest = crypto.createHmac("sha256", secret).update(`wallet-link-v1:${id}`).digest();
  let wid = "";
  for (let i = 0; i < 12; i++) wid += ALPHABET[digest[i] % ALPHABET.length];
  const base = (process.env.PLANS_BASE_URL || "https://plans.treasuryaesthetics.ca").replace(/\/$/, "");
  return `${base}/w/${wid}`;
}
