#!/usr/bin/env node
// scripts/wikipedia-list-extract.mjs
//
// Pulls the "List of African-American visual artists" page from Wikipedia,
// parses every <li> entry into { name, wikiKey, birthYear, deathYear,
// description }, and diffs against the current src/data/artists.json to
// produce two output files:
//
//   scripts/.tmp/wikipedia-list.json       — full parsed list (236 entries)
//   scripts/.tmp/wikipedia-list-new.json   — entries NOT in current artists.json
//
// Pure data extraction. Does NOT modify artists.json or sources.json.

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TMP = resolve(__dirname, ".tmp");

const LIST_URL =
  "https://en.wikipedia.org/wiki/List_of_African-American_visual_artists";

const UA = "artist-portal-scale-up/1.0 (https://github.com/EyeSeeThru/artist-portal)";

async function fetchList() {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching list page`);
  return res.text();
}

// Pull the artist block (between <h2 id="Artists"> and <h2 id="Artist_groups">).
function extractArtistsSection(html) {
  const m = html.match(
    /<h2 id="Artists">.*?(?=<h2 id="Artist_groups">)/s,
  );
  if (!m) throw new Error("could not locate Artists section in HTML");
  return m[0];
}

// Match each <li> entry. Pattern: <li><a href="/wiki/Title">Name</a>
// (born YYYY | YYYY–YYYY | c. YYYY – c. YYYY | other), description [tags OK]
// </li>. Tolerant of trailing <sup class="mw-ref">...</sup> reference markers,
// embedded <span>s, and other inline tags in the description.
const ENTRY_RE =
  /<li[^>]*>.*?<a [^>]*href="https?:\/\/en\.wikipedia\.org\/wiki\/([^"#]+)"[^>]*>([^<]+)<\/a>\s*\(([^)]+?)\)\s*,\s*([\s\S]*?)<\/li>/g;

function parseEntries(section) {
  const out = [];
  for (const m of section.matchAll(ENTRY_RE)) {
    const [, wikiKey, name, datesRaw, descriptionHtml] = m;
    const cleanDesc = descriptionHtml
      .replace(/<[^>]+>/g, "") // strip all tags from the description
      .replace(/&#160;/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\[\d+\]/g, "") // strip Wikipedia footnote markers like [1], [1][2]
      .replace(/\s+/g, " ")
      .trim();
    const dates = datesRaw
      .replace(/<abbr[^>]*>c\.<\/abbr>/gi, "c.")
      .replace(/\s+/g, " ")
      .trim();

    let birthYear = null;
    let deathYear = null;

    // "c. YYYY – c. YYYY", "c. YYYY – YYYY", "YYYY – c. YYYY"
    const approxRange = dates.match(
      /c\.?\s*(\d{4})\s*[–-]\s*(?:c\.?\s*)?(\d{4}|present)/i,
    );
    if (approxRange) {
      birthYear = parseInt(approxRange[1], 10);
      const d = approxRange[2].toLowerCase();
      if (d !== "present") deathYear = parseInt(d, 10);
    }
    // "born YYYY" / "b. YYYY"
    else if (/^born\s/i.test(dates) || /^b\.\s/i.test(dates)) {
      const bornMatch = dates.match(/(\d{4})/);
      if (bornMatch) birthYear = parseInt(bornMatch[1], 10);
    }
    // "YYYY–YYYY" / "YYYY/YY–YYYY"
    else {
      const rangeMatch = dates.match(/^(\d{4})\s*(?:[\/–-]\s*\d{0,4})?\s*[–-]\s*(\d{4})/);
      if (rangeMatch) {
        birthYear = parseInt(rangeMatch[1], 10);
        deathYear = parseInt(rangeMatch[2], 10);
      } else {
        const singleMatch = dates.match(/^(\d{4})\s*[–-]\s*$/);
        if (singleMatch) birthYear = parseInt(singleMatch[1], 10);
        else if (/^\d{4}$/.test(dates)) birthYear = parseInt(dates, 10);
      }
    }

    out.push({
      wikiKey,
      name: name.trim(),
      dates,
      birthYear,
      deathYear,
      description: cleanDesc,
    });
  }
  return out;
}

// slugify like the existing artists.json (lowercase, dashes, strip parens).
function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/['']/g, "")            // strip apostrophes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  await mkdir(TMP, { recursive: true });

  console.log(`Fetching ${LIST_URL}…`);
  const html = await fetchList();
  console.log(`  got ${html.length} bytes`);

  const section = extractArtistsSection(html);
  const entries = parseEntries(section);
  console.log(`  parsed ${entries.length} artist entries`);

  // Attach deterministic id slug.
  for (const e of entries) {
    e.id = slugify(e.name);
  }

  // Diff against current artists.json.
  const currentRaw = await readFile(
    resolve(ROOT, "src/data/artists.json"),
    "utf8",
  );
  const current = JSON.parse(currentRaw);
  const currentIds = new Set(current.map((a) => a.id));
  const currentWikiKeys = new Set(
    current.map((a) => a.wikiKey).filter(Boolean),
  );

  const newEntries = entries.filter(
    (e) => !currentIds.has(e.id) && !currentWikiKeys.has(e.wikiKey),
  );
  const existingEntries = entries.filter(
    (e) => currentIds.has(e.id) || currentWikiKeys.has(e.wikiKey),
  );

  console.log(`  current artists.json: ${current.length} entries`);
  console.log(`  matched in current:  ${existingEntries.length}`);
  console.log(`  new (not in current): ${newEntries.length}`);

  await writeFile(
    resolve(TMP, "wikipedia-list.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: LIST_URL,
        total: entries.length,
        entries,
      },
      null,
      2,
    ),
  );
  await writeFile(
    resolve(TMP, "wikipedia-list-new.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: LIST_URL,
        total: newEntries.length,
        entries: newEntries,
      },
      null,
      2,
    ),
  );

  // Print a compact preview of the new entries.
  console.log("\nNew entries (first 20):");
  for (const e of newEntries.slice(0, 20)) {
    const yr = e.birthYear ?? "?";
    const dy = e.deathYear ? `–${e.deathYear}` : "";
    console.log(
      `  ${e.id.padEnd(32)}  ${e.name.padEnd(28)}  (${yr}${dy})  ${e.description}`,
    );
  }
  if (newEntries.length > 20) {
    console.log(`  … and ${newEntries.length - 20} more`);
  }

  console.log(`\nWrote scripts/.tmp/wikipedia-list.json`);
  console.log(`Wrote scripts/.tmp/wikipedia-list-new.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});