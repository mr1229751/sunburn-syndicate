// cityBuilder.js — constructs all of Bahía Coral's static world: ground and
// sea, the road grid with markings and the palm median, block slabs, the four
// districts' buildings, El Faro Sol, Puente Bahía, the port, the Taller
// Diablo garage, and street furniture. Registers building colliders, ammo
// crates and cover points on G for the gameplay systems.

import * as THREE from 'three';
import {
  asphaltTexture, awningTexture, blobShadowTexture, containerTexture,
  crateTexture, facadeSet, haloTexture, sandTexture, signTexture,
  sidewalkTexture, waterTexture,
} from './textures.js';
import {
  BOULEVARD_X, H_ROADS, PLACES, PORT_ROAD_Z, V_ROADS, buildRoadSegments,
  districtAt, mulberry32, shoreX,
} from './districts.js';
import { buildVehicleMesh } from '../entities/vehicle.js';

// Merge indexed geometries (with position/normal/uv) into one, after
// applying each geometry's matrix — used for palms and small props.
export function mergeGeometries(parts) {
  let vCount = 0, iCount = 0;
  for (const g of parts) {
    vCount += g.attributes.position.count;
    iCount += g.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vOff = 0, iOff = 0;
  const nm = new THREE.Matrix3();
  for (const g of parts) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    nm.getNormalMatrix(g.userData.matrix ?? new THREE.Matrix4());
    const m = g.userData.matrix ?? new THREE.Matrix4();
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.set([v.x, v.y, v.z], (vOff + i) * 3);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor.set([v.x, v.y, v.z], (vOff + i) * 3);
      uv.set([u.getX(i), u.getY(i)], (vOff + i) * 2);
    }
    for (let i = 0; i < g.index.count; i++) idx[iOff + i] = g.index.getX(i) + vOff;
    vOff += p.count; iOff += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function transformed(geo, x, y, z, ry = 0, rx = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(rx, ry, rz))
    .setPosition(x, y, z);
  if (s !== 1) m.scale(new THREE.Vector3(s, s, s));
  geo.userData.matrix = m;
  return geo;
}

const NEON_COLORS = ['#00f0ff', '#ff3d7f', '#ffb800'];

// One building: podium with awning and warm shopfront, textured body with
// setbacks, crown with parapet, roof boxes and a neon strip.
function makeBuilding(G, mats, style, w, d, h, color, rng, frontDir = 0) {
  const g = new THREE.Group();
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(w + 1.4, 3.6, d + 1.4),
    mats.podium,
  );
  podium.position.y = 1.8;
  g.add(podium);

  const shop = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.82, 2.3),
    mats.shopfront,
  );
  shop.position.set(0, 1.55, (d + 1.4) / 2 + 0.03);
  g.add(shop);
  if (style !== 'glass') {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.86, 0.14, 1.7),
      new THREE.MeshStandardMaterial({ map: awningTexture(color), roughness: 0.9 }),
    );
    awning.position.set(0, 2.95, (d + 1.4) / 2 + 0.8);
    awning.rotation.x = 0.42;
    g.add(awning);
  }

  const setback = style === 'glass' && h > 44 ? 0.72 : 1;
  const bodyH = h - 3.6;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w * setback, bodyH, d * setback),
    mats.body(style, color, Math.max(1, Math.round(w / 13)), Math.max(1, Math.round(bodyH / 13))),
  );
  body.position.y = 3.6 + bodyH / 2;
  g.add(body);
  if (setback < 1) {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(w, bodyH * 0.45, d),
      body.material,
    );
    shoulder.position.y = 3.6 + bodyH * 0.225;
    g.add(shoulder);
  }

  const crown = new THREE.Mesh(new THREE.BoxGeometry(w * setback + 0.7, 1.15, d * setback + 0.7), mats.crown);
  crown.position.y = h + 0.4;
  g.add(crown);
  const acCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < acCount; i++) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), mats.ac);
    ac.position.set((rng() - 0.5) * w * 0.5, h + 1.4, (rng() - 0.5) * d * 0.5);
    g.add(ac);
  }
  if (style !== 'colonial') {
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(w * setback + 0.8, 0.3, 0.16),
      mats.neon[Math.floor(rng() * 3)],
    );
    neon.position.set(0, h - 0.6, (d * setback) / 2 + 0.1);
    g.add(neon);
  }
  g.rotation.y = frontDir;
  return g;
}

