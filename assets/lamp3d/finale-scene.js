import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => value * value * (3 - 2 * value);

function loadImage(relativePath) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load finale artwork: ${relativePath}`));
    image.src = new URL(relativePath, import.meta.url).href;
  });
}

function makeCanvas(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasTexture(canvas, renderer) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function radialTexture() {
  const canvas = makeCanvas(128);
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(224,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(136,235,255,.8)');
  gradient.addColorStop(0.38, 'rgba(54,164,245,.2)');
  gradient.addColorStop(1, 'rgba(15,91,190,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function cropCompuvate(image) {
  const canvas = makeCanvas(1024);
  const context = canvas.getContext('2d');
  // The supplied artwork includes a rectangular border and wordmark beneath
  // its round emblem. Only the official round emblem forms the coin face.
  const diameter = image.width * 0.701;
  const centerX = image.width * 0.5;
  const centerY = image.height * 0.436;
  context.beginPath();
  context.arc(512, 512, 511, 0, TAU);
  context.clip();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 1024, 1024);
  context.drawImage(image, centerX - diameter / 2, centerY - diameter / 2, diameter, diameter, 0, 0, 1024, 1024);
  return canvas;
}

function whiteKeyArtwork(image) {
  const source = makeCanvas(image.width, image.height);
  const context = source.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  let minX = source.width;
  let minY = source.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      const distanceFromWhite = 255 - Math.min(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
      const alpha = smoothstep(clamp((distanceFromWhite - 12) / 35));
      pixels.data[index + 3] = Math.round(alpha * 255);
      if (alpha > 0.7) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  context.putImageData(pixels, 0, 0);
  const margin = 12;
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(source.width, maxX + margin);
  maxY = Math.min(source.height, maxY + margin);
  const crop = makeCanvas(maxX - minX, maxY - minY);
  crop.getContext('2d').drawImage(source, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i][0] * next[1] - next[0] * points[i][1];
  }
  return area / 2;
}

function containsPoint(points, point) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function simplifyPolyline(points, tolerance) {
  if (points.length < 4) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const lengthSquared = dx * dx + dy * dy;
  let maxDistance = 0;
  let split = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    const fraction = lengthSquared ? clamp(((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / lengthSquared) : 0;
    const distance = Math.hypot(point[0] - first[0] - fraction * dx, point[1] - first[1] - fraction * dy);
    if (distance > maxDistance) { maxDistance = distance; split = i; }
  }
  if (maxDistance <= tolerance) return [first, last];
  return simplifyPolyline(points.slice(0, split + 1), tolerance).slice(0, -1).concat(simplifyPolyline(points.slice(split), tolerance));
}

function simplifyLoop(points) {
  // Split at the farthest vertex so the closed polygon has stable endpoints.
  let farthest = 1;
  let distance = 0;
  for (let i = 1; i < points.length; i += 1) {
    const candidate = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (candidate > distance) { distance = candidate; farthest = i; }
  }
  return simplifyPolyline(points.slice(0, farthest + 1), 0.48).slice(0, -1)
    .concat(simplifyPolyline(points.slice(farthest).concat([points[0]]), 0.48).slice(0, -1));
}

function traceArtworkShapes(artwork, worldHeight) {
  const width = 360;
  const height = Math.round(width * artwork.height / artwork.width);
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(artwork, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) mask[i] = rgba[i * 4 + 3] > 150 ? 1 : 0;
  const stride = width + 1;
  const edges = [];
  const outgoing = new Map();
  const addEdge = (x1, y1, x2, y2, direction) => {
    const edge = { a: y1 * stride + x1, b: y2 * stride + x2, direction, used: false };
    edges.push(edge);
    if (!outgoing.has(edge.a)) outgoing.set(edge.a, []);
    outgoing.get(edge.a).push(edge);
  };
  const occupied = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!occupied(x, y)) continue;
      if (!occupied(x, y - 1)) addEdge(x, y, x + 1, y, 0);
      if (!occupied(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1, 1);
      if (!occupied(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1, 2);
      if (!occupied(x - 1, y)) addEdge(x, y + 1, x, y, 3);
    }
  }
  const loops = [];
  const turnPriority = [1, 0, 3, 2];
  for (const first of edges) {
    if (first.used) continue;
    const points = [];
    let edge = first;
    while (edge && !edge.used) {
      edge.used = true;
      points.push([edge.a % stride, Math.floor(edge.a / stride)]);
      if (edge.b === first.a) break;
      const candidates = (outgoing.get(edge.b) || []).filter((candidate) => !candidate.used);
      edge = candidates.sort((a, b) => turnPriority.indexOf((a.direction - edge.direction + 4) % 4) - turnPriority.indexOf((b.direction - edge.direction + 4) % 4))[0];
    }
    if (points.length < 4) continue;
    const area = polygonArea(points);
    if (Math.abs(area) < 3) continue;
    loops.push({ points: simplifyLoop(points), area });
  }
  const units = worldHeight / height;
  const toPath = (points, PathClass) => {
    const path = new PathClass();
    points.forEach(([x, y], index) => {
      const px = (x - width / 2) * units;
      const py = (height / 2 - y) * units;
      if (index === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    });
    path.closePath();
    return path;
  };
  const outer = loops.filter((loop) => loop.area > 0).map((loop) => ({ ...loop, shape: toPath(loop.points, THREE.Shape) }));
  for (const hole of loops.filter((loop) => loop.area < 0)) {
    const owner = outer.filter((loop) => loop.area > Math.abs(hole.area) && containsPoint(loop.points, hole.points[0])).sort((a, b) => a.area - b.area)[0];
    if (owner) owner.shape.holes.push(toPath(hole.points, THREE.Path));
  }
  return { shapes: outer.map((loop) => loop.shape), width: width * units, height: worldHeight };
}

function glowArtwork(artwork) {
  const silhouette = makeCanvas(artwork.width, artwork.height);
  const context = silhouette.getContext('2d');
  context.drawImage(artwork, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = '#58ddff';
  context.fillRect(0, 0, silhouette.width, silhouette.height);
  const glow = makeCanvas(artwork.width, artwork.height);
  const glowContext = glow.getContext('2d');
  glowContext.filter = 'blur(10px)';
  glowContext.drawImage(silhouette, 0, 0);
  return glow;
}

function consolidateExtrusionGroups(geometry) {
  // ExtrudeGeometry emits two material groups for every disconnected letter
  // or symbol. Pack caps and sidewalls into two draws for the entire emblem.
  const capCount = geometry.groups.filter((group) => group.materialIndex === 0).reduce((count, group) => count + group.count, 0);
  const count = geometry.groups.reduce((total, group) => total + group.count, 0);
  const index = new Uint32Array(count);
  let cursor = 0;
  for (const materialIndex of [0, 1]) {
    for (const group of geometry.groups) {
      if (group.materialIndex !== materialIndex) continue;
      for (let i = group.start; i < group.start + group.count; i += 1) index[cursor++] = i;
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.clearGroups();
  geometry.addGroup(0, capCount, 0);
  geometry.addGroup(capCount, count - capCount, 1);
  return geometry;
}

export class FinaleScene {
  constructor({ canvas }) {
    if (!canvas) throw new Error('FinaleScene requires a canvas.');
    this.canvas = canvas;
    this.phase = 'hidden';
    this.paused = false;
    this.progress = 1;
    this._compuvateSpinProgress = 0;
    this.disposed = false;
    this._time = 0;
    this._phaseTime = 0;
    this._lastFrame = 0;
    this._frame = 0;
    this._fade = { compuvate: 0, 'problem-lab': 0 };
    this._groups = {};
    this._textures = new Set();
    this._environmentTarget = null;
    this._animate = this._animate.bind(this);
    this._resize = this._resize.bind(this);
    this._visibility = () => {
      // Keep the active ceremony clock stable while the tab is suspended.
      this._lastFrame = 0;
      if (document.hidden) {
        cancelAnimationFrame(this._frame);
        this._frame = 0;
      } else this._start();
    };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 40);
    this.camera.position.set(0, 0.25, 8.5);
    this.camera.lookAt(0, 0.25, 0);
    this._createEnvironment();
    this._createLights();
    this._createAtmosphere();
    this._resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this._resize);
    this._resizeObserver?.observe(canvas);
    window.addEventListener('resize', this._resize);
    document.addEventListener('visibilitychange', this._visibility);
    this._resize();

    this.ready = Promise.all([loadImage('../compuvate-logo.png'), loadImage('../problem-lab-logo.jpg')]).then(([compuvate, problemLab]) => {
      if (this.disposed) return this;
      this._createCompuvate(compuvate);
      this._createProblemLab(problemLab);
      this._resize();
      this._renderFrame(0);
      this._start();
      return this;
    });
  }

  _texture(canvas) {
    const texture = canvasTexture(canvas, this.renderer);
    this._textures.add(texture);
    return texture;
  }

  _createEnvironment() {
    const canvas = makeCanvas(768, 384);
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 384);
    gradient.addColorStop(0, '#a3c8e1');
    gradient.addColorStop(0.26, '#24497c');
    gradient.addColorStop(0.54, '#112a43');
    gradient.addColorStop(0.8, '#12364a');
    gradient.addColorStop(1, '#071120');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 768, 384);
    context.filter = 'blur(18px)';
    context.fillStyle = '#c3faff';
    context.fillRect(120, 25, 54, 205);
    context.fillStyle = '#94aaff';
    context.fillRect(405, 15, 80, 185);
    context.fillStyle = '#40c4e8';
    context.fillRect(675, 74, 35, 175);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const generator = new THREE.PMREMGenerator(this.renderer);
    this._environmentTarget = generator.fromEquirectangular(texture);
    this.scene.environment = this._environmentTarget.texture;
    generator.dispose();
    texture.dispose();
  }

  _createLights() {
    this.scene.add(new THREE.HemisphereLight(0xb9dfff, 0x092440, 1.5));
    this.key = new THREE.DirectionalLight(0xd4efff, 3.3);
    this.key.position.set(-3, 4, 5);
    this.scene.add(this.key);
    this.blueLight = new THREE.PointLight(0x488dff, 18, 12, 2);
    this.blueLight.position.set(-2.6, 1.5, 2.5);
    this.scene.add(this.blueLight);
    this.greenLight = new THREE.PointLight(0x41e1ff, 13, 12, 2);
    this.greenLight.position.set(3, -0.8, 2);
    this.scene.add(this.greenLight);
    this.backLight = new THREE.PointLight(0x74e5ff, 16, 10, 2);
    this.backLight.position.set(0, 2.8, -2);
    this.scene.add(this.backLight);
  }

  _createAtmosphere() {
    this.atmosphere = new THREE.Group();
    this.atmosphere.position.y = 0.52;
    this.scene.add(this.atmosphere);
    this.halos = [];
    [[2.15, 0x50cfff, 0.18, 0.3], [2.45, 0x358fff, 0.14, -0.38], [2.7, 0x31dce8, 0.09, 0.65]].forEach(([radius, color, opacity, tilt], index) => {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.009 - index * 0.001, 6, 160, TAU * 0.79), material);
      halo.position.z = -0.55 - index * 0.24;
      halo.rotation.set(tilt, 0.21 + index * 0.12, index * 1.55);
      halo.userData.baseOpacity = opacity;
      this.halos.push(halo);
      this.atmosphere.add(halo);
    });
    const pointTexture = radialTexture();
    this._textures.add(pointTexture);
    const positions = new Float32Array(48 * 3);
    for (let i = 0; i < 48; i += 1) {
      const angle = i * 2.399963229728653;
      const radius = 2.45 + ((i * 17) % 31) / 31 * 1.45;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius * 0.62;
      positions[i * 3 + 2] = -0.9 - ((i * 7) % 19) / 19 * 1.8;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x7dd9ee, map: pointTexture, size: 0.062, transparent: true, opacity: 0.27, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.atmosphere.add(this.particles);
    this.atmosphere.visible = false;
  }

  _registerGroup(name, group) {
    group.position.y = 0.52;
    group.visible = false;
    group.traverse((object) => {
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      materials.forEach((material) => {
        if (material.userData.finaleOpacity === undefined) material.userData.finaleOpacity = material.opacity;
        material.transparent = true;
      });
    });
    this._groups[name] = group;
    this.scene.add(group);
  }

  _createCompuvate(image) {
    const group = new THREE.Group();
    group.name = 'CompuVateBeveledEmblem';
    const outline = new THREE.Shape();
    outline.absarc(0, 0, 1.57, 0, TAU, false);
    const rimMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1989c7, metalness: 0.87, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.15, emissive: 0x063d78, emissiveIntensity: 0.24, envMapIntensity: 1.6 });
    const coin = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.25, steps: 1, bevelEnabled: true, bevelThickness: 0.037, bevelSize: 0.037, bevelSegments: 6, curveSegments: 128 }), rimMaterial);
    coin.position.z = -0.125;
    group.add(coin);
    const faceTexture = this._texture(cropCompuvate(image));
    const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false, transparent: true });
    const front = new THREE.Mesh(new THREE.CircleGeometry(1.521, 128), faceMaterial);
    front.position.z = 0.165;
    group.add(front);
    const back = new THREE.Mesh(new THREE.CircleGeometry(1.521, 128), faceMaterial.clone());
    back.position.z = -0.165;
    back.rotation.y = Math.PI;
    group.add(back);
    const brightRim = new THREE.MeshPhysicalMaterial({ color: 0x68eaff, metalness: 0.92, roughness: 0.19, emissive: 0x14c8e3, emissiveIntensity: 0.3, envMapIntensity: 1.8 });
    [0.17, -0.17].forEach((z) => {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.555, 0.026, 12, 160), brightRim);
      rim.position.z = z;
      group.add(rim);
    });
    [-0.085, 0, 0.085].forEach((z) => {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(1.586, 0.007, 6, 160), rimMaterial);
      groove.position.z = z;
      group.add(groove);
    });
    const glow = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.77, 128), new THREE.MeshBasicMaterial({ color: 0x42dfff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    glow.position.z = -0.05;
    group.add(glow);
    this.compuvateGlow = glow;
    this.compuvateMetal = rimMaterial;
    this._registerGroup('compuvate', group);
  }

  _createProblemLab(image) {
    const group = new THREE.Group();
    group.name = 'ProblemLabExtrudedOfficialArtwork';
    const artwork = whiteKeyArtwork(image);
    const traced = traceArtworkShapes(artwork, 3.27);
    const sideMaterial = new THREE.MeshPhysicalMaterial({ color: 0x3975aa, metalness: 0.76, roughness: 0.24, clearcoat: 0.58, clearcoatRoughness: 0.15, emissive: 0x0a627f, emissiveIntensity: 0.16, envMapIntensity: 1.85 });
    const capMaterial = new THREE.MeshPhysicalMaterial({ color: 0x70c7dc, metalness: 0.54, roughness: 0.26, emissive: 0x123b63, emissiveIntensity: 0.12 });
    const geometry = consolidateExtrusionGroups(new THREE.ExtrudeGeometry(traced.shapes, { depth: 0.225, steps: 1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 2 }));
    const extruded = new THREE.Mesh(geometry, [capMaterial, sideMaterial]);
    extruded.position.z = -0.1125;
    group.add(extruded);
    const faceTexture = this._texture(artwork);
    const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, alphaTest: 0.03, toneMapped: false, depthWrite: true });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(traced.width, traced.height), faceMaterial);
    front.position.z = 0.127;
    group.add(front);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(traced.width, traced.height), faceMaterial.clone());
    back.rotation.y = Math.PI;
    back.position.z = -0.127;
    group.add(back);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(traced.width * 1.025, traced.height * 1.025), new THREE.MeshBasicMaterial({ map: this._texture(glowArtwork(artwork)), transparent: true, opacity: 0.33, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    glow.position.z = -0.16;
    group.add(glow);
    this.problemGlow = glow;
    this.problemMetal = sideMaterial;
    this._registerGroup('problem-lab', group);
  }

  _resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || this.canvas.clientWidth || 1);
    const height = Math.max(1, rect.height || this.canvas.clientHeight || 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.position.z = Math.max(8.5, 5.6 / Math.max(this.camera.aspect, 0.45));
    this.camera.updateProjectionMatrix();
    this._renderFrame(0);
  }

  setPhase(phase) {
    if (!['compuvate', 'problem-lab', 'hidden'].includes(phase)) throw new Error(`Unknown finale phase: ${phase}`);
    if (this.disposed || this.phase === phase) return;
    this.phase = phase;
    this._phaseTime = 0;
    this._lastFrame = 0;
    if (phase === 'compuvate') this.setCompuvateSpinProgress(0);
    if (phase === 'hidden') {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
      this._fade.compuvate = 0;
      this._fade['problem-lab'] = 0;
      Object.values(this._groups).forEach((group) => { group.visible = false; });
      this.atmosphere.visible = false;
      this.renderer.clear();
    } else {
      this._renderFrame(0);
      this._start();
    }
  }

  setProgress(value) {
    if (Number.isFinite(value)) this.progress = clamp(value);
  }

  /** Drive one complete coin turn with normalized lamp-orbit progress. */
  setCompuvateSpinProgress(value) {
    if (!Number.isFinite(value) || this.disposed) return;
    this._compuvateSpinProgress = clamp(value);
    this._groups.compuvate?.rotation.set(0, TAU * smoothstep(this._compuvateSpinProgress), 0);
  }

  /** Match the emblem's center and outer diameter to the lamp ring in CSS pixels. */
  setCompuvateLayout({ centerX, centerY, diameter }) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || ![centerX, centerY, diameter].every(Number.isFinite)) return;
    this._compuvateLayout = { x: centerX / rect.width, y: centerY / rect.height, diameter: diameter / rect.height };
    this._resize();
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this._lastFrame = 0;
    if (this.paused) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    } else this._start();
  }

  _start() {
    if (!this.disposed && !this.paused && !document.hidden && this.phase !== 'hidden' && !this._frame) this._frame = requestAnimationFrame(this._animate);
  }

  _animate(timestamp) {
    this._frame = 0;
    if (this.disposed || this.paused || document.hidden || this.phase === 'hidden') return;
    const delta = this._lastFrame ? Math.max((timestamp - this._lastFrame) / 1000, 0) : 0;
    this._lastFrame = timestamp;
    this._time += delta;
    this._phaseTime += delta;
    this._renderFrame(delta);
    this._start();
  }

  _setOpacity(group, opacity) {
    group.visible = opacity > 0.002;
    group.traverse((object) => {
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      materials.forEach((material) => {
        material.opacity = material.userData.finaleOpacity * opacity;
        material.depthWrite = material.blending !== THREE.AdditiveBlending && opacity > 0.82;
      });
    });
  }

  _renderFrame(delta) {
    if (this.disposed || !this.renderer) return;
    const time = this._time;
    const active = this.phase !== 'hidden';
    const smoothing = 1 - Math.exp(-delta * 4.8);
    for (const [name, group] of Object.entries(this._groups)) {
      const target = this.phase === name ? 1 : 0;
      this._fade[name] += (target - this._fade[name]) * smoothing;
      this._setOpacity(group, this._fade[name]);
    }
    const compuvate = this._groups.compuvate;
    if (compuvate) {
      const reveal = smoothstep(clamp(this._phaseTime / 1.15));
      const breathing = 1 + Math.sin(time * 1.6) * 0.012;
      const layout = this._compuvateLayout;
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
      const logoScale = layout ? layout.diameter * (halfHeight * 2) / 3.54 : 1;
      compuvate.scale.setScalar(logoScale * (this.phase === 'compuvate' ? 0.86 + reveal * 0.14 : 1) * breathing);
      compuvate.rotation.set(0, TAU * smoothstep(this._compuvateSpinProgress), 0);
      compuvate.position.x = layout ? (layout.x * 2 - 1) * halfHeight * this.camera.aspect : 0;
      compuvate.position.y = layout ? this.camera.position.y + (1 - layout.y * 2) * halfHeight : 0.52;
      if (this.phase === 'compuvate') {
        this.atmosphere.position.set(compuvate.position.x, compuvate.position.y, 0);
        this.atmosphere.scale.setScalar(logoScale);
      } else {
        this.atmosphere.position.set(0, 0.52, 0);
        this.atmosphere.scale.setScalar(1);
      }
      this.compuvateMetal.emissiveIntensity = 0.2 + (Math.sin(time * 1.8) * 0.5 + 0.5) * 0.25;
      this.compuvateGlow.material.opacity = (0.055 + (Math.sin(time * 1.8) * 0.5 + 0.5) * 0.115) * this._fade.compuvate;
      this.compuvateGlow.scale.setScalar(1 + (Math.sin(time * 1.8) * 0.5 + 0.5) * 0.035);
    }
    const problemLab = this._groups['problem-lab'];
    if (problemLab) {
      const entrance = smoothstep(clamp(this._phaseTime / 3.7));
      const settledTime = Math.max(0, this._phaseTime - 3.7);
      const angle = -TAU * (1 - entrance) + Math.sin(settledTime * 0.4) * 0.255;
      problemLab.rotation.set(Math.sin(time * 0.32) * 0.027, angle, Math.sin(time * 0.28) * 0.006);
      problemLab.scale.setScalar(0.88 + smoothstep(clamp(this._phaseTime / 1.35)) * 0.12);
      problemLab.position.y = 0.52 + Math.sin(time * 0.62) * 0.027;
      this.problemGlow.material.opacity = (0.28 + Math.sin(time * 1.15) * 0.065) * this._fade['problem-lab'];
    }
    this.atmosphere.visible = active;
    this.halos.forEach((halo, index) => {
      halo.rotation.z = time * (0.035 - index * 0.012) + index * 1.55;
      halo.rotation.y = 0.21 + index * 0.12 + Math.sin(time * 0.17 + index) * 0.13;
      halo.material.opacity = halo.userData.baseOpacity * clamp(Math.max(...Object.values(this._fade))) * (0.85 + Math.sin(time * 0.5 + index) * 0.15);
    });
    this.particles.rotation.z = time * 0.011;
    this.particles.rotation.y = Math.sin(time * 0.12) * 0.12;
    this.particles.material.opacity = 0.23 * clamp(Math.max(...Object.values(this._fade)));
    this.blueLight.position.set(Math.cos(time * 0.26) * 3.1, 1.8 + Math.sin(time * 0.31) * 0.6, 2.2);
    this.greenLight.position.set(Math.sin(time * 0.22 + 1.2) * 3.3, -0.6 + Math.cos(time * 0.19) * 1.2, 2.5);
    this.backLight.intensity = 14 + Math.sin(time * 0.7) * 3;
    this.key.intensity = 3.1 + this.progress * 0.4;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._frame);
    this._resizeObserver?.disconnect();
    window.removeEventListener('resize', this._resize);
    document.removeEventListener('visibilitychange', this._visibility);
    const geometries = new Set();
    const materials = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this._textures.forEach((texture) => texture.dispose());
    this._environmentTarget?.dispose();
    this.renderer.dispose();
  }
}
