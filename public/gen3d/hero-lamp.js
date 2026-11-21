export const META = {
  id: 'desk-lamp',
  name: 'Cozy Desk Lamp',
  kind: 'prop',
  footprint: [0.26, 0.28],
  variants: ['Architect Lamp', 'Mushroom Glass Lamp', "Banker's Lamp"],
  note: 'Stylised 0.45 m dorm desk lamp with weighted base, jointed hinged arm and springs, glowing inner shade, braided cord, and warm glow PointLight.'
};

function safeNoise(kit, x, y) {
  if (kit && typeof kit.noise === 'function') return kit.noise(x, y);
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function makeCanvasTex(THREE, kit, w, h, drawFn, isColor = true, repeat = [1, 1]) {
  if (!kit || typeof kit.canvasTexture !== 'function') return null;
  const tex = kit.canvasTexture(w, h, drawFn);
  if (!tex) return null;
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.needsUpdate = true;
  return tex;
}

function createTextures(THREE, kit, variant) {
  // Subtle ceramic/enamel glaze texture (neutral light base so material.color tints cleanly)
  const enamelMap = makeCanvasTex(THREE, kit, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f3f1ee';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      const grad = 240 + Math.sin((y / h) * Math.PI) * 12;
      for (let x = 0; x < w; x += 4) {
        const n = safeNoise(kit, x * 0.025, y * 0.025);
        const v = Math.max(205, Math.min(255, Math.round(grad + (n - 0.5) * 20)));
        ctx.fillStyle = `rgb(${v},${v},${Math.max(200, v - 2)})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    // Delicate artisanal speckles
    for (let i = 0; i < 650; i++) {
      const rx = safeNoise(kit, i * 1.37, 2.1) * w;
      const ry = safeNoise(kit, 4.9, i * 1.91) * h;
      const r = 0.6 + safeNoise(kit, i * 0.7, i * 0.3) * 1.4;
      const dark = i % 3 === 0;
      ctx.fillStyle = dark ? 'rgba(90,82,76,0.08)' : 'rgba(255,255,252,0.16)';
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, true, [1, 1]);

  const enamelBump = makeCanvasTex(THREE, kit, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n = safeNoise(kit, x * 0.08, y * 0.08);
        const v = Math.round(114 + n * 28);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  }, false, [2, 2]);

  // Brushed brass/steel textures
  const metalMap = makeCanvasTex(THREE, kit, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#eceae6';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const streak = safeNoise(kit, 0.5, y * 0.35);
      const base = Math.round(224 + streak * 28);
      ctx.fillStyle = `rgb(${base},${base},${Math.max(210, base - 3)})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 420; i++) {
      const y = safeNoise(kit, i * 0.91, 7.2) * h;
      const x = safeNoise(kit, 3.1, i * 1.13) * w;
      const len = 30 + safeNoise(kit, i * 0.4, 1.8) * 140;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(130,120,105,0.09)';
      ctx.fillRect(x, y, len, 1.2);
    }
  }, true, [2, 2]);

  const metalBump = makeCanvasTex(THREE, kit, 256, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const n = safeNoise(kit, 2.3, y * 0.55);
      const v = Math.round(108 + n * 40);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  }, false, [3, 3]);

  // Braided vintage fabric cord weave
  const cordMap = makeCanvasTex(THREE, kit, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c8c4be';
    ctx.fillRect(0, 0, w, h);
    const step = 16;
    for (let y = -h; y < h * 2; y += step) {
      for (let x = -w; x < w * 2; x += step) {
        const diag = ((Math.floor(x / step) + Math.floor(y / step)) & 1) === 0;
        const n = safeNoise(kit, x * 0.05, y * 0.05);
        const c1 = Math.round((diag ? 236 : 196) + (n - 0.5) * 18);
        ctx.strokeStyle = `rgb(${c1},${c1},${Math.max(175, c1 - 4)})`;
        ctx.lineWidth = 6.2;
        ctx.beginPath();
        if (diag) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + step, y + step);
        } else {
          ctx.moveTo(x + step, y);
          ctx.lineTo(x, y + step);
        }
        ctx.stroke();
      }
    }
  }, true, [22, 2]);

  const cordBump = makeCanvasTex(THREE, kit, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, w, h);
    const step = 16;
    for (let y = -h; y < h * 2; y += step) {
      for (let x = -w; x < w * 2; x += step) {
        const diag = ((Math.floor(x / step) + Math.floor(y / step)) & 1) === 0;
        ctx.strokeStyle = diag ? '#e2e2e2' : '#adadad';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        if (diag) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + step, y + step);
        } else {
          ctx.moveTo(x + step, y);
          ctx.lineTo(x, y + step);
        }
        ctx.stroke();
      }
    }
  }, false, [22, 2]);

  // Emissive warm inner shade gradient
  const glowMap = makeCanvasTex(THREE, kit, 256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#fffdf6');
    g.addColorStop(0.38, '#ffefcb');
    g.addColorStop(0.76, '#ffd28e');
    g.addColorStop(1.0, '#f5b360');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Subtle spun-reflector rings
    for (let y = 0; y < h; y += 3) {
      const a = 0.03 + safeNoise(kit, 1.2, y * 0.25) * 0.04;
      ctx.fillStyle = `rgba(255,244,220,${a.toFixed(3)})`;
      ctx.fillRect(0, y, w, 1);
    }
  }, true, [1, 1]);

  // Hand-blown glass variation for Mushroom (variant 1) and Banker's (variant 2)
  const glassMap = makeCanvasTex(THREE, kit, 512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (variant === 1) {
      // Milk glass opal gradient: brighter warm center, softer tinted rim & crown
      g.addColorStop(0.0, '#e3ded8');
      g.addColorStop(0.32, '#f9f5ef');
      g.addColorStop(0.68, '#fffcf7');
      g.addColorStop(0.92, '#ece4da');
      g.addColorStop(1.0, '#d9cfc4');
    } else {
      // Cased banker's glass: luminous center, richer deeper edges
      g.addColorStop(0.0, '#d8dad8');
      g.addColorStop(0.35, '#f2f5f2');
      g.addColorStop(0.75, '#eef2ee');
      g.addColorStop(1.0, '#bfc7c1');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle hand-blown glass waves
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n1 = safeNoise(kit, x * 0.015, y * 0.025);
        const n2 = safeNoise(kit, x * 0.04 + 9.2, y * 0.015);
        const rib = variant === 1 ? Math.sin((x / w) * Math.PI * 24) * 0.04 : 0;
        const delta = (n1 * 0.6 + n2 * 0.4 - 0.5) * 0.14 + rib;
        if (Math.abs(delta) > 0.01) {
          ctx.fillStyle = delta > 0
            ? `rgba(255,255,250,${Math.min(0.22, delta).toFixed(3)})`
            : `rgba(55,62,58,${Math.min(0.18, -delta).toFixed(3)})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
  }, true, [1, 1]);

  // Felt pad underside texture
  const feltMap = makeCanvasTex(THREE, kit, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#38332f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const x = safeNoise(kit, i * 1.13, 3.7) * w;
      const y = safeNoise(kit, 8.1, i * 1.47) * h;
      const ang = safeNoise(kit, i * 0.3, i * 0.9) * Math.PI * 2;
      const len = 3 + safeNoise(kit, i * 0.7, 2.4) * 5;
      const v = Math.round(44 + safeNoise(kit, i * 0.5, 5.1) * 32);
      ctx.strokeStyle = `rgba(${v},${v - 2},${v - 4},0.45)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }, true, [2, 2]);

  return {
    enamelMap,
    enamelBump,
    metalMap,
    metalBump,
    cordMap,
    cordBump,
    glowMap,
    glassMap,
    feltMap
  };
}

// --- Geometry Craft Helpers ---

