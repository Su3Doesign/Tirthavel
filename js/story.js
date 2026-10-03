// The Ring Gate — scroll story.
// One day passes over Kaalavalaya while you scroll: dawn behind the Ring, noon on its face,
// a walk through the door, dusk on the far side, and the Hollow Sun sliding into the Ring.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const Q = new URLSearchParams(location.search);
const LITE = Q.has('lite') || matchMedia('(max-width: 700px)').matches;
const FORCE_P = Q.has('p') ? parseFloat(Q.get('p')) : null;          // ?p=0.5 jumps the story (for testing)
const STATIC = Q.has('static');                                       // render a few frames then stop (testing)

const canvas = document.getElementById('gl');
const storyEl = document.getElementById('story');
const beats = [...document.querySelectorAll('.beat')];
const loaderEl = document.getElementById('loader');
const loaderPct = document.getElementById('loader-pct');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  loaderEl?.classList.add('done');
  throw e;
}
// resolution adapts to the machine: starts modest, drops if frames run slow, climbs back when there's headroom
const DPR_CAP = LITE ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 1.25);
let dpr = DPR_CAP;
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = !LITE;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;          // re-rendered only when the sun actually moves
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 40000);
const FOG = new THREE.Color(0xd8c09a);
scene.fog = new THREE.FogExp2(FOG, 0.00016);

// ---------------------------------------------------------------- sky + light
const sky = new Sky();
sky.scale.setScalar(30000);
scene.add(sky);
const SU = sky.material.uniforms;
Object.assign(SU.turbidity, { value: 6 });
SU.rayleigh.value = 1.4;
SU.mieCoefficient.value = 0.0025;
SU.mieDirectionalG.value = 0.72;
SU.cloudCoverage.value = 0.35;
SU.cloudDensity.value = 0.35;
SU.cloudScale.value = 0.00025;
SU.showSunDisc.value = 0;                 // the sun reads through the sky glow and the shafts; the disc blooms out the frame

const sunDir = new THREE.Vector3(0, 0.1, -1).normalize();
const sun = new THREE.DirectionalLight(0xffe0b0, 3.0);
sun.castShadow = !LITE;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 160, bottom: -80, near: 10, far: 1200 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.4;
scene.add(sun, sun.target);
sun.target.position.set(0, 40, 0);
const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x5a4630, 0.35);
scene.add(hemi);

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new Sky();
envSky.scale.setScalar(1000);
envScene.add(envSky);
let envRT = null;
const lastEnv = new THREE.Vector3(9, 9, 9);
function updateEnv(force = false) {
  if (!force && sunDir.distanceTo(lastEnv) < 0.06) return;
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) envSky.material.uniforms[k].value = SU[k].value;
  envSky.material.uniforms.cloudCoverage.value = 0.0;
  envSky.material.uniforms.sunPosition.value.copy(sunDir);
  envRT?.dispose();
  envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.28;
  lastEnv.copy(sunDir);
}

