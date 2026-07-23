#!/usr/bin/env node
/**
 * Validate the results of rescover.mjs:
 *  - Patrick H. Reason has wikipediaPortrait populated (the key case)
 *  - Wikipedia pageImages are populated for the artists the audit found
 *  - Cover URLs for the 31 mismatched-artists now point to the portrait
 *  - sources.json parses cleanly, has expected fields
 */
import { readFile } from "node:fs/promises";

const ROOT = "/tmp/artist-portal-work";
const sources = JSON.parse(await readFile(`${ROOT}/src/data/sources.json`, "utf8"));
const artists = JSON.parse(await readFile(`${ROOT}/src/data/artists.json`, "utf8"));
const byId = Object.fromEntries(artists.map((a) => [a.id, a]));

const audit = JSON.parse(
  await readFile(`${ROOT}/scripts/.tmp/portrait-audit.json`, "utf8"),
);

const auditsById = Object.fromEntries(audit.map((a) => [a.id, a]));

// 1. Patrick H. Reason
const reason = sources.byArtist["patrick-reason"];
console.log("=== 1. Patrick H. Reason ===");
console.log("  wikipediaPortrait:", reason?.wikipediaPortrait ? `${reason.wikipediaPortrait.title} (from ${reason.wikipediaPortrait.attribution || "?"})` : "(none)");
console.log("  wikipediaImages count:", reason?.wikipediaImages?.length ?? 0);
console.log("  galleryCover:", reason?.galleryCover?.slice(0, 80) ?? "(none)");

// 2. Coverage stats across all artists
let withPortrait = 0;
let withBodyImages = 0;
let withCover = 0;
let bodyTotal = 0;
for (const id of Object.keys(sources.byArtist)) {
  const b = sources.byArtist[id];
  if (b.wikipediaPortrait) withPortrait++;
  if (b.wikipediaImages?.length > 0) {
    withBodyImages++;
    bodyTotal += b.wikipediaImages.length;
  }
  if (b.galleryCover) withCover++;
}
console.log(`\n=== 2. Coverage stats ===`);
console.log(`Artists with wikipediaPortrait: ${withPortrait} (audit found ${audit.filter((a) => a.pageImage).length})`);
console.log(`Artists with at least one wikipediaImage: ${withBodyImages}, total body images: ${bodyTotal}`);
console.log(`Artists with galleryCover set: ${withCover}`);

// 3. The 31 mismatched artists: do they now show portraits as covers?
function filenameFromUrl(url) {
  if (!url) return null;
  // Handles Special:FilePath URLs and upload.wikimedia.org thumb URLs
  const m1 = url.match(/\/FilePath\/([^?]+)/);
  if (m1) return decodeURIComponent(m1[1]);
  const m2 = url.match(/\/thumb\/\d+\/\d+\/([^/?]+)\/\d+px-([^?]+)/);
  if (m2) return decodeURIComponent(m2[2]);
  const m3 = url.match(/\/commons\/\d+\/\d+\/([^?]+)/);
  if (m3) return decodeURIComponent(m3[1]);
  return null;
}

let fixCount = 0;
let stillWrong = 0;
const stillWrongList = [];
for (const a of audit) {
  if (!a.pageImage) continue;
  const bundle = sources.byArtist[a.id];
  if (!bundle?.galleryCover) continue;
  const coverFile = filenameFromUrl(bundle.galleryCover);
  if (!coverFile) continue;
  const coverNorm = coverFile
    .toLowerCase()
    .replace(/\.\w+$/, "")
    .replace(/[^a-z0-9]/g, "");
  const portraitNorm = a.pageImage
    .toLowerCase()
    .replace(/\.\w+$/, "")
    .replace(/[^a-z0-9]/g, "");
  if (coverNorm === portraitNorm) fixCount++;
  else {
    stillWrong++;
    if (stillWrongList.length < 10) {
      stillWrongList.push({ name: a.name, coverFile, pageImage: a.pageImage });
    }
  }
}
console.log(`\n=== 3. Cover-vs-portrait alignment ===`);
console.log(`Of ${audit.filter((a) => a.pageImage).length} artists with a pageImage:`);
console.log(`  Now show pageImage as cover: ${fixCount}`);
console.log(`  Still show a different image (likely a museum artwork): ${stillWrong}`);
if (stillWrongList.length) {
  console.log(`  Sample "still wrong" cases:`);
  for (const x of stillWrongList) {
    console.log(`    ${x.name}: cover=${x.coverFile}, pageImage=${x.pageImage}`);
  }
}

console.log("\n=== 4. Sanity: file integrity ===");
console.log(`sources.json: ${Object.keys(sources.byArtist).length} artist entries`);
console.log(`generatedAt: ${sources.generatedAt}`);
