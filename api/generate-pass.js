import { generatePassBuffer } from "../lib/generate-pass-buffer.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin",
    process.env.ALLOWED_ORIGIN || "https://wallet-tau-green.vercel.app");

  try {
    const memberName   = req.query.member ? decodeURIComponent(req.query.member) : null;
    const pkpassBuffer = await generatePassBuffer(memberName);

    res.setHeader("Content-Type",   "application/vnd.apple.pkpass");
    res.setHeader("Content-Length", pkpassBuffer.length);
    res.setHeader("Cache-Control",  "no-store");
    return res.status(200).send(pkpassBuffer);

  } catch (error) {
    console.error("[Treasury Wallet] PKPass generation failed:", error);
    const isCertError = error.message?.includes("environment variables");
    return res.status(isCertError ? 503 : 500).json({
      error: isCertError ? "Pass service not configured" : "Failed to generate pass",
    });
  }
}