// ---------------------------------------------------------------- textures
const TL = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(file, srgb = true) {
  const t = TL.load('assets/tex/' + file);
  t.flipY = false;                                  // glTF UV convention
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
const T = {
  sand: tex('carved_sandstone_color.jpg'), sandN: tex('carved_sandstone_normal.jpg', false),
  sandR: tex('carved_sandstone_rough.jpg', false), ashlar: tex('ashlar_color.jpg'),
  ashlarN: tex('ashlar_normal.jpg', false), moss: tex('moss_color.jpg'), mossH: tex('moss_height.jpg', false),
  bark: tex('bark_color.jpg'), leaves: tex('leaves_green.png'), ivy: tex('ivy.png'),
  rip: tex('water_normal.jpg', false), foam: tex('water_color.jpg', false),
};

// moss grows on whatever faces the sky, in patches
function mossify(mat, amount) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.mossMap = { value: T.moss };
    sh.uniforms.mossH = { value: T.mossH };
    sh.uniforms.uMoss = { value: amount };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D mossMap; uniform sampler2D mossH; uniform float uMoss;
        varying vec3 vWPos; varying vec3 vWN;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 wn = normalize(vWN);
        vec3 bw = abs(wn); bw /= (bw.x + bw.y + bw.z);
        float brk = texture2D(mossH, vWPos.zy * 0.045).r * bw.x + texture2D(mossH, vWPos.xz * 0.045).r * bw.y
                  + texture2D(mossH, vWPos.xy * 0.045).r * bw.z;
        float up = smoothstep(0.1, 0.8, wn.y);
        float mossM = smoothstep(0.16, 0.5, (up + 0.25) * smoothstep(0.36, 0.62, brk) * uMoss);
        vec3 mossC = texture2D(mossMap, vMapUv * 2.5).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, mossC * 0.85, mossM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.97, mossM);`);
  };
  return mat;
}

const MAT = {
  stone: mossify(new THREE.MeshStandardMaterial({ map: T.sand, normalMap: T.sandN, roughnessMap: T.sandR,
    color: new THREE.Color(0.95, 0.85, 0.74), roughness: 1, normalScale: new THREE.Vector2(1.3, 1.3) }), 1.0),
  stone_light: mossify(new THREE.MeshStandardMaterial({ map: T.ashlar, normalMap: T.ashlarN,
    color: new THREE.Color(0.6, 0.57, 0.52), roughness: 0.9 }), 0.8),
  paving: mossify(new THREE.MeshStandardMaterial({ map: T.ashlar, normalMap: T.ashlarN,
    color: new THREE.Color(0.5, 0.48, 0.45), roughness: 0.9 }), 1.4),
  dark: new THREE.MeshStandardMaterial({ map: T.ashlar, color: new THREE.Color(0.2, 0.19, 0.18), roughness: 0.95 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd2a35c, metalness: 1, roughness: 0.32 }),
  bark: new THREE.MeshStandardMaterial({ map: T.bark, roughness: 0.95 }),
  leaf_green: new THREE.MeshStandardMaterial({ map: T.leaves, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75,
    emissive: 0x31420f, emissiveMap: T.leaves, emissiveIntensity: 0.25 }),
  leaf_ivy: new THREE.MeshStandardMaterial({ map: T.ivy, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75,
    emissive: 0x24360d, emissiveMap: T.ivy, emissiveIntensity: 0.25 }),
};
const OCC_BLACK = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
const OCC_LEAF = (map) => new THREE.MeshBasicMaterial({ color: 0x000000, map, alphaTest: 0.45, side: THREE.DoubleSide, fog: false });

// ---------------------------------------------------------------- the sea
const SEA_Y = -130;
const WAVES = [[0.0, 1.0, 85, 0.9], [-0.42, 0.91, 45, 0.5], [0.42, 0.91, 22, 0.25], [-0.17, 0.98, 10, 0.1]];
const seaMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 }, uSunDir: { value: sunDir }, uSunColor: { value: new THREE.Color(1.0, 0.85, 0.6) },
    uDeep: { value: new THREE.Color(0.006, 0.03, 0.04) }, uLit: { value: new THREE.Color(0.02, 0.14, 0.13) },
    uHorizon: { value: new THREE.Color(0.9, 0.75, 0.55) }, uZenith: { value: new THREE.Color(0.35, 0.5, 0.75) },
    uFogColor: { value: FOG }, uFogDensity: { value: 0.00016 }, tRip: { value: T.rip }, tFoam: { value: T.foam },
    uW: { value: WAVES.map(([x, z, l, a]) => new THREE.Vector4(x, z, l, a)) },
  },
  vertexShader: /* glsl */`
    varying vec3 vW;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform float uTime; uniform vec3 uSunDir, uSunColor, uDeep, uLit, uHorizon, uZenith, uFogColor;
    uniform float uFogDensity; uniform sampler2D tRip, tFoam; uniform vec4 uW[4];
    varying vec3 vW;
    void main() {
      float h = 0.0; vec2 g = vec2(0.0); float amp = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 d = normalize(uW[i].xy); float k = 6.2831853 / uW[i].z; float w = sqrt(9.81 * k);
        float ph = k * dot(d, vW.xz) - w * uTime;
        h += uW[i].w * sin(ph); g += uW[i].w * k * cos(ph) * d; amp += uW[i].w;
      }
      vec2 uv1 = vW.xz / 18.0 + vec2(0.010, 0.020) * uTime;
      vec2 uv2 = vW.xz / 5.5 + vec2(-0.015, 0.030) * uTime;
      vec3 r1 = texture2D(tRip, uv1).xyz * 2.0 - 1.0, r2 = texture2D(tRip, uv2).xyz * 2.0 - 1.0;
      float near = exp(-length(cameraPosition.xz - vW.xz) / 900.0);           // ripples fade with distance (no moire)
      vec3 n = normalize(vec3(-g.x * (0.4 + 0.6 * near) + (r1.x + r2.x) * 0.22 * near, 1.0, -g.y * (0.4 + 0.6 * near) + (r1.y + r2.y) * 0.22 * near));
      vec3 V = normalize(cameraPosition - vW);
      vec3 R = reflect(-V, n);
      float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
      vec3 skyc = mix(uHorizon, uZenith, clamp(R.y * 1.8, 0.0, 1.0));
      float sd = max(dot(R, normalize(uSunDir)), 0.0);
      vec3 col = mix(mix(uDeep, uLit, clamp(h / amp * 0.5 + 0.5, 0.0, 1.0)), skyc, fres);
      col += uSunColor * (pow(sd, 1200.0) * 40.0 + pow(sd, 90.0) * 0.8) * step(0.0, uSunDir.y);
      float foam = smoothstep(0.55, 0.95, h / amp) * texture2D(tFoam, vW.xz / 4.5 + uTime * 0.01).r;
      col = mix(col, vec3(0.82, 0.8, 0.76), clamp(foam * 1.4, 0.0, 1.0));
      float d = length(cameraPosition - vW);
      col = mix(col, uFogColor, 1.0 - exp(-pow(uFogDensity * d, 2.0)));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), seaMat);
