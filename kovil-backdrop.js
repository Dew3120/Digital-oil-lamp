/* Local canvas masks for the immutable supplied ceremony image. */
export class KovilBackdrop {
  constructor({ screen, frame, image, canvas }) {
    this.screen = screen;
    this.frame = frame;
    this.image = image;
    this.canvas = canvas;
    this.width = 1672;
    this.height = 941;
    this.originalSrc = image.getAttribute('src') || 'assets/kovil-background.png';
    this.sourceImage = new Image();
    this.state = { title: 'Problem Lab 1.0', titleFont: 'Cinzel', background: '' };
    this.screen.dataset.kovilBakedTitle = 'true';
    this.screen.dataset.kovilCustomBackground = 'false';
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.resize = this.resize.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(screen);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.ready = new Promise((resolve, reject) => {
      this.sourceImage.onload = () => {
        if (this.sourceImage.naturalWidth !== this.width || this.sourceImage.naturalHeight !== this.height) {
          reject(new Error('The kovil backdrop must be the original 1672 × 941 image.'));
          return;
        }
        this._basePatches = this.buildBasePatches();
        this.draw();
        resolve(this);
      };
      this.sourceImage.onerror = () => reject(new Error('The original kovil backdrop could not be loaded.'));
      this.sourceImage.src = this.originalSrc;
    });
  }

  resize() {
    const rectangle = this.screen.getBoundingClientRect();
    const width = rectangle.width || window.innerWidth;
    const height = rectangle.height || window.innerHeight;
    const scale = Math.min(width / this.width, height / this.height);
    this.frame.style.setProperty('--kovil-scale', String(scale));
    this.screen.style.setProperty('--kovil-scale', String(scale));
    this.screen.dispatchEvent(new CustomEvent('kovil-frame-resize', {
      detail: { scale, width: this.width, height: this.height },
    }));
  }

  sync(settings = {}) {
    this.state = { ...this.state, ...settings };
    const customBackground = Boolean(this.state.background)
      && this.state.background !== this.originalSrc;
    this.screen.dataset.kovilCustomBackground = String(customBackground);
    const displaySource = customBackground ? this.state.background : this.originalSrc;
    if (this.image.getAttribute('src') !== displaySource) this.image.src = displaySource;
    const defaultTitle = String(this.state.title || '').trim().replace(/\s+/g, ' ').toUpperCase() === 'PROBLEM LAB 1.0';
    const defaultFont = !this.state.titleFont || this.state.titleFont === 'Cinzel';
    this.screen.dataset.kovilBakedTitle = String(defaultTitle && defaultFont && !customBackground);
    const title = this.screen.querySelector('#ceremony-title');
    if (title && this.screen.dataset.kovilBakedTitle === 'false') {
      const measure = document.createElement('canvas').getContext('2d');
      const family = getComputedStyle(title).fontFamily;
      measure.font = `68px ${family}`;
      const textWidth = measure.measureText(title.textContent.toUpperCase()).width;
      this.frame.style.setProperty('--kovil-title-size', `${Math.min(68, 550 * 68 / Math.max(1, textWidth))}px`);
    }
    this.resize();
    return this.ready.then(() => { this.draw(); return this; });
  }

  setPresentation(active) {
    this.screen.dataset.kovilPresentation = String(Boolean(active));
    // The four printed sample buttons are masked in both modes. The app decides
    // when its real, accessible controls are visible.
    this.draw();
  }

  draw() {
    const context = this.canvas.getContext('2d');
    context.clearRect(0, 0, this.width, this.height);
    if (!this._basePatches || this.screen.dataset.kovilCustomBackground === 'true') return;
    context.drawImage(this._basePatches, 0, 0);
    if (this.screen.dataset.kovilBakedTitle === 'false') {
      this.sideSamplePatch(context, { x: 547, y: 41, w: 572, h: 66 },
        { left: 523, right: 1130, width: 18 }, 'round', 5);
    }
  }

  buildBasePatches() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d');

