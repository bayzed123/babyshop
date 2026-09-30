// Ride-on toy models built from physically based parts. Units ≈ metres; +x is the front of each toy.
import { THREE, mat, box, cyl, sphere, torus, tube, panel, wheel, group, at, shadowed } from "./studio.js";

const Z = Math.PI / 2;

/** Kids' electric sport motorcycle — glossy red, black seat, chrome, stabiliser wheels. */
export function motorcycle({ body = 0xb3121c, accent = 0x1c1c1e } = {}) {
  const g = new THREE.Group();
  const red = mat.plastic(body);
  const black = mat.plastic(accent, { roughness: 0.4 });
  // Wheels
  const fw = at(wheel({ r: 0.2, w: 0.085, rim: mat.steel(0xc9ccd1), spokes: 6 }), 0.52, 0.2, 0);
  const rw = at(wheel({ r: 0.2, w: 0.1, rim: mat.steel(0xc9ccd1), spokes: 6 }), -0.5, 0.2, 0);
  g.add(fw, rw);
  // Main fairing (side silhouette → moulded shell)
  g.add(at(panel([[-0.4, 0.36], [0.02, 0.28, 0.24, 0.32], [0.46, 0.4, 0.4, 0.62], [0.3, 0.7, 0.14, 0.64], [-0.06, 0.6, -0.3, 0.62], [-0.54, 0.58, -0.56, 0.47]], 0.25, red, 0.07), 0, 0, 0));
  // Front cowl with windscreen and headlight
  g.add(at(panel([[0.26, 0.5], [0.5, 0.5, 0.6, 0.64], [0.56, 0.78, 0.44, 0.8], [0.3, 0.74, 0.27, 0.62]], 0.21, red, 0.06), 0, 0, 0));
  const screen = at(panel([[0.36, 0.72], [0.52, 0.76], [0.44, 0.88], [0.34, 0.84]], 0.16, mat.glass({ color: 0x9fb6c8, transmission: 0.7 }), 0.012), 0, 0, 0);
  g.add(screen);
  const lamp = at(sphere(0.055, mat.lamp()), 0.64, 0.6, 0);
  lamp.scale.set(0.6, 0.8, 1.15);
  g.add(lamp, at(torus(0.058, 0.009, mat.chrome()), 0.65, 0.6, 0, 0, Z, 0));
  // Fuel tank and seat
  const tank = at(sphere(0.16, red), 0.1, 0.66, 0);
  tank.scale.set(1.25, 0.55, 0.8);
  g.add(tank);
  g.add(at(box(0.38, 0.07, 0.2, mat.leather(), 0.035), -0.2, 0.66, 0, 0, 0, -0.08));
  g.add(at(box(0.16, 0.1, 0.18, red, 0.04), -0.44, 0.63, 0, 0, 0, -0.35)); // tail
  g.add(at(sphere(0.022, mat.lamp(0xff3b30)), -0.535, 0.62, 0)); // tail light
  // Black side panel + white stripe
  for (const s of [-1, 1]) {
    g.add(at(panel([[-0.25, 0.38], [0.12, 0.36], [0.22, 0.46], [-0.18, 0.5]], 0.01, black, 0.004), 0, 0, s * 0.125));
    g.add(at(panel([[-0.36, 0.55], [0.2, 0.52], [0.21, 0.545], [-0.35, 0.575]], 0.008, mat.plastic(0xffffff), 0.003), 0, 0, s * 0.128));
  }
  // Front fork, handlebar, grips, mirrors
  for (const s of [-1, 1]) g.add(tube([[0.52, 0.2, s * 0.06], [0.46, 0.45, s * 0.07], [0.4, 0.74, s * 0.08]], 0.018, mat.chrome()));
  g.add(tube([[0.36, 0.8, -0.26], [0.4, 0.78, -0.1], [0.4, 0.78, 0.1], [0.36, 0.8, 0.26]], 0.016, black));
  for (const s of [-1, 1]) {
    g.add(at(cyl(0.022, 0.022, 0.08, mat.rubber(), 24), 0.36, 0.8, s * 0.27, Z, 0, 0));
    g.add(tube([[0.38, 0.8, s * 0.2], [0.36, 0.9, s * 0.24]], 0.006, black));
    const m = at(box(0.012, 0.05, 0.07, black, 0.01), 0.36, 0.92, s * 0.25);
    g.add(m);
  }
  // Mudguards
  g.add(at(torus(0.235, 0.028, red, Math.PI * 0.55), 0.52, 0.2, 0, 0, 0, Math.PI * 0.12));
  g.add(at(torus(0.24, 0.035, black, Math.PI * 0.45), -0.5, 0.2, 0, 0, 0, Math.PI * 0.35));
  // Exhaust + swingarm
  g.add(at(cyl(0.032, 0.04, 0.3, mat.chrome(), 32), -0.34, 0.33, -0.14, 0, 0, Z - 0.25));
  for (const s of [-1, 1]) g.add(tube([[-0.5, 0.2, s * 0.07], [-0.2, 0.32, s * 0.1]], 0.02, black));
  // Footrests
  for (const s of [-1, 1]) g.add(at(box(0.1, 0.02, 0.06, black, 0.008), 0.02, 0.3, s * 0.17));
  // Stabiliser wheels (removable training wheels)
  for (const s of [-1, 1]) {
    g.add(tube([[-0.44, 0.3, s * 0.1], [-0.52, 0.2, s * 0.26], [-0.56, 0.08, s * 0.3]], 0.012, mat.steel(0x2b2b2e)));
    g.add(at(wheel({ r: 0.075, w: 0.035, rimColor: 0xeeeeee, spokes: 4, tread: false }), -0.56, 0.075, s * 0.31));
  }
  return g;
}

