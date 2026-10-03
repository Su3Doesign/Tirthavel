// "Hold it" — the Ring on my desk. Same gate.glb as the story, as a turntable you can drag around.
// Four looks: clay (how it started), ink (how I check silhouettes), stone, and overgrown (how it ended).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const STATIC = new URLSearchParams(location.search).has('static');      // testing: no turntable spin

const host = document.getElementById('maquette');
if (host) {
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { io.disconnect(); start(); }
  }, { rootMargin: '500px' });
  io.observe(host);
}

// [x, y, z] in metres from the door's foot (the Ring faces +z), the side it faces, and a note
const SPOTS = [
  { p: [0, 62, 7], n: [0, 0, 1], t: 'the Lock', d: 'eight petals. a lotus that grew up inside a rose window. everything turns around it, nobody touches it.' },
  { p: [-30, 88, 6], n: [0, 0, 1], t: '30 spokes', d: 'one per tithi, a lunar day. I counted them twice.' },
  { p: [-64, 92, 6], n: [0, 0, 1], t: '4 bands of knots', d: 'the four ages. Krita at the centre, Kali at the rim. the ivy is on Kali.' },
  { p: [0, 30, 7], n: [0, 0, 1], t: 'the door', d: '23 × 51 m. न प्रवेशः over it. lit from the other side, sometimes.' },
  { p: [0, 168, 0], n: [0, 1, 0.4], t: 'crown + spire', d: 'the tip is 317 m above the sea. it’s the first thing the sun touches.' },
  { p: [84, 66, 0], n: [1, 0, 0.3], t: 'thorns of light', d: 'not in one plane. they tilt in and out, like a crown that doesn’t quite fit.' },
  { p: [52, 3, 8], n: [0.3, 0.2, 1], t: 'the feet', d: 'the Ring goes sixteen metres into the rock. Karna’s wheel, a little.' },
  { p: [0, 62, -7], n: [0, 0, -1], t: 'the back', d: 'nobody sees the back. it’s carved anyway. the Wardens would know.' },
];

