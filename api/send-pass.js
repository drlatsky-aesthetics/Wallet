// api/send-pass.js
// Sends wallet pass emails to clients chosen in the admin panel.
// The .pkpass file is generated server-side and attached directly to the email.
// iOS Mail natively shows "Add to Apple Wallet" for pkpass attachments —
// no link, no browser, no WKWebView download issues.
// POST body: { clients: [{ id, firstName, lastName, email }] }

import { markSent }           from "../lib/kv.js";
import { generatePassBuffer } from "../lib/generate-pass-buffer.js";

function buildEmailHtml(firstName) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#161614;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;padding:40px 20px;">
    <tr><td style="text-align:center;padding-bottom:8px;">
      <p style="font-size:10px;letter-spacing:4px;color:#C9A55A;margin:0;">TREASURY AESTHETICS</p>
    </td></tr>
    <tr><td style="text-align:center;padding-bottom:32px;">
      <h1 style="font-size:28px;font-weight:400;color:#F5F0E8;margin:8px 0;">Your Loyalty Pass<br>is Ready</h1>
      <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,#C9A55A,transparent);margin:16px auto;"></div>
    </td></tr>
    <tr><td style="background:#1E1E1C;border-radius:16px;border:1px solid rgba(201,165,90,0.2);padding:32px;text-align:center;">
      <p style="color:#F5F0E8;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Hi ${firstName},<br><br>
        Welcome to Treasury Aesthetics. Your personalised loyalty pass is attached to this email — tap it to add it directly to Apple Wallet.
      </p>
      <p style="color:rgba(245,240,232,0.5);font-size:12px;margin:0;">
        Look for <strong style="color:#C9A55A;">treasury-pass.pkpass</strong> below this message.
      </p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:32px;">
      <p style="color:rgba(245,240,232,0.3);font-size:11px;letter-spacing:0.3px;margin:0;">
        Physician-led medical aesthetics · Toronto, ON<br>
        <a href="https://treasuryaesthetics.ca" style="color:#C9A55A;">treasuryaesthetics.ca</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers["authorization"] !== `Bearer ${secret}`) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { clients } = req.body ?? {};
  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty clients array" });
  }

  const results = { sent: [], errors: [] };

  for (const client of clients) {
    const { id, firstName, lastName, email } = client;
    if (!email) {
      results.errors.push({ id, name: `${firstName} ${lastName}`.trim(), error: "No email address" });
      continue;
    }

    const name = `${firstName} ${lastName}`.trim();

    try {
      // Generate the signed .pkpass buffer for this client
      const passBuffer = await generatePassBuffer(`${firstName} ${lastName}`.trim());

      const res2 = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    process.env.RESEND_FROM_EMAIL || "Treasury Aesthetics <hello@treasuryaesthetics.ca>",
          to:      [email],
          subject: "Your Treasury Aesthetics Loyalty Pass",
          html:    buildEmailHtml(firstName || "there"),
          attachments: [
            {
              filename:     "treasury-pass.pkpass",
              content:      passBuffer.toString("base64"),
              content_type: "application/vnd.apple.pkpass",
            },
          ],
        }),
      });

      if (!res2.ok) throw new Error(await res2.text());

      await markSent(id);
      results.sent.push({ id, name, email });

    } catch (err) {
      results.errors.push({ id, name, error: err.message });
    }
  }

  return res.status(200).json(results);
}
