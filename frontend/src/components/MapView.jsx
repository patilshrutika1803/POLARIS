import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

export const DEFAULT_LAYERS = {
  seaIce: true,
  icebergs: true,
  trajectories: true,
  riskZones: true,
  currents: true,
  recommendedRoute: true,
  waypoints: true,
};

function toWorld(latitude, longitude, bounds) {
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.0001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  return [((longitude - bounds.minLon) / lonSpan) * 40 - 20, 0, ((bounds.maxLat - latitude) / latSpan) * 28 - 14];
}

function Ocean() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[70, 55]} />
        <meshStandardMaterial color="#061826" roughness={0.85} metalness={0.1} />
      </mesh>
      <gridHelper args={[70, 34, '#123a4d', '#0d2635']} position={[0, 0, 0]} />
    </group>
  );
}

function SeaIceLayer({ concentration }) {
  const color = concentration < 0.2 ? '#3ee68a' : concentration < 0.5 ? '#f5c948' : '#ff5c5c';
  const patches = [
    { x: -6, z: -2, s: 9 }, { x: 4, z: 4, s: 7 }, { x: -12, z: 6, s: 6 },
  ];
  return <group>{patches.map((p, i) => (
    <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.01, p.z]}>
      <circleGeometry args={[p.s, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.12 + concentration * 0.25} />
    </mesh>
  ))}</group>;
}

function CurrentArrows({ directionDeg }) {
  const rad = (directionDeg * Math.PI) / 180;
  const positions = [[-10, -6], [-2, -8], [6, -4], [-8, 4], [2, 2], [10, 6]];
  return <group rotation={[0, -rad, 0]}>{positions.map(([x, z], i) => (
    <mesh key={i} position={[x, 0.08, z]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.18, 0.6, 8]} />
      <meshBasicMaterial color="#3ee6ff" transparent opacity={0.35} />
    </mesh>
  ))}</group>;
}

