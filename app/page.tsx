'use client';

import dynamic from 'next/dynamic';
import TelemetryHUD from '@/components/TelemetryHUD';

const GlobeScene = dynamic(() => import('@/components/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black text-hud-accent font-mono">
      Initializing 3D globe...
    </div>
  ),
});

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <GlobeScene />
      <TelemetryHUD />
    </main>
  );
}