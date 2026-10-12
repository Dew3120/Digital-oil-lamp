import * as THREE from './assets/lamp3d/vendor/three.module.js';

/**
 * Image-matched 3D cloth overlays for the EXACT supplied 1672 × 941 backdrop.
 *
 * const flags = await createImageFlags(backgroundTexture);
 * scene.add(flags.group);
 * flags.update(elapsedSeconds);
 *
 * Camera: OrthographicCamera(0, 1672, 941, 0, near, far), looking along -Z.
 * Image pixel (x, y) maps to world (x, 941 - y). The background stays unchanged.
 * Only the interior white textile is overlaid. The reference's rods, cyan seams,
 * curled lower hems, outer silhouettes, logos, and scenery retain their pixels.
 * The printed artwork is sampled directly from the supplied image; no new logo,
 * fabric painting, relighting, source-file editing, or generated bitmap is used.
 *
 * Pass returned animations to GLTFExporter to retain the cloth morph animation.
 */
export async function createImageFlags(imageOrTexture, options = {}) {
  const source = await resolveImage(imageOrTexture);
  const imageHeight = options.imageHeight ?? 941;
  const imageWidth = options.imageWidth ?? 1672;
  const rectangles = options.rectangles || [
    { name: 'NSBM', x: 149, y: 28, width: 196, height: 207, phase: 0 },
    { name: 'Compuvate', x: 1327, y: 28, width: 192, height: 207, phase: 0.62 },
  ];
  const depth = options.depth ?? 18;
  const group = new THREE.Group();
  group.name = 'ImageBackedScrollFlags';
  group.userData.imageDimensions = [imageWidth, imageHeight];
  group.userData.originalBackdropUnchanged = true;
  group.userData.strategy = 'Exact reference-pixel cloth interiors; original rods and silhouettes remain in backdrop';
  const tracks = [];
  const waveDuration = 5.4;
  const wavePoses = 12;

  for (const rectangle of rectangles) {
    const texture = slicedClothTexture(source, rectangle, options.feather ?? 9);
    texture.name = `${rectangle.name} unchanged reference cloth pixels`;
    const geometry = imageClothGeometry(rectangle, imageHeight, depth);
    const material = new THREE.MeshBasicMaterial({
      name: `${rectangle.name} exact image cloth`, map: texture,
      transparent: true, opacity: 1, side: THREE.DoubleSide,
      depthWrite: false, toneMapped: false,
    });
    // Preserve the printed artwork while the real moving surface changes the
    // fold highlights. At the reference pose the normal is (0,0,1), so its
    // original colors are unchanged. The border lighting remains fixed.
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vClothNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #if !defined(USE_ENVMAP) && !defined(USE_SKINNING)
          #include <beginnormal_vertex>
          #include <morphnormal_vertex>
        #endif
        vClothNormal = normalize(normalMatrix * objectNormal);
        #include <begin_vertex>
      `);
      shader.fragmentShader = 'varying vec3 vClothNormal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        vec3 clothNormal = normalize(vClothNormal);
        float fabricInterior = sin(vMapUv.x * 3.14159265) * sin(vMapUv.y * 3.14159265);
        float foldLight = clamp(1.0 + fabricInterior *
          (clothNormal.x * 0.24 + clothNormal.y * 0.15 + (clothNormal.z - 1.0) * 0.08), 0.90, 1.10);
        diffuseColor.rgb *= foldLight;
      `);
    };
    material.customProgramCacheKey = () => 'anchored-cloth-fold-light-v2';
    const cloth = new THREE.Mesh(geometry, material);
    cloth.name = `Image${rectangle.name}Cloth`;
    cloth.frustumCulled = false;
    cloth.renderOrder = 5;
    cloth.userData.referenceRectangle = {
      left: rectangle.x, top: rectangle.y,
      right: rectangle.x + rectangle.width,
      bottom: rectangle.y + rectangle.height,
    };
    cloth.userData.animation = 'Twelve traveling fabric wave poses with moving fold highlights; edges and anchors fixed';
    cloth.userData.waveDuration = waveDuration;
    group.add(cloth);

    // The first pose is exactly flat and aligned with the background. Remaining
    // A traveling wave, rather than an almost stationary subpixel sway. Extra
    // poses make the visible fold motion smooth as it loops back to its origin.
    const times = Array.from({ length: wavePoses + 1 }, (_, i) => i * waveDuration / wavePoses);
    const weights = times.flatMap((_, key) =>
      Array.from({ length: wavePoses }, (_, pose) => pose === key % wavePoses ? 1 : 0));
    tracks.push(new THREE.NumberKeyframeTrack(
      `${cloth.name}.morphTargetInfluences`, times, weights,
      THREE.InterpolateLinear,
    ));
  }

  const animations = [new THREE.AnimationClip('ImageScrollFlagWave', waveDuration, tracks)];
  group.animations = animations;
  const mixer = new THREE.AnimationMixer(group);
  mixer.clipAction(animations[0]).setLoop(THREE.LoopRepeat, Infinity).play();
  const update = timeSeconds => mixer.setTime(Number.isFinite(timeSeconds) ? timeSeconds : 0);
  update(0);

  return {
    group, update, animations, mixer, rectangles,
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(group);
      group.traverse(node => {
        if (!node.isMesh) return;
        node.geometry.dispose();
        node.material.map.dispose();
        node.material.dispose();
      });
    },
  };
}

