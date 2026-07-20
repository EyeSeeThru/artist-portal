#!/usr/bin/env node
/**
 * Phase 2 image sourcing for ArtCanon.
 *
 * For each artist in src/data/artists.json without a `commonsImage`, walks a
 * fallback ladder:
 *
 *   1. Wikipedia REST page summary — returns vetted thumbnail/originalimage
 *      that filters disambig icons upstream.
 *   2. Wikimedia Commons category search — top-hit filename, validated by
 *      Phase 1 audit.
 *   3. (manual) — anything still missing is left for EST to fill.
 *
 * Polite defaults: concurrency=1, gap=1500ms, retries on 429/503 with
 * exponential backoff. Wikimedia TOS asks for this.
 *
 * Writes:
 *   - src/data/sources.json  — per-artist attribution when not from Commons
 *   - src/data/artists.json  — patched in place with imageUrl + attribution
 *
 * Run:
 *   node scripts/source-images.mjs
 *   node scripts/source-images.mjs --dry-run   (no file writes)
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.+))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const DRY_RUN = !!args["dry-run"];
const CONCURRENCY = 1;
const GAP_MS = 1500;
const MAX_RETRIES = 3;
const MIN_SIZE = 5000;

const UA =
  "ArtCanonImageSourcing/0.1 (https://github.com/EyeSeeThru/artist-portal; educational project)";

const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const SOURCES_PATH = path.join(ROOT, "src/data/sources.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      ...opts,
      headers: { "User-Agent": UA, ...(opts.headers ?? {}) },
    });
    if (res.status === 429 || res.status === 503) {
      const ra = Number(res.headers.get("retry-after")) || 0;
      const backoff = Math.max(ra * 1000, 2000 * (attempt + 1));
      await sleep(backoff);
      continue;
    }
    return res;
  }
  throw new Error(`Failed after ${MAX_RETRIES} retries: ${url}`);
}

/**
 * Validate a thumbnail URL by hitting the Special:FilePath endpoint with a
 * Range request. Returns { ok, sizeBytes, finalUrl } or { ok: false }.
 */
async function validateCommonsThumb(filename) {
  const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=400`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { Range: "bytes=0-0", Accept: "image/*" },
    });
    if (res.status !== 200 && res.status !== 206) return { ok: false };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return { ok: false };
    let size = null;
    const cr = res.headers.get("content-range");
    if (cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m) size = Number(m[1]);
    }
    if (size == null) {
      const cl = res.headers.get("content-length");
      if (cl) size = Number(cl);
    }
    if (size != null && size < MIN_SIZE) return { ok: false };
    return { ok: true, sizeBytes: size, finalUrl: res.url };
  } catch {
    return { ok: false };
  }
}

/**
 * Step 1: Wikipedia REST summary. Returns a direct upload.wikimedia.org URL
 * from originalimage if the summary exists. We don't re-validate because
 * Wikipedia itself vets that field.
 */
async function tryWikipediaSummary(wikiKey) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    wikiKey,
  )}?redirect=true`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.originalimage?.source ?? data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/**
 * Step 3: Disabled — Commons text search by name is unreliable for
 * biographical subjects. The top hits are often unrelated PDFs (yearbooks,
 * copyright catalogs, biographies of different people) that happen to share
 * one keyword in their text. The validation step can't tell subject vs.
 * subject apart, so this path is removed.
 *
 * If you want to re-enable, add a filter for filename structure
 * (e.g. require the filename to contain the artist's last name) AND a
 * subject-confirmation step. Don't enable as-is.
 */

/**
 * Step 3: Wikipedia REST pageimages — gives the lead image from the page,
 * which is often a portrait for biographical articles. Falls through if no
 * image is set on the Wikipedia article.
 */
async function tryWikipediaPageImages(wikiKey) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageimages",
    piprop: "original",
    redirects: "1",
    titles: wikiKey.replace(/_/g, " "),
  });
  try {
    const res = await fetchWithRetry(
      `https://en.wikipedia.org/w/api.php?${params}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    return page?.original?.source ?? null;
  } catch {
    return null;
  }
}

async function sourceFor(artist) {
  // 1. Wikipedia REST summary (originalimage is vetted upstream)
  const wikiUrl = await tryWikipediaSummary(artist.wikiKey);
  if (wikiUrl) {
    return {
      kind: "wikipedia-summary",
      imageUrl: wikiUrl,
      source: "Wikipedia",
      license: "varies (see Wikipedia article)",
      attribution: `Image: Wikipedia, ${artist.wikiKey.replace(/_/g, " ")}`,
    };
  }

  // 2. Wikipedia pageimages
  const piUrl = await tryWikipediaPageImages(artist.wikiKey);
  if (piUrl) {
    return {
      kind: "wikipedia-pageimages",
      imageUrl: piUrl,
      source: "Wikipedia",
      license: "varies (see Wikipedia article)",
      attribution: `Image: Wikipedia, ${artist.wikiKey.replace(/_/g, " ")}`,
    };
  }

  // 3. (was commons-search — removed, see tryCommonsSearch stub above)

  return null;
}

// ---- main ----
const raw = await readFile(ARTISTS_PATH, "utf8");
const artists = JSON.parse(raw);

const missing = artists.filter((a) => !a.commonsImage);
console.log(
  `Sourcing images for ${missing.length} artists without commonsImage (concurrency=1, gap=${GAP_MS}ms)${DRY_RUN ? " [DRY RUN]" : ""}…\n`,
);

const sources = {};
let cursor = 0;
const results = [];
for (const artist of missing) {
  cursor++;
  process.stdout.write(`  [${cursor}/${missing.length}] ${artist.name}… `);
  const result = await sourceFor(artist);
  if (result) {
    process.stdout.write(`✓ (${result.kind})\n`);
    results.push({ artist, result });
    sources[artist.id] = {
      kind: result.kind,
      imageUrl: result.imageUrl ?? null,
      commonsImage: result.commonsImage ?? null,
      source: result.source,
      license: result.license,
      attribution: result.attribution,
    };
  } else {
    process.stdout.write(`✗ no source found\n`);
  }
  if (cursor < missing.length) await sleep(GAP_MS);
}

const sourced = results.length;
const stillMissing = missing.length - sourced;
console.log(
  `\nSourced ${sourced}/${missing.length}. ${stillMissing} still need manual fill.\n`,
);

if (DRY_RUN) {
  console.log("Dry run — no files written.");
  process.exit(0);
}

// Patch artists.json in place
const patchedArtists = artists.map((a) => {
  const s = sources[a.id];
  if (!s) return a;
  return {
    ...a,
    commonsImage: s.commonsImage ?? a.commonsImage,
    imageUrl: s.imageUrl ?? null,
    imageSource: s.source,
    imageLicense: s.license,
    imageAttribution: s.attribution,
  };
});

await writeFile(ARTISTS_PATH, JSON.stringify(patchedArtists, null, 2) + "\n");
await writeFile(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");

console.log(`Wrote ${path.relative(ROOT, ARTISTS_PATH)} (patched)`);
console.log(`Wrote ${path.relative(ROOT, SOURCES_PATH)} (${Object.keys(sources).length} entries)`);

if (stillMissing) {
  console.log(`\nStill missing (manual fill needed):`);
  for (const a of missing) {
    if (!sources[a.id]) console.log(`  - ${a.id} | ${a.name}`);
  }
}
