import { BoardLampRenderer } from './assets/lamp3d/board-renderer.js';
import { FinaleScene } from './assets/lamp3d/finale-scene.js';
import { createLampFormation, sampleLampFormation } from './lamp-formation.js';

const ease = 'cubic-bezier(.22,1,.36,1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = value => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };

/** Owns one cancellable timeline. State changes remain with the ceremony app. */
export class CeremonyMotion {
  constructor({ screen, sendLamp, onBusy, boardRenderer }) {
    this.screen = screen;
    this.sendLamp = sendLamp;
    this.onBusy = onBusy;
    this.board = screen.querySelector('#status-board');
    this.layer = screen.querySelector('#ceremony-motion-layer');
    this.finaleLayer = screen.querySelector('#finale-layer');
    this.status = screen.querySelector('#motion-status');
    this.screen.append(this.screen.querySelector('.ceremony-tools'));
    this.boardHome = this.board.parentElement;
    this.boardRenderer = boardRenderer || new BoardLampRenderer({ canvas: screen.querySelector('#status-lamp-canvas'), board: this.board });
    this.animations = new Set();
    this.pausedAnimations = new Set();
    this.busy = false;
    this.paused = false;
    this.version = 0;
    this.frame = 0;
    this.finale = null;
    this.config = {};
    this._visibility = () => { if (document.hidden && this.busy && !this.paused) this.setPaused(true); };
    document.addEventListener('visibilitychange', this._visibility);
  }

  sync(config) {
    this.config = config;
    this.boardRenderer.sync(config);
  }

  setBusy(value) {
    this.busy = value;
    this.screen.dataset.motionBusy = String(value);
    this.onBusy?.(value);
  }

  announce(text) { this.status.textContent = text; }

  setPaused(value) {
    this.paused = Boolean(value);
    if (this.paused) {
      for (const animation of this.animations) {
        if (animation.playState === 'running') { this.pausedAnimations.add(animation); animation.pause(); }
      }
    } else {
      for (const animation of this.pausedAnimations) if (animation.playState === 'paused') animation.play();
      this.pausedAnimations.clear();
    }
    this.boardRenderer.setPaused(this.paused || (!this.boardRenderer.isKovilStageRenderer && this.screen.classList.contains('finale-welcome')));
    this.finale?.setPaused(this.paused);
    this.sendLamp({ type: 'pause', value: this.paused || this.screen.classList.contains('finale-running') });
    const button = this.screen.querySelector('#pause-ceremony');
    button.textContent = this.paused ? '▶  RESUME' : 'Ⅱ  PAUSE';
    button.setAttribute('aria-pressed', String(this.paused));
    this.screen.classList.toggle('motion-paused', this.paused);
    this.announce(this.paused ? 'Ceremony paused. Select Resume to continue.' : 'Ceremony resumed.');
  }

