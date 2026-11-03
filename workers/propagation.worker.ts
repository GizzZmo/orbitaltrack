/**
 * propagation.worker.ts
 *
 * Holds satrec objects in memory.
 * On each tick (10-30 Hz), propagates all satellites with SGP4,
 * converts TEME/ECI -> ECEF, scales to Earth radius=1 for Three.js,
 * and posts a transferable Float32Array of positions.
 *
 * Coordinate notes:
 * - SGP4 returns position in TEME (True Equator Mean Equinox) frame ≈ ECI.
 * - satellite.js.eciToEcf(position, gmst) rotates into ECEF using Greenwich Mean Sidereal Time.
 * - Three.js convention (Y-up): 
 *     threeX = ecef.x / R
 *     threeY = ecef.z / R
 *     threeZ = -ecef.y / R
 *   (Z-up ECEF → Y-up Three.js with longitude orientation)
 */

import * as satellite from 'satellite.js';

const EARTH_RADIUS_KM = 6371;

interface WorkerSatellite {
  noradId: number;
  satrec: satellite.SatRec;
  category: string;
  name: string;
}

let satellites: WorkerSatellite[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;
const UPDATE_HZ = 15; // 15 Hz propagation

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    satellites = [];
    for (const sat of payload.satellites as any[]) {
      try {
        // Prefer reconstructed TLE lines; fallback to json if available
        let satrec: satellite.SatRec;
        if (sat.line1 && sat.line2) {
          satrec = satellite.twoline2satrec(sat.line1, sat.line2);
        } else {
          // Newer satellite.js supports json2satrec
          satrec = (satellite as any).json2satrec?.(sat.omm) || satellite.twoline2satrec('', '');
        }
        if (satrec && satrec.error === 0) {
          satellites.push({
            noradId: sat.noradId,
            satrec,
            category: sat.category,
            name: sat.name,
          });
        }
      } catch (err) {
        // Skip invalid TLE
      }
    }
    self.postMessage({ type: 'READY', count: satellites.length });
  }

  if (type === 'START') {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => propagate(payload?.time ?? Date.now()), 1000 / UPDATE_HZ);
  }

  if (type === 'STOP') {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  if (type === 'TICK') {
    propagate(payload.time);
  }
};

function propagate(timestamp: number) {
  if (satellites.length === 0) return;

  const date = new Date(timestamp);
  const gmst = satellite.gstime(date);

  // Flat array: [x0,y0,z0, x1,y1,z1, ...] in Three.js units (Earth radius = 1)
  const positions = new Float32Array(satellites.length * 3);
  const ids = new Int32Array(satellites.length);

  let writeIdx = 0;
  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    try {
      const pv = satellite.propagate(sat.satrec, date);
      if (!pv || !pv.position) continue;

      const eci = pv.position;
      const ecf = satellite.eciToEcf(eci, gmst);

      // Axis conversion TEME/ECI → ECEF → Three.js (Y-up)
      const scale = 1 / EARTH_RADIUS_KM;
      positions[writeIdx * 3 + 0] = ecf.x * scale;
      positions[writeIdx * 3 + 1] = ecf.z * scale;
      positions[writeIdx * 3 + 2] = -ecf.y * scale;

      ids[writeIdx] = sat.noradId;
      writeIdx++;
    } catch {
      // Propagation error (decayed, etc.) — skip
    }
  }

  // Trim to actual count
  const validCount = writeIdx;
  const trimmedPositions = positions.subarray(0, validCount * 3);
  const trimmedIds = ids.subarray(0, validCount);

  // Transfer ownership (zero-copy)
  self.postMessage(
    {
      type: 'POSITIONS',
      positions: trimmedPositions,
      ids: trimmedIds,
      count: validCount,
      timestamp,
    },
    [trimmedPositions.buffer, trimmedIds.buffer]
  );
}

// Optional: detailed telemetry for selected satellite
// Main thread can request full state for one sat by NORAD ID
self.onmessage = ((original) => {
  return (e: MessageEvent) => {
    if (e.data.type === 'GET_TELEMETRY') {
      const { noradId, time } = e.data.payload;
      const sat = satellites.find((s) => s.noradId === noradId);
      if (!sat) return;
      const date = new Date(time);
      const gmst = satellite.gstime(date);
      const pv = satellite.propagate(sat.satrec, date);
      if (!pv?.position || !pv.velocity) return;

      const eciPos = pv.position;
      const eciVel = pv.velocity;
      const ecf = satellite.eciToEcf(eciPos, gmst);
      const geo = satellite.eciToGeodetic(eciPos, gmst);

      const altitude = geo.height; // km
      const velocity = Math.sqrt(eciVel.x ** 2 + eciVel.y ** 2 + eciVel.z ** 2);

      self.postMessage({
        type: 'TELEMETRY',
        noradId,
        lat: satellite.radiansToDegrees(geo.latitude),
        lon: satellite.radiansToDegrees(geo.longitude),
        altitude,
        velocity,
        inclination: sat.satrec.inclo ? satellite.radiansToDegrees(sat.satrec.inclo) : undefined,
      });
      return;
    }
    original(e);
  };
})(self.onmessage as any);