/** "Commando" army-style ride-on motorcycle — matte olive, tan saddle, knobbly tyres, racks and side boxes. */
export function commando({ body = 0x4d5a2a, saddle = 0x8a6a42 } = {}) {
  const g = new THREE.Group();
  const olive = mat.matte(body, { roughness: 0.62, clearcoat: 0.25 });
  const oliveDark = mat.matte(0x323b1b, { roughness: 0.7 });
  const blackSteel = mat.steel(0x2a2c2e, { roughness: 0.45 });
  g.add(at(wheel({ r: 0.21, w: 0.12, knobs: true, rim: mat.matte(0x3a4420), spokes: 5, hub: blackSteel }), 0.54, 0.21, 0));
  g.add(at(wheel({ r: 0.21, w: 0.13, knobs: true, rim: mat.matte(0x3a4420), spokes: 5, hub: blackSteel }), -0.52, 0.21, 0));
  // Chunky body shell and tank
  g.add(panel([[-0.42, 0.38], [0.0, 0.32, 0.3, 0.36], [0.44, 0.42, 0.4, 0.58], [0.26, 0.68, 0.08, 0.66], [-0.2, 0.62], [-0.5, 0.6, -0.52, 0.48]], 0.27, olive, 0.07));
  const tank = at(sphere(0.17, olive), 0.12, 0.69, 0);
  tank.scale.set(1.2, 0.5, 0.82);
  g.add(tank);
  g.add(at(box(0.07, 0.03, 0.05, blackSteel, 0.012), 0.14, 0.77, 0)); // filler cap
  // Tan saddle with stitched edge
  g.add(at(box(0.42, 0.075, 0.22, mat.leather(saddle, { roughness: 0.62 }), 0.035), -0.2, 0.68, 0, 0, 0, -0.05));
  g.add(at(box(0.43, 0.012, 0.225, mat.leather(0x5d472c), 0.005), -0.2, 0.645, 0, 0, 0, -0.05));
  // Round headlight with grille guard
  const lamp = at(cyl(0.075, 0.075, 0.06, blackSteel, 40), 0.55, 0.66, 0, 0, 0, Z);
  g.add(lamp, at(cyl(0.064, 0.064, 0.02, mat.lamp(0xfff0cc), 40), 0.585, 0.66, 0, 0, 0, Z));
  for (const y of [-0.035, 0, 0.035]) g.add(at(cyl(0.005, 0.005, 0.15, blackSteel, 12), 0.6, 0.66 + y, 0, Z, 0, 0));
  g.add(at(cyl(0.005, 0.005, 0.15, blackSteel, 12), 0.6, 0.66, 0, 0, 0, 0));
  // Fork, wide bars, high front fender
  for (const sd of [-1, 1]) g.add(tube([[0.54, 0.21, sd * 0.075], [0.5, 0.5, sd * 0.085], [0.44, 0.78, sd * 0.09]], 0.022, blackSteel));
  g.add(tube([[0.38, 0.86, -0.3], [0.44, 0.82, -0.14], [0.44, 0.82, 0.14], [0.38, 0.86, 0.3]], 0.018, blackSteel));
  for (const sd of [-1, 1]) g.add(at(cyl(0.024, 0.024, 0.09, mat.rubber(), 20), 0.38, 0.86, sd * 0.33, Z, 0, 0));
  g.add(at(torus(0.25, 0.03, olive, Math.PI * 0.5), 0.54, 0.21, 0, 0, 0, Math.PI * 0.2));
  g.add(at(torus(0.255, 0.038, oliveDark, Math.PI * 0.42), -0.52, 0.21, 0, 0, 0, Math.PI * 0.4));
  // Rear rack with ammo-style boxes on both sides
  g.add(tube([[-0.42, 0.7, -0.14], [-0.66, 0.7, -0.14], [-0.66, 0.7, 0.14], [-0.42, 0.7, 0.14]], 0.012, blackSteel, 64));
  for (const sd of [-1, 1]) {
    g.add(at(box(0.26, 0.2, 0.1, oliveDark, 0.02), -0.5, 0.5, sd * 0.2));
    g.add(at(box(0.27, 0.035, 0.11, olive, 0.012), -0.5, 0.615, sd * 0.2));
    g.add(at(box(0.04, 0.05, 0.012, blackSteel, 0.005), -0.5, 0.57, sd * 0.257));
  }
  // High scrambler exhaust with heat shield
  g.add(tube([[0.18, 0.34, -0.15], [-0.1, 0.44, -0.16], [-0.46, 0.52, -0.3]], 0.026, mat.steel(0x3b3d40, { roughness: 0.55 })));
  g.add(at(box(0.18, 0.05, 0.02, mat.steel(0x6b6e72), 0.01), -0.14, 0.46, -0.19, 0, 0, 0.2));
  for (const sd of [-1, 1]) g.add(at(box(0.11, 0.022, 0.06, blackSteel, 0.008), 0.04, 0.3, sd * 0.18));
  for (const sd of [-1, 1]) {
    g.add(tube([[-0.46, 0.32, sd * 0.1], [-0.54, 0.2, sd * 0.27], [-0.58, 0.08, sd * 0.32]], 0.012, blackSteel));
    g.add(at(wheel({ r: 0.075, w: 0.035, rim: oliveDark, spokes: 4, tread: false }), -0.58, 0.075, sd * 0.33));
  }
  return g;
}