function tagSlot(mesh, slot, castShadow = true, receiveShadow = true) {
  if (slot) mesh.userData.slot = slot;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function buildLathe(THREE, pts, segs = 48) {
  const v2 = pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const geo = new THREE.LatheGeometry(v2, segs);
  geo.computeVertexNormals();
  return geo;
}

// Ring-by-ring tapered tube with parallel-transport frames (zero Frenet flipping)
function buildTaperedTube(THREE, curve, segs, radSegs, radiusFn, capStart = true, capEnd = true) {
  const positions = [];
  const uvs = [];
  const indices = [];

  const pts = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  // Initial normal perpendicular to tangent[0]
  const ref = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(ref, tangents[0]).normalize();
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  for (let i = 1; i <= segs; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const n = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(Math.max(-1, Math.min(1, prevT.dot(currT))));
      quat.setFromAxisAngle(axis, angle);
      n.applyQuaternion(quat);
    }
    // Re-orthogonalize
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    const b = new THREE.Vector3().crossVectors(currT, n).normalize();
    normals.push(n);
    binormals.push(b);
  }

  const ringStride = radSegs + 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const r = typeof radiusFn === 'function' ? radiusFn(t) : radiusFn;
    const c = pts[i];
    const n = normals[i];
    const b = binormals[i];
    for (let j = 0; j <= radSegs; j++) {
      const v = j / radSegs;
      const ang = v * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      positions.push(
        c.x + (n.x * ca + b.x * sa) * r,
        c.y + (n.y * ca + b.y * sa) * r,
        c.z + (n.z * ca + b.z * sa) * r
      );
      uvs.push(t, v);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radSegs; j++) {
      const v00 = i * ringStride + j;
      const v01 = v00 + 1;
      const v10 = (i + 1) * ringStride + j;
      const v11 = v10 + 1;
      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);
    }
  }

  if (capStart) {
    const centerIdx = positions.length / 3;
    const p0 = pts[0];
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radSegs; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const centerIdx = positions.length / 3;
    const p1 = pts[segs];
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(1, 0.5);
    const base = segs * ringStride;
    for (let j = 0; j < radSegs; j++) {
      indices.push(centerIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Crisp coiled metal spring with straight mounting hook tails
function buildHelixSpring(THREE, pStart, pEnd, coilRadius, wireRadius, turns = 14) {
  const dir = new THREE.Vector3().subVectors(pEnd, pStart);
  const totalLen = dir.length();
  const axis = dir.clone().normalize();
  const upRef = Math.abs(axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const uVec = new THREE.Vector3().crossVectors(axis, upRef).normalize();
  const vVec = new THREE.Vector3().crossVectors(axis, uVec).normalize();

  const pts = [];
  const lead = Math.min(0.012, totalLen * 0.14);
  const bodyLen = Math.max(0.01, totalLen - lead * 2);

  // Start eyelet/hook
  pts.push(pStart.clone());
  pts.push(pStart.clone().addScaledVector(axis, lead * 0.45).addScaledVector(uVec, coilRadius * 0.35));
  pts.push(pStart.clone().addScaledVector(axis, lead * 0.85).addScaledVector(uVec, coilRadius * 0.88));

  const coilSteps = turns * 12;
  for (let i = 0; i <= coilSteps; i++) {
    const t = i / coilSteps;
    const ang = t * turns * Math.PI * 2;
    const along = lead + t * bodyLen;
    // Slight smooth entry/exit taper on coil radius
    const rScale = Math.min(1, t * 14, (1 - t) * 14) * 0.18 + 0.82;
    const r = coilRadius * rScale;
    const p = pStart.clone()
      .addScaledVector(axis, along)
      .addScaledVector(uVec, Math.cos(ang) * r)
      .addScaledVector(vVec, Math.sin(ang) * r);
    pts.push(p);
  }

  // End eyelet/hook
  pts.push(pEnd.clone().addScaledVector(axis, -lead * 0.85).addScaledVector(uVec, coilRadius * 0.88));
  pts.push(pEnd.clone().addScaledVector(axis, -lead * 0.45).addScaledVector(uVec, coilRadius * 0.35));
  pts.push(pEnd.clone());

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.25);
  return buildTaperedTube(THREE, curve, turns * 10 + 16, 8, () => wireRadius, true, true);
}

function buildBentExtrude(THREE, shape, extrudeOpts, bendFn) {
  const geo = new THREE.ExtrudeGeometry(shape, extrudeOpts);
  geo.center();
  if (bendFn) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const res = bendFn(pos.getX(i), pos.getY(i), pos.getZ(i));
      pos.setXYZ(i, res[0], res[1], res[2]);
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted knurled brass thumbwheel / dimmer knob
function buildKnurledKnob(THREE, radius, thickness, flutes = 24) {
  const profile = [
    [0, -thickness * 0.5],
    [radius * 0.65, -thickness * 0.5],
    [radius * 0.88, -thickness * 0.46],
    [radius * 0.98, -thickness * 0.35],
    [radius, -thickness * 0.22],
    [radius, -thickness * 0.1],
    [radius, 0],
    [radius, thickness * 0.1],
    [radius, thickness * 0.22],
    [radius * 0.98, thickness * 0.35],
    [radius * 0.86, thickness * 0.46],
    [radius * 0.62, thickness * 0.5],
    [radius * 0.38, thickness * 0.47],
    [radius * 0.24, thickness * 0.52],
    [radius * 0.1, thickness * 0.53],
    [0, thickness * 0.53]
  ];
  const geo = buildLathe(THREE, profile, flutes * 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > radius * 0.92 && Math.abs(y) < thickness * 0.36) {
      const ang = Math.atan2(z, x);
      const ridge = 1 + 0.055 * Math.cos(ang * flutes);
      pos.setX(i, x * ridge);
      pos.setZ(i, z * ridge);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Tactile sculpted wingnut / tightening thumbscrew
function buildWingnut(THREE, mats, scale = 1) {
  const g = new THREE.Group();
  const hubGeo = buildLathe(THREE, [
    [0, 0], [0.0062, 0], [0.0068, 0.0015], [0.0068, 0.003],
    [0.0052, 0.004], [0.0050, 0.0065], [0.0046, 0.0095],
    [0.0036, 0.0115], [0.0022, 0.0124], [0, 0.0126]
  ], 24);
  g.add(tagSlot(new THREE.Mesh(hubGeo, mats.metal), 'metal'));

  const wingShape = new THREE.Shape();
  wingShape.moveTo(-0.003, -0.004);
  wingShape.bezierCurveTo(-0.006, 0.005, -0.013, 0.011, -0.0155, 0.006);
  wingShape.bezierCurveTo(-0.0175, 0.001, -0.012, -0.0045, -0.004, -0.0045);
  wingShape.lineTo(0.004, -0.0045);
  wingShape.bezierCurveTo(0.012, -0.0045, 0.0175, 0.001, 0.0155, 0.006);
  wingShape.bezierCurveTo(0.013, 0.011, 0.006, 0.005, 0.003, -0.004);
  wingShape.closePath();

  const wingGeo = buildBentExtrude(THREE, wingShape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelThickness: 0.0009,
    bevelSize: 0.0008,
    bevelSegments: 3,
    curveSegments: 16
  }, (x, y, z) => [x, y + 0.008, z + Math.sin(x * 95) * 0.0014]);

  const wing = tagSlot(new THREE.Mesh(wingGeo, mats.metal), 'metal');
  wing.position.y = 0.009;
  g.add(wing);

  g.scale.setScalar(scale);
  return g;
}

// Sculpted glowing warm filament bulb + brass socket
function buildFilamentBulb(THREE, mats, tubular = false) {
  const g = new THREE.Group();

  // Brass Edison screw collar
  const socketPts = [
    [0, 0.014], [0.0115, 0.014], [0.0125, 0.011], [0.0118, 0.008],
    [0.0126, 0.005], [0.0118, 0.002], [0.0124, -0.001], [0.0112, -0.004],
    [0.0120, -0.007], [0.0108, -0.010], [0.0095, -0.012], [0, -0.012]
  ];
  const socket = tagSlot(new THREE.Mesh(buildLathe(THREE, socketPts, 24), mats.metal), 'metal', false, false);
  g.add(socket);

  // Sculpted glowing bulb envelope
  const bulbPts = tubular
    ? [
      [0, -0.010], [0.0105, -0.010], [0.0115, -0.015], [0.0122, -0.022],
      [0.0126, -0.032], [0.0126, -0.044], [0.0124, -0.056], [0.0118, -0.066],
      [0.0104, -0.073], [0.0078, -0.078], [0.0042, -0.0805], [0, -0.081]
    ]
    : [
      [0, -0.010], [0.0102, -0.010], [0.0108, -0.014], [0.0125, -0.020],
      [0.0165, -0.027], [0.0208, -0.035], [0.0228, -0.043], [0.0226, -0.051],
      [0.0204, -0.058], [0.0162, -0.0635], [0.0104, -0.0672], [0.0045, -0.069],
      [0, -0.0695]
    ];
  const bulbMesh = tagSlot(new THREE.Mesh(buildLathe(THREE, bulbPts, 32), mats.bulbGlow), 'glow', false, false);
  bulbMesh.userData.glowPulse = true;
  g.add(bulbMesh);

  // Subtle filament loop visible inside warm bulb
  const filCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0035, -0.014, 0),
    new THREE.Vector3(-0.0055, -0.034, 0.002),
    new THREE.Vector3(0, tubular ? -0.060 : -0.048, -0.001),
    new THREE.Vector3(0.0055, -0.034, -0.002),
    new THREE.Vector3(0.0035, -0.014, 0)
  ]);
  const filMesh = tagSlot(new THREE.Mesh(buildTaperedTube(THREE, filCurve, 24, 6, () => 0.0008, true, true), mats.filament), 'glow', false, false);
  g.add(filMesh);

  return g;
}

// Cozy braided fabric cord with strain-relief grommet, optional inline switch, and tiny plug
function buildBraidedCord(THREE, mats, grommetPos, withInlineSwitch = false) {
  const g = new THREE.Group();

  // Strain-relief grommet exiting back of base (-z)
  const gromGeo = buildLathe(THREE, [
    [0, 0], [0.0085, 0], [0.0088, 0.003], [0.0072, 0.0045],
    [0.0068, 0.007], [0.0060, 0.0095], [0.0056, 0.012],
    [0.0050, 0.0145], [0.0046, 0.016], [0, 0.016]
  ], 20);
  gromGeo.rotateX(-Math.PI / 2);
  const grom = tagSlot(new THREE.Mesh(gromGeo, mats.darkTrim), 'accent', true, true);
  grom.position.copy(grommetPos);
  g.add(grom);

  const rCord = 0.0041;
  const pts = [
    new THREE.Vector3(grommetPos.x, grommetPos.y, grommetPos.z + 0.006),
    new THREE.Vector3(grommetPos.x, grommetPos.y, grommetPos.z - 0.018),
    new THREE.Vector3(grommetPos.x + 0.016, 0.0065, grommetPos.z - 0.042),
    new THREE.Vector3(0.056, rCord + 0.0002, grommetPos.z - 0.052),
    new THREE.Vector3(0.102, rCord + 0.0002, grommetPos.z - 0.022),
    new THREE.Vector3(0.116, rCord + 0.0002, grommetPos.z + 0.026),
    new THREE.Vector3(0.128, rCord + 0.0002, grommetPos.z + 0.004)
  ];
  const cordCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.45);
  const cordGeo = buildTaperedTube(THREE, cordCurve, 84, 12, () => rCord, true, true);
  const cordMesh = tagSlot(new THREE.Mesh(cordGeo, mats.cord), 'accent', true, true);
  g.add(cordMesh);

  // Optional inline tactile switch resting on the desk along the cord
  if (withInlineSwitch) {
    const swPos = cordCurve.getPoint(0.47);
    const swTan = cordCurve.getTangent(0.47);
    const swGroup = new THREE.Group();
    swGroup.position.set(swPos.x, 0.0075, swPos.z);
    swGroup.rotation.y = Math.atan2(swTan.x, swTan.z);

    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-0.0075, -0.016);
    bodyShape.bezierCurveTo(-0.0095, -0.016, -0.0095, 0.016, -0.0075, 0.016);
    bodyShape.bezierCurveTo(-0.003, 0.018, 0.003, 0.018, 0.0075, 0.016);
    bodyShape.bezierCurveTo(0.0095, 0.016, 0.0095, -0.016, 0.0075, -0.016);
    bodyShape.bezierCurveTo(0.003, -0.018, -0.003, -0.018, -0.0075, -0.016);

    const housingGeo = buildBentExtrude(THREE, bodyShape, {
      depth: 0.0105,
      bevelEnabled: true,
      bevelThickness: 0.0022,
      bevelSize: 0.0020,
      bevelSegments: 3,
      curveSegments: 16
    });
    housingGeo.rotateX(Math.PI / 2);
    swGroup.add(tagSlot(new THREE.Mesh(housingGeo, mats.darkTrim), 'accent'));

    // Tiny brass rocker button on top
    const rockShape = new THREE.Shape();
    rockShape.moveTo(-0.0035, -0.0065);
    rockShape.lineTo(0.0035, -0.0065);
    rockShape.lineTo(0.0035, 0.0065);
    rockShape.lineTo(-0.0035, 0.0065);
    rockShape.closePath();
    const rockGeo = buildBentExtrude(THREE, rockShape, {
      depth: 0.0035,
      bevelEnabled: true,
      bevelThickness: 0.0008,
      bevelSize: 0.0007,
      bevelSegments: 2
    }, (x, y, z) => [x, y, z + y * 0.22]);
    rockGeo.rotateX(Math.PI / 2);
    const rock = tagSlot(new THREE.Mesh(rockGeo, mats.metal), 'metal');
    rock.position.y = 0.0065;
    swGroup.add(rock);

    g.add(swGroup);
  }

  // Tiny vintage moulded plug at the tail end
  const endPt = cordCurve.getPoint(1);
  const endTan = cordCurve.getTangent(1);
  const plugGroup = new THREE.Group();
  plugGroup.position.set(endPt.x, 0.0062, endPt.z);
  plugGroup.rotation.y = Math.atan2(endTan.x, endTan.z);

  const plugShape = new THREE.Shape();
  plugShape.moveTo(-0.0055, -0.009);
  plugShape.bezierCurveTo(-0.008, -0.006, -0.0085, 0.007, -0.006, 0.009);
  plugShape.lineTo(0.006, 0.009);
  plugShape.bezierCurveTo(0.0085, 0.007, 0.008, -0.006, 0.0055, -0.009);
  plugShape.closePath();
  const plugGeo = buildBentExtrude(THREE, plugShape, {
    depth: 0.0085,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0016,
    bevelSegments: 3
  });
  plugGeo.rotateX(Math.PI / 2);
  const plugBody = tagSlot(new THREE.Mesh(plugGeo, mats.darkTrim), 'accent');
  plugBody.position.z = 0.008;
  plugGroup.add(plugBody);

  // Two tiny brass prongs
  const prongGeo = new THREE.BoxGeometry(0.0014, 0.0036, 0.011);
  for (const sx of [-0.0032, 0.0032]) {
    const prong = tagSlot(new THREE.Mesh(prongGeo, mats.metal), 'metal');
    prong.position.set(sx, 0, 0.020);
    plugGroup.add(prong);
  }
  g.add(plugGroup);

  return g;
}

