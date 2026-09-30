// Studio for product renders: physically based materials, image-based lighting, soft key light shadows and a
// contact shadow on a seamless light backdrop — the look of an e-commerce product photo, not a cartoon.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export { THREE };

// ---------------------------------------------------------------- materials
export const mat = {
  plastic: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.14, specularIntensity: 0.6, ...o }),
  matte: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.72, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, ...o }),
  rubber: (o = {}) => new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.88, metalness: 0, ...o }),
  chrome: (o = {}) => new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.14, metalness: 1, ...o }),
  steel: (color = 0x9aa0a6, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.85, ...o }),
  leather: (color = 0x1f1f22, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.4, sheenRoughness: 0.6, sheenColor: 0x444444, ...o }),
  fabric: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.82, sheen: 0.5, sheenRoughness: 0.7, sheenColor: color, ...o }),
  glass: (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transmission: 0.92, thickness: 0.02, ior: 1.45, transparent: true, ...o }),
  lamp: (color = 0xfff4d6, o = {}) => new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.1, clearcoat: 1, ...o }),
};

// ---------------------------------------------------------------- geometry helpers
export const box = (w, h, d, m, r = 0.02, seg = 4) => shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), m));
export const cyl = (rt, rb, h, m, seg = 48, open = false) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m));
export const sphere = (r, m, seg = 48) => shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), m));
export const torus = (r, tube, m, arc = Math.PI * 2, rs = 24, ts = 96) => shadowed(new THREE.Mesh(new THREE.TorusGeometry(r, tube, rs, ts, arc), m));

/** A bent tube along points (frames, handlebars, fenders). */
export function tube(points, radius, m, seg = 96, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, "catmullrom", 0.1);
  return shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, 20, closed), m));
}

/** A side-profile silhouette extruded to a width with rounded (bevelled) edges — moulded plastic body panels. */
export function panel(points, width, m, bevel = 0.03) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.length === 4) shape.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, width - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 8, curveSegments: 48 });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  // Weld the bevel so it shades as one smooth moulded surface instead of stepped facets.
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const smooth = mergeVertices(g, 1e-4);
  smooth.computeVertexNormals();
  return shadowed(new THREE.Mesh(smooth, m));
}

/** Tyre with a rounded cross-section (lathe profile), optional knobbly tread, rim and hub. */
export function wheel({ r = 0.2, w = 0.08, rim = null, rimColor = 0xdddddd, spokes = 5, knobs = false, tread = true, hub = null } = {}) {
  const g = new THREE.Group();
  const tyreR = Math.min(w * 0.55, r * 0.35);
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI;
    pts.push(new THREE.Vector2(r - tyreR + Math.cos(a) * tyreR, Math.sin(a) * (w / 2)));
  }
  pts.push(new THREE.Vector2(r - tyreR * 1.9, w / 2 * 0.9));
  pts.unshift(new THREE.Vector2(r - tyreR * 1.9, -w / 2 * 0.9));
  const tyre = shadowed(new THREE.Mesh(new THREE.LatheGeometry(pts, 96), mat.rubber()));
  tyre.rotation.x = Math.PI / 2;
  g.add(tyre);
  if (knobs) {
    const n = Math.round((2 * Math.PI * r) / (w * 0.42));
    for (let i = 0; i < n; i++) {
      for (const side of [-1, 1]) {
        const k = box(w * 0.34, w * 0.2, w * 0.3, mat.rubber(), 0.008, 2);
        const a = (i / n) * Math.PI * 2 + (side > 0 ? Math.PI / n : 0);
        k.position.set(Math.cos(a) * (r + w * 0.02), Math.sin(a) * (r + w * 0.02), side * w * 0.2);
        k.rotation.z = a;
        g.add(k);
      }
    }
  } else if (tread) {
    // Shallow circumferential grooves and a raised sidewall ring read as moulded rubber, not fringe.
    for (const z of [-w * 0.18, w * 0.18]) {
      const groove = torus(r - 0.0015, w * 0.03, mat.rubber({ color: 0x0d0d0e, roughness: 0.95 }), Math.PI * 2, 12, 128);
      groove.position.z = z;
      g.add(groove);
    }
    for (const side of [-1, 1]) {
      const ring = torus(r - tyreR * 0.95, w * 0.035, mat.rubber({ color: 0x232326, roughness: 0.7 }), Math.PI * 2, 12, 128);
      ring.position.z = side * w * 0.43;
      g.add(ring);
    }
  }
  const rimR = r - tyreR * 1.75;
  const rimM = rim ?? mat.plastic(rimColor, { roughness: 0.25 });
  const disc = cyl(rimR, rimR, w * 0.62, rimM, 64);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  // Recessed face with spokes on both sides.
  for (const side of [-1, 1]) {
    const face = cyl(rimR * 0.86, rimR * 0.86, 0.004, mat.plastic(0x2a2a2c, { roughness: 0.5 }), 64);
    face.rotation.x = Math.PI / 2;
    face.position.z = side * (w * 0.31);
    g.add(face);
    for (let i = 0; i < spokes; i++) {
      const s = box(rimR * 0.95, rimR * 0.22, 0.012, rimM, 0.006, 2);
      const a = (i / spokes) * Math.PI * 2;
      s.position.set(Math.cos(a) * rimR * 0.45, Math.sin(a) * rimR * 0.45, side * (w * 0.32));
      s.rotation.z = a;
      g.add(s);
    }
    const cap = sphere(rimR * 0.2, hub ?? mat.chrome());
    cap.scale.z = 0.45;
    cap.position.z = side * (w * 0.33);
    g.add(cap);
  }
  return g;
}

export function shadowed(o) {
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

export function group(...children) {
  const g = new THREE.Group();
  children.flat().forEach((c) => g.add(c));
  return g;
}

export const at = (o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
};

// ---------------------------------------------------------------- studio + render
function contactShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(0.45, "rgba(0,0,0,0.22)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Renders a model and returns a WebP data URL.
 * view: { size, yaw, pitch, dist, target:[x,y,z], fov, bg }
 */
export function render(model, { size = 1200, yaw = -0.62, pitch = 0.2, dist = 3.2, target = [0, 0.35, 0], fov = 28, bg = 0xf4f4f6, shadowScale = [1.6, 0.8] } = {}) {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;

  // Seamless floor: catches the key light's soft shadow, blends into the backdrop.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.002;
  contact.scale.set(shadowScale[0], shadowScale[1], 1);
  scene.add(contact);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2.5, 5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
  key.shadow.camera.right = key.shadow.camera.top = 2.5;
  key.shadow.radius = 6;
  key.shadow.blurSamples = 24;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
  rim.position.set(3, 3, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e4df, 0.35));

  scene.add(model);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 100);
  const t = new THREE.Vector3(...target);
  camera.position.set(t.x + dist * Math.sin(yaw) * Math.cos(pitch), t.y + dist * Math.sin(pitch), t.z + dist * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(t);
  renderer.render(scene, camera);
  // Supersampled (2×) render, downscaled with high-quality smoothing for clean edges.
  const out = document.createElement("canvas");
  out.width = out.height = size;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, size, size);
  const url = out.toDataURL("image/webp", 0.88);
  renderer.dispose();
  pmrem.dispose();
  return url;
}