/** Baby rickshaw — a pedal ride-on modelled on the Bangladeshi cycle rickshaw: bright frame, striped hood, passenger bench. */
export function rickshaw() {
  const g = new THREE.Group();
  const frame = mat.plastic(0x1565c0, { roughness: 0.3 });
  const chrome = mat.chrome();
  const r = 0.16;
  g.add(at(wheel({ r, w: 0.06, rim: chrome, spokes: 8 }), 0.62, r, 0));
  for (const sd of [-1, 1]) g.add(at(wheel({ r, w: 0.06, rim: chrome, spokes: 8 }), -0.36, r, sd * 0.34));
  // Frame, fork, handlebar, rider saddle, crank
  g.add(tube([[0.56, 0.58, 0], [0.34, 0.36, 0], [0.08, 0.26, 0], [-0.2, 0.26, 0], [-0.36, r, 0]], 0.022, frame));
  g.add(at(cyl(0.012, 0.012, 0.7, chrome, 16), -0.36, r, 0, Z, 0, 0)); // rear axle
  for (const sd of [-1, 1]) g.add(tube([[0.62, r, sd * 0.04], [0.59, 0.42, sd * 0.045], [0.56, 0.6, 0]], 0.014, chrome));
  g.add(tube([[0.46, 0.72, -0.22], [0.54, 0.7, -0.08], [0.54, 0.7, 0.08], [0.46, 0.72, 0.22]], 0.013, chrome));
  g.add(at(cyl(0.014, 0.014, 0.14, chrome, 16), 0.56, 0.64, 0));
  for (const sd of [-1, 1]) g.add(at(cyl(0.02, 0.02, 0.08, mat.rubber(), 16), 0.45, 0.72, sd * 0.25, Z, 0, 0));
  g.add(at(sphere(0.022, chrome), 0.53, 0.73, 0.14)); // bell
  g.add(tube([[0.2, 0.3, 0], [0.22, 0.56, 0]], 0.016, frame));
  const saddle = at(box(0.16, 0.05, 0.12, mat.leather(0x1f1f22), 0.025), 0.22, 0.59, 0);
  g.add(saddle);
  g.add(at(cyl(0.07, 0.07, 0.012, chrome, 32), 0.1, 0.26, 0.05, Z, 0, 0));
  for (const sd of [-1, 1]) {
    g.add(at(box(0.012, 0.1, 0.012, chrome, 0.004), 0.1, 0.26 + sd * 0.05, sd * 0.07));
    g.add(at(box(0.06, 0.018, 0.04, mat.rubber(), 0.006), 0.1, 0.26 + sd * 0.1, sd * 0.1));
  }
  // Passenger carriage: footboard, bench, backrest, side guards
  const wood = mat.plastic(0x7a4b2a, { roughness: 0.5, clearcoat: 0.5 });
  g.add(at(box(0.22, 0.03, 0.46, wood, 0.012), -0.12, 0.3, 0));
  g.add(at(box(0.3, 0.1, 0.6, mat.plastic(0x1565c0), 0.03), -0.38, 0.38, 0));
  g.add(at(box(0.3, 0.06, 0.62, mat.leather(0xb71c1c), 0.03), -0.38, 0.46, 0));
  g.add(at(box(0.06, 0.22, 0.6, mat.leather(0xb71c1c), 0.03), -0.52, 0.6, 0, 0, 0, -0.12));
  for (const sd of [-1, 1]) g.add(at(torus(0.19, 0.02, mat.plastic(0xf9a825), Math.PI), -0.36, r, sd * 0.34));
  // Striped folding hood (bellows) in rickshaw-art colours. A cylinder turned on its side: a point at angle θ
  // sits at (x + r·sinθ, y − r·cosθ); θ = π is the top, 1.5π the back.
  const colors = [0xc62828, 0xf9a825, 0x2e7d32, 0xd81b60, 0x1565c0, 0xf9a825];
  const hood = { x: -0.37, y: 0.54, r: 0.31, from: Math.PI * 0.86, to: Math.PI * 1.5, w: 0.66 };
  const step = (hood.to - hood.from) / colors.length;
  colors.forEach((c, i) => {
    const seg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(hood.r, hood.r, hood.w, 64, 1, true, hood.from + i * step, step), mat.matte(c, { side: THREE.DoubleSide, roughness: 0.6, clearcoat: 0.3 })));
    g.add(at(seg, hood.x, hood.y, 0, Z, 0, 0));
  });
  for (let i = 0; i <= colors.length; i++) {
    const a = hood.from + i * step;
    g.add(at(cyl(0.009, 0.009, hood.w + 0.02, mat.plastic(0x151515), 12), hood.x + hood.r * Math.sin(a), hood.y - hood.r * Math.cos(a), 0, Z, 0, 0));
  }
  // Hood struts from the bench up to the hood's front edge
  const frontX = hood.x + hood.r * Math.sin(hood.from), frontY = hood.y - hood.r * Math.cos(hood.from);
  for (const sd of [-1, 1]) g.add(tube([[-0.25, 0.47, sd * 0.32], [frontX, frontY, sd * 0.32]], 0.01, chrome));
  // Decorated back plate
  g.add(at(box(0.02, 0.16, 0.5, mat.plastic(0xfafafa), 0.01), -0.575, 0.36, 0));
  for (const [c, z] of [[0xd81b60, -0.14], [0x2e7d32, 0], [0xf9a825, 0.14]]) {
    const petal = at(sphere(0.045, mat.plastic(c)), -0.585, 0.36, z);
    petal.scale.set(0.3, 1, 1);
    g.add(petal);
  }
  return g;
}

