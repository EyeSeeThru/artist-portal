import { useMemo, useState, useEffect, useRef } from "react";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import { useArtistStore } from "@/hooks/use-artist";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Timeline() {
  const { setSelectedArtistId, consumeTimelineScroll } = useArtistStore();
  const START_YEAR = 1750;
  const END_YEAR = 2030;
  const BASE_TOTAL_YEARS = END_YEAR - START_YEAR;

  // Filter state — null = all, otherwise a movement key
  const [activeMovement, setActiveMovement] = useState<string | null>(null);

  // Zoom: how many "screen widths" the timeline spans. 1x = 3000px baseline.
  const [zoom, setZoom] = useState(1);
  const canvasWidth = 3000 * zoom;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getLeft = (year: number, total: number = BASE_TOTAL_YEARS) =>
    `${((year - START_YEAR) / total) * 100}%`;
  const getWidth = (start: number, end: number, total: number = BASE_TOTAL_YEARS) =>
    `${((end - start) / total) * 100}%`;

  // Sort artists by birth year, filtered by active movement if set.
  // Artists with null birthYear (4 cases) are excluded — they can't be
  // positioned on the timeline.
  const sortedArtists = useMemo(() => {
    const filtered = activeMovement
      ? artistsData.filter((a) => a.movements.includes(activeMovement))
      : artistsData;
    return [...filtered]
      .filter((a) => typeof a.birthYear === "number")
      .sort((a, b) => a.birthYear! - b.birthYear!);
  }, [activeMovement]);

  // Per-movement counts for the chip badges
  const movementCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of artistsData) {
      for (const m of a.movements) counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, []);

  // Consume any pending cross-view scroll request (e.g. ArtistDetailPanel
  // → "View on Timeline" sent a birth year here).
  useEffect(() => {
    const year = consumeTimelineScroll();
    if (year === null) return;
    // Wait one frame for layout to settle, then scroll the container so
    // the target year lands roughly in the middle of the visible area.
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const fraction = (year - START_YEAR) / BASE_TOTAL_YEARS;
      const target = container.scrollLeft + fraction * canvasWidth - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    });
  }, [consumeTimelineScroll, canvasWidth]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col flex-1 h-[calc(100vh-4rem)] overflow-hidden bg-card/30"
    >
      <div className="px-4 md:px-8 py-6 flex-shrink-0 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl font-medium mb-2">Timeline</h1>
          <p className="text-muted-foreground">A chronological view of artists and movements.</p>
        </div>

        {/* Movement filter chips */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Filter:</span>
          <Badge
            variant={activeMovement === null ? "default" : "outline"}
            className="cursor-pointer font-normal"
            onClick={() => setActiveMovement(null)}
          >
            All ({artistsData.length})
          </Badge>
          {movementsData.map((m) => (
            <Badge
              key={m.key}
              variant={activeMovement === m.key ? "default" : "outline"}
              className="cursor-pointer font-normal gap-1.5"
              style={
                activeMovement === m.key
                  ? { backgroundColor: m.color, color: "white", borderColor: m.color }
                  : undefined
              }
              onClick={() => setActiveMovement(activeMovement === m.key ? null : m.key)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: m.color }}
              />
              {m.label} ({movementCounts[m.key] ?? 0})
            </Badge>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            disabled={zoom <= 0.5}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(1)}
            title="Reset zoom"
            className="font-mono text-xs px-2 min-w-[3.5rem]"
          >
            {zoom.toFixed(2)}x
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
            disabled={zoom >= 4}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 relative overflow-auto hide-scrollbar cursor-grab active:cursor-grabbing p-4 md:p-8">
        {/* Desktop View */}
        <div
          className="hidden md:block relative h-full min-h-[500px]"
          style={{ width: `${canvasWidth}px` }}
        >
          {/* Decades grid — light vertical lines, no labels */}
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
            {Array.from({ length: Math.ceil(BASE_TOTAL_YEARS / 10) + 1 }).map((_, i) => {
              const year = START_YEAR + i * 10;
              return (
                <div
                  key={year}
                  className="absolute top-0 bottom-0 border-l border-border/30"
                  style={{ left: getLeft(year) }}
                />
              );
            })}
          </div>

          {/* Quarter-century major ticks with labels */}
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
            {Array.from({ length: Math.ceil(BASE_TOTAL_YEARS / 25) + 1 }).map((_, i) => {
              const year = START_YEAR + i * 25;
              return (
                <div
                  key={year}
                  className="absolute top-0 bottom-0 border-l border-border/70 flex flex-col"
                  style={{ left: getLeft(year) }}
                >
                  <span className="text-xs font-medium text-foreground/80 -ml-3 mt-1 bg-background px-1 z-10">
                    {year}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Movement Bands — clickable to filter */}
          <div className="absolute top-12 bottom-32 left-0 right-0 flex flex-col gap-2">
            {movementsData.map((movement) => {
              const isActive = activeMovement === movement.key;
              const isDimmed = activeMovement !== null && !isActive;
              return (
                <button
                  key={movement.key}
                  type="button"
                  onClick={() =>
                    setActiveMovement(activeMovement === movement.key ? null : movement.key)
                  }
                  className={`relative h-12 rounded-full transition-opacity cursor-pointer text-left ${
                    isDimmed ? "opacity-20" : isActive ? "opacity-100 ring-2 ring-foreground/30 ring-offset-2 ring-offset-card" : "opacity-50 hover:opacity-80"
                  }`}
                  style={{
                    left: getLeft(movement.yearStart),
                    width: getWidth(movement.yearStart, movement.yearEnd),
                    backgroundColor: movement.color,
                  }}
                  title={`Filter to ${movement.label}`}
                >
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-serif text-white font-medium whitespace-nowrap drop-shadow-md">
                    {movement.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Artist Dots */}
          <div className="absolute inset-0 pointer-events-none">
            {sortedArtists.map((artist, i) => {
              if (typeof artist.birthYear !== "number") return null;
              const mData = movementsData.find((m) => m.key === artist.movements[0]);
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
                        backgroundColor: color,
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

          {sortedArtists.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              No artists in this movement.
            </div>
          )}
        </div>

        {/* Mobile View */}
        <div className="block md:hidden relative h-[2000px] w-full ml-4">
          {/* Decades grid */}
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
            {Array.from({ length: Math.ceil(BASE_TOTAL_YEARS / 20) + 1 }).map((_, i) => {
              const year = START_YEAR + i * 20;
              return (
                <div
                  key={year}
                  className="absolute left-0 right-0 border-t border-border/40"
                  style={{ top: getLeft(year) }}
                >
                  <span className="absolute -top-3 right-0 text-[10px] text-muted-foreground/60 bg-background px-1 z-10">{year}</span>
                </div>
              );
            })}
          </div>

          {/* Movement Bands — clickable on mobile too */}
          <div className="absolute top-0 bottom-0 left-8 w-8">
            {movementsData.map((movement) => {
              const isActive = activeMovement === movement.key;
              const isDimmed = activeMovement !== null && !isActive;
              return (
                <button
                  key={movement.key}
                  type="button"
                  onClick={() =>
                    setActiveMovement(activeMovement === movement.key ? null : movement.key)
                  }
                  className={`absolute w-full rounded-full transition-opacity cursor-pointer ${
                    isDimmed ? "opacity-20" : isActive ? "opacity-100 ring-2 ring-foreground/40" : "opacity-50 hover:opacity-80"
                  }`}
                  style={{
                    top: getLeft(movement.yearStart),
                    height: getWidth(movement.yearStart, movement.yearEnd),
                    backgroundColor: movement.color,
                  }}
                  title={`Filter to ${movement.label}`}
                  aria-label={`Filter to ${movement.label}`}
                />
              );
            })}
          </div>

          {/* Artist Dots */}
          <div className="absolute inset-0 pointer-events-none">
            {sortedArtists.map((artist, i) => {
              if (typeof artist.birthYear !== "number") return null;
              const mData = movementsData.find((m) => m.key === artist.movements[0]);
              const color = mData?.color || "var(--primary)";
              const leftOffset = 20 + ((i * 15) % 60);

              return (
                <button
                  key={artist.id}
                  onClick={() => setSelectedArtistId(artist.id)}
                  className="absolute w-4 h-4 rounded-full border-2 border-background shadow-sm hover:scale-150 transition-transform pointer-events-auto z-20 group"
                  style={{
                    top: getLeft(artist.birthYear),
                    left: `${leftOffset}%`,
                    backgroundColor: color,
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
