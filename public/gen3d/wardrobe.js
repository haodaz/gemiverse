// Chibi character (~1.1 m tall) wearable parts module for three.js r160
// Coordinate system: origin between feet (y = 0), +Y up, +Z forward.
// Head: sphere r = 0.22 at (0, 0.86, 0). Torso: y = 0.34..0.64, shoulder width ~0.24.
// Arms: x = +-0.15. Legs: y = 0..0.34, x = +-0.065.

const H_Y = 0.86;
const H_R = 0.22;

function mat(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.78,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.04,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
  });
}

function addMesh(THREE, parent, geo, material, slot, xform = {}) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.userData.slot = slot;
  mesh.castShadow = xform.castShadow !== undefined ? xform.castShadow : true;
  mesh.receiveShadow = xform.receiveShadow !== undefined ? xform.receiveShadow : true;
  if (xform.pos) mesh.position.set(xform.pos[0], xform.pos[1], xform.pos[2]);
  if (xform.rot) mesh.rotation.set(xform.rot[0], xform.rot[1], xform.rot[2]);
  if (xform.scale) mesh.scale.set(xform.scale[0], xform.scale[1], xform.scale[2]);
  parent.add(mesh);
  return mesh;
}

function latheGeo(THREE, pts, segs = 24, phiStart = 0, phiLen = Math.PI * 2) {
  const vecs = pts.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(vecs, segs, phiStart, phiLen);
}

function tubeGeo(THREE, pts, radius, tubSegs = 18, radSegs = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    closed
  );
  return new THREE.TubeGeometry(curve, tubSegs, radius, radSegs, closed);
}

function roundedRectShape(THREE, w, h, r) {
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.min(r, hw, hh);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return s;
}

function extrudeCentered(THREE, shape, depth, bevel = 0.006, segs = 10) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: segs,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function hairMat(THREE, color) {
  return mat(THREE, color, { roughness: 0.72, metalness: 0.03 });
}

function hairCap(THREE, group, m, opts = {}) {
  const r = opts.r || 0.233;
  const thetaLen = opts.thetaLen || Math.PI * 0.62;
  const geo = new THREE.SphereGeometry(r, 24, 18, 0, Math.PI * 2, 0, thetaLen);
  addMesh(THREE, group, geo, m, opts.slot || 'primary', {
    pos: [0, H_Y + (opts.yOff || 0.005), opts.zOff || -0.012],
    rot: [opts.tiltX !== undefined ? opts.tiltX : -0.22, 0, 0],
    scale: opts.scale || [1.01, 1.0, 1.03],
  });
}

function hairLock(THREE, group, m, pts, radius, slot = 'primary') {
  const geo = tubeGeo(THREE, pts, radius, 14, 8, false);
  addMesh(THREE, group, geo, m, slot);
  const last = pts[pts.length - 1];
  const tipGeo = new THREE.SphereGeometry(radius * 0.85, 8, 8);
  addMesh(THREE, group, tipGeo, m, slot, { pos: last });
}

function torsoShell(THREE, group, m, slot, opts = {}) {
  const y0 = opts.y0 !== undefined ? opts.y0 : 0.34;
  const y1 = opts.y1 !== undefined ? opts.y1 : 0.64;
  const rBot = opts.rBot !== undefined ? opts.rBot : 0.128;
  const rMid = opts.rMid !== undefined ? opts.rMid : 0.132;
  const rTop = opts.rTop !== undefined ? opts.rTop : 0.108;
  const rNeck = opts.rNeck !== undefined ? opts.rNeck : 0.068;
  const pts = [
    [rBot * 0.92, y0],
    [rBot, y0 + 0.02],
    [rMid, (y0 + y1) * 0.5],
    [rTop + 0.012, y1 - 0.055],
    [rTop, y1 - 0.02],
    [rNeck, y1],
  ];
  const geo = latheGeo(THREE, pts, 24);
  addMesh(THREE, group, geo, m, slot, { scale: opts.scale || [1.06, 1, 0.92] });
}

function addSleeves(THREE, group, m, slot, opts = {}) {
  const len = opts.len !== undefined ? opts.len : 0.18;
  const rTop = opts.rTop !== undefined ? opts.rTop : 0.054;
  const rBot = opts.rBot !== undefined ? opts.rBot : 0.044;
  const yTop = opts.yTop !== undefined ? opts.yTop : 0.605;
  const tilt = opts.tilt !== undefined ? opts.tilt : 0.14;
  const capGeo = new THREE.SphereGeometry(rTop * 1.02, 14, 12);
  const cylGeo = new THREE.CylinderGeometry(rTop, rBot, len, 14);
  for (const s of [-1, 1]) {
    const xShoulder = s * 0.138;
    addMesh(THREE, group, capGeo, m, slot, { pos: [xShoulder, yTop - 0.01, 0] });
    const dx = Math.sin(tilt) * (len / 2);
    const dy = Math.cos(tilt) * (len / 2);
    addMesh(THREE, group, cylGeo, m, slot, {
      pos: [xShoulder + s * dx, yTop - 0.01 - dy, 0],
      rot: [0, 0, s * tilt],
    });
    if (opts.cuffMat) {
      const cuffGeo = new THREE.CylinderGeometry(rBot * 1.04, rBot * 0.96, 0.028, 14);
      const ex = xShoulder + s * Math.sin(tilt) * len;
      const ey = yTop - 0.01 - Math.cos(tilt) * len;
      addMesh(THREE, group, cuffGeo, opts.cuffMat, opts.cuffSlot || 'secondary', {
        pos: [ex, ey, 0],
        rot: [0, 0, s * tilt],
      });
    }
  }
}

// ============================================================================
// HAIR (16 styles)
// ============================================================================

