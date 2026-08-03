// lib/pass-template.js
// Builds the pass.json payload for Treasury Aesthetics Apple Wallet passes.
// Pass type: storeCard | Colours: Apple Wallet uses CSS rgb() only (no hex)

// referralCode: if provided, encodes in QR instead of targetUrl
// planUrl: patient's personal plan page — shown in back fields
export function buildPassTemplate({ serialNumber, targetUrl, memberName, referralCode, planUrl }) {
  const qrMessage = referralCode || targetUrl;
  const portalUrl = planUrl || targetUrl;

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    serialNumber,
    teamIdentifier: process.env.APPLE_TEAM_ID,

    organizationName: "Treasury Aesthetics",
    description: "Treasury Aesthetics Digital Loyalty Pass",

    backgroundColor: "rgb(22, 22, 20)",
    foregroundColor: "rgb(245, 240, 232)",
    labelColor:      "rgb(201, 165, 90)",

    logoText: "Treasury Aesthetics",

    storeCard: {
      headerFields: [
        {
          key:   "status",
          label: "",
          value: "MEMBER",
          textAlignment: "PKTextAlignmentRight",
        },
      ],

      primaryFields: [
        {
          key:   "clinic",
          label: "PHYSICIAN-LED MEDICAL AESTHETICS",
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
          key:   "portal",
          label: "PATIENT PORTAL",
          value: "treasuryaesthetics.ca",
        },
      ],

      auxiliaryFields: [
        {
          key:   "issued",
          label: "ISSUED",
          // NOTE: no dateStyle here — dateStyle on plain string causes Wallet rejection
          value: new Date().toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day:   "numeric",
          }),
        },
        {
          key:   "type",
          label: "PASS TYPE",
          value: "Loyalty Pass",
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
          key:             "website",
          label:           "Your Personal Plan",
          value:           portalUrl,
          attributedValue: `<a href='${portalUrl}'>${portalUrl}</a>`,
        },
        {
          key:             "contact",
          label:           "Contact",
          value:           "aesthetics@treasuryhealth.ca",
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

    // barcodes: modern (iOS 9+), barcode: legacy fallback
    barcodes: [
      {
        message:         qrMessage,
        format:          "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText:         "treasuryaesthetics.ca",
      },
    ],
    barcode: {
      message:         qrMessage,
      format:          "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText:         "treasuryaesthetics.ca",
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