/** Ride-on jeep — glossy white body, black trims, knobbly tyres, windscreen and spare wheel. */
export function jeep({ body = 0xf1f2f4 } = {}) {
  const g = new THREE.Group();
  const paint = mat.plastic(body, { roughness: 0.3, clearcoat: 1 });
  const trim = mat.plastic(0x1d1d1f, { roughness: 0.5 });
  const wr = 0.15;
  for (const x of [0.42, -0.42]) for (const sd of [-1, 1]) g.add(at(wheel({ r: wr, w: 0.12, knobs: true, rim: mat.steel(0xb9bdc3), spokes: 6 }), x, wr, sd * 0.33));
  // Tub, bonnet, fenders
  g.add(at(box(1.0, 0.24, 0.56, paint, 0.06), 0, 0.34, 0));
  g.add(at(box(0.36, 0.1, 0.54, paint, 0.05), 0.33, 0.49, 0, 0, 0, -0.06));
  for (const x of [0.42, -0.42]) for (const sd of [-1, 1]) g.add(at(box(0.36, 0.05, 0.14, trim, 0.025), x, 0.33, sd * 0.33));
  // Grille, headlights, bumpers
  g.add(at(box(0.03, 0.14, 0.34, trim, 0.012), 0.51, 0.4, 0));
  for (let i = -3; i <= 3; i++) g.add(at(box(0.012, 0.1, 0.018, mat.steel(0x8a8f96), 0.004), 0.527, 0.4, i * 0.042));
  for (const sd of [-1, 1]) {
    g.add(at(cyl(0.045, 0.045, 0.03, mat.chrome(), 32), 0.51, 0.43, sd * 0.21, 0, 0, Z));
    g.add(at(cyl(0.036, 0.036, 0.012, mat.lamp(), 32), 0.528, 0.43, sd * 0.21, 0, 0, Z));
  }
  g.add(at(box(0.07, 0.07, 0.62, trim, 0.025), 0.55, 0.25, 0));
  g.add(at(box(0.07, 0.07, 0.62, trim, 0.025), -0.53, 0.25, 0));
  // Windscreen frame + glass
  g.add(tube([[0.16, 0.5, -0.26], [0.1, 0.78, -0.26], [0.1, 0.78, 0.26], [0.16, 0.5, 0.26]], 0.016, trim, 64));
  const glass = at(box(0.012, 0.25, 0.48, mat.glass({ color: 0xcfe3f0 }), 0.004), 0.13, 0.64, 0, 0, 0, -0.2);
  g.add(glass);
  // Seat, steering wheel, roll bar
  g.add(at(box(0.22, 0.07, 0.42, mat.leather(0x222226), 0.03), -0.18, 0.5, 0));
  g.add(at(box(0.07, 0.2, 0.42, mat.leather(0x222226), 0.03), -0.3, 0.6, 0, 0, 0, 0.15));
  g.add(at(torus(0.08, 0.012, trim), 0.02, 0.64, 0.1, 0, Z, 0.5));
  g.add(tube([[0.12, 0.5, 0.1], [0.04, 0.62, 0.1]], 0.012, trim));
  g.add(tube([[-0.36, 0.46, -0.25], [-0.36, 0.86, -0.22], [-0.36, 0.86, 0.22], [-0.36, 0.46, 0.25]], 0.02, trim, 64));
  // Spare wheel
  g.add(at(wheel({ r: 0.12, w: 0.08, knobs: true, rim: mat.steel(0xb9bdc3), spokes: 6 }), -0.58, 0.44, 0, 0, Z, 0));
  // Side stripe
  for (const sd of [-1, 1]) g.add(at(box(0.62, 0.025, 0.004, mat.plastic(0x1565c0), 0.002), 0.02, 0.38, sd * 0.281));
  return g;
}

