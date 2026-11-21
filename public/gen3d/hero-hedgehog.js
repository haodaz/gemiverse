export const META = {
  id: 'hedgehog',
  name: 'Cozy Hedgehog',
  kind: 'creature',
  footprint: [0.16, 0.19],
  variants: ['woodland', 'cinnamon', 'snow', 'cozy'],
  note: 'Stylised standing hedgehog (~0.22 m) with rows of layered instanced spines, sculpted chibi face, and tiny paws.'
};

const VARIANTS = {
  woodland: {
    fur: '#ead8c0',
    furAccent: '#5c3c27',
    eye: '#8c4e24',
    skin: '#e5a99c',
    primary: '#b94c3b',
    secondary: '#f2e3cc'
  },
  cinnamon: {
    fur: '#f4e0c8',
    furAccent: '#975632',
    eye: '#aa662a',
    skin: '#eab09e',
    primary: '#4f7358',
    secondary: '#f5e8d4'
  },
  snow: {
    fur: '#f5f0e9',
    furAccent: '#8d7f76',
    eye: '#5a7891',
    skin: '#ebb5bb',
    primary: '#5d6f96',
    secondary: '#f7f4ef'
  },
  cozy: {
    fur: '#ebd9c1',
    furAccent: '#5f3e29',
    eye: '#8c4e24',
    skin: '#e6aa9d',
    primary: '#b94c3b',
    secondary: '#f3e5cf'
  }
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixHex(THREE, a, b, t) {
  const c = new THREE.Color(a);
  c.lerp(new THREE.Color(b), clamp(t, 0, 1));
  return '#' + c.getHexString();
}

function shiftHSL(THREE, col, dh, ds, dl) {
  const c = new THREE.Color(col);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + dh + 1) % 1,
    clamp(hsl.s + ds, 0, 1),
    clamp(hsl.l + dl, 0, 1)
  );
  return c;
}

