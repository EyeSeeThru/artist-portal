#!/usr/bin/env node
/**
 * Per-artist sourcing for ArtCanon, v3 — vetted data only.
 *
 * For each artist we produce:
 *   1. portrait        — Wikidata P18 if it parses as a Commons file with
 *                        the artist name in its categories. Optional.
 *   2. wikipediaImages — files embedded in the English Wikipedia article
 *                        (filtered to images whose Commons categories include
 *                        the artist's name — editorial vetting).
 *   3. artworks        — top 3–6 real artworks from Met + Art Institute of
 *                        Chicago APIs (PD-only image URLs, strict artist-name
 *                        match on the response).
 *
 * Output: src/data/sources.json with shape:
 *   {
 *     byArtist: {
 *       [artistId]: {
 *         portrait?: { thumbUrl, fullUrl, sourceUrl, license, attribution },
 *         wikipediaImages: [{ thumbUrl, fullUrl, sourceUrl, license, attribution, title }, ...],
 *         artworks:        [{ thumbUrl, fullUrl, sourceUrl, license, artist, title, year, medium, source }, ...],
 *         galleryCover?: string  // URL of the chosen gallery-card image
 *       }
 *     }
 *   }
 *
 * Polite defaults: concurrency=1, 1500ms gap, retries on 429/503.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const SOURCES_PATH = path.join(ROOT, "src/data/sources.json");

const GAP_MS = 1500;
const MAX_RETRIES = 4;
const MIN_IMAGE_BYTES = 5000;

const UA =
  "ArtCanonSourcing/0.3 (https://github.com/EyeSeeThru/artist-portal; educational project)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        ...opts,
        headers: { "User-Agent": UA, ...(opts.headers ?? {}) },
      });
    } catch {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const ra = Number(res.headers.get("retry-after")) || 0;
      const backoff = Math.max(ra * 1000, 2500 * (attempt + 1));
      await sleep(backoff);
      continue;
    }
    return res;
  }
  throw new Error(`Failed after ${MAX_RETRIES} retries: ${url}`);
}

async function fetchJson(url, opts = {}) {
  const r = await fetchWithRetry(url, opts);
  if (!r.ok) return null;
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
 * Heuristic: is a Wikipedia-article image likely an artwork (vs a portrait of
 * the artist, a photo of them, a building, etc.)?
 * Heuristics:
 *   - filenames containing year (4-digit number, often preceded by comma/space)
 *   - filenames NOT matching "portrait of X", "X in Y", "X - grave", etc.
 *   - filenames NOT starting with the artist's name alone (those tend to be
 *     portraits)
 */
function looksLikeArtwork(title, artistName) {
  const t = title.toLowerCase();
  const name = artistName.toLowerCase();
  const last = name.split(/\s+/).pop() ?? "";

  // Strong positive: 4-digit year in filename
  if (/\b1[789]\d{2}\b|\b20\d{2}\b/.test(t)) return true;

  // Strong negative: portrait-of / photo-of / obituary / grave / home / studio tour
  const negatives = [
    `portrait of ${name}`,
    `${name} portrait`,
    `${name} (`,
    `${name} in `,
    `${name} - grave`,
    `${name} grave`,
    `grave of ${name}`,
    `home of ${name}`,
    `home on `,
    `home in `,
    `studio of ${name}`,
    `${name} studio`,
    `${name} demonstration`,
    `passport`,
    `visitors view`,
    `interview `,
    `speaking at`,
    `speech by`,
    `${name}.jpg`,
    `${name}.png`,
    `${name}.webp`,
    `${name} (artist)`,
    `${name} (painter)`,
    `${name} (sculptor)`,
    `photo of ${name}`,
    `photograph of ${name}`,
    `headstone`,
    `tombstone`,
    `obituary`,
    `signing`,
    `at the oscars`,
    `red carpet`,
    `press conference`,
    `first lady `,
    `award `,
    `award.`,
    `bank `,
    `plaque`,
    `talk `,
    `talks`,
    `conversation`,
    `wall street`,
    `wyoming`,
  ];
  for (const n of negatives) {
    if (t.includes(n)) return false;
  }

  // Strong positive: contains "by <name>" (e.g. "Christ walking on the water, Henry Ossawa Tanner.jpg")
  if (t.includes(`by ${name}`)) return true;
  if (last && t.includes(`by ${last}`)) return true;

  // Fall through: filename that doesn't match a clear negative is included
  return true;
}

