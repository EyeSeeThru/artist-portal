import { create } from "zustand";

interface ArtistStore {
  selectedArtistId: string | null;
  setSelectedArtistId: (id: string | null) => void;
}

export const useArtistStore = create<ArtistStore>((set) => ({
  selectedArtistId: null,
  setSelectedArtistId: (id) => set({ selectedArtistId: id }),
}));