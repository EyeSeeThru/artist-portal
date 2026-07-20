export interface Artist {
  id: string;
  name: string;
  birthYear: number;
  deathYear: number | null;
  medium: string[];
  movements: string[];
  city: string;
  state: string;
  lat: number;
  lng: number;
  wikiKey: string;
  commonsImage: string | null;
  imageUrl?: string | null; // direct image URL override (used when sourced from a museum / Wikipedia thumbnail, not Commons file)
  imageSource?: string; // human-readable source name, e.g. "The Met Open Access"
  imageLicense?: string; // e.g. "CC0", "Public Domain"
  imageAttribution?: string; // e.g. "Image: The Metropolitan Museum of Art, Open Access"
  featuredWorks?: string[];
}

export interface Artwork {
  title: string;
  filename: string;
  thumbUrl: string;
  fullUrl: string;
  commonsUrl: string;
  width: number;
  height: number;
  license: string;
  licenseUrl?: string;
  artist?: string;
}

export interface Movement {
  key: string;
  label: string;
  years: string;
  yearStart: number;
  yearEnd: number;
  color: string;
  description: string;
}

export type ViewMode = "home" | "gallery" | "timeline" | "movement" | "map";
