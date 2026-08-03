// lib/kv.js
// Graceful Vercel KV wrapper. Dynamic import prevents crash when env vars are absent.

const KV_SET_KEY = "treasury:sent_client_ids";

function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getSentIds() {
  if (!kvConfigured()) {
    console.warn("[Treasury] KV not configured — no deduplication. Set KV_REST_API_URL and KV_REST_API_TOKEN.");
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
