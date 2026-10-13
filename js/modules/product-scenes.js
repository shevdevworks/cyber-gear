import * as THREE from '../vendor/three/three.module.js';

// Stylized product studies, not manufacturer CAD. Everything is rendered at
// the display's pixel density. No enlarged bitmaps or post-process grain.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const PI = Math.PI;
const clamp = THREE.MathUtils.clamp;
const ease = t => 1 - (1 - clamp(t, 0, 1)) ** 3;
const geometries = new Map();

function roundedBox(w, h, d, r = .08) {
  const key = [w, h, d, r].join('/');
  if (geometries.has(key)) return geometries.get(key);
  const geometry = new THREE.BoxGeometry(w, h, d, 6, 4, 6);
  const positions = geometry.attributes.position;
  const point = new THREE.Vector3();
  const core = new THREE.Vector3();
  const radius = Math.min(r, w / 2, h / 2, d / 2);
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    core.set(clamp(point.x, -w / 2 + radius, w / 2 - radius), clamp(point.y, -h / 2 + radius, h / 2 - radius), clamp(point.z, -d / 2 + radius, d / 2 - radius));
    point.sub(core).normalize().multiplyScalar(radius).add(core);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  geometries.set(key, geometry);
  return geometry;
}

function keycapGeometry(width, height) {
  const key = `cap/${width}/${height}`;
  if (geometries.has(key)) return geometries.get(key);
  const w = width / 2 - .04, d = .415, r = .065;
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d); shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r); shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d); shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r); shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height - .12, bevelEnabled: true, bevelThickness: .06, bevelSize: .04, bevelSegments: 3, curveSegments: 5 });
  geometry.rotateX(-PI / 2);
  geometry.translate(0, -height / 2 + .06, 0);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const t = (positions.getY(i) + height / 2) / height;
    positions.setX(i, positions.getX(i) * (1 - .14 / width * t));
    positions.setZ(i, positions.getZ(i) * (1 - .14 * t));
  }
  geometry.computeVertexNormals();
  geometries.set(key, geometry);
  return geometry;
}

function material(color, metalness = 0, roughness = .42, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extras });
}

function mesh(geometry, surface, parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

// Batch the repeated pieces without losing the independently moving rows.
// This avoids a separate GPU draw call for every key and switch.
function batchMeshes(group, objects) {
  const byMaterial = new Map();
  for (const object of objects) {
    const list = byMaterial.get(object.material) ?? [];
    list.push(object);
    byMaterial.set(object.material, list);
  }
  for (const [surface, parts] of byMaterial) {
    const positions = [], normals = [], uvs = [];
    for (const part of parts) {
      part.updateMatrix();
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geometry.applyMatrix4(part.matrix);
      positions.push(...geometry.attributes.position.array);
      normals.push(...geometry.attributes.normal.array);
      uvs.push(...geometry.attributes.uv.array);
      geometry.dispose();
      part.removeFromParent();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    mesh(geometry, surface, group);
  }
}

function box(parent, w, h, d, surface, x = 0, y = 0, z = 0, radius = .08) {
  return mesh(roundedBox(w, h, d, radius), surface, parent, x, y, z);
}

function tube(parent, points, radius, surface) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 40, radius, 8, false), surface, parent);
}

function labelTexture(text, color = '#c8ccd4', width = 512, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.font = `500 ${height * .46}px Arial, sans-serif`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function label(parent, text, w, h, color, x, y, z) {
  const object = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelTexture(text, color), transparent: true, depthWrite: false, toneMapped: false }), parent, x, y, z);
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

