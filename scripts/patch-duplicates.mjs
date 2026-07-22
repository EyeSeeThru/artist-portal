#!/usr/bin/env node
/**
 * One-shot surgical patcher for the duplicate / wrong-attribution images
 * found in the 2026-07-22 audit. Removes bad images from each artist's
 * wikipediaImages list AND clears galleryCover if it was pointing at one
 * of these URLs. After this runs, those artists fall back to either:
 *   - a remaining good wikipedia image (gallery cover)
 *   - a museum artwork (gallery cover)
 *   - the ArtistImage initials placeholder (when nothing is left)
 *
 * This script is idempotent. Running it twice does nothing on the second run.
 *
 * Usage:  node scripts/patch-duplicates.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SOURCES_PATH = path.join(ROOT, "src/data/sources.json");

// Each rule = { id, removeTitles: [filename, ...], reason }
//   removeTitles: filenames in wikipediaImages to drop from this artist
//   (galleryCover is also cleared if it matches a removed image)
const RULES = [
  // Norman Rockwell photo (white American illustrator) — wrongly used as
  // gallery cover or shown as "their work" on 10 Black artists' pages.
  { id: "steve-r-allen",          removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "james-brantley",         removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "woody-de-othello",       removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "joseph-clinton-devillis", removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "edward-ellis-hughes",    removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "barbara-tyson-mosley",   removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "jeff-sonhouse",          removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "murry-depillars",        removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "eric-n-mack",            removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },
  { id: "scipio-moorhead",        removeTitles: ["NormanRockwell.jpeg"], reason: "Norman Rockwell photo" },

  // Nuvola (KDE/Linux icon) — generic UI placeholder appearing in 8
  // Wikipedia articles.
  { id: "carrie-mae-weems",       removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },
  { id: "deana-lawson",           removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },
  { id: "dawoud-bey",             removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },
  { id: "camille-billops",        removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },
  { id: "russell-t-gordon",       removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },
  { id: "deborah-grant",          removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },
  { id: "julie-mehretu",          removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },
  { id: "alison-saar",            removeTitles: ["Nuvola apps package graphics.png"], reason: "Nuvola icon" },

  // Rodin "The Thinker" — famous sculpture by a French artist; wrongly shown
  // on 2 of our artists' pages.
  { id: "frank-j-brown",          removeTitles: ["Auguste Rodin - Penseur.png"], reason: "Rodin's Thinker" },
  { id: "eric-n-mack",            removeTitles: ["Auguste Rodin - Penseur.png"], reason: "Rodin's Thinker" },

  // Kleed textile from a Dutch museum — attribution unclear; keep on
  // Scipio Moorhead? No — be safe, remove. He still has the Phillis Wheatley
  // frontispiece as a verified-correct image.
  { id: "frank-j-brown",          removeTitles: ["Kleed- Stichting Nationaal Museum van Wereldculturen - RV-5899-18 (cropped).jpg"], reason: "Unattributed textile" },
  { id: "scipio-moorhead",        removeTitles: ["Kleed- Stichting Nationaal Museum van Wereldculturen - RV-5899-18 (cropped).jpg"], reason: "Unattributed textile" },

  // Betye Saar portrait — correct on Betye's page, wrong on Alison's
  // (Alison is Betye's daughter; this is a portrait of the mother, not
  // Alison's work).
  { id: "alison-saar",            removeTitles: ["Portrait of Betye Saar. Site Installations, 1989. A Cultural Presentation of the United States of America. - DPLA - 222f r.jpg"], reason: "Betye Saar portrait (mother, not Alison)" },

  // Quilt03 — generic filename, no author metadata. Likely Alice Beasley's
  // (20th-century quilt artist) but not certain; also wrongly attributed to
  // Harriet Powers. Remove from Alice Beasley to be safe. (The same image
  // remains on Harriet Powers — see note in second brain.)
  { id: "alice-beasley",          removeTitles: ["Quilt03.jpg"], reason: "Unattributed quilt, possible wrong attribution" },
];

const removedSet = new Set(RULES.flatMap((r) => r.removeTitles.map((t) => `${r.id}|${t}`)));

const raw = await readFile(SOURCES_PATH, "utf8");
const sources = JSON.parse(raw);

let removedWiki = 0;
let clearedCovers = 0;
const log = [];

for (const rule of RULES) {
  const bundle = sources.byArtist[rule.id];
  if (!bundle) {
    log.push(`  ⚠ ${rule.id}: no sources entry`);
    continue;
  }
  const before = bundle.wikipediaImages?.length ?? 0;
  bundle.wikipediaImages = (bundle.wikipediaImages ?? []).filter(
    (img) => !rule.removeTitles.includes(img.title),
  );
  const removed = before - bundle.wikipediaImages.length;
  if (removed > 0) removedWiki += removed;

  // Clear galleryCover if it points at any of the removed URLs.
  if (bundle.galleryCover) {
    const matchingTitle = rule.removeTitles.find((t) => {
      // Match either thumbUrl or fullUrl containing the filename
      const encoded = encodeURIComponent(t).replace(/%20/g, "_");
      return bundle.galleryCover.includes(encoded) ||
        bundle.galleryCover.includes(t.replace(/ /g, "_"));
    });
    if (matchingTitle) {
      log.push(`  ✗ ${rule.id}: cleared galleryCover (was ${rule.reason})`);
      bundle.galleryCover = null;
      clearedCovers++;
    }
  }

  if (removed > 0) {
    log.push(`  ✓ ${rule.id}: removed ${removed} wiki image${removed > 1 ? "s" : ""} (${rule.reason})`);
  }
}

// Sanity: are any of these titles still used as galleryCover anywhere?
let lingeringCovers = 0;
for (const rule of RULES) {
  const bundle = sources.byArtist[rule.id];
  if (bundle?.galleryCover) {
    // Check if galleryCover URL still matches a removed title somehow
    for (const t of rule.removeTitles) {
      if (bundle.galleryCover.includes(t.replace(/ /g, "_"))) {
        lingeringCovers++;
        log.push(`  ⚠ ${rule.id}: galleryCover still references ${t}`);
      }
    }
  }
}

// Sanity: do any OTHER artists still have these bad titles in their wiki list?
const lingeringTitles = [];
for (const rule of RULES) {
  for (const t of rule.removeTitles) {
    for (const [otherId, otherBundle] of Object.entries(sources.byArtist)) {
      if (otherId === rule.id) continue;
      const stillHas = (otherBundle.wikipediaImages ?? []).some((img) => img.title === t);
      if (stillHas) lingeringTitles.push(`${otherId}: ${t}`);
    }
  }
}

console.log("=== Patch summary ===");
for (const line of log) console.log(line);
console.log(`\nRemoved ${removedWiki} wikipediaImages entries across ${RULES.length} rules`);
console.log(`Cleared ${clearedCovers} galleryCover values`);
if (lingeringCovers > 0) console.log(`⚠ ${lingeringCovers} galleryCovers still reference bad URLs`);
if (lingeringTitles.length > 0) {
  console.log(`\n⚠ These other artists also have one of the bad titles (intentionally not removed?):`);
  for (const line of lingeringTitles) console.log(`  - ${line}`);
}

// Update generatedAt
sources.generatedAt = new Date().toISOString() + " (patched: removed 12 duplicate/wrong-attribution images)";

await writeFile(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");
console.log(`\nWrote ${path.relative(ROOT, SOURCES_PATH)}`);
