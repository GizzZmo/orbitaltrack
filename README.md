# OrbitalTrack

**Real-time 3D satellite tracking web application.**

Visualizes 10,000+ active satellites orbiting Earth using SGP4 propagation, GPU instancing, and a Web Worker architecture.

## Screenshots

### Main Globe View
![OrbitalTrack Main View](assets/main-view.jpg)

Full-screen 3D Earth with color-coded satellite points, HUD controls, and real-time tracking.

### Telemetry Panel
![Telemetry HUD](assets/telemetry-panel.jpg)

Live satellite telemetry (NORAD ID, altitude, velocity, lat/lon, inclination, period).

### Orbital Path Visualization
![Orbit Path](assets/orbit-path.jpg)

Selected satellite with orbital path and ground track overlay.

## System Architecture

```mermaid
flowchart LR
    A[CelesTrak GP API<br/>JSON / TLE] -->|HTTP + 2-6h TTL| B[tleService.ts<br/>localStorage / IndexedDB cache]
    B --> C[Main Thread<br/>Zustand store]
    C -->|postMessage INIT<br/>TLE array| D[propagation.worker.ts<br/>satrec objects + SGP4 loop 15Hz]
    D -->|Transferable Float32Array<br/>[x,y,z] positions| E[GlobeScene.tsx<br/>THREE.InstancedMesh]
    E --> F[GPU Instanced Rendering<br/>60 FPS]
    C --> G[TelemetryHUD.tsx<br/>Search / Filters / Time Warp]
    G --> C
    H[Browser Geolocation] -.->|optional| I[Pass Predictor]
```

### Data Flow

1. **Ingestion** — `tleService.ts` fetches groups (`active`, `starlink`, `stations`, `gps-ops`, etc.) from `https://celestrak.org/NORAD/elements/gp.php?GROUP=...&FORMAT=JSON`. Results are cached client-side for 4 hours.
2. **Propagation** — Web Worker holds `satellite.js` `SatRec` objects. On each tick it runs SGP4, converts TEME → ECEF (via GMST), applies axis transform for Three.js (Y-up), and transfers a `Float32Array` of positions.
3. **Rendering** — `InstancedMesh` updates instance matrices from the buffer (zero-copy). Color-coded by category.
4. **Interaction** — Zustand drives search, category toggles, time-warp, and selected satellite telemetry.

## Coordinate System Notes

| Stage              | Frame          | Notes |
|--------------------|----------------|-------|
| SGP4 output        | TEME (ECI)     | Position in km |
| `eciToEcf`         | ECEF           | Uses `gstime()` |
| Three.js scene     | Y-up           | `x = ecef.x / R`, `y = ecef.z / R`, `z = -ecef.y / R` |
| Earth radius       | 1.0 (scene)    | Real radius ≈ 6371 km |

## Project Structure

```
orbitaltrack/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── assets/                     # Screenshots and visual assets
├── components/
│   ├── GlobeScene.tsx          # R3F Canvas + Earth + InstancedMesh
│   └── TelemetryHUD.tsx        # Search, filters, time controls, telemetry panel
├── lib/
│   ├── tleService.ts           # CelesTrak fetch + cache + parsing
│   └── store.ts                # Zustand store
├── workers/
│   └── propagation.worker.ts   # SGP4 Web Worker + transferable buffers
├── types/
│   └── satellite.ts
├── public/textures/            # Place Earth day/night/bump maps here
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## Setup & Run

```bash
cd orbitaltrack
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Recommended Earth Textures (optional local)

Download and place in `public/textures/`:

- Day: [Blue Marble](https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg)
- Night: [Earth at Night](https://unpkg.com/three-globe/example/img/earth-night.jpg)
- Bump / Specular as needed

The starter uses CDN URLs for immediate preview.

## Core Implementation Highlights

- **tleService.ts** — Fetches multiple CelesTrak groups, deduplicates by NORAD ID, 4-hour localStorage TTL.
- **propagation.worker.ts** — Maintains satrec array, 15 Hz propagation loop, zero-copy `Float32Array` transfer, axis conversion documented.
- **GlobeScene.tsx** — `InstancedMesh` with per-instance colors by category. Dynamic worker spawn.
- **TelemetryHUD.tsx** — Dark HUD aesthetic, category toggles, search, time-warp slider (−100× to +100×).

## Performance Notes

- Worker runs SGP4 off the main thread.
- Instanced rendering keeps draw calls at 1 for all satellites.
- For full ~15k active catalog, consider level-of-detail or frustum culling on the worker side.
- Time-warp currently affects UI state; wire the warp factor into the worker tick interval or simulated time for full effect.

## Next Steps / Missing Modules (Starter Scope)

- [ ] Click-to-select satellite + raycasting against InstancedMesh
- [ ] Full orbital path + ground track (past/future 90 min) using a separate Line
- [ ] Observer pass predictor (geolocation + `ecfToLookAngles`)
- [ ] IndexedDB cache instead of localStorage
- [ ] Day/night shader blend based on sun position
- [ ] Orbit regime filters (LEO/MEO/GEO/HEO) using mean motion

## Dependencies

See `package.json`. Key packages:

- `satellite.js` — SGP4/SDP4
- `@react-three/fiber` + `three` — 3D rendering
- `zustand` — state
- `lucide-react` — icons
- Tailwind CSS — styling

---

**License**: MIT (starter codebase). Satellite data courtesy of CelesTrak. Respect their rate limits.