// Ground, sea, beach and the road network with its markings.
function buildGroundAndRoads(G, mats) {
  const asphalt = asphaltTexture();
  asphalt.repeat.set(60, 60);
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(1180, 1360),
    new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.94 }),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(-70, 0, 0);
  G.scene.add(land);

  const waterTex = waterTexture();
  waterTex.repeat.set(46, 46);
  G.waterTex = waterTex;
  G.seaMat = new THREE.MeshStandardMaterial({
    map: waterTex, color: '#0e5a6d', roughness: 0.32, metalness: 0.15,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2600, 3600), G.seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(430 + 1300, -0.55, 0);
  G.scene.add(sea);

  // Beach strip following the curved shoreline, plus a foam edge.
  const sand = sandTexture();
  sand.repeat.set(30, 30);
  const sandMat = new THREE.MeshStandardMaterial({ map: sand, roughness: 1 });
  const foamMat = new THREE.MeshBasicMaterial({ color: '#f7e9d7', transparent: true, opacity: 0.5 });
  for (let z = -640; z < 640; z += 40) {
    const cx = (shoreX(z) + shoreX(z + 40)) / 2;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), sandMat);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = Math.atan2(shoreX(z + 40) - shoreX(z), 40);
    strip.position.set(cx - 16, 0.03, z + 20);
    G.scene.add(strip);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 42), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.z = strip.rotation.z;
    foam.position.set(cx + 17, 0.05, z + 20);
    G.scene.add(foam);
  }

  // Road centre dashes and lane paint, instanced.
  const segs = buildRoadSegments();
  G.roadSegments = segs;
  const dashGeo = new THREE.PlaneGeometry(0.28, 2.6);
  const dashMat = new THREE.MeshBasicMaterial({ color: '#e6e2d6' });
  const dashMats = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (const s of segs) {
    const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
    const n = Math.floor(len / 11);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = s.x0 + (s.x1 - s.x0) * t, z = s.z0 + (s.z1 - s.z0) * t;
      const ang = Math.atan2(s.x1 - s.x0, s.z1 - s.z0);
      const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, ang));
      dashMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.03, z), qq, new THREE.Vector3(1, 1, 1)));
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashMats.length);
  dashMats.forEach((m, i) => dashes.setMatrixAt(i, m));
  G.scene.add(dashes);
  void m4; void q;

  // Boulevard median: a low planted strip down the middle of Paseo Flamenco.
  const median = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.24, 1030),
    new THREE.MeshStandardMaterial({ color: '#3d5a3a', roughness: 1 }),
  );
  median.position.set(BOULEVARD_X, 0.12, -60);
  G.scene.add(median);
  const lineMat = new THREE.MeshBasicMaterial({ color: '#f5b700' });
  for (const off of [-5.6, 5.6]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1030), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(BOULEVARD_X + off, 0.03, -60);
    G.scene.add(line);
  }

  // Zebra crossings at the downtown and boulevard junctions, instanced.
  const zebraGeo = new THREE.BoxGeometry(3.4, 0.04, 0.62);
  const zebraMat = new THREE.MeshBasicMaterial({ color: '#e8e6da' });
  const zebraMats = [];
  const junctions = [[0, 0], [130, 0], [0, 130], [130, 130], [BOULEVARD_X, 0], [BOULEVARD_X, 130], [BOULEVARD_X, 260]];
  for (const [jx, jz] of junctions) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = -2; i <= 2; i++) {
        const x = jx + dx * 10.5 + (dz !== 0 ? i * 1.5 : 0);
        const z = jz + dz * 10.5 + (dx !== 0 ? i * 1.5 : 0);
        const e = new THREE.Euler(0, dx !== 0 ? Math.PI / 2 : 0, 0);
        zebraMats.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x, 0.04, z),
          new THREE.Quaternion().setFromEuler(e),
          new THREE.Vector3(1, 1, 1),
        ));
      }
    }
  }
  const zebras = new THREE.InstancedMesh(zebraGeo, zebraMat, zebraMats.length);
  zebraMats.forEach((m, i) => zebras.setMatrixAt(i, m));
  G.scene.add(zebras);
}

// Block slabs the buildings stand on (also the raised sidewalks).
function buildBlockSlabs(G, mats) {
  const xEdges = [-600, -520, -390, -260, -130, 0, 130, 230, 302];
  const zEdges = [-600, -520, -390, -260, -130, 0, 130, 260, 390, 428];
  G.blockCells = [];
  for (let i = 0; i < xEdges.length - 1; i++) {
    for (let j = 0; j < zEdges.length - 1; j++) {
      const hw = (xEdges[i + 1] - xEdges[i]) > 60 ? 8 : 8;
      const x0 = xEdges[i] + hw, x1 = xEdges[i + 1] - hw;
      const z0 = zEdges[j] + 8, z1 = zEdges[j + 1] - 8;
      if (x1 - x0 < 16 || z1 - z0 < 16) continue;
      const cell = { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
      G.blockCells.push(cell);
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, 0.18, z1 - z0),
        mats.sidewalk(x1 - x0, z1 - z0),
      );
      slab.position.set(cell.cx, 0.09, cell.cz);
      G.scene.add(slab);
    }
  }
  // Port apron: one big concrete slab south of the port road.
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(560, 0.18, 190),
    mats.sidewalk(56, 19),
  );
  apron.position.set(165, 0.09, 522);
  G.scene.add(apron);
}

