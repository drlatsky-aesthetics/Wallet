// api/list-clients.js
// GET /api/list-clients?hours=720
// Returns Phorest clients with pass-sent status from KV.
// Requires Authorization: Bearer {CRON_SECRET}

import { getSentList } from "../lib/kv.js";

const PHOREST_BASE = "https://platform.phorest.com/third-party-api-server/api/business";

function phorestAuth() {
  return "Basic " + Buffer.from(`${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`).toString("base64");
}

async function fetchAllClients(sinceISO) {
  const bizId = encodeURIComponent(process.env.PHOREST_BUSINESS_ID);
  let clients = [], page = 0;
  while (true) {
    const url = `${PHOREST_BASE}/${bizId}/client?updatedAt=${sinceISO}&page=${page}&size=100`;
    const res = await fetch(url, { headers: { Authorization: phorestAuth(), Accept: "application/json" } });
    if (!res.ok) throw new Error(`Phorest fetch failed: ${res.status}`);
    const data = await res.json();
    const batch = data?._embedded?.clients ?? [];
    clients = clients.concat(batch);
    if (page + 1 >= (data?.page?.totalPages ?? 1)) break;
    page++;
  }
  return clients;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers["authorization"] !== `Bearer ${secret}`) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const hours = parseInt(req.query.hours ?? "720", 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const [phorestClients, sentRaw] = await Promise.all([fetchAllClients(since), getSentList()]);
    const sentIds = new Set(sentRaw ?? []);

    const clients = phorestClients.map(c => ({
      id:        c.clientId,
      firstName: c.firstName ?? "",
      lastName:  c.lastName  ?? "",
      email:     c.email     ?? null,
      status:    sentIds.has(c.clientId) ? "sent" : c.email ? "unsent" : "no-email",
    }));

    const order = { unsent: 0, sent: 1, "no-email": 2 };
    clients.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    return res.status(200).json({ since, total: clients.length, clients });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