/** Kids' tricycle — curved red steel frame, big front wheel with pedals, rear step and basket. */
export function tricycle({ frameColor = 0xc62828 } = {}) {
  const g = new THREE.Group();
  const frame = mat.plastic(frameColor, { roughness: 0.28, clearcoat: 1 });
  const white = mat.plastic(0xf5f5f5, { roughness: 0.35 });
  g.add(at(wheel({ r: 0.2, w: 0.06, rim: white, spokes: 6 }), 0.36, 0.2, 0));
  for (const sd of [-1, 1]) g.add(at(wheel({ r: 0.12, w: 0.05, rim: white, spokes: 5 }), -0.3, 0.12, sd * 0.24));
  g.add(tube([[0.33, 0.56, 0], [0.18, 0.46, 0], [0.0, 0.38, 0], [-0.18, 0.3, 0], [-0.3, 0.2, 0]], 0.03, frame));
  g.add(at(box(0.22, 0.03, 0.44, frame, 0.012), -0.3, 0.2, 0)); // rear step / axle housing
  for (const sd of [-1, 1]) g.add(tube([[0.36, 0.2, sd * 0.04], [0.345, 0.42, sd * 0.045], [0.33, 0.6, 0]], 0.016, mat.chrome()));
  g.add(tube([[0.24, 0.72, -0.2], [0.33, 0.66, -0.08], [0.33, 0.66, 0.08], [0.24, 0.72, 0.2]], 0.014, mat.chrome()));
  g.add(at(cyl(0.016, 0.016, 0.1, mat.chrome(), 16), 0.33, 0.62, 0));
  for (const sd of [-1, 1]) g.add(at(cyl(0.022, 0.022, 0.08, white, 20), 0.23, 0.72, sd * 0.23, Z, 0, 0));
  // Pedals on the front hub
  for (const sd of [-1, 1]) {
    g.add(at(box(0.012, 0.09, 0.012, mat.chrome(), 0.004), 0.36, 0.2 + sd * 0.045, sd * 0.05));
    g.add(at(box(0.07, 0.02, 0.05, mat.rubber(), 0.008), 0.36, 0.2 + sd * 0.09, sd * 0.085));
  }
  // Saddle
  g.add(at(cyl(0.015, 0.015, 0.1, mat.chrome(), 16), -0.04, 0.42, 0));
  const saddle = at(box(0.18, 0.06, 0.15, mat.leather(0x1f1f22), 0.03), -0.05, 0.49, 0);
  g.add(saddle);
  // Rear basket
  g.add(at(box(0.16, 0.12, 0.3, mat.plastic(0xfafafa, { roughness: 0.5 }), 0.02), -0.33, 0.3, 0));
  for (let i = -2; i <= 2; i++) for (const sd of [-1, 1]) g.add(at(box(0.012, 0.07, 0.03, mat.plastic(0xc62828), 0.004), -0.33 + sd * 0.08, 0.31, i * 0.055));
  return g;
}