// Shared materials with per-size texture repeats, cached so the city stays
// light on draw state changes.
function buildMaterials(G) {
  const matCache = new Map();
  const neonMats = NEON_COLORS.map((c) => {
    const m = new THREE.MeshStandardMaterial({
      color: '#101014', emissive: c, emissiveIntensity: 1.2, roughness: 0.4,
    });
    G.neonMats.push(m);
    return m;
  });
  return {
    podium: new THREE.MeshStandardMaterial({ color: '#57493b', roughness: 0.95 }),
    crown: new THREE.MeshStandardMaterial({ color: '#2e2a33', roughness: 0.9 }),
    ac: new THREE.MeshStandardMaterial({ color: '#7a7f8a', roughness: 0.6, metalness: 0.5 }),
    shopfront: new THREE.MeshStandardMaterial({
      color: '#241a10', emissive: '#ffe3a3', emissiveIntensity: 0.55, roughness: 0.4,
    }),
    neon: neonMats,
    body(style, color, rx, ry) {
      const key = `body|${style}|${color}|${rx}|${ry}`;
      if (matCache.has(key)) return matCache.get(key);
      const set = facadeSet(style, color);
      const map = set.map.clone();
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(rx, ry); map.needsUpdate = true;
      const emissiveMap = set.emissiveMap.clone();
      emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
      emissiveMap.repeat.set(rx, ry); emissiveMap.needsUpdate = true;
      const m = new THREE.MeshStandardMaterial({
        map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 1.0,
        roughness: style === 'glass' ? 0.32 : 0.85,
        metalness: style === 'glass' ? 0.55 : 0.05,
      });
      G.facadeMats.push(m);
      matCache.set(key, m);
      return m;
    },
    sidewalk(w, d) {
      const key = `walk|${Math.round(w / 8)}|${Math.round(d / 8)}`;
      if (matCache.has(key)) return matCache.get(key);
      const tex = sidewalkTexture().clone();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(d / 8)));
      tex.needsUpdate = true;
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
      matCache.set(key, m);
      return m;
    },
  };
}

const DECO_COLORS = ['#e86a58', '#f4e4c1', '#4aa3a2', '#e88ca0', '#f2b880'];
const COLONIAL_COLORS = ['#c85a32', '#e2a83b', '#2d5da1', '#d9c9a3', '#a34a68'];
const GLASS_COLORS = ['#5a7a94', '#3e5a74', '#6a8aa4', '#4a6a8a'];
const HOTEL_SIGNS = ['HOTEL CORAL', 'PALMA REAL', 'HOTEL SOL', 'MAR AZUL', 'BRISA ROYAL'];

// Fill every block cell with buildings in its district's style.
function buildBuildings(G, mats) {
  const garageRect = { x0: -358, z0: 170, x1: -296, z1: 220 };
  let signIdx = 0;
  G.blockCells.forEach((cell, ci) => {
    const rng = mulberry32(G.seed + ci * 131 + 7);
    const district = districtAt(cell.cx, cell.cz);
    const isPlaza = cell.cx > 0 && cell.cx < 130 && cell.cz > 0 && cell.cz < 130;
    if (isPlaza || cell.cz > 400) return;
    let style = 'glass';
    let palette = GLASS_COLORS;
    if (district === 'BARRIO VIEJO') { style = 'colonial'; palette = COLONIAL_COLORS; }
    else if (district === 'PASEO FLAMENCO') { style = 'deco'; palette = DECO_COLORS; }
    else if (district === 'CENTRO') { style = rng() > 0.5 ? 'deco' : 'glass'; palette = style === 'deco' ? DECO_COLORS : GLASS_COLORS; }

    const cols = cell.x1 - cell.x0 > 74 ? 2 : 1;
    const rows = cell.z1 - cell.z0 > 74 ? 2 : 1;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (rng() < 0.14) continue;
        const bw = (cell.x1 - cell.x0) / cols - 12 - rng() * 6;
        const bd = (cell.z1 - cell.z0) / rows - 12 - rng() * 6;
        const bx = cell.x0 + ((cell.x1 - cell.x0) / cols) * (i + 0.5) + (rng() - 0.5) * 5;
        const bz = cell.z0 + ((cell.z1 - cell.z0) / rows) * (j + 0.5) + (rng() - 0.5) * 5;
        if (bx + bw / 2 > garageRect.x0 && bx - bw / 2 < garageRect.x1 &&
            bz + bd / 2 > garageRect.z0 && bz - bd / 2 < garageRect.z1) continue;
        let h;
        if (style === 'glass') h = 30 + rng() * 40;
        else if (style === 'deco') h = 17 + rng() * 21;
        else h = 8 + rng() * 6.5;
        const color = palette[Math.floor(rng() * palette.length)];
        const b = makeBuilding(G, mats, style, bw, bd, h, color, rng);
        b.position.set(bx, 0.18, bz);
        G.scene.add(b);
        G.colliders.push({ x0: bx - bw / 2 - 0.7, z0: bz - bd / 2 - 0.7, x1: bx + bw / 2 + 0.7, z1: bz + bd / 2 + 0.7 });
        if (style === 'deco' && district === 'PASEO FLAMENCO') {
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(13, 4.6),
            new THREE.MeshBasicMaterial({ map: signTexture(HOTEL_SIGNS[signIdx++ % HOTEL_SIGNS.length], '#1c1030', '#ffb800') }),
          );
          sign.position.set(bx + bw / 2 + 0.85, 7.6, bz);
          sign.rotation.y = Math.PI / 2;
          G.scene.add(sign);
        }
      }
    }
  });
}

// Plaza Mirador: fountain, benches and a palm ring in the downtown block.
function buildPlaza(G, mats) {
  const { x, z } = PLACES.plaza;
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(6.4, 6.8, 1.1, 20),
    new THREE.MeshStandardMaterial({ color: '#9a8f7a', roughness: 0.8 }),
  );
  basin.position.set(x, 0.7, z);
  G.scene.add(basin);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(5.9, 20),
    new THREE.MeshStandardMaterial({ color: '#2a7a9e', roughness: 0.15, metalness: 0.3 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 1.28, z);
  G.scene.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 3.6, 10), basin.material);
  pillar.position.set(x, 2.6, z);
  G.scene.add(pillar);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#ffb800', emissive: '#ffb800', emissiveIntensity: 0.7 }),
  );
  orb.position.set(x, 4.9, z);
  G.scene.add(orb);
  G.colliders.push({ x0: x - 7, z0: z - 7, x1: x + 7, z1: z + 7 });
  void mats;
}

