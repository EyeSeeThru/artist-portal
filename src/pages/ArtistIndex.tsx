import { useState, useMemo } from "react";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import sourcesData from "@/data/sources.json";
import { Artist } from "@/types";
import { ArtistImage } from "@/components/ArtistImage";
import { useArtistStore } from "@/hooks/use-artist";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

/**
 * Artist Index — list-style grid of every artist in the archive,
 * sorted by last name. Smaller cards than the old Gallery page;
 * click any card to open the detail panel.
 */
export default function ArtistIndex() {
  const { setSelectedArtistId } = useArtistStore();
  const [selectedMedium, setSelectedMedium] = useState<string | null>(null);

  const allMedia = Array.from(new Set(artistsData.flatMap((a) => a.medium))).sort();
  void allMedia; // available for future filters
  const commonMedia = [
    "Painting",
    "Sculpture",
    "Photography",
    "Printmaking",
    "Installation",
    "Mixed Media",
  ];

  const lastName = (n: string) =>
    n.replace(/\s*\([^)]*\)\s*$/, "").trim().split(/\s+/).slice(-1)[0];

  const movementColorByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mv of movementsData) m[mv.key] = mv.color;
    return m;
  }, []);

  const filteredArtists = (
    selectedMedium
      ? artistsData.filter((a) => a.medium.includes(selectedMedium))
      : artistsData
  )
    .slice()
    .sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-12 w-full"
    >
      <div className="mb-10">
        <h1 className="font-serif text-4xl font-medium mb-2">Artist Index</h1>
        <p className="text-muted-foreground max-w-2xl">
          Every artist in the archive, sorted by last name. Filter by medium
          or click any artist to open their profile.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <Badge
          variant={selectedMedium === null ? "default" : "outline"}
          className="cursor-pointer text-sm py-1.5 px-4 font-normal"
          onClick={() => setSelectedMedium(null)}
        >
          All
        </Badge>
        {commonMedia.map((medium) => (
          <Badge
            key={medium}
            variant={selectedMedium === medium ? "default" : "outline"}
            className="cursor-pointer text-sm py-1.5 px-4 font-normal"
            onClick={() => setSelectedMedium(medium)}
          >
            {medium}
          </Badge>
        ))}
      </div>

      {/*
        5-up at xl, 4-up at lg, 3-up at sm, 2-up below.
        Each card holds a square thumbnail (max 120px on the long side)
        instead of the old 3:4 image that filled the column — that's the
        "50% smaller" change. Image asset URLs are unchanged.
      */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6">
        {filteredArtists.map((artist) => {
          const primaryMovement = artist.movements[0];
          const dotColor = primaryMovement
            ? movementColorByKey[primaryMovement]
            : undefined;
          return (
            <button
              key={artist.id}
              type="button"
              onClick={() => setSelectedArtistId(artist.id)}
              className="group flex items-center gap-3 text-left p-2 rounded-lg hover:bg-accent/40 transition-colors"
            >
              <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 overflow-hidden rounded-full border bg-card">
                <ArtistImage
                  artist={artist as Artist}
                  coverOverride={sourcesData.byArtist[artist.id]?.galleryCover}
                  width={200}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {dotColor && (
                  <span
                    className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-background/80 shadow"
                    style={{ backgroundColor: dotColor }}
                    aria-label={primaryMovement}
                    title={primaryMovement}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-sm md:text-base font-medium leading-tight truncate group-hover:text-primary transition-colors">
                  {artist.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {artist.birthYear}–{artist.deathYear || "present"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
