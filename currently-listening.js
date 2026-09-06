import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const TRACKS = [
  {
    id: "orr-evening",
    title: "ORR Evening",
    artist: "Desk mix",
    src: "audio/listening/orr-evening.m4a",
    colors: ["#2b1d14", "#e08a3c"],
    mark: "O"
  },
  {
    id: "virtus-rain",
    title: "Virtus after rain",
    artist: "Desk mix",
    src: "audio/listening/virtus-rain.m4a",
    colors: ["#1c2430", "#7f9ab8"],
    mark: "V"
  },
  {
    id: "edit-night",
    title: "Edit night",
    artist: "Desk mix",
    src: "audio/listening/edit-night.m4a",
    colors: ["#1a1420", "#c47cff"],
    mark: "E"
  },
  {
    id: "sakleshpur-morning",
    title: "Sakleshpur morning",
    artist: "Desk mix",
    src: "audio/listening/sakleshpur-morning.m4a",
    colors: ["#1d2a18", "#d6b25a"],
    mark: "S"
  },
  {
    id: "sunday-pan",
    title: "Sunday pan",
    artist: "Desk mix",
    src: "audio/listening/sunday-pan.m4a",
    colors: ["#2a1812", "#e26a4a"],
    mark: "P"
  }
];

const HILL_R = 8.6;
const HILL_Y = 0.36;
const COVER = 0.58;
const COVER_GAP = 0.7;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = window.matchMedia("(max-width: 720px)").matches || navigator.maxTouchPoints > 1;

const canvas = document.querySelector("#listen-canvas");
const fallback = document.querySelector(".listen-fallback");
const hud = document.querySelector("#listen-hud");
const playButton = document.querySelector("#listen-play");
const titleEl = document.querySelector("#listen-title");
const artistEl = document.querySelector("#listen-artist");
const stage = document.querySelector("#listen-stage");

if (!canvas || !window.WebGLRenderingContext) {
  if (fallback) fallback.hidden = false;
}

const audio = new Audio();
audio.loop = true;
audio.preload = "auto";
audio.crossOrigin = "anonymous";

let current = 0;
let playing = false;
let analyser = null;
let freqData = null;
let audioCtx = null;
let emitWait = 0;
let pointer = { x: 0, y: 0, downY: 0, dragging: false };
const coverMeshes = [];
const ripples = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const hudWorld = new THREE.Vector3();
const _size = new THREE.Vector2();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !coarse,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = !coarse;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x62b4eb, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8ec8f0, 16, 36);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(0, 0.92, 5.85);

const sun = new THREE.DirectionalLight(0xfff6e8, 2.6);
sun.position.set(-3.2, 6.8, 4.4);
sun.castShadow = !coarse;
if (sun.castShadow) {
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -2;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0008;
}
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe7f3ff, 0.95);
fill.position.set(3.4, 3.8, 6.2);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xb9d8f5, 0x3f7a36, 1.05));
scene.add(new THREE.AmbientLight(0xd7e8f6, 0.55));

