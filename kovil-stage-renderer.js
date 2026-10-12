import * as THREE from './assets/lamp3d/vendor/three.module.js';
import { configureLampRenderer, createLampScene } from './assets/lamp3d/lamp-factory.js';
import { createImageFlags } from './kovil-image-flags.js';
import { createWelcomeScrollFlags } from './welcome-scroll-flags.js';

const MAX = 31;
const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** The approved image stays behind one shared renderer for flags and all lamps. */
export class KovilStageRenderer {
  constructor({ screen, frame, canvas, image, board }) {
    Object.assign(this, { screen, frame, canvas, image, board });
    this.isKovilStageRenderer = true;
    this.config = { flameSize: 70, flameVolume: 70, lightIntensity: 80 };
    this.time = 0; this.ready = false; this.active = false; this.paused = false;
    this.mainPaused = false; this.mainTime = 0; this.mainProgress = 0;
    this.lamps = []; this.states = []; this.slots = [];
    this._tracking = false; this._layoutDirty = true; this._frame = 0; this._previous = 0; this._lastRender = 0;
    this._tick = this._tick.bind(this);
    this.initializedPromise = this._initialize().catch(error => {
      console.warn('The ceremony stage is using its image fallback.', error);
      this.screen.dataset.stageError = 'true';
      this.screen.querySelector('#motion-status').textContent = 'Enable WebGL to see the moving flags and flames.';
    });
  }

