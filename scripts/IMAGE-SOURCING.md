# Image sourcing

How images for artists are obtained and validated.

## Source ladder (in priority order)

1. **`commonsImage` field on the artist** — uses Wikimedia Commons' `Special:FilePath/{filename}?width={w}` redirect to a vetted `upload.wikimedia.org` URL. License and attribution come from the Commons file page.
2. **`imageUrl` field on the artist** — direct URL for images sourced from outside Commons (Wikipedia summary thumbnails, museum IIIF, etc). Must be accompanied by `imageSource`, `imageLicense`, `imageAttribution`.
3. **Initials placeholder** — movement-colored textured div with the artist's initials. Used when neither source is available.

## Fallback ladder for sourcing new images

When an artist has no `commonsImage`, `scripts/source-images.mjs` walks this ladder:

1. **Wikipedia REST page summary** — `https://en.wikipedia.org/api/rest_v1/page/summary/{wikiKey}` returns `originalimage.source`. Wikipedia vets this upstream (filters disambig icons). License varies per image; the script records attribution pointing back to the Wikipedia article.
2. **Wikipedia pageimages** — `?prop=pageimages&piprop=original` returns the lead image from a Wikipedia article. Same attribution pattern as above.

**Removed: Wikimedia Commons category search.** As of 2026-07-20 this path is disabled. It returned wrong subjects in 12 out of 12 cases — for biographical subjects the search engine ranks unrelated PDFs (yearbooks, copyright catalogs, biographies of different people) above actual portraits. The audit step couldn't tell apart, so any commons-search result was effectively a coin flip on whether it was the right person. If you want to re-enable it, you need both a filename-structure filter (require the artist's last name in the filename) and a subject-confirmation step (probably a Wikipedia check).

Anything the ladder can't fill is left for manual sourcing — no AI-generated portraits, no scraped museum images without clear licensing.

## Validation

`scripts/audit-images.mjs` probes every `commonsImage` URL and reports a verdict:

- **good** — 200 + `image/*` content-type + ≥ 5 KB
- **missing** — 404, 4xx, network error
- **wrong-type** — 200 but HTML response (error page disguised as success)
- **too-small** — valid image but under 5 KB (likely disambig icon or stub)
- **no-source** — artist has neither `commonsImage` nor `imageUrl`

The audit uses a Range request (`bytes=0-0`) so it doesn't download full images.

## Render-time hardening (`ArtistImage.tsx`)

Three failure modes caught at render:

- **`onError`** — image failed to load → fall back to initials
- **`onLoad` + `naturalWidth/Height` check** — image loaded but is under 96 px on either axis → disambig icon, fall back
- **`failed || tooSmall` state** — independent flags so the placeholder renders cleanly

`referrerPolicy="no-referrer"` is set so third-party image hosts don't get the page URL.

## Politeness

Wikimedia's CDN rate-limits aggressively. Both scripts use:

- `User-Agent: ArtCanonImageAudit/0.1 (https://github.com/EyeSeeThru/artist-portal; educational project)`
- Concurrency: 1
- Gap between requests: 1500 ms
- Retries on 429 / 503 with exponential backoff honoring `Retry-After`

Don't crank these up — it'll just 429 you for hours.

## Manual-fill list

Artists the automated ladder couldn't source. The original 6 were never
sourced; the other 12 were added on 2026-07-20 when the broken
`commons-search` results were rolled back (see `sources.json` `_rollback_log`).

| ID | Name |
|---|---|
| `ernest-crichlow` | Ernest Crichlow |
| `emma-amos` | Emma Amos |
| `reginald-gammon` | Reginald Gammon |
| `william-majors` | William Majors |
| `barbara-jones-hogu` | Barbara Jones-Hogu |
| `wadsworth-jarrell` | Wadsworth Jarrell |
| `gerald-williams` | Gerald Williams |
| `nelson-stevens` | Nelson Stevens |
| `carolyn-lawrence` | Carolyn Lawrence |
| `benny-andrews` | Benny Andrews |
| `dana-chandler` | Dana C. Chandler Jr. |
| `murry-depillars` | Murry DePillars |
| `senga-nengudi` | Senga Nengudi |
| `kerry-james-marshall` | Kerry James Marshall |
| `carrie-mae-weems` | Carrie Mae Weems |
| `lynette-yiadom-boakye` | Lynette Yiadom-Boakye |
| `deana-lawson` | Deana Lawson |
| `charles-gaines` | Charles Gaines |

To fill one manually: add `imageUrl`, `imageSource`, `imageLicense`, `imageAttribution` to the artist's entry in `src/data/artists.json` and append the same record to `src/data/sources.json` for auditability.
