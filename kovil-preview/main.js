import * as THREE from './assets/lamp3d/vendor/three.module.js';
import { configureLampRenderer, createLampScene } from './assets/lamp3d/lamp-factory.js';
import { createImageFlags } from './image-flags.js';

const W = 1672, H = 941;
const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('scene'), image = $('backdrop');
await image.decode();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('loading').textContent = 'The background is ready. Enable WebGL to animate the flags and flames.';
  throw error;
}
configureLampRenderer(renderer);
renderer.setClearColor(0, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = false;

// One original lamp supplies the shared geometry and materials for all sixteen.
// The pavilion, landscaping, type, rods and steps remain the untouched image.
const original = createLampScene({ renderer, embedded: true, shadows: false });
const scene = original.scene;
scene.remove(original.group);
const camera = new THREE.OrthographicCamera(0, W, H, 0, .1, 5000);
camera.position.set(0, 0, 2000);
camera.lookAt(0, 0, 0);
scene.children.filter(o => o.isDirectionalLight).forEach((light, i) => {
  light.position.set(i ? -900 : 1200, 1500, i ? 400 : 1300);
  light.target.position.set(W / 2, H / 2, 0); scene.add(light.target);
});
const models = new THREE.Group(); models.name = 'ExistingOilLampModels'; scene.add(models);
const stepPlacements = [
  ...[446,643,835.5,1028,1222.5].map(x => ({ x, y: 640, width: 57, row: 0 })),
  ...[437,638,835.5,1033,1233].map(x => ({ x, y: 717, width: 59, row: 1 })),
  ...[420,629,836,1042.5,1250.5].map(x => ({ x, y: 799, width: 62, row: 2 })),
];
const placements = [{ x: 829, y: 511, width: 259, main: true }, ...stepPlacements];
const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.185, 0, 0));
const mainScale = placements[0].width / 4.12;
original.model.updateWorldMatrix(true, true);
const parts = [];
original.model.traverse(part => {
  if (!part.isMesh) return;
  for (let ancestor = part; ancestor && ancestor !== original.model; ancestor = ancestor.parent) if (ancestor === original.flame) return;
  parts.push({ name: part.name || 'BrassDetail', geometry: part.geometry, material: part.material, matrix: original.model.matrixWorld.clone().invert().multiply(part.matrixWorld) });
});
// Ground the projected model's lowest point, including the dimensional foot.
// The shallow elevation matches the ellipse in the approved background.
let lowestPoint = Infinity;
const vertex = new THREE.Vector3();
for (const part of parts) {
  const positions = part.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i).applyMatrix4(part.matrix).applyQuaternion(rotation);
    lowestPoint = Math.min(lowestPoint, vertex.y);
  }
}
const footOffset = -lowestPoint;
for (const part of parts) {
  const instances = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
  instances.name = `Existing${part.name}`;
  placements.forEach((p, i) => {
    const scale = p.width / 4.12;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(p.x, H - p.y + scale * footOffset, 70), rotation, new THREE.Vector3(scale, scale, scale));
    matrix.multiply(part.matrix); instances.setMatrixAt(i, matrix);
  });
  instances.instanceMatrix.needsUpdate = true; instances.computeBoundingSphere();
  models.add(instances);
}

const flameRoots = new THREE.Group(); flameRoots.name = 'OriginalVolumetricLampFlames'; scene.add(flameRoots);
const flameStates = placements.map((p, i) => {
  const scale = p.width / 4.12;
  const root = new THREE.Group(); root.name = i ? `StepOilLamp${String(i).padStart(2, '0')}` : 'MainOilLamp';
  root.position.set(p.x, H - p.y + scale * footOffset, 70); root.quaternion.copy(rotation); root.scale.setScalar(scale);
  const flame = original.flame.clone(true);
  flame.traverse(mesh => { if (mesh.isMesh && mesh.material?.isShaderMaterial) mesh.material = mesh.material.clone(); });
  root.add(flame);
  const glow = original.flameGlow.clone(); glow.material = original.flameGlow.material.clone(); root.add(glow);
  flameRoots.add(root);
  return { root, flame, glow, placement: p, progress: i === 1 ? 1 : 0, from: 0, target: i === 1 ? 1 : 0, start: -1 };
});
const mainLight = original.flameLight.clone(); mainLight.distance = 440;
mainLight.position.copy(original.flameLight.position).multiplyScalar(mainScale).applyQuaternion(rotation).add(flameStates[0].root.position);
scene.add(mainLight);
const flags = await createImageFlags(image);
scene.add(flags.group);

