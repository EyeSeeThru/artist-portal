import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import {
  CommonsImageInfo,
  commonsThumbUrl,
  fetchCommonsImageInfo,
} from "@/lib/wikipedia";

function Thumbnail({
  filename,
  alt,
  onClick,
}: {
  filename: string;
  alt: string;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-20 w-20 md:h-24 md:w-24 flex-shrink-0 overflow-hidden rounded border border-border bg-muted transition-all hover:ring-2 hover:ring-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Enlarge artwork by ${alt}`}
    >
      <img
        src={commonsThumbUrl(filename, 240)}
        alt={alt}
        loading="lazy"
        onError={() => setErrored(true)}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
    </button>
  );
}

function Lightbox({
  filename,
  artistName,
  onClose,
}: {
  filename: string;
  artistName: string;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<CommonsImageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setInfo(null);
    fetchCommonsImageInfo(filename).then((i) => {
      if (mounted) {
        setInfo(i);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [filename]);

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
          src={commonsThumbUrl(filename, 1600)}
          alt={artistName}
          className="max-h-[80vh] max-w-full rounded object-contain shadow-2xl"
        />
        <div className="max-w-3xl text-center text-xs text-white/80">
          {loading ? (
            <span className="italic">Loading attribution…</span>
          ) : info ? (
            <>
              {info.artist || artistName} ·{" "}
              {info.licenseShortName || "Public Domain"} ·{" "}
              <a
                href={info.descriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline hover:text-white"
              >
                Wikimedia Commons <ExternalLink className="h-3 w-3" />
              </a>
            </>
          ) : (
            "Image via Wikimedia Commons"
          )}
        </div>
      </div>
    </div>
  );
}

export function FeaturedWorksStrip({
  works,
  artistName,
}: {
  works: string[];
  artistName: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  if (!works.length) return null;
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Featured works
        </p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {works.map((filename) => (
            <Thumbnail
              key={filename}
              filename={filename}
              alt={artistName}
              onClick={() => setActive(filename)}
            />
          ))}
        </div>
      </div>
      {active && (
        <Lightbox
          filename={active}
          artistName={artistName}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