export const HAIR = {
  short(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x4a3525);
    hairCap(THREE, g, m, { r: 0.236, thetaLen: Math.PI * 0.65, tiltX: -0.25 });
    // Crown volume + back nape
    addMesh(THREE, g, new THREE.SphereGeometry(0.16, 16, 14), m, 'primary', {
      pos: [0, H_Y + 0.11, -0.04],
      scale: [1.15, 0.72, 1.05],
    });
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.085, 0.11, 8, 12), m, 'primary', {
      pos: [0, H_Y - 0.04, -0.16],
      rot: [0.25, 0, Math.PI / 2],
    });
    // Layered side-swept bangs
    const bangs = [
      [[-0.14, 1.02, 0.12], [-0.07, 0.98, 0.20], [0.02, 0.95, 0.22]],
      [[-0.06, 1.05, 0.12], [0.03, 1.00, 0.20], [0.11, 0.95, 0.19]],
      [[0.05, 1.04, 0.11], [0.13, 0.98, 0.17], [0.18, 0.91, 0.13]],
      [[-0.17, 0.98, 0.09], [-0.19, 0.90, 0.11], [-0.18, 0.83, 0.08]],
    ];
    for (const b of bangs) hairLock(THREE, g, m, b, 0.036);
    // Sideburns
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.028, 0.07, 6, 10), m, 'primary', {
        pos: [s * 0.205, H_Y - 0.01, 0.03],
        rot: [0.15, 0, s * 0.12],
      });
    }
    return g;
  },

  buzz(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x2f2622);
    hairCap(THREE, g, m, { r: 0.228, thetaLen: Math.PI * 0.56, tiltX: -0.18, zOff: -0.006 });
    // Subtle upper crown fade layer
    hairCap(THREE, g, m, {
      r: 0.232,
      thetaLen: Math.PI * 0.36,
      tiltX: -0.12,
      yOff: 0.008,
      zOff: -0.004,
    });
    // Clean hairline front ridge
    addMesh(THREE, g, new THREE.TorusGeometry(0.16, 0.018, 10, 20, Math.PI * 0.9), m, 'primary', {
      pos: [0, H_Y + 0.115, 0.06],
      rot: [Math.PI * 0.58, 0, 0.15],
    });
    // Temple fade patches
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.SphereGeometry(0.065, 12, 10), m, 'primary', {
        pos: [s * 0.18, H_Y + 0.03, -0.02],
        scale: [0.5, 1.15, 1.2],
      });
    }
    return g;
  },

  middlePart(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x3b2c26);
    hairCap(THREE, g, m, { r: 0.236, thetaLen: Math.PI * 0.66, tiltX: -0.24 });
    // Symmetrical curtain bangs + side volume
    for (const s of [-1, 1]) {
      hairLock(THREE, g, m, [
        [s * 0.015, 1.06, 0.10],
        [s * 0.09, 1.00, 0.20],
        [s * 0.16, 0.91, 0.18],
        [s * 0.19, 0.80, 0.12],
      ], 0.042);
      hairLock(THREE, g, m, [
        [s * 0.04, 1.05, 0.04],
        [s * 0.16, 0.96, 0.08],
        [s * 0.21, 0.83, 0.04],
        [s * 0.19, 0.72, -0.02],
      ], 0.046);
    }
    // Soft back bob layer
    addMesh(THREE, g, new THREE.SphereGeometry(0.18, 18, 14), m, 'primary', {
      pos: [0, H_Y - 0.03, -0.10],
      scale: [1.18, 0.95, 0.88],
    });
    return g;
  },

  curly(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x543824);
    hairCap(THREE, g, m, { r: 0.234, thetaLen: Math.PI * 0.65, tiltX: -0.22 });
    const curls = [
      // Top & crown
      [0, 1.09, 0.02, 0.068], [-0.09, 1.07, 0.06, 0.062], [0.09, 1.07, 0.06, 0.062],
      [-0.15, 1.01, 0.09, 0.058], [0.15, 1.01, 0.09, 0.058],
      // Forehead curls
      [-0.08, 1.01, 0.18, 0.048], [0.0, 1.02, 0.19, 0.052], [0.09, 1.00, 0.17, 0.048],
      // Sides
      [-0.21, 0.93, 0.05, 0.062], [0.21, 0.93, 0.05, 0.062],
      [-0.22, 0.84, 0.01, 0.062], [0.22, 0.84, 0.01, 0.062],
      [-0.20, 0.76, -0.04, 0.056], [0.20, 0.76, -0.04, 0.056],
      // Back volume
      [0, 1.04, -0.12, 0.072], [-0.11, 1.01, -0.12, 0.068], [0.11, 1.01, -0.12, 0.068],
      [-0.16, 0.90, -0.15, 0.068], [0.16, 0.90, -0.15, 0.068], [0, 0.92, -0.18, 0.072],
      [-0.10, 0.79, -0.16, 0.064], [0.10, 0.79, -0.16, 0.064], [0, 0.77, -0.17, 0.064],
    ];
    for (const [x, y, z, r] of curls) {
      addMesh(THREE, g, new THREE.SphereGeometry(r, 12, 10), m, 'primary', { pos: [x, y, z] });
    }
    return g;
  },

  afro(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x261d19);
    const acc = mat(THREE, opts.accent ?? 0xe07a5f, { roughness: 0.7 });
    // Sculpted multi-lobe halo
    const lobes = [
      [0, 0.98, -0.04, 0.245, [1.18, 1.05, 1.08]],
      [0, 1.12, -0.01, 0.16, [1.3, 0.85, 1.0]],
      [-0.20, 0.99, -0.02, 0.155, [0.95, 1.05, 1.0]],
      [0.20, 0.99, -0.02, 0.155, [0.95, 1.05, 1.0]],
      [-0.18, 0.84, -0.06, 0.13, [0.9, 1.0, 0.95]],
      [0.18, 0.84, -0.06, 0.13, [0.9, 1.0, 0.95]],
      [0, 0.86, -0.16, 0.17, [1.2, 1.05, 0.85]],
      [-0.11, 1.09, 0.08, 0.11, [1.0, 0.95, 0.95]],
      [0.11, 1.09, 0.08, 0.11, [1.0, 0.95, 0.95]],
    ];
    for (const [x, y, z, r, sc] of lobes) {
      addMesh(THREE, g, new THREE.SphereGeometry(r, 16, 14), m, 'primary', {
        pos: [x, y, z],
        scale: sc,
      });
    }
    // Cozy slim headband tucked at front hairline
    addMesh(THREE, g, new THREE.TorusGeometry(0.228, 0.016, 10, 28, Math.PI * 1.15), acc, 'accent', {
      pos: [0, H_Y + 0.055, 0.045],
      rot: [Math.PI * 0.24, 0, -Math.PI * 0.075],
    });
    return g;
  },

  braids(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x5c3c24);
    const acc = mat(THREE, opts.accent ?? 0xe8836b, { roughness: 0.65 });
    hairCap(THREE, g, m, { r: 0.236, thetaLen: Math.PI * 0.68, tiltX: -0.22 });
    // Soft parted bangs
    for (const s of [-1, 1]) {
      hairLock(THREE, g, m, [
        [s * 0.01, 1.05, 0.12],
        [s * 0.09, 1.00, 0.19],
        [s * 0.16, 0.93, 0.16],
      ], 0.036);
      // Twin braided pigtails
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const y = 0.80 - t * 0.30;
        const x = s * (0.20 - t * 0.02 + (i % 2 === 0 ? 0.01 : -0.01));
        const z = -0.03 + t * 0.12;
        const r = 0.036 - t * 0.008;
        addMesh(THREE, g, new THREE.SphereGeometry(r, 10, 10), m, 'primary', {
          pos: [x, y, z],
          scale: [1.0, 1.22, 0.92],
          rot: [0, 0, s * (i % 2 === 0 ? 0.32 : -0.32)],
        });
      }
      // Hair tie & tassel tip
      addMesh(THREE, g, new THREE.TorusGeometry(0.025, 0.009, 8, 14), acc, 'accent', {
        pos: [s * 0.18, 0.50, 0.09],
        rot: [Math.PI / 2, 0, 0],
      });
      addMesh(THREE, g, new THREE.ConeGeometry(0.024, 0.06, 10), m, 'primary', {
        pos: [s * 0.18, 0.46, 0.09],
        rot: [Math.PI, 0, 0],
      });
    }
    return g;
  },

  bob(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x2e2420);
    const acc = mat(THREE, opts.accent ?? 0xf2b857, { roughness: 0.35, metalness: 0.35 });
    hairCap(THREE, g, m, { r: 0.236, thetaLen: Math.PI * 0.58, tiltX: -0.18 });
    // Bell-shaped bob skirt wrapping sides and back (open at front)
    const pts = [
      [0.19, 0.67],
      [0.242, 0.72],
      [0.254, 0.81],
      [0.246, 0.91],
      [0.215, 0.99],
    ];
    const bellGeo = latheGeo(THREE, pts, 24, Math.PI * 0.32, Math.PI * 1.36);
    addMesh(THREE, g, bellGeo, m, 'primary', { pos: [0, 0, -0.015] });
    // Soft full fringe across forehead
    for (let i = -2; i <= 2; i++) {
      hairLock(THREE, g, m, [
        [i * 0.045, 1.04, 0.13],
        [i * 0.052, 0.98, 0.215],
        [i * 0.056, 0.935, 0.215],
      ], 0.031);
    }
    // Cute side hair clip
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.008, 0.045, 6, 8), acc, 'accent', {
      pos: [0.165, 0.955, 0.145],
      rot: [0.15, 0.6, 1.25],
    });
    return g;
  },

  longStraight(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x3a281d);
    hairCap(THREE, g, m, { r: 0.236, thetaLen: Math.PI * 0.62, tiltX: -0.2 });
    // Flowing back hair curtain
    const pts = [
      [0.20, 0.37],
      [0.225, 0.52],
      [0.238, 0.70],
      [0.246, 0.86],
      [0.222, 0.98],
    ];
    const curtainGeo = latheGeo(THREE, pts, 24, Math.PI * 0.42, Math.PI * 1.16);
    addMesh(THREE, g, curtainGeo, m, 'primary', { pos: [0, 0, -0.025] });
    // Front face-framing strands & parted bangs
    for (const s of [-1, 1]) {
      hairLock(THREE, g, m, [
        [s * 0.02, 1.05, 0.12],
        [s * 0.12, 0.98, 0.19],
        [s * 0.19, 0.85, 0.15],
        [s * 0.17, 0.65, 0.11],
        [s * 0.15, 0.46, 0.08],
      ], 0.038);
    }
    return g;
  },

  ponytail(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x6b442a);
    const acc = mat(THREE, opts.accent ?? 0xd96b52, { roughness: 0.7 });
    hairCap(THREE, g, m, { r: 0.235, thetaLen: Math.PI * 0.68, tiltX: -0.25 });
    // Wispy bangs
    hairLock(THREE, g, m, [[-0.08, 1.04, 0.14], [-0.02, 0.98, 0.21], [0.05, 0.94, 0.21]], 0.03);
    hairLock(THREE, g, m, [[0.04, 1.04, 0.14], [0.11, 0.98, 0.19], [0.15, 0.92, 0.16]], 0.028);
    for (const s of [-1, 1]) {
      hairLock(THREE, g, m, [[s * 0.18, 0.94, 0.08], [s * 0.19, 0.83, 0.09]], 0.022);
    }
    // Scrunchie at high back crown
    addMesh(THREE, g, new THREE.TorusGeometry(0.044, 0.02, 10, 18), acc, 'accent', {
      pos: [0, 0.98, -0.21],
      rot: [0.55, 0, 0],
    });
    // Cascading ponytail made of 3 overlapping curved locks
    const tailOffsets = [0, -0.035, 0.035];
    for (let i = 0; i < tailOffsets.length; i++) {
      const xo = tailOffsets[i];
      hairLock(THREE, g, m, [
        [xo * 0.5, 0.98, -0.22],
        [xo, 0.95, -0.31],
        [xo * 1.2, 0.80, -0.33],
        [xo * 0.8, 0.62, -0.27],
      ], i === 0 ? 0.052 : 0.038);
    }
    return g;
  },

  twinBuns(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x2c2220);
    const acc = mat(THREE, opts.accent ?? 0xf08c8c, { roughness: 0.65 });
    hairCap(THREE, g, m, { r: 0.235, thetaLen: Math.PI * 0.68, tiltX: -0.22 });
    // Soft rounded bangs
    for (let i = -1; i <= 1; i++) {
      hairLock(THREE, g, m, [
        [i * 0.06, 1.04, 0.13],
        [i * 0.065, 0.98, 0.21],
        [i * 0.065, 0.94, 0.21],
      ], 0.033);
    }
    // Double space buns with accent ribbon ties
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.SphereGeometry(0.095, 16, 14), m, 'primary', {
        pos: [s * 0.195, 1.04, -0.04],
        scale: [1.05, 0.95, 0.95],
      });
      addMesh(THREE, g, new THREE.TorusGeometry(0.062, 0.022, 10, 18), m, 'primary', {
        pos: [s * 0.185, 1.02, -0.04],
        rot: [0.3, s * 0.7, 0],
      });
      addMesh(THREE, g, new THREE.TorusGeometry(0.068, 0.013, 8, 18), acc, 'accent', {
        pos: [s * 0.165, 1.00, -0.04],
        rot: [0.2, s * 0.85, 0.3],
      });
      // Cheek framing wisps
      hairLock(THREE, g, m, [[s * 0.18, 0.94, 0.10], [s * 0.19, 0.81, 0.12]], 0.022);
    }
    return g;
  },

  wolfCut(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x29252c);
    hairCap(THREE, g, m, { r: 0.236, thetaLen: Math.PI * 0.65, tiltX: -0.22 });
    // Choppy front fringe
    const front = [-0.11, -0.04, 0.03, 0.10];
    for (let i = 0; i < front.length; i++) {
      const x = front[i];
      hairLock(THREE, g, m, [
        [x, 1.04, 0.13],
        [x * 1.1, 0.97, 0.21],
        [x * 1.15, 0.92 + (i % 2) * 0.02, 0.205],
      ], 0.026);
    }
    // Feathered cheek layers
    for (const s of [-1, 1]) {
      hairLock(THREE, g, m, [
        [s * 0.16, 0.98, 0.09],
        [s * 0.22, 0.87, 0.10],
        [s * 0.19, 0.77, 0.12],
      ], 0.034);
      hairLock(THREE, g, m, [
        [s * 0.18, 0.92, -0.02],
        [s * 0.24, 0.78, -0.05],
        [s * 0.26, 0.66, -0.06],
      ], 0.038);
    }
    // Flared mullet back layers
    for (let i = -2; i <= 2; i++) {
      hairLock(THREE, g, m, [
        [i * 0.065, 0.96, -0.14],
        [i * 0.08, 0.78, -0.21],
        [i * 0.095, 0.62, -0.24],
      ], 0.044);
    }
    return g;
  },

  locs(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x241c18);
    const acc = mat(THREE, opts.accent ?? 0xd9a74a, { roughness: 0.3, metalness: 0.75 });
    hairCap(THREE, g, m, { r: 0.232, thetaLen: Math.PI * 0.56, tiltX: -0.18 });
    // 16 distinct thick locs radiating from crown
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const isFront = Math.sin(a) > 0.62;
      if (isFront) continue; // leave face open
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const len = 0.58 + (i % 3) * 0.03;
      hairLock(THREE, g, m, [
        [cx * 0.08, 1.07, cz * 0.08],
        [cx * 0.22, 0.96, cz * 0.22],
        [cx * 0.245, 0.77, cz * 0.24],
        [cx * 0.23, len, cz * 0.22],
      ], 0.026);
      // Add gold/accent cuffs on a few side locs
      if (i === 1 || i === 7 || i === 13) {
        addMesh(THREE, g, new THREE.CylinderGeometry(0.029, 0.029, 0.024, 10), acc, 'accent', {
          pos: [cx * 0.242, 0.74, cz * 0.236],
        });
      }
    }
    // Two forehead-framing locs
    for (const s of [-1, 1]) {
      hairLock(THREE, g, m, [
        [s * 0.06, 1.06, 0.10],
        [s * 0.16, 0.97, 0.17],
        [s * 0.20, 0.82, 0.16],
        [s * 0.18, 0.66, 0.14],
      ], 0.025);
    }
    return g;
  },

  pixie(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x8a5a3c);
    hairCap(THREE, g, m, { r: 0.234, thetaLen: Math.PI * 0.62, tiltX: -0.22 });
    // Asymmetrical feathered bangs sweeping right
    hairLock(THREE, g, m, [[-0.14, 1.03, 0.10], [-0.03, 1.00, 0.20], [0.10, 0.95, 0.19]], 0.036);
    hairLock(THREE, g, m, [[-0.12, 1.06, 0.06], [0.02, 1.03, 0.18], [0.15, 0.97, 0.15]], 0.034);
    // Airy crown tufts
    hairLock(THREE, g, m, [[-0.04, 1.07, -0.02], [0.05, 1.11, 0.04], [0.12, 1.07, 0.07]], 0.028);
    // Tapered ear wisps & neat nape
    for (const s of [-1, 1]) {
      hairLock(THREE, g, m, [[s * 0.19, 0.94, 0.04], [s * 0.20, 0.85, 0.06]], 0.024);
    }
    addMesh(THREE, g, new THREE.SphereGeometry(0.15, 14, 12), m, 'primary', {
      pos: [0, H_Y - 0.02, -0.11],
      scale: [1.1, 0.8, 0.85],
    });
    return g;
  },

  sidePart(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = hairMat(THREE, opts.color ?? 0x3f2e22);
    hairCap(THREE, g, m, { r: 0.236, thetaLen: Math.PI * 0.64, tiltX: -0.22 });
    // Deep side part at x = 0.09, sweeping wave to the left
    hairLock(THREE, g, m, [[0.09, 1.06, 0.10], [-0.02, 1.03, 0.20], [-0.14, 0.96, 0.17], [-0.20, 0.86, 0.10]], 0.044);
    hairLock(THREE, g, m, [[0.08, 1.08, 0.04], [-0.06, 1.05, 0.14], [-0.18, 0.95, 0.10]], 0.042);
    // Tucked right side
    hairLock(THREE, g, m, [[0.11, 1.04, 0.09], [0.19, 0.96, 0.10], [0.21, 0.85, 0.05]], 0.036);
    // Clean back volume
    addMesh(THREE, g, new THREE.SphereGeometry(0.175, 16, 14), m, 'primary', {
      pos: [0, H_Y - 0.02, -0.10],
      scale: [1.12, 0.9, 0.88],
    });
    return g;
  },

  hijab(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.color ?? 0x7b9687, { roughness: 0.86 });
    const acc = mat(THREE, opts.accent ?? 0xf0e9df, { roughness: 0.82 });
    // Undercap framing forehead
    hairCap(THREE, g, acc, { r: 0.231, thetaLen: Math.PI * 0.54, tiltX: -0.14, slot: 'accent' });
    // Outer draped dome
    hairCap(THREE, g, m, { r: 0.244, thetaLen: Math.PI * 0.74, tiltX: -0.30, zOff: -0.02 });
    // Face-framing drape wrap around cheeks and chin
    addMesh(THREE, g, new THREE.TorusGeometry(0.182, 0.042, 12, 28), m, 'primary', {
      pos: [0, H_Y - 0.01, 0.085],
      scale: [1.05, 1.08, 0.9],
    });
    // Shoulder & chest shawl drape
    const shawlPts = [
      [0.21, 0.54],
      [0.20, 0.62],
      [0.165, 0.69],
      [0.145, 0.74],
    ];
    addMesh(THREE, g, latheGeo(THREE, shawlPts, 24), m, 'primary', {
      pos: [0, 0, -0.005],
      scale: [1.04, 1, 0.95],
    });
    // Decorative chin pin
    addMesh(THREE, g, new THREE.SphereGeometry(0.012, 10, 8), acc, 'accent', {
      pos: [0.045, 0.685, 0.165],
    });
    return g;
  },

  turban(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.color ?? 0xc47b54, { roughness: 0.85 });
    const acc = mat(THREE, opts.accent ?? 0xebd8b7, { roughness: 0.8 });
    // Upper crown wrap
    hairCap(THREE, g, m, { r: 0.24, thetaLen: Math.PI * 0.52, tiltX: -0.12, yOff: 0.015 });
    // Criss-cross fabric wrap bands
    addMesh(THREE, g, new THREE.TorusGeometry(0.215, 0.044, 12, 26), m, 'primary', {
      pos: [0, H_Y + 0.095, -0.005],
      rot: [Math.PI * 0.44, 0.18, 0.12],
    });
    addMesh(THREE, g, new THREE.TorusGeometry(0.212, 0.042, 12, 26), m, 'primary', {
      pos: [0, H_Y + 0.105, -0.005],
      rot: [Math.PI * 0.44, -0.18, -0.12],
    });
    // Accent trim band
    addMesh(THREE, g, new THREE.TorusGeometry(0.228, 0.012, 8, 24), acc, 'accent', {
      pos: [0, H_Y + 0.07, 0.0],
      rot: [Math.PI * 0.46, 0, 0],
    });
    // Sculpted front knot above forehead
    addMesh(THREE, g, new THREE.SphereGeometry(0.056, 14, 12), m, 'primary', {
      pos: [0, H_Y + 0.12, 0.195],
      scale: [1.25, 0.9, 0.85],
    });
    return g;
  },
};

