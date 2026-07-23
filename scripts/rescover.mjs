#!/usr/bin/env node
/**
 * Re-source Wikipedia images for every artist with the following fixes
 * vs the legacy source-artworks.mjs:
 *
 *   1. RESOLVE REDIRECTS. wikiKey values that point to a redirect page
 *      (e.g. "Patrick Henry Reason" → "Patrick H. Reason") get the
 *      image list from the target page, not the redirect.
 *   2. CAPTURE THE PAGEIMAGE (Wikipedia's picked lead image, conventionally
 *      a portrait) SEPARATELY from body images. Stored at
 *      `bundle.wikipediaPortrait` so the cover picker can prefer it.
 *   3. FILTER NOISE. Body images that are Wikipedia UI icons, "P vip"
 *      stubs, "Cscr-featured" stars, or any other non-content noise get
 *      dropped. The legacy filter used filename heuristics that missed
 *      these.
 *   4. KEEP THE LOOKS-LIKE-ARTWORK HEURISTIC for body images (so we
 *      don't surface portraits twice), but apply it to body images
 *      only — the pageImage bypasses it because we WANT a portrait
 *      there when one exists.
 *
 * The museum-API artwork objects in sources.json are preserved as-is.
 * We only rewrite `bundle.wikipediaImages`, add `bundle.wikipediaPortrait`,
 * and re-pick `bundle.galleryCover` with the new precedence:
 *   museum artwork > pageImage > first body image > commonsImage
 *
 * Polite defaults: concurrency=1, 1200ms gap (faster than the 1500 in
 * the legacy script — en.wikipedia.org allows it).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ARTISTS_PATH = path.join(ROOT, "src/data/artists.json");
const SOURCES_PATH = path.join(ROOT, "src/data/sources.json");

const GAP_MS = 1200;
const MAX_RETRIES = 4;
const UA =
  "BVARescover/0.1 (https://github.com/EyeSeeThru/artist-portal; educational project)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
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

async function fetchJson(url) {
  const r = await fetchWithRetry(url);
  if (!r || !r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

// Wikipedia-side "this image filename is a known noise token" filter.
// The legacy script only filtered Commons-metadata noise; this catches
// Wikipedia UI chrome that the API still returns inside `prop=images`,
// AND known-leak filenames that propagate across articles via template
// cross-references and Wikipedia UI cross-links.
function isNoiseImage(filename) {
  const f = filename.toLowerCase();
  // Known-leak filenames from prior audits: these files get embedded in
  // unrelated artists' Wikipedia articles via template / cross-reference
  // mechanics and look indistinguishable from real artwork by filename
  // alone. Hard-deny these specific filenames.
  const HARD_DENY_FILENAMES = [
    "normanrockwell.jpeg", // white-American illustrator, leaks via "See also"
    "nuvola_apps_package_graphics.png", // KDE/Linux UI icon, leaks via stub marker
    "auguste_rodin_-_penseur.png", // French sculptor's work, not Black artists'
  ];
  for (const blocked of HARD_DENY_FILENAMES) {
    if (f === blocked) return true;
  }

  // Wikipedia / Wikimedia UI icon and meta-image signatures
  const deny = [
    "oojs_ui_icon",
    "edit-ltr",
    "edit-progressive",
    "wikidata-logo",
    "wikimedia",
    "wikipedia",
    "wikiquote",
    "wikisource",
    "wikibooks",
    "wikinews",
    "wikiversity",
    "wikivoyage",
    "wiktionary",
    "commons-logo",
    "sister-project",
    "disambig",
    "stub",
    "folders",
    "nuvola_apps",
    "crystal_",
    "gnome-",
    "silk-",
    "question_book",
    "lock-",
    "increase-",
    "decrease-",
    "ambox",
    "mbox",
    "wikisource-logo",
    "speakerlink",
    "yes_check",
    "redx",
    "skull",
    "csi",
    "p vip.svg",
    "p vip", // Wikipedia "VIP" stub marker
    "cscr-featured",
    "fram minute man",
    "fram_minute_man",
    "fram_minuteman",
    "minute_man",
    "minuteman",
    "wikimedia-isogd",
    "wikimedia foundation",
    "creative_commons",
    "cc-by",
    "cc-by-sa",
    "cc-by-nc",
    "public-domain",
    "pd-icon",
    "ged_wiki",
    "edit-clear",
    "system-search",
    "emblem-",
    "shimmery",
    "tab_",
    "compass_",
    "wikizero",
    "star (",
    "folder-",
    "blank ",
    ".ogg",
    ".ogv",
    ".webm",
    ".mp3",
    "icon",
    "logo",
    "symb-",
  ];
  return deny.some((d) => f.includes(d));
}

// Heuristic for body images: still need to filter out portraits of the
// artist from the artwork list (so duplicates don't appear on the
// detail page) — the pageImage handles the portrait.
function looksLikeArtwork(title, artistName) {
  const t = title.toLowerCase();
  const name = artistName.toLowerCase();
  const last = name.split(/\s+/).pop() ?? "";

  // Year signature usually means the artist's artwork
  if (/\b1[789]\d{2}\b|\b20\d{2}\b/.test(t)) return true;
  // "by <artist>" / "by <lastname>" — clear attribution to the artist
  if (t.includes(`by ${name}`)) return true;
  if (last && t.includes(`by ${last}`)) return true;
  // "X, Y" or "X (artist)" suffixes — those tend to be canvas titles
  if (t.includes(`${name},`)) return true;

  // Negative: exact-name portrait files (X.jpg / X.png / X.webp)
  // We want portraits on the pageImage slot, not duplicated into body list.
  const strippedExt = t.replace(/\.\w+$/, "");
  if (strippedExt === name) return false;

  // Negative: grave / tombstone / memorial / headstone
  const graves = ["grave", "tombstone", "headstone", "obituary", "memorial"];
  if (graves.some((g) => t.includes(g))) return false;

  // Negative: studio / home / passport / signature / signing
  const studio = ["studio", "passport", "signing", "autograph"];
  if (studio.some((g) => t.includes(g))) return false;

  // Default: pass — Wikipedia won't put pure noise on a notable artist's article
  return true;
}

// Resolve a wikiKey against Wikipedia to get:
//   - the actual article title (following redirects)
//   - the pageImage filename (Wikipedia's picked lead image)
//   - the body images (everything in the article's `prop=images` minus noise)
async function fetchWikipediaContext(wikiKey) {
  const params = new URLSearchParams({
    action: "query",
    titles: wikiKey,
    prop: "images|pageimages",
    imlimit: "50",
    piprop: "name|original",
    redirects: "1", // follow redirects transparently
    format: "json",
  });
  const d = await fetchJson(
    `https://en.wikipedia.org/w/api.php?${params}`,
  );
  if (!d?.query?.pages) return null;
  const page = Object.values(d.query.pages)[0];
  if (!page) return null;
  const resolvedTitle = page.title ?? wikiKey;
  const pageImage = page.pageimage ?? null;
  // Body images come back pre-filtered (no missing-page artifacts); we apply
  // our noise filter below.
  const bodyImageTitles = (page.images ?? [])
    .map((img) => (img.title ?? "").replace(/^File:/, ""))
    .filter((f) => /\.(jpg|jpeg|png|webp|tif+)$/i.test(f));
  return {
    resolvedTitle,
    pageImage,
    bodyImageTitles,
  };
}

// Fetch imageinfo for a Commons file, validating it serves a real image
// AND that the image isn't a UI-icon-sized thumbnail. Returns null if the
// image is too small to be useful as a portrait or artwork thumbnail.
async function getCommonsImageInfo(filename) {
  const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
  const probeUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=600`;
  const probe = await fetchWithRetry(probeUrl);
  if (!probe || probe.status !== 200) return null;
  const ct = probe.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) return null;

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

  // Reject UI icons / stub placeholders by physical size. These always
  // come back from the API as ~128x128 because that's their native
  // size on Commons. Real portraits and artworks are at least 400px
  // on their longest side. We use the requested-thumbnail size which
  // is consistent regardless of original aspect ratio.
  const tw = info.thumbwidth ?? info.width ?? 0;
  const th = info.thumbheight ?? info.height ?? 0;
  if (tw > 0 && th > 0) {
    const minSide = Math.min(tw, th);
    const minSidePx = 300;
    if (minSide < minSidePx) return null;
  }

  return {
    thumbUrl: info.thumburl ?? info.url,
    fullUrl: info.url,
    descriptionUrl: info.descriptionurl,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    license: meta.LicenseShortName?.value
      ? stripHtml(meta.LicenseShortName.value)
      : "Public Domain",
    licenseUrl: meta.LicenseUrl?.value,
    artist: meta.Artist?.value ? stripHtml(meta.Artist.value) : undefined,
  };
}

// New cover-picker precedence:
//   1. First museum-API artwork (real artwork, vetted by Met/AIC filters)
//   2. Wikipedia pageImage (the portrait convention)
//   3. First filtered body image (artwork)
//   4. commonsImage / imageUrl
function pickGalleryCover(artist, bundle) {
  if (bundle.artworks?.[0]?.thumbUrl) return bundle.artworks[0].thumbUrl;
  if (bundle.wikipediaPortrait?.thumbUrl) return bundle.wikipediaPortrait.thumbUrl;
  if (bundle.wikipediaImages?.[0]?.thumbUrl) return bundle.wikipediaImages[0].thumbUrl;
  if (artist.commonsImage) {
    const fn = encodeURIComponent(artist.commonsImage);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${fn}?width=600`;
  }
  if (artist.imageUrl) return artist.imageUrl;
  return null;
}

// ---- main ----
const artists = JSON.parse(await readFile(ARTISTS_PATH, "utf8"));
const sources = JSON.parse(await readFile(SOURCES_PATH, "utf8"));

console.log(
  `Re-sourcing Wikipedia images for ${artists.length} artists...\n`,
);
const t0 = Date.now();

const updatedSources = { ...sources };
if (!updatedSources.byArtist) updatedSources.byArtist = {};
const byArtist = updatedSources.byArtist;
const counts = {
  portraitCaptured: 0,
  bodyCaptured: 0,
  noiseFiltered: 0,
  redirected: 0,
  missingPage: 0,
};
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

  const ctx = await fetchWikipediaContext(artist.wikiKey);
  const bundle = byArtist[artist.id] ?? { wikipediaImages: [], artworks: [] };

  bundle.wikipediaImages = [];
  bundle.wikipediaPortrait = undefined;

  if (!ctx || (ctx.bodyImageTitles.length === 0 && !ctx.pageImage)) {
    counts.missingPage++;
    bundle.galleryCover = pickGalleryCover(artist, bundle);
    byArtist[artist.id] = bundle;
    if (cursor < artists.length) await sleep(GAP_MS);
    continue;
  }

  // Track redirects so we can spot-check the database
  if (
    ctx.resolvedTitle.toLowerCase().replace(/ /g, "_") !==
    (artist.wikiKey ?? "").toLowerCase()
  ) {
    counts.redirected++;
  }

  // 1. Page image (portrait) — bypass noise & artwork filters since we WANT a
  //    portrait there. Validate it on Commons; bail silently if 404.
  if (ctx.pageImage) {
    const info = await getCommonsImageInfo(ctx.pageImage);
    if (info) {
      bundle.wikipediaPortrait = {
        title: ctx.pageImage,
        ...info,
        source: "Wikimedia Commons",
      };
      counts.portraitCaptured++;
    }
    await sleep(GAP_MS);
  }

  // 2. Body images — filter noise first, then looksLikeArtwork, then fetch
  //    Commons imageinfo to validate.
  const seen = new Set();
  if (bundle.wikipediaPortrait) seen.add(bundle.wikipediaPortrait.title.toLowerCase());

  for (const filename of ctx.bodyImageTitles) {
    if (seen.has(filename.toLowerCase())) continue;
    if (isNoiseImage(filename)) {
      counts.noiseFiltered++;
      continue;
    }
    if (!looksLikeArtwork(filename, artist.name)) continue;
    const info = await getCommonsImageInfo(filename);
    if (!info) continue;
    seen.add(filename.toLowerCase());
    bundle.wikipediaImages.push({
      title: filename,
      ...info,
      source: "Wikimedia Commons",
    });
    counts.bodyCaptured++;
    if (bundle.wikipediaImages.length >= 6) break;
    await sleep(GAP_MS);
  }

  bundle.galleryCover = pickGalleryCover(artist, bundle);
  byArtist[artist.id] = bundle;
  if (cursor < artists.length) await sleep(GAP_MS);
}

updatedSources.generatedAt = new Date().toISOString();
await writeFile(SOURCES_PATH, JSON.stringify(updatedSources, null, 2) + "\n");

console.log(`\n=== Summary ===`);
console.log(`PageImages (portraits) captured: ${counts.portraitCaptured}`);
console.log(`Body images (artworks) captured: ${counts.bodyCaptured}`);
console.log(`Noise images filtered: ${counts.noiseFiltered}`);
console.log(`Redirected wikiKey pages: ${counts.redirected}`);
console.log(`Artists with nothing Wikipedia-side (kept artworks/commonsImage): ${counts.missingPage}`);
console.log(`\nWrote ${path.relative(ROOT, SOURCES_PATH)}`);
