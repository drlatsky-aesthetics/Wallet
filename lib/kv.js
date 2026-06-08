// lib/kv.js
// Thin wrapper around @vercel/kv that degrades gracefully when KV env vars
// are not yet configured. Functions return empty results instead of throwing.

const KV_SET_KEY = "treasury:sent_client_ids";

function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getSentIds() {
  if (!kvConfigured()) {
    console.warn("[Treasury] KV not configured — running without deduplication. Set up Vercel KV to enable.");
    return new Set();
  }
  try {
    const { kv } = await import("@vercel/kv");
    const ids = await kv.smembers(KV_SET_KEY);
    return new Set(ids ?? []);
  } catch (e) {
    console.warn("[Treasury] KV read failed:", e.message);
    return new Set();
  }
}

export async function markSent(clientId) {
  if (!kvConfigured()) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.sadd(KV_SET_KEY, clientId);
  } catch (e) {
    console.warn("[Treasury] KV write failed for", clientId, ":", e.message);
  }
}

export async function getSentList() {
  if (!kvConfigured()) return [];
  try {
    const { kv } = await import("@vercel/kv");
    return (await kv.smembers(KV_SET_KEY)) ?? [];
  } catch {
    return [];
  }
}