// Palms and street lamps as instanced meshes: one draw call each.
function buildPalmsAndLamps(G) {
  const rng = mulberry32(G.seed + 999);
  const palmPts = [];
  for (let z = -556; z <= 436; z += 27) {
    palmPts.push({ x: BOULEVARD_X - 1.1, z: z + (rng() - 0.5) * 3 });
    palmPts.push({ x: BOULEVARD_X + 1.1, z: z + 13 + (rng() - 0.5) * 3 });
  }
  for (let z = -520; z <= 400; z += 39) palmPts.push({ x: 361 + (rng() - 0.5) * 4, z });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    palmPts.push({ x: PLACES.plaza.x + Math.cos(a) * 13, z: PLACES.plaza.z + Math.sin(a) * 13 });
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    palmPts.push({ x: 884 + Math.cos(a) * 62, z: 706 + Math.sin(a) * 62 });
  }
  for (let z = -420; z <= 380; z += 67) palmPts.push({ x: shoreX(z) - 26 - rng() * 8, z });

  const trunkParts = [];
  let bendX = 0;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.CylinderGeometry(0.15 - i * 0.015, 0.19 - i * 0.015, 1.45, 6);
    bendX += i * 0.16;
    trunkParts.push(transformed(seg, bendX, 0.7 + i * 1.32, 0, 0, 0, -0.1 - i * 0.05));
  }
  const trunkGeo = mergeGeometries(trunkParts);
  const frondParts = [];
  for (let k = 0; k < 8; k++) {
    const frond = new THREE.PlaneGeometry(2.5, 0.62, 3, 1);
    const p = frond.attributes.position;
    for (let vi = 0; vi < p.count; vi++) {
      const fx = p.getX(vi) + 1.25;
      p.setX(vi, fx);
      p.setY(vi, p.getY(vi) - Math.pow(fx / 2.5, 2) * 1.15);
    }
    frondParts.push(transformed(frond, 0, 0, 0, (k / 8) * Math.PI * 2, 0, 0));
  }
  const frondGeo = mergeGeometries(frondParts);
  frondGeo.translate(0.62, 5.55, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: '#2f7a4e', roughness: 0.9, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPts.length);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmPts.length);
  const dummy = new THREE.Object3D();
  palmPts.forEach((p, i) => {
    dummy.position.set(p.x, 0.1, p.z);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    const s = 0.85 + rng() * 0.5;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    fronds.setMatrixAt(i, dummy.matrix);
  });
  G.scene.add(trunks);
  G.scene.add(fronds);

  // Lamps: boulevard edges and avenue corners.
  const lampPts = [];
  for (let z = -552; z <= 440; z += 48) {
    lampPts.push({ x: BOULEVARD_X - 13.5, z, dx: 1, dz: 0 });
    lampPts.push({ x: BOULEVARD_X + 13.5, z: z + 24, dx: -1, dz: 0 });
  }
  for (const x of V_ROADS) {
    for (const z of H_ROADS) {
      lampPts.push({ x: x + 8.6, z: z + 8.6, dx: -1, dz: 0 });
      lampPts.push({ x: x - 8.6, z: z - 8.6, dx: 1, dz: 0 });
    }
  }
  const poleGeo = mergeGeometries([
    transformed(new THREE.CylinderGeometry(0.09, 0.14, 6.6, 6), 0, 3.3, 0),
    transformed(new THREE.BoxGeometry(1.7, 0.12, 0.12), 0.8, 6.55, 0),
  ]);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#23262e', roughness: 0.6, metalness: 0.6 });
  G.lampHeadMat = new THREE.MeshStandardMaterial({
    color: '#554a30', emissive: '#ffd9a0', emissiveIntensity: 1.2,
  });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPts.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), G.lampHeadMat, lampPts.length);
  lampPts.forEach((p, i) => {
    const ry = Math.atan2(-p.dz, p.dx);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(p.x, 0, p.z);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x + p.dx * 1.55, 6.5, p.z + p.dz * 1.55);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  G.scene.add(poles);
  G.scene.add(heads);
}