// Slotted beveled link strut between two 3D points (parallel to YZ plane, offset along X)
function buildArmStrut(THREE, pA, pB, width, thickness, mat, slot = 'metal') {
  const dir = new THREE.Vector3().subVectors(pB, pA);
  const len = dir.length();
  const r = width * 0.5;
  const shape = new THREE.Shape();
  shape.absarc(0, len * 0.5, r, 0, Math.PI, false);
  shape.absarc(0, -len * 0.5, r, Math.PI, Math.PI * 2, false);
  shape.closePath();

  const geo = buildBentExtrude(THREE, shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.25,
    bevelSize: thickness * 0.22,
    bevelSegments: 2,
    curveSegments: 14
  });
  // Rotate so thin face normal points along X, length along Y
  geo.rotateY(Math.PI / 2);

  const mesh = tagSlot(new THREE.Mesh(geo, mat), slot);
  const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
  mesh.position.copy(mid);
  const yAxis = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(yAxis, dir.clone().normalize());
  return mesh;
}

// ============================================================================
// VARIANT 0: STYLISED ARCHITECT LAMP
// ============================================================================
function buildArchitectLamp(THREE, root, mats) {
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // 1. Weighted Domed Base (26-point LatheGeometry)
  const feltGeo = buildLathe(THREE, [
    [0, 0], [0.088, 0], [0.090, 0.0015], [0.089, 0.0032], [0, 0.0032]
  ], 48);
  body.add(tagSlot(new THREE.Mesh(feltGeo, mats.felt), null, true, true));

  const baseProfile = [
    [0.088, 0.0025], [0.094, 0.0035], [0.096, 0.0065], [0.096, 0.0115],
    [0.0945, 0.0155], [0.090, 0.0195], [0.084, 0.023], [0.077, 0.026],
    [0.068, 0.0285], [0.058, 0.0308], [0.048, 0.0325], [0.038, 0.0338],
    [0.031, 0.0348], [0.027, 0.036], [0.025, 0.0372], [0.023, 0.0375],
    [0.020, 0.0375], [0, 0.0375]
  ];
  body.add(tagSlot(new THREE.Mesh(buildLathe(THREE, baseProfile, 56), mats.primary), 'primary'));

  // Brass skirt accent ring & turret collar
  const turretProfile = [
    [0.026, 0.0345], [0.0275, 0.0365], [0.0265, 0.0385], [0.0225, 0.0398],
    [0.0215, 0.043], [0.0228, 0.045], [0.0215, 0.047], [0.0185, 0.0485],
    [0.0175, 0.052], [0.0165, 0.054], [0, 0.054]
  ];
  body.add(tagSlot(new THREE.Mesh(buildLathe(THREE, turretProfile, 40), mats.metal), 'metal'));

  // Tactile recessed front switch on base skirt (+z)
  const switchGroup = new THREE.Group();
  switchGroup.position.set(0, 0.0245, 0.068);
  switchGroup.rotation.x = 0.42;

  const bezelGeo = buildLathe(THREE, [
    [0, 0], [0.0125, 0], [0.013, 0.002], [0.0118, 0.0036],
    [0.0095, 0.0038], [0.0085, 0.0022], [0, 0.0022]
  ], 28);
  switchGroup.add(tagSlot(new THREE.Mesh(bezelGeo, mats.metal), 'metal'));

  const btnShape = new THREE.Shape();
  btnShape.absellipse(0, 0, 0.0072, 0.0056, 0, Math.PI * 2, false, 0);
  const btnGeo = buildBentExtrude(THREE, btnShape, {
    depth: 0.0052,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 20
  }, (x, y, z) => [x, y, z + y * 0.25]);
  btnGeo.rotateX(Math.PI / 2);
  const btn = tagSlot(new THREE.Mesh(btnGeo, mats.accent), 'accent');
  btn.position.y = 0.0046;
  switchGroup.add(btn);
  body.add(switchGroup);

  // 2. Jointed Arm Geometry & Hinges
  const P0 = new THREE.Vector3(0, 0.062, 0.0);
  const P0b = new THREE.Vector3(0, 0.055, -0.020);
  const P1 = new THREE.Vector3(0, 0.246, -0.078);
  const P1b = new THREE.Vector3(0, 0.239, -0.098);
  const P2 = new THREE.Vector3(0, 0.414, 0.048);

  // Base hinge clevis plates (left & right)
  const clevisShape = new THREE.Shape();
  clevisShape.moveTo(-0.012, -0.014);
  clevisShape.lineTo(0.024, -0.014);
  clevisShape.bezierCurveTo(0.028, -0.010, 0.028, 0.004, 0.022, 0.006);
  clevisShape.lineTo(0.009, 0.012);
  clevisShape.bezierCurveTo(0.002, 0.016, -0.009, 0.014, -0.011, 0.004);
  clevisShape.closePath();

  const clevisGeo = buildBentExtrude(THREE, clevisShape, {
    depth: 0.0032,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0007,
    bevelSegments: 2
  });
  clevisGeo.rotateY(Math.PI / 2);

  for (const sx of [-0.0135, 0.0135]) {
    const plate = tagSlot(new THREE.Mesh(clevisGeo, mats.metal), 'metal');
    plate.position.set(sx, 0.061, -0.007);
    body.add(plate);
  }

  // Base hinge axle + washers + sculpted wingnut
  const axleGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.036, 20);
  axleGeo.rotateZ(Math.PI / 2);
  const lowerAxle = tagSlot(new THREE.Mesh(axleGeo, mats.metal), 'metal');
  lowerAxle.position.copy(P0);
  body.add(lowerAxle);

  const lowerNut = buildWingnut(THREE, mats, 0.95);
  lowerNut.position.set(0.0175, P0.y, P0.z);
  lowerNut.rotation.z = -Math.PI / 2;
  body.add(lowerNut);

  // Lower parallel 4-bar struts (main pair + rear companion pair)
  for (const sx of [-0.0105, 0.0105]) {
    const a1 = P0.clone(); a1.x = sx;
    const b1 = P1.clone(); b1.x = sx;
    body.add(buildArmStrut(THREE, a1, b1, 0.0115, 0.0036, mats.metal, 'metal'));

    const a2 = P0b.clone(); a2.x = sx * 0.9;
    const b2 = P1b.clone(); b2.x = sx * 0.9;
    body.add(buildArmStrut(THREE, a2, b2, 0.0078, 0.0028, mats.metal, 'metal'));
  }

  // Spring-catch stud bar across the lower arm
  const springHookPt = new THREE.Vector3().lerpVectors(P0, P1, 0.64);
  springHookPt.z += 0.004;
  const studGeo = new THREE.CylinderGeometry(0.0024, 0.0024, 0.048, 14);
  studGeo.rotateZ(Math.PI / 2);
  const studBar = tagSlot(new THREE.Mesh(studGeo, mats.metal), 'metal');
  studBar.position.copy(springHookPt);
  body.add(studBar);

  // Rear base spring anchor bar
  const baseAnchorPt = new THREE.Vector3(0, 0.054, -0.025);
  const anchorBar = tagSlot(new THREE.Mesh(studGeo, mats.metal), 'metal');
  anchorBar.position.copy(baseAnchorPt);
  body.add(anchorBar);

  // Twin iconic coiled architect tension springs (left & right)
  for (const sx of [-0.0215, 0.0215]) {
    const sA = baseAnchorPt.clone(); sA.x = sx;
    const sB = springHookPt.clone(); sB.x = sx;
    const sprGeo = buildHelixSpring(THREE, sA, sB, 0.0052, 0.00105, 16);
    body.add(tagSlot(new THREE.Mesh(sprGeo, mats.spring), 'metal'));
  }

  // Elbow Joint Assembly at P1
  const elbowShape = new THREE.Shape();
  elbowShape.absarc(0, 0, 0.0125, -Math.PI * 0.35, Math.PI * 0.72, false);
  elbowShape.absarc(0.020, -0.007, 0.0085, Math.PI * 0.72, Math.PI * 1.85, false);
  elbowShape.closePath();
  const elbowPlateGeo = buildBentExtrude(THREE, elbowShape, {
    depth: 0.0034,
    bevelEnabled: true,
    bevelThickness: 0.0009,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 18
  });
  elbowPlateGeo.rotateY(Math.PI / 2);

  for (const sx of [-0.0145, 0.0145]) {
    const ep = tagSlot(new THREE.Mesh(elbowPlateGeo, mats.metal), 'metal');
    ep.position.set(sx, P1.y - 0.003, P1.z - 0.009);
    body.add(ep);
  }

  const elbowAxle = tagSlot(new THREE.Mesh(axleGeo, mats.metal), 'metal');
  elbowAxle.position.copy(P1);
  body.add(elbowAxle);

  // Tactile knurled brass locking knob on the elbow (+x side)
  const elbowKnobGeo = buildKnurledKnob(THREE, 0.0125, 0.0095, 22);
  elbowKnobGeo.rotateZ(-Math.PI / 2);
  const elbowKnob = tagSlot(new THREE.Mesh(elbowKnobGeo, mats.accent), 'accent');
  elbowKnob.position.set(0.022, P1.y, P1.z);
  body.add(elbowKnob);

  // Secondary compact tension spring spanning the elbow quadrant
  const elbSprA = new THREE.Vector3().lerpVectors(P0b, P1b, 0.80);
  const elbSprB = new THREE.Vector3().lerpVectors(P1, P2, 0.28);
  const elbStudGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.039, 12);
  elbStudGeo.rotateZ(Math.PI / 2);
  const elbStudA = tagSlot(new THREE.Mesh(elbStudGeo, mats.metal), 'metal');
  elbStudA.position.copy(elbSprA);
  body.add(elbStudA);
  const elbStudB = tagSlot(new THREE.Mesh(elbStudGeo, mats.metal), 'metal');
  elbStudB.position.copy(elbSprB);
  body.add(elbStudB);

  for (const sx of [-0.0185, 0.0185]) {
    const sA = elbSprA.clone(); sA.x = sx;
    const sB = elbSprB.clone(); sB.x = sx;
    const sGeo = buildHelixSpring(THREE, sA, sB, 0.0040, 0.0009, 11);
    body.add(tagSlot(new THREE.Mesh(sGeo, mats.spring), 'metal'));
  }

  // Upper Parallel Arm from P1 to P2
  for (const sx of [-0.0095, 0.0095]) {
    const uA = P1.clone(); uA.x = sx;
    const uB = P2.clone(); uB.x = sx;
    body.add(buildArmStrut(THREE, uA, uB, 0.0095, 0.0032, mats.metal, 'metal'));
  }

  // Cross-spacer & tiny cable guide clips along upper arm
  for (const t of [0.38, 0.72]) {
    const cp = new THREE.Vector3().lerpVectors(P1, P2, t);
    const clip = tagSlot(new THREE.Mesh(
      new THREE.CylinderGeometry(0.0034, 0.0034, 0.022, 14).rotateZ(Math.PI / 2),
      mats.metal
    ), 'metal');
    clip.position.copy(cp);
    body.add(clip);
  }

  // Subtle braided jumper wire looping cleanly along the articulated arm into the shade
  const armWireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.036, -0.022),
    new THREE.Vector3(0, 0.140, -0.068),
    new THREE.Vector3(0, 0.242, -0.114),
    new THREE.Vector3(0, 0.312, -0.038),
    new THREE.Vector3(0, 0.372, 0.010),
    new THREE.Vector3(0, 0.418, 0.028)
  ]);
  body.add(tagSlot(new THREE.Mesh(buildTaperedTube(THREE, armWireCurve, 44, 8, () => 0.0026, true, true), mats.cord), 'accent'));

  // 3. Head / Shade Group pivoted at P2
  const head = new THREE.Group();
  head.name = 'head';
  head.position.copy(P2);
  head.rotation.x = -0.54; // Aims shade mouth warmly down and forward (+z)
  root.add(head);

  // Wrist swivel yoke & tightening thumbscrew
  const wristAxle = tagSlot(new THREE.Mesh(
    new THREE.CylinderGeometry(0.0038, 0.0038, 0.030, 18).rotateZ(Math.PI / 2),
    mats.metal
  ), 'metal');
  head.add(wristAxle);

  const wristNut = buildWingnut(THREE, mats, 0.8);
  wristNut.position.set(0.0145, 0, 0);
  wristNut.rotation.z = -Math.PI / 2;
  head.add(wristNut);

  const neckCollar = tagSlot(new THREE.Mesh(buildLathe(THREE, [
    [0, 0.012], [0.013, 0.012], [0.015, 0.005], [0.018, -0.002],
    [0.022, -0.006], [0, -0.006]
  ], 32), mats.metal), 'metal');
  neckCollar.position.y = 0.022;
  head.add(neckCollar);

  // Outer Sculpted Bell Shade (28-point LatheGeometry with rolled rim & chimney cap)
  const shadeOuterPts = [
    [0.084, -0.104], [0.0875, -0.1055], [0.090, -0.1045], [0.091, -0.1015],
    [0.089, -0.097], [0.085, -0.088], [0.079, -0.076], [0.072, -0.062],
    [0.064, -0.048], [0.056, -0.034], [0.048, -0.021], [0.041, -0.010],
    [0.0355, -0.001], [0.0335, 0.005], [0.0348, 0.0085], [0.0332, 0.012],
    [0.0305, 0.019], [0.0295, 0.026], [0.0285, 0.032], [0.0255, 0.0365],
    [0.020, 0.0392], [0.013, 0.0408], [0.006, 0.0415], [0, 0.0418]
  ];
  head.add(tagSlot(new THREE.Mesh(buildLathe(THREE, shadeOuterPts, 60), mats.primary), 'primary'));

  // Brass decorative accent band around the shade waist
  const bandPts = [
    [0.0335, 0.004], [0.036, 0.0055], [0.0362, 0.0095], [0.0335, 0.011]
  ];
  head.add(tagSlot(new THREE.Mesh(buildLathe(THREE, bandPts, 48), mats.metal), 'metal'));

  // Curved cooling vent fins + warm glowing vent ring on the chimney cap
  const ventGlowGeo = new THREE.CylinderGeometry(0.0282, 0.0292, 0.011, 32, 1, true);
  const ventGlow = tagSlot(new THREE.Mesh(ventGlowGeo, mats.innerGlow), 'glow', false, false);
  ventGlow.position.y = 0.024;
  ventGlow.userData.glowPulse = true;
  head.add(ventGlow);

  const finShape = new THREE.Shape();
  finShape.moveTo(-0.0018, -0.008);
  finShape.bezierCurveTo(-0.0022, 0, -0.0022, 0.006, 0, 0.008);
  finShape.bezierCurveTo(0.0022, 0.006, 0.0022, 0, 0.0018, -0.008);
  finShape.closePath();
  const finGeo = buildBentExtrude(THREE, finShape, {
    depth: 0.0022,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0004,
    bevelSegments: 2
  }, (x, y, z) => [x, y, z - Math.abs(y) * 0.16]);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const fin = tagSlot(new THREE.Mesh(finGeo, mats.primary), 'primary');
    fin.position.set(Math.sin(a) * 0.0305, 0.024, Math.cos(a) * 0.0305);
    fin.rotation.y = a;
    head.add(fin);
  }

  // Inner Emissive Reflector (profile ordered top-to-bottom so normals face inward)
  const innerPts = [
    [0, 0.006], [0.018, 0.005], [0.031, 0.001], [0.037, -0.009],
    [0.0445, -0.021], [0.0525, -0.034], [0.0605, -0.048], [0.0685, -0.062],
    [0.0755, -0.076], [0.0815, -0.089], [0.0855, -0.099], [0.086, -0.1035]
  ];
  const innerShade = tagSlot(new THREE.Mesh(buildLathe(THREE, innerPts, 52), mats.innerGlow), 'glow', false, false);
  innerShade.userData.glowPulse = true;
  head.add(innerShade);

  // Glowing Filament Bulb inside shade
  const bulb = buildFilamentBulb(THREE, mats, false);
  bulb.position.y = -0.002;
  head.add(bulb);

  // 4. Braided Cord resting on the floor
  const tail = buildBraidedCord(THREE, mats, new THREE.Vector3(0, 0.013, -0.091), false);
  tail.name = 'tail';
  root.add(tail);

  return {
    lightPos: new THREE.Vector3(0, 0.305, 0.122),
    pullChain: null
  };
}

