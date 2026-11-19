// districts.js — the fixed layout of Bahía Coral, shared by the city builder,
// traffic, the minimap and the pause-menu map so every system agrees on where
// the roads, districts and landmarks are. Coordinates are metres; x grows
// east toward the sea, z grows south toward the port.

export const V_ROADS = [-520, -390, -260, -130, 0, 130, 230];
export const H_ROADS = [-520, -390, -260, -130, 0, 130, 260, 390];
export const BOULEVARD_X = 330;
export const PORT_ROAD_Z = 455;
export const WORLD = { minX: -600, maxX: 470, minZ: -620, maxZ: 620 };

// The curved eastern shoreline: land west of this line, beach and sea east.
export function shoreX(z) {
  return 432 + 52 * Math.sin(z * 0.0035) + 18 * Math.sin(z * 0.011 + 1.7);
}

export const DISTRICTS = [
  { name: 'PASEO FLAMENCO', x0: 196, z0: -620, x1: 470, z1: 420 },
  { name: 'DISTRITO MIRADOR', x0: -196, z0: -330, x1: 196, z1: 330 },
  { name: 'BARRIO VIEJO', x0: -620, z0: -620, x1: -196, z1: 420 },
  { name: 'PUERTO CAIMÁN', x0: -196, z0: 400, x1: 470, z1: 620 },
  { name: 'CENTRO', x0: -196, z0: 330, x1: 196, z1: 420 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  if (x > 300) return 'PASEO FLAMENCO';
  if (z > 400) return 'PUERTO CAIMÁN';
  if (x < -196) return 'BARRIO VIEJO';
  return 'DISTRITO MIRADOR';
}

// Named places other systems navigate to.
export const PLACES = {
  faroSol: { x: 330, z: -566, label: 'EL FARO SOL' },
  garage: { x: -326, z: 195, label: 'TALLER DIABLO' },
  garageFront: { x: -296, z: 195, label: 'TALLER DIABLO' },
  hotelCarPark: { x: 268, z: -140, label: 'HOTEL CORAL CAR PARK' },
  plaza: { x: 65, z: 65, label: 'PLAZA MIRADOR' },
  portGate: { x: 60, z: 430, label: 'PUERTO CAIMÁN GATE' },
  containerYard: { x: 165, z: 478, label: 'CONTAINER YARD' },
  pier4: { x: 430, z: 545, label: 'PIER 4' },
  boatDock: { x: 462, z: 545, label: 'SPEEDBOAT DOCK' },
  bridgeBase: { x: 448, z: 520, label: 'PUENTE BAHÍA' },
  warehouse: { x: -320, z: -60, label: 'BARRIO WAREHOUSE' },
  spawn: { x: 300, z: 330, label: 'PASEO FLAMENCO SOUTH' },
};

// Every drivable road segment, as {x0,z0,x1,z1} centrelines. Traffic picks
// connected segments; the minimap and big map draw exactly these lines.
export function buildRoadSegments() {
  const segs = [];
  const vSpan = [-580, 400];
  const hSpan = [-580, 300];
  for (const x of V_ROADS) {
    for (let i = 0; i < H_ROADS.length - 1; i++) {
      segs.push({ x0: x, z0: H_ROADS[i], x1: x, z1: H_ROADS[i + 1] });
    }
    segs.push({ x0: x, z0: vSpan[0], x1: x, z1: H_ROADS[0] });
    segs.push({ x0: x, z0: H_ROADS[H_ROADS.length - 1], x1: x, z1: vSpan[1] });
  }
  for (const z of H_ROADS) {
    for (let i = 0; i < V_ROADS.length - 1; i++) {
      segs.push({ x0: V_ROADS[i], z0: z, x1: V_ROADS[i + 1], z1: z });
    }
    segs.push({ x0: hSpan[0], z0: z, x1: V_ROADS[0], z1: z });
    segs.push({ x0: V_ROADS[V_ROADS.length - 1], z0: z, x1: hSpan[1], z1: z });
  }
  // The Paseo Flamenco boulevard, north-south along the shore.
  const bz = [-580, -390, -260, -130, 0, 130, 260, 390, 455];
  for (let i = 0; i < bz.length - 1; i++) {
    segs.push({ x0: BOULEVARD_X, z0: bz[i], x1: BOULEVARD_X, z1: bz[i + 1] });
  }
  for (const z of [0, 130, 260, 390]) {
    segs.push({ x0: 230, z0: z, x1: BOULEVARD_X, z1: z });
  }
  // Port apron roads.
  segs.push({ x0: -100, z0: PORT_ROAD_Z, x1: 430, z1: PORT_ROAD_Z });
  segs.push({ x0: 60, z0: 390, x1: 60, z1: PORT_ROAD_Z });
  segs.push({ x0: 430, z0: 390, x1: 430, z1: 560 });
  segs.push({ x0: BOULEVARD_X, z0: 390, x1: BOULEVARD_X, z1: PORT_ROAD_Z });
  return segs;
}

// Deterministic seeded RNG so the city (and the staged screenshots) are the
// same on every load for a given seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
