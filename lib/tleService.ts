import type { SatelliteTLE } from '@/types/satellite';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const CACHE_KEY = 'orbitaltrack_tle_cache';

interface CacheEntry {
  timestamp: number;
  data: SatelliteTLE[];
}

/**
 * Fetch GP data from CelesTrak for a given group.
 * Prefer JSON format for modern 9-digit catalog support.
 */
export async function fetchCelesTrakGroup(group: string): Promise<any[]> {
  const url = `${CELESTRAK_BASE}?GROUP=${group.toUpperCase()}&FORMAT=JSON`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CelesTrak fetch failed for ${group}: ${res.status}`);
  }
  return res.json();
}

/**
 * Parse OMM JSON into our SatelliteTLE shape.
 * CelesTrak JSON follows CCSDS OMM.
 */
function parseOmmToTLE(omm: any, category: string): SatelliteTLE | null {
  try {
    const noradId = parseInt(omm.NORAD_CAT_ID || omm.OBJECT_NUMBER || '0', 10);
    if (!noradId) return null;

    // Reconstruct classic TLE lines if needed by satellite.js twoline2satrec
    // satellite.js also accepts json2satrec in newer versions
    const line1 = omm.TLE_LINE1 || '';
    const line2 = omm.TLE_LINE2 || '';

    return {
      name: omm.OBJECT_NAME || `SAT-${noradId}`,
      noradId,
      internationalDesignator: omm.OBJECT_ID || omm.INTLDES || '',
      line1,
      line2,
      category,
      inclination: parseFloat(omm.INCLINATION) || undefined,
      period: parseFloat(omm.PERIOD) || undefined,
      apogee: parseFloat(omm.APOAPSIS) || undefined,
      perigee: parseFloat(omm.PERIAPSIS) || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Load satellites with localStorage cache (TTL 2-6h).
 * For production, prefer IndexedDB or server-side Redis.
 */
export async function loadSatellites(groups: string[] = ['active', 'stations', 'starlink', 'gps-ops']): Promise<SatelliteTLE[]> {
  // Try cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS && entry.data.length > 0) {
        console.log('[TLE] Using cached data');
        return entry.data;
      }
    }
  } catch (e) {
    console.warn('[TLE] Cache read failed', e);
  }

  const all: SatelliteTLE[] = [];
  const categoryMap: Record<string, string> = {
    active: 'payload',
    stations: 'stations',
    starlink: 'starlink',
    'gps-ops': 'gnss',
    'glo-ops': 'gnss',
    galileo: 'gnss',
    beidou: 'gnss',
    weather: 'weather',
    debris: 'debris',
  };

  for (const group of groups) {
    try {
      console.log(`[TLE] Fetching group: ${group}`);
      const data = await fetchCelesTrakGroup(group);
      const cat = categoryMap[group] || 'payload';
      for (const omm of data) {
        const sat = parseOmmToTLE(omm, cat);
        if (sat) all.push(sat);
      }
      // Rate-limit friendly delay
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[TLE] Failed group ${group}`, err);
    }
  }

  // Deduplicate by NORAD ID
  const unique = Array.from(new Map(all.map((s) => [s.noradId, s])).values());

  // Cache
  try {
    const entry: CacheEntry = { timestamp: Date.now(), data: unique };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (e) {
    console.warn('[TLE] Cache write failed', e);
  }

  console.log(`[TLE] Loaded ${unique.length} satellites`);
  return unique;
}

/**
 * Classify orbit regime from mean motion / altitude approx.
 */
export function getOrbitRegime(periodMinutes?: number, altitudeKm?: number): string {
  if (!periodMinutes && !altitudeKm) return 'UNKNOWN';
  const alt = altitudeKm ?? (periodMinutes ? Math.pow((periodMinutes / 84.4), 2 / 3) * 6371 - 6371 : 0);
  if (alt < 2000) return 'LEO';
  if (alt < 35786) return 'MEO';
  if (Math.abs(alt - 35786) < 2000) return 'GEO';
  return 'HEO';
}