// El Faro Sol: the 110 m sail tower at the boulevard's north end.
function buildFaro(G) {
  const { x, z } = PLACES.faroSol;
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(17, 19, 2, 24),
    new THREE.MeshStandardMaterial({ color: '#8d8578', roughness: 0.9 }),
  );
  base.position.y = 1;
  g.add(base);
  const sail = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 13.5, 106, 16),
    new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.24, metalness: 0.2 }),
  );
  sail.scale.z = 0.34;
  sail.position.y = 55;
  g.add(sail);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 96, 0.5),
    new THREE.MeshStandardMaterial({ color: '#201408', emissive: '#ffb800', emissiveIntensity: 1.4 }),
  );
  stripe.position.set(4.6, 52, 0);
  G.neonMats.push(stripe.material);
  g.add(stripe);
  const ringMat = new THREE.MeshStandardMaterial({ color: '#20060f', emissive: '#ff3d7f', emissiveIntensity: 1.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.55, 8, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 103;
  G.neonMats.push(ringMat);
  g.add(ring);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(), color: '#ff7ab0', transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(34, 34, 1);
  halo.position.y = 103;
  g.add(halo);
  g.position.set(x, 0, z);
  G.scene.add(g);
  G.colliders.push({ x0: x - 15, z0: z - 15, x1: x + 15, z1: z + 15 });
}

// Puente Bahía: white-gold suspension bridge from the port to the peninsula.
function buildBridge(G) {
  const A = { x: 452, z: 522 }, B = { x: 836, z: 684 };
  G.bridge = { ax: A.x, az: A.z, bx: B.x, bz: B.z, deckY: 6 };
  const dx = B.x - A.x, dz = B.z - A.z;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(-dz, dx);
  const g = new THREE.Group();
  g.position.set((A.x + B.x) / 2, 0, (A.z + B.z) / 2);
  g.rotation.y = ang;
  const deckMat = new THREE.MeshStandardMaterial({ color: '#3a3d47', roughness: 0.85 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.35, metalness: 0.7 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#e8e6da', roughness: 0.5 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 13), deckMat);
  deck.position.y = 6;
  g.add(deck);
  for (const side of [-6.2, 6.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.3), goldMat);
    rail.position.set(0, 7, side);
    g.add(rail);
  }
  const cablePts = [];
  for (const t of [0.34, 0.68]) {
    const px = -len / 2 + len * t;
    for (const side of [-5.4, 5.4]) {
      for (const splay of [-2.6, 2.6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 42, 1.5), whiteMat);
        leg.position.set(px + splay * 0.4, 21, side + splay * 0.2);
        leg.rotation.z = -splay * 0.03;
        g.add(leg);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 13), goldMat);
      beam.position.set(px, 40, 0);
      g.add(beam);
      for (let k = -4; k <= 4; k++) {
        if (k === 0) continue;
        cablePts.push(new THREE.Vector3(px, 41, side), new THREE.Vector3(px + k * 21, 6.8, side));
      }
      cablePts.push(new THREE.Vector3(px, 41, side), new THREE.Vector3(px - Math.sign(px) * len * 0.3, 6.8, side));
    }
  }
  const cables = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(cablePts),
    new THREE.LineBasicMaterial({ color: '#f2f4f8' }),
  );
  g.add(cables);
  for (const end of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(72, 1, 13), deckMat);
    ramp.position.set(end * (len / 2 + 33), 3, 0);
    ramp.rotation.z = -end * Math.atan2(6, 72);
    g.add(ramp);
  }
  G.scene.add(g);

  // The peninsula the bridge lands on.
  const pen = new THREE.Mesh(
    new THREE.CylinderGeometry(98, 104, 2, 28),
    new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }),
  );
  pen.position.set(884, -0.6, 706);
  G.scene.add(pen);
}

// Distrito Mirador's elevated road: a pillar-supported deck running
// north-south at x=255, with ramps at both ends — visible over the downtown
// junctions and drivable for anyone who finds the ramps.
function buildElevatedRoad(G) {
  const g = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: '#3a3d47', roughness: 0.85 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#5a5e68', roughness: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 520), deckMat);
  deck.position.set(255, 6, 0);
  g.add(deck);
  for (const side of [-5.2, 5.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 520),
      new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4, metalness: 0.6 }));
    rail.position.set(255 + side, 6.9, 0);
    g.add(rail);
  }
  for (let z = -250; z <= 250; z += 42) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6, 1.6), pillarMat);
    pillar.position.set(255, 3, z);
    g.add(pillar);
  }
  for (const end of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 64), deckMat);
    ramp.position.set(255, 3, end * (260 + 30));
    ramp.rotation.x = end * Math.atan2(6, 64);
    g.add(ramp);
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4.6),
    new THREE.MeshBasicMaterial({ map: signTexture('MIRADOR SKYWAY', '#0d1b2a', '#7df9ff') }),
  );
  sign.position.set(249.2, 8.6, -60);
  sign.rotation.y = -Math.PI / 2;
  g.add(sign);
  G.scene.add(g);
  G.elevatedRoad = { x: 255, z0: -260, z1: 260, deckY: 6 };
}

// Height of the drivable surface: the bridge deck, the elevated road,
// and their ramps; sea-level ground everywhere else.
export function groundHeightAt(G, x, z) {
  const er = G.elevatedRoad;
  if (er && Math.abs(x - er.x) < 6.4) {
    if (z >= er.z0 && z <= er.z1) return er.deckY;
    if (z < er.z0 && z > er.z0 - 68) return er.deckY * (1 - (er.z0 - z) / 68);
    if (z > er.z1 && z < er.z1 + 68) return er.deckY * (1 - (z - er.z1) / 68);
  }
  const b = G.bridge;
  if (!b) return 0;
  const dx = b.bx - b.ax, dz = b.bz - b.az;
  const L2 = dx * dx + dz * dz;
  const t = ((x - b.ax) * dx + (z - b.az) * dz) / L2;
  const px = b.ax + dx * t, pz = b.az + dz * t;
  if (Math.hypot(x - px, z - pz) > 8.5 || t < -0.19 || t > 1.19) return 0;
  if (t < 0) return b.deckY * (1 + t / 0.19);
  if (t > 1) return b.deckY * (1 - (t - 1) / 0.19);
  return b.deckY;
}

