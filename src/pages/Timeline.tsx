import { useMemo } from "react";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import { useArtistStore } from "@/hooks/use-artist";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Timeline() {
  const { setSelectedArtistId } = useArtistStore();
  const START_YEAR = 1750;
  const END_YEAR = 2030;
  const TOTAL_YEARS = END_YEAR - START_YEAR;

  // Desktop horizontal mapping
  const getLeft = (year: number) => `${((year - START_YEAR) / TOTAL_YEARS) * 100}%`;
  const getWidth = (start: number, end: number) => `${((end - start) / TOTAL_YEARS) * 100}%`;

  // Mobile vertical mapping
  const getTop = (year: number) => `${((year - START_YEAR) / TOTAL_YEARS) * 100}%`;
  const getHeight = (start: number, end: number) => `${((end - start) / TOTAL_YEARS) * 100}%`;

  // Sort artists by birth year
  const sortedArtists = useMemo(() => {
    return [...artistsData].sort((a, b) => a.birthYear - b.birthYear);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col flex-1 h-[calc(100vh-4rem)] overflow-hidden bg-card/30"
    >
      <div className="px-4 md:px-8 py-8 flex-shrink-0">
        <h1 className="font-serif text-4xl font-medium mb-2">Timeline</h1>
        <p className="text-muted-foreground">A chronological view of artists and movements.</p>
      </div>

      <div className="flex-1 relative overflow-auto hide-scrollbar cursor-grab active:cursor-grabbing p-4 md:p-8">
        
        {/* Desktop View */}
        <div className="hidden md:block relative w-[3000px] h-full min-h-[500px]">
          {/* Decades grid */}
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
            {Array.from({ length: Math.ceil(TOTAL_YEARS / 10) + 1 }).map((_, i) => {
              const year = START_YEAR + i * 10;
              return (
                <div 
                  key={year} 
                  className="absolute top-0 bottom-0 border-l border-border/40 flex flex-col"
                  style={{ left: getLeft(year) }}
                >
                  <span className="text-[10px] text-muted-foreground/60 -ml-3 bg-background px-1 z-10">{year}</span>
                </div>
              );
            })}
          </div>

          {/* Movement Bands */}
          <div className="absolute top-12 bottom-32 left-0 right-0 flex flex-col gap-2 opacity-30 pointer-events-none">
            {movementsData.map(movement => (
              <div 
                key={movement.key} 
                className="relative h-12 rounded-full"
                style={{ 
                  left: getLeft(movement.yearStart), 
                  width: getWidth(movement.yearStart, movement.yearEnd),
                  backgroundColor: movement.color
                }}
              >
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-serif text-white font-medium whitespace-nowrap drop-shadow-md">
                  {movement.label}
                </span>
              </div>
            ))}
          </div>

          {/* Artist Dots */}
          <div className="absolute inset-0 pointer-events-none">
            {sortedArtists.map((artist, i) => {
              const mData = movementsData.find(m => m.key === artist.movements[0]);
              const color = mData?.color || "var(--primary)";
              // Stagger heights to prevent perfect overlaps
              const topOffset = 20 + ((i * 13) % 60);

              return (
                <Tooltip key={artist.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedArtistId(artist.id)}
                      className="absolute w-4 h-4 rounded-full border-2 border-background shadow-sm hover:scale-150 transition-transform pointer-events-auto z-20"
                      style={{ 
                        left: getLeft(artist.birthYear), 
                        top: `${topOffset}%`,
                        backgroundColor: color 
                      }}
                    >
                      <span className="sr-only">{artist.name}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-serif text-sm">
                    {artist.name} ({artist.birthYear}–{artist.deathYear || "present"})
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden relative h-[2000px] w-full ml-4">
          {/* Decades grid */}
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
            {Array.from({ length: Math.ceil(TOTAL_YEARS / 20) + 1 }).map((_, i) => {
              const year = START_YEAR + i * 20;
              return (
                <div 
                  key={year} 
                  className="absolute left-0 right-0 border-t border-border/40"
                  style={{ top: getTop(year) }}
                >
                  <span className="absolute -top-3 right-0 text-[10px] text-muted-foreground/60 bg-background px-1 z-10">{year}</span>
                </div>
              );
            })}
          </div>

          {/* Movement Bands */}
          <div className="absolute top-0 bottom-0 left-8 w-8 opacity-30 pointer-events-none">
            {movementsData.map(movement => (
              <div 
                key={movement.key} 
                className="absolute w-full rounded-full"
                style={{ 
                  top: getTop(movement.yearStart), 
                  height: getHeight(movement.yearStart, movement.yearEnd),
                  backgroundColor: movement.color
                }}
              />
            ))}
          </div>

          {/* Artist Dots */}
          <div className="absolute inset-0 pointer-events-none">
            {sortedArtists.map((artist, i) => {
              const mData = movementsData.find(m => m.key === artist.movements[0]);
              const color = mData?.color || "var(--primary)";
              const leftOffset = 20 + ((i * 15) % 60);

              return (
                <button
                  key={artist.id}
                  onClick={() => setSelectedArtistId(artist.id)}
                  className="absolute w-4 h-4 rounded-full border-2 border-background shadow-sm hover:scale-150 transition-transform pointer-events-auto z-20 group"
                  style={{ 
                    top: getTop(artist.birthYear), 
                    left: `${leftOffset}%`,
                    backgroundColor: color 
                  }}
                >
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs bg-background/90 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    {artist.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </motion.div>
  );
}