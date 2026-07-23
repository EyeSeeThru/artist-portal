import { create } from "zustand";
import type { Artist } from "@/types";
import artistsData from "@/data/artists.json";
import { pickRelated, pickRandomWithImage } from "@/lib/related";

const MAX_TRAIL = 10;

interface TrailEntry {
  artist: Artist;
  visitedAt: number;
}

interface ArtistStore {
  selectedArtistId: string | null;
  setSelectedArtistId: (id: string | null) => void;

  // Trail / Wander / Surprise
  trail: TrailEntry[];
  jumpToTrailIndex: number | null;
  pushTrail: (artist: Artist) => void;
  wanderFromCurrent: () => void;
  clearTrail: () => void;
  jumpToTrailEntry: (index: number) => void;
  selectRandom: () => void;

  // Cross-view scroll targets
  timelineScrollYear: number | null;
  requestTimelineScroll: (year: number) => void;
  consumeTimelineScroll: () => number | null;
}

const TRAIL_STORAGE_KEY = "artcanon:trail:v1";

function loadTrail(): TrailEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRAIL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Trim to MAX_TRAIL, drop entries whose artist id no longer exists
    const validIds = new Set((artistsData as Artist[]).map((a) => a.id));
    return parsed
      .filter(
        (e) =>
          e &&
          typeof e.artist?.id === "string" &&
          validIds.has(e.artist.id) &&
          typeof e.visitedAt === "number",
      )
      .slice(-MAX_TRAIL);
  } catch {
    return [];
  }
}

function saveTrail(trail: TrailEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify(trail));
  } catch {
    // localStorage might be full or blocked; trail is a nice-to-have, not critical
  }
}

export const useArtistStore = create<ArtistStore>((set, get) => ({
  selectedArtistId: null,
  setSelectedArtistId: (id) => set({ selectedArtistId: id }),

  trail: loadTrail(),
  jumpToTrailIndex: null,

  pushTrail: (artist) => {
    const current = get().trail;
    // Don't duplicate the most recent entry
    if (current.length > 0 && current[current.length - 1].artist.id === artist.id) {
      return;
    }
    const next = [...current, { artist, visitedAt: Date.now() }].slice(-MAX_TRAIL);
    saveTrail(next);
    set({ trail: next });
  },

  wanderFromCurrent: () => {
    const { trail } = get();
    const current = trail.length > 0 ? trail[trail.length - 1].artist : null;
    if (!current) {
      // No current artist — just surprise
      get().selectRandom();
      return;
    }
    const next = pickRelated(current);
    if (next) {
      get().pushTrail(next);
      set({ selectedArtistId: next.id });
    }
  },

  clearTrail: () => {
    saveTrail([]);
    set({ trail: [] });
  },

  jumpToTrailEntry: (index) => {
    const { trail } = get();
    if (index < 0 || index >= trail.length) return;
    const entry = trail[index];
    // Truncate the trail at this entry so the user can wander forward from here
    const truncated = trail.slice(0, index + 1);
    saveTrail(truncated);
    set({ trail: truncated, selectedArtistId: entry.artist.id, jumpToTrailIndex: index });
  },

  selectRandom: () => {
    const { selectedArtistId } = get();
    const pick = pickRandomWithImage(selectedArtistId ?? undefined);
    if (!pick) return;
    get().pushTrail(pick);
    set({ selectedArtistId: pick.id });
  },

  // Cross-view scroll: set a target year that Timeline listens for and
  // consumes on mount / when changed.
  timelineScrollYear: null,
  requestTimelineScroll: (year) => set({ timelineScrollYear: year }),
  consumeTimelineScroll: () => {
    const y = get().timelineScrollYear;
    if (y === null) return null;
    set({ timelineScrollYear: null });
    return y;
  },
}));
