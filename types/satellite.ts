export interface SatelliteTLE {
  name: string;
  noradId: number;
  internationalDesignator: string;
  line1: string;
  line2: string;
  category: string; // 'payload' | 'debris' | 'rocket' | 'starlink' | 'stations' | 'gnss' etc.
  inclination?: number;
  period?: number;
  apogee?: number;
  perigee?: number;
}

export interface SatelliteState {
  id: number;
  name: string;
  category: string;
  position: [number, number, number]; // scaled for Three.js (Earth radius = 1)
  velocity?: number; // km/s
  altitude?: number; // km
  lat?: number;
  lon?: number;
  inclination?: number;
  period?: number;
}

export type OrbitRegime = 'LEO' | 'MEO' | 'GEO' | 'HEO' | 'ALL';

export interface TimeState {
  currentTime: Date;
  isPlaying: boolean;
  timeWarp: number; // -100 to 100
  isRealtime: boolean;
}