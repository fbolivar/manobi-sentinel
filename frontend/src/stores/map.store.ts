import { create } from 'zustand';

interface MapState {
  focusParqueId: string | null;
  focusTs: number;
  focusOnParque: (parqueId: string) => void;
  clearFocus: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  focusParqueId: null,
  focusTs: 0,
  focusOnParque: (parqueId) => set({ focusParqueId: parqueId, focusTs: Date.now() }),
  clearFocus: () => set({ focusParqueId: null }),
}));
