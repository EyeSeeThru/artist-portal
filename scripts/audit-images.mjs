#!/usr/bin/env node
/**
 * Phase 1 image audit for ArtCanon.
 *
 * Walks src/data/artists.json, hits each artist's `commonsImage` URL via the
 * Special:FilePath redirect, follows to the real upload.wikimedia.org URL,
 * and captures:
 *   - final HTTP status
 *   - final content-type (must be image/jpeg, image/png, image/webp, etc.)
 *   - final URL (real upload.wikimedia.org URL = real file on Commons)
 *   - final content-length (tiny files are likely disambig icons)
 *
 * Outputs:
 *   - scripts/image-audit.json  (machine-readable, used by later phases)
 *   - stdout summary           (human-readable)
 *
 * Verdicts:
 *   - good       — 200 + image/* + ≥ MIN_SIZE bytes (default 5 KB)
 *   - missing    — 404 / no commonsImage / no response
 *   - wrong-type — 200 but content-type is text/html (real error page)
 *   - too-small  — 200 + image but under MIN_SIZE (likely disambig icon)
 *   - error      — network / unexpected
 *
 * Usage:
 *   node scripts/audit-images.mjs [--concurrency=5] [--width=400] [--min-size=5000]
 *
 * Wikimedia TOS: this is a polite, read-only probe with a 1 req / 250 ms gap
 * and a custom User-Agent. Do NOT crank concurrency past ~10.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ---- args ----
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.+))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const CONCURRENCY = Number(args.concurrency ?? 1);
const WIDTH = Number(args.width ?? 400);
const MIN_SIZE = Number(args["min-size"] ?? 5000);
const GAP_MS = Number(args["gap"] ?? 1500); // Wikimedia is strict on burst
const MAX_RETRIES = Number(args["max-retries"] ?? 3);
const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const REPORT_PATH = path.join(__dirname, "image-audit.json");

// Wikimedia asks for a descriptive UA. We don't pretend to be a browser.
const UA =
  "ArtCanonImageAudit/0.1 (https://github.com/EyeSeeThru/artist-portal; educational project)";

// ---- helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function commonsThumbUrl(filename, width) {
  // Mirror src/lib/wikipedia.ts → commonsThumbUrl exactly. Keep in sync.
  const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${width}`;
}

function verdictFor({ status, contentType, sizeBytes }) {
  if (status === 404) return "missing";
  if (status >= 400) return "missing";
  if (status >= 500) return "error";
  if (!contentType || !contentType.startsWith("image/")) return "wrong-type";
  if (sizeBytes != null && sizeBytes < MIN_SIZE) return "too-small";
  return "good";
}

/**
 * Probe a single URL with a HEAD-equivalent follow. We use GET with a Range
 * header so the redirect chain resolves without downloading the whole file —
 * Wikimedia honors Range and returns 206 + Content-Range with the real size.
 * Falls back to a full GET if the server doesn't honor Range.
 */
async function probe(url, attempt = 0) {
  try {
    // Cheap probe via Range request — only ask for the first byte.
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Range: "bytes=0-0",
        Accept: "image/*",
      },
    });

    // Respect 429 / 503 with retry-after
    if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const backoff = Math.max(retryAfter * 1000, 2000 * (attempt + 1));
      await sleep(backoff);
      return probe(url, attempt + 1);
    }

    let sizeBytes = null;
    const cr = res.headers.get("content-range");
    if (cr) {
      // Format: "bytes 0-0/12345" — total after the slash
      const m = cr.match(/\/(\d+)$/);
      if (m) sizeBytes = Number(m[1]);
    }
    if (sizeBytes == null) {
      const cl = res.headers.get("content-length");
      if (cl) sizeBytes = Number(cl);
    }

    return {
      status: res.status,
      finalUrl: res.url,
      contentType: res.headers.get("content-type"),
      sizeBytes,
      attempts: attempt + 1,
    };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(2000 * (attempt + 1));
      return probe(url, attempt + 1);
    }
    return { status: 0, error: String(err?.message ?? err) };
  }
}

/**
 * Run a list of async tasks with a max-concurrency cap and a fixed gap between
 * task starts so we don't burst the API. Returns results in input order.
 */
async function runWithConcurrency(items, limit, gapMs, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
      if (gapMs > 0 && cursor < items.length) await sleep(gapMs);
    }
  });
  await Promise.all(runners);
  return results;
}

// ---- main ----
const raw = await readFile(ARTISTS_PATH, "utf8");
const artists = JSON.parse(raw);

console.log(
  `Auditing ${artists.length} artists (concurrency=${CONCURRENCY}, width=${WIDTH}, min-size=${MIN_SIZE}B, gap=${GAP_MS}ms)…\n`,
);

const tasks = artists.map((a) => async () => {
  if (!a.commonsImage) {
    return { artistId: a.id, name: a.name, verdict: "no-source" };
  }
  const url = commonsThumbUrl(a.commonsImage, WIDTH);
  const probe_ = await probe(url);
  const verdict = verdictFor(probe_);
  return {
    artistId: a.id,
    name: a.name,
    commonsImage: a.commonsImage,
    probedUrl: url,
    finalUrl: probe_.finalUrl,
    status: probe_.status,
    contentType: probe_.contentType,
    sizeBytes: probe_.sizeBytes,
    verdict,
    attempts: probe_.attempts,
    error: probe_.error,
    };
});

const results = await runWithConcurrency(tasks, CONCURRENCY, GAP_MS, (t) => t());

// ---- summary ----
const counts = { good: 0, missing: 0, "wrong-type": 0, "too-small": 0, error: 0, "no-source": 0 };
for (const r of results) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;

const totalWithSource = artists.length - counts["no-source"];
const healthy = counts.good;
const healthyPct = totalWithSource
  ? ((healthy / totalWithSource) * 100).toFixed(1)
  : "0.0";

console.log("─── verdict breakdown ───");
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(11)} ${String(v).padStart(3)}`);
}
console.log(
  `\nHealthy images: ${healthy} / ${totalWithSource} sourced (${healthyPct}%)\n`,
);

// Print the worst offenders
const bad = results
  .filter((r) => r.verdict !== "good" && r.verdict !== "no-source")
  .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

if (bad.length) {
  console.log("─── needs attention ───");
  for (const r of bad) {
    console.log(
      `  [${r.verdict.padEnd(10)}] ${r.name}  (${r.commonsImage ?? "—"})  status=${r.status} size=${r.sizeBytes ?? "?"}B type=${r.contentType ?? "—"}`,
    );
  }
  console.log("");
}

// ---- write report ----
const report = {
  generatedAt: new Date().toISOString(),
  config: { concurrency: CONCURRENCY, width: WIDTH, minSize: MIN_SIZE, gapMs: GAP_MS, maxRetries: MAX_RETRIES },
  summary: { ...counts, total: artists.length, sourced: totalWithSource },
  results,
};

await mkdir(path.dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`Wrote report → ${path.relative(ROOT, REPORT_PATH)}`);
