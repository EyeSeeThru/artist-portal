import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import { useArtistStore } from "@/hooks/use-artist";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Deterministic jitter based on string hash
function getJitter(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const random = Math.abs(Math.sin(hash));
  return (random - 0.5) * 0.05; // ±0.025 degrees
}

function ThemeSync() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

export default function MapView() {
  const { setSelectedArtistId } = useArtistStore();
  const [mounted, setMounted] = useState(false);
  const [activeMovement, setActiveMovement] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Counts of geocoded artists per movement — for the filter chips
  const movementCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of artistsData) {
      if (typeof a.lat !== "number" || typeof a.lng !== "number") continue;
      for (const m of a.movements) counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, []);

  const visibleArtists = useMemo(() => {
    const geocoded = artistsData.filter(
      (a) => typeof a.lat === "number" && typeof a.lng === "number",
    );
    return activeMovement
      ? geocoded.filter((a) => a.movements.includes(activeMovement))
      : geocoded;
  }, [activeMovement]);

  if (!mounted) return <div className="h-full w-full bg-card animate-pulse" />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative w-full"
      style={{ height: "calc(100dvh - 4rem)" }}
    >
      <div className="absolute top-4 left-4 z-[400] bg-background/90 backdrop-blur border shadow-sm p-4 rounded-xl max-w-xs hidden md:block">
        <h1 className="font-serif text-2xl font-medium mb-2">Origins</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Birthplaces and significant locations of the artists.
        </p>
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Filter by movement
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={activeMovement === null ? "default" : "outline"}
              className="cursor-pointer font-normal"
              onClick={() => setActiveMovement(null)}
            >
              All ({Object.values(movementCounts).reduce((a, b) => a + b, 0)})
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
        </div>
        {visibleArtists.length === 0 && (
          <p className="text-xs text-muted-foreground italic mt-2">
            No artists with coordinates in this movement yet.
          </p>
        )}
      </div>

      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
        zoomControl={false}
      >
        <ThemeSync />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap.org</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {visibleArtists.map((artist) => {
            const movement = movementsData.find((m) => m.key === artist.movements[0]);
            const color = movement?.color || "#000";
            const jitterLat = (artist.lat as number) + getJitter(artist.id + "lat");
            const jitterLng = (artist.lng as number) + getJitter(artist.id + "lng");

            return (
              <CircleMarker
                key={artist.id}
                center={[jitterLat, jitterLng]}
                pathOptions={{
                  fillColor: color,
                  color: "#fff",
                  weight: 1,
                  fillOpacity: 0.8,
                  radius: 7,
                }}
              >
                <Popup className="font-sans">
                  <div className="p-1 space-y-2">
                    <h3 className="font-serif text-lg font-bold m-0">{artist.name}</h3>
                    <p className="text-xs text-muted-foreground m-0">
                      {artist.city ?? "Location unknown"}, {artist.state ?? ""}
                    </p>
                    {artist.movements[0] && (
                      <p className="text-xs m-0">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                          style={{ backgroundColor: color }}
                        />
                        <span className="opacity-80 align-middle">
                          {movementsData.find((m) => m.key === artist.movements[0])?.label}
                        </span>
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        setSelectedArtistId(artist.id);
                      }}
                    >
                      View profile
                    </Button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </motion.div>
  );
}