    // Original main bowl only. Its temple surroundings, plinth silhouette, and
    // cyan stonework are outside this locally feathered mask. Donors sit in the
    // same open portal above it and the exposed plinth surface beside its base.
    this.mainBowlPatch(context, { x: 684, y: 360, w: 294, h: 168 }, [
        [689, 395], [705, 380], [754, 375], [885, 377], [931, 385],
        [938, 366], [970, 364], [974, 405], [963, 452], [946, 485],
        [919, 512], [894, 523], [773, 523], [743, 511], [720, 482],
        [701, 446], [689, 421],
      ], 5);

    // Printed instruction and its ornamental line on the unchanged plinth.
    this.sideSamplePatch(context, { x: 690, y: 527, w: 296, h: 52 },
      { left: 666, right: 983, width: 24 }, 'round', 4);

    // Remove the sample cyan active ring before clearing the small sample bowls.
    this.clonePatch(context, { x: 551, y: 607, w: 184, h: 65 },
      { x: 724, y: 607, w: 64, h: 65 }, 'ellipse', 4);
    this.sideSamplePatch(context, { x: 448, y: 572, w: 45, h: 63 },
      { left: 433, right: 499, width: 8 }, 'round', 4);

    const rows = [
      { centers: [447, 643, 836, 1028, 1224], bowlY: 622, numberY: 659, height: 74, width: 116 },
      { centers: [437, 637, 838, 1034, 1233], bowlY: 699, numberY: 736, height: 72, width: 116 },
      { centers: [420, 627, 835, 1043, 1250.5], bowlY: 779, numberY: 820, height: 76, width: 120 },
    ];
    for (const row of rows) {
      for (const center of row.centers) {
        const rectangle = { x: center - row.width / 2, y: row.bowlY - row.height / 2, w: row.width, h: row.height };
        this.clonePatch(context, rectangle,
          { x: center + 69, y: rectangle.y, w: 56, h: rectangle.h }, 'ellipse', 5);
        // The first two labels sit below the baked flame glow and active ring.
        // Their immediate side pixels contain those old highlights, so use the
        // nearby unlit stone between the ring and the third sample bowl.
        const numberSample = row.numberY === 659 && center === 643
          ? { left: 749, right: 782, width: 8 }
          : row.numberY === 659 && center === 447
            ? { left: 510, right: 546, width: 8 }
            : { left: center - 38, right: center + 30, width: 8 };
        this.sideSamplePatch(context,
          { x: center - 27, y: row.numberY - 17, w: 54, h: 35 },
          numberSample, 'round', 4);
      }
    }

