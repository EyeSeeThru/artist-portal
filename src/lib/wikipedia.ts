export interface WikipediaSummary {
  title: string;
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  originalImage?: { source: string; width: number; height: number };
  contentUrl: string;
  description?: string;
}

export interface CommonsImageInfo {
  url: string;
  descriptionUrl: string;
  artist?: string;
  licenseShortName?: string;
  licenseUrl?: string;
}

const summaryCache = new Map<string, Promise<WikipediaSummary | null>>();
const commonsCache = new Map<string, Promise<CommonsImageInfo | null>>();

const stripHtml = (html: string): string =>
  html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export function fetchArtistSummary(
  wikiKey: string,
): Promise<WikipediaSummary | null> {
  if (summaryCache.has(wikiKey)) return summaryCache.get(wikiKey)!;

  const promise = (async () => {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        wikiKey,
      )}?redirect=true`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title,
        extract: data.extract ?? stripHtml(data.extract_html ?? ""),
        description: data.description,
        thumbnail: data.thumbnail
          ? {
              source: data.thumbnail.source,
              width: data.thumbnail.width,
              height: data.thumbnail.height,
            }
          : undefined,
        originalImage: data.originalimage
          ? {
              source: data.originalimage.source,
              width: data.originalimage.width,
              height: data.originalimage.height,
            }
          : undefined,
        contentUrl:
          data.content_urls?.desktop?.page ??
          `https://en.wikipedia.org/wiki/${wikiKey}`,
      } as WikipediaSummary;
    } catch {
      return null;
    }
  })();

  summaryCache.set(wikiKey, promise);
  return promise;
}

export function fetchCommonsImageInfo(
  filename: string,
): Promise<CommonsImageInfo | null> {
  if (commonsCache.has(filename)) return commonsCache.get(filename)!;

  const promise = (async () => {
    try {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        titles: `File:${filename}`,
        origin: "*",
      });
      const res = await fetch(
        `https://commons.wikimedia.org/w/api.php?${params}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      const pages = data.query?.pages ?? {};
      const page = Object.values(pages)[0] as any;
      const info = page?.imageinfo?.[0];
      if (!info) return null;
      const meta = info.extmetadata ?? {};
      return {
        url: info.url,
        descriptionUrl: info.descriptionurl,
        artist: stripHtml(meta.Artist?.value ?? "") || undefined,
        licenseShortName: meta.LicenseShortName?.value,
        licenseUrl: meta.LicenseUrl?.value,
      } as CommonsImageInfo;
    } catch {
      return null;
    }
  })();

  commonsCache.set(filename, promise);
  return promise;
}

export function commonsThumbUrl(filename: string, width = 600): string {
  // Direct Special:FilePath URL with ?width param — no API call needed for the image itself
  const encoded = encodeURIComponent(filename.replace(/ /g, "_"));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${width}`;
}