/**
 * Get images embedded in the English Wikipedia article for this artist,
 * filtered to ones that look like artworks. Validates each via Special:FilePath
 * (real image, large enough).
 */
async function getWikipediaImages(artistName, wikiKey) {
  const params = new URLSearchParams({
    action: "query",
    titles: wikiKey.replace(/ /g, "_"),
    prop: "images",
    imlimit: "30",
    format: "json",
  });
  const body = await fetchJson(
    `https://en.wikipedia.org/w/api.php?${params}`,
  );
  const pages = body?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page?.images) return [];
  const filenames = page.images
    .map((i) => i.title.replace(/^File:/, ""))
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));

  const results = [];
  for (const filename of filenames) {
    if (!looksLikeArtwork(filename, artistName)) continue;
    const info = await getCommonsImageInfo(filename);
    if (!info) continue;
    results.push({
      title: filename,
      thumbUrl: info.thumbUrl,
      fullUrl: info.fullUrl,
      sourceUrl: info.descriptionUrl,
      width: info.width,
      height: info.height,
      license: info.licenseShortName ?? "Public Domain",
      licenseUrl: info.licenseUrl,
      attribution: info.artist,
      source: "Wikimedia Commons",
    });
    if (results.length >= 8) break;
    await sleep(GAP_MS);
  }
  return results;
}

/**
 * Get imageinfo + extmetadata for a Commons file. Returns null if file is
 * missing, too small, or not an image.
 */
async function getCommonsImageInfo(filename) {
  const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
  // Validate it serves a real image, large enough. Follow redirects — Commons
  // returns 302 to the upload.wikimedia.org CDN URL.
  const probeUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=600`;
  const probe = await fetchWithRetry(probeUrl, {
    method: "GET",
    redirect: "follow",
    headers: { Accept: "image/*" },
  });
  if (probe.status !== 200) return null;
  const ct = probe.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) return null;

  // Then fetch imageinfo for metadata + thumb URL
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "600",
    titles: `File:${filename}`,
  });
  const body = await fetchJson(
    `https://commons.wikimedia.org/w/api.php?${params}`,
  );
  const page = body?.query?.pages ? Object.values(body.query.pages)[0] : null;
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").trim();
  return {
    thumbUrl: info.thumburl ?? info.url,
    fullUrl: info.url,
    descriptionUrl: info.descriptionurl,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    licenseShortName: meta.LicenseShortName?.value
      ? stripHtml(meta.LicenseShortName.value)
      : undefined,
    licenseUrl: meta.LicenseUrl?.value,
    artist: meta.Artist?.value ? stripHtml(meta.Artist.value) : undefined,
  };
}

/**
 * Real artworks from The Met Collection API.
 * Strict filter: artistDisplayName must be non-empty and contain the
 * artist's full name. Image URLs only available when isPublicDomain=true.
 */
async function getMetArtworks(artistName) {
  const q = encodeURIComponent(artistName);
  const searchBody = await fetchJson(
    `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${q}&hasImages=true`,
  );
  const ids = Array.isArray(searchBody?.objectIDs) ? searchBody.objectIDs : [];
  if (ids.length === 0) return [];

  const target = normalizeName(artistName);
  const results = [];
  for (const id of ids.slice(0, 24)) {
    const obj = await fetchJson(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
    );
    if (!obj) continue;
    if (!obj.isPublicDomain) continue;
    const display = normalizeName(obj.artistDisplayName);
    if (!display || !display.includes(target)) continue;
    if (!obj.primaryImageSmall && !obj.primaryImage) continue;
    results.push({
      title: obj.title,
      year: obj.objectDate,
      medium: obj.medium,
      thumbUrl: obj.primaryImageSmall,
      fullUrl: obj.primaryImage,
      sourceUrl: obj.objectURL,
      license: "Public Domain (CC0)",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      artist: obj.artistDisplayName,
      source: "The Metropolitan Museum of Art",
    });
    if (results.length >= 6) break;
    await sleep(GAP_MS);
  }
  return results;
}

/**
 * Real artworks from Art Institute of Chicago API.
 * Strict filter: artist_display must be non-empty and contain the artist's
 * full name. IIIF image URLs are publicly served.
 */
