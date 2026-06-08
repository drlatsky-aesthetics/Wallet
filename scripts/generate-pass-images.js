#!/usr/bin/env node
// Generates Treasury Aesthetics brand PNG assets for the Apple Wallet pass.
// Run once before deployment: node scripts/generate-pass-images.js
//
// Requires: canvas (already in devDependencies)
//   npm install --include=dev
//
// Output: assets/pass/{icon,icon@2x,icon@3x,logo,logo@2x}.png

import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, "..", "assets", "pass");

const CHARCOAL = "#161614";
const GOLD     = "#C9A55A";
const CREAM    = "#F5F0E8";

mkdirSync(OUT_DIR, { recursive: true });

function save(filename, canvas) {
  writeFileSync(join(OUT_DIR, filename), canvas.toBuffer("image/png"));
  console.log(`  ✓  ${filename}`);
}

// ── Icon (T monogram on charcoal) ─────────────────────────────────────────────
function makeIcon(px) {
  const c  = createCanvas(px, px);
  const cx = c.getContext("2d");

  cx.fillStyle = CHARCOAL;
  cx.fillRect(0, 0, px, px);

  const pad  = px * 0.18;
  const size = px - pad * 2;

  cx.fillStyle   = GOLD;
  cx.font        = `bold ${size}px Georgia, serif`;
  cx.textAlign   = "center";
  cx.textBaseline = "middle";
  cx.fillText("T", px / 2, px / 2 + size * 0.04);

  return c;
}

console.log("Generating icon assets…");
save("icon.png",    makeIcon(29));
save("icon@2x.png", makeIcon(58));
save("icon@3x.png", makeIcon(87));

// ── Logo (wordmark — matches brand: all-caps tracked serif gold) ──────────────
// Brand: "TREASURY" large bold serif / "— AESTHETICS —" smaller tracked below
function makeLogo(w, h) {
  const c  = createCanvas(w, h);
  const cx = c.getContext("2d");

  cx.clearRect(0, 0, w, h); // transparent bg — Wallet renders on pass backgroundColor

  const pad = h * 0.06;

  // "TREASURY" — large, bold, all-caps, gold, tracked
  const primarySize = h * 0.48;
  cx.fillStyle    = GOLD;
  cx.font         = `bold ${primarySize}px Georgia, serif`;
  cx.textAlign    = "left";
  cx.textBaseline = "alphabetic";

  // Simulate letter-spacing by drawing each character individually
  const treasury    = "TREASURY";
  const tracking    = primarySize * 0.06; // space between letters
  let x = pad;
  for (const ch of treasury) {
    cx.fillText(ch, x, h * 0.56);
    x += cx.measureText(ch).width + tracking;
  }

  // "— AESTHETICS —" — smaller, spaced out, gold, beneath
  const subSize = h * 0.26;
  cx.font = `400 ${subSize}px Georgia, serif`;
  const sub         = "— AESTHETICS —";
  const subTracking = subSize * 0.12;
  let sx = pad * 0.5;
  for (const ch of sub) {
    cx.fillText(ch, sx, h * 0.92);
    sx += cx.measureText(ch).width + (ch === " " ? subTracking * 0.5 : subTracking * 0.3);
  }

  return c;
}

console.log("Generating logo assets…");
save("logo.png",    makeLogo(160, 50));
save("logo@2x.png", makeLogo(320, 100));

// ── Strip image (banner behind patient name — Option C layout) ────────────────
// Dimensions: Apple storeCard strip: 320×123 @1x  →  640×246 @2x
// Design: deep charcoal gradient + translucent gold "T" watermark (serif, right-aligned).
// The patient name is rendered by iOS Wallet as a text overlay — we only paint the bg.
function makeStrip(w, h) {
  const c  = createCanvas(w, h);
  const cx = c.getContext("2d");

  // ── Base: deep warm-charcoal gradient, slightly lighter top-left ─────────
  const bg = cx.createLinearGradient(0, 0, w * 0.6, h);
  bg.addColorStop(0,   "#272318");
  bg.addColorStop(0.5, "#1D1B13");
  bg.addColorStop(1,   "#111009");
  cx.fillStyle = bg;
  cx.fillRect(0, 0, w, h);

  // ── Gold shimmer band — diagonal highlight across the strip ──────────────
  // Simulates the metallic sheen of a premium card catching light
  const shimmer = cx.createLinearGradient(0, 0, w * 0.7, h);
  shimmer.addColorStop(0,    "rgba(201,165,90,0)");
  shimmer.addColorStop(0.28, "rgba(201,165,90,0)");
  shimmer.addColorStop(0.38, "rgba(225,195,120,0.09)");
  shimmer.addColorStop(0.44, "rgba(245,220,150,0.18)");
  shimmer.addColorStop(0.5,  "rgba(225,195,120,0.09)");
  shimmer.addColorStop(0.6,  "rgba(201,165,90,0)");
  shimmer.addColorStop(1,    "rgba(201,165,90,0)");
  cx.fillStyle = shimmer;
  cx.fillRect(0, 0, w, h);

  // ── Radial warmth — top-left corner glow for depth ───────────────────────
  const glow = cx.createRadialGradient(w * 0.08, 0, 0, w * 0.08, 0, w * 0.7);
  glow.addColorStop(0,   "rgba(201,165,90,0.10)");
  glow.addColorStop(0.5, "rgba(201,165,90,0.03)");
  glow.addColorStop(1,   "rgba(0,0,0,0)");
  cx.fillStyle = glow;
  cx.fillRect(0, 0, w, h);

  // ── "T" watermark — large serif, very faint gold, clipped right ──────────
  const fontSize  = h * 1.65;
  cx.font         = `bold ${fontSize}px Georgia, serif`;
  cx.textAlign    = "right";
  cx.textBaseline = "middle";
  cx.fillStyle    = GOLD;
  cx.globalAlpha  = 0.055;
  cx.fillText("T", w * 0.98, h * 0.56);
  cx.globalAlpha  = 1;

  // ── Top edge highlight — thin bright line along top for card-like lift ───
  const topLine = cx.createLinearGradient(0, 0, w, 0);
  topLine.addColorStop(0,   "rgba(201,165,90,0)");
  topLine.addColorStop(0.15, "rgba(201,165,90,0.35)");
  topLine.addColorStop(0.5,  "rgba(245,220,150,0.55)");
  topLine.addColorStop(0.85, "rgba(201,165,90,0.35)");
  topLine.addColorStop(1,   "rgba(201,165,90,0)");
  cx.beginPath();
  cx.moveTo(0, 0.5);
  cx.lineTo(w, 0.5);
  cx.strokeStyle = topLine;
  cx.lineWidth   = 1;
  cx.stroke();

  // ── Bottom edge — same fade-in/out gold line ──────────────────────────────
  const botLine = cx.createLinearGradient(0, 0, w, 0);
  botLine.addColorStop(0,    "rgba(201,165,90,0)");
  botLine.addColorStop(0.2,  "rgba(201,165,90,0.3)");
  botLine.addColorStop(0.8,  "rgba(201,165,90,0.3)");
  botLine.addColorStop(1,    "rgba(201,165,90,0)");
  cx.beginPath();
  cx.moveTo(0, h - 0.5);
  cx.lineTo(w, h - 0.5);
  cx.strokeStyle = botLine;
  cx.lineWidth   = 1;
  cx.stroke();

  return c;
}

console.log("Generating strip assets…");
save("strip.png",    makeStrip(320, 123));
save("strip@2x.png", makeStrip(640, 246));

console.log("\nDone. Assets written to assets/pass/");
console.log("Replace with final brand artwork before patient-facing deployment.");
