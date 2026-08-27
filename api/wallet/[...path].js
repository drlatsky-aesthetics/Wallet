// api/wallet/[...path].js
// Apple Wallet pass web service (PassKit Web Service REST spec, v1).
// The pass embeds webServiceURL = <PASS_BASE_URL>/api/wallet — iOS calls:
//
//   POST   v1/devices/:dlid/registrations/:passTypeId/:serial   (register)
//   DELETE v1/devices/:dlid/registrations/:passTypeId/:serial   (unregister)
//   GET    v1/devices/:dlid/registrations/:passTypeId?passesUpdatedSince=tag
//   GET    v1/passes/:passTypeId/:serial                        (latest pass)
//   POST   v1/log
//
// This is what makes the pass refreshable: when a patient's page URL changes
// (recorded via /api/pass-url), the next refresh — pull-down on the back of
// the pass, or an iOS periodic check — re-fetches the pass here and it is
// rebuilt with the current link.

import { generatePassBuffer } from "../../lib/generate-pass-buffer.js";
import {
  getPassMeta, verifyAuthToken, registerDevice, unregisterDevice,
  serialsUpdatedSince,
} from "../../lib/pass-store.js";

function applePassToken(req) {
  const header = req.headers["authorization"] || "";
  const m = header.match(/^ApplePass\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export default async function handler(req, res) {
  // Path after /api/wallet, e.g. ["v1","devices","<dlid>","registrations",...]
  const path = (req.url || "").split("?")[0]
    .replace(/^\/api\/wallet\/?/, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  try {
    if (path[0] !== "v1") return res.status(404).json({ error: "Not found" });

    // ── POST v1/log — device-reported errors, worth keeping in Vercel logs ──
    if (path[1] === "log" && req.method === "POST") {
      const logs = req.body?.logs;
      if (Array.isArray(logs)) logs.forEach((l) => console.warn("[Treasury Wallet] device log:", l));
      return res.status(200).end();
    }

    // ── v1/devices/:dlid/registrations/:passTypeId[/:serial] ────────────────
    if (path[1] === "devices" && path[3] === "registrations") {
      const dlid       = path[2];
      const passTypeId = path[4];
      const serial     = path[5];
      if (!dlid || passTypeId !== process.env.APPLE_PASS_TYPE_ID) {
        return res.status(404).json({ error: "Not found" });
      }

      // GET — serials on this device updated since the tag (no auth per spec)
      if (!serial && req.method === "GET") {
        const sinceTag = new URL(req.url, "http://x").searchParams.get("passesUpdatedSince");
        const { serialNumbers, lastUpdated } = await serialsUpdatedSince(dlid, sinceTag);
        if (!serialNumbers.length) return res.status(204).end();
        return res.status(200).json({ serialNumbers, lastUpdated });
      }

      if (!serial) return res.status(405).end();
      if (!(await verifyAuthToken(serial, applePassToken(req)))) {
        return res.status(401).end();
      }

      if (req.method === "POST") {
        const outcome = await registerDevice(dlid, serial, req.body?.pushToken);
        if (outcome === "unavailable") return res.status(503).end();
        return res.status(outcome === "created" ? 201 : 200).end();
      }
      if (req.method === "DELETE") {
        await unregisterDevice(dlid, serial);
        return res.status(200).end();
      }
      return res.status(405).end();
    }

    // ── GET v1/passes/:passTypeId/:serial — serve the latest signed pass ───
    if (path[1] === "passes" && req.method === "GET") {
      const passTypeId = path[2];
      const serial     = path[3];
      if (passTypeId !== process.env.APPLE_PASS_TYPE_ID || !serial) {
        return res.status(404).json({ error: "Not found" });
      }
      if (!(await verifyAuthToken(serial, applePassToken(req)))) {
        return res.status(401).end();
      }
      const meta = await getPassMeta(serial);
      if (!meta) return res.status(404).end();

      // 304 when nothing changed since the device's copy
      const updatedAt = meta.updatedAt ?? Date.now();
      const ims = req.headers["if-modified-since"];
      if (ims) {
        const since = Date.parse(ims);
        // Last-Modified has 1s resolution — compare at the same resolution
        if (!Number.isNaN(since) && Math.floor(updatedAt / 1000) <= Math.floor(since / 1000)) {
          return res.status(304).end();
        }
      }

      const buffer = await generatePassBuffer(meta.memberName, meta.tier || "standard", meta.clientId);
      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Last-Modified", new Date(updatedAt).toUTCString());
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(buffer);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (err) {
    console.error("[Treasury Wallet] web service error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
