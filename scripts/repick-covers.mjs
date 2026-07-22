#!/usr/bin/env node
/**
 * Re-pick galleryCover for artists whose cover became stale after the
 * duplicate-image patch. The patcher removed the bad images from
 * wikipediaImages and cleared covers that pointed at bad URLs, but did
 * not re-derive covers from the remaining good images.
 *
 * This script walks every artist and re-applies the same pickGalleryCover
 * logic as scripts/source-artworks.mjs, but only writes when the value
 * would actually change.
 *
 * Also fixes a missed case: Scipio Moorhead's cover still pointed at the
 * Kleed textile URL because the previous patcher's URL matcher did not
 * match Wikimedia's encoded parens (%28/%29). This script clears any
 * galleryCover that references a filename we know is bad.
 *
 * Usage:  node scripts/repick-covers.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const SOURCES_PATH = path.join(ROOT, "src/data/sources.json");

// Known-bad filenames (same list as patch-duplicates.mjs) — any
// galleryCover whose URL contains one of these is force-cleared.
const KNOWN_BAD_FILENAMES = [
  "NormanRockwell",
  "Nuvola_apps_package_graphics",
  "Auguste_Rodin_-_Penseur",
  "Kleed-_Stichting_Nationaal_Museum",
  "Quilt03",
  "Portrait_of_Betye_Saar",
];

function pickGalleryCover(artist, bundle) {
  if (bundle.artworks?.[0]?.thumbUrl) return bundle.artworks[0].thumbUrl;
  if (bundle.wikipediaImages?.[0]?.thumbUrl) return bundle.wikipediaImages[0].thumbUrl;
  if (artist.commonsImage) {
    const fn = encodeURIComponent(artist.commonsImage);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${fn}?width=600`;
  }
  if (artist.imageUrl) return artist.imageUrl;
  return null;
}

function coverIsBad(cover) {
  if (!cover) return false;
  return KNOWN_BAD_FILENAMES.some((bad) => cover.includes(bad));
}

const artists = JSON.parse(await readFile(ARTISTS_PATH, "utf8"));
const sources = JSON.parse(await readFile(SOURCES_PATH, "utf8"));

let repicked = 0;
let clearedBad = 0;
const log = [];

for (const artist of artists) {
  const bundle = sources.byArtist[artist.id];
  if (!bundle) continue;

  const before = bundle.galleryCover;

  // Step 1: any cover pointing at a known-bad URL? Clear it.
  if (coverIsBad(before)) {
    bundle.galleryCover = null;
    clearedBad++;
    log.push(`  ✗ ${artist.name}: cleared bad cover (${before?.slice(-60) ?? ""})`);
  }

  // Step 2: re-pick using current (post-patch) data. Only write if changed.
  const picked = pickGalleryCover(artist, bundle);
  if (picked !== before) {
    bundle.galleryCover = picked;
    repicked++;
    if (!log.some((l) => l.includes(artist.name))) {
      log.push(`  ✓ ${artist.name}: cover → ${picked?.slice(-60) ?? "(null → initials)"}`);
    }
  }
}

console.log("=== Cover repick summary ===");
for (const line of log) console.log(line);
console.log(`\nCleared ${clearedBad} bad covers`);
console.log(`Re-picked ${repicked} covers`);

sources.generatedAt = new Date().toISOString() + " (patched: duplicate-image cleanup + cover repick)";

await writeFile(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");
console.log(`\nWrote ${path.relative(ROOT, SOURCES_PATH)}`);
