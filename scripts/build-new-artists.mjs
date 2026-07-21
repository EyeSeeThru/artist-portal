#!/usr/bin/env node
// scripts/build-new-artists.mjs
//
// Takes scripts/.tmp/wikipedia-list-new.json (303 entries from Stage 1) and
// produces a merged dataset (current 90 + new 303 = 393 entries) saved to
// scripts/.tmp/artists-merged.json. For each new entry:
//   - id            = slugified name (already in Stage 1 output)
//   - wikiKey       = Wikipedia article slug (already in Stage 1 output)
//   - birthYear     = parsed in Stage 1
//   - deathYear     = parsed in Stage 1
//   - medium        = parsed from Wikipedia description (best-effort)
//   - movements     = auto-classified by date range into one of the 6 buckets
//   - city/state/lat/lng = left null (no geocoding in Stage 2 — Map view
//                     falls back gracefully; can be added in a later pass)
//
// Pure data transformation. Does NOT modify artists.json or sources.json.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TMP = resolve(__dirname, ".tmp");

// ----- movement classification -----
// Match the keys in src/data/movements.json. Order matters — earlier buckets
// have priority. A given birthYear falls into the bucket whose [start, end]
// range contains it. Edge cases (born 1950, no bucket) → "contemporary".
const MOVEMENT_BUCKETS = [
  { key: "early-american", start: 1750, end: 1900 },
  { key: "harlem-renaissance", start: 1918, end: 1937 },
  { key: "wpa-social-realism", start: 1933, end: 1949 },
  { key: "spiral-group", start: 1963, end: 1965 },
  { key: "black-arts-movement", start: 1965, end: 1976 },
  { key: "contemporary", start: 1980, end: 2100 },
];

function classifyMovement(birthYear) {
  if (birthYear === null) return "contemporary";
  for (const b of MOVEMENT_BUCKETS) {
    if (birthYear >= b.start && birthYear <= b.end) return b.key;
  }
  return "contemporary";
}

// ----- medium parsing -----
// Map common Wikipedia description keywords to our medium vocabulary
// (matches the enum used in src/data/artists.json).
const MEDIUM_KEYWORDS = [
  { medium: "Painting", matches: ["painter", "painting"] },
  { medium: "Sculpture", matches: ["sculptor", "sculpture"] },
  { medium: "Photography", matches: ["photographer", "photography"] },
  { medium: "Printmaking", matches: ["printmaker", "printmaking"] },
  { medium: "Drawing", matches: ["drawing artist", "drawer"] },
  { medium: "Mural", matches: ["muralist", "mural"] },
  { medium: "Mixed Media", matches: ["mixed media", "mixed-media"] },
  { medium: "Collage", matches: ["collage"] },
  { medium: "Quilt", matches: ["quilt artist", "quilter"] },
  { medium: "Cartoonist", matches: ["cartoonist"] },
  { medium: "Comic", matches: ["comic book"] },
  { medium: "Folk Art", matches: ["folk artist", "folk art"] },
  { medium: "Video", matches: ["video", "video artist"] },
  { medium: "Performance", matches: ["performance artist", "performance"] },
  { medium: "Installation", matches: ["installation", "installation artist"] },
  { medium: "Conceptual", matches: ["conceptual"] },
  { medium: "Textile", matches: ["textile", "fiber artist", "fibre artist"] },
  { medium: "Ceramics", matches: ["ceramic", "ceramics"] },
  { medium: "Glass", matches: ["glass artist"] },
  { medium: "Jewelry", matches: ["jewelry", "jeweller"] },
  { medium: "Graffiti", matches: ["graffiti"] },
  { medium: "Landscape", matches: ["landscape"] },
  { medium: "Watercolor", matches: ["watercolor", "watercolour"] },
  { medium: "Illustration", matches: ["illustrator", "illustration"] },
  { medium: "Multidisciplinary", matches: ["multidisciplinary", "multimedia"] },
];

function parseMediums(description) {
  const desc = description.toLowerCase();
  const found = new Set();
  // Always include "Painting" if "painter" appears, etc. Multi-match allowed.
  for (const m of MEDIUM_KEYWORDS) {
    for (const kw of m.matches) {
      if (desc.includes(kw)) {
        found.add(m.medium);
        break;
      }
    }
  }
  if (found.size === 0) return ["Painting"]; // safe default; most entries are
  // "Visual artist" generic terms → default to Painting
  return [...found];
}

async function main() {
  await mkdir(TMP, { recursive: true });

  const newRaw = await readFile(resolve(TMP, "wikipedia-list-new.json"), "utf8");
  const newData = JSON.parse(newRaw);

  const currentRaw = await readFile(
    resolve(ROOT, "src/data/artists.json"),
    "utf8",
  );
  const current = JSON.parse(currentRaw);

  console.log(`Current artists.json: ${current.length}`);
  console.log(`Wikipedia new entries: ${newData.total}`);

  const newArtists = newData.entries.map((e) => {
    const movement = classifyMovement(e.birthYear);
    const mediums = parseMediums(e.description);
    return {
      id: e.id,
      name: e.name,
      birthYear: e.birthYear,
      deathYear: e.deathYear,
      medium: mediums,
      movements: [movement],
      city: null,
      state: null,
      lat: null,
      lng: null,
      wikiKey: e.wikiKey,
      commonsImage: null,
      // provenance note: this entry came from the auto-extracted Wikipedia
      // list. Once the sourcing script populates sources.json for this id,
      // sources.json will have a galleryCover that overrides everything.
      _source: "wikipedia-list-extract",
    };
  });

  // Dedupe by wikiKey: if any new entry's wikiKey collides with a current
  // entry's wikiKey (shouldn't happen given Stage 1's filter, but safety),
  // skip the new one and keep the curated current entry.
  const currentWikiKeys = new Set(current.map((a) => a.wikiKey).filter(Boolean));
  const deduped = newArtists.filter((a) => {
    if (currentWikiKeys.has(a.wikiKey)) {
      console.log(`  collision: ${a.wikiKey} — keeping current curated entry, skipping new`);
      return false;
    }
    return true;
  });

  const merged = [...current, ...deduped];

  // Movement distribution
  const movCounts = {};
  for (const a of merged) {
    for (const m of a.movements) movCounts[m] = (movCounts[m] || 0) + 1;
  }

  console.log(`\nMerged dataset: ${merged.length} entries (was ${current.length})`);
  console.log(`  added: ${deduped.length}`);
  console.log(`  movement distribution:`);
  for (const [k, v] of Object.entries(movCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(28)} ${v}`);
  }

  // Medium distribution for the new entries (the 90 curated have hand-picked
  // mediums; this surfaces what the heuristic produced for the 303 new).
  const newMedCounts = {};
  for (const a of deduped) {
    for (const m of a.medium) newMedCounts[m] = (newMedCounts[m] || 0) + 1;
  }
  console.log(`\nNew-entry mediums (heuristic):`);
  for (const [k, v] of Object.entries(newMedCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(28)} ${v}`);
  }

  await writeFile(
    resolve(TMP, "artists-merged.json"),
    JSON.stringify(merged, null, 2),
  );

  console.log(`\nWrote scripts/.tmp/artists-merged.json`);
  console.log(
    `Ready for Stage 3: replace src/data/artists.json with this, then run source-artworks.mjs.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});