  async _initialize() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    configureLampRenderer(this.renderer); this.renderer.setClearColor(0, 0);
    this.original = createLampScene({ renderer: this.renderer, embedded: true, shadows: false });
    this.scene = this.original.scene; this.scene.remove(this.original.group);
    this.camera = new THREE.OrthographicCamera(0, 1672, 941, 0, .1, 5000);
    this.camera.position.set(0, 0, 2000); this.camera.lookAt(0, 0, 0);
    this.rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.185, 0, 0));
    this.models = new THREE.Group(); this.models.name = 'ExistingCeremonyLampModels'; this.scene.add(this.models);
    this.opacityAttribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.modelMeshes = []; this.parts = [];
    this.original.model.updateWorldMatrix(true, true);
    this.original.model.traverse(part => {
      if (!part.isMesh) return;
      for (let p = part; p && p !== this.original.model; p = p.parent) if (p === this.original.flame) return;
      this.parts.push({ geometry: part.geometry, material: part.material, matrix: this.original.model.matrixWorld.clone().invert().multiply(part.matrixWorld), name: part.name || 'BrassDetail' });
    });
    let minimum = Infinity; const vertex = new THREE.Vector3();
    for (const part of this.parts) {
      const p = part.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) minimum = Math.min(minimum, vertex.fromBufferAttribute(p, i).applyMatrix4(part.matrix).applyQuaternion(this.rotation).y);
    }
    this.footOffset = -minimum;
    for (const part of this.parts) {
      const geometry = part.geometry.clone(); geometry.setAttribute('instanceLampOpacity', this.opacityAttribute);
      const material = part.material.clone(); material.transparent = true; material.forceSinglePass = true;
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute float instanceLampOpacity; varying float vLampOpacity;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vLampOpacity = instanceLampOpacity;\n#include <begin_vertex>');
        shader.fragmentShader = 'varying float vLampOpacity;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'if (vLampOpacity < 0.001) discard;\ndiffuseColor.a *= vLampOpacity;\n#include <opaque_fragment>');
      };
      material.customProgramCacheKey = () => 'ceremony-instance-opacity-v1';
      const mesh = new THREE.InstancedMesh(geometry, material, MAX); mesh.name = `Existing${part.name}`; mesh.frustumCulled = false;
      this.models.add(mesh); this.modelMeshes.push({ mesh, part });
    }
    this.flameRoots = new THREE.Group(); this.scene.add(this.flameRoots);
    const pools = this.original.group.children.filter(o => o.isMesh && o.material.map);
    for (let i = 0; i < MAX; i++) {
      const root = new THREE.Group(); root.name = i ? `StepOilLamp${i}` : 'MainOilLamp';
      root.quaternion.copy(this.rotation); this.flameRoots.add(root);
      const flame = this.original.flame.clone(true);
      flame.traverse(o => { if (o.isMesh && o.material?.isShaderMaterial) { o.material = o.material.clone(); o.userData.baseOpacity = o.material.uniforms.uOpacity.value; } });
      const glow = this.original.flameGlow.clone(); glow.material = glow.material.clone();
      const floorPools = pools.map(o => { const clone = o.clone(); clone.material = o.material.clone(); root.add(clone); return clone; });
      root.add(flame, glow);
      this.states.push({ root, flame, glow, floorPools, lit: false, progress: 0, ignitionStart: null });
    }
    this.mainLight = this.original.flameLight.clone(); this.scene.add(this.mainLight);
    const reference = new Image(); reference.src = 'assets/kovil-background.png'; await reference.decode();
    this.flags = await createImageFlags(reference); this.scene.add(this.flags.group);
    this.welcomeFlags = await createWelcomeScrollFlags(); this.scene.add(this.welcomeFlags.group);
    this._resizeObserver = new ResizeObserver(() => this.invalidate());
    this._resizeObserver.observe(this.screen); this._resizeObserver.observe(this.frame);
    this._mutationObserver = new MutationObserver(() => this.invalidate());
    this._mutationObserver.observe(this.board, { childList: true, subtree: true });
    this._visibility = () => { this._previous = 0; if (document.hidden) this._cancelFrame(); else this.invalidate(); };
    document.addEventListener('visibilitychange', this._visibility);
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this._lost = true; this._cancelFrame(); this.board.dataset.lamp3dReady = 'false'; this.screen.dataset.stageReady = 'false'; });
    this.canvas.addEventListener('webglcontextrestored', () => { this._lost = false; this.board.dataset.lamp3dReady = 'true'; this.screen.dataset.stageReady = 'true'; this.invalidate(); });
    this.ready = true; this.board.dataset.lamp3dReady = 'true'; this.screen.dataset.stageReady = 'true';
    this._syncStates(); this.invalidate();
  }

  sync({ lit = [], rowCounts = [], ...config } = {}) {
    this.rowCounts = rowCounts.slice(); this.pendingLit = lit.slice(0, 30);
    for (const key of Object.keys(this.config)) if (Number.isFinite(Number(config[key]))) this.config[key] = THREE.MathUtils.clamp(Number(config[key]), 10, 100);
    this._syncStates(); this.invalidate();
  }
  _syncStates() {
    if (!this.ready) return;
    this.lamps = this.states.slice(1, (this.pendingLit?.length || 0) + 1);
    this.lamps.forEach((state, i) => {
      const value = Boolean(this.pendingLit[i]);
      if (value !== state.lit) { state.lit = value; state.progress = 0; state.ignitionStart = value ? this.time : null; }
    });
    this.states.slice(this.lamps.length + 1).forEach(state => { state.lit = false; state.progress = 0; state.ignitionStart = null; });
  }
  ignite(index) {
    const state = this.states[index + 1]; if (!state) return;
    state.lit = true; state.progress = 0; state.ignitionStart = this.time; this._requestFrame();
  }
  handleMainMessage(message) {
    const main = this.states[0];
    if (message.type === 'config') { for (const key of Object.keys(this.config)) if (Number.isFinite(Number(message[key]))) this.config[key] = THREE.MathUtils.clamp(Number(message[key]), 10, 100); }
    if (message.type === 'pause') { this.mainPaused = Boolean(message.value); this.mainTime = this.time; }
    if (main && message.type === 'ignite') { main.lit = true; main.progress = 0; main.ignitionStart = this.time; }
    if (main && message.type === 'lit') { main.lit = Boolean(message.value); main.progress = main.lit ? 1 : 0; main.ignitionStart = null; }
    this._requestFrame();
  }
  setPaused(value) { this.paused = Boolean(value); this._previous = 0; if (this.paused) this._cancelFrame(); else this.invalidate(); }
  setActive(value) { this.active = Boolean(value); this._previous = 0; if (!this.active) this._cancelFrame(); else this.invalidate(); }
  setTracking(value) { this._tracking = Boolean(value); this.invalidate(); }
  invalidate() { this._layoutDirty = true; this._requestFrame(); }
  _cancelFrame() { cancelAnimationFrame(this._frame); this._frame = 0; }
  _requestFrame() { if (this.ready && this.active && !this.paused && !document.hidden && !this._lost && !this._frame) this._frame = requestAnimationFrame(this._tick); }
  _opacity(element) {
    let opacity = 1;
    for (let node = element; node && node !== this.screen; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return 0;
      opacity *= Number(style.opacity);
    }
    return opacity;
  }
  _measure() {
    const s = this.screen.getBoundingClientRect(), f = this.frame.getBoundingClientRect();
    if (s.width < 1 || s.height < 1) return false;
    const dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1800000 / (s.width * s.height)));
    if (this.width !== s.width || this.height !== s.height || this.dpr !== dpr) {
      this.width = s.width; this.height = s.height; this.dpr = dpr;
      this.renderer.setPixelRatio(dpr); this.renderer.setSize(s.width, s.height, false);
      Object.assign(this.camera, { right: s.width, top: s.height }); this.camera.updateProjectionMatrix();
      this.scene.children.filter(o => o.isDirectionalLight).forEach((light, i) => {
        light.position.set(i ? -900 : s.width * .72, s.height * 1.6, i ? 400 : 1300);
        light.target.position.set(s.width / 2, s.height / 2, 0); if (!light.target.parent) this.scene.add(light.target);
      });
    }
    const scale = f.width / 1672; this.flags.group.scale.setScalar(scale);
    this.flags.group.position.set(f.left - s.left, s.bottom - f.bottom, 0);
    const elements = [this.screen.querySelector('#ceremony-lamp-button'), ...this.board.querySelectorAll('.status-bowl')];
    this.slots = elements.map(element => {
      const r = element.getBoundingClientRect();
      return { x: r.left - s.left + r.width / 2, y: s.bottom - r.bottom, scale: r.width / 4.12, opacity: this._opacity(element) };
    });
    const matrix = new THREE.Matrix4(); this.placements = [];
    for (let i = 0; i < MAX; i++) {
      const slot = this.slots[i] || { x: 0, y: 0, scale: 0, opacity: 0 };
      const pos = new THREE.Vector3(slot.x, slot.y + this.footOffset * slot.scale, 70);
      this.opacityAttribute.setX(i, slot.opacity);
      this.states[i].root.position.copy(pos); this.states[i].root.scale.setScalar(slot.scale);
      matrix.compose(pos, this.rotation, new THREE.Vector3(slot.scale, slot.scale, slot.scale));
      for (const { mesh, part } of this.modelMeshes) mesh.setMatrixAt(i, matrix.clone().multiply(part.matrix));
      this.placements.push({ x: slot.x, y: s.height - slot.y, width: slot.scale * 4.12, opacity: slot.opacity });
    }
    this.modelMeshes.forEach(({ mesh }) => { mesh.count = elements.length; mesh.instanceMatrix.needsUpdate = true; });
    this.opacityAttribute.needsUpdate = true; this.models.visible = this.slots.some(slot => slot.opacity > .001);
    const main = this.slots[0];
    if (main) {
      this.mainLight.position.copy(this.original.flameLight.position).multiplyScalar(main.scale).applyQuaternion(this.rotation).add(this.states[0].root.position);
      this.mainLight.distance = main.scale * 6.5;
    }
    this._layoutDirty = false; return true;
  }
  _render() {
    if ((this._layoutDirty || this._tracking) && !this._measure()) return;
    // Parent opacity changes during the original finale's CSS fade as well.
    const mainOpacity = this._opacity(this.screen.querySelector('#ceremony-lamp-button'));
    if (mainOpacity !== this.slots[0]?.opacity) this._measure();
    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i], slot = this.slots[i]; if (!slot || slot.opacity < .001) { state.root.visible = false; continue; }
      state.root.visible = true;
      if (state.ignitionStart !== null) {
        const fraction = (this.time - state.ignitionStart) / 1.55;
        state.progress = smooth(fraction); if (fraction >= 1) state.ignitionStart = null;
      }
      const time = i === 0 && this.mainPaused ? this.mainTime : this.time;
      this.original.update({ time, progress: state.lit ? state.progress : 0, phase: i * 2.399, ...this.config });
      state.flame.visible = this.original.flame.visible; state.flame.scale.copy(this.original.flame.scale);
      state.flame.children.forEach(child => { if (child.material?.uniforms?.uTime) { child.material.uniforms.uTime.value = time + i * 2.399; child.material.uniforms.uOpacity.value = child.userData.baseOpacity * slot.opacity; } });
      state.glow.material.opacity = this.original.flameGlow.material.opacity * slot.opacity * .7;
      state.floorPools.forEach((pool, j) => { pool.material.opacity = (j ? this.original.group.children[j].material.opacity : .8) * slot.opacity; });
      if (!i) this.mainLight.intensity = this.original.flameLight.intensity * slot.scale * slot.scale * slot.opacity;
    }
    this.mainProgress = this.states[0].progress;
    if (!this.slots[0]?.opacity) this.mainLight.intensity = 0;
    this.flags.group.visible = !this.screen.classList.contains('finale-running');
    this.welcomeFlags.update(this.time, this.width, this.height, this.screen.classList.contains('finale-welcome'));
    this.flags.update(this.time); this.renderer.render(this.scene, this.camera);
  }
  _tick(now) {
    this._frame = 0; if (!this.active || this.paused || document.hidden) { this._previous = 0; return; }
    if (this._previous) this.time += Math.max(0, now - this._previous) / 1000;
    this._previous = now;
    if (now - this._lastRender >= 1000 / 30) { this._lastRender = now; this._render(); }
    this._requestFrame();
  }
}
