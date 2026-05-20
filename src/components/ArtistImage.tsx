import { useState } from "react";
import { Artist } from "@/types";
import { commonsThumbUrl } from "@/lib/wikipedia";
import movementsData from "@/data/movements.json";

export function ArtistImage({
  artist,
  width = 400,
  className = "",
}: {
  artist: Artist;
  width?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

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

  if (artist.commonsImage && !errored) {
    return (
      <img
        src={commonsThumbUrl(artist.commonsImage, width)}
        alt={artist.name}
        loading="lazy"
        onError={() => setErrored(true)}
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
