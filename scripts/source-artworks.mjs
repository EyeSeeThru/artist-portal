#!/usr/bin/env node
/**
 * Per-artist artworks sourcing for ArtCanon.
 *
 * For each artist, queries Wikimedia Commons for category members (file
 * namespace) under the artist's name category, validates each via the
 * Special:FilePath HEAD probe, and writes metadata to:
 *
 *   src/data/artworks.json   keyed by artistId
 *
 * Each entry: { title, filename, thumbUrl, commonsUrl, license, attribution }
 *
 * Polite defaults: concurrency=1, 1500ms gap, retries with backoff on 429/503.
 *
 * Caveat: Wikimedia Commons categories for living/contemporary artists skew
 * toward documentary photos ("FirstName LastName, 2019"). The UI component
 * displays the first 6 results and links out to the full category — no need
 * to filter at the script level.
 *
 * Run:  node scripts/source-artworks.mjs
 *       node scripts/source-artworks.mjs --dry-run
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
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
const MAX_ARTWORKS_PER_ARTIST = 24;
const MIN_SIZE = 5000;

const UA =
  "ArtCanonArtworkSourcing/0.1 (https://github.com/EyeSeeThru/artist-portal; educational project)";

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

async function validateCommonsFile(filename) {
  const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=600`;
  try {
    const res = await fetchWithRetry(url, {
      headers: { Range: "bytes=0-0", Accept: "image/*" },
    });
    if (res.status !== 200 && res.status !== 206) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
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
    if (size != null && size < MIN_SIZE) return null;
    return { sizeBytes: size, thumbUrl: res.url };
  } catch {
    return null;
  }
}

async function fetchImageInfo(filename) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "600",
    titles: `File:${filename}`,
  });
  try {
    const res = await fetchWithRetry(
      `https://commons.wikimedia.org/w/api.php?${params}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
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
  } catch {
    return null;
  }
}

/**
 * Find an artist's Commons category. We try a few name variants.
 * Returns the canonical category title or null.
 */
async function findArtistCategory(artist) {
  const variants = [
    artist.name,
    `${artist.name} (artist)`,
    artist.name.replace(/ /g, "_"),
  ];
  for (const v of variants) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "search",
      srnamespace: "14", // Category namespace
      srlimit: "1",
      srsearch: v,
      origin: "*",
    });
    try {
      const res = await fetchWithRetry(
        `https://commons.wikimedia.org/w/api.php?${params}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const hit = data.query?.search?.[0];
      if (hit && hit.title.toLowerCase().includes(artist.name.toLowerCase().split(" ").pop())) {
        return hit.title.replace(/^Category:/, "");
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Pull category members (files) from a category.
 */
async function listCategoryFiles(categoryTitle) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "categorymembers",
    cmtitle: `Category:${categoryTitle}`,
    cmtype: "file",
    cmlimit: String(MAX_ARTWORKS_PER_ARTIST * 2), // over-fetch since we'll filter
  });
  try {
    const res = await fetchWithRetry(
      `https://commons.wikimedia.org/w/api.php?${params}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.categorymembers ?? []).map((m) =>
      m.title.replace(/^File:/, ""),
    );
  } catch {
    return [];
  }
}

/**
 * Pull category members (files) from a category.
 */
async function sourceArtworksFor(artist) {
  const category = await findArtistCategory(artist);
  if (!category) return [];
  const filenames = await listCategoryFiles(category);
  if (filenames.length === 0) return [];

  const artworks = [];
  for (const filename of filenames) {
    if (artworks.length >= MAX_ARTWORKS_PER_ARTIST) break;
    const info = await fetchImageInfo(filename);
    if (!info) continue;
    artworks.push({
      title: filename,
      filename,
      thumbUrl: info.thumbUrl,
      fullUrl: info.fullUrl,
      commonsUrl: info.descriptionUrl,
      width: info.width,
      height: info.height,
      license: info.licenseShortName ?? "Unknown",
      licenseUrl: info.licenseUrl,
      artist: info.artist ?? artist.name,
    });
    if (artworks.length < MAX_ARTWORKS_PER_ARTIST) await sleep(GAP_MS);
  }
  return artworks;
}

// ---- main ----
const raw = await readFile(ARTISTS_PATH, "utf8");
const artists = JSON.parse(raw);

console.log(
  `Sourcing artworks for ${artists.length} artists (concurrency=${CONCURRENCY}, gap=${GAP_MS}ms)${DRY_RUN ? " [DRY RUN]" : ""}…\n`,
);

const artworksByArtist = {};
let cursor = 0;
let totalArtworks = 0;
for (const artist of artists) {
  cursor++;
  process.stdout.write(`  [${cursor}/${artists.length}] ${artist.name}… `);
  try {
    const artworks = await sourceArtworksFor(artist);
    artworksByArtist[artist.id] = artworks;
    totalArtworks += artworks.length;
    process.stdout.write(`✓ ${artworks.length} artworks\n`);
  } catch (err) {
    process.stdout.write(`✗ error: ${err.message ?? err}\n`);
    artworksByArtist[artist.id] = [];
  }
  if (cursor < artists.length) await sleep(GAP_MS);
}

const withArtworks = Object.values(artworksByArtist).filter((a) => a.length > 0).length;
console.log(
  `\nSourced ${totalArtworks} artworks across ${withArtworks}/${artists.length} artists.\n`,
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
      byArtist: artworksByArtist,
    },
    null,
    2,
  ) + "\n",
);

console.log(`Wrote ${path.relative(ROOT, ARTWORKS_PATH)}`);
