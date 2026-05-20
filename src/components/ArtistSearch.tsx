import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import artistsData from "@/data/artists.json";
import movementsData from "@/data/movements.json";
import { Artist } from "@/types";
import { useArtistStore } from "@/hooks/use-artist";
import { Kbd } from "@/components/ui/kbd";
import { Badge } from "@/components/ui/badge";

interface SearchMatch {
  artist: Artist;
  matchedField: "name" | "medium" | "movement" | "city";
  matchedValue: string;
}

const MAX_RESULTS = 12;

function scoreMatch(query: string, artist: Artist): SearchMatch | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  if (artist.name.toLowerCase().includes(q)) {
    return { artist, matchedField: "name", matchedValue: artist.name };
  }

  const medium = artist.medium.find((m) => m.toLowerCase().includes(q));
  if (medium) {
    return { artist, matchedField: "medium", matchedValue: medium };
  }

  const movementKey = artist.movements.find((mKey) => {
    const mov = movementsData.find((m) => m.key === mKey);
    return mov && mov.label.toLowerCase().includes(q);
  });
  if (movementKey) {
    const mov = movementsData.find((m) => m.key === movementKey);
    return { artist, matchedField: "movement", matchedValue: mov?.label || movementKey };
  }

  if (artist.city.toLowerCase().includes(q)) {
    return { artist, matchedField: "city", matchedValue: `${artist.city}, ${artist.state}` };
  }

  return null;
}

function nameStartsWith(query: string, artist: Artist): boolean {
  return artist.name.toLowerCase().startsWith(query.toLowerCase().trim());
}

export function ArtistSearch({
  variant = "desktop",
  onResultSelect,
}: {
  variant?: "desktop" | "mobile";
  onResultSelect?: () => void;
}) {
  const { setSelectedArtistId } = useArtistStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo<SearchMatch[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const matches: SearchMatch[] = [];
    for (const artist of artistsData as Artist[]) {
      const m = scoreMatch(q, artist);
      if (m) matches.push(m);
    }
    matches.sort((a, b) => {
      const aStarts = nameStartsWith(q, a.artist) ? 0 : 1;
      const bStarts = nameStartsWith(q, b.artist) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      const fieldOrder = { name: 0, movement: 1, medium: 2, city: 3 } as const;
      if (fieldOrder[a.matchedField] !== fieldOrder[b.matchedField]) {
        return fieldOrder[a.matchedField] - fieldOrder[b.matchedField];
      }
      return a.artist.name.localeCompare(b.artist.name);
    });
    return matches.slice(0, MAX_RESULTS);
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (target as HTMLElement | null)?.isContentEditable;
        if (isEditable) return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectResult = (match: SearchMatch) => {
    setSelectedArtistId(match.artist.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onResultSelect?.();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (results[activeIndex]) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  const showOverlay = open && query.trim().length > 0;

  const wrapperWidth =
    variant === "desktop"
      ? "w-full max-w-xs lg:max-w-sm"
      : "w-full";

  return (
    <div ref={containerRef} className={`relative ${wrapperWidth}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search artists, mediums, movements"
          aria-label="Search artists"
          aria-expanded={showOverlay}
          aria-controls="artist-search-results"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          className="w-full h-9 rounded-md border border-input bg-background/60 pl-9 pr-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background transition-colors"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : variant === "desktop" ? (
          <Kbd className="absolute right-2 top-1/2 -translate-y-1/2 border border-border/60">
            /
          </Kbd>
        ) : null}
      </div>

      {showOverlay && (
        <div
          id="artist-search-results"
          role="listbox"
          className="absolute left-0 right-0 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-2xl z-50"
        >
          {results.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No artists match "<span className="text-foreground">{query}</span>".
            </div>
          ) : (
            <ul className="py-2">
              {results.map((match, i) => {
                const a = match.artist;
                const primaryMovement = a.movements[0]
                  ? movementsData.find((m) => m.key === a.movements[0])
                  : null;
                const isActive = i === activeIndex;
                return (
                  <li key={a.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => selectResult(match)}
                      className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif text-base font-medium truncate">
                            {a.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {a.birthYear}–{a.deathYear || "present"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          {primaryMovement && (
                            <Badge
                              className="font-normal text-[10px] px-1.5 py-0 text-white border-none leading-4"
                              style={{ backgroundColor: primaryMovement.color }}
                            >
                              {primaryMovement.label}
                            </Badge>
                          )}
                          <span className="truncate">
                            {a.medium.slice(0, 2).join(", ")} · {a.city}, {a.state}
                          </span>
                        </div>
                        {match.matchedField !== "name" && (
                          <div className="mt-1 text-[11px] text-muted-foreground/80">
                            Matched {match.matchedField}:{" "}
                            <span className="text-foreground/80">{match.matchedValue}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
            <span>
              {results.length > 0
                ? `${results.length} result${results.length === 1 ? "" : "s"}`
                : ""}
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>navigate</span>
              <Kbd className="ml-2">↵</Kbd>
              <span>open</span>
              <Kbd className="ml-2">esc</Kbd>
              <span>close</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
