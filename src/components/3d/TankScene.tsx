import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createWaterMaterial } from './WaterShader';
import { useCameraControls } from '@/hooks/useCameraControls';
import { TankEnvironment } from '@/types';

interface Props {
  environment: TankEnvironment;
  style?: React.CSSProperties;
}

const ENV: Record<TankEnvironment, { water: number; ambient: number; bg: string }> = {
  coral_reef:   { water: 0x006994, ambient: 0x4488bb, bg: '#001a33' },
  deep_sea:     { water: 0x001133, ambient: 0x112244, bg: '#000511' },
  korean_river: { water: 0x3a6b3a, ambient: 0x557755, bg: '#0d1f0d' },
  amazon:       { water: 0x1a4a2e, ambient: 0x336644, bg: '#0a1a10' },
  space:        { water: 0x0d0d2b, ambient: 0x1a1a44, bg: '#000008' },
};

export default function TankScene({ environment, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const waterRef = useRef<THREE.Mesh | null>(null);
  const fishMeshesRef = useRef<THREE.Mesh[]>([]);
  const rafRef = useRef(0);
  const clock = useRef(new THREE.Clock());

  const { bindCanvas, apply } = useCameraControls(cameraRef);

  const env = ENV[environment];

  const init = useCallback((canvas: HTMLCanvasElement) => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(new THREE.Color(env.bg), 1);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color(env.bg), 0.05);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    apply();

    // Lights
    scene.add(new THREE.AmbientLight(env.ambient, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    scene.add(sun);
    const under = new THREE.PointLight(0x4488ff, 0.8, 15);
    under.position.set(0, -2, 0);
    scene.add(under);

    // Tank glass
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 8),
      new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.06, roughness: 0, side: THREE.BackSide }),
    );
    scene.add(glass);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    scene.add(floor);

    // Water surface
    const waterMat = createWaterMaterial();
    (waterMat.uniforms.uWaterColor.value as THREE.Color).set(env.water);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(10, 8, 32, 32), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 2.9;
    scene.add(water);
    waterRef.current = water;

    // Gravel
    for (let i = 0; i < 60; i++) {
      const g = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 4, 4),
        new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.3 + Math.random() * 0.3, 0.3 + Math.random() * 0.2), roughness: 0.9 }),
      );
      g.position.set((Math.random() - 0.5) * 9, -2.95, (Math.random() - 0.5) * 7);
      scene.add(g);
    }

    // Placeholder fish
    const fishColors = [0xff6b35, 0xffd700, 0x4ecdc4, 0xff6b9d, 0x95e1d3];
    fishMeshesRef.current = fishColors.map(color => {
      const geo = new THREE.SphereGeometry(0.2, 8, 6);
      geo.scale(1.5, 0.7, 0.9);
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color, shininess: 80 }));
      mesh.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
      mesh.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.02);
      mesh.userData.phase = Math.random() * Math.PI * 2;
      scene.add(mesh);
      return mesh;
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      renderer.setSize(cw, ch);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);
    return ro;
  }, [apply, env]);

  // Animation loop
  const animate = useCallback(() => {
    rafRef.current = requestAnimationFrame(animate);
    const t = clock.current.getElapsedTime();
    if (waterRef.current) {
      (waterRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    }
    fishMeshesRef.current.forEach(f => {
      const vel = f.userData.vel as THREE.Vector3;
      f.position.x += vel.x;
      f.position.y += vel.y + Math.sin(t * 1.5 + f.userData.phase) * 0.003;
      f.position.z += vel.z;
      if (Math.abs(f.position.x) > 4.5) vel.x *= -1;
      if (Math.abs(f.position.y) > 2.5) vel.y *= -1;
      if (Math.abs(f.position.z) > 3.5) vel.z *= -1;
      if (vel.length() > 0.001) f.rotation.y = Math.atan2(vel.x, vel.z);
    });
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = init(canvas);
    animate();
    const cleanup = bindCanvas(canvas);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      cleanup?.();
      rendererRef.current?.dispose();
    };
  }, [init, animate, bindCanvas]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', ...style }}
    />
  );
}
