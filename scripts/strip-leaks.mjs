// Surgically remove known-leak filenames from sources.json.
// Patterns use word/phrase matching tolerant of "Nuvola apps package graphics"
// vs "nuvola_apps_package_graphics" filename/title variations.
import { readFile, writeFile } from "node:fs/promises";

const sources = JSON.parse(
  await readFile("/tmp/artist-portal-work/src/data/sources.json", "utf8"),
);

// Lowercase substring patterns that mean "this image is not a portrait of
// the artist": UI icons, stub markers, cross-reference trophies, etc.
const BAD_SUBSTRINGS = [
  "nuvola",                          // KDE UI icon (e.g. Nuvola_apps_package_graphics)
  "normanrockwell",                  // white illustrator
  "auguste_rodin",                   // French sculptor's The Thinker
  "auguste rodin",                   //  ...with space too
  "pulitzer medal",                  // medal, not a photo of the artist
  "pulitzer-prize",                  // ditto
  "cscr-featured",                   // Wikipedia star
  "p_vip",                           // VIP stub marker
  "p vip",                           //  ...with space
  "oojs_ui_icon",                    // Wikimedia UI icons
  "oojs ui icon",                    //  ...with space
  "disambig",                        // disambiguation icons
  "wikimedia foundation",            // Wikmedia logo
  "commons-logo",
  "fram_minute_man",                 // American Revolution stock art
  "fram minute man",
  "key.svg",
  "lock-icon",
  "yes_check",
  "redx",
  "crystal",
  "ambox",
  "mbox",
  "edit-ltr",
];

function isBad(filename) {
  if (!filename) return false;
  const f = filename.toLowerCase();
  return BAD_SUBSTRINGS.some((s) => f.includes(s));
}

function filenameOf(img) {
  if (img?.title) return img.title;
  const url = img?.thumbUrl || img?.sourceUrl || "";
  const m = url.match(/\/thumb\/\d+\/\d+\/([^/?]+)/);
  if (m) return decodeURIComponent(m[1]);
  const m2 = url.match(/\/commons\/\d+\/\d+\/([^/?]+)/);
  if (m2) return decodeURIComponent(m2[1]);
  return "";
}

function coverFilename(url) {
  if (!url) return "";
  const m = url.match(/\/FilePath\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  const m2 = url.match(/\/thumb\/\d+\/\d+\/([^/?]+)\/\d+px-([^?]+)/);
  if (m2) return decodeURIComponent(m2[2]);
  const m3 = url.match(/\/commons\/\d+\/\d+\/([^?]+)/);
  if (m3) return decodeURIComponent(m3[1]);
  return "";
}

let touched = 0;
const removed = [];

for (const [id, b] of Object.entries(sources.byArtist)) {
  let dirty = false;

  if (Array.isArray(b.wikipediaImages)) {
    const kept = [];
    for (const img of b.wikipediaImages) {
      const fn = filenameOf(img);
      if (isBad(fn)) {
        removed.push({ id, field: "wikipediaImages", title: fn });
        dirty = true;
      } else {
        kept.push(img);
      }
    }
    b.wikipediaImages = kept;
  }

  if (b.wikipediaPortrait && isBad(filenameOf(b.wikipediaPortrait))) {
    removed.push({ id, field: "wikipediaPortrait", title: filenameOf(b.wikipediaPortrait) });
    b.wikipediaPortrait = undefined;
    dirty = true;
  }

  if (b.galleryCover && isBad(coverFilename(b.galleryCover))) {
    removed.push({ id, field: "galleryCover", title: coverFilename(b.galleryCover) });
    b.galleryCover = null;
    dirty = true;
  }

  if (dirty) touched++;
}

sources.generatedAt = new Date().toISOString();
await writeFile(
  "/tmp/artist-portal-work/src/data/sources.json",
  JSON.stringify(sources, null, 2) + "\n",
);

console.log(`Touched ${touched} artist bundles; removed ${removed.length} bad references.`);
for (const r of removed) console.log(`  - ${r.id} (${r.field}): ${r.title}`);
