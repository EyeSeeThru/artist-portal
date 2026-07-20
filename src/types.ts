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
  year?: string;
  medium?: string;
  /** URL to the source page on the museum site */
  sourceUrl: string;
  /** Display name of the source, e.g. "Art Institute of Chicago" */
  source: string;
  /** Either a Wikimedia thumbUrl or a museum IIIF URL */
  thumbUrl: string;
  /** Higher-resolution full image URL */
  fullUrl: string;
  license: string;
  licenseUrl?: string;
  artist?: string;
  attribution?: string;
  width?: number;
  height?: number;
}

export interface SourceBundle {
  wikipediaImages: Artwork[];
  artworks: Artwork[];
  /** Picked gallery-cover image URL (a real artwork, not a portrait) */
  galleryCover?: string | null;
}

export interface SourcesData {
  generatedAt: string;
  totalArtists: number;
  totalWikimedia: number;
  totalArtworks: number;
  byArtist: Record<string, SourceBundle>;
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
