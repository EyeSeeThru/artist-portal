import movementsData from "@/data/movements.json";
import artistsData from "@/data/artists.json";
import sourcesData from "@/data/sources.json";
import { ArtistImage } from "@/components/ArtistImage";
import { useArtistStore } from "@/hooks/use-artist";
import { motion } from "framer-motion";

export default function Movements() {
  const { setSelectedArtistId } = useArtistStore();

  const lastName = (n: string) =>
    n.replace(/\s*\([^)]*\)\s*$/, "").trim().split(/\s+/).slice(-1)[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16 w-full space-y-20"
    >
      <div className="mb-4">
        <h1 className="font-serif text-4xl md:text-5xl font-medium mb-4">Movements</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Explore the collectives, eras, and stylistic shifts that defined Black American visual art.
        </p>
      </div>

      <div className="space-y-24">
        {movementsData.map((movement) => {
          const movementArtists = artistsData
            .filter((a) => a.movements.includes(movement.key))
            .slice()
            .sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)));

          if (movementArtists.length === 0) return null;

          return (
            <section key={movement.key} id={movement.key} className="space-y-8 scroll-mt-24">
              {/* Header */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-12 relative">
                <div className="w-1.5 rounded-full shrink-0" style={{ backgroundColor: movement.color }} />
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="font-serif text-3xl md:text-4xl font-bold">{movement.label}</h2>
                    <p className="text-base font-medium opacity-70 mt-1" style={{ color: movement.color }}>
                      {movement.years} &middot; {movementArtists.length} {movementArtists.length === 1 ? "artist" : "artists"}
                    </p>
                  </div>
                  <p className="text-muted-foreground leading-relaxed max-w-3xl text-base">
                    {movement.description}
                  </p>
                </div>
              </div>

              {/* Full grid of artists in this movement, sorted by last name */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {movementArtists.map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => setSelectedArtistId(artist.id)}
                    className="group flex flex-col items-center gap-2 text-left"
                  >
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-transparent group-hover:border-primary/40 transition-colors shadow-sm">
                      <ArtistImage
                        artist={artist as any}
                        coverOverride={sourcesData.byArtist[artist.id]?.galleryCover}
                        width={200}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <span className="font-serif text-xs md:text-sm leading-tight text-center group-hover:text-primary transition-colors line-clamp-2 max-w-full">
                      {artist.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
}
