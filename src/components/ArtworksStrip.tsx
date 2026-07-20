import { useEffect, useState } from "react";
import { X, ExternalLink, ImageIcon } from "lucide-react";
import type { Artwork } from "@/types";

function ArtworkThumb({
  artwork,
  onClick,
}: {
  artwork: Artwork;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-24 w-24 md:h-28 md:w-28 flex-shrink-0 overflow-hidden rounded border border-border bg-muted transition-all hover:ring-2 hover:ring-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Enlarge ${artwork.title}`}
      title={`${artwork.title}${artwork.year ? ` (${artwork.year})` : ""}`}
    >
      <img
        src={artwork.thumbUrl}
        alt={artwork.title}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
    </button>
  );
}

function Lightbox({
  artwork,
  onClose,
}: {
  artwork: Artwork;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition-colors hover:bg-white/20"
        aria-label="Close enlarged view"
      >
        <X className="h-5 h-5" />
      </button>
      <div
        className="flex max-h-full max-w-5xl flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={artwork.fullUrl}
          alt={artwork.title}
          className="max-h-[80vh] max-w-full rounded object-contain shadow-2xl"
          referrerPolicy="no-referrer"
        />
        <div className="max-w-3xl text-center text-xs text-white/80">
          <div className="font-medium text-white">{artwork.title}</div>
          {(artwork.year || artwork.medium) && (
            <div className="mt-1 text-white/60">
              {[artwork.year, artwork.medium].filter(Boolean).join(" · ")}
            </div>
          )}
          <div className="mt-2">
            {artwork.artist && <span>{artwork.artist} · </span>}
            {artwork.license}
            {artwork.licenseUrl && (
              <>
                {" · "}
                <a
                  href={artwork.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  License
                </a>
              </>
            )}
            {" · "}
            <a
              href={artwork.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline hover:text-white"
            >
              View on {artwork.source} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArtworksStrip({
  artworks,
  artistName,
}: {
  artworks: Artwork[];
  artistName: string;
}) {
  const [active, setActive] = useState<Artwork | null>(null);
  if (!artworks.length) return null;
  const SAMPLE = 3;
  const sample = artworks.slice(0, SAMPLE);
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Other artworks
          </p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {artworks.length}
          </span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {sample.map((artwork) => (
            <ArtworkThumb
              key={artwork.fullUrl}
              artwork={artwork}
              onClick={() => setActive(artwork)}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/70 italic">
          From {Array.from(new Set(artworks.map((a) => a.source))).join(", ")}.
          Click to enlarge.
        </p>
      </div>
      {active && <Lightbox artwork={active} onClose={() => setActive(null)} />}
    </>
  );
}

/**
 * Inline placeholder shown when an artist has no artworks sourced yet —
 * keeps the visual rhythm consistent across artists instead of dropping the
 * section silently.
 */
export function ArtworksEmpty({ artistName }: { artistName: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Other artworks
      </p>
      <div className="flex items-center gap-3 rounded border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <ImageIcon className="h-5 w-5 shrink-0 opacity-60" />
        <span>
          No artworks currently sourced for{" "}
          <span className="font-medium">{artistName}</span>.
        </span>
      </div>
    </div>
  );
}