function Ship({ position }) {
  return <group position={position}>
    <mesh rotation={[0, Math.PI / 4, 0]} position={[0, 0.35, 0]} castShadow>
      <coneGeometry args={[0.55, 1.6, 4]} />
      <meshStandardMaterial color="#38bdf8" emissive="#1391c4" emissiveIntensity={0.7} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1.05, 32]} />
      <meshBasicMaterial color="#3ee6ff" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
    <Html position={[0, -0.4, 0.9]} center distanceFactor={22}>
      <div style={{ color: '#9fd8f5', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>START</div>
    </Html>
  </group>;
}

function Destination({ position }) {
  return <group position={position}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[0.7, 0.85, 32]} />
      <meshBasicMaterial color="#ff8a8a" side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshStandardMaterial color="#ff5c5c" emissive="#ff5c5c" emissiveIntensity={0.6} />
    </mesh>
    <Html position={[0, 1, 0]} center distanceFactor={22}>
      <div style={{ color: '#ffb3ad', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>DESTINATION</div>
    </Html>
  </group>;
}

function Iceberg({ berg, bounds, dimmed, showRiskZone, selected }) {
  const [x, , z] = toWorld(berg.latitude, berg.longitude, bounds);
  const scale = 0.4 + (berg.radiusKm ?? 10) / 40;
  const riskColor = berg.riskLevel === 'high' ? '#ff5c5c' : berg.riskLevel === 'medium' ? '#f5941f' : null;
  return <group position={[x, 0, z]}>
    <mesh position={[0, scale * 0.6, 0]} castShadow>
      <icosahedronGeometry args={[scale, 0]} />
      <meshStandardMaterial color={selected ? '#eafeff' : '#cfe7f0'} roughness={0.4} transparent opacity={dimmed ? 0.35 : 1} emissive={selected ? '#3ee6ff' : '#000000'} emissiveIntensity={selected ? 0.5 : 0} />
    </mesh>
    {showRiskZone && riskColor && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[scale + 0.5, scale + 0.9, 32]} />
      <meshBasicMaterial color={riskColor} transparent opacity={dimmed ? 0.12 : 0.45} side={THREE.DoubleSide} />
    </mesh>}
    {selected && <Html position={[0, scale + 0.9, 0]} center distanceFactor={22}>
      <div style={{ color: '#eafeff', fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap' }}>{berg.id}</div>
    </Html>}
  </group>;
}

const HORIZONS = [
  { key: 'min20', label: '20 MIN' },
  { key: 'hr1', label: '1 HOUR' },
  { key: 'hr6', label: '6 HOURS' },
];

// Shows the complete ML forecast: current -> 20 min -> 1 hr -> 6 hr.
// The selected horizon is emphasized, but all three future predictions remain visible.
function TrajectoryForecast({ berg, bounds, selectedHorizon }) {
  if (!berg?.forecast) return null;
  const available = HORIZONS.filter((h) => berg.forecast[h.key]);
  if (!available.length) return null;

  const current = new THREE.Vector3(...toWorld(berg.latitude, berg.longitude, bounds));
  current.y = 0.12;
  const points = [current, ...available.map((h) => {
    const p = new THREE.Vector3(...toWorld(berg.forecast[h.key].latitude, berg.forecast[h.key].longitude, bounds));
    p.y = 0.12;
    return p;
  })];

  return <group>
    <Line points={points} color="#f5c948" lineWidth={2.5} transparent opacity={0.9} dashed dashSize={0.22} gapSize={0.12} />
    {available.map((h, index) => {
      const p = points[index + 1];
      const selected = selectedHorizon === h.key;
      return <group key={h.key}>
        {selected && <mesh position={[p.x, 0.11, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.48, 0.62, 32]} />
          <meshBasicMaterial color="#3ee6ff" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>}
        <mesh position={p}>
          <sphereGeometry args={[selected ? 0.38 : 0.28, 16, 16]} />
          <meshStandardMaterial color={selected ? '#3ee6ff' : '#f5c948'} emissive={selected ? '#3ee6ff' : '#f5c948'} emissiveIntensity={0.9} />
        </mesh>
        <Html position={[p.x, p.y + 0.55, p.z]} center distanceFactor={22}>
          <div style={{
            color: selected ? '#3ee6ff' : '#f5c948',
            fontFamily: 'var(--font-mono)', fontSize: selected ? 11 : 10,
            whiteSpace: 'nowrap', fontWeight: 700,
            textShadow: '0 0 5px #031019'
          }}>{h.label}</div>
        </Html>
      </group>;
    })}
    <Html position={[current.x, current.y + 0.5, current.z]} center distanceFactor={22}>
      <div style={{ color: '#eafeff', fontFamily: 'var(--font-mono)', fontSize: 9, whiteSpace: 'nowrap' }}>CURRENT</div>
    </Html>
  </group>;
}

function Waypoint({ wp, bounds }) {
  const [x, , z] = toWorld(wp.latitude, wp.longitude, bounds);
  return <group position={[x, 0.15, z]}>
    <mesh><sphereGeometry args={[0.18, 16, 16]} /><meshStandardMaterial color={wp.color} emissive={wp.color} emissiveIntensity={0.6} /></mesh>
    <Html position={[0, 0.4, 0]} center distanceFactor={22}><div style={{ color: wp.color, fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap' }}>{wp.id}</div></Html>
  </group>;
}

function RecommendedRoute({ points }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const sampled = useMemo(() => curve.getPoints(60), [curve]);
  return <group>
    <Line points={sampled} color="#3ee6ff" lineWidth={5} transparent opacity={0.95} />
    <Line points={sampled} color="#eafeff" lineWidth={1} dashed dashSize={0.3} gapSize={0.25} />
  </group>;
}

function DirectRoute({ from, to, dimmed }) {
  return <Line points={[from, to]} color="#f5941f" lineWidth={dimmed ? 2 : 4} transparent opacity={dimmed ? 0.25 : 0.75} />;
}

function CameraRig({ focusMode, routePoints }) {
  const controls = useRef();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  useMemo(() => {
    const box = new THREE.Box3().setFromPoints(routePoints);
    const center = box.getCenter(new THREE.Vector3());
    if (focusMode) {
      targetPos.current.set(center.x, 16, center.z + 14);
      targetLook.current.copy(center);
    } else {
      targetPos.current.set(4, 26, 26);
      targetLook.current.set(0, 0, 0);
    }
  }, [focusMode, routePoints]);

  useFrame((state) => {
    state.camera.position.lerp(targetPos.current, 0.04);
    if (controls.current) {
      controls.current.target.lerp(targetLook.current, 0.04);
      controls.current.update();
    }
  });

  return <OrbitControls ref={controls} enablePan={false} minDistance={8} maxDistance={45} maxPolarAngle={Math.PI / 2.1} />;
}

export default function MapView({
  scene,
  focusMode = false,
  layers = DEFAULT_LAYERS,
  seaIce,
  oceanCurrent,
  selectedIceberg = null,
  horizon = null,
  routeStatus = 'INFEASIBLE',
}) {
  const { ship, destination, icebergs, waypoints } = scene;
  const bounds = useMemo(() => {
    const points = [ship, destination, ...waypoints, ...icebergs, ...icebergs.flatMap((berg) => Object.values(berg.forecast ?? {}))];
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    return {
      minLat: Math.min(...latitudes) - 0.01, maxLat: Math.max(...latitudes) + 0.01,
      minLon: Math.min(...longitudes) - 0.01, maxLon: Math.max(...longitudes) + 0.01,
    };
  }, [ship, destination, waypoints, icebergs]);
  const shipPos = useMemo(() => new THREE.Vector3(...toWorld(ship.latitude, ship.longitude, bounds)), [ship, bounds]);
  const destPos = useMemo(() => new THREE.Vector3(...toWorld(destination.latitude, destination.longitude, bounds)), [destination, bounds]);
  const wpPositions = useMemo(() => waypoints.map((wp) => new THREE.Vector3(...toWorld(wp.latitude, wp.longitude, bounds))), [waypoints, bounds]);
  const routePoints = useMemo(() => [shipPos, ...wpPositions, destPos], [shipPos, wpPositions, destPos]);

  return <div className="map-wrap">
    <div className="map-controls">
      <button title="Zoom in">+</button>
      <button title="Zoom out">−</button>
      <button title="Reset view">⤾</button>
    </div>

    <Canvas shadows camera={{ position: [4, 26, 26], fov: 42 }}>
      <color attach="background" args={['#050f18']} />
      <fog attach="fog" args={['#050f18', 20, 55]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} color="#bfe6f5" castShadow />

      <Ocean />
      {layers.seaIce && seaIce && <SeaIceLayer concentration={seaIce.concentration} />}
      {layers.currents && oceanCurrent && <CurrentArrows directionDeg={oceanCurrent.directionDeg} />}

      {layers.icebergs && icebergs.map((b) => (
        <Iceberg key={b.id} berg={b} bounds={bounds} dimmed={focusMode} showRiskZone={layers.riskZones} selected={selectedIceberg?.id === b.id} />
      ))}

      {layers.trajectories && selectedIceberg && <TrajectoryForecast berg={selectedIceberg} bounds={bounds} selectedHorizon={horizon} />}

      {routeStatus !== 'INFEASIBLE' && <DirectRoute from={shipPos} to={destPos} dimmed={focusMode} />}
      {routeStatus !== 'INFEASIBLE' && layers.recommendedRoute && waypoints.length > 0 && <RecommendedRoute points={routePoints} />}
      {routeStatus !== 'INFEASIBLE' && layers.waypoints && waypoints.map((wp) => <Waypoint key={wp.id} wp={wp} bounds={bounds} />)}
      <Ship position={shipPos} />
      <Destination position={destPos} />
      <CameraRig focusMode={focusMode} routePoints={routePoints} />
    </Canvas>

    <div className="forecast-legend">
      <span><i className="dot current" /> CURRENT</span>
      <span><i className="dot future" /> 20 MIN</span>
      <span><i className="dot future" /> 1 HOUR</span>
      <span><i className="dot future" /> 6 HOURS</span>
    </div>
    <div className="vignette" />

    <style>{`
      .map-wrap{position:relative;width:100%;height:620px;min-height:620px;border:1px solid var(--panel-border);border-radius:12px;overflow:hidden;background:linear-gradient(160deg,#0a1c2b 0%,#060f1a 55%,#030a12 100%);box-shadow:inset 0 0 60px rgba(0,0,0,.6);}
      .map-wrap canvas{display:block;width:100%!important;height:100%!important;}
      .vignette{position:absolute;inset:0;z-index:3;pointer-events:none;box-shadow:inset 0 0 90px rgba(0,0,0,.65);}
      .map-controls{position:absolute;top:10px;left:10px;z-index:4;display:flex;flex-direction:column;gap:6px;}
      .map-controls button{width:30px;height:30px;border-radius:6px;background:rgba(6,16,26,.85);border:1px solid var(--panel-border);color:var(--cyan);font-size:15px;cursor:pointer;}
      .forecast-legend{position:absolute;right:12px;bottom:12px;z-index:4;display:flex;gap:12px;padding:8px 10px;border:1px solid rgba(62,230,255,.2);border-radius:7px;background:rgba(4,14,23,.82);color:#9fd8f5;font-family:var(--font-mono);font-size:9px;backdrop-filter:blur(5px);}
      .forecast-legend span{display:flex;align-items:center;gap:4px;}
      .dot{width:6px;height:6px;border-radius:50%;display:inline-block;}
      .dot.current{background:#eafeff;box-shadow:0 0 5px #eafeff;}
      .dot.future{background:#f5c948;box-shadow:0 0 5px #f5c948;}
      @media (max-width:900px){.map-wrap{height:520px;min-height:520px}.forecast-legend{font-size:8px;gap:7px;}}
    `}</style>
  </div>;
}