// ============================================================================
// VARIANT 1: MUSHROOM LAMP WITH GLASS DOME
// ============================================================================
function buildMushroomLamp(THREE, root, mats) {
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // 1. Weighted Tulip/Amphora Sculpted Base (28-point LatheGeometry)
  const feltGeo = buildLathe(THREE, [
    [0, 0], [0.088, 0], [0.090, 0.0015], [0.089, 0.0032], [0, 0.0032]
  ], 48);
  body.add(tagSlot(new THREE.Mesh(feltGeo, mats.felt), null, true, true));

  const baseProfile = [
    [0.088, 0.0025], [0.093, 0.004], [0.0955, 0.0085], [0.096, 0.015],
    [0.094, 0.024], [0.0895, 0.035], [0.083, 0.048], [0.074, 0.062],
    [0.063, 0.077], [0.052, 0.092], [0.043, 0.107], [0.0375, 0.120],
    [0.035, 0.132], [0.0355, 0.144], [0.0375, 0.154], [0.039, 0.161],
    [0.037, 0.165], [0.030, 0.166], [0, 0.166]
  ];
  body.add(tagSlot(new THREE.Mesh(buildLathe(THREE, baseProfile, 56), mats.primary), 'primary'));

  // Brass lower foot bead & upper mounting collar
  const footTrim = buildLathe(THREE, [
    [0.094, 0.003], [0.0975, 0.0055], [0.0975, 0.0095], [0.0945, 0.0115]
  ], 56);
  body.add(tagSlot(new THREE.Mesh(footTrim, mats.metal), 'metal'));

  const collarProfile = [
    [0.036, 0.158], [0.041, 0.161], [0.0415, 0.167], [0.038, 0.171],
    [0.027, 0.174], [0.022, 0.179], [0.019, 0.188], [0.0175, 0.198],
    [0.016, 0.204], [0, 0.204]
  ];
  body.add(tagSlot(new THREE.Mesh(buildLathe(THREE, collarProfile, 44), mats.metal), 'metal'));

  // Front rotary brass dimmer dial + tiny glowing pilot dot
  const dimmerGroup = new THREE.Group();
  dimmerGroup.position.set(0, 0.049, 0.079);
  dimmerGroup.rotation.x = 0.44;

  const escutcheon = buildLathe(THREE, [
    [0, 0], [0.0155, 0], [0.016, 0.002], [0.0138, 0.0042], [0, 0.0042]
  ], 32);
  escutcheon.rotateX(Math.PI / 2);
  dimmerGroup.add(tagSlot(new THREE.Mesh(escutcheon, mats.metal), 'metal'));

  const dialGeo = buildKnurledKnob(THREE, 0.0118, 0.011, 26);
  dialGeo.rotateX(Math.PI / 2);
  const dial = tagSlot(new THREE.Mesh(dialGeo, mats.accent), 'accent');
  dial.position.z = 0.0085;
  dimmerGroup.add(dial);

  // Tiny warm pilot indicator jewel above the dimmer
  const jewel = tagSlot(new THREE.Mesh(new THREE.SphereGeometry(0.0024, 16, 12), mats.bulbGlow), 'glow', false, false);
  jewel.position.set(0, 0.0195, 0.0015);
  jewel.userData.glowPulse = true;
  dimmerGroup.add(jewel);
  body.add(dimmerGroup);

  // 2. Visible Brass Articulated Hinge & Exposed Tension Spring
  const P_hinge = new THREE.Vector3(0, 0.214, 0);

  const clevisShape = new THREE.Shape();
  clevisShape.moveTo(-0.011, -0.015);
  clevisShape.lineTo(0.011, -0.015);
  clevisShape.lineTo(0.011, 0.004);
  clevisShape.absarc(0, 0.004, 0.011, 0, Math.PI, false);
  clevisShape.closePath();

  const clevisGeo = buildBentExtrude(THREE, clevisShape, {
    depth: 0.0036,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0007,
    bevelSegments: 2
  });
  clevisGeo.rotateY(Math.PI / 2);

  for (const sx of [-0.013, 0.013]) {
    const cheek = tagSlot(new THREE.Mesh(clevisGeo, mats.metal), 'metal');
    cheek.position.set(sx, P_hinge.y - 0.005, 0);
    body.add(cheek);
  }

  const hingeAxle = tagSlot(new THREE.Mesh(
    new THREE.CylinderGeometry(0.0044, 0.0044, 0.036, 20).rotateZ(Math.PI / 2),
    mats.metal
  ), 'metal');
  hingeAxle.position.copy(P_hinge);
  body.add(hingeAxle);

  const hingeThumb = buildKnurledKnob(THREE, 0.0105, 0.008, 22);
  hingeThumb.rotateZ(-Math.PI / 2);
  const thumbMesh = tagSlot(new THREE.Mesh(hingeThumb, mats.accent), 'accent');
  thumbMesh.position.set(0.0205, P_hinge.y, 0);
  body.add(thumbMesh);

  // Exposed rear brass coil spring stabilizing the nodding dome
  const sprStart = new THREE.Vector3(0, 0.172, -0.027);
  const sprEnd = new THREE.Vector3(0, 0.256, -0.029);
  const sprLugGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.012, 14).rotateX(Math.PI / 2);
  const lugBottom = tagSlot(new THREE.Mesh(sprLugGeo, mats.metal), 'metal');
  lugBottom.position.set(0, 0.172, -0.021);
  body.add(lugBottom);

  const sprGeo = buildHelixSpring(THREE, sprStart, sprEnd, 0.0056, 0.0011, 13);
  body.add(tagSlot(new THREE.Mesh(sprGeo, mats.spring), 'metal'));

  // 3. Nodding Glass Mushroom Dome Head Group
  const head = new THREE.Group();
  head.name = 'head';
  head.position.copy(P_hinge);
  head.rotation.x = -0.17; // Gentle cozy nod toward +z
  root.add(head);

  // Upper articulated stem inside head space
  const upperStem = buildLathe(THREE, [
    [0, -0.006], [0.009, -0.006], [0.010, 0.008], [0.011, 0.022],
    [0.0135, 0.038], [0.0155, 0.056], [0.018, 0.072], [0.022, 0.082],
    [0.019, 0.088], [0, 0.088]
  ], 32);
  head.add(tagSlot(new THREE.Mesh(upperStem, mats.metal), 'metal'));

  const lugTop = tagSlot(new THREE.Mesh(sprLugGeo, mats.metal), 'metal');
  lugTop.position.set(0, 0.044, -0.017);
  head.add(lugTop);

  // Three curved brass spider spokes supporting the glass dome from inside
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const spCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.sin(a) * 0.016, 0.078, Math.cos(a) * 0.016),
      new THREE.Vector3(Math.sin(a) * 0.068, 0.084, Math.cos(a) * 0.068),
      new THREE.Vector3(Math.sin(a) * 0.118, 0.074, Math.cos(a) * 0.118),
      new THREE.Vector3(Math.sin(a) * 0.145, 0.060, Math.cos(a) * 0.145)
    ]);
    head.add(tagSlot(new THREE.Mesh(buildTaperedTube(THREE, spCurve, 20, 8, (t) => 0.0028 - t * 0.0006, true, true), mats.metal), 'metal'));
  }

  // Sculpted Glowing Glass Mushroom Dome (32-point LatheGeometry)
  const domeOuterPts = [
    [0.148, 0.056], [0.153, 0.0545], [0.1575, 0.057], [0.1615, 0.063],
    [0.165, 0.072], [0.167, 0.083], [0.1665, 0.095], [0.1635, 0.109],
    [0.1575, 0.124], [0.1485, 0.139], [0.1365, 0.154], [0.1215, 0.168],
    [0.104, 0.181], [0.0845, 0.192], [0.064, 0.2015], [0.044, 0.2085],
    [0.025, 0.213], [0.010, 0.2155], [0, 0.216]
  ];
  const glassDome = tagSlot(new THREE.Mesh(buildLathe(THREE, domeOuterPts, 64), mats.glassShade), 'primary');
  glassDome.userData.glowPulse = true;
  head.add(glassDome);

  // Inner Emissive Frosted Diffuser Lining (top-to-bottom profile -> inward normals)
  const domeInnerPts = [
    [0, 0.210], [0.024, 0.207], [0.058, 0.197], [0.094, 0.180],
    [0.125, 0.157], [0.147, 0.129], [0.158, 0.100], [0.160, 0.076],
    [0.154, 0.061], [0.148, 0.0565]
  ];
  const innerDome = tagSlot(new THREE.Mesh(buildLathe(THREE, domeInnerPts, 56), mats.innerGlow), 'glow', false, false);
  innerDome.userData.glowPulse = true;
  head.add(innerDome);

  // Turned brass crown finial capping the mushroom dome
  const finialPts = [
    [0, 0.214], [0.017, 0.214], [0.0185, 0.216], [0.0155, 0.2195],
    [0.010, 0.222], [0.0115, 0.226], [0.0095, 0.230], [0.005, 0.2325], [0, 0.233]
  ];
  head.add(tagSlot(new THREE.Mesh(buildLathe(THREE, finialPts, 36), mats.metal), 'metal'));

  // Warm Edison bulb rising inside the frosted dome
  const bulb = buildFilamentBulb(THREE, mats, false);
  bulb.position.y = 0.088;
  bulb.rotation.x = Math.PI; // Upright inside the mushroom dome
  head.add(bulb);

  // 4. Braided Cord with Inline Tactile Switch
  const tail = buildBraidedCord(THREE, mats, new THREE.Vector3(0, 0.014, -0.092), true);
  tail.name = 'tail';
  root.add(tail);

  return {
    lightPos: new THREE.Vector3(0, 0.242, 0.052),
    pullChain: null
  };
}

