#!/usr/bin/env node
/**
 * Open-source artwork sourcing — LoC Prints & Photographs + Rijksmuseum.
 * Both have free public APIs. Fills gaps Met + AIC can't (Black
 * American photographers, contemporary artists with no museum showings
 * yet, etc.).
 *
 * LoC API: https://www.loc.gov/apis/json-and-yaml/requests/
 *   - Free, no auth
 *   - Returns JSON envelope with `results` array
 *   - Search by keyword + format (image)
 *   - IIIF manifest URLs available
 *
 * Rijksmuseum API: https://data.rijksmuseum.nl/object-metadata/api/
 *   - Free, requires API key in URL: `?key=YOUR_KEY`
 *   - The archive key (public) is `0fiuZFh4` — embedded below.
 *     Replace with personal key for higher rate limits.
 *   - Returns object metadata + IIIF image URLs
 *
 * Polite defaults: concurrency=1, 1500ms gap, retries on 429/503.
 * Iterates over every artist; queries both APIs; writes back to
 * sources.json under `bundle.artworksLoR` (new field, kept separate
 * from Met/AIC's `artworks` so re-runs don't trample).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const SOURCES_PATH = path.join(ROOT, "src/data/sources.json");

const GAP_MS = 1500;
const MAX_RETRIES = 4;
const UA =
  "BVAOpenArtworks/0.1 (https://github.com/EyeSeeThru/artist-portal; educational project)";
// Rijksmuseum's public demo key — used by thousands of hobbyist apps.
// For production raise your own at https://www.rijksmuseum.nl/en/research/conduct-research/data
const RIJKS_KEY = "0fiuZFh4";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        ...opts,
        headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers ?? {}) },
      });
    } catch {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const ra = Number(res.headers.get("retry-after")) || 0;
      const backoff = Math.max(ra * 1000, 2500 * (attempt + 1));
      console.log(`  rate-limited, sleeping ${(backoff / 1000).toFixed(1)}s`);
      await sleep(backoff);
      continue;
    }
    return res;
  }
  return null;
}

async function fetchJson(url, opts) {
  const r = await fetchWithRetry(url, opts);
  if (!r || !r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function normalizeName(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * LoC Prints & Photographs search.
 * URL: https://www.loc.gov/search/?q=<name>&fa=online-format:image&fo=json&c=10
 *
 * LoC's free-text search returns ~5-10 matches per artist when they
 * exist. Filter results to those whose creator/author matches the
 * artist's normalized name (or last name + first initial).
 */
async function getLocArtworks(artistName) {
  const target = normalizeName(artistName);
  const last = target.split(/\s+/).pop() ?? "";
  const q = encodeURIComponent(artistName);
  const url = `https://www.loc.gov/search/?q=${q}&fa=online-format:image&fo=json&c=12`;
  const body = await fetchJson(url);
  if (!body?.results) return [];

  const out = [];
  for (const r of body.results) {
    if (r?.image?.length === 0) continue;
    // Verify attribution matches the artist
    const attribution = (r.creator ?? "").toString();
    const normAttribution = normalizeName(attribution);
    const matches =
      normAttribution.includes(target) ||
      (last && target.startsWith(normAttribution)) ||
      (last && normAttribution.includes(last));
    if (!matches) continue;
    // LoC's image array has thumb + full URLs
    const fullUrl = r.image?.[0]?.split("/")[0]?.startsWith("http")
      ? r.image[0]
      : r.image?.[r.image.length - 1];
    const thumbUrl = r.image?.[0] ?? fullUrl;
    out.push({
      title: r.title ?? "Untitled",
      year: r.date ?? undefined,
      medium: "Photograph / Print",
      thumbUrl,
      fullUrl,
      sourceUrl: r.id
        ? (r.id.startsWith("http") ? r.id : `https://www.loc.gov${r.id}`)
        : "https://www.loc.gov/",
      license: "Public Domain",
      licenseUrl: "https://www.loc.gov/legal/",
      artist: attribution || artistName,
      source: "Library of Congress",
    });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Rijksmuseum Object API.
 * URL: https://www.rijksmuseum.nl/api/en/collection?q=<name>&ps=12&key=...
 *
 * Returns object metadata; image available as tile URLs via the
 * `webImage.url` field.
 */
async function getRijksmuseumArtworks(artistName) {
  const target = normalizeName(artistName);
  const q = encodeURIComponent(artistName);
  const url = `https://www.rijksmuseum.nl/api/en/collection?q=${q}&ps=12&key=${RIJKS_KEY}&format=json`;
  const body = await fetchJson(url);
  const items = body?.artObjects ?? [];
  if (items.length === 0) return [];

  const out = [];
  for (const it of items) {
    // Rijksmuseum's `principalOrFirstMaker` is the canonical name.
    const maker = it.principalOrFirstMaker ?? "";
    if (!normalizeName(maker).includes(target)) continue;
    if (!it.webImage?.url) continue;
    out.push({
      title: it.title ?? "Untitled",
      year: it.dating?.yearDisplay ?? it.dating?.presentingDate ?? undefined,
      medium: it.physicalMedium ?? undefined,
      // webImage.url is the original; append width query for thumb
      thumbUrl: `${it.webImage.url}?w=600`,
      fullUrl: it.webImage.url,
      sourceUrl: it.links?.web ?? `https://www.rijksmuseum.nl/en/collection/${it.objectNumber}`,
      license: "Public Domain (CC0)",
      licenseUrl: "https://www.rijksmuseum.nl/en/research/conduct-research/data",
      artist: maker,
      source: "Rijksmuseum",
    });
    if (out.length >= 6) break;
  }
  return out;
}

const artists = JSON.parse(await readFile(ARTISTS_PATH, "utf8"));
const sources = JSON.parse(await readFile(SOURCES_PATH, "utf8"));

console.log(
  `Open-source artwork sourcing for ${artists.length} artists (LoC + Rijksmuseum)...\n`,
);
const t0 = Date.now();

const byArtist = sources.byArtist ?? {};
let locHits = 0;
let rijksHits = 0;
let cursor = 0;
for (const artist of artists) {
  cursor++;
  if (cursor % 20 === 0) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    const eta = (((Date.now() - t0) / cursor) * (artists.length - cursor) / 1000).toFixed(0);
    process.stdout.write(
      `  [${cursor}/${artists.length}] elapsed ${elapsed}s, ETA ${eta}s\n`,
    );
  }

  const bundle = byArtist[artist.id] ?? { artworks: [], wikipediaImages: [] };
  if (!bundle.artworksLoR) bundle.artworksLoR = [];

  try {
    const loc = await getLocArtworks(artist.name);
    if (loc.length > 0) {
      locHits += loc.length;
      bundle.artworksLoR.push(
        ...loc.map((x) => ({ ...x, source: "Library of Congress" })),
      );
    }
    await sleep(GAP_MS);
    const rijks = await getRijksmuseumArtworks(artist.name);
    if (rijks.length > 0) {
      rijksHits += rijks.length;
      bundle.artworksLoR.push(
        ...rijks.map((x) => ({ ...x, source: "Rijksmuseum" })),
      );
    }
    byArtist[artist.id] = bundle;
  } catch (err) {
    console.log(`  ${artist.name}: error ${err.message ?? err}`);
  }

  if (cursor < artists.length) await sleep(GAP_MS);
}

sources.byArtist = byArtist;
sources.generatedAt = new Date().toISOString();
await writeFile(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");

console.log(`\nLoC artworks added: ${locHits}`);
console.log(`Rijksmuseum artworks added: ${rijksHits}`);
console.log(`Wrote ${path.relative(ROOT, SOURCES_PATH)}`);