// ============================================================================
// TOPS (10 styles)
// ============================================================================

export const TOPS = {
  hoodie(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x5c7fa3, { roughness: 0.88 });
    const m2 = mat(THREE, opts.secondary ?? 0xece7df, { roughness: 0.85 });
    const m3 = mat(THREE, opts.accent ?? 0xd98a5f, { roughness: 0.55 });
    torsoShell(THREE, g, m1, 'primary', { rBot: 0.132, rMid: 0.138, rTop: 0.114 });
    // Ribbed hem
    addMesh(THREE, g, new THREE.CylinderGeometry(0.131, 0.126, 0.036, 22), m2, 'secondary', {
      pos: [0, 0.352, 0],
      scale: [1.06, 1, 0.92],
    });
    addSleeves(THREE, g, m1, 'primary', { len: 0.19, rTop: 0.056, rBot: 0.044, cuffMat: m2 });
    // Kangaroo pocket
    const pktShape = roundedRectShape(THREE, 0.14, 0.085, 0.022);
    addMesh(THREE, g, extrudeCentered(THREE, pktShape, 0.018, 0.006), m1, 'primary', {
      pos: [0, 0.425, 0.118],
    });
    // Folded hood resting behind neck
    addMesh(THREE, g, new THREE.TorusGeometry(0.095, 0.038, 12, 22, Math.PI * 1.4), m1, 'primary', {
      pos: [0, 0.635, -0.025],
      rot: [Math.PI * 0.56, 0, Math.PI * 0.8],
    });
    // Drawstrings with accent tips
    for (const s of [-1, 1]) {
      const cord = tubeGeo(THREE, [
        [s * 0.032, 0.625, 0.072],
        [s * 0.036, 0.56, 0.118],
        [s * 0.032, 0.505, 0.122],
      ], 0.0055, 10, 6);
      addMesh(THREE, g, cord, m2, 'secondary');
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.007, 0.012, 4, 6), m3, 'accent', {
        pos: [s * 0.032, 0.495, 0.122],
      });
    }
    return g;
  },

  tee(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x8fb39b, { roughness: 0.86 });
    const m2 = mat(THREE, opts.secondary ?? 0xf4f0e8, { roughness: 0.85 });
    const m3 = mat(THREE, opts.accent ?? 0xd97d54, { roughness: 0.75 });
    torsoShell(THREE, g, m1, 'primary', { rBot: 0.126, rMid: 0.13, rTop: 0.108 });
    addSleeves(THREE, g, m1, 'primary', { len: 0.095, rTop: 0.052, rBot: 0.048, tilt: 0.22 });
    // Ribbed crew neck ring
    addMesh(THREE, g, new THREE.TorusGeometry(0.072, 0.013, 10, 22), m2, 'secondary', {
      pos: [0, 0.635, 0.005],
      rot: [Math.PI / 2 + 0.1, 0, 0],
    });
    // Small chest pocket with accent trim
    const pkt = roundedRectShape(THREE, 0.052, 0.055, 0.01);
    addMesh(THREE, g, extrudeCentered(THREE, pkt, 0.008, 0.003), m1, 'primary', {
      pos: [0.058, 0.54, 0.114],
      rot: [0, 0.35, 0],
    });
    addMesh(THREE, g, new THREE.BoxGeometry(0.052, 0.01, 0.012), m3, 'accent', {
      pos: [0.058, 0.566, 0.115],
      rot: [0, 0.35, 0],
    });
    return g;
  },

  shirt(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xdce4ed, { roughness: 0.8 });
    const m2 = mat(THREE, opts.secondary ?? 0xf7f5f0, { roughness: 0.78 });
    const m3 = mat(THREE, opts.accent ?? 0x8c6d53, { roughness: 0.55 });
    torsoShell(THREE, g, m1, 'primary', { rBot: 0.125, rMid: 0.129, rTop: 0.108 });
    addSleeves(THREE, g, m1, 'primary', { len: 0.14, rTop: 0.052, rBot: 0.045, cuffMat: m2 });
    // Front placket
    addMesh(THREE, g, new THREE.BoxGeometry(0.028, 0.26, 0.016), m2, 'secondary', {
      pos: [0, 0.495, 0.116],
    });
    // 4 buttons
    const btnGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10);
    for (let i = 0; i < 4; i++) {
      addMesh(THREE, g, btnGeo, m3, 'accent', {
        pos: [0, 0.41 + i * 0.055, 0.125],
        rot: [Math.PI / 2, 0, 0],
      });
    }
    // Folded collar wings
    for (const s of [-1, 1]) {
      const wing = roundedRectShape(THREE, 0.058, 0.036, 0.008);
      addMesh(THREE, g, extrudeCentered(THREE, wing, 0.01, 0.003), m2, 'secondary', {
        pos: [s * 0.048, 0.625, 0.068],
        rot: [0.4, s * 0.45, s * -0.25],
      });
    }
    return g;
  },

  cardigan(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xc48b66, { roughness: 0.9 });
    const m2 = mat(THREE, opts.secondary ?? 0xf4efe6, { roughness: 0.85 });
    const m3 = mat(THREE, opts.accent ?? 0x5e4230, { roughness: 0.55 });
    // Inner tee
    torsoShell(THREE, g, m2, 'secondary', { rBot: 0.121, rMid: 0.125, rTop: 0.104 });
    // Open-front outer cardigan shell (split at front)
    const pts = [
      [0.126, 0.34],
      [0.135, 0.36],
      [0.138, 0.49],
      [0.118, 0.61],
      [0.082, 0.64],
    ];
    const openGeo = latheGeo(THREE, pts, 24, Math.PI * 0.16, Math.PI * 1.68);
    addMesh(THREE, g, openGeo, m1, 'primary', { scale: [1.06, 1, 0.93] });
    addSleeves(THREE, g, m1, 'primary', { len: 0.19, rTop: 0.056, rBot: 0.044, cuffMat: m1, cuffSlot: 'primary' });
    // Shawl trim edges & pockets
    for (const s of [-1, 1]) {
      const trim = tubeGeo(THREE, [
        [s * 0.052, 0.635, 0.062],
        [s * 0.056, 0.52, 0.12],
        [s * 0.056, 0.355, 0.118],
      ], 0.015, 12, 8);
      addMesh(THREE, g, trim, m1, 'primary');
      const pkt = roundedRectShape(THREE, 0.055, 0.055, 0.012);
      addMesh(THREE, g, extrudeCentered(THREE, pkt, 0.012, 0.004), m1, 'primary', {
        pos: [s * 0.082, 0.41, 0.095],
        rot: [0, s * 0.55, 0],
      });
    }
    // 3 wooden buttons on left placket
    for (let i = 0; i < 3; i++) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.01, 0.01, 0.007, 10), m3, 'accent', {
        pos: [-0.056, 0.40 + i * 0.065, 0.132],
        rot: [Math.PI / 2, 0, -0.2],
      });
    }
    return g;
  },

  varsityJacket(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x3b5978, { roughness: 0.82 });
    const m2 = mat(THREE, opts.secondary ?? 0xf0eadf, { roughness: 0.78 });
    const m3 = mat(THREE, opts.accent ?? 0xd9a14a, { roughness: 0.7 });
    torsoShell(THREE, g, m1, 'primary', { rBot: 0.132, rMid: 0.138, rTop: 0.114 });
    // Striped ribbed waist hem
    addMesh(THREE, g, new THREE.CylinderGeometry(0.132, 0.128, 0.034, 22), m2, 'secondary', {
      pos: [0, 0.352, 0],
      scale: [1.06, 1, 0.92],
    });
    addMesh(THREE, g, new THREE.CylinderGeometry(0.134, 0.134, 0.01, 22), m3, 'accent', {
      pos: [0, 0.352, 0],
      scale: [1.06, 1, 0.92],
    });
    // Contrasting sleeves with accent cuffs
    addSleeves(THREE, g, m2, 'secondary', {
      len: 0.19,
      rTop: 0.056,
      rBot: 0.045,
      cuffMat: m3,
      cuffSlot: 'accent',
    });
    // Collar ring
    addMesh(THREE, g, new THREE.TorusGeometry(0.078, 0.016, 10, 22), m3, 'accent', {
      pos: [0, 0.635, 0.005],
      rot: [Math.PI / 2 + 0.08, 0, 0],
    });
    // Snap buttons down center
    for (let i = 0; i < 4; i++) {
      addMesh(THREE, g, new THREE.SphereGeometry(0.008, 8, 8), m2, 'secondary', {
        pos: [0, 0.40 + i * 0.055, 0.125],
      });
    }
    // Geometric diamond varsity patch on chest
    const patch = new THREE.Shape();
    patch.moveTo(0, 0.026);
    patch.lineTo(0.022, 0);
    patch.lineTo(0, -0.026);
    patch.lineTo(-0.022, 0);
    patch.closePath();
    addMesh(THREE, g, extrudeCentered(THREE, patch, 0.008, 0.003), m3, 'accent', {
      pos: [0.062, 0.54, 0.114],
      rot: [0, 0.42, 0],
    });
    return g;
  },

  sweater(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xb8685c, { roughness: 0.92 });
    const m2 = mat(THREE, opts.secondary ?? 0xf2e8d8, { roughness: 0.9 });
    const m3 = mat(THREE, opts.accent ?? 0x5c7566, { roughness: 0.9 });
    torsoShell(THREE, g, m1, 'primary', { rBot: 0.135, rMid: 0.142, rTop: 0.116 });
    // Chunky knit collar
    addMesh(THREE, g, new THREE.TorusGeometry(0.078, 0.022, 12, 22), m2, 'secondary', {
      pos: [0, 0.638, 0.004],
      rot: [Math.PI / 2 + 0.06, 0, 0],
    });
    // Ribbed hem
    addMesh(THREE, g, new THREE.CylinderGeometry(0.136, 0.13, 0.036, 22), m2, 'secondary', {
      pos: [0, 0.352, 0],
      scale: [1.06, 1, 0.92],
    });
    // Cozy chest stripes
    addMesh(THREE, g, new THREE.CylinderGeometry(0.139, 0.142, 0.034, 24), m2, 'secondary', {
      pos: [0, 0.515, 0],
      scale: [1.065, 1, 0.925],
    });
    addMesh(THREE, g, new THREE.CylinderGeometry(0.141, 0.143, 0.014, 24), m3, 'accent', {
      pos: [0, 0.515, 0],
      scale: [1.07, 1, 0.93],
    });
    addSleeves(THREE, g, m1, 'primary', { len: 0.19, rTop: 0.058, rBot: 0.046, cuffMat: m2 });
    return g;
  },

  puffer(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x4b7069, { roughness: 0.58, metalness: 0.08 });
    const m2 = mat(THREE, opts.secondary ?? 0x2f3b3a, { roughness: 0.65 });
    const m3 = mat(THREE, opts.accent ?? 0xe8a856, { roughness: 0.4, metalness: 0.45 });
    // Stacked quilted baffle rings
    const baffles = [
      [0.375, 0.134, 0.038],
      [0.445, 0.142, 0.04],
      [0.515, 0.14, 0.04],
      [0.585, 0.124, 0.036],
    ];
    for (const [y, r, tube] of baffles) {
      addMesh(THREE, g, new THREE.TorusGeometry(r - tube * 0.45, tube, 12, 24), m1, 'primary', {
        pos: [0, y, 0],
        rot: [Math.PI / 2, 0, 0],
        scale: [1.06, 0.93, 1],
      });
    }
    // Inner core so no gaps show
    torsoShell(THREE, g, m1, 'primary', { rBot: 0.125, rMid: 0.13, rTop: 0.105 });
    // High stand-up collar
    addMesh(THREE, g, new THREE.CylinderGeometry(0.095, 0.098, 0.055, 20), m2, 'secondary', {
      pos: [0, 0.642, 0],
    });
    // Segmented puffy sleeves
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        addMesh(THREE, g, new THREE.SphereGeometry(0.056 - i * 0.004, 14, 12), m1, 'primary', {
          pos: [s * (0.142 + i * 0.012), 0.585 - i * 0.062, 0],
          scale: [1.0, 0.85, 1.0],
        });
      }
      addMesh(THREE, g, new THREE.CylinderGeometry(0.043, 0.04, 0.025, 12), m2, 'secondary', {
        pos: [s * 0.17, 0.415, 0],
        rot: [0, 0, s * 0.16],
      });
    }
    // Center zipper & pull tab
    addMesh(THREE, g, new THREE.BoxGeometry(0.012, 0.27, 0.012), m2, 'secondary', {
      pos: [0, 0.50, 0.132],
    });
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.007, 0.016, 4, 6), m3, 'accent', {
      pos: [0, 0.615, 0.14],
    });
    return g;
  },

  blazer(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x454a57, { roughness: 0.82 });
    const m2 = mat(THREE, opts.secondary ?? 0xf5f2eb, { roughness: 0.8 });
    const m3 = mat(THREE, opts.accent ?? 0xc97b63, { roughness: 0.65 });
    // Inner shirt
    torsoShell(THREE, g, m2, 'secondary', { rBot: 0.12, rMid: 0.124, rTop: 0.102 });
    // Outer blazer body
    const pts = [
      [0.13, 0.33],
      [0.134, 0.38],
      [0.136, 0.50],
      [0.12, 0.61],
      [0.085, 0.64],
    ];
    addMesh(THREE, g, latheGeo(THREE, pts, 24, Math.PI * 0.12, Math.PI * 1.76), m1, 'primary', {
      scale: [1.07, 1, 0.93],
    });
    addSleeves(THREE, g, m1, 'primary', { len: 0.19, rTop: 0.055, rBot: 0.043, cuffMat: m1, cuffSlot: 'primary' });
    // Notched lapels
    for (const s of [-1, 1]) {
      const lapel = roundedRectShape(THREE, 0.042, 0.13, 0.008);
      addMesh(THREE, g, extrudeCentered(THREE, lapel, 0.012, 0.004), m1, 'primary', {
        pos: [s * 0.048, 0.565, 0.112],
        rot: [-0.08, s * 0.25, s * -0.18],
      });
    }
    // 2 buttons + pocket square peek
    for (let i = 0; i < 2; i++) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.009, 0.009, 0.007, 10), m3, 'accent', {
        pos: [0.012, 0.42 + i * 0.052, 0.128],
        rot: [Math.PI / 2, 0, 0],
      });
    }
    addMesh(THREE, g, new THREE.ConeGeometry(0.018, 0.024, 4), m3, 'accent', {
      pos: [0.068, 0.545, 0.114],
      rot: [0, 0.4, -0.15],
    });
    return g;
  },

  overalls(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x4b6a8a, { roughness: 0.86 });
    const m2 = mat(THREE, opts.secondary ?? 0xf3eee6, { roughness: 0.85 });
    const m3 = mat(THREE, opts.accent ?? 0xd9a84e, { roughness: 0.35, metalness: 0.7 });
    // Inner tee
    torsoShell(THREE, g, m2, 'secondary', { rBot: 0.124, rMid: 0.128, rTop: 0.106 });
    addSleeves(THREE, g, m2, 'secondary', { len: 0.095, rTop: 0.05, rBot: 0.046, tilt: 0.22 });
    // Hip wrap
    addMesh(THREE, g, new THREE.CylinderGeometry(0.134, 0.132, 0.095, 22), m1, 'primary', {
      pos: [0, 0.385, 0],
      scale: [1.06, 1, 0.93],
    });
    // Front bib & bib pocket
    const bib = roundedRectShape(THREE, 0.145, 0.155, 0.018);
    addMesh(THREE, g, extrudeCentered(THREE, bib, 0.02, 0.006), m1, 'primary', {
      pos: [0, 0.495, 0.115],
    });
    const pkt = roundedRectShape(THREE, 0.075, 0.055, 0.01);
    addMesh(THREE, g, extrudeCentered(THREE, pkt, 0.01, 0.003), m1, 'primary', {
      pos: [0, 0.50, 0.13],
    });
    // Shoulder straps & brass buttons
    for (const s of [-1, 1]) {
      const strap = tubeGeo(THREE, [
        [s * 0.062, 0.555, 0.118],
        [s * 0.075, 0.642, 0.03],
        [s * 0.068, 0.56, -0.105],
        [s * 0.062, 0.42, -0.118],
      ], 0.015, 16, 8);
      addMesh(THREE, g, strap, m1, 'primary');
      addMesh(THREE, g, new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10), m3, 'accent', {
        pos: [s * 0.06, 0.552, 0.131],
        rot: [Math.PI / 2, 0, 0],
      });
    }
    return g;
  },

  jersey(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xc9534b, { roughness: 0.78 });
    const m2 = mat(THREE, opts.secondary ?? 0xf4f1ea, { roughness: 0.78 });
    const m3 = mat(THREE, opts.accent ?? 0x2e3b4e, { roughness: 0.78 });
    torsoShell(THREE, g, m1, 'primary', { rBot: 0.13, rMid: 0.133, rTop: 0.11 });
    addSleeves(THREE, g, m1, 'primary', { len: 0.105, rTop: 0.053, rBot: 0.048, tilt: 0.22, cuffMat: m2 });
    // V-neck collar trim
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.01, 0.075, 6, 8), m2, 'secondary', {
        pos: [s * 0.032, 0.608, 0.088],
        rot: [0.35, 0, s * 0.48],
      });
    }
    // Side stripe panels
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.BoxGeometry(0.022, 0.22, 0.055), m3, 'accent', {
        pos: [s * 0.132, 0.45, 0],
      });
    }
    // Horizontal chest accent band
    addMesh(THREE, g, new THREE.CylinderGeometry(0.136, 0.138, 0.024, 24), m2, 'secondary', {
      pos: [0, 0.50, 0],
      scale: [1.065, 1, 0.925],
    });
    return g;
  },
};