sea.rotation.x = -Math.PI / 2;
sea.position.y = SEA_Y;
scene.add(sea);

// ---------------------------------------------------------------- eclipse + the door
const moonDir = new THREE.Vector3();
const moon = new THREE.Mesh(new THREE.CircleGeometry(230, 64),
  new THREE.MeshBasicMaterial({ color: 0x040507, fog: false, transparent: true, opacity: 0 }));
const corona = new THREE.Mesh(new THREE.RingGeometry(228, 760, 128),
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uI, uTime; varying vec2 vP;
      void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
        float f = (exp(-(r - 230.0) / 26.0) + 0.35 * exp(-(r - 230.0) / 140.0)) * (0.75 + 0.25 * sin(a * 9.0 + uTime * 0.6) * sin(a * 23.0 - uTime));
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * f * uI * 70.0, 1.0); }`,
  }));
moon.renderOrder = corona.renderOrder = 2;
scene.add(moon, corona);

const doorShape = new THREE.Shape();
doorShape.moveTo(-11.6, 0); doorShape.lineTo(11.6, 0); doorShape.lineTo(11.6, 52); doorShape.lineTo(-11.6, 52); doorShape.closePath();
const doorMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float uI, uTime; varying vec2 vP;
    float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){ float edge = smoothstep(0.0, 5.0, 11.6 - abs(vP.x)) * smoothstep(0.0, 8.0, 52.0 - vP.y);
      float shimmer = 0.85 + 0.15 * sin(vP.y * 0.12 - uTime * 0.8) * sin(vP.x * 0.21 + uTime * 0.5);
      vec3 c = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.97, 0.88), smoothstep(0.0, 52.0, vP.y));
      gl_FragColor = vec4(c * shimmer * edge * uI * 70.0, 1.0); }`,
});
const door = new THREE.Mesh(new THREE.ShapeGeometry(doorShape), doorMat);
door.position.set(0, 0, -5.5);
scene.add(door);

// ---------------------------------------------------------------- the Ring itself
const gateRoot = new THREE.Group();
scene.add(gateRoot);
const draco = new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/');
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
const manager = THREE.DefaultLoadingManager;
let loaded = false, modelReady = false, texReady = false;
manager.onProgress = (_, a, b) => { if (loaderPct) loaderPct.textContent = Math.round((a / b) * 100) + '%'; };
manager.onLoad = () => { texReady = true; ready(); };
function ready() {
  if (!modelReady || !texReady || loaded) return;
  loaded = true;
  updateEnv(true);
  setTimeout(() => loaderEl?.classList.add('done'), 350);
}

