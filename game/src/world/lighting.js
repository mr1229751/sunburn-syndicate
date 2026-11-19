// lighting.js — Bahía Coral's light: a gradient sky dome with a sun disc,
// a warm directional sun, hemisphere fill and a per-preset bounce light that
// keeps shaded glass facades from crushing to black. Three presets — Noon,
// Golden Hour, Night — are set by missions, staged scenes and the L hotkey.

import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 horizonColor;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float sunSize;
  void main() {
    float h = clamp(vDir.y, -0.08, 1.0);
    vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
    col = mix(col, topColor, smoothstep(0.18, 0.65, h));
    float d = max(dot(normalize(vDir), normalize(sunDirection)), 0.0);
    col += sunColor * pow(d, 220.0) * 1.6;
    col += sunColor * pow(d, 10.0) * 0.28 * sunSize;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const LIGHTING_PRESETS = {
  noon: {
    sky: ['#3d6fb8', '#7fb2e0', '#cfe8f2'],
    sunColor: '#fff3da', sunIntensity: 2.9, sunElevation: 62, sunAzimuth: 200,
    hemiSky: '#bcd8ff', hemiGround: '#8a7a66', hemiIntensity: 0.95,
    bounceColor: '#cfe4ff', bounceIntensity: 0.55,
    fogColor: '#b8d4e2', fogDensity: 0.00055,
    windowGlow: 0.25, lampGlow: 0.0, exposure: 1.05, sea: '#14708a',
  },
  golden: {
    sky: ['#1b2a59', '#c94b5c', '#ff8a3d'],
    sunColor: '#ffb066', sunIntensity: 2.4, sunElevation: 13, sunAzimuth: 245,
    hemiSky: '#7b6cf6', hemiGround: '#4a2e2b', hemiIntensity: 0.62,
    bounceColor: '#ff9d7a', bounceIntensity: 0.5,
    fogColor: '#e07a5f', fogDensity: 0.0014,
    windowGlow: 1.15, lampGlow: 0.7, exposure: 1.12, sea: '#0e5a6d',
  },
  night: {
    sky: ['#04060f', '#0d1430', '#27355e'],
    sunColor: '#8fb4ff', sunIntensity: 0.5, sunElevation: 38, sunAzimuth: 120,
    hemiSky: '#2c3a6e', hemiGround: '#14101e', hemiIntensity: 0.4,
    bounceColor: '#4a5f9e', bounceIntensity: 0.35,
    fogColor: '#0a0f22', fogDensity: 0.0011,
    windowGlow: 1.9, lampGlow: 1.6, exposure: 1.0, sea: '#08384a',
  },
};

export function sunVector(elevationDeg, azimuthDeg) {
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  );
}

// Build the sky dome and the three-light rig into the scene.
export function createLighting(G) {
  const uniforms = {
    topColor: { value: new THREE.Color('#1b2a59') },
    midColor: { value: new THREE.Color('#c94b5c') },
    horizonColor: { value: new THREE.Color('#ff8a3d') },
    sunDirection: { value: new THREE.Vector3(0, 0.2, -1) },
    sunColor: { value: new THREE.Color('#ffb066') },
    sunSize: { value: 1.0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3200, 24, 16),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    }),
  );
  sky.renderOrder = -10;
  G.scene.add(sky);

  const sun = new THREE.DirectionalLight('#ffb066', 2.4);
  G.scene.add(sun);
  G.scene.add(sun.target);
  const hemi = new THREE.HemisphereLight('#7b6cf6', '#4a2e2b', 0.62);
  G.scene.add(hemi);
  const bounce = new THREE.DirectionalLight('#ff9d7a', 0.5);
  G.scene.add(bounce);
  G.scene.add(bounce.target);

  G.scene.fog = new THREE.FogExp2('#e07a5f', 0.0014);
  G.lighting = { uniforms, sun, hemi, bounce, preset: 'golden' };
  return G.lighting;
}

// Apply one preset by name: sky, sun, fills, fog, window and lamp glow.
export function applyLightingPreset(G, name) {
  const p = LIGHTING_PRESETS[name];
  if (!p) return;
  const L = G.lighting;
  L.preset = name;
  L.uniforms.topColor.value.set(p.sky[0]);
  L.uniforms.midColor.value.set(p.sky[1]);
  L.uniforms.horizonColor.value.set(p.sky[2]);
  L.uniforms.sunColor.value.set(p.sunColor);
  const dir = sunVector(p.sunElevation, p.sunAzimuth);
  L.uniforms.sunDirection.value.copy(dir);
  L.uniforms.sunSize.value = name === 'golden' ? 1.4 : 0.8;

  L.sun.color.set(p.sunColor);
  L.sun.intensity = p.sunIntensity;
  L.sun.position.copy(dir).multiplyScalar(900);
  L.hemi.color.set(p.hemiSky);
  L.hemi.groundColor.set(p.hemiGround);
  L.hemi.intensity = p.hemiIntensity;
  L.bounce.color.set(p.bounceColor);
  L.bounce.intensity = p.bounceIntensity;
  const bounceDir = dir.clone();
  bounceDir.x *= -0.8; bounceDir.z *= -0.8; bounceDir.y = 0.35;
  L.bounce.position.copy(bounceDir).multiplyScalar(700);

  G.scene.fog.color.set(p.fogColor);
  G.scene.fog.density = p.fogDensity;
  G.renderer.toneMappingExposure = p.exposure;
  if (G.seaMat) G.seaMat.color.set(p.sea);
  if (G.facadeMats) for (const m of G.facadeMats) m.emissiveIntensity = p.windowGlow;
  if (G.lampHeadMat) G.lampHeadMat.emissiveIntensity = 0.3 + p.lampGlow * 2.2;
  if (G.neonMats) for (const m of G.neonMats) m.emissiveIntensity = 0.7 + p.lampGlow;
}

// The sun and sky follow the camera so the dome never gets left behind.
export function updateLighting(G) {
  const cam = G.camera.position;
  G.lighting.sun.position.set(
    cam.x + G.lighting.uniforms.sunDirection.value.x * 900,
    G.lighting.uniforms.sunDirection.value.y * 900,
    cam.z + G.lighting.uniforms.sunDirection.value.z * 900,
  );
  G.lighting.sun.target.position.set(cam.x, 0, cam.z);
}