// Puerto Caimán: warehouses, container stacks, gantry cranes, piers, crates.
function buildPort(G, mats) {
  const conc = new THREE.MeshStandardMaterial({ color: '#7d7f88', roughness: 0.95 });
  const warehouseMat = new THREE.MeshStandardMaterial({ color: '#66727f', roughness: 0.6, metalness: 0.35 });
  for (const [wx, wz, wr] of [[40, 436, 0], [-90, 505, Math.PI / 2]]) {
    const wh = new THREE.Mesh(new THREE.BoxGeometry(52, 11, 20), warehouseMat);
    wh.position.set(wx, 5.5, wz);
    wh.rotation.y = wr;
    G.scene.add(wh);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 5),
      new THREE.MeshBasicMaterial({ map: signTexture('CAIMÁN FREIGHT', '#10222e', '#7df9ff') }),
    );
    sign.position.set(wx, 8, wz + (wr === 0 ? 10.2 : 0));
    if (wr !== 0) { sign.position.x = wx + 10.2; sign.position.z = wz; sign.rotation.y = Math.PI / 2; }
    G.scene.add(sign);
    G.colliders.push({ x0: wx - 26, z0: wz - 11, x1: wx + 26, z1: wz + 11 });
    void mats;
  }

  const contColors = ['#b83b2a', '#1e4e79', '#eab308'];
  const contMats = contColors.map((c) => new THREE.MeshStandardMaterial({ map: containerTexture(c, 'CAIMÁN'), roughness: 0.7 }));
  const clusters = [
    [120, 482], [152, 482], [120, 512], [196, 478], [228, 478], [196, 508],
    [262, 486], [300, 470], [318, 512], [96, 540], [150, 545], [238, 540],
  ];
  const rng = mulberry32(G.seed + 4242);
  clusters.forEach(([cx, cz], ci) => {
    const stacks = 2 + Math.floor(rng() * 2);
    for (let s = 0; s < stacks; s++) {
      const levels = 1 + Math.floor(rng() * 3);
      for (let l = 0; l < levels; l++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(12.2, 2.9, 2.6), contMats[(ci + s + l) % 3]);
        box.position.set(cx + s * 3.1, 1.45 + l * 2.95, cz + (s % 2) * 1.2);
        box.rotation.y = (s % 2) * 0.06;
        G.scene.add(box);
      }
    }
    G.colliders.push({ x0: cx - 6.5, z0: cz - 2.6, x1: cx + 6.5 + stacks * 3.1, z1: cz + 3.8 });
    G.coverPoints.push(
      { x: cx + 4, z: cz - 5.5 }, { x: cx + 4, z: cz + 6.5 },
      { x: cx - 8.5, z: cz + 1 }, { x: cx + 14 + stacks * 2, z: cz + 1 },
    );
  });

  for (const [gx, gz] of [[150, 460], [302, 540]]) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: '#c8542e', roughness: 0.55, metalness: 0.4 });
    for (const [lx, lz] of [[-9, -5], [9, -5], [-9, 5], [9, 5]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 25, 1.4), legMat);
      leg.position.set(lx, 12.5, lz);
      crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 2.2, 12), legMat);
    beam.position.y = 25.5;
    crane.add(beam);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(40, 1.5, 1.8), legMat);
    boom.position.set(14, 27, 0);
    crane.add(boom);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 3), new THREE.MeshStandardMaterial({ color: '#20303c', roughness: 0.3 }));
    cab.position.set(8, 23.4, 0);
    crane.add(cab);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 13, 4), legMat);
    cable.position.set(22, 19, 0);
    crane.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 2.4), legMat);
    hook.position.set(22, 12.2, 0);
    crane.add(hook);
    crane.position.set(gx, 0, gz);
    G.scene.add(crane);
    G.colliders.push({ x0: gx - 10, z0: gz - 6, x1: gx + 10, z1: gz + 6 });
  }

  for (const pz of [470, 545]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(100, 0.5, 24), conc);
    pier.position.set(430, 0.1, pz);
    G.scene.add(pier);
    for (let px = 388; px <= 472; px += 21) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), conc);
      post.position.set(px, -0.6, pz + 11);
      G.scene.add(post);
    }
  }

  const crateMat = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.8 });
  const crateSpots = [[140, 470], [185, 492], [235, 478], [280, 512], [160, 520], [322, 472], [212, 528]];
  for (const [cx, cz] of crateSpots) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), crateMat);
    mesh.position.set(cx, 0.85, cz);
    mesh.rotation.y = rng() * 0.8;
    G.scene.add(mesh);
    G.crates.push({ mesh, x: cx, z: cz, health: 30, exploded: false });
  }
}

