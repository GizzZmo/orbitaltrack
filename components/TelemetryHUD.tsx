'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, Play, Pause, RotateCcw, Satellite, MapPin } from 'lucide-react';
import { useOrbitalStore } from '@/lib/store';
import { loadSatellites } from '@/lib/tleService';

const CATEGORIES = [
  { id: 'payload', label: 'Active Payloads', color: '#00ff9f' },
  { id: 'starlink', label: 'Starlink', color: '#3b82f6' },
  { id: 'stations', label: 'Space Stations', color: '#f59e0b' },
  { id: 'gnss', label: 'GNSS / Navigation', color: '#a855f7' },
  { id: 'debris', label: 'Debris', color: '#ef4444' },
  { id: 'weather', label: 'Weather', color: '#06b6d4' },
];

export default function TelemetryHUD() {
  const {
    satellites,
    setSatellites,
    searchQuery,
    setSearchQuery,
    activeCategories,
    toggleCategory,
    selectedSatellite,
    time,
    setTime,
  } = useOrbitalStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSatellites(['stations', 'starlink', 'gps-ops', 'active'])
      .then((data) => {
        // Limit initial load for performance in starter (active is ~15k)
        const limited = data.slice(0, 8000);
        setSatellites(limited);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [setSatellites]);

  const filtered = satellites.filter((s) => {
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !String(s.noradId).includes(searchQuery)) {
      return false;
    }
    if (!activeCategories.has(s.category)) return false;
    return true;
  });

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 pointer-events-auto">
        <div className="flex items-center gap-3 bg-hud-panel backdrop-blur-md border border-white/10 rounded-lg px-4 py-2">
          <Satellite className="w-5 h-5 text-hud-accent" />
          <h1 className="font-mono text-lg font-semibold tracking-wider text-hud-text">ORBITALTRACK</h1>
          <span className="text-xs text-hud-accent/70">{filtered.length.toLocaleString()} objects</span>
        </div>

        {/* Search */}
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or NORAD ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-hud-panel backdrop-blur-md border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-hud-text placeholder:text-gray-500 focus:outline-none focus:border-hud-accent/50"
          />
        </div>

        {/* Time controls */}
        <div className="flex items-center gap-2 bg-hud-panel backdrop-blur-md border border-white/10 rounded-lg px-3 py-2">
          <button
            onClick={() => setTime({ isPlaying: !time.isPlaying })}
            className="p-1.5 hover:bg-white/10 rounded"
          >
            {time.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setTime({ currentTime: new Date(), timeWarp: 1, isRealtime: true })}
            className="p-1.5 hover:bg-white/10 rounded"
            title="Reset to realtime"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <input
            type="range"
            min="-100"
            max="100"
            value={time.timeWarp}
            onChange={(e) => setTime({ timeWarp: Number(e.target.value), isRealtime: false })}
            className="w-24 accent-hud-accent"
          />
          <span className="font-mono text-xs w-12 text-right">{time.timeWarp > 0 ? '+' : ''}{time.timeWarp}x</span>
        </div>
      </div>

      {/* Category filters */}
      <div className="px-4 pointer-events-auto">
        <div className="inline-flex items-center gap-2 bg-hud-panel backdrop-blur-md border border-white/10 rounded-lg p-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeCategories.has(cat.id)
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: cat.color }} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected satellite telemetry panel */}
      {selectedSatellite && (
        <div className="absolute top-28 right-4 w-80 bg-hud-panel backdrop-blur-md border border-white/10 rounded-lg p-4 pointer-events-auto font-mono text-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-hud-accent font-semibold">{selectedSatellite.name}</h2>
            <span className="text-xs text-gray-400">#{selectedSatellite.id}</span>
          </div>
          <div className="space-y-1.5 text-xs text-hud-text/90">
            <div className="flex justify-between"><span>Altitude</span><span>{selectedSatellite.altitude?.toFixed(1)} km</span></div>
            <div className="flex justify-between"><span>Velocity</span><span>{selectedSatellite.velocity?.toFixed(2)} km/s</span></div>
            <div className="flex justify-between"><span>Lat / Lon</span><span>{selectedSatellite.lat?.toFixed(2)}° / {selectedSatellite.lon?.toFixed(2)}°</span></div>
            <div className="flex justify-between"><span>Inclination</span><span>{selectedSatellite.inclination?.toFixed(2)}°</span></div>
            <div className="flex justify-between"><span>Period</span><span>{selectedSatellite.period?.toFixed(1)} min</span></div>
          </div>
        </div>
      )}

      {/* Loading / error */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="bg-hud-panel px-6 py-4 rounded-lg font-mono text-hud-accent">
            Acquiring TLE data from CelesTrak...
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-950/80 border border-red-500/50 text-red-200 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}