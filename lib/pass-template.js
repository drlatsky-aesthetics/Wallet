// lib/pass-template.js
// ─────────────────────────────────────────────────────────────────────────────
// Builds the pass.json payload for Treasury Aesthetics Apple Wallet passes.
//
// Pass type: storeCard  →  ideal for loyalty/membership passes
// Colour spec: Apple Wallet uses CSS rgb() notation only (no hex)
//
// QR destination: currently set to PASS_TARGET_URL env var (treasuryhealth.ca).
// Replace with patient sign-in portal URL when ready.
// ─────────────────────────────────────────────────────────────────────────────

export function buildPassTemplate({ serialNumber, targetUrl, memberName }) {
  return {
    // ── Required metadata ─────────────────────────────────────────────────
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    // e.g. "pass.ca.treasuryhealth.loyalty" — must match your Apple Dev portal
    serialNumber,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    // 10-character Apple Developer Team ID from developer.apple.com/account

    // ── Organisation ──────────────────────────────────────────────────────
    organizationName: "Treasury Aesthetics",
    description: "Treasury Aesthetics Digital Loyalty Pass",

    // ── Branding colours ──────────────────────────────────────────────────
    // Charcoal body, cream text, gold labels — Treasury brand
    backgroundColor: "rgb(22, 22, 20)",    // #161614
    foregroundColor: "rgb(245, 240, 232)", // #F5F0E8
    labelColor:      "rgb(201, 165, 90)",  // #C9A55A

    // Logo text appears next to the logo image at the top of the pass
    logoText: "Treasury Aesthetics",

    // ── Pass fields (storeCard layout — Option C: strip image) ───────────
    // strip.png sits behind primaryFields as a full-width banner.
    // Primary field value is rendered large over the strip by Wallet.
    // Secondary + auxiliary fields appear below the strip.
    storeCard: {
      headerFields: [
        {
          key:           "status",
          label:         "",
          value:         "MEMBER",
          textAlignment: "PKTextAlignmentRight",
        },
      ],

      primaryFields: [
        {
          key:           "patient",
          label:         "PATIENT",
          value:         memberName || "Treasury Aesthetics",
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
          key:   "portal",
          label: "PATIENT PORTAL",
          value: "treasuryaesthetics.ca",
        },
      ],

      auxiliaryFields: [
        {
          key:   "issued",
          label: "ISSUED",
          value: new Date().toLocaleDateString("en-CA", {
            year: "numeric", month: "long", day: "numeric",
          }),
        },
        {
          key:   "type",
          label: "PASS TYPE",
          value: "Loyalty Pass",
        },
      ],

      // Back of pass — shown when patient taps the (i) icon
      backFields: [
        {
          key:   "about",
          label: "About Treasury Aesthetics",
          value:
            "Physician-led medical aesthetics clinic in Toronto, Ontario. " +
            "Clinical precision meets luxury care — led by Dr. Jason Latsky.",
        },
        {
          key:          "website",
          label:        "Patient Portal",
          value:        targetUrl,
          attributedValue: `<a href='${targetUrl}'>${targetUrl}</a>`,
        },
        {
          key:   "contact",
          label: "Contact",
          value: "aesthetics@treasuryhealth.ca",
          attributedValue: "<a href='mailto:aesthetics@treasuryhealth.ca'>aesthetics@treasuryhealth.ca</a>",
        },
        {
          key:   "terms",
          label: "Terms",
          value:
            "This pass is issued by Treasury Aesthetics. " +
            "Scan the QR code to access the patient portal or present at reception.",
        },
      ],
    },

    // ── QR code ───────────────────────────────────────────────────────────
    // barcodes: modern field (iOS 9+), barcode: legacy fallback
    barcodes: [
      {
        message:         targetUrl,
        format:          "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText:         "treasuryaesthetics.ca",
      },
    ],
    barcode: {
      message:         targetUrl,
      format:          "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText:         "treasuryhealth.ca",
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