function cssRGB(THREE, col, alpha) {
  const c = new THREE.Color(col);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

// ---------- Sculpting functions shared by geometry, attachments & spines ----------

function bodyMantleMask(nx, ny, nz) {
  const t = (ny + 1) * 0.5;
  // Clean flank border curving behind the arms and tapering around the hips
  const borderZ = -0.04 - 0.14 * (1 - smoothstep(0.18, 0.78, t));
  const backSide = smoothstep(borderZ + 0.14, borderZ - 0.12, nz);
  const topTrim = smoothstep(0.95, 0.80, t);
  const botTrim = smoothstep(0.05, 0.20, t);
  return backSide * topTrim * botTrim;
}

function sculptBody(nx, ny, nz, noise) {
  const t = (ny + 1) * 0.5;
  const ry = 0.062;

  // Plump chibi pear silhouette: soft wide haunches tapering cleanly into shoulders & nested neck
  const shoulderTaper = 1.0 - 0.34 * smoothstep(0.46, 0.96, t);
  const hipFullness = 1.0 + 0.15 * Math.exp(-Math.pow((t - 0.33) / 0.24, 2));
  const neckPinch = 1.0 - 0.18 * smoothstep(0.82, 1.0, t);

  const rx = 0.058 * shoulderTaper * hipFullness * neckPinch;
  const rz = 0.055 * shoulderTaper * hipFullness * neckPinch;

  let x = nx * rx;
  let z = nz * rz;
  let y = 0.056 + ny * ry;

  // Plush rounded front belly
  const belly = Math.max(0, nz) * 0.015 * Math.exp(-Math.pow((t - 0.38) / 0.26, 2));
  z += belly;

  // Soft chest nest under chin
  const chestScoop = Math.max(0, nz) * 0.005 * smoothstep(0.74, 0.94, t);
  z -= chestScoop;

  // Slightly hunched plush dorsal mantle cushion where spines root
  const mantle = bodyMantleMask(nx, ny, nz);
  const mantlePush = mantle * 0.0065 * Math.sin(clamp(t, 0, 1) * Math.PI);
  x += nx * mantlePush * 0.75;
  z += nz * mantlePush * 1.15;

  // Softly flatten underside so torso rests cleanly over legs
  if (ny < -0.52) {
    const excess = ny + 0.52;
    y = 0.056 + (-0.52 + excess * 0.44) * ry;
  }

  // Subtle organic fur undulation
  const n = (noise(nx * 3.1 + 4.2, ny * 3.1 + nz * 2.4 + 1.7) - 0.5) * 0.0014;
  x += nx * n;
  y += ny * n * 0.6;
  z += nz * n;

  return { x, y, z };
}

function headHoodMask(nx, ny, nz) {
  // Cute hedgehog widow's peak hairline dipping gently at center forehead
  const widowsPeak = 0.44 - 0.11 * Math.exp(-Math.pow(nx / 0.25, 2)) + 0.12 * Math.abs(nx);
  const aboveBrow = smoothstep(widowsPeak - 0.09, widowsPeak + 0.09, ny);
  const backCrown = smoothstep(0.24, -0.06, nz);
  const behindCheeks = smoothstep(-0.22, 0.16, ny - 0.25 * nz);
  return clamp(Math.max(aboveBrow * smoothstep(0.86, 0.34, nz), backCrown * behindCheeks), 0, 1);
}

function sculptHead(nx, ny, nz, noise) {
  // Base plush chibi head centered around (0, 0.016, 0.004)
  let x = nx * 0.050;
  let y = 0.016 + ny * 0.045;
  let z = 0.004 + nz * 0.047;

  // Soft chubby chibi cheeks bulging outward & gently down-forward
  const cheekZone =
    Math.pow(Math.abs(nx), 1.35) *
    Math.exp(-Math.pow((ny + 0.16) / 0.42, 2)) *
    smoothstep(-0.30, 0.55, nz);
  x += Math.sign(nx) * cheekZone * 0.0095;
  z += cheekZone * 0.0042;
  y -= cheekZone * 0.0020;

  // Continuous tapered soft hedgehog muzzle/snout protruding forward (+Z)
  if (nz > -0.05) {
    const dMuzzle = Math.hypot(nx / 0.56, (ny + 0.16) / 0.46);
    const muzzleBell = Math.pow(smoothstep(1.0, 0.0, dMuzzle), 1.35) * smoothstep(-0.05, 0.48, nz);
    z += muzzleBell * 0.031;
    // Gently taper muzzle width & height toward snout tip
    const pinch = muzzleBell * 0.24;
    x *= 1 - pinch * 0.55;
    y = lerp(y, 0.005, pinch * 0.42);
    // Subtle smile-pad softness beneath nose
    const upperLip = Math.exp(-Math.pow((dMuzzle - 0.32) / 0.24, 2)) * smoothstep(0.5, 0.92, nz);
    z += upperLip * 0.0022;
  }

  // Shallow eye socket recesses so glossy eyes sit naturally inset
  for (let side = -1; side <= 1; side += 2) {
    const ex = side * 0.47;
    const ey = 0.08;
    const ez = 0.878;
    const dot = nx * ex + ny * ey + nz * ez;
    const socket = Math.exp(-Math.pow((1 - dot) / 0.052, 2));
    x -= nx * socket * 0.0034;
    y -= ny * socket * 0.0024;
    z -= nz * socket * 0.0038;
  }

  // Soft brow fullness above eyes
  const brow =
    Math.exp(-Math.pow((ny - 0.34) / 0.18, 2)) *
    smoothstep(0.28, 0.78, nz) *
    smoothstep(0.82, 0.15, Math.abs(nx));
  z += brow * 0.0032;
  y += brow * 0.0018;

  // Slightly fuller spine-hood cushion over crown & nape
  const hood = headHoodMask(nx, ny, nz);
  x += nx * hood * 0.0036;
  y += Math.max(0, ny) * hood * 0.0038;
  z += Math.min(0, nz) * hood * 0.0052;

  // Smooth neck-collar skirt on underside of head so it blends seamlessly into upper body
  if (ny < -0.48) {
    const k = smoothstep(-0.48, -0.96, ny);
    y -= k * 0.0055;
    z -= k * 0.006 * smoothstep(-0.2, 0.8, nz);
    x *= 1 - k * 0.12;
  }

  // Subtle organic fur puff micro-relief
  const n = (noise(nx * 3.6 + 8.1, ny * 3.6 + nz * 2.8 + 3.3) - 0.5) * 0.0012;
  x += nx * n;
  y += ny * n * 0.7;
  z += nz * n;

  return { x, y, z };
}

function sampleSurfaceWithNormal(THREE, sculptFn, nx, ny, nz, noise) {
  const len = Math.hypot(nx, ny, nz) || 1;
  const ux = nx / len;
  const uy = ny / len;
  const uz = nz / len;

  const p0 = sculptFn(ux, uy, uz, noise);
  const pos = new THREE.Vector3(p0.x, p0.y, p0.z);

  // Compute numerical tangent frame on unit sphere for accurate outward surface normal
  const ref = Math.abs(uy) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const uVec = new THREE.Vector3(ux, uy, uz);
  const t1 = new THREE.Vector3().crossVectors(ref, uVec).normalize();
  const t2 = new THREE.Vector3().crossVectors(uVec, t1).normalize();

  const eps = 0.025;
  const d1 = uVec.clone().addScaledVector(t1, eps).normalize();
  const d2 = uVec.clone().addScaledVector(t2, eps).normalize();
  const q1 = sculptFn(d1.x, d1.y, d1.z, noise);
  const q2 = sculptFn(d2.x, d2.y, d2.z, noise);

  const v1 = new THREE.Vector3(q1.x - p0.x, q1.y - p0.y, q1.z - p0.z);
  const v2 = new THREE.Vector3(q2.x - p0.x, q2.y - p0.y, q2.z - p0.z);
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  if (normal.dot(uVec) < 0) normal.negate();

  return { pos, normal };
}

function buildSculptedSphere(THREE, segW, segH, sculptFn, noise) {
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const p = sculptFn(nx, ny, nz, noise);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------- Tapered Tube Helper (parallel-transport frame + rounded caps) ----------

function createTaperedTube(THREE, curve, radialSegs, tubularSegs, radiusFn, capStart = true, capEnd = true) {
  const rings = [];

  const getRadii = (u) => {
    const r = radiusFn(u);
    return typeof r === 'number' ? { rx: r, ry: r } : r;
  };

  // Sample curve + tangents
  const pts = [];
  const tans = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    pts.push(curve.getPointAt(u));
    tans.push(curve.getTangentAt(u).normalize());
  }

  // Parallel-transport (Bishop) frames so curved limbs never twist-kink
  const norms = [];
  const binorms = [];
  const initRef = Math.abs(tans[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(initRef, tans[0]).normalize();
  const b0 = new THREE.Vector3().crossVectors(tans[0], n0).normalize();
  // Ensure N x B = T
  const check = new THREE.Vector3().crossVectors(n0, b0);
  if (check.dot(tans[0]) < 0) b0.negate();
  norms.push(n0);
  binorms.push(b0);

  const qRot = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    qRot.setFromUnitVectors(tans[i - 1], tans[i]);
    const ni = norms[i - 1].clone().applyQuaternion(qRot).normalize();
    // Re-orthogonalize against tangent
    ni.addScaledVector(tans[i], -ni.dot(tans[i])).normalize();
    const bi = new THREE.Vector3().crossVectors(tans[i], ni).normalize();
    if (new THREE.Vector3().crossVectors(ni, bi).dot(tans[i]) < 0) bi.negate();
    norms.push(ni);
    binorms.push(bi);
  }

  // Rounded start cap
  if (capStart) {
    const r0 = getRadii(0);
    const capLen = Math.min(r0.rx, r0.ry) * 0.85;
    const capSteps = 3;
    for (let s = capSteps; s >= 1; s--) {
      const ang = (s / capSteps) * (Math.PI * 0.5);
      const scaleR = Math.max(0.0001, Math.cos(ang));
      const offset = -Math.sin(ang) * capLen;
      rings.push({
        center: pts[0].clone().addScaledVector(tans[0], offset),
        N: norms[0],
        B: binorms[0],
        rx: r0.rx * scaleR,
        ry: r0.ry * scaleR,
        u: 0
      });
    }
  }

  // Main tube rings
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const r = getRadii(u);
    rings.push({
      center: pts[i],
      N: norms[i],
      B: binorms[i],
      rx: Math.max(0.0001, r.rx),
      ry: Math.max(0.0001, r.ry),
      u
    });
  }

  // Rounded end cap
  if (capEnd) {
    const r1 = getRadii(1);
    const capLen = Math.min(r1.rx, r1.ry) * 0.92;
    const capSteps = 3;
    const last = tubularSegs;
    for (let s = 1; s <= capSteps; s++) {
      const ang = (s / capSteps) * (Math.PI * 0.5);
      const scaleR = Math.max(0.0001, Math.cos(ang));
      const offset = Math.sin(ang) * capLen;
      rings.push({
        center: pts[last].clone().addScaledVector(tans[last], offset),
        N: norms[last],
        B: binorms[last],
        rx: r1.rx * scaleR,
        ry: r1.ry * scaleR,
        u: 1
      });
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    for (let j = 0; j <= radialSegs; j++) {
      const vFrac = j / radialSegs;
      const a = vFrac * Math.PI * 2;
      const ca = Math.cos(a) * ring.rx;
      const sa = Math.sin(a) * ring.ry;
      positions.push(
        ring.center.x + ring.N.x * ca + ring.B.x * sa,
        ring.center.y + ring.N.y * ca + ring.B.y * sa,
        ring.center.z + ring.N.z * ca + ring.B.z * sa
      );
      uvs.push(vFrac, ring.u);
    }
  }

  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a00 = i * stride + j;
      const a01 = i * stride + j + 1;
      const a10 = (i + 1) * stride + j;
      const a11 = (i + 1) * stride + j + 1;
      indices.push(a00, a01, a11);
      indices.push(a00, a11, a10);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Specialised Geometries (Spines, Lathe Eyes, Bent Extruded Ears, Nose) ----------

function createSpineGeometry(THREE) {
  // Organic hedgehog quill profile: slightly narrowed root, plump lower shaft, sleek tapered tip
  const profile = [
    new THREE.Vector2(0.58, 0.0),
    new THREE.Vector2(1.0, 0.14),
    new THREE.Vector2(0.91, 0.44),
    new THREE.Vector2(0.56, 0.74),
    new THREE.Vector2(0.20, 0.93),
    new THREE.Vector2(0.0, 1.0)
  ];
  const geo = new THREE.LatheGeometry(profile, 6);
  geo.computeVertexNormals();
  return geo;
}

function createEyeLathe(THREE, radius, zSquash) {
  // 18-point rotational profile with subtle proud corneal dome at front pole
  const pts = [];
  const steps = 17;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI; // 0 = back pole, PI = front pole
    const r = Math.sin(theta) * radius;
    const cornea = 0.0007 * Math.pow(smoothstep(0.62 * Math.PI, Math.PI, theta), 2);
    const y = -Math.cos(theta) * radius * zSquash + cornea;
    pts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 22);
  geo.rotateX(Math.PI * 0.5); // +Y becomes +Z (front corneal pole)
  geo.computeVertexNormals();
  return geo;
}

function createIrisLathe(THREE, radius, zSquash) {
  // 16-point annular curved iris dome hugging the front of the eyeball
  const pts = [];
  const steps = 15;
  const tStart = 0.62 * Math.PI;
  const tEnd = 0.855 * Math.PI;
  const rBoost = radius + 0.00038;
  for (let i = 0; i <= steps; i++) {
    const theta = lerp(tStart, tEnd, i / steps);
    const r = Math.sin(theta) * rBoost;
    const cornea = 0.0007 * Math.pow(smoothstep(0.62 * Math.PI, Math.PI, theta), 2);
    const y = -Math.cos(theta) * rBoost * zSquash + cornea + 0.00025;
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function createPupilCap(THREE, radius, zSquash) {
  const pts = [];
  const steps = 8;
  const tStart = 0.845 * Math.PI;
  const tEnd = Math.PI;
  const rBoost = radius + 0.00046;
  for (let i = 0; i <= steps; i++) {
    const theta = lerp(tStart, tEnd, i / steps);
    const r = Math.sin(theta) * rBoost;
    const cornea = 0.0007 * Math.pow(smoothstep(0.62 * Math.PI, Math.PI, theta), 2);
    const y = -Math.cos(theta) * rBoost * zSquash + cornea + 0.00035;
    pts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function createCurvedEarGeometry(THREE, scaleXY, depth, bevelSize) {
  const s = scaleXY;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.0085 * s, 0.0005 * s, 0.0135 * s, 0.008 * s, 0.012 * s, 0.0175 * s);
  shape.bezierCurveTo(0.0108 * s, 0.0255 * s, 0.0048 * s, 0.0285 * s, 0, 0.0285 * s);
  shape.bezierCurveTo(-0.0048 * s, 0.0285 * s, -0.0108 * s, 0.0255 * s, -0.012 * s, 0.0175 * s);
  shape.bezierCurveTo(-0.0135 * s, 0.008 * s, -0.0085 * s, 0.0005 * s, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 3,
    curveSegments: 16
  });
  geo.translate(0, 0, -depth * 0.5);

  // Bend into a cozy forward-cupped spoon ear
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const xn = x / (0.012 * Math.max(0.5, s));
    const yn = clamp(y / (0.0285 * Math.max(0.5, s)), 0, 1);
    const cup = 0.0044 * xn * xn + 0.0032 * yn * yn - 0.0024;
    const tipCurl = -0.0016 * Math.pow(yn, 3);
    z += cup + tipCurl;
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createNoseGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 24, 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.0078;
    let y = ny * 0.0060;
    let z = nz * 0.0062;

    // Gentle rounded-triangle button nose (wider near top, soft taper at bottom)
    const widthMod = 1.0 + 0.16 * ny - 0.14 * Math.max(0, -ny);
    x *= widthMod;

    // Soft central top heart-dimple & tiny septum crease
    const topDimple = Math.exp(-Math.pow(nx / 0.28, 2)) * Math.max(0, ny) * 0.0009;
    y -= topDimple;

    // Subtle nostril indentations on lower front sides
    for (let side = -1; side <= 1; side += 2) {
      const d = Math.hypot((nx - side * 0.44) / 0.24, (ny + 0.18) / 0.22);
      const indent = Math.max(0, 1 - d) * smoothstep(0.1, 0.75, nz);
      z -= indent * 0.0012;
      x -= side * indent * 0.0005;
    }

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------- Procedural CanvasTexture Maps (using kit.canvasTexture & kit.noise) ----------

function makeHeadTextures(THREE, kit, pal) {
  const furBase = new THREE.Color(pal.fur);
  const furLight = shiftHSL(THREE, pal.fur, 0.0, -0.04, 0.07);
  const furWarm = shiftHSL(THREE, pal.fur, -0.015, 0.06, -0.06);
  const undercoat = shiftHSL(THREE, pal.furAccent, 0.0, -0.06, -0.07);
  const blushCol = new THREE.Color(pal.skin);

  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const gx = 128;
    const gy = 64;
    const cw = w / gx;
    const ch = h / gy;
    const tmp = new THREE.Color();

    for (let iy = 0; iy < gy; iy++) {
      const theta = ((iy + 0.5) / gy) * Math.PI;
      const ny = Math.cos(theta);
      const sinT = Math.sin(theta);
      for (let ix = 0; ix < gx; ix++) {
        const phi = ((ix + 0.5) / gx) * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const nz = Math.sin(phi) * sinT;

        tmp.copy(furBase);

        // Lighter creamy snout, chin & cheek highlights
        const snoutMask = smoothstep(0.35, 0.92, nz) * smoothstep(0.35, -0.25, ny);
        tmp.lerp(furLight, snoutMask * 0.58);

        // Warm soft muzzle bridge & brow warmth
        const bridge = Math.exp(-Math.pow(nx / 0.34, 2)) * smoothstep(0.45, 0.85, nz) * smoothstep(-0.05, 0.42, ny);
        tmp.lerp(furWarm, bridge * 0.34);

        // Soft cheek blush warmth baked delicately underneath blush discs
        for (let side = -1; side <= 1; side += 2) {
          const dc = Math.hypot((nx - side * 0.60) / 0.28, (ny + 0.14) / 0.22, (nz - 0.72) / 0.32);
          const bl = Math.max(0, 1 - dc);
          tmp.lerp(blushCol, bl * bl * 0.22);
        }

        // Subtle warm shading inside eye sockets
        for (let side = -1; side <= 1; side += 2) {
          const dot = nx * (side * 0.47) + ny * 0.08 + nz * 0.878;
          const sock = smoothstep(0.93, 0.995, dot);
          tmp.lerp(furWarm, sock * 0.38);
        }

        // Darker undercoat under the crown/nape spine hood so spine gaps look lush
        const hood = headHoodMask(nx, ny, nz);
        const hoodInner = smoothstep(0.35, 0.88, hood);
        tmp.lerp(undercoat, hoodInner * 0.78);

        // Organic noise mottling
        const n = (kit.noise(nx * 5.2 + 2.3, ny * 5.2 + nz * 4.1 + 1.1) - 0.5) * 0.08;
        tmp.offsetHSL(0, 0, n);

        ctx.fillStyle = cssRGB(THREE, tmp);
        ctx.fillRect(ix * cw - 0.5, iy * ch - 0.5, cw + 1.2, ch + 1.2);
      }
    }

    // Painterly directional fur flecks across cheeks, forehead & hood
    ctx.lineCap = 'round';
    for (let i = 0; i < 1900; i++) {
      const fx = kit.noise(i * 1.17, 3.7) * w;
      const fy = kit.noise(7.3, i * 1.31) * h;
      const bright = kit.noise(i * 0.71, i * 0.43) > 0.48;
      const len = 3 + kit.noise(i * 2.1, 1.4) * 5;
      const ang = Math.PI * 0.5 + (kit.noise(fx * 0.02, fy * 0.02) - 0.5) * 0.7;
      ctx.strokeStyle = bright ? 'rgba(255,250,242,0.16)' : 'rgba(62,38,24,0.11)';
      ctx.lineWidth = 0.8 + kit.noise(i * 0.3, 9.1) * 0.9;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
      ctx.stroke();
    }
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (let i = 0; i < 2400; i++) {
      const fx = kit.noise(i * 1.23, 5.1) * w;
      const fy = kit.noise(9.4, i * 1.19) * h;
      const v = Math.floor(95 + kit.noise(i * 0.61, 2.2) * 85);
      const len = 3 + kit.noise(i * 1.7, 4.4) * 5;
      const ang = Math.PI * 0.5 + (kit.noise(fx * 0.03, fy * 0.03) - 0.5) * 0.6;
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
      ctx.stroke();
    }
  });

  return { map, bumpMap };
}

function makeBodyTextures(THREE, kit, pal) {
  const furBase = new THREE.Color(pal.fur);
  const bellyLight = shiftHSL(THREE, pal.fur, 0.0, -0.06, 0.08);
  const flankWarm = shiftHSL(THREE, pal.fur, -0.015, 0.05, -0.08);
  const backDark = shiftHSL(THREE, pal.furAccent, 0.0, -0.05, -0.09);

  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const gx = 128;
    const gy = 64;
    const cw = w / gx;
    const ch = h / gy;
    const tmp = new THREE.Color();

    for (let iy = 0; iy < gy; iy++) {
      const theta = ((iy + 0.5) / gy) * Math.PI;
      const ny = Math.cos(theta);
      const sinT = Math.sin(theta);
      for (let ix = 0; ix < gx; ix++) {
        const phi = ((ix + 0.5) / gx) * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const nz = Math.sin(phi) * sinT;

        tmp.copy(furBase);

        // Soft lighter cream belly patch down the front
        const bellyPatch = smoothstep(0.15, 0.85, nz) * Math.exp(-Math.pow((ny + 0.08) / 0.72, 2));
        tmp.lerp(bellyLight, bellyPatch * 0.65);

        // Subtle underside & lower haunch warmth
        const lowerShade = smoothstep(-0.25, -0.92, ny);
        tmp.lerp(flankWarm, lowerShade * 0.36);

        // Rich darker dorsal undercoat aligned with spine mantle
        const mantle = bodyMantleMask(nx, ny, nz);
        tmp.lerp(backDark, smoothstep(0.18, 0.85, mantle) * 0.86);

        const n = (kit.noise(nx * 4.8 + 5.7, ny * 4.8 + nz * 3.9 + 2.4) - 0.5) * 0.08;
        tmp.offsetHSL(0, 0, n);

        ctx.fillStyle = cssRGB(THREE, tmp);
        ctx.fillRect(ix * cw - 0.5, iy * ch - 0.5, cw + 1.2, ch + 1.2);
      }
    }

    // Soft plush fur flecks
    ctx.lineCap = 'round';
    for (let i = 0; i < 2000; i++) {
      const fx = kit.noise(i * 1.41, 2.3) * w;
      const fy = kit.noise(6.7, i * 1.13) * h;
      const bright = kit.noise(i * 0.53, i * 0.89) > 0.45;
      const len = 4 + kit.noise(i * 1.9, 3.1) * 6;
      const ang = Math.PI * 0.5 + (kit.noise(fx * 0.025, fy * 0.025) - 0.5) * 0.5;
      ctx.strokeStyle = bright ? 'rgba(255,250,242,0.17)' : 'rgba(58,36,22,0.12)';
      ctx.lineWidth = 0.9 + kit.noise(i * 0.4, 7.2) * 0.9;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
      ctx.stroke();
    }
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (let i = 0; i < 2200; i++) {
      const fx = kit.noise(i * 1.37, 4.9) * w;
      const fy = kit.noise(8.2, i * 1.29) * h;
      const v = Math.floor(92 + kit.noise(i * 0.77, 1.8) * 90);
      const len = 4 + kit.noise(i * 1.5, 5.5) * 6;
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy + len);
      ctx.stroke();
    }
  });

  return { map, bumpMap };
}