const gateMeshes = [];
gltfLoader.load('assets/model/gate.glb', (g) => {
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const key = o.name.replace(/[._]\d+$/, '');
    const m = MAT[key] || MAT.stone;
    o.material = m;
    o.castShadow = !LITE && !m.alphaTest;        // stone casts; leaves only receive (alpha-tested shadows cost the most)
    o.receiveShadow = !LITE;
    o.userData.mat = m;
    o.userData.occ = m.map && m.alphaTest ? OCC_LEAF(m.map) : OCC_BLACK;
    gateMeshes.push(o);
  });
  gateRoot.add(g.scene);
  modelReady = true;
  ready();
}, undefined, (err) => { console.error(err); loaderEl?.classList.add('done'); });

// ---------------------------------------------------------------- god rays (screen-space light shafts)
const occRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const raysRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
sunDisc.visible = false;
scene.add(sunDisc);
const raysQuad = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tOcc: { value: occRT.texture }, uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uDensity: { value: 0.9 }, uDecay: { value: 0.952 }, uWeight: { value: 0.058 }, uExposure: { value: 1.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tOcc; uniform vec2 uSun; uniform float uDensity, uDecay, uWeight, uExposure; varying vec2 vUv;
    void main(){ vec2 uv = vUv; vec2 dl = (uv - uSun) * (uDensity / 44.0); float il = 1.0; vec3 c = vec3(0.0);
      for (int i = 0; i < 44; i++) { uv -= dl; c += texture2D(tOcc, uv).rgb * il * uWeight; il *= uDecay; }
      gl_FragColor = vec4(c * uExposure, 1.0); }`,
}));
const RayCombine = {
  uniforms: { tDiffuse: { value: null }, tRays: { value: null }, uColor: { value: new THREE.Color(1.0, 0.78, 0.5) }, uI: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse, tRays; uniform vec3 uColor; uniform float uI; varying vec2 vUv;
    void main(){ vec4 b = texture2D(tDiffuse, vUv); vec3 r = texture2D(tRays, vUv).rgb;
      gl_FragColor = vec4(b.rgb + r * uColor * uI, b.a); }`,
};

let composer = null, rayPass = null, bloom = null;
if (!LITE) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  rayPass = new ShaderPass(RayCombine);
  rayPass.uniforms.tRays.value = raysRT.texture;          // render-target textures aren't cloned by ShaderPass
  composer.addPass(rayPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 45.0);      // HDR: only the corona and door bloom
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

const BLACK = new THREE.Color(0x000000);
const sunNdc = new THREE.Vector3();
// returns true when the shafts are worth drawing this frame
function raysVisible() {
  sunNdc.copy(sunDisc.position).project(camera);
  return RAY_I > 0.02 && sunNdc.z < 1 && Math.abs(sunNdc.x) < 1.6 && Math.abs(sunNdc.y) < 1.6;
}
function renderRays() {
  rayPass.uniforms.uI.value = RAY_I;
  raysQuad.material.uniforms.uSun.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
  const bg = scene.background;
  sky.visible = sea.visible = door.visible = corona.visible = false;
  sunDisc.visible = true;
  scene.background = BLACK;
  for (const o of gateMeshes) o.material = o.userData.occ;
  renderer.setRenderTarget(occRT);
  renderer.render(scene, camera);
  for (const o of gateMeshes) o.material = o.userData.mat;
  sky.visible = sea.visible = door.visible = corona.visible = true;
  sunDisc.visible = false;
  scene.background = bg;
  renderer.setRenderTarget(raysRT);
  raysQuad.render(renderer);
  renderer.setRenderTarget(null);
}

