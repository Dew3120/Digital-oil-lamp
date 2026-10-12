import * as THREE from './vendor/three.module.js';

/** The same geometry, materials, lighting and flame used by every lamp view. */
export function configureLampRenderer(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
}
function buildStudioEnvironment(renderer, scene) {
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 1024; envCanvas.height = 512;
  const ctx = envCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#526d90');
  gradient.addColorStop(0.38, '#243c61');
  gradient.addColorStop(0.57, '#e1b977');
  gradient.addColorStop(0.72, '#17293f');
  gradient.addColorStop(1, '#07101f');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 512);
  ctx.filter = 'blur(32px)';
  ctx.fillStyle = '#fff5d5'; ctx.fillRect(130, 86, 120, 250);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(565, 65, 205, 290);
  ctx.fillStyle = '#e7a956'; ctx.fillRect(876, 185, 66, 150);
  const texture = new THREE.CanvasTexture(envCanvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(texture);
  scene.environment = environment.texture;
  texture.dispose();
  pmrem.dispose();
  return environment;
}

export function createLampScene({ renderer, embedded = true, shadows = true }) {
  const scene = new THREE.Scene();
  scene.background = embedded ? null : new THREE.Color('#031126');
  scene.fog = embedded ? null : new THREE.Fog('#031126', 14, 28);
  const environment = buildStudioEnvironment(renderer, scene);
  const group = new THREE.Group();
  group.name = 'OilLampPresentation';
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xd4eaff, 0x081021, 1.35));
const key = new THREE.DirectionalLight(0xffdc9a, 3.8);
key.position.set(3.5, 7, 4.5);
key.castShadow = shadows;
key.shadow.mapSize.set(shadows ? 2048 : 256, shadows ? 2048 : 256);
key.shadow.camera.left = -6; key.shadow.camera.right = 6;
key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0004;
scene.add(key);
const fill = new THREE.DirectionalLight(0x8cbcff, 1.5);
fill.position.set(-4, 4, -4);
scene.add(fill);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#061528' }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.18;
floor.receiveShadow = true;
floor.visible = !embedded;
scene.add(floor);

function radialTexture(inner, middle) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 125);
  g.addColorStop(0, inner); g.addColorStop(0.45, middle); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
function floorHalo(size, texture, opacity, y) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  group.add(mesh);
  return mesh;
}
const contactShadow = floorHalo(5.5, radialTexture('rgba(0,0,0,.75)', 'rgba(0,0,0,.25)'), 0.8, -0.176);
contactShadow.material.blending = THREE.NormalBlending;
const warmPool = floorHalo(8.0, radialTexture('rgba(255,144,26,.88)', 'rgba(255,111,12,.23)'), 0, -0.172);
warmPool.position.x = 0.7;
warmPool.position.z = 0.2;

const model = new THREE.Group();
model.name = 'CeremonialOilLamp';
group.add(model);
const gold = new THREE.MeshPhysicalMaterial({ color: '#a97626', metalness: 0.87, roughness: 0.22, clearcoat: 0.28, clearcoatRoughness: 0.18, side: THREE.DoubleSide, envMapIntensity: 1.35, emissive: '#4a2606', emissiveIntensity: 0.07 });
const brightGold = new THREE.MeshPhysicalMaterial({ color: '#f5c976', metalness: 0.83, roughness: 0.17, clearcoat: 0.35, envMapIntensity: 1.9 });
const darkGold = new THREE.MeshStandardMaterial({ color: '#86612b', metalness: 0.7, roughness: 0.3 });

