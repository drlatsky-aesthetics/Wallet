// lib/phorest.js
// Shared Phorest third-party API helpers: client lookup + membership tier.
//
// Membership tiers are read from Phorest CLIENT CATEGORIES by name:
//   category name matching /vault/i   → "vault"   (gold coin)
//   category name matching /reserve/i → "reserve" (silver coin)
//   anything else / no category       → "standard" (bronze coin)
// Setup (owner action, once): in Phorest create client categories named
// "Treasury Vault" and "Treasury Reserve" and tag members — passes pick the
// tier up automatically on issue and on refresh.

const PHOREST_BASE = "https://platform.phorest.com/third-party-api-server/api/business";

function auth() {
  return "Basic " + Buffer.from(`${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`).toString("base64");
}

function bizId() {
  // Business ID contains '=' chars — must be URL-encoded in path segments
  return encodeURIComponent(process.env.PHOREST_BUSINESS_ID);
}

async function get(path) {
  const res = await fetch(`${PHOREST_BASE}/${bizId()}${path}`, {
    headers: { Authorization: auth(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Phorest ${path} → ${res.status}`);
  return res.json();
}

/** Fetch one client by ID. Returns null on any failure. */
export async function getClient(clientId) {
  try {
    return await get(`/client/${encodeURIComponent(clientId)}`);
  } catch {
    return null;
  }
}

/** Search recent clients (2 years) for an email match. Returns null if none. */
export async function findClientByEmail(email) {
  const since = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
  let page = 0;
  while (true) {
    let data;
    try {
      data = await get(`/client?updatedAt=${since}&page=${page}&size=100`);
    } catch {
      return null;
    }
    const clients = data?._embedded?.clients ?? [];
    const match = clients.find(c => c.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (page + 1 >= (data?.page?.totalPages ?? 1)) return null;
    page++;
  }
}

/** categoryId → name map for the business. Empty map on failure. */
export async function getCategoryNames() {
  try {
    const data = await get("/category/client?size=100");
    const map = {};
    for (const c of data?._embedded?.clientCategories ?? []) {
      if (c?.categoryId && c?.name) map[c.categoryId] = c.name;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Membership tier for a client: "vault" | "reserve" | "standard".
 * Pass a prefetched category map when issuing in a batch.
 */
export async function clientTier(client, categoryNames = null) {
  const ids = client?.clientCategoryIds ?? [];
  if (!ids.length) return "standard";
  const names = categoryNames ?? await getCategoryNames();
  const joined = ids.map(id => names[id] ?? "").join(" ");
  if (/vault/i.test(joined)) return "vault";
  if (/reserve/i.test(joined)) return "reserve";
  return "standard";
}