function start() {
  const canvas = host.querySelector('canvas');
  const loadEl = host.querySelector('.mq-load');
  const noteEl = host.querySelector('#hot-note');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    loadEl.textContent = 'this one needs WebGL — the photos will have to do.';
    return;
  }
  const small = matchMedia('(max-width: 700px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.25 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 5000);
  const HOME = { pos: new THREE.Vector3(190, 105, 400), tgt: new THREE.Vector3(0, 66, 0) };
  camera.position.copy(HOME.pos);

  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x8a7458, 1.1);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(-260, 420, 300);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -220, right: 220, top: 260, bottom: -200, near: 50, far: 1400 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.5;
  const rim = new THREE.DirectionalLight(0xc8d8ff, 0.7);
  rim.position.set(300, 120, -400);
  scene.add(hemi, key, rim);

  // the desk: a shadow catcher under the model
  const desk = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -139;
  desk.receiveShadow = true;
  scene.add(desk);

  // ------------------------------------------------------------ looks
  const TL = new THREE.TextureLoader();
  const tex = (f, srgb = true) => { const t = TL.load('assets/tex/' + f); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
  let T = null;
  const textures = () => T || (T = {
    sand: tex('carved_sandstone_color.jpg'), sandN: tex('carved_sandstone_normal.jpg', false), sandR: tex('carved_sandstone_rough.jpg', false),
    ashlar: tex('ashlar_color.jpg'), ashlarN: tex('ashlar_normal.jpg', false), moss: tex('moss_color.jpg'), mossH: tex('moss_height.jpg', false),
    bark: tex('bark_color.jpg'), leaves: tex('leaves_green.png'), ivy: tex('ivy.png'),
  });
  function mossify(m, t, amount) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.mossMap = { value: t.moss }; sh.uniforms.mossH = { value: t.mossH }; sh.uniforms.uMoss = { value: amount };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D mossMap, mossH; uniform float uMoss; varying vec3 vWPos; varying vec3 vWN;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 wn = normalize(vWN); vec3 bw = abs(wn); bw /= (bw.x + bw.y + bw.z);
          float brk = texture2D(mossH, vWPos.zy * 0.045).r * bw.x + texture2D(mossH, vWPos.xz * 0.045).r * bw.y + texture2D(mossH, vWPos.xy * 0.045).r * bw.z;
          float mossM = smoothstep(0.16, 0.5, (smoothstep(0.1, 0.8, wn.y) + 0.25) * smoothstep(0.36, 0.62, brk) * uMoss);
          diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(mossMap, vMapUv * 2.5).rgb * 0.85, mossM);`);
    };
    m.customProgramCacheKey = () => 'moss' + amount;
    return m;
  }
  const clay = new THREE.MeshStandardMaterial({ color: 0xe9e0d1, roughness: 0.82 });
  const clayDark = new THREE.MeshStandardMaterial({ color: 0xcfc4b2, roughness: 0.85 });
  // ink: a screen-space line drawing from normals + depth (no CPU work, so switching is instant)
  const normalMat = new THREE.MeshNormalMaterial();
  let inkRT = null;
  const inkQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { tN: { value: null }, tD: { value: null }, uTexel: { value: new THREE.Vector2() }, uNear: { value: camera.near }, uFar: { value: camera.far } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `#include <packing>
      uniform sampler2D tN, tD; uniform vec2 uTexel; uniform float uNear, uFar; varying vec2 vUv;
      float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tD, uv).x, uNear, uFar); }
      void main(){
        vec4 n0 = texture2D(tN, vUv); float d0 = vz(vUv), e = 0.0;
        const vec2 OFF[8] = vec2[8](vec2(-1.0, -1.0), vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 0.0), vec2(1.0, 0.0), vec2(-1.0, 1.0), vec2(0.0, 1.0), vec2(1.0, 1.0));
        for (int i = 0; i < 8; i++) {
          vec4 n = texture2D(tN, vUv + OFF[i] * uTexel);
          e += length(n.rgb - n0.rgb) * 0.9 + abs(n.a - n0.a) * 2.0;
        }
        for (int i = 0; i < 4; i++) {     // depth creases: second difference, so sloped surfaces stay clean
          vec2 o = OFF[i + 4] * uTexel;
          float a = texture2D(tN, vUv + o).a * texture2D(tN, vUv - o).a * n0.a;
          e += min(abs(vz(vUv + o) + vz(vUv - o) - 2.0 * d0) / max(d0, 1.0) * 220.0, 2.0) * a;
        }
        float ink = smoothstep(0.55, 1.6, e);
        vec3 nn = normalize(n0.rgb * 2.0 - 1.0);
        float tone = 0.9 + 0.1 * dot(nn, normalize(vec3(-0.45, 0.6, 0.65)));
        vec3 col = mix(vec3(0.965, 0.935, 0.875) * tone, vec3(0.137, 0.204, 0.341), ink);
        float a = max(n0.a, ink);
        gl_FragColor = vec4(col * a, a);
      }`,
  }));
  inkQuad.material.blending = THREE.CustomBlending;
  inkQuad.material.blendSrc = THREE.OneFactor;
  inkQuad.material.blendDst = THREE.OneMinusSrcAlphaFactor;
  function renderInk() {
    const pr = renderer.getPixelRatio(), w = Math.round(W * pr), h = Math.round(H * pr);
    if (!inkRT || inkRT.width !== w || inkRT.height !== h) {
      inkRT?.dispose();
      inkRT = new THREE.WebGLRenderTarget(w, h, { depthTexture: new THREE.DepthTexture(w, h) });
      inkQuad.material.uniforms.tN.value = inkRT.texture;
      inkQuad.material.uniforms.tD.value = inkRT.depthTexture;
    }
    inkQuad.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    scene.overrideMaterial = normalMat;
    desk.visible = false;
    renderer.setRenderTarget(inkRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    desk.visible = true;
    renderer.setRenderTarget(null);
    renderer.clear();
    inkQuad.render(renderer);
  }
  let stoneMats = null, wildMats = null;
  const makeStone = (moss) => {
    const t = textures();
    const m = {
      stone: new THREE.MeshStandardMaterial({ map: t.sand, normalMap: t.sandN, roughnessMap: t.sandR, color: new THREE.Color(0.95, 0.85, 0.74), roughness: 1, normalScale: new THREE.Vector2(1.3, 1.3) }),
      stone_light: new THREE.MeshStandardMaterial({ map: t.ashlar, normalMap: t.ashlarN, color: new THREE.Color(0.62, 0.59, 0.54), roughness: 0.9 }),
      paving: new THREE.MeshStandardMaterial({ map: t.ashlar, normalMap: t.ashlarN, color: new THREE.Color(0.52, 0.5, 0.47), roughness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ map: t.ashlar, color: new THREE.Color(0.22, 0.21, 0.2), roughness: 0.95 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd2a35c, metalness: 1, roughness: 0.32 }),
      bark: new THREE.MeshStandardMaterial({ map: t.bark, roughness: 0.95 }),
      leaf_green: new THREE.MeshStandardMaterial({ map: t.leaves, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }),
      leaf_ivy: new THREE.MeshStandardMaterial({ map: t.ivy, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }),
    };
    if (moss) { mossify(m.stone, t, 1.0); mossify(m.stone_light, t, 0.8); mossify(m.paving, t, 1.4); }
    return m;
  };

  const meshes = [];
  let mode = 'clay';
  const LEAFY = new Set(['leaf_green', 'leaf_ivy', 'bark']);
  function setMode(m) {
    mode = m;
    if (m === 'stone' && !stoneMats) stoneMats = makeStone(false);
    if (m === 'wild' && !wildMats) wildMats = makeStone(true);
    for (const o of meshes) {
      const k = o.userData.key;
      if (m === 'clay') { o.material = k === 'dark' ? clayDark : clay; o.visible = !LEAFY.has(k); }
      else if (m === 'ink') { o.material = clay; o.visible = !LEAFY.has(k); }
      else if (m === 'stone') { o.material = stoneMats[k] || stoneMats.stone; o.visible = !LEAFY.has(k); }
      else { o.material = wildMats[k] || wildMats.stone; o.visible = true; }
      o.castShadow = m !== 'ink';
      o.customDepthMaterial = (m === 'wild' && o.material.alphaTest) ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: o.material.map, alphaTest: 0.45 }) : undefined;
    }
    desk.material.opacity = 0.18;
    host.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    dirty = 3;
  }

  // ------------------------------------------------------------ controls + hotspots
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.tgt);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.66;
  controls.autoRotate = !STATIC;
  controls.autoRotateSpeed = 0.55;
  controls.update();

  let idleT = 0, dirty = 3, tween = null, active = -1;
  controls.addEventListener('start', () => { controls.autoRotate = false; tween = null; idleT = performance.now(); });
  controls.addEventListener('end', () => { idleT = performance.now(); });
  controls.addEventListener('change', () => { dirty = 2; });

  const spots = SPOTS.map((s, i) => {
    const b = document.createElement('button');
    b.className = 'hs';
    b.textContent = String(i + 1);
    b.setAttribute('aria-label', s.t);
    b.addEventListener('click', (e) => { e.stopPropagation(); focus(i); });
    host.appendChild(b);
    return { ...s, el: b, v: new THREE.Vector3(...s.p), nv: new THREE.Vector3(...s.n).normalize() };
  });
  function focus(i) {
    if (active === i) { active = -1; noteEl.classList.remove('on'); spots.forEach((s) => s.el.classList.remove('on')); goTo(HOME.pos, HOME.tgt); return; }
    active = i;
    const s = spots[i];
    noteEl.innerHTML = `<b>${i + 1} · ${s.t}</b>${s.d}`;
    noteEl.classList.add('on');
    spots.forEach((o, k) => o.el.classList.toggle('on', k === i));
    const dist = i === 4 ? 230 : 190;
    const side = new THREE.Vector3(0.45, 0.18, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(s.nv.x, s.nv.z));
    const pos = s.v.clone().addScaledVector(s.nv.clone().add(side).normalize(), dist);
    pos.y = Math.max(pos.y, -60);
    goTo(pos, s.v);
  }
  function goTo(pos, tgt) {
    controls.autoRotate = false;
    tween = { t0: performance.now(), dur: 1400, p0: camera.position.clone(), p1: pos.clone(), q0: controls.target.clone(), q1: tgt.clone() };
    idleT = performance.now() + 6000;
  }
  host.addEventListener('click', (e) => { if (e.target === canvas && active >= 0) focus(active); });
  host.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setMode(b.dataset.mode); }));

  // ------------------------------------------------------------ load
  const draco = new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/');
  new GLTFLoader().setDRACOLoader(draco).load('assets/model/gate.glb', (g) => {
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.key = o.name.replace(/[._]\d+$/, '');
      o.receiveShadow = true;
      meshes.push(o);
    });
    scene.add(g.scene);
    setMode('clay');
    loadEl.remove();
    dirty = 3;
  }, (e) => { if (e.total) loadEl.textContent = `getting the clay out… ${Math.round((e.loaded / e.total) * 100)}%`; },
  () => { loadEl.textContent = 'the model didn’t load. the photos will have to do.'; });

  // ------------------------------------------------------------ loop (only while on screen)
  let visible = true, W = 0, H = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { dirty = 3; requestAnimationFrame(loop); } }).observe(host);
  const v = new THREE.Vector3(), toCam = new THREE.Vector3();
  function resize() {
    W = host.clientWidth; H = host.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 1 ? 42 : 30;
    camera.updateProjectionMatrix();
    dirty = 3;
  }
  addEventListener('resize', resize);
  resize();
  function loop(now) {
    if (!visible) return;
    requestAnimationFrame(loop);
    now = now || performance.now();
    if (tween) {
      const f = Math.min(1, (now - tween.t0) / tween.dur), e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.q0, tween.q1, e);
      dirty = 2;
      if (f >= 1) tween = null;
    }
    if (!STATIC && !controls.autoRotate && !tween && active < 0 && now - idleT > 7000) controls.autoRotate = true;
    controls.update();
    if (controls.autoRotate) dirty = Math.max(dirty, 1);
    if (dirty <= 0) return;
    dirty--;
    if (mode === 'ink') renderInk(); else renderer.render(scene, camera);
    for (const s of spots) {
      v.copy(s.v).project(camera);
      toCam.copy(camera.position).sub(s.v).normalize();
      const facing = toCam.dot(s.nv) > 0.12;
      s.el.classList.toggle('hidden', !facing || v.z > 1);
      s.el.style.setProperty('--x', `${((v.x + 1) / 2) * W}px`);
      s.el.style.setProperty('--y', `${((1 - v.y) / 2) * H}px`);
    }
  }
  requestAnimationFrame(loop);
}
