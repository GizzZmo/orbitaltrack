'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, useEffect, useMemo, useState } from 'react';
import { useOrbitalStore } from '@/lib/store';
import type { SatelliteTLE } from '@/types/satellite';

const EARTH_RADIUS = 1;

const CATEGORY_COLORS: Record<string, THREE.Color> = {
  payload: new THREE.Color('#00ff9f'),
  starlink: new THREE.Color('#3b82f6'),
  stations: new THREE.Color('#f59e0b'),
  gnss: new THREE.Color('#a855f7'),
  debris: new THREE.Color('#ef4444'),
  weather: new THREE.Color('#06b6d4'),
  default: new THREE.Color('#94a3b8'),
};

interface SatellitePointsProps {
  satellites: SatelliteTLE[];
}

function SatellitePoints({ satellites }: SatellitePointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const workerRef = useRef<Worker | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => new Float32Array(satellites.length * 3), [satellites.length]);

  useEffect(() => {
    // Initialize colors
    satellites.forEach((sat, i) => {
      const color = CATEGORY_COLORS[sat.category] || CATEGORY_COLORS.default;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    if (meshRef.current) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }

    // Spawn worker
    const worker = new Worker(new URL('../workers/propagation.worker.ts', import.meta.url));
    workerRef.current = worker;

    worker.postMessage({
      type: 'INIT',
      payload: { satellites },
    });

    worker.onmessage = (e) => {
      const { type, positions, count } = e.data;
      if (type === 'POSITIONS' && meshRef.current && positions) {
        const mesh = meshRef.current;
        for (let i = 0; i < count; i++) {
          dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = count;
      }
    };

    worker.postMessage({ type: 'START', payload: { time: Date.now() } });

    return () => {
      worker.postMessage({ type: 'STOP' });
      worker.terminate();
    };
  }, [satellites, colors, dummy]);

  // Optional: sync time warp from store
  const timeWarp = useOrbitalStore((s) => s.time.timeWarp);
  const isPlaying = useOrbitalStore((s) => s.time.isPlaying);

  useEffect(() => {
    // For simplicity, worker runs at real rate; time warp can be applied by adjusting tick interval
    // Production: send time offset / warp factor to worker
  }, [timeWarp, isPlaying]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, satellites.length]} frustumCulled={false}>
      <sphereGeometry args={[0.008, 6, 6]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function Earth() {
  const dayMap = useLoader(THREE.TextureLoader, 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const nightMap = useLoader(THREE.TextureLoader, 'https://unpkg.com/three-globe/example/img/earth-night.jpg');

  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshPhongMaterial
          map={dayMap}
          bumpScale={0.02}
          specular={new THREE.Color('grey')}
          shininess={5}
        />
      </mesh>
      {/* Simple atmosphere */}
      <mesh scale={1.02}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshPhongMaterial
          color="#4fc3f7"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export default function GlobeScene() {
  const satellites = useOrbitalStore((s) => s.satellites);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (satellites.length > 0) setReady(true);
  }, [satellites]);

  return (
    <div className="absolute inset-0 bg-black">
      <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#000010']} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade />
        <Earth />
        {ready && <SatellitePoints satellites={satellites} />}
        <OrbitControls
          enablePan={false}
          minDistance={1.2}
          maxDistance={12}
          rotateSpeed={0.5}
          zoomSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}