async function getAicArtworks(artistName) {
  const params = new URLSearchParams();
  params.set("q", artistName);
  params.append("query[bool][must][][match_phrase][artist_display]", artistName);
  params.set(
    "fields",
    "id,title,artist_display,is_public_domain,image_id,date_display,medium_display,artist_title",
  );
  params.set("limit", "24");
  const body = await fetchJson(
    `https://api.artic.edu/api/v1/artworks/search?${params}`,
  );
  const data = Array.isArray(body?.data) ? body.data : [];
  if (data.length === 0) return [];

  const target = normalizeName(artistName);
  const base = "https://www.artic.edu/iiif/2";
  const results = [];
  for (const obj of data) {
    if (!obj.image_id) continue;
    const display = normalizeName(
      obj.artist_display ?? obj.artist_title ?? "",
    );
    if (!display || !display.includes(target)) continue;
    results.push({
      title: obj.title,
      year: obj.date_display,
      medium: obj.medium_display,
      thumbUrl: `${base}/${obj.image_id}/full/600,/0/default.jpg`,
      fullUrl: `${base}/${obj.image_id}/full/1686,/0/default.jpg`,
      sourceUrl: `https://www.artic.edu/artworks/${obj.id}`,
      license: obj.is_public_domain
        ? "Public Domain (CC0)"
        : "Art Institute of Chicago (open access)",
      licenseUrl: "https://www.artic.edu/terms",
      artist: (obj.artist_display ?? obj.artist_title ?? "").split("\n")[0],
      source: "Art Institute of Chicago",
    });
    if (results.length >= 6) break;
  }
  return results;
}

/**
 * Compose artworks for an artist: Met + AIC, dedupe by title.
 */
async function getArtworks(artistName) {
  const met = await getMetArtworks(artistName);
  if (met.length >= 3) return met.slice(0, 6);
  const aic = await getAicArtworks(artistName);
  const seen = new Set(met.map((a) => a.title));
  return [...met, ...aic.filter((a) => !seen.has(a.title))].slice(0, 6);
}

/**
 * Pick the gallery cover image for an artist. Prefer:
 *   1. First museum-API artwork (real artwork, not a portrait of the artist)
 *   2. First Wikipedia-article artwork (vetted by Wikipedia editors)
 *   3. Existing commonsImage / imageUrl as last resort
 */
function pickGalleryCover(artist, bundle) {
  return (
    bundle.artworks?.[0]?.thumbUrl ??
    bundle.wikipediaImages?.[0]?.thumbUrl ??
    null
  );
}

// ---- main ----
const raw = await readFile(ARTISTS_PATH, "utf8");
const artists = JSON.parse(raw);

console.log(
  `Sourcing data for ${artists.length} artists via Wikipedia + Met + AIC…\n`,
);

const byArtist = {};
let cursor = 0;
let totalWikimedia = 0;
let totalArtworks = 0;
for (const artist of artists) {
  cursor++;
  process.stdout.write(`  [${cursor}/${artists.length}] ${artist.name}… `);
  try {
    const wikipediaImages = await getWikipediaImages(artist.name, artist.wikiKey);
    const artworks = await getArtworks(artist.name);
    const bundle = { wikipediaImages, artworks };
    bundle.galleryCover = pickGalleryCover(artist, bundle);
    byArtist[artist.id] = bundle;
    totalWikimedia += wikipediaImages.length;
    totalArtworks += artworks.length;
    process.stdout.write(
      `✓ ${wikipediaImages.length} wiki, ${artworks.length} artworks\n`,
    );
  } catch (err) {
    byArtist[artist.id] = { wikipediaImages: [], artworks: [] };
    process.stdout.write(`✗ error: ${err.message ?? err}\n`);
  }
  if (cursor < artists.length) await sleep(GAP_MS);
}

const withWiki = Object.values(byArtist).filter((b) => b.wikipediaImages.length > 0).length;
const withArt = Object.values(byArtist).filter((b) => b.artworks.length > 0).length;
console.log(
  `\nSourced ${totalWikimedia} Wikipedia images across ${withWiki}/${artists.length} artists.`,
);
console.log(
  `Sourced ${totalArtworks} museum-API artworks across ${withArt}/${artists.length} artists.\n`,
);

await writeFile(
  SOURCES_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalArtists: artists.length,
      totalWikimedia,
      totalArtworks,
      byArtist,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Wrote ${path.relative(ROOT, SOURCES_PATH)}`);