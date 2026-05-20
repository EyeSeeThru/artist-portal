import movementsData from "@/data/movements.json";
import artistsData from "@/data/artists.json";
import { ArtistImage } from "@/components/ArtistImage";
import { useArtistStore } from "@/hooks/use-artist";
import { motion } from "framer-motion";

export default function Movements() {
  const { setSelectedArtistId } = useArtistStore();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-12 w-full space-y-16"
    >
      <div className="mb-4">
        <h1 className="font-serif text-4xl font-medium mb-4">Movements</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Explore the collectives, eras, and stylistic shifts that defined Black American visual art.
        </p>
      </div>

      <div className="space-y-24">
        {movementsData.map((movement) => {
          const movementArtists = artistsData.filter(a => a.movements.includes(movement.key));
          
          if (movementArtists.length === 0) return null;

          return (
            <section key={movement.key} className="space-y-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-12 relative">
                <div className="w-1.5 rounded-full" style={{ backgroundColor: movement.color }} />
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="font-serif text-3xl font-bold">{movement.label}</h2>
                    <p className="text-lg font-medium opacity-70" style={{ color: movement.color }}>{movement.years}</p>
                  </div>
                  <p className="text-muted-foreground leading-relaxed max-w-3xl">
                    {movement.description}
                  </p>
                </div>
              </div>

              <div className="flex overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0 gap-4 hide-scrollbar snap-x">
                {movementArtists.map(artist => (
                  <button
                    key={artist.id}
                    onClick={() => setSelectedArtistId(artist.id)}
                    className="flex flex-col items-center gap-3 w-28 md:w-32 flex-shrink-0 group snap-start text-left"
                  >
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-transparent group-hover:border-primary/30 transition-colors shadow-sm">
                      <ArtistImage artist={artist as any} width={200} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <span className="font-serif text-sm leading-tight text-center group-hover:text-primary transition-colors">
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