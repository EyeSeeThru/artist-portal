import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { Artist } from "@/types";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import { useArtistStore } from "@/hooks/use-artist";
import { fetchArtistSummary, fetchCommonsImageInfo, WikipediaSummary, CommonsImageInfo } from "@/lib/wikipedia";
import { ArtistImage } from "./ArtistImage";
import { FeaturedWorksStrip } from "./FeaturedWorksStrip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function ArtistDetailPanel() {
  const { selectedArtistId, setSelectedArtistId } = useArtistStore();
  const [summary, setSummary] = useState<WikipediaSummary | null>(null);
  const [imageInfo, setImageInfo] = useState<CommonsImageInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const artist = artistsData.find((a) => a.id === selectedArtistId) as Artist | undefined;

  useEffect(() => {
    if (!artist) return;
    
    let isMounted = true;
    setLoading(true);
    setSummary(null);
    setImageInfo(null);

    Promise.all([
      fetchArtistSummary(artist.wikiKey),
      artist.commonsImage ? fetchCommonsImageInfo(artist.commonsImage) : Promise.resolve(null)
    ]).then(([sum, img]) => {
      if (isMounted) {
        setSummary(sum);
        setImageInfo(img);
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

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={() => setSelectedArtistId(null)}
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[520px] bg-background shadow-2xl z-50 flex flex-col transform transition-transform duration-300 border-l">
        <div className="flex-1 overflow-y-auto">
          <div className="relative h-72 md:h-96 w-full">
            <ArtistImage artist={artist} width={800} className="absolute inset-0 w-full h-full" />
            <button 
              onClick={() => setSelectedArtistId(null)}
              className="absolute top-4 right-4 p-2 bg-background/80 backdrop-blur-md rounded-full text-foreground hover:bg-background transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 md:p-8 space-y-6">
            {artist.featuredWorks && artist.featuredWorks.length > 0 && (
              <FeaturedWorksStrip
                works={artist.featuredWorks}
                artistName={artist.name}
              />
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

        {artist.commonsImage && (
          <div className="p-4 border-t bg-muted/30 text-xs text-muted-foreground">
            <p>
              {loading ? (
                <Skeleton className="h-3 w-64" />
              ) : imageInfo ? (
                <>
                  Image: {imageInfo.artist || artist.name} · {imageInfo.licenseShortName || "Public Domain"} ·{" "}
                  <a href={imageInfo.descriptionUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    Wikimedia Commons
                  </a>
                </>
              ) : (
                "Image via Wikimedia Commons"
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );
}