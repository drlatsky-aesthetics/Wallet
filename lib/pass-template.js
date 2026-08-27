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

// Owner names — always get the Owner tier regardless of membershipTier param
const OWNER_NAMES = [
  "jason latsky",
  "justin di donato",
  "amy baker",
  "albert bebawy",
  "evaare tom",
];

// membershipTier: "standard" | "vault" | "reserve" | "owner"
// Owner is auto-elevated if memberName matches OWNER_NAMES.
// isPersonalUrl: targetUrl is the patient's own private plan page (random-slug,
//   DOB/passphrase-gated) rather than the generic clinic site.
// webServiceURL + authenticationToken: enables Apple Wallet pass refresh —
//   iOS re-fetches the pass from our web service, so the link stays current
//   when the patient's page URL changes.
export function buildPassTemplate({ serialNumber, targetUrl, memberName, membershipTier = "standard", isPersonalUrl = false, webServiceURL = null, authenticationToken = null }) {
  // Auto-detect owner by name (case-insensitive)
  const nameLower = (memberName || "").toLowerCase().trim();
  const isOwner   = OWNER_NAMES.some(n => nameLower.includes(n));
  const tier      = isOwner ? "owner" : membershipTier.toLowerCase();

  // Primary field label — shown under the patient name on the pass
  const primaryLabel = tier === "owner"   ? "OWNER"
                     : tier === "vault"   ? "TREASURY VAULT MEMBER"
                     : tier === "reserve" ? "TREASURY RESERVE MEMBER"
                     :                     "STANDARD MEMBER";

  // labelColor changes per tier — Apple Wallet applies this globally to all field labels
  // reserve → silver,  owner → near-white platinum,  standard/vault → brand gold
  const labelColor = tier === "reserve" ? "rgb(180, 185, 195)"   // silver
                   : tier === "owner"   ? "rgb(220, 225, 235)"   // platinum
                   :                     "rgb(201, 165, 90)";    // gold

  // Subtle background shift for owner — slightly warmer charcoal
  const bgColor    = tier === "owner"   ? "rgb(25, 22, 18)"
                   :                     "rgb(22, 22, 20)";
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
    backgroundColor: bgColor,
    foregroundColor: "rgb(245, 240, 232)", // #F5F0E8 cream — same for all tiers
    labelColor:      labelColor,           // gold / silver / platinum per tier

    // logoText omitted — logo image already carries the wordmark

    // ── Pass fields (storeCard layout — Option C: strip image) ───────────
    // strip.png sits behind primaryFields as a full-width banner.
    // Primary field value is rendered large over the strip by Wallet.
    // Secondary + auxiliary fields appear below the strip.
    storeCard: {
      primaryFields: [
        {
          key:           "patient",
          label:         primaryLabel,
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
          key:   "issued",
          label: "MEMBER SINCE",
          value: new Date().toLocaleDateString("en-CA", {
            year: "numeric", month: "long",
          }),
        },
      ],

      auxiliaryFields: [
        {
          key:   "type",
          label: "MEMBERSHIP",
          value: tier === "owner"   ? "Treasury Owner"
               : tier === "vault"   ? "Vault Member"
               : tier === "reserve" ? "Reserve Member"
               :                     "Standard Member",
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
          label:        isPersonalUrl ? "Your Patient Page" : "Patient Portal",
          value:        targetUrl,
          attributedValue: `<a href='${targetUrl}'>${isPersonalUrl ? "Open your private patient page" : targetUrl}</a>`,
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
            (isPersonalUrl
              ? "Scan the QR code to open your private patient page or present at reception. " +
                "Your page link is private to you — it never contains your name, and your details stay protected behind your date of birth or passphrase."
              : "Scan the QR code to access the patient portal or present at reception."),
        },
        ...(webServiceURL ? [{
          key:   "refresh",
          label: "Keeping This Pass Current",
          value:
            "If your patient page link changes, this pass updates automatically. " +
            "To refresh manually: tap the (…) button, then pull down on this side of the pass.",
        }] : []),
      ],
    },

    // ── QR code ───────────────────────────────────────────────────────────
    // barcodes: modern field (iOS 9+), barcode: legacy fallback
    barcodes: [
      {
        message:         targetUrl,
        format:          "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText:         isPersonalUrl ? "Your private patient page" : "treasuryaesthetics.ca",
      },
    ],
    barcode: {
      message:         targetUrl,
      format:          "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText:         isPersonalUrl ? "Your private patient page" : "treasuryhealth.ca",
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

    // ── Web service (enables pass refresh) ───────────────────────────────
    // iOS registers the pass against this URL and re-fetches it when the
    // patient pulls down on the back of the pass (or when we bump its
    // updatedAt). Only included when KV is configured — a pass without it
    // simply can't refresh. Token must be ≥16 chars (Apple requirement).
    ...(webServiceURL && authenticationToken ? {
      webServiceURL,
      authenticationToken,
    } : {}),
  };
}
