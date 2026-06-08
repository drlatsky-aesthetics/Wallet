// api/send-pass.js
// Sends wallet pass emails to clients chosen in the admin panel.
// Email contains an "Add to Apple Wallet" button linking to the pass landing page.
// No .pkpass file attachment — keeps email clean and avoids spam-filter triggers.
// POST body: { clients: [{ id, firstName, lastName, email }] }

import { markSent }           from "../lib/kv.js";
import { generatePassBuffer } from "../lib/generate-pass-buffer.js";

function buildEmailHtml(firstName, fullName, tier = "standard", clientId = null) {
  const baseUrl = process.env.PASS_BASE_URL || "https://wallet-tau-green.vercel.app";
  const passUrl = `${baseUrl}/api/generate-pass?member=${encodeURIComponent(fullName)}&tier=${encodeURIComponent(tier)}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ""}`;
  // Note: email is designed for iOS Mail light mode — body backgrounds are stripped by iOS Mail.
  // Cream (#FAF8F4) background on the card gives a warm luxury feel that survives rendering.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;padding:48px 24px 32px;">

    <!-- Wordmark -->
    <tr><td style="text-align:center;padding-bottom:4px;">
      <p style="font-size:9px;letter-spacing:5px;color:#C9A55A;margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">TREASURY AESTHETICS</p>
    </td></tr>

    <!-- Heading -->
    <tr><td style="text-align:center;padding-bottom:8px;">
      <h1 style="font-size:30px;font-weight:400;color:#161614;margin:6px 0 0;line-height:1.25;font-family:Georgia,serif;">Your Loyalty Pass<br>is Ready</h1>
    </td></tr>

    <!-- Gold rule -->
    <tr><td style="text-align:center;padding-bottom:36px;">
      <table cellpadding="0" cellspacing="0" style="margin:14px auto 0;">
        <tr>
          <td style="width:24px;height:1px;background:transparent;"></td>
          <td style="width:48px;height:1px;background:#C9A55A;opacity:0.4;"></td>
          <td style="width:8px;height:1px;"></td>
          <td style="width:6px;height:6px;border-radius:50%;background:#C9A55A;vertical-align:middle;"></td>
          <td style="width:8px;height:1px;"></td>
          <td style="width:48px;height:1px;background:#C9A55A;opacity:0.4;"></td>
          <td style="width:24px;height:1px;background:transparent;"></td>
        </tr>
      </table>
    </td></tr>

    <!-- Card -->
    <tr><td style="background:#FDFBF7;border-radius:16px;border:1px solid rgba(201,165,90,0.25);padding:36px 32px;text-align:center;box-shadow:0 2px 16px rgba(22,22,20,0.06);">

      <!-- Greeting -->
      <p style="color:#2A2820;font-size:15px;line-height:1.7;margin:0 0 10px;font-family:Georgia,serif;">
        Dear ${firstName},
      </p>
      <p style="color:#5A5650;font-size:14px;line-height:1.75;margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
        Welcome to Treasury Aesthetics. Your personalised<br>loyalty pass is attached — tap it to add<br>to Apple Wallet.
      </p>

      <!-- Divider -->
      <div style="width:40px;height:1px;background:rgba(201,165,90,0.3);margin:0 auto 0;"></div>

    </td></tr>

    <!-- Footer -->
    <tr><td style="text-align:center;padding-top:28px;padding-bottom:8px;">
      <p style="color:#B0A898;font-size:10px;letter-spacing:0.3px;margin:0;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
        Physician-led medical aesthetics &nbsp;·&nbsp; Toronto, ON<br>
        <a href="https://treasuryaesthetics.ca" style="color:#C9A55A;text-decoration:none;">treasuryaesthetics.ca</a>
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
    const { id, firstName, lastName, email, membershipTier = "standard" } = client;
    if (!email) {
      results.errors.push({ id, name: `${firstName} ${lastName}`.trim(), error: "No email address" });
      continue;
    }

    const name = `${firstName} ${lastName}`.trim();

    try {
      // Generate the signed .pkpass — attached silently so iOS Mail shows
      // its native "Add to Apple Wallet" banner without cluttering the email UI.
      const passBuffer = await generatePassBuffer(name, membershipTier, id);

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
          html:    buildEmailHtml(firstName || "there", name, membershipTier, id),
          attachments: [
            {
              filename:     "Loyalty Pass.pkpass",
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
