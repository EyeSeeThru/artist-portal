import { useState } from "react";
import { Artist } from "@/types";
import { commonsThumbUrl } from "@/lib/wikipedia";
import movementsData from "@/data/movements.json";

/**
 * Minimum pixel dimensions we accept from a loaded <img>. Anything smaller
 * is almost certainly a disambig icon or stub thumbnail from Wikipedia,
 * even if the HTTP response is 200 + image/*. See IMAGE-SOURCING.md.
 */
const MIN_NATURAL_DIM = 300;

function resolveImageSrc(
  artist: Artist,
  width: number,
  coverOverride?: string | null,
): string | null {
  // Priority: explicit gallery-cover from sources.json → explicit imageUrl
  // override → Commons Special:FilePath redirect.
  if (coverOverride) return coverOverride;
  if (artist.imageUrl) return artist.imageUrl;
  if (artist.commonsImage) return commonsThumbUrl(artist.commonsImage, width);
  return null;
}

export function ArtistImage({
  artist,
  width = 400,
  className = "",
  coverOverride,
}: {
  artist: Artist;
  width?: number;
  className?: string;
  /** Optional override URL (e.g. a vetted artwork from sources.json) */
  coverOverride?: string | null;
}) {
  // Track three failure modes independently:
  //   - failed: the <img> errored (network/404/etc.)
  //   - tooSmall: it loaded but the image is a disambig icon / stub
  //   - until first successful render we can show the placeholder so the
  //     layout doesn't shift when we swap.
  const [failed, setFailed] = useState(false);
  const [tooSmall, setTooSmall] = useState(false);

  const src = resolveImageSrc(artist, width, coverOverride);
  const showImage = src && !failed && !tooSmall;

  const primaryMovement = artist.movements[0]
    ? movementsData.find((m) => m.key === artist.movements[0])
    : null;
  const color = primaryMovement?.color || "#6b5d4f";
  const initials =
    artist.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2) || "·";

  if (showImage) {
    return (
      <img
        src={src}
        alt={artist.name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        onLoad={(e) => {
          const img = e.currentTarget;
          // naturalWidth/Height are 0 until the image actually decodes.
          // If still 0 here, something is wrong — fall back rather than
          // render a broken icon.
          if (
            img.naturalWidth > 0 &&
            (img.naturalWidth < MIN_NATURAL_DIM ||
              img.naturalHeight < MIN_NATURAL_DIM)
          ) {
            setTooSmall(true);
          }
        }}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={artist.name}
      className={`flex items-center justify-center font-serif text-white ${className}`}
      style={{
        backgroundColor: color,
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.4%22/%3E%3C/svg%3E")',
      }}
    >
      <span className="text-4xl tracking-widest opacity-80">{initials}</span>
    </div>
  );
}
