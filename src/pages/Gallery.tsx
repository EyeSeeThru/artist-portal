import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, ExternalLink, Image as ImageIcon, Layers as LayersIcon } from "lucide-react";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import sourcesData from "@/data/sources.json";
import { Artwork, Artist } from "@/types";
import { useArtistStore } from "@/hooks/use-artist";
import { Badge } from "@/components/ui/badge";

/**
 * Image Gallery — masonry of artworks by artists in the archive.
 *
 * Two viewing modes (Option A from the brainstorm):
 *   - "By medium"  : one flat masonry filtered by the medium chips at top
 *                    (default view — most users come here to browse by
 *                    medium, not by era)
 *   - "By movement": the same items grouped into era sections, the
 *                    curatorial view
 *
 * Toggle at top of page; chip row swaps its meaning to match.
 *
 * Sources combined: Met + AIC (bundle.artworks), Wikipedia
 * (bundle.wikipediaImages), LoC + Rijksmuseum (bundle.artworksLoR).
 *
 * Constraints:
 *   - Lazy-load below the fold
 *   - Pagination via "Load more" (no infinite scroll)
 *   - Lightbox shows attribution + license
 *   - ~120 items per default view
 */

interface GalleryItem {
  artwork: Artwork;
  artist: Artist;
  movementKey: string;
}

const ITEMS_PER_PAGE = 120;
const ITEM_MARGIN_PX = 12;

type ViewMode = "medium" | "movement";

const COMMON_MEDIA = [
  "Painting",
  "Sculpture",
  "Photography",
  "Printmaking",
  "Installation",
  "Mixed Media",
];

// Match an artwork's `medium` string to one of the COMMON_MEDIA
// categories. Falls back to "Other" if nothing matches.
function bucketMedium(mediumText?: string): string {
  const t = (mediumText ?? "").toLowerCase();
  if (/paint|oil|tempera|acrylic|watercolour|watercolor|panel|canvas/.test(t)) return "Painting";
  if (/sculpt|bronze|marble|wood|ceramic|clay|plaster|metal/.test(t)) return "Sculpture";
  if (/photo|gélatin|gelatin|platinum|silver|salt print|albumen|tintype|cinematograph/.test(t)) return "Photography";
  if (/print|etching|engraving|lithograph|woodcut|screenprint|serigraph|linocut/.test(t)) return "Printmaking";
  if (/install/.test(t)) return "Installation";
  if (/mixed|collage|assemblage/.test(t)) return "Mixed Media";
  return "Other";
}

function groupByMovement(items: GalleryItem[]) {
  const groups: Record<string, GalleryItem[]> = {};
  for (const item of items) {
    if (!groups[item.movementKey]) groups[item.movementKey] = [];
    groups[item.movementKey].push(item);
  }
  return groups;
}