const outline = [
  [0,-0.08],[0.72,-0.08],[0.95,-0.07],[1.08,-0.04],[1.15,0.01],
  [1.28,0.08],[1.43,0.21],[1.56,0.36],[1.70,0.58],[1.84,0.84],
  [1.96,1.08],[2.04,1.27],[2.06,1.35],[2.04,1.40],[1.99,1.42],
  [1.94,1.40],[1.90,1.35],[1.80,1.14],[1.65,0.89],[1.47,0.69],
  [1.21,0.54],[0.92,0.47],[0.48,0.44],[0,0.44]
].map(([r,y]) => new THREE.Vector2(r,y));
const bowl = new THREE.Mesh(new THREE.LatheGeometry(outline, 160), gold);
bowl.name = 'PolishedBrassBowl';
bowl.castShadow = true; bowl.receiveShadow = true;
model.add(bowl);
const rim = new THREE.Mesh(new THREE.TorusGeometry(2.015, 0.042, 18, 160), brightGold);
rim.rotation.x = Math.PI / 2; rim.position.y = 1.392; rim.name = 'RolledBrassRim';
rim.castShadow = true; model.add(rim);
for (const [radius, tube, y, material] of [[1.06,0.06,-0.045,brightGold],[1.16,0.028,0.025,darkGold],[1.92,0.018,1.304,brightGold]]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 160), material);
  ring.rotation.x = Math.PI / 2; ring.position.y = y; model.add(ring);
}

function makeOilTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(205, 176, 18, 256, 256, 340);
  g.addColorStop(0, '#f9cd72');
  g.addColorStop(0.16, '#c8882b');
  g.addColorStop(0.44, '#8e470b');
  g.addColorStop(0.78, '#4e2208');
  g.addColorStop(1, '#2b1508');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(255,221,139,.5)'; x.lineWidth = 8;
  x.beginPath(); x.ellipse(225, 216, 125, 67, -.46, 3.3, 5.8); x.stroke();
  x.strokeStyle = 'rgba(255,224,147,.2)'; x.lineWidth = 14;
  x.beginPath(); x.ellipse(240, 250, 184, 118, -.28, 3.4, 5.9); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const oil = new THREE.Mesh(new THREE.CircleGeometry(1.67, 160), new THREE.MeshBasicMaterial({ map: makeOilTexture(), color: '#fff1c6', side: THREE.DoubleSide }));
oil.rotation.x = -Math.PI / 2; oil.position.y = 0.975;
oil.name = 'GoldenOilSurface'; model.add(oil);
for (const radius of [0.31, 0.48]) {
  const ripple = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.009, 8, 100), new THREE.MeshBasicMaterial({ color: '#f8cc70', transparent: true, opacity: radius < 0.4 ? 0.42 : 0.21 }));
  ripple.rotation.x = Math.PI / 2; ripple.position.y = 0.981; model.add(ripple);
}

const wickPoints = [
  new THREE.Vector3(1.70,1.08,0.07), new THREE.Vector3(1.88,1.22,0.06),
  new THREE.Vector3(2.03,1.45,0.05), new THREE.Vector3(2.055,1.69,0.04),
  new THREE.Vector3(1.99,1.93,0.035)
];
const wickCurve = new THREE.CatmullRomCurve3(wickPoints);
const cotton = new THREE.MeshStandardMaterial({ color: '#e8d3a7', roughness: 0.98, metalness: 0 });
const cottonDark = new THREE.MeshStandardMaterial({ color: '#bb9f74', roughness: 1 });
const char = new THREE.MeshStandardMaterial({ color: '#17120e', roughness: 1, emissive: '#210b04', emissiveIntensity: 0.1 });
const wick = new THREE.Mesh(new THREE.TubeGeometry(wickCurve, 72, 0.086, 12, false), cotton);
wick.name = 'BraidedCottonWick'; wick.castShadow = true; model.add(wick);
for (let strand = 0; strand < 4; strand++) {
  const samples = [];
  for (let i = 0; i <= 55; i++) {
    const t = i / 65;
    const p = wickCurve.getPoint(t);
    const angle = strand * Math.PI / 2 + t * Math.PI * 17;
    p.x += Math.cos(angle) * 0.08;
    p.z += Math.sin(angle) * 0.08;
    samples.push(p);
  }
  const fiber = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(samples), 90, 0.012, 5, false), strand % 2 ? cottonDark : cotton);
  model.add(fiber);
}
const charCurve = new THREE.CatmullRomCurve3([wickCurve.getPoint(0.81),wickCurve.getPoint(0.9),wickCurve.getPoint(1)]);
const charredTip = new THREE.Mesh(new THREE.TubeGeometry(charCurve, 22, 0.087, 10, false), char);
charredTip.name = 'CharredWickTip'; model.add(charredTip);
for (let i=0;i<13;i++) {
  const t = 0.84 + (i%5)*0.035;
  const p = wickCurve.getPoint(t);
  const a = i*2.399;
  p.x += Math.cos(a)*0.088; p.z += Math.sin(a)*0.088;
  const fleck = new THREE.Mesh(new THREE.IcosahedronGeometry(0.017+(i%3)*0.008,0), char);
  fleck.position.copy(p); model.add(fleck);
}

