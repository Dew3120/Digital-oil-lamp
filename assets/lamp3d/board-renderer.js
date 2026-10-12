import * as THREE from './vendor/three.module.js';
import { configureLampRenderer, createLampScene } from './lamp-factory.js';

const MAX_LAMPS = 30;
const FRAME_INTERVAL = 1000 / 30;
const DEFAULT_CONFIG = { flameSize: 70, flameVolume: 70, lightIntensity: 80 };

/** One transparent WebGL canvas, one shared lamp, one scissor per DOM slot. */
export class BoardLampRenderer {
  constructor({ canvas, board }) {
    this.canvas = canvas;
    this.board = board;
    this.config = { ...DEFAULT_CONFIG };
    this.lamps = [];
    this.slots = [];
    this.rowCounts = [];
    this.time = 0;
    this._frame = 0;
    this._lastTimestamp = 0;
    this._lastRender = 0;
    this._paused = false;
    this._tracking = false;
    this._inView = true;
    this._lost = false;
    this._disposed = false;
    this._dirty = true;
    this._layoutDirty = true;
    this._dpr = 0;
    this._width = 0;
    this._height = 0;
    this.ready = false;
    this._tick = this._tick.bind(this);
    this._invalidateLayout = this._invalidateLayout.bind(this);
    this._visibilityChanged = this._visibilityChanged.bind(this);
    this._contextLost = this._contextLost.bind(this);
    this._contextRestored = this._contextRestored.bind(this);

    if (!canvas || !board) return;
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none'
    });
    canvas.setAttribute('aria-hidden', 'true');
    this._markReady(false);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      configureLampRenderer(this.renderer);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.autoClear = false;
      // The shared contact shadow supplies the grounding at these small sizes.
      // Avoiding a separate shadow-map pass for every slot keeps 30 lamps fluid.
      this.renderer.shadowMap.enabled = false;
      this._createScene();
    } catch (error) {
      this.renderer?.dispose();
      this.renderer = null;
      console.warn('The 3D lamp board is using its image fallback.', error);
      return;
    }

    canvas.addEventListener('webglcontextlost', this._contextLost);
    canvas.addEventListener('webglcontextrestored', this._contextRestored);
    document.addEventListener('visibilitychange', this._visibilityChanged);
    window.addEventListener('resize', this._invalidateLayout);
    window.addEventListener('scroll', this._invalidateLayout, true);
    this._resizeObserver = new ResizeObserver(this._invalidateLayout);
    this._resizeObserver.observe(board);
    this._resizeObserver.observe(canvas);
    this._mutationObserver = new MutationObserver(this._invalidateLayout);
    this._mutationObserver.observe(board, { childList: true, subtree: true });
    if ('IntersectionObserver' in window) {
      this._intersectionObserver = new IntersectionObserver(entries => {
        this._inView = entries.some(entry => entry.isIntersecting);
        this._lastTimestamp = 0;
        if (this._inView) this._invalidateLayout();
        else this._cancelFrame();
      });
      this._intersectionObserver.observe(board);
    }
    this._requestFrame();
  }

  _createScene() {
    this.lamp?.dispose();
    this.lamp = createLampScene({ renderer: this.renderer, embedded: true, shadows: false });
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    this._target = new THREE.Vector3(0.12, 1.48, 0);
    // Same viewing direction as the main lamp iframe.
    this._direction = new THREE.Vector3(2.7, 1.92, 8.2).normalize();
    this._right = new THREE.Vector3().crossVectors(this.camera.up, this._direction).normalize();
    this._up = new THREE.Vector3().crossVectors(this._direction, this._right).normalize();
    this._fitPoints = [];
    this.lamp.update({ progress: 1, flameSize: 100, flameVolume: 100 });
    this.lamp.model.updateMatrixWorld(true);
    this.lamp.model.traverse(object => {
      if (!object.geometry) return;
      object.geometry.computeBoundingBox();
      const { min, max } = object.geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        const point = new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld).sub(this._target);
        this._fitPoints.push({ x: point.dot(this._right), y: point.dot(this._up), z: point.dot(this._direction) });
      }
    });
    this.lamp.update();
    const materials = new Set();
    this.lamp.scene.traverse(object => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material) materials.add(material);
      }
    });
    this._materialStates = Array.from(materials, material => ({ material, transparent: material.transparent }));
    this._opacityMode = false;
  }

  _setOpacityMode(value) {
    if (value === this._opacityMode) return;
    this._opacityMode = value;
    for (const state of this._materialStates) {
      const transparent = value || state.transparent;
      if (state.material.transparent !== transparent) {
        state.material.transparent = transparent;
        state.material.needsUpdate = true;
      }
    }
  }

  _applySlotOpacity(value) {
    for (const state of this._materialStates) {
      const material = state.material;
      // Capture after lamp.update(), which supplies the current flame glow and
      // light-pool opacity. Restore after this viewport to keep lamps independent.
      state.opacity = material.opacity;
      material.opacity *= value;
      if (material.uniforms?.uOpacity) {
        state.shaderOpacity = material.uniforms.uOpacity.value;
        material.uniforms.uOpacity.value *= value;
      }
    }
  }

  _restoreSlotOpacity() {
    for (const state of this._materialStates) {
      state.material.opacity = state.opacity;
      if (state.material.uniforms?.uOpacity) state.material.uniforms.uOpacity.value = state.shaderOpacity;
    }
  }

  sync({ lit = [], rowCounts = [], ...config } = {}) {
    if (this._disposed) return;
    this.rowCounts = Array.isArray(rowCounts) ? rowCounts.slice(0, 6) : [];
    const count = Math.min(MAX_LAMPS, Math.trunc(Math.max(lit.length || 0, this.rowCounts.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0))));
    for (let index = 0; index < count; index++) {
      const value = Boolean(lit[index]);
      const current = this.lamps[index];
      if (!current) this.lamps[index] = { lit: value, progress: value ? 1 : 0, ignitionStart: null };
      else if (value !== current.lit) {
        current.lit = value;
        current.progress = 0;
        current.ignitionStart = value ? this.time : null;
      }
    }
    this.lamps.length = count;
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      const value = Number(config[key]);
      if (Number.isFinite(value)) this.config[key] = THREE.MathUtils.clamp(value, 10, 100);
    }
    this._invalidateLayout();
  }

  ignite(index) {
    if (this._disposed || !Number.isInteger(index) || index < 0 || index >= MAX_LAMPS) return;
    const lamp = this.lamps[index] ||= { lit: false, progress: 0, ignitionStart: null };
    lamp.lit = true;
    lamp.progress = 0;
    lamp.ignitionStart = this.time;
    this._dirty = true;
    this._requestFrame();
  }

  setPaused(value) {
    this._paused = Boolean(value);
    this._lastTimestamp = 0;
    if (this._paused) this._cancelFrame();
    else { this._dirty = true; this._requestFrame(); }
  }

  setTracking(value) {
    if (this._disposed) return;
    this._tracking = Boolean(value);
    this._invalidateLayout();
  }

  _markReady(value) {
    if (this.ready === value && this.canvas?.dataset.lamp3dReady === String(value) && this.board?.dataset.lamp3dReady === String(value)) return;
    this.ready = value;
    for (const element of [this.canvas, this.board]) {
      if (!element) continue;
      element.dataset.lamp3dReady = String(value);
      element.dataset.ready = String(value);
    }
    if (this.canvas) this.canvas.style.visibility = value ? 'visible' : 'hidden';
  }

  _invalidateLayout() {
    this._layoutDirty = true;
    this._dirty = true;
    this._requestFrame();
  }

  _measure() {
    const canvasRect = this.canvas.getBoundingClientRect();
    const width = Math.round(canvasRect.width), height = Math.round(canvasRect.height);
    if (width < 1 || height < 1) { this.slots = []; return false; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (width !== this._width || height !== this._height || dpr !== this._dpr) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(width, height, false);
      this._width = width;
      this._height = height;
      this._dpr = dpr;
    }
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.slots = Array.from(this.board.querySelectorAll('.status-bowl[data-lamp-index]')).slice(0, MAX_LAMPS).flatMap(element => {
      const index = Number(element.dataset.lampIndex);
      if (!Number.isInteger(index) || index < 0 || index >= MAX_LAMPS) return [];
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return [];
      const opacityElement = element.closest('.status-lamp') || element;
      const opacity = THREE.MathUtils.clamp(Number.parseFloat(getComputedStyle(opacityElement).opacity) || 0, 0, 1);
      const x = rect.left - canvasRect.left;
      const y = canvasRect.bottom - rect.bottom;
      const left = Math.max(0, x), bottom = Math.max(0, y);
      const right = Math.min(width, x + rect.width), top = Math.min(height, y + rect.height);
      if (right <= left || top <= bottom) return [];
      const aspect = rect.width / rect.height;
      let distance = 0;
      for (const point of this._fitPoints) {
        distance = Math.max(distance, Math.abs(point.x) / (tangent * aspect) + point.z, Math.abs(point.y) / tangent + point.z);
      }
      return [{ index, opacity, x, y, width: rect.width, height: rect.height, left, bottom, clipWidth: right - left, clipHeight: top - bottom, aspect, distance: distance * 1.05 }];
    });
    this._layoutDirty = false;
    return this.slots.length > 0;
  }

  _requestFrame() {
    if (!this._frame && this.renderer && !this._disposed && !this._lost && !this._paused && !document.hidden && this._inView) {
      this._frame = requestAnimationFrame(this._tick);
    }
  }

  _cancelFrame() {
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = 0;
  }

  _tick(timestamp) {
    this._frame = 0;
    if (this._disposed || this._lost || this._paused || document.hidden || !this._inView) { this._lastTimestamp = 0; return; }
    if (this._lastTimestamp) this.time += Math.max(0, (timestamp - this._lastTimestamp) / 1000);
    this._lastTimestamp = timestamp;
    if (!this._dirty && timestamp - this._lastRender < FRAME_INTERVAL) { this._requestFrame(); return; }
    this._lastRender = timestamp;
    if (this._tracking) this._layoutDirty = true;
    if (this._dpr !== Math.min(window.devicePixelRatio || 1, 2)) this._layoutDirty = true;
    if (this._layoutDirty && !this._measure()) {
      this._markReady(false);
      this._lastTimestamp = 0;
      if (this._tracking) this._requestFrame();
      return;
    }

    try {
      const renderer = this.renderer;
      // Switch the opaque brass/wick materials into alpha blending once for the
      // tracking sequence, retaining their depth behavior and original blending.
      this._setOpacityMode(this._tracking || this.slots.some(slot => slot.opacity > 0 && slot.opacity < 1));
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, this._width, this._height);
      renderer.clear(true, true, true);
      renderer.setScissorTest(true);
      for (const slot of this.slots) {
        if (slot.opacity <= 0) continue;
        const state = this.lamps[slot.index] || { lit: false, progress: 0, ignitionStart: null };
        if (state.lit && state.ignitionStart !== null) {
          const raw = Math.min(1, (this.time - state.ignitionStart) / 1.55);
          state.progress = 1 - Math.pow(1 - raw, 2.2);
          if (raw >= 1) state.ignitionStart = null;
        }
        this.lamp.update({ time: this.time, progress: state.lit ? state.progress : 0, phase: slot.index * 2.399, ...this.config });
        this.camera.aspect = slot.aspect;
        this.camera.position.copy(this._direction).multiplyScalar(slot.distance).add(this._target);
        this.camera.lookAt(this._target);
        this.camera.updateProjectionMatrix();
        renderer.setViewport(slot.x, slot.y, slot.width, slot.height);
        renderer.setScissor(slot.left, slot.bottom, slot.clipWidth, slot.clipHeight);
        renderer.clearDepth();
        this._applySlotOpacity(slot.opacity);
        try { renderer.render(this.lamp.scene, this.camera); }
        finally { this._restoreSlotOpacity(); }
      }
      renderer.setScissorTest(false);
      if (this.slots.length && !renderer.getContext().isContextLost()) this._markReady(true);
      this._dirty = false;
    } catch (error) {
      this._markReady(false);
      this._lost = true;
      console.warn('The 3D lamp board is using its image fallback.', error);
      return;
    }
    if (this._tracking || this.slots.some(slot => this.lamps[slot.index]?.lit)) this._requestFrame();
    else this._lastTimestamp = 0;
  }

  _visibilityChanged() {
    this._lastTimestamp = 0;
    if (document.hidden) this._cancelFrame();
    else this._invalidateLayout();
  }

  _contextLost(event) {
    event.preventDefault();
    this._lost = true;
    this._cancelFrame();
    this._markReady(false);
  }

  _contextRestored() {
    if (this._disposed) return;
    try {
      this._createScene();
      this._lost = false;
      this._lastTimestamp = 0;
      this._invalidateLayout();
    } catch (error) {
      this._markReady(false);
      console.warn('The 3D lamp board could not restore its WebGL context.', error);
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._cancelFrame();
    this._resizeObserver?.disconnect();
    this._mutationObserver?.disconnect();
    this._intersectionObserver?.disconnect();
    this.canvas?.removeEventListener('webglcontextlost', this._contextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this._contextRestored);
    document.removeEventListener('visibilitychange', this._visibilityChanged);
    window.removeEventListener('resize', this._invalidateLayout);
    window.removeEventListener('scroll', this._invalidateLayout, true);
    this.lamp?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this._markReady(false);
  }
}