function makeSpineTextures(THREE, kit, pal) {
  // Iconic banded hedgehog quill: pale root -> warm tan -> deep furAccent band -> frosted cream band -> soft tip
  // Note: Canvas y=0 maps to UV v=1 (tip); Canvas y=h maps to UV v=0 (base).
  const tipDark = shiftHSL(THREE, pal.furAccent, 0, -0.05, -0.10);
  const frostCream = mixHex(THREE, pal.fur, '#fffbf4', 0.55);
  const darkBand = new THREE.Color(pal.furAccent);
  const midWarm = mixHex(THREE, pal.furAccent, pal.fur, 0.42);
  const rootCream = mixHex(THREE, pal.fur, pal.furAccent, 0.22);

  const map = kit.canvasTexture(128, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, cssRGB(THREE, tipDark));
    grad.addColorStop(0.07, frostCream);
    grad.addColorStop(0.24, frostCream);
    grad.addColorStop(0.32, cssRGB(THREE, darkBand));
    grad.addColorStop(0.64, cssRGB(THREE, darkBand));
    grad.addColorStop(0.75, midWarm);
    grad.addColorStop(0.88, rootCream);
    grad.addColorStop(1.0, rootCream);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle longitudinal keratin striations
    for (let x = 0; x < w; x += 2) {
      const n = kit.noise(x * 0.18, 2.5);
      ctx.fillStyle = n > 0.5 ? 'rgba(255,250,242,0.08)' : 'rgba(24,14,8,0.10)';
      ctx.fillRect(x, 0, 2, h);
    }
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const v = Math.floor(110 + kit.noise(x * 0.24, 6.1) * 44);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 2, h);
    }
  });

  return { map, bumpMap };
}