const rows60 = [
  ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '−', '=', ['Back', 2]],
  [['Tab', 1.5], 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', ['\\', 1.5]],
  [['Caps', 1.75], 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", ['Enter', 2.25]],
  [['Shift', 2.25], 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', ['Shift', 2.75]],
  [['Ctrl', 1.25], ['Win', 1.25], ['Alt', 1.25], ['', 6.25], ['Alt', 1.25], ['Fn', 1.25], ['Menu', 1.25], ['Ctrl', 1.25]],
];

function keyboard(id) {
  const root = new THREE.Group();
  const isAir = id.includes('nuphy');
  const isPro = id.includes('keychron');
  const isHHKB = id.includes('hhkb');
  const light = isAir || isHHKB;
  const rows = rows60.map(row => row.map(key => Array.isArray(key) ? [...key] : [key, 1]));
  if (isAir || isPro) rows.unshift(['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Del', '●'].map(key => [key, 1]));
  const depth = rows.length + .62;
  const body = material(light ? '#c1c6ca' : '#25272d', .72, .3);
  const rim = material(light ? '#e0e3e4' : '#575b64', .8, .25);
  const base = new THREE.Group();
  root.add(base);
  box(base, 15.7, .43, depth, body, 0, .22, 0, .17);
  box(base, 15.58, .10, depth - .1, rim, 0, .45, 0, .045);
  box(base, 15.44, .12, depth - .22, material('#16171d', .3, .46), 0, .52, 0, .05);
  for (const z of [-depth / 2 + .12, depth / 2 - .12]) box(base, 15.7, .28, .25, body, 0, .62, z, .055);
  for (const x of [-7.74, 7.74]) box(base, .23, .28, depth - .35, body, x, .62, 0, .05);
  box(base, 14.8, .035, .035, material('#9255ff', .1, .3, { emissive: '#7938ff', emissiveIntensity: .7 }), 0, .24, depth / 2 + .007, .015);
  const badge = label(base, isAir ? 'air75' : isPro ? 'Q1 PRO' : isHHKB ? 'HHKB' : '60HE', 1.0, .19, '#a2a5b4', 5.5, .26, depth / 2 + .015);
  badge.rotation.x = -.08;
  if (!light && !isPro) {
    box(base, .4, .10, 1.25, material('#e5ed18', .1, .65), -7.95, .23, -1.5, .04);
    box(base, .33, .11, .72, material('#2b2c27', .1, .65), -7.95, .23, -1.5, .035);
  }

  const pcb = new THREE.Group();
  root.add(pcb);
  box(pcb, 15.12, .07, depth - .4, material('#183934', .3, .55), 0, .53, 0, .025);
  // Sparse copper traces visible during the exploded view.
  const traceMaterial = material('#8c9570', .65, .45);
  for (let i = 0; i < 5; i++) box(pcb, 14.6 - i * .15, .008, .014, traceMaterial, 0, .57, i * .16 - .32, .002);
  const plate = new THREE.Group();
  root.add(plate);
  box(plate, 15.18, .07, depth - .4, material(light ? '#9da2a6' : '#363942', .65, .37), 0, .65, 0, .035);
  const keySurfaces = [material(light ? '#e3e5df' : '#20232a', .02, .48), material(light ? '#a0abb5' : '#13161c', .02, .46), material(isAir ? '#36d995' : isPro ? '#ec414b' : isHHKB ? '#a8adb3' : '#e5ed18', .02, .45)];
  const stemSurface = material('#a767ff', .1, .3, { emissive: '#7b35ca', emissiveIntensity: .22 });
  const capRows = [];
  const switches = [];
  const stems = [];
  const switchStem = material('#8a48c4', .05, .5);

  // One atlas and one legend mesh per row, instead of a texture per key.
  const atlas = document.createElement('canvas');
  atlas.width = 1024;
  atlas.height = 2048;
  const context = atlas.getContext('2d');
  context.fillStyle = light ? '#39414a' : '#d2d5df';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let glyphIndex = 0;
  const texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const glyphSurface = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  rows.forEach((row, rowIndex) => {
    const caps = new THREE.Group();
    root.add(caps);
    capRows.push(caps);
    const keys = [];
    let cursor = -7.5;
    const positions = [], uvs = [], indices = [];
    row.forEach(([text, units], column) => {
      const x = cursor + units / 2;
      const z = rowIndex - (rows.length - 1) / 2;
      const functionKey = units > 1 || rowIndex === rows.length - 1 || (rows.length === 6 && rowIndex === 0);
      const surfaceIndex = column === 0 && rowIndex === 0 ? 2 : functionKey ? 1 : 0;
      const capHeight = isAir ? .20 : .46;
      const cap = mesh(keycapGeometry(units - .09, capHeight), keySurfaces[surfaceIndex], caps, x, .96, z);
      cap.rotation.x = -.045;
      keys.push(cap);
      switches.push(box(plate, .50, .13, .50, stemSurface, x, .76, z, .035));
      stems.push(box(plate, .12, .12, .30, switchStem, x, .87, z, .015));
      stems.push(box(plate, .30, .12, .12, switchStem, x, .87, z, .015));
      const cellX = glyphIndex % 8, cellY = Math.floor(glyphIndex / 8);
      context.font = `${text.length > 2 ? 24 : 32}px Arial, sans-serif`;
      context.fillText(text, cellX * 128 + 64, cellY * 128 + 64);
      const u0 = cellX / 8, v0 = 1 - (cellY + 1) / 16, u1 = u0 + 1 / 8, v1 = v0 + 1 / 16;
      const gx = x - Math.min(units - 1, .4) / 2, gy = .968 + capHeight / 2;
      const idx = positions.length / 3;
      positions.push(gx - .38, gy, z + .35, gx + .38, gy, z + .35, gx + .38, gy + .03, z - .35, gx - .38, gy + .03, z - .35);
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
      indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
      cursor += units;
      glyphIndex++;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const legends = mesh(geometry, glyphSurface, caps);
    legends.castShadow = false;
    legends.receiveShadow = false;
    batchMeshes(caps, keys);
  });
  batchMeshes(plate, [...switches, ...stems]);
  texture.needsUpdate = true;
  const screwMaterial = material('#8f949e', .95, .23);
  for (const x of [-7.63, 7.63]) for (const z of [-depth / 2 + .2, depth / 2 - .2]) {
    mesh(new THREE.CylinderGeometry(.052, .052, .012, 12), screwMaterial, base, x, .516, z);
  }
  if (isPro) {
    mesh(new THREE.CylinderGeometry(.38, .38, .3, 32), material('#a3a6ac', .85, .2), root, 7, 1.08, -2.5);
  }
  root.userData.explode = value => {
    pcb.position.y = value * .42;
    plate.position.y = value * 1.0;
    capRows.forEach((row, i) => { row.position.y = value * (2.4 + (capRows.length - i) * .13); });
  };
  return root;
}

function mouse(id) {
  const root = new THREE.Group();
  const white = id.includes('logitech') || id.includes('lamzu');
  const surface = material(white ? '#e0e1dd' : '#15181e', .02, .53);
  const dark = material('#101218', .25, .4);
  const geometry = new THREE.SphereGeometry(1, 48, 32, 0, PI * 2, 0, PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setXYZ(i, p.getX(i) * .58 * (1 - .10 * z), p.getY(i) * .54 * (1 + .10 * z), z * 1.03);
  }
  geometry.computeVertexNormals();
  mesh(geometry, surface, root, 0, .10, 0);
  const base = mesh(new THREE.SphereGeometry(1, 40, 20), dark, root, 0, .075, 0);
  base.scale.set(.55, .075, 1.0);
  tube(root, [[0, .14, -1.018], [0, .47, -.65], [0, .61, -.24]], .008, dark);
  tube(root, [[-.49, .30, -.35], [-.26, .55, -.24], [0, .625, -.19], [.26, .55, -.24], [.49, .30, -.35]], .008, dark);
  const wheel = mesh(new THREE.CylinderGeometry(.14, .14, .11, 28), dark, root, 0, .6, -.44);
  wheel.rotation.z = PI / 2;
  for (let i = 0; i < 12; i++) {
    const ring = mesh(new THREE.TorusGeometry(.143, .006, 4, 24), material('#626774', .25, .5), root, (i - 5.5) * .008, .6, -.44);
    ring.rotation.y = PI / 2;
  }
  const mark = label(root, 'G', .26, .26, white ? '#606470' : '#a6afc5', 0, .535, .53);
  mark.rotation.x = -PI / 2 - .32;
  box(root, .06, .045, .30, dark, -.53, .29, -.12, .022);
  return root;
}

function headset(id) {
  const root = new THREE.Group();
  const metal = material(id.includes('hyperx') ? '#be1d3b' : '#7e828b', .85, .28);
  const shell = material(id.includes('epos') ? '#c8c9bb' : '#252831', .4, .3);
  const leather = material('#171a21', .05, .69);
  const arch = [];
  for (let i = 0; i <= 32; i++) {
    const a = i / 32 * PI;
    arch.push([Math.cos(a) * 1.25, 2.18 + Math.sin(a) * 1.32, 0]);
  }
  const band = tube(root, arch, .12, metal);
  band.scale.z = 2.4;
  const cushion = tube(root, arch.map(([x, y, z]) => [x * .95, y - .13, z]), .1, leather);
  cushion.scale.z = 2.6;
  for (const side of [-1, 1]) {
    box(root, .13, .78, .21, metal, side * 1.2, 1.98, 0, .06);
    const cup = new THREE.Group();
    root.add(cup);
    cup.position.set(side * 1.17, 1.48, 0);
    cup.rotation.z = side * -.10;
    const housing = mesh(new THREE.CylinderGeometry(.60, .64, .33, 48), shell, cup, side * .05, 0, 0);
    housing.rotation.z = PI / 2;
    housing.scale.x = 1.16;
    const ring = mesh(new THREE.TorusGeometry(.49, .13, 12, 48), leather, cup, side * -.15, 0, 0);
    ring.rotation.y = PI / 2;
    ring.scale.y = 1.18;
    const outer = mesh(new THREE.CylinderGeometry(.47, .47, .02, 48), metal, cup, side * .23, 0, 0);
    outer.rotation.z = PI / 2;
    outer.scale.x = 1.18;
    const inset = mesh(new THREE.CylinderGeometry(.42, .42, .022, 48), shell, cup, side * .247, 0, 0);
    inset.rotation.z = PI / 2;
    inset.scale.x = 1.18;
  }
  tube(root, [[-1.3, 1.14, .25], [-1.4, .95, .8], [-.85, .88, 1.1]], .035, leather);
  box(root, .24, .13, .15, leather, -.78, .88, 1.1, .06);
  return root;
}

function contactShadow(parent, w, d, x, y, z, opacity = .5) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
  gradient.addColorStop(.4, `rgba(0,0,0,${opacity * .65})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const plane = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }), parent, x, y, z);
  plane.rotation.x = -PI / 2;
  plane.castShadow = false;
  return plane;
}

function studioEnvironment(renderer) {
  const environment = new THREE.Scene();
  mesh(new THREE.BoxGeometry(80, 60, 80), new THREE.MeshBasicMaterial({ color: '#5e626d', side: THREE.BackSide }), environment);
  const panels = [
    [0, 15, 4, 18, 12, -PI / 2, 0, '#ffffff', 6],
    [-14, 6, 0, 10, 12, 0, PI / 2, '#e2e8f7', 3],
    [6, 7, -14, 8, 14, 0, 0, '#e7e5f4', 5],
  ];
  for (const [x, y, z, w, h, rx, ry, color, strength] of panels) {
    const panel = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }), environment, x, y, z);
    panel.rotation.set(rx, ry, 0);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = pmrem.fromScene(environment, .05).texture;
  pmrem.dispose();
  environment.traverse(object => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  return map;
}

function stage(host, kind) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = .6;
  const camera = new THREE.PerspectiveCamera(kind === 'hero' ? 35 : 38, 1, .1, 160);
  if (kind === 'hero') camera.zoom = 1.2;
  scene.add(new THREE.HemisphereLight('#e0e5f1', '#33323b', .8));
  const key = new THREE.DirectionalLight('#fffbf5', 3.4);
  key.position.set(-8, 16, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: .5, far: 60 });
  key.shadow.normalBias = .035;
  key.shadow.bias = -.0002;
  key.shadow.radius = 5;
  key.shadow.blurSamples = 8;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#c6bbed', 1.0);
  rim.position.set(5, 6, -10);
  scene.add(rim);

  let frame = 0, visible = false, disposed = false, last = 0;
  let draw = () => false;
  function render(now) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, .25);
    last = now;
    const again = draw(now / 1000, dt);
    renderer.render(scene, camera);
    host.classList.add('is-ready');
    if (again && !reducedMotion.matches) frame = requestAnimationFrame(render);
  }
  const request = () => {
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(render);
  };
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    request();
  });
  resize.observe(host);
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { last = performance.now(); request(); }
    else { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: '80px' });
  intersection.observe(host);
  document.addEventListener('visibilitychange', request);
  reducedMotion.addEventListener('change', request);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    host.classList.remove('is-ready');
    host.closest('[data-scene-shell]')?.classList.remove('scene-loaded');
    cancelAnimationFrame(frame);
    frame = 0;
  });
  canvas.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; request(); });
  return { scene, camera, renderer, request, setDraw(callback) { draw = callback; request(); } };
}

function releaseModel(model) {
  const surfaces = new Set(), maps = new Set();
  model.traverse(object => {
    if (object.geometry && ![...geometries.values()].includes(object.geometry)) object.geometry.dispose();
    if (object.material) surfaces.add(object.material);
  });
  surfaces.forEach(surface => { if (surface.map) maps.add(surface.map); surface.dispose(); });
  maps.forEach(map => map.dispose());
  model.removeFromParent();
}

export function createHeroScene(host, initialId) {
  const view = stage(host, 'hero');
  const root = new THREE.Group();
  view.scene.add(root);
  let model = keyboard(initialId);
  root.add(model);
  root.rotation.y = .05;
  let start = performance.now() / 1000;
  let expanded = false, amount = reducedMotion.matches ? 0 : 1;
  let changeStart = -100, changeFrom = 0;
  let pointerX = 0, pointerY = 0, orbitX = 0, orbitY = 0;
  let transition = false;
  const aim = new THREE.Vector3(0, .8, 0);
  view.setDraw((time, dt) => {
    const age = time - start;
    const intro = !reducedMotion.matches && age < 2.6;
    const target = expanded ? 1 : intro ? 1 - ease((age - .45) / 2.1) : 0;
    const previousAmount = amount;
    if (reducedMotion.matches) { amount = target; orbitX = orbitY = 0; }
    else {
      amount = intro ? target : THREE.MathUtils.lerp(changeFrom, target, ease((time - changeStart) / 1.1));
      orbitX += (pointerX - orbitX) * (1 - Math.exp(-dt * 5));
      orbitY += (pointerY - orbitY) * (1 - Math.exp(-dt * 5));
    }
    if (Math.abs(previousAmount - amount) > .0001 || transition) view.renderer.shadowMap.needsUpdate = true;
    model.userData.explode(amount);
    const distance = Math.max(1, 1.5 / view.camera.aspect);
    view.camera.position.set((-5.4 + orbitX * 3.5) * distance, (14.2 + orbitY * 2.3 + amount * 1.2) * distance, (19.5 - orbitX) * distance);
    view.camera.lookAt(aim);
    root.rotation.z = .06;
    if (transition) {
      root.position.y = reducedMotion.matches ? 0 : (1 - ease(age / .85)) * -2.2;
      root.rotation.y = .05 + (reducedMotion.matches ? 0 : (1 - ease(age / 1.1)) * -.5);
      if (age >= 1.1) transition = false;
    }
    host.closest('[data-scene-shell]')?.classList.add('scene-loaded');
    return intro || transition || Math.abs(amount - target) > .001 || Math.abs(pointerX - orbitX) + Math.abs(pointerY - orbitY) > .002;
  });
  host.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    const rect = host.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - .5;
    pointerY = (event.clientY - rect.top) / rect.height - .5;
    view.request();
  });
  host.addEventListener('pointerleave', () => { pointerX = pointerY = 0; view.request(); });
  return {
    select(id) {
      releaseModel(model);
      model = keyboard(id);
      root.add(model);
      start = performance.now() / 1000;
      transition = true;
      amount = reducedMotion.matches ? Number(expanded) : 1;
      view.request();
    },
    explode(value) { changeFrom = amount; changeStart = performance.now() / 1000; expanded = value; start = -100; view.request(); },
    replay() { expanded = false; start = performance.now() / 1000; amount = reducedMotion.matches ? 0 : 1; view.request(); },
  };
}

export function createSetupScene(host, initialSelection) {
  const view = stage(host, 'setup');
  const desk = new THREE.Group();
  view.scene.add(desk);
  const tabletop = material('#23262c', .04, .63);
  box(desk, 21.2, .42, 11.6, tabletop, 0, -.285, 0, .09);
  box(desk, 14.9, .065, 6.45, material('#13161d', .02, .85), -.05, -.027, 1.02, .03);
  // Stitched mat border is geometry, so it remains sharp at any screen density.
  const legs = material('#14161b', .7, .4);
  for (const x of [-8.6, 8.6]) box(desk, .65, 6.4, .65, legs, x, -3.6, 3.4, .07);
  const stitching = material('#454852', .05, .8);
  const stitches = new THREE.InstancedMesh(roundedBox(.055, .006, .013, .003), stitching, 244);
  const transform = new THREE.Matrix4();
  let stitchIndex = 0;
  for (let x = -7.28; x < 7.28; x += .12) for (const z of [-2.10, 4.14]) {
    transform.makeTranslation(x, .009, z);
    stitches.setMatrixAt(stitchIndex++, transform);
  }
  stitches.count = stitchIndex;
  desk.add(stitches);
  const matLabel = label(desk, 'CyberGear', 1.12, .25, '#727682', 6.35, .013, 3.72);
  matLabel.rotation.x = -PI / 2;
  // A slim display anchors the scale and depth of the entire setup.
  const monitor = new THREE.Group();
  desk.add(monitor);
  monitor.position.set(.5, 0, -3.35);
  const alloy = material('#464a54', .8, .27);
  box(monitor, 3.1, .10, 1.45, alloy, 0, .025, .4, .045);
  box(monitor, .37, 1.75, .32, alloy, 0, .90, 0, .08);
  box(monitor, 9.5, 4.25, .25, material('#1b1e26', .65, .25), 0, 3.62, 0, .12);
  box(monitor, 9.2, 3.96, .018, material('#101622', .3, .2), 0, 3.65, .136, .05);
  const screen = document.createElement('canvas');
  screen.width = 1536; screen.height = 640;
  const ctx = screen.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 640, 1300, 0);
  gradient.addColorStop(0, '#092b42'); gradient.addColorStop(.5, '#29236e'); gradient.addColorStop(1, '#7938d9');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1536, 640);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 19; i++) {
    ctx.strokeStyle = `rgba(206,203,239,${.10 + i * .004})`;
    ctx.beginPath(); ctx.ellipse(1200, 390, 400 + i * 24, 130 + i * 14, -.4, 0, PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#e0dff2'; ctx.font = '500 78px Arial'; ctx.fillText('Make room', 100, 305); ctx.fillText('for your best.', 100, 400);
  const screenMap = new THREE.CanvasTexture(screen);
  screenMap.colorSpace = THREE.SRGBColorSpace;
  const screenMesh = mesh(new THREE.PlaneGeometry(9.15, 3.92), new THREE.MeshBasicMaterial({ map: screenMap, toneMapped: false }), monitor, 0, 3.65, .151);
  screenMesh.castShadow = false;
  const stand = new THREE.Group();
  stand.position.set(-6.35, 0, -1.7);
  desk.add(stand);
  box(stand, 1.95, .10, 1.5, alloy, 0, .04, 0, .05);
  box(stand, .14, 3.38, .16, alloy, 0, 1.7, -.12, .035);
  box(stand, .85, .10, .50, alloy, 0, 3.43, -.02, .05);
  contactShadow(desk, 10.8, 4.5, -1, .011, 1.55, .65);
  contactShadow(desk, 2.5, 3.5, 4.9, .012, 1.55, .55);
  contactShadow(desk, 3.2, 2.8, -6.3, .012, -1.6, .5);
  contactShadow(desk, 7, 3, .5, -.069, -2.8, .5);
  const current = {};
  const models = {};
  let changedAt = 0, changing = [];
  let viewTarget = 0, viewAmount = 0;
  let pointerX = 0, orbitX = 0;
  function select(selection) {
    changing = [];
    for (const [category, id] of Object.entries(selection)) {
      if (current[category] === id) continue;
      if (models[category]) releaseModel(models[category]);
      const model = category === 'keyboards' ? keyboard(id) : category === 'mice' ? mouse(id) : headset(id);
      if (category === 'keyboards') { model.scale.setScalar(.58); model.position.set(-1.05, .03, 1.45); }
      if (category === 'mice') { model.scale.setScalar(1.5); model.position.set(4.8, .025, 1.55); model.rotation.y = -.06; }
      if (category === 'headsets') { model.position.set(-6.35, .03, -1.5); model.rotation.y = .35; }
      model.userData.floor = model.position.y;
      models[category] = model;
      desk.add(model);
      current[category] = id;
      changing.push(model);
    }
    changedAt = performance.now() / 1000;
    view.request();
  }
  select(initialSelection);
  view.setDraw((time, dt) => {
    const age = time - changedAt;
    const landing = reducedMotion.matches ? 1 : ease(age / .85);
    changing.forEach((model, i) => { model.position.y = model.userData.floor + (1 - landing) * (1.3 + i * .2); });
    if (age < 1.2) view.renderer.shadowMap.needsUpdate = true;
    viewAmount = reducedMotion.matches ? viewTarget : viewAmount + (viewTarget - viewAmount) * Math.min(dt * 5, 1);
    orbitX = reducedMotion.matches ? 0 : orbitX + (pointerX - orbitX) * Math.min(dt * 4, 1);
    const distance = view.camera.aspect < 1.35 ? 1.20 : 1;
    view.camera.position.set((10.4 * (1 - viewAmount) + orbitX * 2) * distance, (12.3 + viewAmount * 14) * distance, (18.5 - viewAmount * 17) * distance);
    view.camera.lookAt(0, 1.15 * (1 - viewAmount), .15);
    host.closest('[data-scene-shell]')?.classList.add('scene-loaded');
    return age < 1 || Math.abs(viewTarget - viewAmount) > .001 || Math.abs(pointerX - orbitX) > .002;
  });
  host.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    const rect = host.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - .5;
    view.request();
  });
  host.addEventListener('pointerleave', () => { pointerX = 0; view.request(); });
  return { select, angle(value) { viewTarget = value === 'top' ? 1 : 0; view.request(); } };
}
