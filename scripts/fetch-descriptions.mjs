#!/usr/bin/env node
/**
 * Pre-fetch Wikipedia REST summaries for every artist in artists.json so
 * search can match against biographical text without doing 393 network
 * requests at runtime.
 *
 * Polite defaults: concurrency=1, 1500ms gap, retries on 429/503.
 * ~30-50 min wall-clock for all 393 artists.
 *
 * Writes src/data/descriptions.json:
 *   {
 *     generatedAt: ISO,
 *     byArtist: { [artistId]: { extract: string, description?: string } }
 *   }
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const OUT_PATH = path.join(ROOT, "src/data/descriptions.json");

const GAP_MS = 1500;
const MAX_RETRIES = 4;

const UA = "ArtCanonDescriptions/0.1 (https://github.com/EyeSeeThru/artist-portal; educational project)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    } catch {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const ra = Number(res.headers.get("retry-after")) || 0;
      const backoff = Math.max(ra * 1000, 2500 * (attempt + 1));
      console.log(`  rate-limited, sleeping ${(backoff/1000).toFixed(1)}s`);
      await sleep(backoff);
      continue;
    }
    return res;
  }
  return null;
}

async function fetchSummary(wikiKey) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiKey)}?redirect=true`;
  const res = await fetchWithRetry(url);
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    const extract = data.extract ?? "";
    if (!extract) return null;
    return {
      extract,
      description: data.description ?? undefined,
    };
  } catch {
    return null;
  }
}

const artists = JSON.parse(await readFile(ARTISTS_PATH, "utf8"));
console.log(`Fetching Wikipedia summaries for ${artists.length} artists...\n`);

const byArtist = {};
let fetched = 0, failed = 0;
let cursor = 0;
for (const artist of artists) {
  cursor++;
  process.stdout.write(`  [${cursor}/${artists.length}] ${artist.name}… `);
  const sum = await fetchSummary(artist.wikiKey);
  if (sum) {
    byArtist[artist.id] = sum;
    fetched++;
    process.stdout.write(`✓\n`);
  } else {
    process.stdout.write(`✗\n`);
    failed++;
  }
  if (cursor < artists.length) await sleep(GAP_MS);
}

console.log(`\nFetched ${fetched} summaries, ${failed} failed.`);

await writeFile(
  OUT_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalArtists: artists.length,
      fetched,
      failed,
      byArtist,
    },
    null,
    2,
  ) + "\n",
);

console.log(`Wrote ${path.relative(ROOT, OUT_PATH)}`);