// Hotspots use exactly the same contained, source-coordinate frame as WebGL.
stepPlacements.forEach((p, i) => {
  const b = document.createElement('button'); b.className = 'lamp-hotspot'; b.type = 'button';
  b.style.left = `${(p.x - 40) / W * 100}%`; b.style.top = `${(p.y - 60) / H * 100}%`;
  b.style.width = `${80 / W * 100}%`; b.style.height = `${75 / H * 100}%`;
  b.dataset.index = i; b.setAttribute('aria-label', `Light step lamp ${String(i + 1).padStart(2, '0')}`);
  b.addEventListener('click', () => { if (!paused) setLamp(i + 1, 1); });
  $('step-hotspots').append(b);
});
let elapsed = 0, previous = 0, lastRender = 0, frameId = 0, paused = false, current = 1, sequence = null;
const completed = [true, ...Array(14).fill(false)];
const smooth = x => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function announce(text) { $('status').textContent = text; }
function setLamp(index, value, immediate = false) {
  const lamp = flameStates[index]; if (!lamp) return;
  lamp.from = lamp.progress; lamp.target = value; lamp.start = elapsed;
  if (immediate) { lamp.progress = value; lamp.start = -1; }
  if (index) completed[index - 1] = Boolean(value);
  requestFrame();
}
function ignite() {
  if (paused || sequence || current >= 15) return;
  setLamp(0, 1); sequence = { index: current + 1, start: elapsed, stepped: false };
  announce('The main flame grows from its wick, then lights the next lamp on the steps.');
}
function undo() {
  sequence = null; setLamp(0, 0, true);
  const last = completed.lastIndexOf(true);
  // The supplied image already depicts lamp 01 lit. Its source pixels are kept.
  if (last > 0) { setLamp(last + 1, 0, true); current = last; announce(`Lamp ${last + 1} lighting undone.`); }
  else announce('The original image shows lamp 01 lit. Touch the main lamp to continue.');
}
function previousLamp() {
  sequence = null; current = Math.max(1, current - 1); setLamp(0, 0, true);
  announce(`Ready to light lamp ${String(current + 1).padStart(2, '0')}.`);
}
function setPaused(value) {
  paused = Boolean(value); previous = 0;
  $('pause').setAttribute('aria-pressed', String(paused)); $('pause').textContent = paused ? 'Ⅱ  RESUME' : 'PAUSE';
  $('pause').setAttribute('aria-label', paused ? 'Resume flag and flame motion' : 'Pause flag and flame motion');
  if (paused) { if (frameId) cancelAnimationFrame(frameId); frameId = 0; }
  else requestFrame();
  announce(paused ? 'Motion paused.' : 'Motion resumed.');
}
async function fullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { announce('Use F11 for browser fullscreen.'); }
}
$('main-lamp').addEventListener('click', ignite);
$('previous').addEventListener('click', previousLamp);
$('undo').addEventListener('click', undo);
$('pause').addEventListener('click', () => setPaused(!paused));
$('fullscreen').addEventListener('click', fullscreen);
addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); ignite(); }
});
addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen; Escape also returns' : 'Enter fullscreen; press Escape to return'); resize(); });
function resize() {
  const rect = stage.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(rect.width, rect.height, false);
  requestFrame();
}
new ResizeObserver(resize).observe(stage);
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { previous = 0; if (document.hidden && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else requestFrame(); });
function requestFrame() { if (!frameId && !paused && !document.hidden) frameId = requestAnimationFrame(frame); }
function render() {
  const settings = { flameSize: 70, flameVolume: 70, lightIntensity: 75 };
  for (let i = 0; i < flameStates.length; i++) {
    const state = flameStates[i];
    if (state.start >= 0) { const fraction = (elapsed - state.start) / 1.55; state.progress = THREE.MathUtils.lerp(state.from, state.target, smooth(fraction)); if (fraction >= 1) state.start = -1; }
    original.update({ time: elapsed, progress: state.progress, phase: i * 2.399, ...settings });
    state.flame.visible = original.flame.visible; state.flame.scale.copy(original.flame.scale);
    const sourceMeshes = original.flame.children.filter(o => o.isMesh && o.material?.isShaderMaterial);
    const targetMeshes = state.flame.children.filter(o => o.isMesh && o.material?.isShaderMaterial);
    targetMeshes.forEach((mesh, j) => { mesh.material.uniforms.uTime.value = sourceMeshes[j].material.uniforms.uTime.value; });
    state.glow.material.opacity = original.flameGlow.material.opacity * (i ? .6 : .7);
  }
  mainLight.intensity = flameStates[0].progress * 28 * mainScale * mainScale * .9375;
  flags.update(elapsed); renderer.render(scene, camera);
}
function frame(now) {
  frameId = 0; if (paused || document.hidden) { previous = 0; return; }
  if (previous) elapsed += Math.min((now - previous) / 1000, .35); previous = now;
  if (sequence) {
    if (!sequence.stepped && elapsed - sequence.start > 1.65) { setLamp(sequence.index, 1); sequence.stepped = true; }
    if (elapsed - sequence.start > 3.5) { current = Math.min(15, sequence.index); sequence = null; setLamp(0, 0, true); announce(current >= 15 ? 'All fifteen step lamps are lit.' : 'Touch the main lamp to light the next step lamp.'); }
  }
  if (now - lastRender > 1000 / 30) { lastRender = now; render(); }
  requestFrame();
}
window.__kovilPreview = { scene, camera, renderer, models, flags, flameStates, placements, stage, original, ignite, undo, previousLamp, setPaused, render,
  get elapsed() { return elapsed; }, get paused() { return paused; }, get current() { return current; }, get progress() { return flameStates[0].progress; },
  setTime(time) { elapsed = time; flags.update(time); render(); },
};
$('loading').hidden = true; resize(); render(); requestFrame();
