import { useEffect, useState } from "react";
import { X, ExternalLink, ImageIcon } from "lucide-react";
import type { Artwork } from "@/types";

function WikiThumb({
  image,
  onClick,
}: {
  image: Artwork;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-24 w-24 md:h-28 md:w-28 flex-shrink-0 overflow-hidden rounded border border-border bg-muted transition-all hover:ring-2 hover:ring-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Enlarge ${image.title}`}
      title={image.title}
    >
      <img
        src={image.thumbUrl}
        alt={image.title}
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
  image,
  onClose,
}: {
  image: Artwork;
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
          src={image.fullUrl}
          alt={image.title}
          className="max-h-[80vh] max-w-full rounded object-contain shadow-2xl"
          referrerPolicy="no-referrer"
        />
        <div className="max-w-3xl text-center text-xs text-white/80">
          <div className="font-medium text-white">{image.title}</div>
          <div className="mt-2">
            {image.attribution && <span>{image.attribution} · </span>}
            {image.license}
            {" · "}
            <a
              href={image.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline hover:text-white"
            >
              Wikimedia Commons <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WikipediaImagesStrip({
  images,
  artistName,
}: {
  images: Artwork[];
  artistName: string;
}) {
  const [active, setActive] = useState<Artwork | null>(null);
  if (!images.length) return null;
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            From Wikipedia
          </p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {images.length}
          </span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {images.map((image) => (
            <WikiThumb
              key={image.fullUrl}
              image={image}
              onClick={() => setActive(image)}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/70 italic">
          Images from the Wikipedia article on {artistName}. Click to enlarge.
        </p>
      </div>
      {active && <Lightbox image={active} onClose={() => setActive(null)} />}
    </>
  );
}

export function WikipediaImagesEmpty() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        From Wikipedia
      </p>
      <div className="flex items-center gap-3 rounded border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <ImageIcon className="h-5 w-5 shrink-0 opacity-60" />
        <span>No images on the Wikipedia article for this artist.</span>
      </div>
    </div>
  );
}