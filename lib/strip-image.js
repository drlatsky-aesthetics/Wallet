// lib/strip-image.js
// Renders the pass strip PER PATIENT: member name (smaller than Wallet's
// fixed primary-field size) with the membership tier in italics beside it,
// tinted bronze / silver / gold — none of which Apple's pass fields allow,
// so the text is baked into the artwork. Text is converted to SVG paths
// with opentype.js (Vercel lambdas ship no system fonts) and rasterised
// with sharp. The pass template renders NO primary field on the strip.

import sharp from "sharp";
import opentype from "opentype.js";
import { readFileSync } from "fs";
import { join } from "path";

// 3x canvas — resized down for @2x/@1x by the caller
const W = 1125, H = 369;
// Wallet crops the strip horizontally on wide iPhones (~12%, left-anchored).
// Keep all text within the centered safe width.
const SAFE_W = W * 0.72;

const TIER_STYLE = {
  standard: { word: "Standard", color: "#D29A6A" },   // bronze
  reserve:  { word: "Reserve",  color: "#C9D2DC" },   // silver
  vault:    { word: "Vault",    color: "#E8C87A" },   // gold
};

const fontsDir = join(process.cwd(), "assets", "fonts");
let SANS, SERIF, SERIF_ITALIC;
function loadFonts() {
  if (SANS) return;
  const parse = (f) => opentype.parse(readFileSync(join(fontsDir, f)).buffer.slice(0));
  SANS = parse("LiberationSans-Regular.ttf");
  SERIF = parse("LiberationSerif-Regular.ttf");
  SERIF_ITALIC = parse("LiberationSerif-Italic.ttf");
}

function textPath(font, text, x, y, size, fill, opts = "") {
  const d = font.getPath(text, x, y, size).toPathData(2);
  return `<path d="${d}" fill="${fill}" ${opts}/>`;
}

function spacedWidth(font, text, size, tracking) {
  return font.getAdvanceWidth(text, size) + tracking * Math.max(text.length - 1, 0);
}

function spacedPaths(font, text, startX, y, size, fill, tracking) {
  let x = startX, out = "";
  for (const ch of text) {
    out += textPath(font, ch, x, y, size, fill);
    x += font.getAdvanceWidth(ch, size) + tracking;
  }
  return out;
}

/** 3x strip PNG buffer with the name + italic tier word baked in. */
export async function buildStrip({ memberName, membershipTier = "standard" }) {
  loadFonts();
  const tier = TIER_STYLE[membershipTier] ?? TIER_STYLE.standard;
  const name = (memberName || "Treasury Aesthetics").trim();

  // Name sizing: comfortably smaller than Wallet's ~30pt primary field —
  // start at 21pt (63px @3x) and shrink until name + tier word fit.
  const GAP = 26;
  let nameSize = 63;
  let tierSize, nameW, tierW;
  do {
    tierSize = Math.round(nameSize * 0.62);
    nameW = SANS.getAdvanceWidth(name, nameSize);
    tierW = SERIF_ITALIC.getAdvanceWidth(tier.word, tierSize);
    if (nameW + GAP + tierW <= SAFE_W) break;
    nameSize -= 3;
  } while (nameSize > 30);

  const total = nameW + GAP + tierW;
  const startX = (W - total) / 2;
  const baseY = H / 2 + nameSize * 0.20;

  const tagline = "PHYSICIAN-LED MEDICAL AESTHETICS";
  const tagSize = 24, tagTrack = 8;
  const tagW = spacedWidth(SANS, tagline, tagSize, tagTrack);

  const wmSize = 340;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#15130E"/>
      <stop offset="0.58" stop-color="#1E1B13"/>
      <stop offset="1" stop-color="#15130E"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="1.15" r="0.75">
      <stop offset="0" stop-color="#C9A94A" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#C9A94A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${textPath(SERIF, "TA", W - 390, H / 2 + wmSize * 0.34, wmSize, "#C9A94A", 'opacity="0.035"')}
  ${textPath(SANS, name, startX, baseY, nameSize, "#F2EDE2")}
  ${textPath(SERIF_ITALIC, tier.word, startX + nameW + GAP, baseY, tierSize, tier.color)}
  ${spacedPaths(SANS, tagline, (W - tagW) / 2, H - 40, tagSize, "#C9A94A", tagTrack)}
  <rect x="0" y="0" width="${W}" height="2" fill="#C9A94A" opacity="0.82"/>
  <rect x="0" y="2" width="${W}" height="1" fill="#C9A94A" opacity="0.35"/>
  <rect x="0" y="${H - 2}" width="${W}" height="2" fill="#C9A94A" opacity="0.82"/>
  <rect x="0" y="${H - 3}" width="${W}" height="1" fill="#C9A94A" opacity="0.35"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** All three scales for the pass image map. */
export async function buildStripSet(opts) {
  const s3 = await buildStrip(opts);
  const img = sharp(s3);
  const [s2, s1] = await Promise.all([
    img.clone().resize(750, 246).png().toBuffer(),
    img.clone().resize(375, 123).png().toBuffer(),
  ]);
  return { "strip.png": s1, "strip@2x.png": s2, "strip@3x.png": s3 };
}