/** Sit-on excavator — yellow body, turning seat, working arm with bucket, four wheels. */
export function excavator() {
  const g = new THREE.Group();
  const yellow = mat.plastic(0xf2b705, { roughness: 0.32 });
  const black = mat.plastic(0x1d1d1f, { roughness: 0.5 });
  const wr = 0.09;
  for (const x of [0.28, -0.28]) for (const sd of [-1, 1]) g.add(at(wheel({ r: wr, w: 0.07, rim: black, spokes: 5, tread: false }), x, wr, sd * 0.22));
  g.add(at(box(0.72, 0.12, 0.4, yellow, 0.04), 0, 0.17, 0));
  g.add(at(cyl(0.16, 0.18, 0.05, black, 48), 0, 0.25, 0));
  g.add(at(box(0.5, 0.16, 0.36, yellow, 0.05), -0.04, 0.35, 0));
  g.add(at(box(0.18, 0.05, 0.26, mat.leather(0x1f1f22), 0.025), -0.06, 0.455, 0));
  g.add(at(box(0.05, 0.18, 0.26, mat.leather(0x1f1f22), 0.025), -0.18, 0.54, 0, 0, 0, 0.12));
  // Control levers
  for (const sd of [-1, 1]) {
    g.add(tube([[0.12, 0.43, sd * 0.13], [0.16, 0.56, sd * 0.13]], 0.01, black));
    g.add(at(sphere(0.022, mat.plastic(0xc62828)), 0.16, 0.57, sd * 0.13));
  }
  // Boom, stick and bucket
  const boomRoot = [0.2, 0.4, 0];
  g.add(at(box(0.44, 0.07, 0.07, yellow, 0.025), 0.38, 0.52, 0, 0, 0, 0.5));
  g.add(at(box(0.3, 0.06, 0.06, yellow, 0.022), 0.62, 0.52, 0, 0, 0, -0.7));
  g.add(tube([[0.24, 0.42, 0.05], [0.44, 0.6, 0.05]], 0.012, mat.chrome()));
  const bucket = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 32, 1, true, 0, Math.PI * 1.1), mat.plastic(0xf2b705, { side: THREE.DoubleSide })));
  g.add(at(bucket, 0.72, 0.36, 0, Z, 0, 0.8));
  for (const sd of [-1, 1]) g.add(at(cyl(0.09, 0.09, 0.01, yellow, 32, false), 0.72, 0.36, sd * 0.08, Z, 0, 0));
  for (let i = -1; i <= 1; i++) g.add(at(box(0.04, 0.02, 0.02, mat.steel(0x6b6e72), 0.005), 0.8, 0.3, i * 0.05, 0, 0, -0.6));
  void boomRoot;
  // Hazard stripe on the back
  g.add(at(box(0.02, 0.06, 0.34, black, 0.008), -0.29, 0.35, 0));
  return g;
}

export const MODELS = { motorcycle, commando, rickshaw, jeep, tricycle, excavator };
