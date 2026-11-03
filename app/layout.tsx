import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OrbitalTrack — Real-time 3D Satellite Tracker',
  description: 'High-performance real-time visualization of all active satellites orbiting Earth',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}