async function resolveImage(input) {
  if (input?.isTexture) input = input.image;
  if (typeof input === 'string' || !input) {
    const texture = await new THREE.TextureLoader().loadAsync(input || './assets/kovil-background.png');
    const image = texture.image;
    texture.dispose();
    return image;
  }
  if (input.complete === false && typeof input.decode === 'function') await input.decode();
  if (!(input.naturalWidth || input.width)) {
    throw new Error('createImageFlags requires the loaded, original backdrop image or texture.');
  }
  return input;
}

function slicedClothTexture(image, rectangle, feather) {
  const { x, y, width, height } = rectangle;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, x, y, width, height, 0, 0, width, height);

  // This alpha mask softly joins the overlay to its identical pixels beneath.
  // Only alpha is masked; the printed cloth RGB comes from the original image.
  const edge = Math.max(1, Math.min(feather, width / 3, height / 3));
  const horizontal = context.createLinearGradient(0, 0, width, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(edge / width, 'rgba(255,255,255,1)');
  horizontal.addColorStop(1 - edge / width, 'rgba(255,255,255,1)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = horizontal;
  context.fillRect(0, 0, width, height);
  const vertical = context.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, 'rgba(255,255,255,0)');
  vertical.addColorStop(edge / height, 'rgba(255,255,255,1)');
  vertical.addColorStop(1 - edge / height, 'rgba(255,255,255,1)');
  vertical.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = vertical;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function imageClothGeometry(rectangle, imageHeight, depth) {
  const columns = 32;
  const rows = 36;
  const stride = columns + 1;
  const count = stride * (rows + 1);
  const uvs = new Float32Array(count * 2);
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const index = row * stride + column;
      uvs[index * 2] = column / columns;
      uvs[index * 2 + 1] = 1 - row / rows;
      if (row < rows && column < columns) {
        const a = index, b = index + 1, c = index + stride, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const positions = [];
  const normals = [];
  for (let pose = 0; pose < 12; pose++) {
    const phase = pose * Math.PI * 2 / 12;
    const array = new Float32Array(count * 3);
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      for (let column = 0; column <= columns; column++) {
        const u = column / columns;
        // All four boundary lines stay stationary, including the top rod anchor.
        const envelope = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
        const broadAngle = u * Math.PI * 2.3 - v * 3.8 + rectangle.phase;
        const rippleAngle = u * Math.PI * 4.4 + v * 4.6 + rectangle.phase * 1.7;
        const travel = Math.sin(broadAngle - phase) - Math.sin(broadAngle);
        const ripple = Math.sin(rippleAngle - phase * 2) - Math.sin(rippleAngle);
        const index = (row * stride + column) * 3;
        array[index] = rectangle.x + u * rectangle.width
          + 4.6 * envelope * travel;
        array[index + 1] = imageHeight - (rectangle.y + v * rectangle.height)
          + 2.0 * envelope * ripple;
        array[index + 2] = depth + 14 * envelope * (travel + 0.26 * ripple);
      }
    }
    const attribute = new THREE.Float32BufferAttribute(array, 3);
    attribute.name = `ExactImageClothPose${pose}`;
    positions.push(attribute);
    const normalGeometry = new THREE.BufferGeometry();
    normalGeometry.setIndex(indices);
    normalGeometry.setAttribute('position', attribute);
    normalGeometry.computeVertexNormals();
    const normal = normalGeometry.getAttribute('normal').clone();
    normal.name = attribute.name;
    normals.push(normal);
    normalGeometry.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = `${rectangle.name} reference-aligned segmented cloth`;
  geometry.setIndex(indices);
  geometry.setAttribute('position', positions[0].clone());
  geometry.setAttribute('normal', normals[0].clone());
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.morphTargetsRelative = false;
  geometry.morphAttributes.position = positions;
  geometry.morphAttributes.normal = normals;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
