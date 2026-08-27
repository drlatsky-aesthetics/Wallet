// lib/pass-store.js
// KV-backed per-pass state: each client's personal patient-page URL (the
// PHIPA-safe random-slug plan link from the Treasury agent), per-pass web
// service auth tokens + rebuild metadata, and Apple Wallet device
// registrations. Everything degrades gracefully when KV isn't configured —
// passes still generate, they just fall back to the static PASS_TARGET_URL
// and can't refresh.

import { randomBytes } from "crypto";

const URL_HASH   = "treasury:pass_plan_urls";  // clientId → plan URL
const META_HASH  = "treasury:pass_meta";       // serial   → { memberName, tier, clientId, updatedAt }
const AUTH_HASH  = "treasury:pass_auth";       // serial   → web-service auth token
const regsKey    = (serial) => `treasury:pass_regs:${serial}`;    // hash: deviceLibraryId → pushToken
const deviceKey  = (dlid)   => `treasury:device_serials:${dlid}`; // set of serials on that device

function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvClient() {
  const { kv } = await import("@vercel/kv");
  return kv;
}

// @vercel/kv auto-JSON-serializes values; older writes may come back as strings.
function parseMaybe(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}

// ── Per-client plan URL ───────────────────────────────────────────────────────

export async function getPlanUrl(clientId) {
  if (!kvConfigured() || !clientId) return null;
  try {
    const kv = await kvClient();
    const url = await kv.hget(URL_HASH, clientId);
    return typeof url === "string" && url ? url : null;
  } catch (e) {
    console.warn("[Treasury] pass-store getPlanUrl failed:", e.message);
    return null;
  }
}

export async function setPlanUrl(clientId, url) {
  if (!kvConfigured() || !clientId) return false;
  try {
    const kv = await kvClient();
    if (url) {
      await kv.hset(URL_HASH, { [clientId]: url });
    } else {
      await kv.hdel(URL_HASH, clientId);
    }
    await touchPass(serialForClient(clientId), { clientId });
    return true;
  } catch (e) {
    console.warn("[Treasury] pass-store setPlanUrl failed:", e.message);
    return false;
  }
}

export async function listPlanUrls() {
  if (!kvConfigured()) return {};
  try {
    const kv = await kvClient();
    return (await kv.hgetall(URL_HASH)) ?? {};
  } catch {
    return {};
  }
}

/** Rewrite every stored plan URL that equals fromUrl (e.g. a patient renamed
 *  their page). toUrl of null/"" clears the mapping instead. Returns the
 *  affected clientIds. */
export async function movePlanUrl(fromUrl, toUrl) {
  const all = await listPlanUrls();
  const moved = [];
  for (const [clientId, url] of Object.entries(all)) {
    if (url === fromUrl) {
      await setPlanUrl(clientId, toUrl || null);
      moved.push(clientId);
    }
  }
  return moved;
}

// ── Pass metadata + auth tokens (web service) ─────────────────────────────────

export function serialForClient(clientId) {
  return `treasury-${clientId}`;
}

export async function getPassMeta(serial) {
  if (!kvConfigured() || !serial) return null;
  try {
    const kv = await kvClient();
    return parseMaybe(await kv.hget(META_HASH, serial));
  } catch {
    return null;
  }
}

/** Record what's needed to rebuild this pass on refresh. updatedAt is only
 *  bumped when the stored fields actually change (or on an explicit touch) —
 *  a plain refresh re-save must NOT look like an update, or devices would
 *  re-fetch the pass forever. */
export async function savePassMeta(serial, meta, { touch = false } = {}) {
  if (!kvConfigured() || !serial) return;
  try {
    const kv = await kvClient();
    const existing = parseMaybe(await kv.hget(META_HASH, serial)) ?? {};
    const changed = Object.entries(meta).some(([k, v]) => existing[k] !== v);
    const updatedAt = (touch || changed || !existing.updatedAt) ? Date.now() : existing.updatedAt;
    await kv.hset(META_HASH, {
      [serial]: { ...existing, ...meta, updatedAt },
    });
  } catch (e) {
    console.warn("[Treasury] pass-store savePassMeta failed:", e.message);
  }
}

/** Bump updatedAt so registered devices see the pass as changed. */
export async function touchPass(serial, seed = {}) {
  await savePassMeta(serial, seed, { touch: true });
}

/** Auth token the pass embeds and iOS echoes back on web-service calls.
 *  Stable per serial so re-issued passes keep working. */
export async function getOrCreateAuthToken(serial) {
  if (!kvConfigured() || !serial) return null;
  try {
    const kv = await kvClient();
    const existing = await kv.hget(AUTH_HASH, serial);
    if (typeof existing === "string" && existing.length >= 16) return existing;
    const token = randomBytes(16).toString("hex");
    await kv.hset(AUTH_HASH, { [serial]: token });
    return token;
  } catch (e) {
    console.warn("[Treasury] pass-store auth token failed:", e.message);
    return null;
  }
}

export async function verifyAuthToken(serial, token) {
  if (!kvConfigured() || !serial || !token) return false;
  try {
    const kv = await kvClient();
    return (await kv.hget(AUTH_HASH, serial)) === token;
  } catch {
    return false;
  }
}

// ── Device registrations (Apple Wallet web service protocol) ─────────────────

export async function registerDevice(dlid, serial, pushToken) {
  if (!kvConfigured()) return "unavailable";
  const kv = await kvClient();
  const existed = await kv.hget(regsKey(serial), dlid);
  await kv.hset(regsKey(serial), { [dlid]: pushToken || "" });
  await kv.sadd(deviceKey(dlid), serial);
  return existed != null ? "existing" : "created";
}

export async function unregisterDevice(dlid, serial) {
  if (!kvConfigured()) return;
  const kv = await kvClient();
  await kv.hdel(regsKey(serial), dlid);
  await kv.srem(deviceKey(dlid), serial);
}

/** Serials registered on a device that changed after `sinceTag` (our tag is
 *  the updatedAt epoch-millis as a string). */
export async function serialsUpdatedSince(dlid, sinceTag) {
  if (!kvConfigured()) return { serialNumbers: [], lastUpdated: null };
  const kv = await kvClient();
  const serials = (await kv.smembers(deviceKey(dlid))) ?? [];
  const since = sinceTag ? parseInt(sinceTag, 10) || 0 : 0;
  const out = [];
  let latest = since;
  for (const serial of serials) {
    const meta = parseMaybe(await kv.hget(META_HASH, serial));
    const updatedAt = meta?.updatedAt ?? 0;
    if (updatedAt > since) out.push(serial);
    if (updatedAt > latest) latest = updatedAt;
  }
  return { serialNumbers: out, lastUpdated: String(latest) };
}