function makeIrisTexture(THREE, kit, eyeColor) {
  // UV v=1 (cy=0) = inner pupil rim; UV v=0 (cy=h) = outer limbal rim
  // UV u=0 / 1 = bottom of eye (bright warm bounce crescent); u=0.5 = top (soft shadow)
  const base = new THREE.Color(eyeColor);
  const bright = shiftHSL(THREE, eyeColor, 0.03, 0.14, 0.22);
  const limbal = shiftHSL(THREE, eyeColor, -0.02, 0.05, -0.26);

  const map = kit.canvasTexture(256, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, cssRGB(THREE, shiftHSL(THREE, eyeColor, 0, 0.05, -0.10)));
    grad.addColorStop(0.28, cssRGB(THREE, base));
    grad.addColorStop(0.78, cssRGB(THREE, base));
    grad.addColorStop(1.0, cssRGB(THREE, limbal));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Warm crescent bounce highlight along lower iris (wrapping u=0 and u=1)
    for (let cx = 0; cx < w; cx += 2) {
      const u = cx / w;
      const distBottom = Math.min(u, 1 - u);
      const glow = Math.exp(-Math.pow(distBottom / 0.22, 2));
      if (glow > 0.02) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.0, cssRGB(THREE, bright, 0));
        g.addColorStop(0.45, cssRGB(THREE, bright, glow * 0.72));
        g.addColorStop(0.85, cssRGB(THREE, bright, glow * 0.35));
        g.addColorStop(1.0, cssRGB(THREE, bright, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx, 0, 2, h);
      }
      // Subtle upper lid ambient shade around u=0.5
      const topShade = Math.exp(-Math.pow((u - 0.5) / 0.24, 2));
      if (topShade > 0.02) {
        ctx.fillStyle = `rgba(12,8,6,${topShade * 0.34})`;
        ctx.fillRect(cx, 0, 2, h);
      }
    }

    // Fine radial iris fibres
    for (let i = 0; i < 140; i++) {
      const x = (i / 140) * w;
      const n = kit.noise(i * 0.45, 3.2);
      ctx.fillStyle = n > 0.5 ? 'rgba(255,244,225,0.14)' : 'rgba(20,10,6,0.16)';
      ctx.fillRect(x, 0, 1.5, h);
    }
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeBlushTexture(THREE, kit, skinColor) {
  const rosy = shiftHSL(THREE, skinColor, -0.02, 0.22, -0.02);
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    grad.addColorStop(0.0, cssRGB(THREE, rosy, 0.52));
    grad.addColorStop(0.48, cssRGB(THREE, rosy, 0.26));
    grad.addColorStop(1.0, cssRGB(THREE, rosy, 0.0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeKnitTextures(THREE, kit, primaryCol, secondaryCol) {
  const base = new THREE.Color(primaryCol);
  const dark = shiftHSL(THREE, primaryCol, 0, 0.04, -0.14);
  const stripe = new THREE.Color(secondaryCol);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = cssRGB(THREE, base);
    ctx.fillRect(0, 0, w, h);

    // Cozy cream knit stripes
    ctx.fillStyle = cssRGB(THREE, stripe);
    ctx.fillRect(0, h * 0.14, w, h * 0.08);
    ctx.fillRect(0, h * 0.78, w, h * 0.08);

    // Ribbed knit V-stitch texture
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 10) {
      for (let x = 0; x < w; x += 12) {
        const shade = kit.noise(x * 0.08, y * 0.08) > 0.5 ? 'rgba(255,248,240,0.14)' : cssRGB(THREE, dark, 0.22);
        ctx.strokeStyle = shade;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 5, y + 7);
        ctx.lineTo(x + 10, y);
        ctx.stroke();
      }
    }
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#707070';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 2.6;
    for (let y = 0; y < h; y += 10) {
      for (let x = 0; x < w; x += 12) {
        ctx.strokeStyle = '#c8c8c8';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 5, y + 7);
        ctx.lineTo(x + 10, y);
        ctx.stroke();
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

// ---------- Instanced Spine Coat Builders ----------

function buildHeadSpines(THREE, spineGeo, spineMat, noise) {
  const transforms = [];
  const shades = [];

  const earDirs = [
    new THREE.Vector3(0.84, 0.42, 0.10).normalize(),
    new THREE.Vector3(-0.84, 0.42, 0.10).normalize()
  ];

  // 11 neat curved rows sweeping from forehead hairline over crown to nape
  const rows = 11;
  for (let r = 0; r < rows; r++) {
    const rowFrac = r / (rows - 1); // 0 = forehead fringe, 1 = lower nape
    // Elevation & back sweep curve along the hood
    const basePitch = lerp(0.56 * Math.PI, -0.14 * Math.PI, rowFrac);
    const cols = Math.round(lerp(13, 21, Math.sin(rowFrac * Math.PI * 0.82 + 0.18)));

    for (let c = 0; c < cols; c++) {
      const cFrac = cols > 1 ? (c / (cols - 1)) * 2 - 1 : 0; // -1..+1 across left/right
      const stagger = ((r % 2) - 0.5) * (0.9 / cols);
      const sideFrac = clamp(cFrac + stagger, -1, 1);

      // Build unit sphere direction on the upper/back hood
      const arcSpan = lerp(0.46 * Math.PI, 0.62 * Math.PI, rowFrac);
      const yaw = Math.PI + sideFrac * arcSpan; // PI = straight back (-Z)
      const jitterPhi = (noise(r * 2.13 + c * 0.91, 4.2) - 0.5) * 0.06;
      const jitterElev = (noise(c * 1.71, r * 2.37 + 1.9) - 0.5) * 0.05;

      // Interpolate smoothly over top of head from forehead (+Z, +Y) to nape (-Z, -Y)
      const elev = lerp(0.42, -0.34, rowFrac) + jitterElev;
      let nx, ny, nz;
      if (rowFrac < 0.42) {
        // Forehead to crown: spans from front-top back over the crown
        const frontBack = lerp(0.68, -0.18, rowFrac / 0.42);
        const sideAng = sideFrac * lerp(0.84, 1.32, rowFrac / 0.42) + jitterPhi;
        nx = Math.sin(sideAng) * Math.sqrt(Math.max(0.05, 1 - frontBack * frontBack * 0.35));
        // Widow's peak forehead dip
        const peakDip = -0.10 * Math.exp(-Math.pow(sideFrac / 0.36, 2)) * (1 - rowFrac / 0.42);
        ny = Math.max(0.28, lerp(0.54, 0.94, rowFrac / 0.42) + peakDip - 0.16 * sideFrac * sideFrac + jitterElev);
        nz = frontBack * Math.cos(sideAng * 0.72);
      } else {
        // Crown down to nape
        const backFrac = (rowFrac - 0.42) / 0.58;
        const elevAng = lerp(0.42 * Math.PI, -0.22 * Math.PI, backFrac) + jitterElev;
        const cosE = Math.cos(elevAng);
        const az = yaw + jitterPhi;
        nx = Math.sin(az) * cosE;
        ny = Math.sin(elevAng);
        nz = Math.cos(az) * cosE;
      }

      const dirU = new THREE.Vector3(nx, ny, nz).normalize();

      // Enforce clean ear-root clearance so spines frame ears naturally
      let nearEar = false;
      for (let e = 0; e < 2; e++) {
        if (dirU.dot(earDirs[e]) > 0.935) {
          nearEar = true;
          break;
        }
      }
      if (nearEar) continue;

      // Stay strictly within the hood hairline
      const mask = headHoodMask(dirU.x, dirU.y, dirU.z);
      if (mask < 0.28) continue;

      const { pos, normal } = sampleSurfaceWithNormal(THREE, sculptHead, dirU.x, dirU.y, dirU.z, noise);
      // Root slightly inside skin so no spine ever floats
      pos.addScaledVector(normal, -0.0036);

      // Swept-back cozy hedgehog flow direction
      const sweep = new THREE.Vector3(
        dirU.x * 0.30 + (noise(c * 3.1, r * 2.7) - 0.5) * 0.14,
        lerp(0.38, -0.26, rowFrac) + (noise(r * 1.9, c * 3.7) - 0.5) * 0.12,
        -1.0
      ).normalize();

      const tiltWeight = lerp(0.74, 0.66, rowFrac);
      const spineDir = normal.clone().lerp(sweep, tiltWeight).normalize();

      // Shorter fluffy fringe on forehead, fuller lush quills over crown & nape
      const lenNoise = 0.88 + noise(c * 2.4 + 1.2, r * 3.3 + 5.1) * 0.24;
      const edgeTaper = smoothstep(0.28, 0.75, mask);
      const length = lerp(0.016, 0.0285, smoothstep(0.0, 0.65, rowFrac)) * lerp(0.76, 1.0, edgeTaper) * lenNoise;
      const radius = lerp(0.0031, 0.0040, smoothstep(0.0, 0.55, rowFrac)) * (0.9 + noise(r * 4.1, c * 1.7) * 0.2);

      transforms.push({ pos, dir: spineDir, length, radius });
      shades.push(0.88 + noise(c * 5.1 + 2.0, r * 4.3 + 1.0) * 0.22);
    }
  }

  return createInstancedSpines(THREE, spineGeo, spineMat, transforms, shades, 'headSpines');
}

function buildBodySpines(THREE, spineGeo, spineMat, noise) {
  const transforms = [];
  const shades = [];

  // 16 curved rows sweeping from upper shoulders down to lower rump & flanks
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    const rowFrac = r / (rows - 1); // 0 = upper shoulders, 1 = lower rump
    const nyBase = lerp(0.74, -0.76, rowFrac);
    const ringSin = Math.sqrt(Math.max(0.12, 1 - nyBase * nyBase));
    const cols = Math.round(lerp(18, 32, ringSin));

    for (let c = 0; c < cols; c++) {
      const cFrac = cols > 1 ? (c / (cols - 1)) * 2 - 1 : 0; // -1..+1 around the back
      const stagger = ((r % 2) - 0.5) * (0.85 / cols);
      const sideFrac = clamp(cFrac + stagger, -1, 1);

      // Wrap around the back (PI = -Z) out to the flanks
      const flankReach = lerp(0.56 * Math.PI, 0.44 * Math.PI, smoothstep(0.55, 1.0, rowFrac));
      const yaw = Math.PI + sideFrac * flankReach;
      const jitterYaw = (noise(c * 1.93 + 3.1, r * 2.41 + 0.7) - 0.5) * 0.06;
      const jitterY = (noise(r * 2.17 + 1.3, c * 1.57 + 4.9) - 0.5) * 0.04;

      // Slight chevron dip down the center back for natural layered thatch
      const chevron = -0.05 * Math.cos(sideFrac * Math.PI * 0.5);
      const ny = clamp(nyBase + chevron + jitterY, -0.86, 0.84);
      const horiz = Math.sqrt(Math.max(0.02, 1 - ny * ny));
      const az = yaw + jitterYaw;
      const nx = Math.sin(az) * horiz;
      const nz = Math.cos(az) * horiz;

      const mask = bodyMantleMask(nx, ny, nz);
      if (mask < 0.25) continue;

      // Keep small neat notch right at tail exit so tail curls out cleanly
      if (ny < -0.50 && ny > -0.76 && Math.abs(nx) < 0.16 && nz < -0.65) continue;

      const { pos, normal } = sampleSurfaceWithNormal(THREE, sculptBody, nx, ny, nz, noise);
      pos.addScaledVector(normal, -0.0038);

      // Swept backward and slightly downward along the back
      const sweep = new THREE.Vector3(
        nx * 0.34 + (noise(c * 2.9, r * 3.1) - 0.5) * 0.14,
        lerp(0.06, -0.52, rowFrac) + (noise(r * 2.3, c * 4.1) - 0.5) * 0.12,
        -0.96
      ).normalize();

      const spineDir = normal.clone().lerp(sweep, 0.68).normalize();

      const lenNoise = 0.86 + noise(c * 2.7 + 3.4, r * 2.1 + 7.2) * 0.28;
      const edgeTaper = smoothstep(0.25, 0.80, mask);
      const midLush = 0.82 + 0.24 * Math.sin(rowFrac * Math.PI);
      const length = 0.028 * midLush * lerp(0.68, 1.0, edgeTaper) * lenNoise;
      const radius = 0.0039 * lerp(0.84, 1.04, edgeTaper) * (0.9 + noise(r * 3.7, c * 2.1) * 0.2);

      transforms.push({ pos, dir: spineDir, length, radius });
      shades.push(0.85 + noise(c * 4.7 + 1.1, r * 3.9 + 2.3) * 0.26);
    }
  }

  return createInstancedSpines(THREE, spineGeo, spineMat, transforms, shades, 'bodySpines');
}

function createInstancedSpines(THREE, spineGeo, spineMat, transforms, shades, name) {
  const count = transforms.length;
  const inst = new THREE.InstancedMesh(spineGeo, spineMat, count);
  inst.name = name;
  inst.userData.slot = 'furAccent';
  inst.castShadow = true;
  inst.receiveShadow = true;

  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const col = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const t = transforms[i];
    if (t.dir.y < -0.999) {
      quat.set(1, 0, 0, 0);
    } else {
      quat.setFromUnitVectors(up, t.dir);
    }
    scale.set(t.radius, t.length, t.radius);
    mat4.compose(t.pos, quat, scale);
    inst.setMatrixAt(i, mat4);

    const s = shades[i];
    col.setRGB(s, s * 0.99, s * 0.97);
    inst.setColorAt(i, col);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  return inst;
}

// ---------- Main Module Exports ----------

export function build(THREE, opts, kit) {
  const safeOpts = opts || {};
  const variantName = VARIANTS[safeOpts.variant] ? safeOpts.variant : 'woodland';
  const preset = VARIANTS[variantName];

  const pal = {
    fur: safeOpts.fur || preset.fur,
    furAccent: safeOpts.furAccent || preset.furAccent,
    eye: safeOpts.eye || preset.eye,
    skin: preset.skin,
    primary: preset.primary,
    secondary: preset.secondary
  };

  const noise = kit.noise;
  const root = new THREE.Group();
  root.name = 'hedgehog';

  // --- Textures & Physical Materials ---
  const headTex = makeHeadTextures(THREE, kit, pal);
  const bodyTex = makeBodyTextures(THREE, kit, pal);
  const spineTex = makeSpineTextures(THREE, kit, pal);
  const irisMap = makeIrisTexture(THREE, kit, pal.eye);
  const blushMap = makeBlushTexture(THREE, kit, pal.skin);

  const furSheen = shiftHSL(THREE, pal.fur, 0, -0.08, 0.16);

  const headFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: headTex.map,
    bumpMap: headTex.bumpMap,
    bumpScale: 0.0016,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.72,
    sheenColor: furSheen
  });

  const bodyFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: bodyTex.map,
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0018,
    roughness: 0.93,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.74,
    sheenColor: furSheen
  });

  const limbFurMat = new THREE.MeshPhysicalMaterial({
    color: shiftHSL(THREE, pal.fur, -0.008, 0.02, -0.04),
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.80,
    sheenRoughness: 0.75,
    sheenColor: furSheen
  });

  const spineMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: spineTex.map,
    bumpMap: spineTex.bumpMap,
    bumpScale: 0.0011,
    roughness: 0.56,
    metalness: 0.0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.48,
    sheen: 0.24,
    sheenRoughness: 0.72,
    sheenColor: shiftHSL(THREE, pal.fur, 0, -0.05, 0.1)
  });

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(pal.skin),
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.55,
    sheenRoughness: 0.7,
    sheenColor: shiftHSL(THREE, pal.skin, 0, -0.05, 0.14)
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: blushMap,
    transparent: true,
    depthWrite: false,
    roughness: 0.96,
    metalness: 0.0,
    sheen: 0.4,
    sheenColor: shiftHSL(THREE, pal.skin, 0, 0, 0.12)
  });

  const eyeGlossMat = new THREE.MeshPhysicalMaterial({
    color: 0x130c09,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    ior: 1.48
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: irisMap,
    roughness: 0.10,
    metalness: 0.0,
    clearcoat: 0.92,
    clearcoatRoughness: 0.06
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.42,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: 0x201512,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.14
  });

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b251c,
    roughness: 0.72,
    metalness: 0.0
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: shiftHSL(THREE, pal.fur, 0, -0.1, 0.06),
    roughness: 0.55,
    metalness: 0.0
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: 0x3c2c24,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18
  });

  const spineGeo = createSpineGeometry(THREE);

  // --- 1. Legs planted firmly on the floor (Y = 0) ---
  const buildLeg = (side, name) => {
    const legGroup = new THREE.Group();
    legGroup.name = name;
    legGroup.position.set(side * 0.030, 0.036, 0.004);
    legGroup.rotation.y = side * 0.24; // Cute slight outward stance

    // Tapered thigh -> ankle -> plump flat-bottomed foot
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.004, 0.020, -0.005),
      new THREE.Vector3(0, -0.006, -0.002),
      new THREE.Vector3(0, -0.024, 0.004),
      new THREE.Vector3(0, -0.029, 0.016),
      new THREE.Vector3(0, -0.029, 0.027)
    ]);

    const legGeo = createTaperedTube(
      THREE,
      legCurve,
      14,
      16,
      (u) => {
        if (u < 0.45) {
          const r = lerp(0.0175, 0.0115, u / 0.45);
          return { rx: r, ry: r };
        }
        const f = (u - 0.45) / 0.55;
        return {
          rx: lerp(0.0115, 0.0132, Math.sin(f * Math.PI * 0.75)),
          ry: lerp(0.0105, 0.0068, f)
        };
      },
      true,
      true
    );

    // Flatten the foot sole cleanly at world Y = 0.000 (local y = -0.036)
    const lp = legGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      if (lp.getY(i) < -0.036) {
        lp.setY(i, -0.036);
      }
    }
    lp.needsUpdate = true;
    legGeo.computeVertexNormals();

    const legMesh = new THREE.Mesh(legGeo, limbFurMat);
    legMesh.userData.slot = 'fur';
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    legGroup.add(legMesh);

    // 3 tiny cute toes & glossy toenails at the front of each foot
    const toeAngles = [-0.30, 0.0, 0.30];
    for (let t = 0; t < 3; t++) {
      const ang = toeAngles[t];
      const len = t === 1 ? 0.0095 : 0.0082;
      const sx = Math.sin(ang) * 0.0075;
      const sz = 0.027 + Math.cos(ang) * 0.004;
      const ex = sx + Math.sin(ang) * len;
      const ez = sz + Math.cos(ang) * len;

      const toeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx, -0.0315, sz - 0.002),
        new THREE.Vector3(lerp(sx, ex, 0.55), -0.0318, lerp(sz, ez, 0.55)),
        new THREE.Vector3(ex, -0.0325, ez)
      ]);
      const toeGeo = createTaperedTube(THREE, toeCurve, 8, 6, (u) => lerp(0.0036, 0.0025, u), true, true);
      const tp = toeGeo.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        if (tp.getY(i) < -0.036) tp.setY(i, -0.036);
      }
      tp.needsUpdate = true;
      toeGeo.computeVertexNormals();

      const toeMesh = new THREE.Mesh(toeGeo, skinMat);
      toeMesh.userData.slot = 'skin';
      toeMesh.castShadow = true;
      legGroup.add(toeMesh);

      const clawCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ex, -0.0325, ez),
        new THREE.Vector3(ex + Math.sin(ang) * 0.003, -0.0338, ez + Math.cos(ang) * 0.003)
      ]);
      const clawGeo = createTaperedTube(THREE, clawCurve, 6, 4, (u) => lerp(0.0014, 0.0004, u), false, true);
      const clawMesh = new THREE.Mesh(clawGeo, clawMat);
      legGroup.add(clawMesh);
    }

    legGroup.userData.rest = {
      rx: legGroup.rotation.x,
      ry: legGroup.rotation.y,
      rz: legGroup.rotation.z
    };
    return legGroup;
  };

  root.add(buildLeg(1, 'legL'));
  root.add(buildLeg(-1, 'legR'));

  // --- 2. Sculpted Body Torso & Back Spine Coat ---
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(0, 0.026, 0);
  body.userData.rest = { rx: 0, ry: 0, rz: 0 };
  root.add(body);

  const bodyGeo = buildSculptedSphere(THREE, 56, 40, sculptBody, noise);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyFurMat);
  bodyMesh.name = 'bodyMesh';
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  body.add(bodyMesh);

  const bodySpines = buildBodySpines(THREE, spineGeo, spineMat, noise);
  body.add(bodySpines);

  // --- 3. Tiny Curled Tail ---
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.022, -0.052);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.002, 0.008),
    new THREE.Vector3(0.001, -0.001, -0.006),
    new THREE.Vector3(0.003, 0.003, -0.017),
    new THREE.Vector3(0.005, 0.010, -0.021)
  ]);
  const tailGeo = createTaperedTube(THREE, tailCurve, 10, 10, (u) => lerp(0.0082, 0.0026, Math.pow(u, 0.85)), true, true);
  const tailMesh = new THREE.Mesh(tailGeo, limbFurMat);
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  tail.userData.rest = { rx: 0, ry: 0, rz: 0 };
  body.add(tail);

  // --- 4. Tiny Paws / Arms (asymmetric cozy pose: armL near tummy, armR raised!) ---
  const buildArm = (side, raised, name) => {
    const armGroup = new THREE.Group();
    armGroup.name = name;
    armGroup.position.set(side * 0.044, 0.068, 0.019);

    let armCurve;
    if (raised) {
      // Friendly shy raised paw
      armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-side * 0.014, 0.001, -0.006),
        new THREE.Vector3(side * 0.004, 0.001, 0.008),
        new THREE.Vector3(side * 0.016, 0.009, 0.019),
        new THREE.Vector3(side * 0.019, 0.021, 0.026)
      ]);
    } else {
      // Cozy paw tucked softly against the plush belly
      armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-side * 0.014, 0.002, -0.006),
        new THREE.Vector3(side * 0.006, -0.004, 0.012),
        new THREE.Vector3(side * 0.001, -0.013, 0.026),
        new THREE.Vector3(-side * 0.008, -0.016, 0.031)
      ]);
    }

    const armGeo = createTaperedTube(
      THREE,
      armCurve,
      12,
      14,
      (u) => {
        const baseR = lerp(0.0135, 0.0076, smoothstep(0.0, 0.72, u));
        const pawSwell = 1.0 + 0.16 * Math.exp(-Math.pow((u - 0.88) / 0.14, 2));
        return { rx: baseR * pawSwell, ry: baseR * pawSwell * 0.86 };
      },
      true,
      true
    );
    const armMesh = new THREE.Mesh(armGeo, limbFurMat);
    armMesh.userData.slot = 'fur';
    armMesh.castShadow = true;
    armMesh.receiveShadow = true;
    armGroup.add(armMesh);

    // 3 tiny paw fingers + tiny claws at the paw tip
    const tip = armCurve.getPointAt(1);
    const tan = armCurve.getTangentAt(1).normalize();
    const sideVec = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tan);
    if (sideVec.lengthSq() < 0.001) sideVec.set(1, 0, 0);
    sideVec.normalize();
    const upVec = new THREE.Vector3().crossVectors(tan, sideVec).normalize();

    for (let f = -1; f <= 1; f++) {
      const fDir = tan
        .clone()
        .addScaledVector(sideVec, f * 0.42)
        .addScaledVector(upVec, f === 0 ? 0.08 : -0.04)
        .normalize();
      const fStart = tip.clone().addScaledVector(sideVec, f * 0.0036).addScaledVector(tan, -0.0015);
      const fEnd = fStart.clone().addScaledVector(fDir, f === 0 ? 0.0072 : 0.0062);
      const fMid = fStart.clone().lerp(fEnd, 0.52).addScaledVector(upVec, 0.0008);
      const fingerGeo = createTaperedTube(
        THREE,
        new THREE.CatmullRomCurve3([fStart, fMid, fEnd]),
        7,
        5,
        (u) => lerp(0.0026, 0.0018, u),
        true,
        true
      );
      const fingerMesh = new THREE.Mesh(fingerGeo, skinMat);
      fingerMesh.userData.slot = 'skin';
      fingerMesh.castShadow = true;
      armGroup.add(fingerMesh);

      const clawEnd = fEnd.clone().addScaledVector(fDir, 0.0022).addScaledVector(upVec, -0.0008);
      const clawGeo = createTaperedTube(
        THREE,
        new THREE.CatmullRomCurve3([fEnd, clawEnd]),
        6,
        3,
        (u) => lerp(0.0010, 0.0003, u),
        false,
        true
      );
      armGroup.add(new THREE.Mesh(clawGeo, clawMat));
    }

    // Soft tiny pink paw pad on the raised open palm
    if (raised) {
      const padGeo = new THREE.SphereGeometry(0.0036, 12, 10);
      padGeo.scale(1.0, 0.85, 0.45);
      const pad = new THREE.Mesh(padGeo, skinMat);
      pad.userData.slot = 'skin';
      pad.position.copy(tip).addScaledVector(tan, -0.0025).addScaledVector(upVec, -0.0042);
      pad.lookAt(pad.position.clone().sub(upVec));
      armGroup.add(pad);
    }

    armGroup.userData.rest = {
      rx: armGroup.rotation.x,
      ry: armGroup.rotation.y,
      rz: armGroup.rotation.z
    };
    return armGroup;
  };

  body.add(buildArm(1, false, 'armL'));
  body.add(buildArm(-1, true, 'armR'));

  // --- 5. Cozy Knitted Scarf (for 'cozy' variant) ---
  if (variantName === 'cozy') {
    const knitTex = makeKnitTextures(THREE, kit, pal.primary, pal.secondary);
    const scarfMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: knitTex.map,
      bumpMap: knitTex.bumpMap,
      bumpScale: 0.0022,
      roughness: 0.96,
      metalness: 0.0,
      sheen: 0.92,
      sheenRoughness: 0.78,
      sheenColor: shiftHSL(THREE, pal.primary, 0, -0.1, 0.2)
    });
    const tasselMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(pal.secondary),
      roughness: 0.95,
      sheen: 0.85,
      sheenColor: 0xffffff
    });

    const scarfGroup = new THREE.Group();
    scarfGroup.name = 'scarf';

    // Plump neck wrap hugging the shoulder collar
    const wrapPts = [];
    const wrapSegs = 16;
    for (let i = 0; i <= wrapSegs; i++) {
      const a = (i / wrapSegs) * Math.PI * 2 + 0.35;
      const rx = 0.044;
      const rz = 0.042;
      const dip = Math.max(0, Math.sin(a)) * -0.006;
      wrapPts.push(new THREE.Vector3(Math.cos(a) * rx, 0.097 + dip, 0.006 + Math.sin(a) * rz));
    }
    const wrapCurve = new THREE.CatmullRomCurve3(wrapPts, true);
    const wrapGeo = createTaperedTube(THREE, wrapCurve, 12, 32, () => ({ rx: 0.0105, ry: 0.0082 }), false, false);
    const wrapMesh = new THREE.Mesh(wrapGeo, scarfMat);
    wrapMesh.userData.slot = 'primary';
    wrapMesh.castShadow = true;
    wrapMesh.receiveShadow = true;
    scarfGroup.add(wrapMesh);

    // Draped curved beveled scarf tail over the front-left chest
    const tailShape = new THREE.Shape();
    tailShape.moveTo(-0.010, 0);
    tailShape.bezierCurveTo(-0.012, -0.016, -0.013, -0.032, -0.011, -0.044);
    tailShape.lineTo(0.011, -0.044);
    tailShape.bezierCurveTo(0.013, -0.032, 0.012, -0.016, 0.010, 0);
    tailShape.closePath();

    const scarfTailGeo = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.0038,
      bevelEnabled: true,
      bevelThickness: 0.0016,
      bevelSize: 0.0014,
      bevelSegments: 2,
      curveSegments: 10
    });
    const stp = scarfTailGeo.attributes.position;
    for (let i = 0; i < stp.count; i++) {
      const x = stp.getX(i);
      const y = stp.getY(i);
      let z = stp.getZ(i);
      const yn = clamp(-y / 0.044, 0, 1);
      // Drape smoothly outward over the plump belly
      z += Math.sin(yn * Math.PI * 0.72) * 0.014 + Math.sin(x * 90) * 0.0008;
      stp.setXYZ(i, x + yn * 0.004, y, z);
    }
    stp.needsUpdate = true;
    scarfTailGeo.computeVertexNormals();

    const scarfTailMesh = new THREE.Mesh(scarfTailGeo, scarfMat);
    scarfTailMesh.userData.slot = 'primary';
    scarfTailMesh.position.set(0.020, 0.094, 0.045);
    scarfTailMesh.rotation.set(-0.08, 0.28, 0.14);
    scarfTailMesh.castShadow = true;
    scarfGroup.add(scarfTailMesh);

    // Tiny cozy tassels along bottom edge of scarf tail
    for (let t = 0; t < 4; t++) {
      const tx = lerp(-0.008, 0.008, t / 3);
      const tCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(tx + 0.004, -0.043, 0.012),
        new THREE.Vector3(tx + 0.0045, -0.048, 0.013),
        new THREE.Vector3(tx + 0.005, -0.053, 0.012)
      ]);
      const tGeo = createTaperedTube(THREE, tCurve, 6, 5, (u) => lerp(0.0016, 0.0011, u), true, true);
      const tMesh = new THREE.Mesh(tGeo, tasselMat);
      tMesh.userData.slot = 'secondary';
      scarfTailMesh.add(tMesh);
    }

    body.add(scarfGroup);
  }

  // --- 6. Sculpted Head, Spine Hood, Ears & Charming Face ---
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.112, 0.011);
  // Gentle charming pose asymmetry (curious slight tilt & turn)
  head.rotation.set(0.04, 0.10, -0.085);
  head.userData.rest = {
    rx: head.rotation.x,
    ry: head.rotation.y,
    rz: head.rotation.z
  };
  body.add(head);

  const headGeo = buildSculptedSphere(THREE, 56, 40, sculptHead, noise);
  const headMesh = new THREE.Mesh(headGeo, headFurMat);
  headMesh.name = 'headMesh';
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  const headSpines = buildHeadSpines(THREE, spineGeo, spineMat, noise);
  head.add(headSpines);

  // --- Ears (bent ExtrudeGeometry outer fur + soft pink inner ear cup) ---
  const outerEarGeo = createCurvedEarGeometry(THREE, 1.0, 0.0034, 0.0020);
  const innerEarGeo = createCurvedEarGeometry(THREE, 0.70, 0.0014, 0.0010);

  for (let side = -1; side <= 1; side += 2) {
    const earGroup = new THREE.Group();
    earGroup.name = side > 0 ? 'earL' : 'earR';

    const { pos } = sampleSurfaceWithNormal(THREE, sculptHead, side * 0.84, 0.42, 0.10, noise);
    // Sink base cleanly into head fur so there is zero seam
    earGroup.position.set(pos.x - side * 0.0055, pos.y - 0.0035, pos.z - 0.002);
    earGroup.rotation.set(-0.14, side * 0.42, -side * 0.62);

    const outerMesh = new THREE.Mesh(outerEarGeo, limbFurMat);
    outerMesh.userData.slot = 'fur';
    outerMesh.castShadow = true;
    outerMesh.receiveShadow = true;
    earGroup.add(outerMesh);

    const innerMesh = new THREE.Mesh(innerEarGeo, skinMat);
    innerMesh.userData.slot = 'skin';
    innerMesh.position.set(0, 0.0028, 0.0018);
    earGroup.add(innerMesh);

    earGroup.userData.rest = {
      rx: earGroup.rotation.x,
      ry: earGroup.rotation.y,
      rz: earGroup.rotation.z
    };
    head.add(earGroup);
  }

  // --- 3-Layer Glossy Eyes (inset cleanly in sculpted sockets, named for blink) ---
  const eyeRadius = 0.0112;
  const eyeZSquash = 0.74;
  const eyeballGeo = createEyeLathe(THREE, eyeRadius, eyeZSquash);
  const irisGeo = createIrisLathe(THREE, eyeRadius, eyeZSquash);
  const pupilGeo = createPupilCap(THREE, eyeRadius, eyeZSquash);
  const dotBigGeo = new THREE.SphereGeometry(0.0026, 12, 10);
  dotBigGeo.scale(1.0, 1.15, 0.42);
  const dotSmallGeo = new THREE.SphereGeometry(0.00125, 10, 8);
  dotSmallGeo.scale(1.0, 1.0, 0.42);

  for (let side = -1; side <= 1; side += 2) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';

    const { pos, normal } = sampleSurfaceWithNormal(THREE, sculptHead, side * 0.47, 0.08, 0.878, noise);
    // Slightly inset into sculpted socket
    eyeGroup.position.copy(pos).addScaledVector(normal, -0.0032);

    // Orient eye outward with local +Y cleanly vertical for natural blink scaling
    const gazeDir = new THREE.Vector3(side * 0.36, 0.03, 0.93).normalize();
    eyeGroup.lookAt(eyeGroup.position.clone().add(gazeDir));

    // Layer 1: Dark glossy outer eyeball with corneal dome
    const eyeball = new THREE.Mesh(eyeballGeo, eyeGlossMat);
    eyeGroup.add(eyeball);

    // Layer 2: Rich radial coloured iris ring
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.userData.slot = 'eye';
    eyeGroup.add(iris);

    // Glossy deep pupil dome inside iris ring
    const pupil = new THREE.Mesh(pupilGeo, eyeGlossMat);
    eyeGroup.add(pupil);

    // Layer 3: Two crisp white specular highlight dots (consistent warm dorm-lamp side)
    const dotBig = new THREE.Mesh(dotBigGeo, highlightMat);
    dotBig.position.set(0.0030, 0.0034, eyeRadius * eyeZSquash + 0.00055);
    dotBig.rotation.set(-0.28, 0.25, 0);
    eyeGroup.add(dotBig);

    const dotSmall = new THREE.Mesh(dotSmallGeo, highlightMat);
    dotSmall.position.set(-0.0028, -0.0032, eyeRadius * eyeZSquash + 0.00048);
    dotSmall.rotation.set(0.25, -0.22, 0);
    eyeGroup.add(dotSmall);

    // Delicate soft upper lash-line curve hugging top rim of eye
    const lashPts = [
      new THREE.Vector3(-side * 0.0085, 0.0046, 0.0038),
      new THREE.Vector3(0, 0.0102, 0.0048),
      new THREE.Vector3(side * 0.0094, 0.0052, 0.0032)
    ];
    const lashGeo = createTaperedTube(
      THREE,
      new THREE.CatmullRomCurve3(lashPts),
      6,
      10,
      (u) => 0.0005 + 0.0007 * Math.sin(u * Math.PI),
      true,
      true
    );
    eyeGroup.add(new THREE.Mesh(lashGeo, mouthMat));

    head.add(eyeGroup);
  }

  // --- Subtle Blush Discs hugging the cheeks ---
  const blushGeo = new THREE.CircleGeometry(0.0096, 18);
  const bp = blushGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const y = bp.getY(i);
    // Curve slightly backward at rim so it hugs cheek curvature cleanly
    bp.setZ(i, -(x * x + y * y) * 14.0);
  }
  bp.needsUpdate = true;
  blushGeo.computeVertexNormals();

  for (let side = -1; side <= 1; side += 2) {
    const { pos, normal } = sampleSurfaceWithNormal(THREE, sculptHead, side * 0.65, -0.16, 0.74, noise);
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.userData.slot = 'skin';
    blush.position.copy(pos).addScaledVector(normal, 0.0009);
    blush.lookAt(blush.position.clone().add(normal));
    blush.scale.set(1.18, 0.86, 1.0);
    head.add(blush);
  }

  // --- Sculpted Shiny Button Nose right at snout tip ---
  const noseSample = sampleSurfaceWithNormal(THREE, sculptHead, 0, -0.15, 1.0, noise);
  const nose = new THREE.Mesh(createNoseGeometry(THREE), noseMat);
  nose.name = 'nose';
  nose.position.copy(noseSample.pos).addScaledVector(noseSample.normal, 0.0022);
  nose.rotation.x = 0.10;
  nose.castShadow = true;
  head.add(nose);

  // --- Sweet Curved Mouth Line (thin tapered tubes hugging lower muzzle) ---
  const mouthOrigin = sampleSurfaceWithNormal(THREE, sculptHead, 0, -0.32, 0.94, noise).pos;
  // Tiny vertical philtrum
  const philtrumGeo = createTaperedTube(
    THREE,
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, nose.position.y - 0.0042, nose.position.z - 0.0012),
      new THREE.Vector3(0, mouthOrigin.y + 0.0012, mouthOrigin.z + 0.0008)
    ]),
    6,
    4,
    (u) => lerp(0.00075, 0.00065, u),
    true,
    true
  );
  head.add(new THREE.Mesh(philtrumGeo, mouthMat));

  // Symmetric sweet upturned smile curves
  for (let side = -1; side <= 1; side += 2) {
    const mMid = sampleSurfaceWithNormal(THREE, sculptHead, side * 0.14, -0.35, 0.92, noise).pos;
    const mCorner = sampleSurfaceWithNormal(THREE, sculptHead, side * 0.28, -0.28, 0.91, noise).pos;
    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, mouthOrigin.y + 0.0010, mouthOrigin.z + 0.0008),
      new THREE.Vector3(mMid.x, mMid.y - 0.0008, mMid.z + 0.0009),
      new THREE.Vector3(mCorner.x, mCorner.y + 0.0006, mCorner.z + 0.0008)
    ]);
    const smileGeo = createTaperedTube(
      THREE,
      smileCurve,
      6,
      10,
      (u) => lerp(0.00085, 0.00045, u),
      true,
      true
    );
    head.add(new THREE.Mesh(smileGeo, mouthMat));
  }

  // --- Delicate Cheek Whiskers (6 thin tapered tubes) ---
  for (let side = -1; side <= 1; side += 2) {
    for (let w = 0; w < 3; w++) {
      const wy = -0.18 - w * 0.065;
      const rootSample = sampleSurfaceWithNormal(THREE, sculptHead, side * 0.36, wy, 0.91, noise);
      const start = rootSample.pos.clone().addScaledVector(rootSample.normal, -0.001);
      const len = w === 1 ? 0.022 : 0.018;
      const spreadY = (1 - w) * 0.0045;
      const mid = start.clone().add(new THREE.Vector3(side * len * 0.52, spreadY * 0.65, -0.0015));
      const end = start.clone().add(new THREE.Vector3(side * len, spreadY - 0.0025, -0.0065));
      const wGeo = createTaperedTube(
        THREE,
        new THREE.CatmullRomCurve3([start, mid, end]),
        5,
        6,
        (u) => lerp(0.00048, 0.00014, u),
        false,
        true
      );
      head.add(new THREE.Mesh(wGeo, whiskerMat));
    }
  }

  // Cache animated references on root for fast idle()
  root.userData.parts = {
    body,
    head,
    tail,
    earL: head.getObjectByName('earL'),
    earR: head.getObjectByName('earR'),
    eyeL: head.getObjectByName('eyeL'),
    eyeR: head.getObjectByName('eyeR'),
    armL: body.getObjectByName('armL'),
    armR: body.getObjectByName('armR')
  };

  return root;
}