// ============================================================================
// BOTTOMS (6 styles)
// ============================================================================

export const BOTTOMS = {
  trousers(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0x484f59, { roughness: 0.84 });
    // Waistband & hip block
    addMesh(THREE, g, new THREE.CylinderGeometry(0.128, 0.132, 0.105, 22), m, 'primary', {
      pos: [0, 0.315, 0],
      scale: [1.05, 1, 0.92],
    });
    // Straight legs with clean cuffs
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.056, 0.052, 0.24, 16), m, 'primary', {
        pos: [s * 0.065, 0.175, 0],
      });
      addMesh(THREE, g, new THREE.TorusGeometry(0.052, 0.01, 8, 16), m, 'primary', {
        pos: [s * 0.065, 0.062, 0],
        rot: [Math.PI / 2, 0, 0],
      });
    }
    return g;
  },

  shorts(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0xb89f7d, { roughness: 0.85 });
    addMesh(THREE, g, new THREE.CylinderGeometry(0.128, 0.134, 0.10, 22), m, 'primary', {
      pos: [0, 0.318, 0],
      scale: [1.05, 1, 0.92],
    });
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.06, 0.058, 0.11, 16), m, 'primary', {
        pos: [s * 0.066, 0.245, 0],
      });
      addMesh(THREE, g, new THREE.TorusGeometry(0.059, 0.009, 8, 16), m, 'primary', {
        pos: [s * 0.066, 0.195, 0],
        rot: [Math.PI / 2, 0, 0],
      });
    }
    return g;
  },

  skirt(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0xa66363, { roughness: 0.86 });
    const pts = [
      [0.182, 0.145],
      [0.168, 0.22],
      [0.142, 0.31],
      [0.126, 0.365],
    ];
    addMesh(THREE, g, latheGeo(THREE, pts, 26), m, 'primary', {
      scale: [1.04, 1, 0.94],
    });
    addMesh(THREE, g, new THREE.TorusGeometry(0.127, 0.012, 8, 24), m, 'primary', {
      pos: [0, 0.358, 0],
      rot: [Math.PI / 2, 0, 0],
      scale: [1.04, 0.94, 1],
    });
    return g;
  },

  jeans(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0x3b5878, { roughness: 0.88 });
    const cuffM = mat(THREE, 0x8ea7c2, { roughness: 0.9 });
    const rivetM = mat(THREE, 0xc99c57, { roughness: 0.35, metalness: 0.8 });
    addMesh(THREE, g, new THREE.CylinderGeometry(0.129, 0.133, 0.105, 22), m, 'primary', {
      pos: [0, 0.316, 0],
      scale: [1.05, 1, 0.92],
    });
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.057, 0.049, 0.23, 16), m, 'primary', {
        pos: [s * 0.065, 0.18, 0],
      });
      // Turned denim cuff
      addMesh(THREE, g, new THREE.CylinderGeometry(0.053, 0.053, 0.032, 16), cuffM, 'secondary', {
        pos: [s * 0.065, 0.068, 0],
      });
      // Tiny metal pocket rivet
      addMesh(THREE, g, new THREE.SphereGeometry(0.006, 6, 6), rivetM, 'metal', {
        pos: [s * 0.095, 0.335, 0.092],
      });
    }
    return g;
  },

  joggers(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0x697078, { roughness: 0.9 });
    const drawM = mat(THREE, 0xede9e1, { roughness: 0.85 });
    addMesh(THREE, g, new THREE.CylinderGeometry(0.13, 0.136, 0.105, 22), m, 'primary', {
      pos: [0, 0.315, 0],
      scale: [1.05, 1, 0.92],
    });
    // Waist drawstring
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.005, 0.045, 4, 6), drawM, 'secondary', {
        pos: [s * 0.015, 0.325, 0.122],
        rot: [0, 0, s * 0.18],
      });
      // Relaxed tapered leg + ribbed ankle cuff
      addMesh(THREE, g, new THREE.CylinderGeometry(0.064, 0.046, 0.22, 16), m, 'primary', {
        pos: [s * 0.066, 0.185, 0],
      });
      addMesh(THREE, g, new THREE.CylinderGeometry(0.045, 0.042, 0.034, 14), m, 'primary', {
        pos: [s * 0.066, 0.072, 0],
      });
    }
    return g;
  },

  pleatedSkirt(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0x3b4d66, { roughness: 0.84 });
    // Waistband
    addMesh(THREE, g, new THREE.CylinderGeometry(0.128, 0.132, 0.045, 24), m, 'primary', {
      pos: [0, 0.345, 0],
      scale: [1.04, 1, 0.94],
    });
    // Inner cone so no gaps show between pleats
    addMesh(THREE, g, new THREE.CylinderGeometry(0.125, 0.172, 0.185, 22), m, 'primary', {
      pos: [0, 0.245, 0],
      scale: [1.04, 1, 0.94],
    });
    // 14 overlapping bevelled pleats
    const pleatGeo = extrudeCentered(THREE, roundedRectShape(THREE, 0.056, 0.195, 0.006), 0.012, 0.003);
    const count = 14;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 0.152;
      const mesh = new THREE.Mesh(pleatGeo, m);
      mesh.userData.slot = 'primary';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(Math.sin(a) * r * 1.04, 0.242, Math.cos(a) * r * 0.94);
      mesh.rotation.set(-0.22, a + 0.18, 0);
      g.add(mesh);
    }
    return g;
  },
};