// Taller Diablo: the open-front garage in Barrio Viejo — lift, neon, props.
function buildGarage(G) {
  const grp = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(56, 0.24, 44),
    new THREE.MeshStandardMaterial({ color: '#434854', roughness: 0.28, metalness: 0.8 }),
  );
  floor.position.set(-327, 0.22, 195);
  grp.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#274b4e', roughness: 0.85 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.4, 44), wallMat);
  back.position.set(-354.5, 3.2, 195);
  grp.add(back);
  for (const wz of [172.5, 217.5]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(56, 6.4, 1.2), wallMat);
    wall.position.set(-327, 3.2, wz);
    grp.add(wall);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(58, 0.5, 46), new THREE.MeshStandardMaterial({ color: '#38281e', roughness: 0.9 }));
  roof.position.set(-327, 6.6, 195);
  grp.add(roof);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 44), wallMat);
  beam.position.set(-299.5, 6, 195);
  grp.add(beam);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 4.4),
    new THREE.MeshBasicMaterial({ map: signTexture('TALLER DIABLO', '#062a33', '#00f0ff') }),
  );
  sign.position.set(-298.9, 4.6, 195);
  sign.rotation.y = Math.PI / 2;
  grp.add(sign);
  const innerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 3.6),
    new THREE.MeshBasicMaterial({ map: signTexture('SPRAY & TUNE', '#2a0a1e', '#ff3d7f') }),
  );
  innerSign.position.set(-353.8, 4.4, 195);
  innerSign.rotation.y = Math.PI / 2;
  grp.add(innerSign);

  // Hydraulic lift: base posts plus the platform the car sits on.
  const liftMat = new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4, metalness: 0.6 });
  for (const lz of [192.6, 197.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5), liftMat);
    post.position.set(-332, 1.3, lz);
    grp.add(post);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.28, 2.6), liftMat);
  platform.position.set(-332, 0.45, 195);
  grp.add(platform);
  G.liftPlatform = platform;

  const bench = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 9), new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 }));
  bench.position.set(-352, 0.7, 184);
  grp.add(bench);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 3.4), new THREE.MeshStandardMaterial({ color: '#a3242e', roughness: 0.5, metalness: 0.3 }));
  cabinet.position.set(-352.6, 1.1, 206);
  grp.add(cabinet);
  const tyreMat = new THREE.MeshStandardMaterial({ color: '#14151a', roughness: 0.95 });
  for (const [tx, tz] of [[-348, 214], [-345, 214], [-348, 177]]) {
    for (let i = 0; i < 3; i++) {
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.17, 8, 14), tyreMat);
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(tx, 0.35 + i * 0.34, tz);
      grp.add(tyre);
    }
  }
  for (let i = 0; i < 3; i++) {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.95, 10),
      new THREE.MeshStandardMaterial({ color: ['#1e4e79', '#b83b2a', '#3a3f47'][i], roughness: 0.6 }),
    );
    drum.position.set(-350 + i * 1.1, 0.6, 216 - 2.5);
    grp.add(drum);
  }
  const lampBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#443a20', emissive: '#ffc98a', emissiveIntensity: 3.4 }),
  );
  lampBall.position.set(-332, 5.6, 195);
  grp.add(lampBall);
  const workLight = new THREE.PointLight('#ffc98a', 980, 70, 1.8);
  workLight.position.set(-332, 5.4, 195);
  grp.add(workLight);
  const neonGlow = new THREE.PointLight('#22d3ee', 340, 38, 1.7);
  neonGlow.position.set(-304, 4.4, 195);
  grp.add(neonGlow);
  const fillLight = new THREE.PointLight('#ffd9a8', 620, 48, 1.7);
  fillLight.position.set(-312, 2.6, 186);
  grp.add(fillLight);
  // Warm overhead spot pools light on the car sitting on the lift platform.
  const liftSpot = new THREE.SpotLight('#ffbe78', 2600, 0, 0.62, 0.55, 1.6);
  liftSpot.position.set(-332, 6.1, 195);
  liftSpot.target.position.set(-332, 0.4, 195);
  grp.add(liftSpot);
  grp.add(liftSpot.target);

  G.scene.add(grp);
  G.garage = {
    zone: { x0: -354, z0: 173, x1: -300, z1: 217 },
    liftPos: { x: -332, z: 195 },
    platform,
  };
  G.colliders.push(
    { x0: -356, z0: 172, x1: -352, z1: 218 },
    { x0: -354, z0: 171, x1: -300, z1: 174.5 },
    { x0: -354, z0: 215.5, x1: -300, z1: 219 },
  );
}