// ============================================================================
// VARIANT 2: BANKER'S LAMP WITH GREEN GLASS SHADE
// ============================================================================
function buildBankerHoodGeo(THREE, hx, hz, height, inset = 0, inward = false) {
  // Dense SphereGeometry deformed into a smooth hand-blown rounded-trapezoid glass hood
  const thetaMax = inward ? Math.PI * 0.50 : Math.PI * 0.545;
  const geo = new THREE.SphereGeometry(1, 64, 34, 0, Math.PI * 2, 0, thetaMax);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const wHalf = hx - inset;
  const dHalf = hz - inset;
  const hMax = height - inset;

  for (let i = 0; i < pos.count; i++) {
    const ox = pos.getX(i);
    const oy = pos.getY(i);
    const oz = pos.getZ(i);

    const phi = Math.acos(Math.max(-1, Math.min(1, oy))); // 0 at crown, ~pi/2 at rim
    const u = phi / (Math.PI * 0.5); // 0..~1.09
    const uc = Math.min(1, u);
    const theta = Math.atan2(oz, ox);

    // Smoothly morph squircle exponent from 2.0 at top pole (no pinch) to 3.8 at rim
    const n = 2.0 + 1.8 * Math.pow(uc, 0.7);
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const sx = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n);
    const sz = Math.sign(st) * Math.pow(Math.abs(st), 2 / n);

    // Classic banker's canopy silhouette: slightly tapered top, generous curved barrel, subtle rolled lip
    const roll = u > 1 ? Math.sin((u - 1) * Math.PI * 5.2) * 0.0045 : 0;
    const rx = (wHalf * (0.76 + 0.24 * Math.pow(uc, 0.65)) * Math.pow(Math.sin(uc * Math.PI * 0.5), 0.52)) - roll;
    const rz = (dHalf * Math.pow(Math.sin(uc * Math.PI * 0.5), 0.78)) - roll;

    let y;
    if (u <= 1) {
      y = hMax * Math.pow(Math.cos(uc * Math.PI * 0.5), 0.86) - 0.022;
    } else {
      // Smoothly tuck rolled glass rim edge slightly inward & up
      const over = (u - 1) / 0.09;
      y = -0.022 - Math.sin(over * Math.PI) * 0.0032 + over * 0.0025;
    }

    // Subtle hand-blown crown bow along X
    const crownBow = (1 - uc) * 0.004 * (1 - sx * sx);
    pos.setXYZ(i, sx * rx, y + crownBow, sz * rz);
    uv.setXY(i, (theta + Math.PI) / (Math.PI * 2), uc);
  }

  if (inward) {
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildBankersLamp(THREE, root, mats) {
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // 1. Weighted Vintage Stepped Brass Base (30-point LatheGeometry)
  const feltGeo = buildLathe(THREE, [
    [0, 0], [0.092, 0], [0.094, 0.0015], [0.093, 0.0032], [0, 0.0032]
  ], 52);
  body.add(tagSlot(new THREE.Mesh(feltGeo, mats.felt), null, true, true));

  const baseProfile = [
    [0.092, 0.0025], [0.0975, 0.004], [0.099, 0.0075], [0.0985, 0.012],
    [0.094, 0.0155], [0.089, 0.0175], [0.0875, 0.020], [0.089, 0.0225],
    [0.084, 0.0255], [0.076, 0.0285], [0.067, 0.0315], [0.056, 0.0345],
    [0.044, 0.037], [0.034, 0.039], [0.026, 0.041], [0.022, 0.0435],
    [0.0235, 0.0465], [0.020, 0.049], [0.0165, 0.053], [0.0155, 0.058],
    [0.0175, 0.062], [0.015, 0.065], [0.012, 0.0665], [0, 0.0665]
  ];
  body.add(tagSlot(new THREE.Mesh(buildLathe(THREE, baseProfile, 60), mats.metal), 'metal'));

  // Subtle decorative beaded ring on the stepped base terrace
  const beadRing = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(0.0885, 0.0022, 12, 48), mats.accent), 'accent');
  beadRing.rotation.x = Math.PI / 2;
  beadRing.position.y = 0.0205;
  body.add(beadRing);

  // 2. Jointed Vintage Brass Arm with Visible Hinges & Exposed Spring
  const P0 = new THREE.Vector3(0, 0.072, -0.004);
  const P1 = new THREE.Vector3(0, 0.262, -0.070);
  const P2 = new THREE.Vector3(0, 0.382, 0.012);
  const P_shade = new THREE.Vector3(0, 0.370, 0.042);

  // Lower brass knuckle hinge
  const knuckleShape = new THREE.Shape();
  knuckleShape.moveTo(-0.010, -0.012);
  knuckleShape.lineTo(0.012, -0.012);
  knuckleShape.lineTo(0.012, 0.004);
  knuckleShape.absarc(0, 0.004, 0.011, 0, Math.PI, false);
  knuckleShape.closePath();
  const knuckleGeo = buildBentExtrude(THREE, knuckleShape, {
    depth: 0.0035,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0007,
    bevelSegments: 2
  });
  knuckleGeo.rotateY(Math.PI / 2);

  for (const sx of [-0.0105, 0.0105]) {
    const kn = tagSlot(new THREE.Mesh(knuckleGeo, mats.metal), 'metal');
    kn.position.set(sx, P0.y - 0.004, P0.z);
    body.add(kn);
  }

  const pinGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.032, 18).rotateZ(Math.PI / 2);
  const lowerPin = tagSlot(new THREE.Mesh(pinGeo, mats.metal), 'metal');
  lowerPin.position.copy(P0);
  body.add(lowerPin);

  const lowerWheel = buildKnurledKnob(THREE, 0.0095, 0.007, 20);
  lowerWheel.rotateZ(-Math.PI / 2);
  const lwMesh = tagSlot(new THREE.Mesh(lowerWheel, mats.accent), 'accent');
  lwMesh.position.set(0.0175, P0.y, P0.z);
  body.add(lwMesh);

  // Gracefully curved lower vintage brass stem (tapered CatmullRom tube)
  const lowerCurve = new THREE.CatmullRomCurve3([
    P0.clone(),
    new THREE.Vector3(0, 0.135, -0.046),
    new THREE.Vector3(0, 0.205, -0.068),
    P1.clone()
  ]);
  body.add(tagSlot(new THREE.Mesh(
    buildTaperedTube(THREE, lowerCurve, 36, 16, (t) => 0.0085 - t * 0.0018, true, true),
    mats.metal
  ), 'metal'));

  // Exposed vintage brass coil tension spring spanning behind the lower knuckle
  const sprA = new THREE.Vector3(0, 0.056, -0.025);
  const sprB = new THREE.Vector3(0, 0.158, -0.066);
  const sprCollar = tagSlot(new THREE.Mesh(
    new THREE.CylinderGeometry(0.0102, 0.0102, 0.008, 20),
    mats.metal
  ), 'metal');
  sprCollar.position.set(0, 0.158, -0.054);
  sprCollar.rotation.x = -0.32;
  body.add(sprCollar);
  body.add(tagSlot(new THREE.Mesh(buildHelixSpring(THREE, sprA, sprB, 0.0050, 0.0010, 14), mats.spring), 'metal'));

  // Ornate Elbow Hinge at P1
  for (const sx of [-0.0115, 0.0115]) {
    const disc = tagSlot(new THREE.Mesh(
      new THREE.CylinderGeometry(0.0125, 0.0125, 0.0038, 28).rotateZ(Math.PI / 2),
      mats.metal
    ), 'metal');
    disc.position.set(sx, P1.y, P1.z);
    body.add(disc);
  }
  const elbowPin = tagSlot(new THREE.Mesh(pinGeo, mats.metal), 'metal');
  elbowPin.position.copy(P1);
  body.add(elbowPin);

  const elbowWheel = buildKnurledKnob(THREE, 0.0122, 0.0085, 24);
  elbowWheel.rotateZ(-Math.PI / 2);
  const ewMesh = tagSlot(new THREE.Mesh(elbowWheel, mats.accent), 'accent');
  ewMesh.position.set(0.019, P1.y, P1.z);
  body.add(ewMesh);

  // Curved upper swan-neck arm from P1 to yoke hub P2
  const upperCurve = new THREE.CatmullRomCurve3([
    P1.clone(),
    new THREE.Vector3(0, 0.328, -0.064),
    new THREE.Vector3(0, 0.376, -0.032),
    P2.clone()
  ]);
  body.add(tagSlot(new THREE.Mesh(
    buildTaperedTube(THREE, upperCurve, 34, 16, (t) => 0.0068 - t * 0.0008, true, true),
    mats.metal
  ), 'metal'));

  // Turned brass yoke hub at P2
  const hubGeo = buildLathe(THREE, [
    [0, -0.008], [0.008, -0.008], [0.0105, -0.004], [0.011, 0.004],
    [0.0085, 0.0085], [0, 0.009]
  ], 28);
  const yokeHub = tagSlot(new THREE.Mesh(hubGeo, mats.metal), 'metal');
  yokeHub.position.copy(P2);
  yokeHub.rotation.x = Math.PI / 2;
  body.add(yokeHub);

  // Twin curved brass U-yoke cradle arms embracing the left & right shade cheeks
  for (const side of [-1, 1]) {
    const yokeCurve = new THREE.CatmullRomCurve3([
      P2.clone(),
      new THREE.Vector3(side * 0.056, P2.y + 0.006, P2.z + 0.004),
      new THREE.Vector3(side * 0.112, P2.y - 0.002, P2.z + 0.012),
      new THREE.Vector3(side * 0.123, P_shade.y, P_shade.z)
    ]);
    body.add(tagSlot(new THREE.Mesh(
      buildTaperedTube(THREE, yokeCurve, 28, 12, (t) => 0.0044 - t * 0.0005, true, true),
      mats.metal
    ), 'metal'));

    // Decorative turned brass side pivot finials clamping the glass hood
    const finial = buildLathe(THREE, [
      [0, 0], [0.0105, 0], [0.011, 0.003], [0.0085, 0.006],
      [0.0062, 0.010], [0.0078, 0.0135], [0.0065, 0.0175],
      [0.0035, 0.020], [0, 0.0208]
    ], 28);
    finial.rotateZ(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const finMesh = tagSlot(new THREE.Mesh(finial, mats.metal), 'metal');
    finMesh.position.set(side * 0.115, P_shade.y, P_shade.z);
    body.add(finMesh);
  }

  // 3. Sculpted Green Cased-Glass Banker's Shade ("head" group)
  const head = new THREE.Group();
  head.name = 'head';
  head.position.copy(P_shade);
  head.rotation.x = -0.40; // Tilts hood open toward +z desk space
  root.add(head);

  const outerHoodGeo = buildBankerHoodGeo(THREE, 0.114, 0.064, 0.088, 0, false);
  const outerHood = tagSlot(new THREE.Mesh(outerHoodGeo, mats.glassShade), 'primary');
  outerHood.userData.glowPulse = true;
  head.add(outerHood);

  const innerHoodGeo = buildBankerHoodGeo(THREE, 0.114, 0.064, 0.088, 0.0048, true);
  const innerHood = tagSlot(new THREE.Mesh(innerHoodGeo, mats.innerGlow), 'glow', false, false);
  innerHood.userData.glowPulse = true;
  head.add(innerHood);

  // Brass side cheek mounting rosettes on the glass hood
  for (const side of [-1, 1]) {
    const rosette = tagSlot(new THREE.Mesh(
      new THREE.CylinderGeometry(0.0135, 0.0135, 0.004, 28).rotateZ(Math.PI / 2),
      mats.metal
    ), 'metal');
    rosette.position.set(side * 0.110, 0.001, 0);
    head.add(rosette);
  }

  // Horizontal warm vintage tubular bulb inside the hood
  const bulb = buildFilamentBulb(THREE, mats, true);
  bulb.rotation.z = Math.PI / 2;
  bulb.position.set(-0.042, 0.020, -0.004);
  head.add(bulb);

  // 4. Iconic Sculpted Beaded Brass Pull-Chain + Turned Acorn Tassel (single continuous LatheGeometry)
  const pullChain = new THREE.Group();
  pullChain.name = 'tail';
  pullChain.position.set(0.036, 0.352, 0.034);
  root.add(pullChain);

  const chainProfile = [[0, 0]];
  const beadCount = 15;
  const beadSpacing = 0.0086;
  for (let i = 0; i < beadCount; i++) {
    const y0 = -i * beadSpacing;
    chainProfile.push([0.0009, y0]);
    chainProfile.push([0.0021, y0 - beadSpacing * 0.25]);
    chainProfile.push([0.0025, y0 - beadSpacing * 0.50]);
    chainProfile.push([0.0021, y0 - beadSpacing * 0.75]);
    chainProfile.push([0.0009, y0 - beadSpacing]);
  }
  const yEnd = -beadCount * beadSpacing;
  // Turned brass acorn tassel at bottom of chain
  chainProfile.push(
    [0.0032, yEnd - 0.002],
    [0.0052, yEnd - 0.005],
    [0.0058, yEnd - 0.009],
    [0.0055, yEnd - 0.014],
    [0.0045, yEnd - 0.019],
    [0.0028, yEnd - 0.023],
    [0.0012, yEnd - 0.0255],
    [0, yEnd - 0.0265]
  );
  // Reverse profile so y increases from bottom to top -> outward normals!
  chainProfile.reverse();
  const chainMesh = tagSlot(new THREE.Mesh(buildLathe(THREE, chainProfile, 18), mats.metal), 'metal');
  pullChain.add(chainMesh);

  // 5. Braided Vintage Floor Cord
  const cordGroup = buildBraidedCord(THREE, mats, new THREE.Vector3(0, 0.014, -0.095), false);
  body.add(cordGroup);

  return {
    lightPos: new THREE.Vector3(0, 0.305, 0.088),
    pullChain
  };
}