// ============================================================================
// SHOES (4 styles)
// ============================================================================

export const SHOES = {
  sneakers(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xd96b52, { roughness: 0.78 });
    const m2 = mat(THREE, opts.secondary ?? 0xf4f1ea, { roughness: 0.72 });
    for (const s of [-1, 1]) {
      const x = s * 0.065;
      // Chunky white sole
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.044, 0.058, 8, 12), m2, 'secondary', {
        pos: [x, 0.022, 0.018],
        rot: [Math.PI / 2, 0, 0],
        scale: [1.0, 1.0, 0.55],
      });
      // Main upper
      addMesh(THREE, g, new THREE.SphereGeometry(0.046, 14, 12), m1, 'primary', {
        pos: [x, 0.045, 0.008],
        scale: [0.95, 0.85, 1.42],
      });
      // Toe cap
      addMesh(THREE, g, new THREE.SphereGeometry(0.036, 12, 10), m2, 'secondary', {
        pos: [x, 0.036, 0.056],
        scale: [0.98, 0.65, 0.9],
      });
      // Tongue & laces
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.018, 0.028, 6, 8), m2, 'secondary', {
        pos: [x, 0.068, 0.028],
        rot: [-0.4, 0, 0],
      });
      for (let i = 0; i < 3; i++) {
        addMesh(THREE, g, new THREE.CapsuleGeometry(0.004, 0.032, 4, 6), m2, 'secondary', {
          pos: [x, 0.054 + i * 0.011, 0.052 - i * 0.01],
          rot: [0, 0, Math.PI / 2],
        });
      }
    }
    return g;
  },

  boots(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x6b4630, { roughness: 0.72 });
    const m2 = mat(THREE, opts.secondary ?? 0x2e2926, { roughness: 0.85 });
    for (const s of [-1, 1]) {
      const x = s * 0.065;
      // Thick lug sole
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.046, 0.06, 8, 12), m2, 'secondary', {
        pos: [x, 0.022, 0.018],
        rot: [Math.PI / 2, 0, 0],
        scale: [1.0, 1.0, 0.58],
      });
      // Boot vamp
      addMesh(THREE, g, new THREE.SphereGeometry(0.048, 14, 12), m1, 'primary', {
        pos: [x, 0.048, 0.015],
        scale: [0.95, 0.85, 1.45],
      });
      // Ankle shaft
      addMesh(THREE, g, new THREE.CylinderGeometry(0.046, 0.048, 0.08, 14), m1, 'primary', {
        pos: [x, 0.082, -0.006],
      });
      // Front lace bars & back pull loop
      for (let i = 0; i < 3; i++) {
        addMesh(THREE, g, new THREE.CapsuleGeometry(0.004, 0.026, 4, 6), m2, 'secondary', {
          pos: [x, 0.065 + i * 0.016, 0.044],
          rot: [0, 0, Math.PI / 2],
        });
      }
      addMesh(THREE, g, new THREE.TorusGeometry(0.011, 0.004, 6, 10), m2, 'secondary', {
        pos: [x, 0.118, -0.048],
        rot: [0, Math.PI / 2, 0],
      });
    }
    return g;
  },

  loafers(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x5c3629, { roughness: 0.45, metalness: 0.08 });
    const m2 = mat(THREE, opts.secondary ?? 0x2c2420, { roughness: 0.75 });
    for (const s of [-1, 1]) {
      const x = s * 0.065;
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.042, 0.06, 8, 12), m2, 'secondary', {
        pos: [x, 0.015, 0.018],
        rot: [Math.PI / 2, 0, 0],
        scale: [0.96, 1.0, 0.42],
      });
      addMesh(THREE, g, new THREE.SphereGeometry(0.044, 14, 12), m1, 'primary', {
        pos: [x, 0.036, 0.014],
        scale: [0.92, 0.72, 1.48],
      });
      // Penny strap across vamp
      addMesh(THREE, g, new THREE.BoxGeometry(0.056, 0.012, 0.022), m2, 'secondary', {
        pos: [x, 0.058, 0.026],
      });
    }
    return g;
  },

  slippers(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xd4a5a5, { roughness: 0.95 });
    const m2 = mat(THREE, opts.secondary ?? 0xf7f2ea, { roughness: 0.96 });
    for (const s of [-1, 1]) {
      const x = s * 0.065;
      addMesh(THREE, g, new THREE.CapsuleGeometry(0.046, 0.062, 8, 12), m2, 'secondary', {
        pos: [x, 0.014, 0.016],
        rot: [Math.PI / 2, 0, 0],
        scale: [1.0, 1.0, 0.4],
      });
      addMesh(THREE, g, new THREE.SphereGeometry(0.05, 14, 12), m1, 'primary', {
        pos: [x, 0.042, 0.016],
        scale: [1.02, 0.78, 1.4],
      });
      // Plush fur collar
      addMesh(THREE, g, new THREE.TorusGeometry(0.044, 0.016, 10, 16), m2, 'fur', {
        pos: [x, 0.058, -0.008],
        rot: [Math.PI / 2 + 0.15, 0, 0],
      });
    }
    return g;
  },
};

// ============================================================================
// HEADWEAR (7 styles)
// ============================================================================

