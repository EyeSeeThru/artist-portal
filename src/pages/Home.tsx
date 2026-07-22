import { Link } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { fetchArtistSummary, WikipediaSummary } from "@/lib/wikipedia";
import artistsData from "@/data/artists.json";
import sourcesData from "@/data/sources.json";
import { ArtistImage } from "@/components/ArtistImage";
import { LayoutGrid, Clock, Layers, MapPin, Shuffle } from "lucide-react";
import { motion } from "framer-motion";
import { useArtistStore } from "@/hooks/use-artist";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [summary, setSummary] = useState<WikipediaSummary | null>(null);
  const { setSelectedArtistId, pushTrail, selectRandom } = useArtistStore();

  // Deterministic daily featured artist — only from artists with a real image
  const featuredArtist = useMemo(() => {
    const withImage = artistsData.filter(
      (a) =>
        a.commonsImage ||
        a.imageUrl ||
        sourcesData.byArtist[a.id]?.galleryCover,
    );
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86400000,
    );
    return withImage[dayOfYear % withImage.length];
  }, []);

  useEffect(() => {
    fetchArtistSummary(featuredArtist.wikiKey).then(setSummary);
  }, [featuredArtist]);

  function openFeatured() {
    pushTrail(featuredArtist);
    setSelectedArtistId(featuredArtist.id);
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20 w-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        
        <div className="lg:col-span-5 flex flex-col justify-center space-y-8">
          <div>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-tight font-medium mb-6">
              Black Visual Artists Archive
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Explore the lives, movements, and masterworks of Black American visual artists spanning two and a half centuries. A contemplative archive drawn from Wikipedia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/gallery" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
              <LayoutGrid className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
              <div>
                <h3 className="font-medium text-lg">Gallery</h3>
                <p className="text-sm text-muted-foreground">Browse all artists</p>
              </div>
            </Link>
            
            <Link href="/timeline" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
              <Clock className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
              <div>
                <h3 className="font-medium text-lg">Timeline</h3>
                <p className="text-sm text-muted-foreground">Chronological view</p>
              </div>
            </Link>

            <Link href="/movements" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
              <Layers className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
              <div>
                <h3 className="font-medium text-lg">Movements</h3>
                <p className="text-sm text-muted-foreground">By era and collective</p>
              </div>
            </Link>

            <Link href="/map" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
              <MapPin className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
              <div>
                <h3 className="font-medium text-lg">Map</h3>
                <p className="text-sm text-muted-foreground">Geographic origins</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
              Featured Today
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectRandom}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              data-testid="surprise-me"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Surprise me
            </Button>
          </div>
          <button
            type="button"
            onClick={openFeatured}
            className="text-left relative aspect-[4/5] md:aspect-square w-full rounded-2xl overflow-hidden border border-border/50 shadow-xl group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <ArtistImage
              artist={featuredArtist}
              coverOverride={sourcesData.byArtist[featuredArtist.id]?.galleryCover}
              width={1000}
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-12 text-white">
              <h2 className="font-serif text-4xl md:text-5xl font-medium mb-2">{featuredArtist.name}</h2>
              <p className="text-lg md:text-xl opacity-90 mb-4">{featuredArtist.birthYear}–{featuredArtist.deathYear || "present"}</p>
              {summary && (
                <p className="text-white/80 line-clamp-3 md:line-clamp-4 max-w-2xl text-sm md:text-base leading-relaxed">
                  {summary.extract}
                </p>
              )}
              <span className="mt-4 text-xs uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">
                Open artist →
              </span>
            </div>
          </button>
        </div>

      </div>
    </motion.div>
  );
}