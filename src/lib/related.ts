import type { Artist } from "@/types";
import artistsData from "@/data/artists.json";

/**
 * Deterministic "related artist" picker. Returns one artist weighted toward
 * shared metadata — no AI, no network calls. Falls back to a random artist
 * from the dataset if no good candidate exists.
 *
 * Strategy weights (out of 100):
 *   - same movement      : 40
 *   - same birth decade  : 30
 *   - same city          : 15
 *   - shared medium      : 10
 *   - random fallback    :  5
 */

const ALL_ARTISTS: Artist[] = artistsData as Artist[];

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

function overlap<T>(a: T[], b: T[]): number {
  const set = new Set(a);
  let n = 0;
  for (const x of b) if (set.has(x)) n++;
  return n;
}

export function pickRelated(
  current: Artist,
  opts: { seed?: number } = {},
): Artist | null {
  const candidates = ALL_ARTISTS.filter((a) => a.id !== current.id);
  if (candidates.length === 0) return null;

  const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000);
  // Simple deterministic PRNG so the trail is reproducible if needed
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const currentDecade = decadeOf(current.birthYear);

  const scored = candidates.map((a) => {
    let score = 0;
    if (overlap(current.movements, a.movements) > 0) score += 40;
    if (decadeOf(a.birthYear) === currentDecade) score += 30;
    if (a.city && a.city === current.city) score += 15;
    if (overlap(current.medium, a.medium) > 0) score += 10;
    score += rand() * 5; // jitter so the same seed isn't always the same pick
    return { artist: a, score };
  });

  scored.sort((x, y) => y.score - x.score);
  return scored[0]?.artist ?? null;
}

/**
 * Pick a random artist that has a viewable image (commonsImage OR imageUrl).
 * Optionally exclude one artist by id (e.g. the currently featured one).
 */
export function pickRandomWithImage(excludeId?: string): Artist | null {
  const pool = ALL_ARTISTS.filter(
    (a) => a.id !== excludeId && (a.commonsImage || a.imageUrl),
  );
  if (pool.length === 0) {
    // Fall back to any artist except the excluded one
    const fallback = ALL_ARTISTS.filter((a) => a.id !== excludeId);
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