export const HEADWEAR = {
  cap(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x4b6e58, { roughness: 0.84 });
    const m2 = mat(THREE, opts.accent ?? 0xe8b86d, { roughness: 0.75 });
    const crown = new THREE.Group();
    crown.position.set(0, H_Y + 0.025, -0.005);
    crown.rotation.x = -0.14;
    g.add(crown);
    addMesh(THREE, crown, new THREE.SphereGeometry(0.244, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), m1, 'primary');
    // Top button
    addMesh(THREE, crown, new THREE.SphereGeometry(0.018, 10, 8), m2, 'accent', { pos: [0, 0.245, 0] });
    // Accent front band
    addMesh(THREE, crown, new THREE.TorusGeometry(0.242, 0.009, 8, 28), m2, 'accent', {
      pos: [0, 0.032, 0],
      rot: [Math.PI / 2, 0, 0],
    });
    // Curved brim
    const brim = roundedRectShape(THREE, 0.28, 0.19, 0.09);
    addMesh(THREE, crown, extrudeCentered(THREE, brim, 0.012, 0.004), m1, 'primary', {
      pos: [0, 0.032, 0.22],
      rot: [Math.PI / 2 + 0.12, 0, 0],
    });
    return g;
  },

  beanie(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xb85d4b, { roughness: 0.94 });
    const m2 = mat(THREE, opts.accent ?? 0xf2e9dc, { roughness: 0.96 });
    const hat = new THREE.Group();
    hat.position.set(0, H_Y + 0.02, -0.015);
    hat.rotation.x = -0.22;
    g.add(hat);
    // Dome
    addMesh(THREE, hat, new THREE.SphereGeometry(0.242, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), m1, 'primary', {
      scale: [1.0, 1.12, 1.04],
    });
    // Folded ribbed cuff
    addMesh(THREE, hat, new THREE.TorusGeometry(0.236, 0.036, 12, 28), m1, 'primary', {
      pos: [0, 0.015, 0],
      rot: [Math.PI / 2, 0, 0],
    });
    // Fluffy pom-pom
    addMesh(THREE, hat, new THREE.SphereGeometry(0.056, 14, 12), m2, 'accent', {
      pos: [0, 0.295, -0.02],
    });
    return g;
  },

  headphones(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x3b4252, { roughness: 0.45, metalness: 0.15 });
    const m2 = mat(THREE, opts.accent ?? 0xd98a5f, { roughness: 0.72 });
    const metalM = mat(THREE, 0xc2c8d1, { roughness: 0.28, metalness: 0.8 });
    // Over-head padded arch
    addMesh(THREE, g, new THREE.TorusGeometry(0.256, 0.02, 12, 28, Math.PI), m1, 'primary', {
      pos: [0, H_Y + 0.015, 0],
    });
    for (const s of [-1, 1]) {
      // Metal slider
      addMesh(THREE, g, new THREE.CylinderGeometry(0.011, 0.011, 0.05, 10), metalM, 'metal', {
        pos: [s * 0.254, H_Y + 0.005, 0],
      });
      // Outer ear cup
      addMesh(THREE, g, new THREE.CylinderGeometry(0.068, 0.062, 0.044, 18), m1, 'primary', {
        pos: [s * 0.252, H_Y - 0.02, 0],
        rot: [0, 0, Math.PI / 2],
      });
      // Soft cushion
      addMesh(THREE, g, new THREE.TorusGeometry(0.054, 0.02, 10, 18), m2, 'accent', {
        pos: [s * 0.226, H_Y - 0.02, 0],
        rot: [0, Math.PI / 2, 0],
      });
      // Accent ring
      addMesh(THREE, g, new THREE.TorusGeometry(0.044, 0.007, 8, 16), m2, 'accent', {
        pos: [s * 0.276, H_Y - 0.02, 0],
        rot: [0, Math.PI / 2, 0],
      });
    }
    return g;
  },

  bucketHat(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xd4c3a3, { roughness: 0.88 });
    const m2 = mat(THREE, opts.accent ?? 0x567363, { roughness: 0.82 });
    const pts = [
      [0.335, 0.945],
      [0.295, 0.985],
      [0.246, 1.005],
      [0.228, 1.115],
      [0.185, 1.135],
      [0.0, 1.14],
    ];
    addMesh(THREE, g, latheGeo(THREE, pts, 28), m1, 'primary', {
      pos: [0, 0.01, -0.008],
      rot: [-0.08, 0, 0],
    });
    // Accent band around crown base
    addMesh(THREE, g, new THREE.CylinderGeometry(0.248, 0.252, 0.026, 26), m2, 'accent', {
      pos: [0, 1.028, -0.01],
      rot: [-0.08, 0, 0],
    });
    return g;
  },

  beret(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x8f3f49, { roughness: 0.92 });
    const m2 = mat(THREE, opts.accent ?? 0x4a242a, { roughness: 0.88 });
    const b = new THREE.Group();
    b.position.set(0.025, 1.045, -0.01);
    b.rotation.set(-0.14, 0, -0.22);
    g.add(b);
    const pts = [
      [0.215, -0.04],
      [0.275, 0.01],
      [0.265, 0.065],
      [0.16, 0.10],
      [0.0, 0.105],
    ];
    addMesh(THREE, b, latheGeo(THREE, pts, 26), m1, 'primary');
    // Stem nub
    addMesh(THREE, b, new THREE.CapsuleGeometry(0.009, 0.024, 4, 8), m2, 'accent', {
      pos: [0, 0.115, 0],
      rot: [0.15, 0, 0.2],
    });
    return g;
  },

  flowerCrown(THREE, opts = {}) {
    const g = new THREE.Group();
    const mVine = mat(THREE, opts.primary ?? 0x5c8254, { roughness: 0.85 });
    const mPetal = mat(THREE, opts.accent ?? 0xf2a0a0, { roughness: 0.72 });
    const mCenter = mat(THREE, 0xf2cf66, { roughness: 0.65 });
    const ringY = H_Y + 0.135;
    addMesh(THREE, g, new THREE.TorusGeometry(0.215, 0.016, 10, 28), mVine, 'primary', {
      pos: [0, ringY, 0.005],
      rot: [Math.PI / 2 - 0.14, 0, 0],
    });
    // 7 multi-petal flowers around front & sides
    const angles = [-1.45, -0.96, -0.48, 0, 0.48, 0.96, 1.45];
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      const fg = new THREE.Group();
      fg.position.set(Math.sin(a) * 0.225, ringY + Math.cos(a) * 0.025, Math.cos(a) * 0.225);
      fg.lookAt(Math.sin(a) * 0.6, ringY + 0.08, Math.cos(a) * 0.6);
      g.add(fg);
      addMesh(THREE, fg, new THREE.SphereGeometry(0.015, 8, 8), mCenter, 'secondary');
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        addMesh(THREE, fg, new THREE.SphereGeometry(0.015, 8, 8), mPetal, 'accent', {
          pos: [Math.cos(pa) * 0.02, Math.sin(pa) * 0.02, -0.003],
          scale: [1, 1, 0.55],
        });
      }
      // Little leaf beside flower
      addMesh(THREE, fg, new THREE.SphereGeometry(0.016, 8, 6), mVine, 'primary', {
        pos: [0.032, -0.01, -0.008],
        scale: [1.4, 0.65, 0.4],
        rot: [0, 0, -0.4],
      });
    }
    return g;
  },

  gradCap(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x262930, { roughness: 0.8 });
    const m2 = mat(THREE, opts.accent ?? 0xe8b84b, { roughness: 0.55, metalness: 0.25 });
    const cap = new THREE.Group();
    cap.position.set(0, H_Y + 0.02, -0.008);
    cap.rotation.x = -0.12;
    g.add(cap);
    // Skullcap
    addMesh(THREE, cap, new THREE.SphereGeometry(0.238, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), m1, 'primary');
    // Flat mortarboard
    const board = roundedRectShape(THREE, 0.34, 0.34, 0.018);
    addMesh(THREE, cap, extrudeCentered(THREE, board, 0.014, 0.004), m1, 'primary', {
      pos: [0, 0.245, 0],
      rot: [Math.PI / 2, Math.PI / 4, 0],
    });
    // Button & draped tassel
    addMesh(THREE, cap, new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), m2, 'accent', {
      pos: [0, 0.258, 0],
    });
    const cord = tubeGeo(THREE, [
      [0, 0.258, 0],
      [0.14, 0.252, 0.04],
      [0.21, 0.23, 0.06],
      [0.22, 0.11, 0.06],
    ], 0.0055, 14, 6);
    addMesh(THREE, cap, cord, m2, 'accent');
    addMesh(THREE, cap, new THREE.ConeGeometry(0.018, 0.055, 10), m2, 'accent', {
      pos: [0.22, 0.082, 0.06],
    });
    return g;
  },
};

// ============================================================================
// FACE (6 styles)
// ============================================================================

export const FACE = {
  roundGlasses(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0x3a3532, { roughness: 0.35, metalness: 0.55 });
    const lensM = mat(THREE, 0xe8f4f8, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.22 });
    const y = H_Y - 0.01;
    const z = 0.226;
    for (const s of [-1, 1]) {
      addMesh(THREE, g, new THREE.TorusGeometry(0.048, 0.006, 8, 22), m, 'primary', {
        pos: [s * 0.072, y, z],
      });
      addMesh(THREE, g, new THREE.CircleGeometry(0.045, 20), lensM, 'secondary', {
        pos: [s * 0.072, y, z],
        castShadow: false,
      });
      // Temple arm
      const arm = tubeGeo(THREE, [
        [s * 0.12, y + 0.005, z],
        [s * 0.218, y + 0.008, 0.10],
        [s * 0.226, y + 0.005, -0.02],
        [s * 0.222, y - 0.03, -0.055],
      ], 0.005, 12, 6);
      addMesh(THREE, g, arm, m, 'primary');
    }
    // Bridge
    addMesh(THREE, g, new THREE.TorusGeometry(0.026, 0.005, 8, 12, Math.PI), m, 'primary', {
      pos: [0, y - 0.002, z],
    });
    return g;
  },

  squareGlasses(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0x4a382c, { roughness: 0.42, metalness: 0.12 });
    const lensM = mat(THREE, 0xe8f4f8, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.22 });
    const y = H_Y - 0.01;
    const z = 0.226;
    const frame = roundedRectShape(THREE, 0.102, 0.076, 0.016);
    const hole = roundedRectShape(THREE, 0.084, 0.058, 0.011);
    frame.holes.push(hole);
    const frameGeo = extrudeCentered(THREE, frame, 0.008, 0.0025);
    const lensGeo = extrudeCentered(THREE, roundedRectShape(THREE, 0.084, 0.058, 0.011), 0.002, 0);
    for (const s of [-1, 1]) {
      addMesh(THREE, g, frameGeo, m, 'primary', { pos: [s * 0.074, y, z] });
      addMesh(THREE, g, lensGeo, lensM, 'secondary', { pos: [s * 0.074, y, z], castShadow: false });
      const arm = tubeGeo(THREE, [
        [s * 0.125, y + 0.012, z],
        [s * 0.22, y + 0.012, 0.10],
        [s * 0.226, y + 0.006, -0.02],
        [s * 0.222, y - 0.03, -0.055],
      ], 0.006, 12, 6);
      addMesh(THREE, g, arm, m, 'primary');
    }
    addMesh(THREE, g, new THREE.BoxGeometry(0.048, 0.011, 0.01), m, 'primary', {
      pos: [0, y + 0.012, z],
    });
    return g;
  },

  sunglasses(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0x222226, { roughness: 0.3, metalness: 0.15 });
    const lensM = mat(THREE, 0x1e252e, { roughness: 0.12, metalness: 0.45 });
    const studM = mat(THREE, 0xd8dce0, { roughness: 0.25, metalness: 0.85 });
    const y = H_Y - 0.01;
    const z = 0.228;
    const frame = roundedRectShape(THREE, 0.108, 0.078, 0.02);
    const hole = roundedRectShape(THREE, 0.086, 0.056, 0.014);
    frame.holes.push(hole);
    const frameGeo = extrudeCentered(THREE, frame, 0.01, 0.003);
    const lensGeo = extrudeCentered(THREE, roundedRectShape(THREE, 0.088, 0.058, 0.014), 0.004, 0);
    for (const s of [-1, 1]) {
      addMesh(THREE, g, frameGeo, m, 'primary', { pos: [s * 0.075, y, z] });
      addMesh(THREE, g, lensGeo, lensM, 'secondary', { pos: [s * 0.075, y, z] });
      addMesh(THREE, g, new THREE.SphereGeometry(0.005, 6, 6), studM, 'metal', {
        pos: [s * 0.12, y + 0.024, z + 0.007],
      });
      const arm = tubeGeo(THREE, [
        [s * 0.128, y + 0.016, z],
        [s * 0.222, y + 0.014, 0.10],
        [s * 0.228, y + 0.006, -0.02],
        [s * 0.224, y - 0.03, -0.055],
      ], 0.007, 12, 6);
      addMesh(THREE, g, arm, m, 'primary');
    }
    addMesh(THREE, g, new THREE.BoxGeometry(0.052, 0.014, 0.012), m, 'primary', {
      pos: [0, y + 0.018, z],
    });
    return g;
  },

  freckles(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0xa86c4d, { roughness: 0.92 });
    const dots = [
      // Left & right cheek clusters + nose bridge
      [-0.082, 0.818], [-0.098, 0.812], [-0.068, 0.808], [-0.092, 0.828], [-0.11, 0.822],
      [0.082, 0.818], [0.098, 0.812], [0.068, 0.808], [0.092, 0.828], [0.11, 0.822],
      [-0.016, 0.824], [0.014, 0.822], [0.0, 0.831],
    ];
    const dotGeo = new THREE.SphereGeometry(0.0055, 8, 6);
    for (const [x, y] of dots) {
      const dy = y - H_Y;
      const z = Math.sqrt(Math.max(0.001, H_R * H_R - x * x - dy * dy)) + 0.002;
      addMesh(THREE, g, dotGeo, m, 'primary', {
        pos: [x, y, z],
        scale: [1, 1, 0.4],
        castShadow: false,
      });
    }
    return g;
  },

  blush(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0xe88b8b, { roughness: 0.95 });
    const geo = new THREE.SphereGeometry(0.032, 14, 10);
    for (const s of [-1, 1]) {
      const x = s * 0.102;
      const y = 0.812;
      const dy = y - H_Y;
      const z = Math.sqrt(Math.max(0.001, H_R * H_R - x * x - dy * dy)) + 0.001;
      addMesh(THREE, g, geo, m, 'primary', {
        pos: [x, y, z],
        rot: [0.18, s * 0.46, 0],
        scale: [1.22, 0.72, 0.22],
        castShadow: false,
      });
    }
    return g;
  },

  mask(THREE, opts = {}) {
    const g = new THREE.Group();
    const m = mat(THREE, opts.primary ?? 0xf2f0ec, { roughness: 0.88 });
    const strapM = mat(THREE, 0xe2dfd8, { roughness: 0.85 });
    // Contoured fabric shield over nose & mouth
    const shieldGeo = new THREE.SphereGeometry(0.23, 20, 14, -Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.52, Math.PI * 0.24);
    addMesh(THREE, g, shieldGeo, m, 'primary', {
      pos: [0, H_Y, 0.004],
      rot: [0, Math.PI / 2, 0],
    });
    // Subtle central nose contour ridge
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.008, 0.075, 6, 8), m, 'primary', {
      pos: [0, 0.79, 0.222],
      rot: [0.32, 0, 0],
    });
    // Elastic ear loops
    for (const s of [-1, 1]) {
      const loop = tubeGeo(THREE, [
        [s * 0.155, 0.822, 0.168],
        [s * 0.224, 0.842, 0.02],
        [s * 0.222, 0.805, -0.015],
        [s * 0.145, 0.768, 0.16],
      ], 0.0045, 14, 6);
      addMesh(THREE, g, loop, strapM, 'secondary');
    }
    return g;
  },
};

// ============================================================================
// CARRY (7 styles)
// ============================================================================