// ============================================================================
// MAIN BUILD & IDLE EXPORTS
// ============================================================================
export function build(THREE, opts = {}, kit) {
  const variant = ((Number(opts?.variant ?? 0) | 0) % 3 + 3) % 3;

  const defaultPrimary = variant === 0
    ? '#d66d48' // Warm retro terracotta enamel
    : variant === 1
      ? '#f2caa8' // Warm peach-opal milk glass
      : '#1e7a4c'; // Classic emerald banker's glass

  const defaultMetal = variant === 2 ? '#d2a85c' : '#c9a66b';
  const defaultAccent = variant === 0
    ? '#b94b34'
    : variant === 1
      ? '#c87c52'
      : '#7d3e28';

  const primaryHex = opts?.primary ?? defaultPrimary;
  const metalHex = opts?.metal ?? opts?.secondary ?? defaultMetal;
  const accentHex = opts?.accent ?? defaultAccent;

  const tex = createTextures(THREE, kit, variant);

  // Rich MeshPhysicalMaterial library
  const mats = {
    primary: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(primaryHex),
      map: tex.enamelMap,
      bumpMap: tex.enamelBump,
      bumpScale: 0.0005,
      roughness: 0.30,
      metalness: 0.08,
      clearcoat: 0.72,
      clearcoatRoughness: 0.16,
      sheen: 0.15,
      sheenColor: new THREE.Color('#fff4e6')
    }),
    glassShade: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(primaryHex),
      map: tex.glassMap,
      roughness: variant === 1 ? 0.22 : 0.11,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      sheen: variant === 1 ? 0.35 : 0.15,
      sheenColor: new THREE.Color('#fff2dc'),
      emissive: new THREE.Color(primaryHex).lerp(new THREE.Color('#ffd391'), variant === 1 ? 0.55 : 0.18),
      emissiveMap: tex.glassMap,
      emissiveIntensity: variant === 1 ? 0.55 : 0.26
    }),
    metal: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(metalHex),
      map: tex.metalMap,
      bumpMap: tex.metalBump,
      bumpScale: 0.0004,
      roughness: 0.26,
      metalness: 0.86,
      clearcoat: 0.28,
      clearcoatRoughness: 0.18
    }),
    spring: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(metalHex).multiplyScalar(0.95),
      roughness: 0.20,
      metalness: 0.92,
      clearcoat: 0.35,
      clearcoatRoughness: 0.12
    }),
    accent: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(accentHex),
      map: tex.enamelMap,
      roughness: 0.42,
      metalness: 0.12,
      clearcoat: 0.45,
      clearcoatRoughness: 0.22
    }),
    darkTrim: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(accentHex).multiplyScalar(0.32),
      roughness: 0.72,
      metalness: 0.05,
      sheen: 0.25,
      sheenColor: new THREE.Color('#5a524c')
    }),
    cord: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(accentHex),
      map: tex.cordMap,
      bumpMap: tex.cordBump,
      bumpScale: 0.0014,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.78,
      sheenColor: new THREE.Color(accentHex).lerp(new THREE.Color('#ffffff'), 0.45)
    }),
    felt: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#3b3530'),
      map: tex.feltMap,
      roughness: 0.96,
      metalness: 0.0,
      sheen: 0.85,
      sheenColor: new THREE.Color('#6b6258')
    }),
    innerGlow: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fff4df'),
      map: tex.glowMap,
      roughness: 0.35,
      metalness: 0.0,
      emissive: new THREE.Color('#ffcf84'),
      emissiveMap: tex.glowMap,
      emissiveIntensity: 1.58
    }),
    bulbGlow: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fffaf0'),
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
      emissive: new THREE.Color('#ffdf9e'),
      emissiveIntensity: 1.85
    }),
    filament: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.2,
      emissive: new THREE.Color('#ffae42'),
      emissiveIntensity: 2.2
    })
  };

  const group = new THREE.Group();
  group.name = 'desk-lamp';

  let info;
  if (variant === 1) {
    info = buildMushroomLamp(THREE, group, mats);
  } else if (variant === 2) {
    info = buildBankersLamp(THREE, group, mats);
  } else {
    info = buildArchitectLamp(THREE, group, mats);
  }

  // Required warm PointLight child named "glow"
  const glowLight = new THREE.PointLight(0xffcb82, 0.6, 3, 2);
  glowLight.name = 'glow';
  glowLight.position.copy(info.lightPos);
  group.add(glowLight);

  // Cache animated handles so idle() is fast and allocation-free
  const glowMats = [];
  const seenMats = new Set();
  group.traverse((obj) => {
    if (obj.isMesh && obj.userData.glowPulse && obj.material && !seenMats.has(obj.material)) {
      seenMats.add(obj.material);
      glowMats.push({ mat: obj.material, base: obj.material.emissiveIntensity });
    }
  });

  group.userData._anim = {
    light: glowLight,
    baseIntensity: glowLight.intensity,
    glowMats,
    pullChain: info.pullChain
  };

  return group;
}

export function idle(group, t) {
  if (!group || !group.userData || !group.userData._anim) return;
  const anim = group.userData._anim;

  // Soft cozy warm incandescent glow breathing
  const warmth = 1 + 0.032 * Math.sin(t * 1.65) + 0.014 * Math.sin(t * 4.15 + 0.7);
  if (anim.light) {
    anim.light.intensity = anim.baseIntensity * warmth;
  }
  for (let i = 0; i < anim.glowMats.length; i++) {
    const entry = anim.glowMats[i];
    entry.mat.emissiveIntensity = entry.base * warmth;
  }

  // Gentle breeze pendulum sway on banker's lamp beaded pull-chain
  if (anim.pullChain) {
    anim.pullChain.rotation.z = Math.sin(t * 1.35) * 0.026;
    anim.pullChain.rotation.x = Math.sin(t * 0.95 + 0.9) * 0.014;
  }
}