export default function Gallery() {
  const { setSelectedArtistId } = useArtistStore();
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [showCount, setShowCount] = useState(ITEMS_PER_PAGE);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("medium");
  const [selectedMedium, setSelectedMedium] = useState<string | null>(null);

  // Build the full pool: Met + AIC only (bundle.artworks).
  // Wikipedia images and LoC/Rijksmuseum data are NOT in the Gallery
  // pool — they're shown only on the artist detail page. The Gallery
  // is for artworks sourced from museum APIs.
  const allItems = useMemo<GalleryItem[]>(() => {
    const byId = new Map<string, Artist>();
    for (const a of artistsData as Artist[]) byId.set(a.id, a);
    const items: GalleryItem[] = [];
    for (const [artistId, bundle] of Object.entries(sourcesData.byArtist)) {
      const artist = byId.get(artistId);
      if (!artist) continue;
      const mk = artist.movements[0] ?? "unaffiliated";
      for (const aw of bundle.artworks ?? []) {
        items.push({ artwork: aw, artist, movementKey: mk });
      }
    }
    return items;
  }, []);

  // When the user toggles mode, clear the per-mode filter so they
  // don't accidentally keep the old chip set applied.
  useEffect(() => {
    setShowCount(ITEMS_PER_PAGE);
  }, [viewMode, selectedMedium, selectedArtist]);

  const filteredItems = useMemo(() => {
    let out = allItems;
    if (selectedArtist) out = out.filter((i) => i.artist.id === selectedArtist);
    if (selectedMedium) {
      out = out.filter((i) => bucketMedium(i.artwork.medium) === selectedMedium);
    }
    return out;
  }, [allItems, selectedArtist, selectedMedium]);

  const visibleItems = filteredItems.slice(0, showCount);
  const grouped = useMemo(
    () => groupByMovement(visibleItems),
    [visibleItems],
  );

  const artistsWithArtwork = useMemo<Artist[]>(() => {
    const seen = new Set<string>();
    const out: Artist[] = [];
    for (const i of allItems) {
      if (seen.has(i.artist.id)) continue;
      seen.add(i.artist.id);
      out.push(i.artist);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  const totalByMovement = useMemo(
    () => groupByMovement(filteredItems),
    [filteredItems],
  );

  // Per-medium counts for the chip row when in "by medium" mode
  const mediumCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of allItems) {
      const m = bucketMedium(i.artwork.medium);
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  const hasMore = filteredItems.length > showCount;

  // Close artist picker when clicking outside
  useEffect(() => {
    if (!artistPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-artist-picker]")) setArtistPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [artistPickerOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16 w-full"
    >
      <header className="mb-10">
        <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-3">
          Image Gallery
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium mb-4">
          Works from the archive
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Real artworks by the artists in the index — drawn from the
          Metropolitan Museum of Art&rsquo;s Open Access collection (CC0) and
          the Art Institute of Chicago. Click any image to enlarge, or the
          artist&rsquo;s name to open their profile.
        </p>
      </header>

      {/* Mode toggle */}
      <div className="mb-6 inline-flex items-center rounded-full border border-border bg-card/40 p-1 text-sm">
        <button
          type="button"
          onClick={() => setViewMode("medium")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-colors ${
            viewMode === "medium"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          By medium
        </button>
        <button
          type="button"
          onClick={() => setViewMode("movement")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-colors ${
            viewMode === "movement"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayersIcon className="w-3.5 h-3.5" />
          By movement
        </button>
      </div>

      {/* Filter chips — meaning swaps based on mode */}
      <div className="mb-10 flex flex-col gap-3">
        {viewMode === "medium" ? (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
              Medium:
            </span>
            <Badge
              variant={selectedMedium === null ? "default" : "outline"}
              className="cursor-pointer text-sm py-1.5 px-4 font-normal"
              onClick={() => setSelectedMedium(null)}
            >
              All ({allItems.length})
            </Badge>
            {COMMON_MEDIA.map((medium) => {
              const count = mediumCounts[medium] ?? 0;
              if (count === 0) return null;
              return (
                <Badge
                  key={medium}
                  variant={selectedMedium === medium ? "default" : "outline"}
                  className="cursor-pointer text-sm py-1.5 px-4 font-normal"
                  onClick={() => setSelectedMedium(medium)}
                >
                  {medium} ({count})
                </Badge>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
              Movements are sections below
            </span>
          </div>
        )}

        {/* Artist filter (always visible, regardless of mode) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
            Artist:
          </span>
          {selectedArtist && (
            <button
              type="button"
              onClick={() => setSelectedArtist(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline mr-2"
            >
              clear filter
            </button>
          )}
          {selectedArtist ? (
            <Badge variant="default" className="font-normal">
              {artistsWithArtwork.find((a) => a.id === selectedArtist)?.name}
            </Badge>
          ) : null}
          <div className="relative" data-artist-picker>
            <button
              type="button"
              onClick={() => setArtistPickerOpen((v) => !v)}
              className="text-xs font-medium border border-border rounded-full px-3 py-1 hover:bg-accent/50 transition-colors"
            >
              {selectedArtist ? "change artist…" : "pick an artist…"}
            </button>
            {artistPickerOpen && (
              <div className="absolute z-10 mt-2 left-0 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl w-72 p-2 text-sm">
                {artistsWithArtwork.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedArtist(a.id);
                      setArtistPickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded hover:bg-accent ${
                      selectedArtist === a.id ? "bg-accent" : ""
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Either: movement sections (curated) or a single flat masonry (by medium) */}
      {viewMode === "movement" ? (
        <div className="space-y-16">
          {movementsData.map((m) => {
            const items = grouped[m.key];
            if (!items || items.length === 0) return null;
            const totalForMovement = totalByMovement[m.key]?.length ?? items.length;
            return (
              <section key={m.key} className="space-y-5">
                <div className="flex items-end gap-3 border-b border-border/40 pb-3">
                  <span
                    className="w-3 h-3 rounded-full ring-2 ring-background shadow"
                    style={{ backgroundColor: m.color }}
                    aria-hidden
                  />
                  <h2 className="font-serif text-2xl md:text-3xl font-medium">
                    {m.label}
                  </h2>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground ml-auto tabular-nums">
                    {totalForMovement} work{totalForMovement === 1 ? "" : "s"}
                  </span>
                </div>
                <Masonry items={items} onOpen={setLightbox} onArtistClick={setSelectedArtistId} />
              </section>
            );
          })}

          {filteredItems.length === 0 && (
            <p className="text-muted-foreground text-center py-16">
              No artworks yet for this selection.
            </p>
          )}
        </div>
      ) : (
        <>
          <Masonry items={visibleItems} onOpen={setLightbox} onArtistClick={setSelectedArtistId} />
          {filteredItems.length === 0 && (
            <p className="text-muted-foreground text-center py-16">
              No artworks yet for this selection.
            </p>
          )}
        </>
      )}

      {hasMore && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={() => setShowCount((n) => n + ITEMS_PER_PAGE)}
            className="px-6 py-2.5 border border-border rounded-full text-sm font-medium hover:bg-accent transition-colors"
          >
            Load more works ({filteredItems.length - showCount} remaining)
          </button>
        </div>
      )}

      {lightbox && (
        <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
      )}

      <p className="mt-16 text-[11px] text-muted-foreground/60 italic text-center">
        Showing {visibleItems.length} of {filteredItems.length} artworks across{" "}
        {viewMode === "movement"
          ? `${Object.keys(grouped).length} movements`
          : "the archive"}
        . Refreshes as more works are sourced.
      </p>
    </motion.div>
  );
}

function Masonry({
  items,
  onOpen,
  onArtistClick,
}: {
  items: GalleryItem[];
  onOpen: (item: GalleryItem) => void;
  onArtistClick: (artistId: string) => void;
}) {
  return (
    <div
      className="columns-2 md:columns-3 lg:columns-4 xl:columns-5"
      style={{ columnGap: `${ITEM_MARGIN_PX}px` }}
    >
      {items.map((item) => (
        <figure
          key={item.artwork.fullUrl + item.artist.id}
          className="mb-3 break-inside-avoid group relative"
          style={{ marginBottom: `${ITEM_MARGIN_PX}px` }}
        >
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="block w-full text-left"
          >
            <img
              src={item.artwork.thumbUrl}
              alt={`${item.artwork.title}${item.artwork.year ? `, ${item.artwork.year}` : ""} — ${item.artwork.artist ?? item.artist.name}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full h-auto rounded-md bg-card transition-opacity duration-300 group-hover:opacity-90"
            />
          </button>
          <figcaption className="mt-2 px-1">
            <div className="text-xs font-medium leading-snug line-clamp-2">
              {item.artwork.title}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              <button
                type="button"
                onClick={() => onArtistClick(item.artist.id)}
                className="hover:underline focus:underline outline-none"
              >
                {item.artist.name}
              </button>
              {item.artwork.year ? ` · ${item.artwork.year}` : ""}
              {item.artwork.medium ? ` · ${item.artwork.medium}` : ""}
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Lightbox({
  item,
  onClose,
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  const { setSelectedArtistId } = useArtistStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="flex max-h-full max-w-5xl flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={item.artwork.fullUrl}
          alt={item.artwork.title}
          className="max-h-[80vh] max-w-full rounded object-contain shadow-2xl"
          referrerPolicy="no-referrer"
        />
        <div className="max-w-3xl text-center text-xs text-white/80 space-y-2">
          <div className="font-medium text-white text-base">
            {item.artwork.title}
            {item.artwork.year ? `, ${item.artwork.year}` : ""}
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedArtistId(item.artist.id);
                onClose();
              }}
              className="underline hover:text-white"
            >
              {item.artist.name}
            </button>
            {item.artwork.medium ? ` · ${item.artwork.medium}` : ""}
          </div>
          <div className="text-[11px] opacity-80 space-y-1">
            {item.artwork.attribution && <div>{item.artwork.attribution}</div>}
            <div>
              {item.artwork.license}
              {" · "}
              <a
                href={item.artwork.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline hover:text-white"
              >
                View on {item.artwork.source} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}