export const CARRY = {
  backpack(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xc97b63, { roughness: 0.85 });
    const m2 = mat(THREE, opts.secondary ?? 0xefe9de, { roughness: 0.82 });
    const metalM = mat(THREE, 0xc7ccd1, { roughness: 0.3, metalness: 0.8 });
    // Main compartment
    const body = roundedRectShape(THREE, 0.21, 0.25, 0.055);
    addMesh(THREE, g, extrudeCentered(THREE, body, 0.095, 0.018), m1, 'primary', {
      pos: [0, 0.49, -0.175],
    });
    // Front pocket
    const pkt = roundedRectShape(THREE, 0.15, 0.105, 0.03);
    addMesh(THREE, g, extrudeCentered(THREE, pkt, 0.036, 0.01), m2, 'secondary', {
      pos: [0, 0.435, -0.235],
    });
    // Top grab handle
    addMesh(THREE, g, new THREE.TorusGeometry(0.032, 0.009, 8, 16, Math.PI), m2, 'secondary', {
      pos: [0, 0.625, -0.17],
    });
    // Zipper pulls
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.006, 0.016, 4, 6), metalM, 'metal', {
      pos: [0.035, 0.488, -0.262],
    });
    // Shoulder straps
    for (const s of [-1, 1]) {
      const strap = tubeGeo(THREE, [
        [s * 0.068, 0.59, -0.13],
        [s * 0.095, 0.638, 0.01],
        [s * 0.112, 0.50, 0.108],
        [s * 0.095, 0.39, -0.12],
      ], 0.014, 18, 8);
      addMesh(THREE, g, strap, m2, 'secondary');
    }
    return g;
  },

  toteBag(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xe8dfc8, { roughness: 0.9 });
    const m2 = mat(THREE, opts.secondary ?? 0x5c7a69, { roughness: 0.86 });
    const bag = new THREE.Group();
    bag.position.set(0.215, 0.34, 0.02);
    bag.rotation.set(0.06, -0.15, -0.08);
    g.add(bag);
    // Main canvas body
    const shape = roundedRectShape(THREE, 0.075, 0.21, 0.016);
    addMesh(THREE, bag, extrudeCentered(THREE, shape, 0.18, 0.008), m1, 'primary');
    // Contrasting bottom panel
    const bot = roundedRectShape(THREE, 0.078, 0.065, 0.014);
    addMesh(THREE, bag, extrudeCentered(THREE, bot, 0.184, 0.008), m2, 'secondary', {
      pos: [0, -0.075, 0],
    });
    // Two handles looping up to the shoulder/arm
    for (const s of [-1, 1]) {
      const h = tubeGeo(THREE, [
        [s * 0.036, 0.10, -0.045],
        [s * 0.025, 0.24, -0.02],
        [s * 0.025, 0.24, 0.02],
        [s * 0.036, 0.10, 0.045],
      ], 0.008, 16, 6);
      addMesh(THREE, bag, h, m2, 'secondary');
    }
    return g;
  },

  coffeeCup(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xb8865c, { roughness: 0.9 });
    const m2 = mat(THREE, opts.secondary ?? 0xf5f2eb, { roughness: 0.65 });
    const cup = new THREE.Group();
    cup.position.set(0.175, 0.39, 0.085);
    cup.rotation.set(0.12, 0, -0.08);
    g.add(cup);
    // Paper cup
    addMesh(THREE, cup, new THREE.CylinderGeometry(0.034, 0.024, 0.105, 18), m2, 'secondary');
    // Heat sleeve
    addMesh(THREE, cup, new THREE.CylinderGeometry(0.0325, 0.0285, 0.044, 18), m1, 'primary', {
      pos: [0, 0.004, 0],
    });
    // Domed sip lid
    addMesh(THREE, cup, new THREE.CylinderGeometry(0.036, 0.037, 0.012, 18), m2, 'secondary', {
      pos: [0, 0.056, 0],
    });
    addMesh(THREE, cup, new THREE.CylinderGeometry(0.03, 0.034, 0.012, 18), m2, 'secondary', {
      pos: [0, 0.066, 0],
    });
    return g;
  },

  book(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x4c6b58, { roughness: 0.82 });
    const m2 = mat(THREE, opts.secondary ?? 0xf3ecdc, { roughness: 0.9 });
    const acc = mat(THREE, 0xd46a5a, { roughness: 0.78 });
    const bk = new THREE.Group();
    bk.position.set(-0.195, 0.44, 0.035);
    bk.rotation.set(0.18, 0.2, 0.15);
    g.add(bk);
    // Hardcover & pages
    const cover = roundedRectShape(THREE, 0.038, 0.19, 0.006);
    addMesh(THREE, bk, extrudeCentered(THREE, cover, 0.145, 0.004), m1, 'primary');
    addMesh(THREE, bk, new THREE.BoxGeometry(0.03, 0.178, 0.138), m2, 'secondary', {
      pos: [0.003, 0, 0.005],
    });
    // Spine bands
    for (const y of [-0.055, 0.055]) {
      addMesh(THREE, bk, new THREE.BoxGeometry(0.042, 0.01, 0.012), acc, 'accent', {
        pos: [0, y, -0.072],
      });
    }
    // Bookmark ribbon
    addMesh(THREE, bk, new THREE.BoxGeometry(0.004, 0.04, 0.012), acc, 'accent', {
      pos: [0.002, -0.105, 0.02],
      rot: [0.2, 0, 0],
    });
    return g;
  },

  guitarCase(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x5c4334, { roughness: 0.82 });
    const m2 = mat(THREE, opts.secondary ?? 0xd9c7ad, { roughness: 0.85 });
    const gc = new THREE.Group();
    gc.position.set(0.01, 0.52, -0.185);
    gc.rotation.set(0.06, 0, -0.28);
    g.add(gc);
    // Figure-8 acoustic gig bag silhouette
    const s = new THREE.Shape();
    s.moveTo(0, -0.28);
    s.bezierCurveTo(0.18, -0.28, 0.18, -0.08, 0.10, -0.02);
    s.bezierCurveTo(0.15, 0.05, 0.13, 0.15, 0.055, 0.17);
    s.lineTo(0.048, 0.34);
    s.quadraticCurveTo(0.048, 0.38, 0, 0.38);
    s.quadraticCurveTo(-0.048, 0.38, -0.048, 0.34);
    s.lineTo(-0.055, 0.17);
    s.bezierCurveTo(-0.13, 0.15, -0.15, 0.05, -0.10, -0.02);
    s.bezierCurveTo(-0.18, -0.08, -0.18, -0.28, 0, -0.28);
    addMesh(THREE, gc, extrudeCentered(THREE, s, 0.075, 0.014, 14), m1, 'primary');
    // Front pocket
    const pkt = roundedRectShape(THREE, 0.14, 0.12, 0.025);
    addMesh(THREE, gc, extrudeCentered(THREE, pkt, 0.022, 0.006), m2, 'secondary', {
      pos: [0, -0.13, -0.045],
    });
    // Cross-body strap
    const strap = tubeGeo(THREE, [
      [0.06, 0.62, -0.12],
      [0.10, 0.64, 0.03],
      [0.0, 0.49, 0.13],
      [-0.11, 0.38, 0.04],
      [-0.08, 0.38, -0.12],
    ], 0.014, 20, 8);
    addMesh(THREE, g, strap, m2, 'secondary');
    return g;
  },

  skateboard(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0xd98a5f, { roughness: 0.68 });
    const m2 = mat(THREE, opts.secondary ?? 0xf0e6d2, { roughness: 0.62 });
    const metalM = mat(THREE, 0xb8c0c8, { roughness: 0.3, metalness: 0.85 });
    const sb = new THREE.Group();
    sb.position.set(-0.205, 0.43, 0.02);
    sb.rotation.set(0.15, Math.PI / 2 - 0.12, 0.12);
    g.add(sb);
    // Pill-shaped cruiser deck
    const deck = roundedRectShape(THREE, 0.145, 0.46, 0.072);
    addMesh(THREE, sb, extrudeCentered(THREE, deck, 0.014, 0.004), m1, 'primary');
    // Center stripe
    addMesh(THREE, sb, new THREE.BoxGeometry(0.036, 0.38, 0.018), m2, 'secondary', {
      pos: [0, 0, -0.003],
    });
    // Trucks & 4 wheels
    for (const y of [-0.13, 0.13]) {
      addMesh(THREE, sb, new THREE.CylinderGeometry(0.009, 0.009, 0.135, 10), metalM, 'metal', {
        pos: [0, y, -0.028],
        rot: [0, 0, Math.PI / 2],
      });
      addMesh(THREE, sb, new THREE.BoxGeometry(0.036, 0.04, 0.022), metalM, 'metal', {
        pos: [0, y, -0.016],
      });
      for (const s of [-1, 1]) {
        addMesh(THREE, sb, new THREE.CylinderGeometry(0.024, 0.024, 0.026, 14), m2, 'secondary', {
          pos: [s * 0.068, y, -0.028],
          rot: [0, 0, Math.PI / 2],
        });
      }
    }
    return g;
  },

  camera(THREE, opts = {}) {
    const g = new THREE.Group();
    const m1 = mat(THREE, opts.primary ?? 0x3b3836, { roughness: 0.62 });
    const m2 = mat(THREE, opts.secondary ?? 0xd8dce0, { roughness: 0.32, metalness: 0.72 });
    const glassM = mat(THREE, 0x1a222b, { roughness: 0.1, metalness: 0.65 });
    const cam = new THREE.Group();
    cam.position.set(0, 0.49, 0.155);
    cam.rotation.x = 0.08;
    g.add(cam);
    // Compact retro body
    const body = roundedRectShape(THREE, 0.11, 0.068, 0.012);
    addMesh(THREE, cam, extrudeCentered(THREE, body, 0.044, 0.005), m1, 'primary');
    // Silver top plate
    const top = roundedRectShape(THREE, 0.108, 0.022, 0.008);
    addMesh(THREE, cam, extrudeCentered(THREE, top, 0.044, 0.004), m2, 'secondary', {
      pos: [0, 0.026, 0],
    });
    // Lens barrel & dark glass
    addMesh(THREE, cam, new THREE.CylinderGeometry(0.026, 0.028, 0.032, 18), m2, 'secondary', {
      pos: [0, -0.004, 0.032],
      rot: [Math.PI / 2, 0, 0],
    });
    addMesh(THREE, cam, new THREE.CylinderGeometry(0.02, 0.02, 0.01, 16), glassM, 'metal', {
      pos: [0, -0.004, 0.046],
      rot: [Math.PI / 2, 0, 0],
    });
    // Shutter button & viewfinder
    addMesh(THREE, cam, new THREE.CylinderGeometry(0.008, 0.008, 0.012, 10), m2, 'secondary', {
      pos: [-0.035, 0.042, 0.004],
    });
    addMesh(THREE, cam, new THREE.BoxGeometry(0.016, 0.012, 0.012), glassM, 'metal', {
      pos: [0.032, 0.026, 0.022],
    });
    // Neck strap
    const strap = tubeGeo(THREE, [
      [-0.056, 0.515, 0.155],
      [-0.075, 0.625, 0.06],
      [0, 0.642, -0.065],
      [0.075, 0.625, 0.06],
      [0.056, 0.515, 0.155],
    ], 0.0055, 22, 6);
    addMesh(THREE, g, strap, m1, 'primary');
    return g;
  },
};

// ============================================================================
// CATALOG (56 wearable entries)
// ============================================================================

