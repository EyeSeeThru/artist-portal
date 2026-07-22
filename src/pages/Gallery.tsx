import { useState } from "react";
import artistsData from "@/data/artists.json";
import sourcesData from "@/data/sources.json";
import { Artist } from "@/types";
import { ArtistImage } from "@/components/ArtistImage";
import { useArtistStore } from "@/hooks/use-artist";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function Gallery() {
  const { setSelectedArtistId } = useArtistStore();
  const [selectedMedium, setSelectedMedium] = useState<string | null>(null);

  const allMedia = Array.from(new Set(artistsData.flatMap(a => a.medium))).sort();
  const commonMedia = ["Painting", "Sculpture", "Photography", "Printmaking", "Installation", "Mixed Media"];
  
  const lastName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, "").trim().split(/\s+/).slice(-1)[0];
  const filteredArtists = (selectedMedium
    ? artistsData.filter(a => a.medium.includes(selectedMedium))
    : artistsData
  ).slice().sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)));

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-12 w-full"
    >
      <div className="mb-12">
        <h1 className="font-serif text-4xl font-medium mb-6">Gallery</h1>
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant={selectedMedium === null ? "default" : "outline"} 
            className="cursor-pointer text-sm py-1.5 px-4 font-normal"
            onClick={() => setSelectedMedium(null)}
          >
            All
          </Badge>
          {commonMedia.map(medium => (
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredArtists.map((artist) => (
          <div
            key={artist.id}
            onClick={() => setSelectedArtistId(artist.id)}
            className="group cursor-pointer relative"
          >
            <div className="overflow-hidden rounded-xl border bg-card mb-3 aspect-[3/4] relative">
              <ArtistImage
              artist={artist as Artist}
              coverOverride={sourcesData.byArtist[artist.id]?.galleryCover}
              width={600}
              className="w-full h-full transition-transform duration-700 group-hover:scale-105"
            />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-medium group-hover:text-primary transition-colors">{artist.name}</h3>
              <p className="text-sm text-muted-foreground mb-1">{artist.birthYear}–{artist.deathYear || "present"}</p>
              <p className="text-xs text-muted-foreground opacity-80">{artist.medium.slice(0, 2).join(", ")}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}