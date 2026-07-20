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
3. **Wikimedia Commons category search** — `?action=query&list=search&srnamespace=6&srsearch={name}+portrait` finds file hits. Top result is validated by the audit script before being accepted.

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

Artists the automated ladder couldn't source as of 2026-07-19:

| ID | Name |
|---|---|
| `ernest-crichlow` | Ernest Crichlow |
| `barbara-jones-hogu` | Barbara Jones-Hogu |
| `wadsworth-jarrell` | Wadsworth Jarrell |
| `senga-nengudi` | Senga Nengudi |
| `lynette-yiadom-boakye` | Lynette Yiadom-Boakye |
| `deana-lawson` | Deana Lawson |

To fill one manually: add `imageUrl`, `imageSource`, `imageLicense`, `imageAttribution` to the artist's entry in `src/data/artists.json` and append the same record to `src/data/sources.json` for auditability.