// ---------------------------------------------------------------- the camera's day
// [t, camera position, look-at, fov]   (metres; the door's foot is the origin, the Ring faces +z)
const KEYS = [
  [0.00, [0, 40, 1500], [0, 168, 0], 30],
  [0.11, [-210, 85, 560], [0, 72, 0], 33],
  [0.24, [-70, 92, 205], [0, 70, 0], 40],
  [0.36, [9, 64, 44], [0, 62, 0], 32],
  [0.49, [0, 9, 64], [0, 15, -40], 58],
  [0.60, [0, 9, -34], [0, 6, -400], 58],
  [0.71, [55, 34, -215], [0, 64, 0], 44],
  [0.83, [0, 50, -430], [0, 62, 0], 30],
  [0.93, [0, 58, -300], [0, 62, 0], 34],
  [1.00, [260, 330, -700], [0, 40, 0], 38],
];
const camCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');
const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])), false, 'centripetal');
const ease = (x) => x * x * (3 - 2 * x);
function keyParam(p) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [a, b] = [KEYS[i][0], KEYS[i + 1][0]];
    if (p <= b) {
      const s = ease(THREE.MathUtils.clamp((p - a) / (b - a), 0, 1));
      return { u: (i + s) / (KEYS.length - 1), fov: THREE.MathUtils.lerp(KEYS[i][3], KEYS[i + 1][3], s) };
    }
  }
  return { u: 1, fov: KEYS.at(-1)[3] };
}
const band = (p, a, b, f = 0.04) => THREE.MathUtils.clamp(Math.min((p - a) / f, (b - p) / f), 0, 1);

// the sun crosses the sky over the Ring: rises behind it (-z), noon overhead, sets in front (+z)
const AXIS_DIR = new THREE.Vector3(), MOON_OFF = new THREE.Vector3();
let RAY_I = 1;
function dayAt(p) {
  const th = THREE.MathUtils.clamp(p / 0.8, 0, 1) * Math.PI;
  sunDir.set(Math.sin(th) * 0.32, 0.04 + Math.sin(th) * 0.95, -Math.cos(th)).normalize();
  // eclipse: the sun settles exactly behind the Ring as seen from the far side, and the moon slides over it
  const ecl = ease(THREE.MathUtils.clamp((p - 0.8) / 0.12, 0, 1));
  AXIS_DIR.set(0, 62, 0).sub(camera.position).normalize();
  if (ecl > 0) sunDir.lerp(AXIS_DIR, ecl).normalize();
  moonDir.copy(sunDir).add(MOON_OFF.set(0.06, 0.035, 0).multiplyScalar(1 - ecl)).normalize();
  const elev = Math.max(sunDir.y, 0);
  const warm = 1 - THREE.MathUtils.smoothstep(elev, 0.05, 0.6);
  sun.color.setRGB(1, 0.72 + 0.26 * (1 - warm), 0.45 + 0.5 * (1 - warm));
  sun.intensity = (0.5 + 2.1 * THREE.MathUtils.smoothstep(elev, 0.0, 0.3)) * (1 - 0.93 * ecl);
  hemi.intensity = 0.35 * (1 - 0.7 * ecl);
  SU.turbidity.value = 2.5 + 3 * warm;
  SU.rayleigh.value = 1.2 + 1.6 * warm + 1.5 * ecl;
  SU.sunPosition.value.copy(sunDir);
  FOG.setRGB(0.85 - 0.25 * (1 - warm) - 0.6 * ecl, 0.74 - 0.08 * (1 - warm) - 0.55 * ecl, 0.6 + 0.12 * (1 - warm) - 0.45 * ecl);
  seaMat.uniforms.uHorizon.value.copy(FOG).multiplyScalar(1.05);
  seaMat.uniforms.uZenith.value.setRGB(0.3, 0.45 + 0.1 * (1 - warm), 0.72).multiplyScalar(1 - 0.8 * ecl);
  seaMat.uniforms.uSunColor.value.copy(sun.color);
  renderer.toneMappingExposure = 0.42 - 0.16 * ecl + 0.06 * warm;
  corona.material.uniforms.uI.value = ecl;
  doorMat.uniforms.uI.value = ease(THREE.MathUtils.clamp((p - 0.88) / 0.06, 0, 1));
  RAY_I = 0.18 + 0.32 * warm + 1.8 * ecl;
  return ecl;
}

// ---------------------------------------------------------------- loop
let pTarget = 0, pShown = 0;
function readScroll() {
  if (FORCE_P !== null) return FORCE_P;
  const r = storyEl.getBoundingClientRect();
  return THREE.MathUtils.clamp(-r.top / (r.height - innerHeight), 0, 1);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const qw = Math.max(1, Math.round(w * dpr / 4)), qh = Math.max(1, Math.round(h * dpr / 4));
  occRT.setSize(qw, qh);
  raysRT.setSize(qw, qh);
  composer?.setPixelRatio(dpr);
  composer?.setSize(w, h);
}
addEventListener('resize', resize);
resize();

