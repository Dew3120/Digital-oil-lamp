import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFExporter } from './vendor/GLTFExporter.js';
import { configureLampRenderer, createLampScene } from './lamp-factory.js';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const embedded = window.self !== window.top;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: embedded });
if (embedded) renderer.setClearColor(0x000000, 0);
configureLampRenderer(renderer);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const lamp = createLampScene({ renderer, embedded, shadows: true });
const { scene, model, group } = lamp;
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
camera.position.set(2.7, 3.15, embedded ? 8.2 : 6.65);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.23, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 4.8;
controls.maxDistance = 14;
controls.maxPolarAngle = 1.66;
controls.enabled = !embedded;
controls.update();

let time = 0;
let igniting = false;
let ignitionStart = 0;
let progress = 0;
let config = { flameSize: 70, flameVolume: 70, lightIntensity: 80 };
let paused = false;
let spinning = false;
let spinStart = 0;
let spinDuration = 2.6;
let spinFrom = 0;
let frame = 0;
let previousTimestamp = 0;
let dirty = true;
let readySent = false;

function ignite() {
  ignitionStart = time;
  igniting = true;
  progress = 0;
  status.textContent = 'Flame growing from the wick';
  dirty = true;
  requestFrame();
}

function reset() {
  igniting = false;
  progress = 0;
  status.textContent = 'Ready to ignite';
  dirty = true;
  requestFrame();
}

function setLit(lit) {
  if (!lit) { reset(); return; }
  igniting = false;
  progress = 1;
  status.textContent = 'Flame lit';
  dirty = true;
  requestFrame();
}

function setConfig(values) {
  for (const key of Object.keys(config)) {
    const value = Number(values[key]);
    if (Number.isFinite(value)) config[key] = THREE.MathUtils.clamp(value, 10, 100);
  }
  dirty = true;
  requestFrame();
}

function spin(duration = 2600) {
  spinFrom = group.rotation.y;
  spinStart = time;
  spinDuration = THREE.MathUtils.clamp(Number(duration) || 2600, 300, 10000) / 1000;
  spinning = true;
  dirty = true;
  requestFrame();
}

function setPaused(value) {
  paused = Boolean(value);
  previousTimestamp = 0;
  if (paused && frame) { cancelAnimationFrame(frame); frame = 0; }
  if (!paused) requestFrame();
}

if (embedded) {
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.channel !== 'compuvate-lamp-3d') return;
    if (message.type === 'config') setConfig(message);
    if (message.type === 'ignite') ignite();
    if (message.type === 'lit') setLit(Boolean(message.value));
    if (message.type === 'spin') spin(message.duration);
    if (message.type === 'pause') setPaused(message.value);
  });
  if (new URLSearchParams(location.search).get('mode') === 'preview') setLit(true);
}
document.querySelector('#ignite').addEventListener('click', ignite);
document.querySelector('#reset').addEventListener('click', reset);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', event => { downAt = [event.clientX, event.clientY]; });
canvas.addEventListener('pointerup', event => {
  const start = downAt;
  downAt = null;
  if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 9) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObjects(model.children, true).length) ignite();
});
canvas.addEventListener('pointercancel', () => { downAt = null; });

function resize() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (width < 1 || height < 1) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  dirty = true;
  requestFrame();
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(canvas);

function requestFrame() {
  if (!frame && !paused && !document.hidden) frame = requestAnimationFrame(animate);
}

function animate(timestamp) {
  frame = 0;
  if (paused || document.hidden) { previousTimestamp = 0; return; }
  if (previousTimestamp) time += Math.max(0, (timestamp - previousTimestamp) / 1000);
  previousTimestamp = timestamp;
  if (igniting) {
    const raw = Math.min(1, (time - ignitionStart) / 1.55);
    progress = 1 - Math.pow(1 - raw, 2.2);
    if (raw >= 1) {
      igniting = false;
      status.textContent = 'Flame fully lit — drag to inspect the 3D shape';
    }
  }
  if (spinning) {
    const raw = Math.min(1, (time - spinStart) / spinDuration);
    const eased = raw * raw * raw * (raw * (raw * 6 - 15) + 10);
    group.rotation.y = spinFrom + eased * Math.PI * 2;
    if (raw >= 1) { spinning = false; group.rotation.y = spinFrom % (Math.PI * 2); }
  }
  lamp.update({ time, progress, ...config });
  controls.update();
  if (canvas.clientWidth && canvas.clientHeight) {
    renderer.render(scene, camera);
    dirty = false;
    if (embedded && !readySent) {
      readySent = true;
      window.parent.postMessage({ channel: 'compuvate-lamp-3d', type: 'ready' }, window.location.origin);
    }
  }
  if (progress > 0 || igniting || spinning || controls.enabled || dirty) requestFrame();
  else previousTimestamp = 0;
}

document.addEventListener('visibilitychange', () => {
  previousTimestamp = 0;
  if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
  else requestFrame();
});
resize();
requestFrame();

document.querySelector('#download').addEventListener('click', async () => {
  const button = document.querySelector('#download');
  button.disabled = true;
  status.textContent = 'Preparing the 3D model…';
  try {
    const copy = model.clone(true);
    const fullFlame = copy.getObjectByName('VolumetricFlame');
    fullFlame.visible = true;
    fullFlame.scale.set(1, 1, 1);
    copy.traverse(object => {
      if (object.isMesh && object.material.isShaderMaterial && object.userData.exportColor) {
        object.material = new THREE.MeshBasicMaterial({ color: object.userData.exportColor, transparent: true, opacity: object.userData.exportOpacity, side: THREE.DoubleSide, depthWrite: false });
      }
    });
    const binary = await new GLTFExporter().parseAsync(copy, { binary: true, onlyVisible: false });
    const url = URL.createObjectURL(new Blob([binary], { type: 'model/gltf-binary' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'compuvate-single-oil-lamp-3d.glb';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = '3D model downloaded';
  } catch (error) {
    console.error(error);
    status.textContent = 'Download failed — please retry';
  } finally { button.disabled = false; }
});
