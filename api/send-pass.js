// api/send-pass.js
// Sends wallet pass emails to clients chosen in the admin panel.
// Email contains an "Add to Apple Wallet" button linking to the pass landing page.
// No .pkpass file attachment — keeps email clean and avoids spam-filter triggers.
// POST body: { clients: [{ id, firstName, lastName, email }] }

import { markSent }           from "../lib/kv.js";
import { generatePassBuffer } from "../lib/generate-pass-buffer.js";

function buildEmailHtml(firstName, fullName, tier = "standard") {
  const baseUrl = process.env.PASS_BASE_URL || "https://wallet-tau-green.vercel.app";
  const passUrl = `${baseUrl}/api/generate-pass?member=${encodeURIComponent(fullName)}&tier=${encodeURIComponent(tier)}`;
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
      <p style="color:#2A2820;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Georgia,serif;">
        Dear ${firstName},
      </p>
      <p style="color:#5A5650;font-size:14px;line-height:1.75;margin:0 0 32px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
        Welcome to Treasury Aesthetics. Your personalised<br>loyalty pass is attached below — tap it to add<br>directly to Apple Wallet.
      </p>

      <!-- Divider before button -->
      <div style="width:40px;height:1px;background:rgba(201,165,90,0.3);margin:0 auto 28px;"></div>

      <!-- Apple Wallet button -->
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
        <tr>
          <td style="background:#161614;border-radius:10px;border:1px solid rgba(201,165,90,0.4);">
            <a href="${passUrl}" style="display:block;padding:12px 22px;text-decoration:none;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="22" viewBox="0 0 814 1000">
                      <path fill="#fff" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-103.4C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.5 269-317.5 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49.1 188.8-49.1 30.5.1 111.9 2.9 166.8 72.3zm-256.6-166.5c31.4-37.9 53.5-90.8 53.5-143.7 0-7.3-.6-14.6-1.9-21.2-50.7 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 137.2 0 8.2 1.4 16.4 1.9 19.2 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.1-68.6z"/>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:10px;color:#F5F0E8;letter-spacing:0.5px;line-height:1.2;">Add to</span>
                    <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:17px;font-weight:600;color:#ffffff;white-space:nowrap;line-height:1.3;">Apple Wallet</span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
      </table>

      <!-- Pass attachment hint -->
      <p style="color:#9A9488;font-size:11px;margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:0.2px;">
        Your Loyalty Pass is attached below ↓
      </p>

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
      const passBuffer = await generatePassBuffer(name, membershipTier);

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
          html:    buildEmailHtml(firstName || "there", name, membershipTier),
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