export function idle(group, t) {
  if (!group) return;
  const parts = group.userData && group.userData.parts ? group.userData.parts : {
    body: group.getObjectByName('body'),
    head: group.getObjectByName('head'),
    tail: group.getObjectByName('tail'),
    earL: group.getObjectByName('earL'),
    earR: group.getObjectByName('earR'),
    eyeL: group.getObjectByName('eyeL'),
    eyeR: group.getObjectByName('eyeR'),
    armL: group.getObjectByName('armL'),
    armR: group.getObjectByName('armR')
  };

  const breath = Math.sin(t * 2.25);

  // Cozy breathing on body (anchored near pelvis so feet stay firmly on ground)
  if (parts.body) {
    const r = parts.body.userData.rest || { rx: 0, ry: 0, rz: 0 };
    parts.body.scale.set(1 + breath * 0.011, 1 + breath * 0.016, 1 + breath * 0.012);
    parts.body.rotation.x = r.rx + Math.sin(t * 1.12) * 0.014;
  }

  // Curious gentle head sway, tilt & occasional cute hedgehog sniff-bob
  if (parts.head) {
    const r = parts.head.userData.rest || { rx: 0, ry: 0, rz: 0 };
    const sniffPhase = t % 5.6;
    let sniff = 0;
    if (sniffPhase < 0.68) {
      const env = Math.sin((sniffPhase / 0.68) * Math.PI);
      sniff = Math.sin(sniffPhase * Math.PI * 7.5) * env * 0.038;
    }
    parts.head.rotation.y = r.ry + Math.sin(t * 0.82) * 0.085 + Math.sin(t * 0.36) * 0.035;
    parts.head.rotation.z = r.rz + Math.sin(t * 0.61 + 0.7) * 0.055;
    parts.head.rotation.x = r.rx + Math.sin(t * 1.25 + 0.4) * 0.028 + sniff;
  }

  // Occasional cute ear twitches
  const twitchAt = (time, period, offset) => {
    const p = (time + offset) % period;
    if (p < 0.24) {
      return Math.sin((p / 0.24) * Math.PI * 2) * Math.sin((p / 0.24) * Math.PI) * 0.13;
    }
    return 0;
  };
  if (parts.earL) {
    const r = parts.earL.userData.rest || { rx: 0, ry: 0, rz: 0 };
    const tw = twitchAt(t, 4.9, 0.8);
    parts.earL.rotation.z = r.rz + breath * 0.02 + tw;
  }
  if (parts.earR) {
    const r = parts.earR.userData.rest || { rx: 0, ry: 0, rz: 0 };
    const tw = twitchAt(t, 5.4, 2.9);
    parts.earR.rotation.z = r.rz - breath * 0.02 - tw;
  }

  // Gentle paw motion (raised paw subtly waves, tummy paw breathes)
  if (parts.armR) {
    const r = parts.armR.userData.rest || { rx: 0, ry: 0, rz: 0 };
    parts.armR.rotation.z = r.rz + Math.sin(t * 2.0) * 0.055;
    parts.armR.rotation.x = r.rx + Math.sin(t * 1.35 + 0.5) * 0.045;
  }
  if (parts.armL) {
    const r = parts.armL.userData.rest || { rx: 0, ry: 0, rz: 0 };
    parts.armL.rotation.x = r.rx + breath * 0.022;
  }

  // Subtle happy tail wiggle
  if (parts.tail) {
    const r = parts.tail.userData.rest || { rx: 0, ry: 0, rz: 0 };
    parts.tail.rotation.y = r.ry + Math.sin(t * 3.1) * 0.085;
    parts.tail.rotation.x = r.rx + breath * 0.035;
  }

  // Natural periodic blink every ~3.6 s (with occasional cute double-blink)
  const blinkPeriod = 3.6;
  const phase = t % blinkPeriod;
  const cycle = Math.floor(t / blinkPeriod);
  let blinkScale = 1.0;
  if (phase >= 3.08 && phase <= 3.24) {
    const u = (phase - 3.08) / 0.16;
    blinkScale = 1.0 - 0.94 * Math.sin(u * Math.PI);
  } else if (cycle % 3 === 2 && phase >= 3.32 && phase <= 3.46) {
    const u = (phase - 3.32) / 0.14;
    blinkScale = 1.0 - 0.92 * Math.sin(u * Math.PI);
  }

  if (parts.eyeL) parts.eyeL.scale.y = blinkScale;
  if (parts.eyeR) parts.eyeR.scale.y = blinkScale;
}