const T0 = performance.now();
let running = true;
new IntersectionObserver(([e]) => { running = e.isIntersecting; }, { rootMargin: '200px' }).observe(storyEl);

let frames = 0, lastT = 0, slow = 0, fast = 0, ema = 16, lastMove = 0, tick = 0;
const lastShadowSun = new THREE.Vector3(9, 9, 9);
let shadowWait = 0;
const beatOp = beats.map(() => -1);
let lastStoryVar = '';
function frame(now) {
  if (STATIC && loaded && frames > 3) { document.documentElement.dataset.rendered = '1'; return; }
  requestAnimationFrame(frame);
  if (!running) { lastT = 0; return; }
  now = now || performance.now();
  pTarget = readScroll();
  const moving = Math.abs(pTarget - pShown) > 0.0004;
  if (moving) lastMove = now;
  // nothing moving for a while: the sea can breathe at 30 fps
  if (!moving && now - lastMove > 1200 && (tick++ & 1)) return;
  if (loaded) frames++;
  // adaptive resolution
  if (lastT && !STATIC && loaded) {
    ema = ema * 0.92 + Math.min(100, now - lastT) * 0.08;
    if (ema > 23) { fast = 0; if (++slow > 40 && dpr > 0.6) { dpr = Math.max(0.6, +(dpr - 0.15).toFixed(2)); slow = 0; resize(); } }
    else if (ema < 14.5) { slow = 0; if (++fast > 240 && dpr < DPR_CAP) { dpr = Math.min(DPR_CAP, +(dpr + 0.1).toFixed(2)); fast = 0; resize(); } }
    else { slow = Math.max(0, slow - 1); fast = 0; }
  }
  lastT = now;
  const t = (now - T0) / 1000;
  pShown += (pTarget - pShown) * (FORCE_P !== null ? 1 : 0.075);
  const p = pShown;
  const { u, fov } = keyParam(p);
  camera.position.copy(camCurve.getPoint(u));          // by keyframe, not arc length: holds on each beat
  camera.lookAt(tgtCurve.getPoint(u));
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  dayAt(p);
  sun.position.copy(sunDir).multiplyScalar(500).add(sun.target.position);
  sunDisc.position.copy(sunDir).multiplyScalar(6000).add(camera.position);
  moon.position.copy(moonDir).multiplyScalar(5990).add(camera.position);
  moon.lookAt(camera.position);
  corona.position.copy(moon.position);
  corona.quaternion.copy(moon.quaternion);
  moon.visible = corona.visible = p > 0.76;
  moon.material.opacity = THREE.MathUtils.smoothstep(p, 0.77, 0.84);
  seaMat.uniforms.uTime.value = t;
  corona.material.uniforms.uTime.value = t;
  doorMat.uniforms.uTime.value = t;
  SU.time.value = t;
  // shadows and the sky reflection are the expensive bits: only when the sun has really moved
  if (renderer.shadowMap.enabled && ++shadowWait >= 3 && sunDir.distanceToSquared(lastShadowSun) > 0.00002) {
    renderer.shadowMap.needsUpdate = true;
    lastShadowSun.copy(sunDir);
    shadowWait = 0;
  }
  if (loaded && now - lastMove > 350) updateEnv();
  for (let i = 0; i < beats.length; i++) {
    const o = +band(p, +beats[i].dataset.a, +beats[i].dataset.b, 0.035).toFixed(3);
    if (o !== beatOp[i]) { beats[i].style.opacity = o; beatOp[i] = o; }
  }
  const sv = p.toFixed(3);
  if (sv !== lastStoryVar) { storyEl.style.setProperty('--story', sv); lastStoryVar = sv; }
  const wantRays = composer && raysVisible();
  const wantBloom = composer && p > 0.74;
  if (wantRays || wantBloom) {
    if (wantRays) renderRays(); else rayPass.uniforms.uI.value = 0;
    rayPass.enabled = !!wantRays;
    bloom.enabled = !!wantBloom;
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
requestAnimationFrame(frame);
window.__ringStory = { setP: (v) => { pTarget = pShown = v; }, get dpr() { return dpr; } };