export const CATALOG = [
  // Hair (16)
  { id: 'hair.short', name: 'Short Cut', kind: 'hair', footprint: [0.46, 0.46], placement: 'worn', variants: 8, note: 'Cozy layered short hair with side-swept bangs.' },
  { id: 'hair.buzz', name: 'Buzz Cut', kind: 'hair', footprint: [0.45, 0.45], placement: 'worn', variants: 8, note: 'Close-cropped buzz with subtle temple fade.' },
  { id: 'hair.middlePart', name: 'Middle Part', kind: 'hair', footprint: [0.47, 0.46], placement: 'worn', variants: 8, note: 'Soft curtain bangs parted down the centre.' },
  { id: 'hair.curly', name: 'Curly Cloud', kind: 'hair', footprint: [0.50, 0.50], placement: 'worn', variants: 8, note: 'Bouncy sculpted curls with soft forehead fringe.' },
  { id: 'hair.afro', name: 'Afro Halo', kind: 'hair', footprint: [0.56, 0.54], placement: 'worn', variants: 8, note: 'Full rounded afro with slim accent headband.' },
  { id: 'hair.braids', name: 'Twin Braids', kind: 'hair', footprint: [0.48, 0.46], placement: 'worn', variants: 8, note: 'Double shoulder braids finished with accent ties.' },
  { id: 'hair.bob', name: 'Chin Bob', kind: 'hair', footprint: [0.50, 0.48], placement: 'worn', variants: 8, note: 'Rounded chin-length bob with full fringe and hair clip.' },
  { id: 'hair.longStraight', name: 'Long Straight', kind: 'hair', footprint: [0.48, 0.50], placement: 'worn', variants: 8, note: 'Flowing straight hair with face-framing strands.' },
  { id: 'hair.ponytail', name: 'High Ponytail', kind: 'hair', footprint: [0.46, 0.58], placement: 'worn', variants: 8, note: 'Swept-up ponytail gathered with a cozy scrunchie.' },
  { id: 'hair.twinBuns', name: 'Twin Buns', kind: 'hair', footprint: [0.54, 0.46], placement: 'worn', variants: 8, note: 'Double space buns wrapped with accent ribbons.' },
  { id: 'hair.wolfCut', name: 'Wolf Cut', kind: 'hair', footprint: [0.52, 0.52], placement: 'worn', variants: 8, note: 'Shaggy layered cut with choppy fringe and flared back.' },
  { id: 'hair.locs', name: 'Shoulder Locs', kind: 'hair', footprint: [0.50, 0.50], placement: 'worn', variants: 8, note: 'Full shoulder-length locs accented with metallic cuffs.' },
  { id: 'hair.pixie', name: 'Pixie Cut', kind: 'hair', footprint: [0.46, 0.46], placement: 'worn', variants: 8, note: 'Tousled pixie with asymmetrical feathered bangs.' },
  { id: 'hair.sidePart', name: 'Side Part', kind: 'hair', footprint: [0.46, 0.46], placement: 'worn', variants: 8, note: 'Neat side-parted wave tucked behind one ear.' },
  { id: 'hair.hijab', name: 'Draped Hijab', kind: 'hair', footprint: [0.48, 0.48], placement: 'worn', variants: 8, note: 'Softly draped hijab with contrasting undercap and pin.' },
  { id: 'hair.turban', name: 'Wrapped Turban', kind: 'hair', footprint: [0.48, 0.48], placement: 'worn', variants: 8, note: 'Layered criss-cross wrap with sculpted front knot.' },

  // Tops (10)
  { id: 'tops.hoodie', name: 'Cozy Hoodie', kind: 'tops', footprint: [0.38, 0.30], placement: 'worn', variants: 6, note: 'Pullover hoodie with kangaroo pocket, hood, and drawstrings.' },
  { id: 'tops.tee', name: 'Relaxed Tee', kind: 'tops', footprint: [0.36, 0.26], placement: 'worn', variants: 6, note: 'Everyday crewneck t-shirt with accented chest pocket.' },
  { id: 'tops.shirt', name: 'Button-Down Shirt', kind: 'tops', footprint: [0.36, 0.26], placement: 'worn', variants: 6, note: 'Crisp collared shirt with front placket and rolled sleeves.' },
  { id: 'tops.cardigan', name: 'Knit Cardigan', kind: 'tops', footprint: [0.38, 0.28], placement: 'worn', variants: 6, note: 'Open-front knit cardigan layered over a soft tee.' },
  { id: 'tops.varsityJacket', name: 'Varsity Jacket', kind: 'tops', footprint: [0.38, 0.28], placement: 'worn', variants: 6, note: 'Retro letterman jacket with contrast sleeves and chest patch.' },
  { id: 'tops.sweater', name: 'Chunky Sweater', kind: 'tops', footprint: [0.38, 0.29], placement: 'worn', variants: 6, note: 'Warm knit crewneck with striped chest band.' },
  { id: 'tops.puffer', name: 'Quilted Puffer', kind: 'tops', footprint: [0.40, 0.32], placement: 'worn', variants: 6, note: 'Baffled winter puffer jacket with stand-up collar.' },
  { id: 'tops.blazer', name: 'Smart Blazer', kind: 'tops', footprint: [0.38, 0.28], placement: 'worn', variants: 6, note: 'Tailored casual blazer with lapels and pocket square.' },
  { id: 'tops.overalls', name: 'Canvas Overalls', kind: 'tops', footprint: [0.36, 0.28], placement: 'worn', variants: 6, note: 'Bib overalls with brass buttons over a short-sleeve tee.' },
  { id: 'tops.jersey', name: 'Sporty Jersey', kind: 'tops', footprint: [0.36, 0.27], placement: 'worn', variants: 6, note: 'V-neck athletic jersey with contrast side stripes.' },

  // Bottoms (6)
  { id: 'bottoms.trousers', name: 'Straight Trousers', kind: 'bottoms', footprint: [0.27, 0.24], placement: 'worn', variants: 6, note: 'Tailored straight-leg trousers with neat cuffs.' },
  { id: 'bottoms.shorts', name: 'Casual Shorts', kind: 'bottoms', footprint: [0.27, 0.24], placement: 'worn', variants: 6, note: 'Breezy mid-thigh shorts with soft cuffed hems.' },
  { id: 'bottoms.skirt', name: 'A-Line Skirt', kind: 'bottoms', footprint: [0.36, 0.34], placement: 'worn', variants: 6, note: 'Smooth flared A-line skirt with fitted waist.' },
  { id: 'bottoms.jeans', name: 'Cuffed Jeans', kind: 'bottoms', footprint: [0.27, 0.24], placement: 'worn', variants: 6, note: 'Classic denim jeans with turned cuffs and metal rivets.' },
  { id: 'bottoms.joggers', name: 'Comfy Joggers', kind: 'bottoms', footprint: [0.28, 0.25], placement: 'worn', variants: 6, note: 'Tapered lounge joggers with drawstring and ankle cuffs.' },
  { id: 'bottoms.pleatedSkirt', name: 'Pleated Skirt', kind: 'bottoms', footprint: [0.36, 0.34], placement: 'worn', variants: 6, note: 'Preppy skirt built from crisp overlapping pleats.' },

  // Shoes (4)
  { id: 'shoes.sneakers', name: 'Chunky Sneakers', kind: 'shoes', footprint: [0.22, 0.16], placement: 'worn', variants: 6, note: 'Cushioned everyday sneakers with toe cap and laces.' },
  { id: 'shoes.boots', name: 'Ankle Boots', kind: 'shoes', footprint: [0.22, 0.16], placement: 'worn', variants: 6, note: 'Sturdy lace-up boots with thick lugged soles.' },
  { id: 'shoes.loafers', name: 'Penny Loafers', kind: 'shoes', footprint: [0.21, 0.16], placement: 'worn', variants: 6, note: 'Polished slip-on loafers with vamp strap.' },
  { id: 'shoes.slippers', name: 'Plush Slippers', kind: 'shoes', footprint: [0.23, 0.16], placement: 'worn', variants: 6, note: 'Soft house slippers with fluffy fur collar.' },

  // Headwear (7)
  { id: 'headwear.cap', name: 'Baseball Cap', kind: 'headwear', footprint: [0.49, 0.56], placement: 'worn', variants: 6, note: 'Curved-brim cap with top button and accent band.' },
  { id: 'headwear.beanie', name: 'Pom Beanie', kind: 'headwear', footprint: [0.50, 0.50], placement: 'worn', variants: 6, note: 'Slouchy knit beanie with folded cuff and fluffy pom.' },
  { id: 'headwear.headphones', name: 'Studio Headphones', kind: 'headwear', footprint: [0.56, 0.18], placement: 'worn', variants: 6, note: 'Over-ear padded headphones with metallic sliders.' },
  { id: 'headwear.bucketHat', name: 'Bucket Hat', kind: 'headwear', footprint: [0.66, 0.66], placement: 'worn', variants: 6, note: 'Soft-brimmed bucket hat with contrast crown band.' },
  { id: 'headwear.beret', name: 'Artist Beret', kind: 'headwear', footprint: [0.54, 0.54], placement: 'worn', variants: 6, note: 'Jauntily tilted wool beret with little top stem.' },
  { id: 'headwear.flowerCrown', name: 'Flower Crown', kind: 'headwear', footprint: [0.48, 0.48], placement: 'worn', variants: 6, note: 'Braided vine halo dotted with multi-petal blossoms.' },
  { id: 'headwear.gradCap', name: 'Graduation Cap', kind: 'headwear', footprint: [0.48, 0.48], placement: 'worn', variants: 4, note: 'Classic mortarboard cap with draped gold tassel.' },

  // Face (6)
  { id: 'face.roundGlasses', name: 'Round Glasses', kind: 'face', footprint: [0.45, 0.28], placement: 'worn', variants: 5, note: 'Delicate circular frames with clear glossy lenses.' },
  { id: 'face.squareGlasses', name: 'Square Glasses', kind: 'face', footprint: [0.45, 0.28], placement: 'worn', variants: 5, note: 'Softly bevelled rectangular acetate frames.' },
  { id: 'face.sunglasses', name: 'Sunglasses', kind: 'face', footprint: [0.45, 0.28], placement: 'worn', variants: 5, note: 'Bold dark-tinted shades with metallic hinge studs.' },
  { id: 'face.freckles', name: 'Freckles', kind: 'face', footprint: [0.22, 0.06], placement: 'worn', variants: 3, note: 'Gentle scatter of freckles across cheeks and nose.' },
  { id: 'face.blush', name: 'Rosy Blush', kind: 'face', footprint: [0.24, 0.06], placement: 'worn', variants: 4, note: 'Warm matte cheek blush pillows.' },
  { id: 'face.mask', name: 'Cloth Mask', kind: 'face', footprint: [0.45, 0.25], placement: 'worn', variants: 6, note: 'Contoured fabric face mask with soft ear loops.' },

  // Carry (7)
  { id: 'carry.backpack', name: 'Day Backpack', kind: 'carry', footprint: [0.24, 0.14], placement: 'worn', variants: 6, note: 'Rounded school backpack with front pocket and straps.' },
  { id: 'carry.toteBag', name: 'Canvas Tote', kind: 'carry', footprint: [0.10, 0.20], placement: 'worn', variants: 6, note: 'Two-tone canvas tote bag hung over the arm.' },
  { id: 'carry.coffeeCup', name: 'Coffee Cup', kind: 'carry', footprint: [0.08, 0.08], placement: 'worn', variants: 4, note: 'Takeaway coffee cup with heat sleeve and sip lid.' },
  { id: 'carry.book', name: 'Hardcover Book', kind: 'carry', footprint: [0.06, 0.16], placement: 'worn', variants: 6, note: 'Tucked-under-arm hardcover with bookmark ribbon.' },
  { id: 'carry.guitarCase', name: 'Guitar Gig Bag', kind: 'carry', footprint: [0.36, 0.12], placement: 'worn', variants: 5, note: 'Acoustic guitar case slung diagonally across the back.' },
  { id: 'carry.skateboard', name: 'Cruiser Board', kind: 'carry', footprint: [0.16, 0.46], placement: 'worn', variants: 6, note: 'Retro cruiser skateboard tucked under the left arm.' },
  { id: 'carry.camera', name: 'Retro Camera', kind: 'carry', footprint: [0.12, 0.08], placement: 'worn', variants: 4, note: 'Compact silver-top camera hanging from a neck strap.' },
];