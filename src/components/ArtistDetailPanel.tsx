import { useEffect, useState } from "react";
import { X, ExternalLink, Compass, Clock, Layers } from "lucide-react";
import { Link } from "wouter";
import { Artist, SourceBundle } from "@/types";
import artistsData from "@/data/artists.json";
import sourcesData from "@/data/sources.json";
import movementsData from "@/data/movements.json";
import { useArtistStore } from "@/hooks/use-artist";
import { fetchArtistSummary, WikipediaSummary } from "@/lib/wikipedia";
import { ArtistImage } from "./ArtistImage";
import { ArtworksStrip, ArtworksEmpty } from "./ArtworksStrip";
import { WikipediaImagesStrip } from "./WikipediaImagesStrip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ArtistDetailPanel() {
  const {
    selectedArtistId,
    setSelectedArtistId,
    trail,
    wanderFromCurrent,
    clearTrail,
    jumpToTrailEntry,
    requestTimelineScroll,
  } = useArtistStore();
  const [summary, setSummary] = useState<WikipediaSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const artist = artistsData.find((a) => a.id === selectedArtistId) as Artist | undefined;
  const trailIndex = trail.length > 0
    ? trail.findIndex((e) => e.artist.id === selectedArtistId)
    : -1;
  const bundle: SourceBundle = selectedArtistId
    ? sourcesData.byArtist[selectedArtistId] ?? { wikipediaImages: [], artworks: [] }
    : { wikipediaImages: [], artworks: [] };

  useEffect(() => {
    if (!artist) return;

    let isMounted = true;
    setLoading(true);
    setSummary(null);

    fetchArtistSummary(artist.wikiKey).then((sum) => {
      if (isMounted) {
        setSummary(sum);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [artist]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedArtistId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedArtistId]);

  if (!artist) return null;

  // Wikipedia images first, then museum-API artworks. Show first 3 of each.
  // Prepend the lead portrait (Wikipedia's picked pageImage) so it appears
  // first in the "From Wikipedia" strip when available.
  const wikipediaAll = bundle.wikipediaPortrait
    ? [bundle.wikipediaPortrait, ...bundle.wikipediaImages]
    : bundle.wikipediaImages;
  const wikipediaImages = wikipediaAll.slice(0, 4);
  const artworks = bundle.artworks.slice(0, 3);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={() => setSelectedArtistId(null)}
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[520px] bg-background shadow-2xl z-50 flex flex-col transform transition-transform duration-300 border-l">
        {/* Trail / breadcrumbs bar — shown only when there's history */}
        {trail.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-xs overflow-x-auto">
            <span className="text-muted-foreground shrink-0">Trail:</span>
            {trail.map((entry, i) => {
              const isCurrent = i === trailIndex;
              const isPast = i < trailIndex;
              return (
                <button
                  key={`${entry.artist.id}-${i}`}
                  onClick={() => jumpToTrailEntry(i)}
                  className={`shrink-0 px-2 py-1 rounded transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground font-medium"
                      : isPast
                      ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                      : "text-foreground hover:bg-muted"
                  }`}
                  title={`Jump to ${entry.artist.name}`}
                >
                  {entry.artist.name}
                </button>
              );
            })}
            <button
              onClick={clearTrail}
              className="shrink-0 ml-auto text-muted-foreground hover:text-foreground transition-colors"
              title="Clear trail"
            >
              clear
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="relative h-72 md:h-96 w-full">
            <ArtistImage
              artist={artist}
              coverOverride={bundle.galleryCover}
              width={800}
              className="absolute inset-0 w-full h-full"
            />
            <button
              onClick={() => setSelectedArtistId(null)}
              className="absolute top-4 right-4 p-2 bg-background/80 backdrop-blur-md rounded-full text-foreground hover:bg-background transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            <Button
              variant="outline"
              onClick={wanderFromCurrent}
              className="w-full gap-2"
              data-testid="wander-button"
            >
              <Compass className="w-4 h-4" />
              Wander to a related artist
            </Button>

            {/* Cross-view shortcuts — only when we have the data */}
            {(typeof artist.birthYear === "number" || artist.movements.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {typeof artist.birthYear === "number" && (
                  <Link
                    href="/timeline"
                    onClick={() => {
                      requestTimelineScroll(artist.birthYear!);
                      setSelectedArtistId(null);
                    }}
                  >
                    <Button variant="secondary" size="sm" className="gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      View on Timeline
                    </Button>
                  </Link>
                )}
                {artist.movements[0] && (() => {
                  const primaryMovement = movementsData.find(m => m.key === artist.movements[0]);
                  const label = primaryMovement?.label ?? artist.movements[0].replace(/-/g, " ");
                  return (
                    <Link
                      href={`/movements#${artist.movements[0]}`}
                      onClick={() => setSelectedArtistId(null)}
                    >
                      <Button variant="secondary" size="sm" className="gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        Other {label} artists
                      </Button>
                    </Link>
                  );
                })()}
              </div>
            )}

            {/* Wikipedia article images — vetted by Wikipedia editors */}
            {wikipediaImages.length > 0 && (
              <WikipediaImagesStrip
                images={wikipediaImages}
                artistName={artist.name}
              />
            )}

            {/* Museum-API artworks */}
            {artworks.length > 0 ? (
              <ArtworksStrip artworks={artworks} artistName={artist.name} />
            ) : (
              <ArtworksEmpty artistName={artist.name} />
            )}

            <div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-2">{artist.name}</h2>
              <p className="text-muted-foreground text-lg">
                {artist.birthYear}–{artist.deathYear || "present"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {artist.medium.map(m => (
                <Badge variant="secondary" key={m} className="font-normal text-sm px-3 py-1 bg-secondary/50">
                  {m}
                </Badge>
              ))}
              {artist.movements.map(mKey => {
                const mov = movementsData.find(m => m.key === mKey);
                if (!mov) return null;
                return (
                  <Badge key={mKey} className="font-normal text-sm px-3 py-1 text-white border-none" style={{ backgroundColor: mov.color }}>
                    {mov.label}
                  </Badge>
                );
              })}
            </div>

            <div className="prose prose-stone dark:prose-invert">
              {loading ? (
                <div className="space-y-3 mt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[90%]" />
                  <Skeleton className="h-4 w-[95%]" />
                  <Skeleton className="h-4 w-[80%]" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[85%]" />
                </div>
              ) : summary ? (
                <p className="leading-relaxed text-foreground/90">{summary.extract}</p>
              ) : (
                <p className="italic text-muted-foreground">No Wikipedia summary available.</p>
              )}
            </div>

            {summary && (
              <a
                href={summary.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium hover:text-primary/80 transition-colors gap-1.5"
              >
                Read full article on Wikipedia <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}