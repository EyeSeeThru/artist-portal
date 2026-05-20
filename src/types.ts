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
  featuredWorks?: string[];
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
