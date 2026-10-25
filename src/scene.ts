import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createGrass, type Grass } from './grass';
import type { SunState } from './sun';
import { pbr, planarUV, scaleBoxUV, type TextureId } from './textures';
import type { Parcel, PlotData, PlotObject, Vec2 } from './types';

// Крупные пятна цвета по мировым координатам ломают повтор плитки на большой земле
function withMacroVariation(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float macro = vnoise(vWPos.xz * 0.045) * 0.6 + vnoise(vWPos.xz * 0.3) * 0.4;
        diffuseColor.rgb *= mix(0.7, 1.2, macro);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 0.92, 0.66), smoothstep(0.55, 0.85, vnoise(vWPos.xz * 0.11 + 7.0)) * 0.55);`,
      );
  };
  return material;
}

type FenceKind = 'zinc' | 'painted' | 'planks' | 'rust';
interface FenceStyle {
  kind: FenceKind;
  color: string;
}

const fenceTexture = (kind: FenceKind): TextureId =>
  kind === 'planks' ? 'brown_planks_03' : kind === 'rust' ? 'asbestos_sheet' : 'corrugated_iron';

/** Проём в стороне забора: от from до to метров от начала стороны (под ворота). */
interface Gap {
  edge: number;
  from: number;
  to: number;
}

function fence(points: Vec2[], height: number, styles: FenceStyle[], skip?: (a: Vec2, b: Vec2) => boolean, gaps: Gap[] = []) {
  const g = new THREE.Group();
  const parts = styles.map((s) => {
    const id = fenceTexture(s.kind);
    return { id, material: pbr(id, { color: s.color }) };
  });
  const postGeo = new THREE.BoxGeometry(0.1, height + 0.25, 0.1);
  const postMat = new THREE.MeshStandardMaterial({ color: '#4b4137', roughness: 0.9 });
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    if (skip?.(a, b)) return;
    const { id, material } = parts[i % parts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    // Участки стороны между проёмами
    const cuts = gaps.filter((p) => p.edge === i).sort((p, q) => p.from - q.from);
    const spans: [number, number][] = [];
    let at = 0;
    for (const cut of cuts) {
      spans.push([at, cut.from]);
      at = Math.max(at, cut.to);
    }
    spans.push([at, len]);
    for (const [from, to] of spans) {
      const span = to - from;
      if (span < 0.05) continue;
      const geo = new THREE.BoxGeometry(span, height, 0.05);
      scaleBoxUV(geo, span, height, 0.05, id);
      const panel = new THREE.Mesh(geo, material);
      const mid = (from + to) / 2;
      panel.position.set(a[0] + ux * mid, height / 2, a[1] + uz * mid);
      panel.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      panel.castShadow = panel.receiveShadow = true;
      g.add(panel);
      const n = Math.max(1, Math.round(span / 2.5));
      for (let j = 0; j <= n; j++) {
        const post = new THREE.Mesh(postGeo, postMat);
        const d = from + (span * j) / n;
        post.position.set(a[0] + ux * d, (height + 0.25) / 2, a[1] + uz * d);
        post.castShadow = true;
        g.add(post);
      }
    }
  });
  return g;
}

const distToSegment = ([px, pz]: Vec2, [ax, az]: Vec2, [bx, bz]: Vec2) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** Проёмы в нашем заборе там, где на границе стоят ворота. */
function gateGaps(objects: PlotObject[], poly: Vec2[]): Gap[] {
  const gaps: Gap[] = [];
  for (const o of objects) {
    if (o.type !== 'gate' || o.keep === false) continue;
    poly.forEach((a, edge) => {
      const b = poly[(edge + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t = ((o.x - a[0]) * (b[0] - a[0]) + (o.z - a[1]) * (b[1] - a[1])) / len;
      if (distToSegment([o.x, o.z], a, b) < 1 && t > 0 && t < len) {
        gaps.push({ edge, from: Math.max(0, t - o.width / 2), to: Math.min(len, t + o.width / 2) });
      }
    });
  }
  return gaps;
}

const OWN_FENCE: FenceStyle[] = [
  { kind: 'zinc', color: '#a9aea8' },
  { kind: 'painted', color: '#6f9a7d' },
  { kind: 'zinc', color: '#a9aea8' },
  { kind: 'planks', color: '#a9c49c' },
];

const NEIGHBOR_FENCES: FenceStyle[][] = [
  [{ kind: 'zinc', color: '#a9aea8' }],
  [{ kind: 'planks', color: '#c9bba3' }],
  [{ kind: 'painted', color: '#6f9a7d' }],
  [{ kind: 'rust', color: '#ffffff' }],
  [{ kind: 'painted', color: '#9a6a52' }],
];

function neighborParcels(parcels: Parcel[], own: Vec2[]): THREE.Group {
  const g = new THREE.Group();
  const lawn = ['#ffffff', '#f1efd6', '#e4edc6', '#f3e4c2', '#dce6bd'];
  const drawn: Vec2[] = [];
  // Общие стороны не дублируют ни наш забор, ни забор соседнего участка
  const skip = (a: Vec2, b: Vec2) => {
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const shared =
      own.some((p, i) => distToSegment(mid, p, own[(i + 1) % own.length]) < 0.5) ||
      drawn.some((d) => Math.hypot(d[0] - mid[0], d[1] - mid[1]) < 0.5);
    if (!shared) drawn.push(mid);
    return shared;
  };
  parcels.forEach((p, i) => {
    // Каждый третий участок — вскопанные грядки
    const id: TextureId = i % 3 === 1 ? 'brown_mud_dry' : 'grass_ground';
    const geo = new THREE.ShapeGeometry(new THREE.Shape(p.points.map(([x, z]) => new THREE.Vector2(x, -z))));
    planarUV(geo, id);
    const floor = new THREE.Mesh(geo, withMacroVariation(pbr(id, { color: id === 'grass_ground' ? lawn[i % lawn.length] : '#bba68a' })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.005;
    floor.receiveShadow = true;
    g.add(floor, fence(p.points, 1.6, NEIGHBOR_FENCES[i % NEIGHBOR_FENCES.length], skip));
  });
  return g;
}

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  grass: Grass;
  /** Пересобрать свой забор с проёмами под ворота. */
  setGates(objects: PlotObject[]): void;
  /** Поставить солнце, небо, свет окружения, туман и экспозицию. */
  applySun(sun: SunState): void;
}

const CAMERA_KEY = 'uchastok:camera';

function configureSky(sky: Sky) {
  const u = sky.material.uniforms;
  u.turbidity.value = 6;
  u.rayleigh.value = 1.5;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
}

const NIGHT = new THREE.Color('#0b1020');
const DAY = new THREE.Color('#b7cde3');
const DUSK = new THREE.Color('#e3b891');
const WARM = new THREE.Color('#ffb27a');
const WHITE = new THREE.Color('#fff3e0');

export function createWorld(plot: PlotData, cameraKey = CAMERA_KEY): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.34;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(DAY, 0.0022);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 15000);

  const xs = plot.boundary.points.map((p) => p[0]);
  const zs = plot.boundary.points.map((p) => p[1]);
  const center = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
  const radius = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 25;

  const sky = new Sky();
  sky.scale.setScalar(10000);
  configureSky(sky);
  scene.add(sky);

  // Небо отдельной копией для света окружения: в нём нет построек
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(100);
  configureSky(envSky);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget: THREE.WebGLRenderTarget | undefined;

  const groundGeo = new THREE.PlaneGeometry(1000, 1000);
  planarUV(groundGeo, 'grass_ground');
  const ground = new THREE.Mesh(groundGeo, withMacroVariation(pbr('grass_ground', { color: '#d9e0bd' })));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const floorGeo = new THREE.ShapeGeometry(new THREE.Shape(plot.boundary.points.map(([x, z]) => new THREE.Vector2(x, -z))));
  planarUV(floorGeo, 'grass_ground');
  const floor = new THREE.Mesh(floorGeo, withMacroVariation(pbr('grass_ground', { color: '#8c9d68' })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  // Свой забор пересобирается при движении ворот
  const ownFence = new THREE.Group();
  scene.add(ownFence);
  function setGates(objects: PlotObject[]) {
    ownFence.traverse((c) => {
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
    });
    ownFence.clear();
    ownFence.add(fence(plot.boundary.points, plot.boundary.fenceHeight, OWN_FENCE, undefined, gateGaps(objects, plot.boundary.points)));
  }
  setGates(plot.objects);
  scene.add(neighborParcels(plot.parcels ?? [], plot.boundary.points));

  const grass = createGrass(plot);
  scene.add(grass.mesh);

  const sun = new THREE.DirectionalLight('#fff3e0', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -radius;
  cam.right = cam.top = radius;
  cam.near = 1;
  cam.far = 500;
  sun.target.position.copy(center);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight('#8fa6d6', '#4a4a3a', 0.4);
  scene.add(hemi);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 3;
  controls.maxDistance = 300;
  controls.target.copy(center);
  camera.position.set(center.x, 35, center.z + 45);

  // Правки data/plot.json перезагружают страницу: помним вид камеры
  try {
    const saved = JSON.parse(sessionStorage.getItem(cameraKey) ?? 'null');
    if (saved) {
      camera.position.fromArray(saved.position);
      controls.target.fromArray(saved.target);
    }
  } catch { /* вид по умолчанию */ }
  controls.addEventListener('change', () => {
    try {
      sessionStorage.setItem(cameraKey, JSON.stringify({
        position: camera.position.toArray(),
        target: controls.target.toArray(),
      }));
    } catch { /* без сохранения */ }
  });
  controls.update();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function applySun(s: SunState) {
    const alt = s.altitudeDeg;
    const up = THREE.MathUtils.clamp(Math.sin(THREE.MathUtils.degToRad(alt)) * 4, 0, 1);
    sun.position.copy(center).addScaledVector(s.direction, 200);
    sun.intensity = 3.4 * up;
    sun.visible = up > 0;
    sun.color.lerpColors(WARM, WHITE, THREE.MathUtils.clamp(alt / 25, 0, 1));
    // Ночью слабый холодный свет вместо чёрного экрана
    hemi.intensity = 0.4 - 0.28 * up;
    // Автоэкспозиция: ночью глаз привыкает к темноте
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.6, 0.42, THREE.MathUtils.clamp((alt + 4) / 14, 0, 1));

    sky.material.uniforms.sunPosition.value.copy(s.direction);
    envSky.material.uniforms.sunPosition.value.copy(s.direction);
    envTarget?.dispose();
    envTarget = pmrem.fromScene(envScene, 0, 0.1, 1000);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.05 + 0.3 * up;

    const day = THREE.MathUtils.clamp((alt + 8) / 20, 0, 1);
    fog.color
      .copy(NIGHT)
      .lerp(DAY, day)
      .lerp(DUSK, THREE.MathUtils.clamp(1 - Math.abs(alt - 3) / 8, 0, 1) * 0.5);
  }

  return { renderer, scene, camera, controls, grass, applySun, setGates };
}
