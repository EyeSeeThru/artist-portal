#!/usr/bin/env node
/**
 * Per-artist artworks sourcing for ArtCanon, v2 — museum API edition.
 *
 * Strategy:
 *   1. The Met Collection API — primary. Only `isPublicDomain: true` entries
 *      expose image URLs, so this is a clean PD-only filter. Search by
 *      artist name; post-filter by `artistDisplayName` to avoid false
 *      keyword matches.
 *
 *   2. Art Institute of Chicago API — fallback. IIIF image URLs are served
 *      publicly regardless of `is_public_domain`. Match on `artist_display`
 *      containing the artist's full name.
 *
 * Polite defaults: concurrency=1, 1500ms gap, retries on 429/503.
 *
 * Run:  node scripts/source-artworks.mjs
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
const PER_ARTIST = 12;
const GAP_MS = 1500;
const MAX_RETRIES = 3;

const UA =
  "ArtCanonArtworkSourcing/0.2 (https://github.com/EyeSeeThru/artist-portal; educational project)";

const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const ARTWORKS_PATH = path.join(ROOT, "src/data/artworks.json");

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

function normalizeName(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Search Met by artist name and return real artworks (PD-only, name-matched).
 */
async function searchMet(artistName) {
  const q = encodeURIComponent(artistName);
  let searchRes;
  try {
    searchRes = await fetchWithRetry(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${q}&hasImages=true`,
    );
  } catch {
    return [];
  }
  if (!searchRes.ok) return [];
  let body;
  try {
    body = await searchRes.json();
  } catch {
    return [];
  }
  const objectIDs = Array.isArray(body?.objectIDs) ? body.objectIDs : [];
  if (objectIDs.length === 0) return [];

  const target = normalizeName(artistName);
  const results = [];
  for (const id of objectIDs.slice(0, PER_ARTIST * 2)) {
    let r;
    try {
      r = await fetchWithRetry(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
      );
    } catch {
      continue;
    }
    if (!r.ok) continue;
    let obj;
    try {
      obj = await r.json();
    } catch {
      continue;
    }
    if (!obj.isPublicDomain) continue;
    if (!obj.primaryImageSmall && !obj.primaryImage) continue;
    const displayName = normalizeName(obj.artistDisplayName ?? "");
    if (!displayName.includes(target) && !target.includes(displayName)) continue;
    results.push({
      title: obj.title,
      year: obj.objectDate,
      medium: obj.medium,
      thumbUrl: obj.primaryImageSmall,
      fullUrl: obj.primaryImage,
      source: "The Metropolitan Museum of Art",
      sourceUrl: obj.objectURL,
      license: "Public Domain (CC0)",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      artist: obj.artistDisplayName,
    });
    if (results.length >= PER_ARTIST) break;
    await sleep(GAP_MS);
  }
  return results;
}

/**
 * Search Art Institute of Chicago by artist name and return IIIF image URLs.
 */
async function searchAIC(artistName) {
  const params = new URLSearchParams();
  params.set("q", artistName);
  params.append("query[bool][must][][match][artist_display]", artistName);
  params.set(
    "fields",
    "id,title,artist_display,is_public_domain,image_id,date_display,medium_display,artist_title",
  );
  params.set("limit", String(PER_ARTIST * 2));

  let r;
  try {
    r = await fetchWithRetry(
      `https://api.artic.edu/api/v1/artworks/search?${params}`,
    );
  } catch {
    return [];
  }
  if (!r.ok) return [];
  let body;
  try {
    body = await r.json();
  } catch {
    return [];
  }
  const data = Array.isArray(body?.data) ? body.data : [];

  const target = normalizeName(artistName);
  const baseIiif = "https://www.artic.edu/iiif/2";
  const results = [];
  for (const obj of data) {
    if (!obj.image_id) continue;
    const display = normalizeName(obj.artist_display ?? obj.artist_title ?? "");
    if (!display.includes(target)) continue;
    results.push({
      title: obj.title,
      year: obj.date_display,
      medium: obj.medium_display,
      thumbUrl: `${baseIiif}/${obj.image_id}/full/600,/0/default.jpg`,
      fullUrl: `${baseIiif}/${obj.image_id}/full/1686,/0/default.jpg`,
      source: "Art Institute of Chicago",
      sourceUrl: `https://www.artic.edu/artworks/${obj.id}`,
      license: obj.is_public_domain ? "Public Domain (CC0)" : "Art Institute of Chicago (open access)",
      licenseUrl: "https://www.artic.edu/terms",
      artist: (obj.artist_display ?? obj.artist_title ?? "").split("\n")[0],
    });
    if (results.length >= PER_ARTIST) break;
  }
  return results;
}

async function sourceFor(artist) {
  const met = await searchMet(artist.name);
  if (met.length >= 3) return { source: "met", artworks: met };
  const aic = await searchAIC(artist.name);
  // Merge Met first, AIC second, dedupe by title
  const seen = new Set(met.map((a) => a.title));
  const merged = [...met, ...aic.filter((a) => !seen.has(a.title))].slice(0, PER_ARTIST);
  const source = met.length > 0 ? "met+aic" : aic.length > 0 ? "aic" : "none";
  return { source, artworks: merged };
}

// ---- main ----
const raw = await readFile(ARTISTS_PATH, "utf8");
const artists = JSON.parse(raw);

console.log(
  `Sourcing artworks for ${artists.length} artists via Met + AIC APIs…\n`,
);

const byArtist = {};
const sourceCounts = {};
let totalArtworks = 0;
let cursor = 0;
for (const artist of artists) {
  cursor++;
  process.stdout.write(`  [${cursor}/${artists.length}] ${artist.name}… `);
  try {
    const { source, artworks } = await sourceFor(artist);
    byArtist[artist.id] = artworks;
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
    totalArtworks += artworks.length;
    process.stdout.write(`✓ ${artworks.length} (${source})\n`);
  } catch (err) {
    byArtist[artist.id] = [];
    sourceCounts["error"] = (sourceCounts["error"] ?? 0) + 1;
    process.stdout.write(`✗ error: ${err.message ?? err}\n`);
  }
  if (cursor < artists.length) await sleep(GAP_MS);
}

const withArtworks = Object.values(byArtist).filter((a) => a.length > 0).length;
console.log(
  `\nSourced ${totalArtworks} artworks across ${withArtworks}/${artists.length} artists.`,
  `Sources: ${JSON.stringify(sourceCounts)}\n`,
);

if (DRY_RUN) {
  console.log("Dry run — no files written.");
  process.exit(0);
}

await writeFile(
  ARTWORKS_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalArtists: artists.length,
      totalArtworks,
      byArtist,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Wrote ${path.relative(ROOT, ARTWORKS_PATH)}`);