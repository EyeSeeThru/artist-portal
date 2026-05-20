import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import { useArtistStore } from "@/hooks/use-artist";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
    // Force a resize calculation when mounted
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

export default function MapView() {
  const { setSelectedArtistId } = useArtistStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        <div className="space-y-2">
          {movementsData.map(m => (
            <div key={m.key} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: m.color }} />
              <span>{m.label}</span>
            </div>
          ))}
        </div>
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {artistsData.map(artist => {
          const movement = movementsData.find(m => m.key === artist.movements[0]);
          const color = movement?.color || "#000";
          const jitterLat = artist.lat + getJitter(artist.id + "lat");
          const jitterLng = artist.lng + getJitter(artist.id + "lng");

          return (
            <CircleMarker
              key={artist.id}
              center={[jitterLat, jitterLng]}
              pathOptions={{
                fillColor: color,
                color: "#fff",
                weight: 1,
                fillOpacity: 0.8,
                radius: 7
              }}
            >
              <Popup className="font-sans">
                <div className="p-1 space-y-2">
                  <h3 className="font-serif text-lg font-bold m-0">{artist.name}</h3>
                  <p className="text-xs text-muted-foreground m-0">{artist.city}, {artist.state}</p>
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
      </MapContainer>
    </motion.div>
  );
}