// Street furniture: hydrants, bus shelters, benches, umbrellas, the lifeguard
// tower, traffic lights and parked cars.
function buildFurniture(G) {
  const rng = mulberry32(G.seed + 31337);
  const hydrantMat = new THREE.MeshStandardMaterial({ color: '#c22e2e', roughness: 0.55 });
  for (let i = 0; i < 14; i++) {
    const hyd = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.6, 8), hydrantMat);
    body.position.y = 0.3;
    hyd.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), hydrantMat);
    cap.position.y = 0.62;
    hyd.add(cap);
    const vx = V_ROADS[i % V_ROADS.length], hz = H_ROADS[(i * 3) % H_ROADS.length];
    hyd.position.set(vx + 8.8, 0.18, hz + 8.8);
    G.scene.add(hyd);
  }
  const shelterMat = new THREE.MeshStandardMaterial({ color: '#2a2e38', roughness: 0.5, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9fd8e8', roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.4 });
  for (const sz of [-200, 60, 300]) {
    const sh = new THREE.Group();
    const roofS = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 5.4), shelterMat);
    roofS.position.y = 2.5;
    sh.add(roofS);
    const backGlass = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.9), glassMat);
    backGlass.rotation.y = Math.PI / 2;
    backGlass.position.set(-0.7, 1.35, 0);
    sh.add(backGlass);
    const benchS = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 4.4), shelterMat);
    benchS.position.set(-0.3, 0.65, 0);
    sh.add(benchS);
    const adSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.6),
      new THREE.MeshBasicMaterial({ map: signTexture('CORAL FM', '#200a2a', '#00f0ff') }),
    );
    adSign.rotation.y = Math.PI / 2;
    adSign.position.set(0.72, 1.4, 2.2);
    sh.add(adSign);
    sh.position.set(352, 0.1, sz);
    G.scene.add(sh);
  }
  const benchMat = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.55), benchMat);
    seat.position.y = 0.5;
    b.add(seat);
    const backr = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.08), benchMat);
    backr.position.set(0, 0.85, -0.26);
    b.add(backr);
    const a = (i / 10) * Math.PI * 2;
    if (i < 5) b.position.set(PLACES.plaza.x + Math.cos(a) * 10.5, 0.18, PLACES.plaza.z + Math.sin(a) * 10.5);
    else b.position.set(366, 0.1, -300 + i * 70);
    b.rotation.y = rng() * Math.PI;
    G.scene.add(b);
  }
  // Beach umbrellas, instanced cones on poles.
  const umbPts = [];
  for (let z = -420; z <= 400; z += 58) umbPts.push({ x: shoreX(z) - 20 - rng() * 10, z: z + rng() * 16 });
  const umbGeo = mergeGeometries([
    transformed(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5), 0, 1.1, 0),
    transformed(new THREE.ConeGeometry(1.7, 0.55, 8), 0, 2.3, 0),
  ]);
  const umbMats = ['#e86a58', '#4aa3a2', '#ffb800'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  umbMats.forEach((m, mi) => {
    const subset = umbPts.filter((_, i) => i % 3 === mi);
    const inst = new THREE.InstancedMesh(umbGeo, m, subset.length);
    const dummy = new THREE.Object3D();
    subset.forEach((p, i) => {
      dummy.position.set(p.x, 0.05, p.z);
      dummy.rotation.set(0, rng() * 3, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    G.scene.add(inst);
  });
  // Lifeguard tower.
  const tower = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: '#f2f0e8', roughness: 0.7 });
  for (const [lx, lz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), towerMat);
    leg.position.set(lx, 1.7, lz);
    tower.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.1, 3), towerMat);
  cabin.position.y = 4.4;
  tower.add(cabin);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1, 4), new THREE.MeshStandardMaterial({ color: '#c22e2e', roughness: 0.7 }));
  towerRoof.position.y = 6;
  towerRoof.rotation.y = Math.PI / 4;
  tower.add(towerRoof);
  tower.position.set(shoreX(-100) - 16, 0, -100);
  G.scene.add(tower);

  // Traffic lights at the four downtown junctions.
  G.trafficLights = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: '#1d2026', roughness: 0.5, metalness: 0.6 });
  [[0, 0], [130, 0], [0, 130], [130, 130]].forEach(([jx, jz], li) => {
    const tl = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6), poleMat);
    pole.position.y = 2.8;
    tl.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), poleMat);
    arm.position.set(0, 5.5, -1.6);
    tl.add(arm);
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.3), poleMat);
    headBox.position.set(0, 4.9, -3.2);
    tl.add(headBox);
    const mats = {};
    [['r', '#ff2442', 0.32], ['y', '#ffb800', 0], ['g', '#22c55e', -0.32]].forEach(([k, c, dy]) => {
      const m = new THREE.MeshStandardMaterial({ color: '#15161c', emissive: c, emissiveIntensity: 0.2 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), m);
      bulb.position.set(0, 4.9 + dy, -3.38);
      tl.add(bulb);
      mats[k] = m;
    });
    tl.position.set(jx + 8.8, 0.1, jz + 8.8);
    tl.rotation.y = Math.PI * 0.75;
    G.scene.add(tl);
    G.trafficLights.push({ mats, offset: li * 3.4 });
  });

  // Parked cars along the avenues.
  const carColors = ['#c0c4cc', '#7a1f1f', '#1f3a5f', '#c9a227', '#2a2d33', '#4a7a5e', '#e8e4da'];
  const types = ['coupe', 'hatch', 'pickup', 'taxi', 'solara'];
  for (let i = 0; i < 15; i++) {
    const vx = V_ROADS[(i * 2 + 1) % V_ROADS.length];
    const z = -480 + i * 61 + rng() * 20;
    const side = i % 2 === 0 ? 5.6 : -5.6;
    const type = types[Math.floor(rng() * types.length)];
    const mesh = buildVehicleMesh(type, carColors[Math.floor(rng() * carColors.length)]);
    mesh.position.set(vx + side, 0.1, z);
    mesh.rotation.y = side > 0 ? 0 : Math.PI;
    G.scene.add(mesh);
    G.colliders.push({ x0: vx + side - 1.2, z0: z - 2.4, x1: vx + side + 1.2, z1: z + 2.4 });
  }
}

// Build the whole city into G.scene.
export function buildCity(G) {
  G.colliders = [];
  G.facadeMats = [];
  G.neonMats = [];
  G.crates = [];
  G.coverPoints = [];
  const mats = buildMaterials(G);
  buildGroundAndRoads(G, mats);
  buildBlockSlabs(G, mats);
  buildBuildings(G, mats);
  buildPlaza(G, mats);
  buildPalmsAndLamps(G);
  buildFaro(G);
  buildBridge(G);
  buildElevatedRoad(G);
  buildPort(G, mats);
  buildGarage(G);
  buildFurniture(G);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  G.blobShadowProto = shadow;
}
