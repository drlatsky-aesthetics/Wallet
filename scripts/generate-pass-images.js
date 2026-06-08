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

// ── Logo (wordmark on transparent background) ─────────────────────────────────
function makeLogo(w, h) {
  const c  = createCanvas(w, h);
  const cx = c.getContext("2d");

  // Transparent background — Wallet renders it on the pass background colour
  cx.clearRect(0, 0, w, h);

  const fontSize = h * 0.52;
  cx.fillStyle   = CREAM;
  cx.font        = `400 ${fontSize}px Georgia, serif`;
  cx.textAlign   = "left";
  cx.textBaseline = "middle";

  // "Treasury" in cream, "Aesthetics" slightly dimmer
  cx.fillText("Treasury", h * 0.08, h * 0.42);

  cx.fillStyle  = GOLD;
  cx.font       = `400 ${fontSize * 0.72}px Georgia, serif`;
  cx.fillText("AESTHETICS", h * 0.08, h * 0.75);

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

  // Background: warm-dark gradient — slightly amber top-left, pure charcoal bottom-right
  const bg = cx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0,   "#252118");
  bg.addColorStop(0.4, "#1C1A14");
  bg.addColorStop(1,   "#0E0D0B");
  cx.fillStyle = bg;
  cx.fillRect(0, 0, w, h);

  // Subtle radial glow top-right for depth
  const glow = cx.createRadialGradient(w * 0.82, h * 0.15, 0, w * 0.82, h * 0.15, w * 0.55);
  glow.addColorStop(0, "rgba(201,165,90,0.06)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  cx.fillStyle = glow;
  cx.fillRect(0, 0, w, h);

  // "T" watermark — large serif, translucent gold, pushed to the right
  const fontSize = h * 1.6;
  cx.font        = `bold ${fontSize}px Georgia, serif`;
  cx.textAlign   = "right";
  cx.textBaseline = "middle";
  cx.fillStyle   = GOLD;
  cx.globalAlpha = 0.07;
  cx.fillText("T", w * 0.97, h * 0.58);
  cx.globalAlpha = 1;

  // Thin fading gold line along the bottom edge
  cx.beginPath();
  cx.moveTo(0, h - 1);
  cx.lineTo(w, h - 1);
  const lineGrad = cx.createLinearGradient(0, 0, w, 0);
  lineGrad.addColorStop(0,   "rgba(201,165,90,0)");
  lineGrad.addColorStop(0.2, "rgba(201,165,90,0.4)");
  lineGrad.addColorStop(0.8, "rgba(201,165,90,0.4)");
  lineGrad.addColorStop(1,   "rgba(201,165,90,0)");
  cx.strokeStyle = lineGrad;
  cx.lineWidth   = 1;
  cx.stroke();

  return c;
}

console.log("Generating strip assets…");
save("strip.png",    makeStrip(320, 123));
save("strip@2x.png", makeStrip(640, 246));

console.log("\nDone. Assets written to assets/pass/");
console.log("Replace with final brand artwork before patient-facing deployment.");
