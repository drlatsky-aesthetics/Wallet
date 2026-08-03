// lib/pass-template.js
// Builds the pass.json payload for Treasury Aesthetics Apple Wallet passes.
// Pass type: storeCard | Colours: Apple Wallet uses CSS rgb() only (no hex)
//
// Design (owner-approved 2026-08-03): patient-page palette — charcoal-black
// ground #0E0D0B, plan-page gold #C9A94A labels, warm cream #E8E4DC text.
// The strip artwork (assets/pass/strip*.png) carries the gold hairline
// borders, serif TA watermark, and clinic tagline; Wallet draws the member
// name on top of it. Front is deliberately spare: identity, location,
// member-since, QR. Portal/booking/terms live on the back.

// referralCode: if provided, encodes in QR instead of targetUrl
// planUrl: patient's personal plan page — shown in back fields
// membershipTier: "standard" | "reserve" | "vault" — header tier label
//   (the tier-colored TA coin is chosen in generate-pass-buffer)
// refreshUrl: self-service refresh link on the back — re-downloads the pass
//   with current Phorest name + membership; same serial → Wallet replaces
export function buildPassTemplate({ serialNumber, targetUrl, memberName, referralCode, planUrl, membershipTier, refreshUrl }) {
  const qrMessage = referralCode || targetUrl;
  const portalUrl = planUrl || targetUrl;
  const tierValue =
    membershipTier === "vault"   ? "Vault Member"   :
    membershipTier === "reserve" ? "Reserve Member" : "Member";

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    serialNumber,
    teamIdentifier: process.env.APPLE_TEAM_ID,

    organizationName: "Treasury Aesthetics",
    description: "Treasury Aesthetics Digital Loyalty Pass",

    backgroundColor: "rgb(14, 13, 11)",
    foregroundColor: "rgb(232, 228, 220)",
    labelColor:      "rgb(201, 169, 74)",

    logoText: "Treasury Aesthetics",

    storeCard: {
      headerFields: [
        {
          key:   "status",
          label: "TREASURY",
          value: tierValue,
          textAlignment: "PKTextAlignmentRight",
        },
      ],

      // Rendered on the strip artwork — no label, the strip's baked tagline
      // carries "PHYSICIAN-LED MEDICAL AESTHETICS" at bottom-right.
      primaryFields: [
        {
          key:   "member",
          label: "",
          value: memberName || "Treasury Aesthetics",
          textAlignment: "PKTextAlignmentLeft",
        },
      ],

      secondaryFields: [
        {
          key:   "location",
          label: "LOCATION",
          value: "Toronto, ON",
        },
        {
          key:   "since",
          label: "MEMBER SINCE",
          // NOTE: plain string, no dateStyle — dateStyle on a non-date value
          // causes Wallet to reject the pass
          value: new Date().toLocaleDateString("en-CA", {
            year:  "numeric",
            month: "long",
          }),
          textAlignment: "PKTextAlignmentRight",
        },
      ],

      backFields: [
        {
          key:   "about",
          label: "About Treasury Aesthetics",
          value:
            "Physician-led medical aesthetics clinic in Toronto, Ontario. " +
            "Clinical precision meets luxury care — led by Dr. Jason Latsky.",
        },
        {
          key:             "plan",
          label:           "Your Personal Plan",
          value:           portalUrl,
          attributedValue: `<a href='${portalUrl}'>${portalUrl}</a>`,
        },
        {
          key:             "book",
          label:           "Book an Appointment",
          value:           "treasuryaesthetics.ca",
          attributedValue: "<a href='https://treasuryaesthetics.ca'>treasuryaesthetics.ca</a>",
        },
        {
          key:             "contact",
          label:           "Contact",
          value:           "aesthetics@treasuryhealth.ca",
          attributedValue: "<a href='mailto:aesthetics@treasuryhealth.ca'>aesthetics@treasuryhealth.ca</a>",
        },
        ...(refreshUrl ? [{
          key:             "refresh",
          label:           "Refresh My Pass",
          value:           "Tap to update your name and membership tier from our records — your pass is replaced in place.",
          attributedValue: `<a href='${refreshUrl}'>Update my pass now</a>`,
        }] : []),
        {
          key:   "terms",
          label: "Terms",
          value:
            "This pass is issued by Treasury Aesthetics. " +
            "Present at reception or scan to share your referral code.",
        },
      ],
    },

    // barcodes: modern (iOS 9+), barcode: legacy fallback
    // altText: the referral code is human-readable under the QR so reception
    // can key it in without scanning.
    barcodes: [
      {
        message:         qrMessage,
        format:          "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText:         referralCode || "treasuryaesthetics.ca",
      },
    ],
    barcode: {
      message:         qrMessage,
      format:          "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText:         referralCode || "treasuryaesthetics.ca",
    },

    // ── Relevance (optional — shows pass on lock screen near clinic) ──────
    // Uncomment and add coordinates once clinic address is confirmed
    // locations: [
    //   {
    //     longitude: -79.3832,
    //     latitude:  43.6532,
    //     relevantText: "Welcome to Treasury Aesthetics",
    //   },
    // ],
    // maxDistance: 500, // metres

    // ── Web service (optional — enables push updates to passes) ──────────
    // Required only if you want to update passes after issue (e.g. credit balance)
    // webServiceURL: "https://your-domain.com/api/wallet",
    // authenticationToken: "your-16-char-min-token",
  };
}