  async wait(ms, version = this.version) {
    let elapsed = 0, last = performance.now();
    return new Promise(resolve => {
      const tick = now => {
        if (version !== this.version) return resolve(false);
        if (!this.paused) elapsed += Math.max(0, now - last);
        last = now;
        if (elapsed >= ms) return resolve(true);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  animate(element, frames, options = {}) {
    const animation = element.animate(frames, { duration: reduced() ? 180 : 1000, easing: ease, fill: 'both', ...options });
    this.animations.add(animation);
    if (this.paused) { this.pausedAnimations.add(animation); animation.pause(); }
    animation.finished.catch(() => {});
    return animation;
  }

  cancel() {
    this.version++;
    this.finaleResizeObserver?.disconnect();
    if (this.finaleReflow) {
      window.removeEventListener('resize', this.finaleReflow);
      document.removeEventListener('fullscreenchange', this.finaleReflow);
    }
    cancelAnimationFrame(this.frame);
    for (const animation of this.animations) animation.cancel();
    this.screen.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    this.animations.clear();
    this.pausedAnimations.clear();
    this.layer.replaceChildren();
    this.finaleLayer.hidden = true;
    this.finale?.setPhase('hidden');
    this.boardRenderer.setTracking(false);
    if (this.board.parentElement !== this.boardHome) this.boardHome.append(this.board);
    this.screen.classList.remove('finale-running', 'finale-welcome', 'portrait-departing', 'guest-arriving');
    this.screen.dataset.phase = 'ready';
    this.board.removeAttribute('style');
    this.screen.querySelectorAll('.status-lamp').forEach(slot => { slot.removeAttribute('style'); delete slot.dataset.finaleEntrySide; });
    this.screen.querySelectorAll('.status-bowl').forEach(bowl => bowl.removeAttribute('style'));
    this.screen.querySelectorAll('.guest-token').forEach(token => token.removeAttribute('style'));
    this.screen.querySelectorAll('.guest-spotlight,.ceremony-main,.ceremony-header,.ceremony-lamp-stage,.ceremony-progress').forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
    this.setPaused(false);
    this.setBusy(false);
  }

  async lightGuest({ index, guest, last, onAdvance, onComplete }) {
    if (this.busy || this.paused) return;
    const version = ++this.version;
    this.setBusy(true);
    this.screen.dataset.phase = 'igniting';
    this.boardRenderer.ignite(index);
    const lampsOnly = this.config.guestDisplayMode === 'lamps-only';
    this.announce(lampsOnly || this.config.guestDisplayMode === 'photos-only' ? `Lighting lamp ${index + 1}.` : `Lighting the lamp for ${guest.name}.`);
    this.screen.querySelector('#ceremony-hint').innerHTML = '<span>Igniting your flame</span><span>A moment of shared purpose</span>';
    if (!await this.wait(1700, version)) return;
    this.screen.dataset.phase = 'flame-hold';
    this.screen.querySelector('#ceremony-hint').innerHTML = '<span>Your flame is lit</span><span>A moment of shared purpose</span>';
    if (!await this.wait(1600, version)) return;
    this.screen.dataset.phase = 'portrait-transfer';
    const namesOnly = this.config.guestDisplayMode === 'names-only';
    const source = lampsOnly ? null : this.screen.querySelector(namesOnly ? '.guest-nameplate' : '.portrait-frame');
    const target = this.screen.querySelector(`.guest-token[data-guest-index="${index}"]`);
    if (source && target) {
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const flying = source.cloneNode(true);
      flying.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      flying.removeAttribute('id');
      flying.className = namesOnly ? 'portrait-flight name-flight' : 'portrait-flight';
      Object.assign(flying.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
      this.layer.append(flying);
      this.screen.classList.add('portrait-departing');
      const dx = to.left - from.left, dy = to.top - from.top;
      const sx = to.width / from.width, sy = to.height / from.height;
      this.animate(flying, [
        { transform: 'translate3d(0,0,0) scale(1,1)' },
        { transform: `translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})` }
      ], { duration: reduced() ? 220 : 2300, easing: 'cubic-bezier(.4,0,.2,1)' });
      if (!await this.wait(reduced() ? 230 : 2320, version)) return;
      flying.remove();
      target.classList.add('token-visible');
      target.style.opacity = '1';
      this.animate(target, [{ boxShadow: '0 0 32px #54f9ff' }, { boxShadow: '0 0 8px #52baff66' }], { duration: 800, fill: 'none' });
    }
    if (!await this.wait(reduced() ? 100 : 220, version)) return;
    if (last) {
      onComplete();
      await this.runFinale(guest, version);
    } else {
      onAdvance();
      this.screen.classList.remove('portrait-departing');
      this.screen.dataset.phase = 'guest-arrival';
      this.animate(this.screen.querySelector('.guest-spotlight'), [
        { opacity: 0, transform: 'translate3d(32px,12px,0)', filter: 'blur(8px)' },
        { opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0)' }
      ], { duration: reduced() ? 180 : 800, fill: 'none' });
      if (!await this.wait(reduced() ? 190 : 820, version)) return;
      this.screen.dataset.phase = 'ready';
      this.setBusy(false);
    }
  }

  async ensureFinale() {
    if (this.finale) return;
    try {
      this.finale = new FinaleScene({ canvas: this.screen.querySelector('#finale-3d') });
      await this.finale.ready;
      this.finale.setPaused(this.paused);
    } catch (error) {
      console.warn('Using the event logo fallback.', error);
      this.screen.querySelector('#finale-3d').hidden = true;
      this.screen.querySelector('#finale-logo-fallback').hidden = false;
      this.finale = null;
    }
  }

  async runFinale(_guest, version = ++this.version) {
    this.setBusy(true);
    this.screen.dataset.phase = 'finale-portraits';
    this.announce('All lamps are lit. The opening ceremony finale is beginning.');
    const tokens = [...this.screen.querySelectorAll('.guest-token')];
    const rows = this.config.rowCounts || [3, 3, 3];
    const rowOf = index => { let end = 0; return rows.findIndex(count => (end += count) > index); };
    tokens.forEach((token, index) => {
      this.animate(token, [
        { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        { opacity: 0, transform: 'translateY(-65px) scale(.7)', filter: 'blur(10px)' }
      ], { delay: (rows.length - 1 - rowOf(index)) * 200 + index % 3 * 70, duration: reduced() ? 180 : 850 });
    });
    this.animate(this.screen.querySelector('.guest-spotlight'), [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-50px)', filter: 'blur(10px)' }], { duration: reduced() ? 180 : 900 });
    if (!await this.wait(reduced() ? 250 : 1500, version)) return;
    this.screen.dataset.phase = 'finale-ready';
    this.sendLamp({ type: 'lit', value: true });
    this.screen.querySelector('#ceremony-hint').innerHTML = '<span>Every flame is lit</span><span>One shared beginning</span>';
    await this.ensureFinale();
    if (version !== this.version) return;

    const screenRect = this.screen.getBoundingClientRect();
    const slots = [...this.screen.querySelectorAll('.status-lamp')];
    const bowls = slots.map(slot => slot.querySelector('.status-bowl').getBoundingClientRect());
    let plan = createLampFormation({ width: screenRect.width, height: screenRect.height, rowCounts: rows });
    const initialGatherDuration = plan.gatherDuration;
    const centers = bowls.map(rect => ({ x: rect.left - screenRect.left + rect.width / 2, y: rect.top - screenRect.top + rect.height / 2 }));
    if (this.boardRenderer.isKovilStageRenderer) this.screen.append(this.board);
    this.screen.classList.add('finale-running');
    slots.forEach((slot, index) => {
      Object.assign(slot.style, {
        position: 'absolute', left: `${centers[index].x - plan.lampWidth / 2}px`, top: `${centers[index].y - plan.lampHeight / 2}px`,
        width: `${plan.lampWidth}px`, height: `${plan.lampHeight}px`, minWidth: '0', margin: '0', transformOrigin: '50% 50%',
        transform: `scale(${bowls[index].width / plan.lampWidth},${bowls[index].height / plan.lampHeight})`, opacity: '1'
      });
      Object.assign(slot.querySelector('.status-bowl').style, { width: '100%', height: '100%', maxWidth: 'none', margin: '0' });
      slot.dataset.finaleEntrySide = plan.lamps[index].side < 0 ? 'left' : 'right';
    });
    this.screen.classList.add('finale-running');
    this.sendLamp({ type: 'pause', value: true });
    this.boardRenderer.setTracking(true);
    this.finaleLayer.hidden = false;
    this.finale?.setPhase('compuvate');
    const alignFinaleLogo = () => {
      const screenBounds = this.screen.getBoundingClientRect();
      const canvasBounds = this.screen.querySelector('#finale-3d').getBoundingClientRect();
      this.finale?.setCompuvateLayout({
        centerX: screenBounds.left + plan.centerX - canvasBounds.left,
        centerY: screenBounds.top + plan.centerY - canvasBounds.top,
        diameter: plan.logoDiameter
      });
      if (!this.finale) Object.assign(this.screen.querySelector('#finale-logo-fallback').style, {
        left: `${plan.centerX}px`, top: `${plan.centerY}px`, width: `${plan.logoDiameter}px`,
        height: `${plan.logoDiameter}px`, maxHeight: 'none', transform: 'translate(-50%, -50%)'
      });
    };
    alignFinaleLogo();
    const fallback = this.screen.querySelector('#finale-logo-fallback');
    fallback.src = 'assets/compuvate-logo.png';
    this.screen.dataset.phase = 'finale-gather';
    this.screen.querySelector('#finale-eyebrow').textContent = 'MANY FLAMES. ONE FUTURE.';
    const reducedMode = reduced();
    const exitDuration = reducedMode ? 120 : 700;
    const queueSpeed = reducedMode ? plan.gatherDuration / 700 : 1;
    const gatherDuration = exitDuration + plan.gatherDuration / queueSpeed;
    const orbitDuration = reducedMode ? 500 : 5100;
    const absorbDuration = reducedMode ? 400 : 2400;
    let elapsed = 0, last = performance.now();
    this.finale?.setCompuvateSpinProgress(0);
    const orbit = now => {
      if (version !== this.version) return;
      const bounds = this.screen.getBoundingClientRect();
      if (Math.abs(bounds.width - plan.width) > .5 || Math.abs(bounds.height - plan.height) > .5) {
        plan = createLampFormation({ width: bounds.width, height: bounds.height, rowCounts: rows });
        slots.forEach(slot => Object.assign(slot.style, { width: `${plan.lampWidth}px`, height: `${plan.lampHeight}px` }));
      }
      // Fullscreen changes the canvas bounds independently of the source-image frame.
      const canvasBounds = this.screen.querySelector('#finale-3d').getBoundingClientRect();
      const layoutKey = `${bounds.left},${bounds.top},${bounds.width},${bounds.height},${canvasBounds.left},${canvasBounds.top},${canvasBounds.width},${canvasBounds.height}`;
      if (layoutKey !== this.finaleLayoutKey) { this.finaleLayoutKey = layoutKey; alignFinaleLogo(); }
      const dt = Math.max(0, now - last); last = now;
      if (!this.paused) elapsed += dt;
      const orbitProgress = Math.max(0, elapsed - gatherDuration);
      const absorption = smooth((orbitProgress - orbitDuration) / absorbDuration);
      // Keep the lamps visible as they enter the emblem, then dissolve inside it.
      const fade = smooth((absorption - .82) / .18);
      if (orbitProgress >= orbitDuration) this.screen.dataset.phase = 'finale-absorb';
      this.finale?.setCompuvateSpinProgress(orbitProgress / orbitDuration);
      slots.forEach((slot, index) => {
        const center = centers[index];
        let x, y, opacity, sx = 1, sy = 1;
        if (elapsed < exitDuration) {
          const exit = smooth(elapsed / exitDuration);
          const side = plan.lamps[index].side;
          const offscreen = side < 0 ? -plan.lampWidth : plan.width + plan.lampWidth;
          x = center.x + (offscreen - center.x) * exit;
          y = center.y;
          opacity = 1 - exit;
          sx = (bowls[index].width / plan.lampWidth) * (1 - exit) + exit;
          sy = (bowls[index].height / plan.lampHeight) * (1 - exit) + exit;
        } else {
          const formationTime = (elapsed - exitDuration) * queueSpeed;
          const mappedTime = formationTime <= initialGatherDuration
            ? formationTime * plan.gatherDuration / initialGatherDuration
            : plan.gatherDuration + formationTime - initialGatherDuration;
          const point = sampleLampFormation(plan, index, mappedTime);
          // Contract the rotating circle into the logo; matching scale preserves spacing.
          const radialScale = 1 - absorption;
          x = plan.centerX + (point.x - plan.centerX) * radialScale;
          y = plan.centerY + (point.y - plan.centerY) * radialScale;
          opacity = point.opacity * (1 - fade);
          sx = sy = radialScale;
        }
        // Center resized bowls around the same viewport point, including fullscreen changes.
        slot.style.left = `${center.x - plan.lampWidth / 2}px`;
        slot.style.top = `${center.y - plan.lampHeight / 2}px`;
        slot.style.transform = `translate3d(${x - center.x}px,${y - center.y}px,0) scale(${sx},${sy})`;
        slot.style.opacity = String(opacity);
      });
      this.frame = requestAnimationFrame(orbit);
    };
    this.frame = requestAnimationFrame(orbit);
    this.finaleResizeObserver?.disconnect();
    this.finaleReflow = () => {
      if (version !== this.version) return;
      cancelAnimationFrame(this.frame);
      orbit(performance.now());
      this.boardRenderer.invalidate();
    };
    this.finaleResizeObserver = new ResizeObserver(this.finaleReflow);
    window.addEventListener('resize', this.finaleReflow);
    document.addEventListener('fullscreenchange', this.finaleReflow);
    this.finaleResizeObserver.observe(this.screen);
    this.finaleResizeObserver.observe(this.screen.querySelector('#finale-3d'));
    if (!await this.wait(gatherDuration + 40, version)) return;
    this.screen.dataset.phase = 'finale-orbit';
    this.animate(this.screen.querySelector('#finale-eyebrow'), [{ opacity: 0, letterSpacing: '.65em' }, { opacity: 1, letterSpacing: '.3em' }], { duration: 1400 });
    if (!await this.wait(orbitDuration + absorbDuration + 80, version)) return;
    this.finaleResizeObserver.disconnect();
    window.removeEventListener('resize', this.finaleReflow);
    document.removeEventListener('fullscreenchange', this.finaleReflow);
    cancelAnimationFrame(this.frame);
    slots.forEach(slot => { slot.style.opacity = '0'; });
    this.boardRenderer.setTracking(false);
    this.screen.dataset.phase = 'finale-welcome';
    this.screen.classList.add('finale-welcome');
    this.finale?.setPhase('problem-lab');
    fallback.src = 'assets/problem-lab-logo.jpg';
    this.screen.querySelector('#finale-eyebrow').textContent = 'COMPUVATE ASSOCIATION PRESENTS';
    const welcome = this.screen.querySelector('#finale-welcome');
    welcome.replaceChildren();
    const lead = document.createElement('span'); lead.className = 'welcome-lead'; lead.textContent = 'WELCOME TO';
    const title = document.createElement('span'); title.className = 'welcome-title';
    [...(this.config.title || 'Problem Lab 1.0')].forEach((letter, index) => {
      const span = document.createElement('span'); span.textContent = letter === ' ' ? '\u00a0' : letter;
      title.append(span);
      this.animate(span, [{ opacity: 0, transform: 'translateY(32px) rotateX(-75deg)', filter: 'blur(10px)' }, { opacity: 1, transform: 'translateY(0) rotateX(0)', filter: 'blur(0)' }], { delay: reduced() ? 0 : 1600 + index * 55, duration: reduced() ? 180 : 1000 });
    });
    welcome.append(lead, title);
    this.animate(lead, [{ opacity: 0, transform: 'translateY(15px)', letterSpacing: '.6em' }, { opacity: 1, transform: 'translateY(0)', letterSpacing: '.3em' }], { delay: reduced() ? 0 : 900, duration: 1200 });
    this.announce(`Welcome to ${this.config.title || 'Problem Lab'}. All guests have lit their lamps.`);
    if (!await this.wait(reduced() ? 500 : 4300, version)) return;
    this.boardRenderer.setPaused(this.boardRenderer.isKovilStageRenderer ? this.paused : true);
    this.setBusy(false);
    this.screen.querySelector('#next-guest').textContent = '↻  REPLAY FINALE';
    this.screen.querySelector('#next-guest').disabled = false;
  }
}