    // Printed footer controls are each masked within their own pill footprint.
    // Donors in the narrow gaps beside each button retain the same floor plane
    // and illumination; all architecture remains untouched.
    for (const { rectangle, sample } of [
      { rectangle: { x: 409, y: 848, w: 226, h: 84 }, sample: { left: 406, right: 625, width: 8 } },
      { rectangle: { x: 625, y: 848, w: 202, h: 84 }, sample: { left: 625, right: 820, width: 8 } },
      { rectangle: { x: 819, y: 848, w: 214, h: 84 }, sample: { left: 820, right: 1023, width: 8 } },
      { rectangle: { x: 1025, y: 848, w: 238, h: 84 }, sample: { left: 1023, right: 1257, width: 8 } },
    ]) this.sideSamplePatch(context, rectangle, sample, 'pill', 5);
    return canvas;
  }

  clonePatch(context, rectangle, sample, shape, feather) {
    const patch = patchCanvas(rectangle);
    patch.getContext('2d').drawImage(this.sourceImage,
      sample.x, sample.y, sample.w, sample.h, 0, 0, patch.width, patch.height);
    applyMask(patch, rectangle, shape, feather);
    context.drawImage(patch, rectangle.x, rectangle.y);
  }

  mainBowlPatch(context, rectangle, shape, feather) {
    const patch = patchCanvas(rectangle);
    const painter = patch.getContext('2d');
    const portalHeight = 134;
    // The open portal immediately above the sample bowl retains its centered
    // blue illumination. Sidewall donors would create a dark bowl-shaped hole.
    painter.drawImage(this.sourceImage, rectangle.x, 339, rectangle.w, 30,
      0, 0, patch.width, portalHeight);
    const plinthHeight = patch.height - portalHeight;
    painter.drawImage(this.sourceImage, 717, 494, 28, plinthHeight,
      0, portalHeight, patch.width, plinthHeight);
    const right = document.createElement('canvas');
    right.width = patch.width;
    right.height = plinthHeight;
    const rightContext = right.getContext('2d');
    rightContext.drawImage(this.sourceImage, 933, 494, 37, plinthHeight,
      0, 0, right.width, right.height);
    const gradient = rightContext.createLinearGradient(0, 0, right.width, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,1)');
    rightContext.globalCompositeOperation = 'destination-in';
    rightContext.fillStyle = gradient;
    rightContext.fillRect(0, 0, right.width, right.height);
    painter.drawImage(right, 0, portalHeight);
    applyMask(patch, rectangle, shape, feather);
    context.drawImage(patch, rectangle.x, rectangle.y);
  }

  sideSamplePatch(context, rectangle, sample, shape, feather) {
    const patch = patchCanvas(rectangle);
    const painter = patch.getContext('2d');
    painter.drawImage(this.sourceImage, sample.left, rectangle.y, sample.width, rectangle.h,
      0, 0, patch.width, patch.height);
    const right = patchCanvas(rectangle);
    const rightContext = right.getContext('2d');
    rightContext.drawImage(this.sourceImage, sample.right, rectangle.y, sample.width, rectangle.h,
      0, 0, right.width, right.height);
    const gradient = rightContext.createLinearGradient(0, 0, right.width, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,1)');
    rightContext.globalCompositeOperation = 'destination-in';
    rightContext.fillStyle = gradient;
    rightContext.fillRect(0, 0, right.width, right.height);
    painter.drawImage(right, 0, 0);
    applyMask(patch, rectangle, shape, feather);
    context.drawImage(patch, rectangle.x, rectangle.y);
  }

  dispose() {
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.resize);
  }
}

function patchCanvas(rectangle) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(rectangle.w);
  canvas.height = Math.ceil(rectangle.h);
  return canvas;
}

function applyMask(patch, rectangle, shape, feather) {
  const mask = patchCanvas(rectangle);
  const context = mask.getContext('2d');
  const f = Math.max(0, feather);
  context.fillStyle = '#fff';
  context.filter = `blur(${f}px)`;
  context.beginPath();
  if (Array.isArray(shape)) {
    shape.forEach(([x, y], index) => {
      if (index) context.lineTo(x - rectangle.x, y - rectangle.y);
      else context.moveTo(x - rectangle.x, y - rectangle.y);
    });
    context.closePath();
  } else if (shape === 'ellipse') {
    context.ellipse(mask.width / 2, mask.height / 2,
      mask.width / 2 - f, mask.height / 2 - f, 0, 0, Math.PI * 2);
  } else {
    const radius = shape === 'pill' ? mask.height / 2 - f : Math.min(8, mask.height / 3);
    context.roundRect(f, f, mask.width - f * 2, mask.height - f * 2, radius);
  }
  context.fill();
  // Blur falls across a path edge. Saturating its inner third moves the soft
  // transition outside the original object and keeps the removal core opaque.
  // This operates only on alpha in the temporary mask, never on source pixels.
  const alpha = context.getImageData(0, 0, mask.width, mask.height);
  for (let index = 3; index < alpha.data.length; index += 4) {
    alpha.data[index] = Math.min(255, alpha.data[index] * 3);
  }
  context.putImageData(alpha, 0, 0);
  const painter = patch.getContext('2d');
  painter.globalCompositeOperation = 'destination-in';
  painter.drawImage(mask, 0, 0);
  painter.globalCompositeOperation = 'source-over';
}

export default KovilBackdrop;
