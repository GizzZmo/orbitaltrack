import { create } from 'zustand';
import type { SatelliteTLE, SatelliteState, OrbitRegime, TimeState } from '@/types/satellite';

interface OrbitalStore {
  // Data
  satellites: SatelliteTLE[];
  visibleSatellites: number[];
  selectedSatelliteId: number | null;
  selectedSatellite: SatelliteState | null;

  // Filters
  searchQuery: string;
  activeCategories: Set<string>;
  orbitRegime: OrbitRegime;

  // Time
  time: TimeState;

  // Observer
  observerLocation: { lat: number; lon: number; alt: number } | null;

  // Actions
  setSatellites: (sats: SatelliteTLE[]) => void;
  setSelectedSatellite: (id: number | null, state?: SatelliteState) => void;
  setSearchQuery: (q: string) => void;
  toggleCategory: (cat: string) => void;
  setOrbitRegime: (regime: OrbitRegime) => void;
  setTime: (time: Partial<TimeState>) => void;
  setObserverLocation: (loc: { lat: number; lon: number; alt: number } | null) => void;
}

export const useOrbitalStore = create<OrbitalStore>((set) => ({
  satellites: [],
  visibleSatellites: [],
  selectedSatelliteId: null,
  selectedSatellite: null,
  searchQuery: '',
  activeCategories: new Set(['payload', 'starlink', 'stations', 'gnss', 'debris']),
  orbitRegime: 'ALL',
  time: {
    currentTime: new Date(),
    isPlaying: true,
    timeWarp: 1,
    isRealtime: true,
  },
  observerLocation: null,

  setSatellites: (satellites) => set({ satellites }),
  setSelectedSatellite: (id, state) =>
    set({ selectedSatelliteId: id, selectedSatellite: state || null }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleCategory: (cat) =>
    set((state) => {
      const next = new Set(state.activeCategories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return { activeCategories: next };
    }),
  setOrbitRegime: (orbitRegime) => set({ orbitRegime }),
  setTime: (partial) => set((state) => ({ time: { ...state.time, ...partial } })),
  setObserverLocation: (observerLocation) => set({ observerLocation }),
}));