const playGlow = new THREE.PointLight(0xffffff, 0.12, 4.5, 1.6);
playGlow.position.set(0, 1.05, 0.4);
scene.add(playGlow);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  toneMapped: false,
  uniforms: {},
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vDir;
    void main() {
      float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 top = vec3(0.31, 0.64, 0.90);
      vec3 mid = vec3(0.47, 0.75, 0.94);
      vec3 hor = vec3(0.74, 0.88, 0.97);
      vec3 col = mix(hor, mid, smoothstep(0.38, 0.62, h));
      col = mix(col, top, smoothstep(0.58, 0.95, h));
      gl_FragColor = vec4(col, 1.0);
    }
  `
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(36, 32, 24), skyMat));

const hill = new THREE.Mesh(
  new THREE.SphereGeometry(HILL_R, 80, 52),
  new THREE.MeshStandardMaterial({
    color: 0x3a8f40,
    roughness: 1,
    metalness: 0
  })
);
hill.scale.y = HILL_Y;
hill.position.y = -HILL_R * HILL_Y + 0.015;
hill.receiveShadow = true;
scene.add(hill);

const grass = makeGrass();
scene.add(grass);

const speakers = [makeSpeaker(-1), makeSpeaker(1)];
speakers.forEach((speaker) => scene.add(speaker));

const glow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.1, 2.8),
  new THREE.MeshBasicMaterial({
    map: makeGlow(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false
  })
);
glow.position.set(0, 1.02, -0.18);
scene.add(glow);

const covers = new THREE.Group();
covers.position.set(0, 1.02, 0.06);
scene.add(covers);
TRACKS.forEach((track, index) => {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(COVER, COVER),
    new THREE.MeshBasicMaterial({
      map: makeCover(track),
      transparent: true,
      toneMapped: false
    })
  );
  mesh.userData.index = index;
  mesh.castShadow = true;
  covers.add(mesh);
  coverMeshes.push(mesh);
});

const seeds = makeSeeds();
scene.add(seeds);

layoutCovers(1);
syncHud();
paintMeta();

function makeGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.32, "rgba(230,244,255,0.28)");
  grad.addColorStop(1, "rgba(200,230,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function makeCover(track) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(40, 0, 480, 520);
  grad.addColorStop(0, track.colors[0]);
  grad.addColorStop(1, track.colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(360, 150, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,244,220,0.92)";
  ctx.font = "220px 'Momo Trust Display', Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(track.mark, 256, 268);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBladeGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 6);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) + 0.5;
    pos.setX(i, pos.getX(i) * (1 - y * 0.78));
  }
  geometry.translate(0, 0.5, 0);
  geometry.scale(0.018, 0.3, 1);
  return geometry;
}

function makeGrass() {
  const count = reduceMotion ? 5000 : coarse ? 14000 : 36000;
  const blade = makeBladeGeometry();
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uBase: { value: new THREE.Color(0.18, 0.44, 0.16) },
      uMid: { value: new THREE.Color(0.34, 0.62, 0.24) },
      uTip: { value: new THREE.Color(0.52, 0.76, 0.36) }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uMotion;
      attribute float aShade;
      varying float vH;
      varying float vShade;
      void main() {
        vH = uv.y;
        vShade = aShade;
        vec3 pos = position;
        vec4 origin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float wind = sin(uTime * 1.05 + origin.x * 1.8 + origin.z * 1.4);
        float gust = sin(uTime * 0.24 + origin.x * 0.28 + origin.z * 0.18);
        pos.x += (wind * 0.1 + gust * 0.07) * pos.y * pos.y * uMotion;
        vec4 world = modelMatrix * instanceMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uBase;
      uniform vec3 uMid;
      uniform vec3 uTip;
      varying float vH;
      varying float vShade;
      void main() {
        vec3 col = mix(uBase, uMid, smoothstep(0.05, 0.58, vH));
        col = mix(col, uTip, smoothstep(0.5, 1.0, vH) * 0.7);
        float lit = 0.72 + vShade * 0.34;
        col *= lit;
        col += vec3(0.12, 0.16, 0.04) * smoothstep(0.65, 1.0, vH);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const mesh = new THREE.InstancedMesh(blade, material, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const shades = new Float32Array(count);
  let written = 0;
  let guard = 0;
  while (written < count && guard < count * 8) {
    guard += 1;
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(1 - v * 0.6);
    const x = HILL_R * Math.sin(phi) * Math.cos(theta);
    const y = HILL_R * Math.cos(phi);
    const z = HILL_R * Math.sin(phi) * Math.sin(theta);
    if (z > 2.6 && Math.random() > 0.4) continue;
    dummy.position.set(x, y * HILL_Y + hill.position.y, z);
    normal.set(x, y / HILL_Y, z).normalize();
    dummy.quaternion.setFromUnitVectors(up, normal);
    dummy.rotateY(Math.random() * Math.PI * 2);
    dummy.rotateX((Math.random() - 0.5) * 0.22);
    const h = 0.7 + Math.random() * 0.45;
    dummy.scale.set(0.75 + Math.random() * 0.55, h, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(written, dummy.matrix);
    shades[written] = 0.75 + Math.random() * 0.35;
    written += 1;
  }
  mesh.count = written;
  blade.setAttribute("aShade", new THREE.InstancedBufferAttribute(shades.subarray(0, written), 1));
  return mesh;
}

function makeSpeaker(side) {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({
    color: 0xf6f3ea,
    roughness: 0.36,
    metalness: 0.03
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x161616,
    roughness: 0.62,
    metalness: 0.18
  });
  const cone = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.86,
    metalness: 0.05
  });
  const ring = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.35,
    metalness: 0.4
  });

  const body = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.78, 0.36, 3, 0.045), white);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const baffle = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.7), white);
  baffle.position.z = 0.181;
  group.add(baffle);

  const woofer = new THREE.Mesh(new THREE.CircleGeometry(0.148, 48), cone);
  woofer.position.set(0, -0.13, 0.184);
  group.add(woofer);
  const wooferRing = new THREE.Mesh(new THREE.RingGeometry(0.148, 0.168, 48), ring);
  wooferRing.position.copy(woofer.position).setZ(0.186);
  group.add(wooferRing);
  const dust = new THREE.Mesh(new THREE.CircleGeometry(0.034, 24), black);
  dust.position.set(0, -0.13, 0.187);
  group.add(dust);

  const tweeter = new THREE.Mesh(new THREE.CircleGeometry(0.048, 32), cone);
  tweeter.position.set(0, 0.22, 0.184);
  group.add(tweeter);
  const tweeterRing = new THREE.Mesh(new THREE.RingGeometry(0.048, 0.062, 32), ring);
  tweeterRing.position.copy(tweeter.position).setZ(0.186);
  group.add(tweeterRing);

  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.018), black);
  badge.position.set(0, 0.335, 0.184);
  group.add(badge);

  const stand = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.07, 0.3, 2, 0.02), black);
  stand.position.set(0, -0.445, 0.02);
  stand.rotation.x = 0.18;
  stand.castShadow = true;
  group.add(stand);

  const origin = new THREE.Object3D();
  origin.position.set(0, -0.13, 0.2);
  group.add(origin);
  group.userData.woofer = woofer;
  group.userData.origin = origin;

  for (let i = 0; i < 6; i += 1) {
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.185, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    ripple.visible = false;
    ripple.userData.life = 0;
    origin.add(ripple);
    ripples.push(ripple);
  }

  group.position.set(side * 1.32, 0.52, 0.16);
  group.rotation.y = -side * 0.3;
  group.rotation.x = -0.06;
  return group;
}

function makeSeeds() {
  const texture = makeSeedTexture();
  const group = new THREE.Group();
  const count = coarse ? 14 : 26;
  for (let i = 0; i < count; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.55 + Math.random() * 0.3
      })
    );
    sprite.scale.setScalar(0.18 + Math.random() * 0.22);
    sprite.userData.path = {
      x: (Math.random() - 0.5) * 7,
      y: 0.4 + Math.random() * 3.4,
      z: (Math.random() - 0.5) * 4,
      s: 0.12 + Math.random() * 0.2,
      p: Math.random() * Math.PI * 2
    };
    group.add(sprite);
  }
  return group;
}

function makeSeedTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 11; i += 1) {
    const a = (i / 11) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(32, 38);
    ctx.lineTo(32 + Math.cos(a) * 16, 38 + Math.sin(a) * 16 - 8);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.beginPath();
    ctx.arc(32 + Math.cos(a) * 16, 38 + Math.sin(a) * 16 - 8, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(32, 40, 2.6, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function layoutCovers(immediate) {
  coverMeshes.forEach((mesh, index) => {
    const delta = index - current;
    const wrapped = wrapDelta(delta, TRACKS.length);
    mesh.userData.targetY = wrapped * COVER_GAP;
    mesh.userData.targetScale = wrapped === 0 ? 1 : Math.max(0.72, 1 - Math.abs(wrapped) * 0.14);
    mesh.userData.targetOpacity = wrapped === 0 ? 1 : Math.max(0.18, 0.55 - Math.abs(wrapped) * 0.16);
    mesh.userData.targetZ = wrapped === 0 ? 0.08 : -Math.abs(wrapped) * 0.06;
    if (immediate) {
      mesh.position.set(0, mesh.userData.targetY, mesh.userData.targetZ);
      mesh.scale.setScalar(mesh.userData.targetScale);
      mesh.material.opacity = mesh.userData.targetOpacity;
    }
  });
}

function wrapDelta(delta, length) {
  if (delta > length / 2) return delta - length;
  if (delta < -length / 2) return delta + length;
  return delta;
}

function setTrack(index, keepPlay) {
  current = (index + TRACKS.length) % TRACKS.length;
  const track = TRACKS[current];
  const wasPlaying = keepPlay && playing;
  audio.src = track.src;
  paintMeta();
  layoutCovers(false);
  if (wasPlaying) {
    audio.play().catch(() => setPlaying(false));
  } else {
    setPlaying(false);
  }
}

function paintMeta() {
  const track = TRACKS[current];
  titleEl.textContent = track.title;
  artistEl.textContent = track.artist;
}

function setPlaying(next) {
  playing = next;
  playButton.classList.toggle("is-playing", playing);
  playButton.setAttribute("aria-pressed", playing ? "true" : "false");
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
}

async function togglePlay() {
  const track = TRACKS[current];
  if (!audio.src || !audio.src.includes(track.id)) audio.src = track.src;
  await ensureAudio();
  if (playing) {
    audio.pause();
    setPlaying(false);
    return;
  }
  try {
    await audio.play();
    setPlaying(true);
  } catch {
    setPlaying(false);
  }
}

async function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(audio);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  if (audioCtx.state === "suspended") await audioCtx.resume();
}

function energy() {
  if (!analyser || !playing) return 0;
  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  const span = Math.min(8, freqData.length);
  for (let i = 0; i < span; i += 1) sum += freqData[i];
  return sum / (span * 255);
}

function emitRipples(level) {
  speakers.forEach((speaker) => {
    const idle = ripples.find((ring) => ring.parent === speaker.userData.origin && !ring.visible);
    if (!idle) return;
    idle.visible = true;
    idle.userData.life = 1;
    idle.scale.setScalar(0.55);
    idle.material.opacity = 0.22 + level * 0.45;
  });
}

function tickRipples(dt, level) {
  emitWait -= dt;
  if (playing && emitWait <= 0 && (level > 0.08 || emitWait < -0.2)) {
    emitRipples(Math.max(level, 0.12));
    emitWait = 0.16 + (1 - level) * 0.2;
  }
  ripples.forEach((ring) => {
    if (!ring.visible) return;
    ring.userData.life -= dt * 0.85;
    ring.scale.addScalar(dt * (1.15 + level * 0.8));
    ring.material.opacity = Math.max(0, ring.userData.life * 0.42);
    if (ring.userData.life <= 0) {
      ring.visible = false;
      ring.material.opacity = 0;
    }
  });
}

function syncHud() {
  const cover = coverMeshes[current];
  if (!cover || !hud) return;
  cover.getWorldPosition(hudWorld);
  hudWorld.y -= 0.02;
  hudWorld.project(camera);
  renderer.getSize(_size);
  const x = (hudWorld.x * 0.5 + 0.5) * _size.x;
  const y = (-hudWorld.y * 0.5 + 0.5) * _size.y;
  hud.style.transform = `translate(${x}px, ${y}px) translate(-50%, -12%)`;
  hud.style.left = "0";
  hud.style.top = "0";
}

function stepCovers(dt) {
  const ease = 1 - Math.exp(-(reduceMotion ? 14 : 8) * dt);
  coverMeshes.forEach((mesh) => {
    mesh.position.y += (mesh.userData.targetY - mesh.position.y) * ease;
    mesh.position.z += (mesh.userData.targetZ - mesh.position.z) * ease;
    const scale = mesh.scale.x + (mesh.userData.targetScale - mesh.scale.x) * ease;
    mesh.scale.setScalar(scale);
    mesh.material.opacity += (mesh.userData.targetOpacity - mesh.material.opacity) * ease;
  });
}

function frameStage() {
  const mobile = window.innerWidth < 720;
  camera.fov = mobile ? 40 : 34;
  camera.position.z = mobile ? 6.85 : 6.05;
  speakers[0].position.x = mobile ? -1.02 : -1.32;
  speakers[1].position.x = mobile ? 1.02 : 1.32;
  speakers.forEach((speaker) => speaker.scale.setScalar(mobile ? 0.84 : 1));
  camera.updateProjectionMatrix();
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  renderer.setSize(width, height, false);
  frameStage();
}

function pickCover(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hit = raycaster.intersectObjects(coverMeshes, false)[0];
  return hit?.object || null;
}

playButton.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePlay();
});

let wheelLock = 0;
window.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaY) < 6) return;
  event.preventDefault();
  const now = performance.now();
  if (now < wheelLock) return;
  wheelLock = now + 220;
  setTrack(current + (event.deltaY > 0 ? 1 : -1), true);
}, { passive: false });

stage.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".listen-play")) return;
  pointer.dragging = true;
  pointer.downY = event.clientY;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});

window.addEventListener("pointerup", (event) => {
  if (!pointer.dragging) return;
  const dy = event.clientY - pointer.downY;
  pointer.dragging = false;
  if (Math.abs(dy) > 36) {
    setTrack(current + (dy > 0 ? -1 : 1), true);
    return;
  }
  const hit = pickCover(event);
  if (!hit) return;
  if (hit.userData.index === current) togglePlay();
  else setTrack(hit.userData.index, true);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    event.preventDefault();
    setTrack(current + 1, true);
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    event.preventDefault();
    setTrack(current - 1, true);
  } else if (event.key === " " || event.key === "Enter") {
    if (event.target !== playButton) {
      event.preventDefault();
      togglePlay();
    }
  }
});

window.addEventListener("resize", onResize);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.pause();
    return;
  }
  if (playing) audio.play().catch(() => setPlaying(false));
});

audio.addEventListener("ended", () => {
  if (!audio.loop) setPlaying(false);
});

frameStage();
setTrack(0, false);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const level = energy();

  if (grass.material.uniforms) grass.material.uniforms.uTime.value = time;
  glow.material.opacity = 0.28 + (playing ? 0.2 + level * 0.3 : 0);
  playGlow.intensity = playing ? 0.28 + level * 0.9 : 0.1;

  speakers.forEach((speaker) => {
    const pulse = playing ? 1 + level * 0.045 : 1;
    speaker.userData.woofer.scale.setScalar(pulse);
  });

  tickRipples(dt, level);
  stepCovers(dt);

  const sway = reduceMotion ? 0 : 1;
  const px = ((pointer.x / window.innerWidth) - 0.5) * 0.22 * sway;
  const py = ((pointer.y / window.innerHeight) - 0.5) * 0.1 * sway;
  camera.position.x += (px - camera.position.x) * 0.04;
  camera.position.y += (0.92 - py - camera.position.y) * 0.04;
  camera.lookAt(0, 0.68, 0);

  seeds.children.forEach((sprite) => {
    const path = sprite.userData.path;
    sprite.position.set(
      path.x + Math.sin(time * path.s + path.p) * 0.45,
      path.y + Math.sin(time * path.s * 0.7 + path.p) * 0.2,
      path.z + Math.cos(time * path.s * 0.8 + path.p) * 0.35
    );
  });

  syncHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