const flame = new THREE.Group();
flame.name = 'VolumetricFlame';
flame.position.copy(wickCurve.getPoint(1));
flame.position.y += 0.015;
model.add(flame);
const flameMeshes = [];
function flameShell(name, height, width, color, emissive, opacity, phase) {
  const rings = 68, sides = 48, positions = [], indices = [];
  for (let row=0;row<=rings;row++) {
    const v = row/rings;
    const r = (0.022*(1-v) + width*Math.pow(Math.sin(Math.PI*v),0.78)*(1-0.22*v));
    const bend = 0.13*v*v;
    for (let side=0;side<=sides;side++) {
      const a = side/sides*Math.PI*2;
      const wobble = 1 + 0.10*Math.sin(a*3+v*17+phase) + 0.035*Math.sin(a*6-v*23);
      positions.push(bend + Math.cos(a)*r*wobble, v*height, Math.sin(a)*r*0.76*wobble);
      if(row<rings && side<sides) {
        const here=row*(sides+1)+side;
        indices.push(here,here+sides+1,here+1,here+1,here+sides+1,here+sides+2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uHeight: { value: height },
      uPhase: { value: phase }
    },
    vertexShader: `uniform float uTime; uniform float uHeight; uniform float uPhase;
      varying vec3 vNormal; varying vec3 vView; varying vec3 vPoint;
      void main() {
        float v = position.y / uHeight;
        float tipWeight = pow(v, 1.55);
        vec3 point = position;
        float bendX = 0.07 * sin(uTime * 2.6 + v * 6.3 + uPhase) + 0.018 * sin(uTime * 6.4 + v * 13.0);
        float bendZ = 0.045 * cos(uTime * 3.1 + v * 7.0 + uPhase);
        float stretch = uTime * 5.1 + v * 7.5 + uPhase;
        point.x += tipWeight * bendX;
        point.z += tipWeight * bendZ;
        point.y *= 1.0 + 0.015 * sin(stretch);
        float derivativeWeight = 1.55 * pow(v, 0.55);
        float derivativeX = (derivativeWeight * bendX + tipWeight * (0.441 * cos(uTime * 2.6 + v * 6.3 + uPhase) + 0.234 * cos(uTime * 6.4 + v * 13.0))) / uHeight;
        float derivativeZ = (derivativeWeight * bendZ - tipWeight * 0.315 * sin(uTime * 3.1 + v * 7.0 + uPhase)) / uHeight;
        float derivativeY = 1.0 + 0.015 * sin(stretch) + v * 0.1125 * cos(stretch);
        vec3 animatedNormal = vec3(normal.x, (normal.y - derivativeX * normal.x - derivativeZ * normal.z) / derivativeY, normal.z);
        vec4 mv = modelViewMatrix * vec4(point, 1.0);
        vNormal = normalize(normalMatrix * animatedNormal); vView = normalize(-mv.xyz); vPoint = point;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uHeight; uniform float uPhase;
      varying vec3 vNormal; varying vec3 vView; varying vec3 vPoint;
      void main() { float h = clamp(vPoint.y / uHeight, 0.0, 1.0);
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float feather = pow(facing, 1.7);
        float tip = 1.0 - smoothstep(0.86, 1.0, h);
        float base = smoothstep(0.0, 0.065, h);
        float variation = 0.88 + 0.12 * sin(h * 18.0 + atan(vPoint.z,vPoint.x) * 3.0 + uPhase);
        vec3 color = uColor;
        if (uPhase < 1.0) color = mix(color * vec3(1.0,1.25,1.8), color * vec3(1.0,0.55,0.38), smoothstep(0.13,0.95,h));
        else if (uPhase < 2.0) color = mix(vec3(1.0,0.95,0.58), color, smoothstep(0.18,0.87,h));
        else if (uPhase < 3.0) color = mix(vec3(1.0,1.0,0.96), color, smoothstep(0.12,0.83,h));
        float alpha = uOpacity * feather * tip * base * variation;
        gl_FragColor = vec4(color, alpha); }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.exportColor = color;
  mesh.userData.exportOpacity = opacity;
  mesh.renderOrder = flameMeshes.length + 1;
  flame.add(mesh);
  flameMeshes.push({ mesh });
}
flameShell('AmberOuterEnvelope',1.25,0.29,'#ff650f','#ff4b0b',0.34,0);
flameShell('GoldenMiddleFlame',1.14,0.205,'#ffbf37','#ffb52d',0.51,1.2);
flameShell('WhiteHotInnerCore',0.98,0.105,'#fff2ba','#fff4be',0.72,2.4);
flameShell('NarrowBlueBase',0.25,0.08,'#437dff','#377aff',0.62,0.7);
const emberMaterial = new THREE.MeshBasicMaterial({ color: '#ff7719' });
const ember = new THREE.Mesh(new THREE.SphereGeometry(0.052,12,8), emberMaterial);
ember.position.y = 0.018; flame.add(ember);
flame.visible = false;
flame.scale.y = 0.001;

const flameLight = new THREE.PointLight(0xff9e3d, 0, 6.5, 2);
flameLight.position.set(flame.position.x, flame.position.y+0.55, flame.position.z);
group.add(flameLight);
const flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,176,46,.55)', 'rgba(255,86,15,.12)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
flameGlow.position.set(flame.position.x, flame.position.y+0.65, flame.position.z);
flameGlow.scale.set(2.1, 2.5, 1);
group.add(flameGlow);

  // Time-driven deformation lives on the GPU. A board reuses this one lamp for
  // each viewport, changing only its flame uniforms and illumination.
  function update({ time = 0, progress = 0, flameSize = 70, flameVolume = 70, lightIntensity = 80, phase = 0 } = {}) {
    progress = THREE.MathUtils.clamp(progress, 0, 1);
    const light = lightIntensity / 80;
    const animatedTime = time + phase;
    const flicker = 1 + 0.045 * Math.sin(animatedTime * 8.1) + 0.025 * Math.sin(animatedTime * 13.7);
    flame.visible = progress > 0;
    flame.scale.y = Math.max(0.001, progress) * (0.4 + flameSize / 100 * 0.86);
    flame.scale.x = flame.scale.z = 0.48 + flameVolume / 100 * 0.75;
    flameLight.intensity = progress * 28 * light * flicker;
    warmPool.material.opacity = progress * 0.64 * light * flicker;
    flameGlow.material.opacity = progress * 0.7 * light * flicker;
    gold.emissiveIntensity = 0.07 + progress * 0.15 * light * flicker;
    for (const { mesh } of flameMeshes) mesh.material.uniforms.uTime.value = animatedTime;
  }

  function dispose() {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    environment.dispose();
  }

  update();
  return { scene, group, model, flame, flameLight, flameGlow, update, dispose };
}
