export const META = {
  id: "dorm_refractor_telescope",
  name: "Cozy Refractor Telescope",
  kind: "prop",
  footprint: [0.58, 0.64],
  variants: [
    { name: "Classic Observatory", metal: "#d9c08a", wood: "#c89462", accent: "#3d3648" },
    { name: "Ivory Brass", metal: "#e0c484", wood: "#a96e46", accent: "#e8e0d0" },
    { name: "Forest Copper", metal: "#d49a74", wood: "#7c5338", accent: "#2c463d" },
    { name: "Midnight Silver", metal: "#cfd4dc", wood: "#9e7b56", accent: "#26334d" }
  ],
  note: "Small refractor telescope on a split-leg wooden tripod with brass rings, rack-and-pinion focuser, star diagonal, finder scope, accessory tray, and hanging lens cap."
};

function cssFromColor(color, alpha = 1) {
  const hex = color.getHex();
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function shiftColor(THREE, hex, dh, ds, dl) {
  const c = new THREE.Color(hex);
  c.offsetHSL(dh, ds, dl);
  return c;
}

function fbm(kit, x, y) {
  return (
    kit.noise(x, y) * 0.55 +
    kit.noise(x * 2.03 + 11.7, y * 2.03 + 5.3) * 0.30 +
    kit.noise(x * 4.11 + 23.1, y * 4.11 + 17.9) * 0.15
  );
}

function makeWoodTextures(THREE, kit, woodHex) {
  const base = new THREE.Color(woodHex);
  const dark = shiftColor(THREE, woodHex, -0.015, 0.06, -0.18);
  const light = shiftColor(THREE, woodHex, 0.01, -0.03, 0.10);
  const pore = shiftColor(THREE, woodHex, -0.02, 0.04, -0.26);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, cssFromColor(light));
    grad.addColorStop(0.5, cssFromColor(base));
    grad.addColorStop(1, cssFromColor(dark));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 4) {
        const u = x / w;
        const v = y / h;
        const n = fbm(kit, u * 5.0, v * 1.4);
        const rings = Math.sin((u * 14.0 + n * 4.2) * Math.PI * 2) * 0.5 + 0.5;
        const streak = kit.noise(u * 36.0, v * 4.5);
        const shade = rings * 0.65 + streak * 0.35;
        ctx.fillStyle = shade > 0.52
          ? cssFromColor(light, (shade - 0.52) * 0.45)
          : cssFromColor(dark, (0.52 - shade) * 0.55);
        ctx.fillRect(x, y, 4, 2);
      }
    }

    ctx.strokeStyle = cssFromColor(pore, 0.22);
    ctx.lineWidth = 1;
    for (let i = 0; i < 160; i++) {
      const px = kit.noise(i * 1.7, 3.1) * w;
      const py = kit.noise(7.3, i * 2.1) * h;
      const len = 14 + kit.noise(i * 3.3, i * 1.1) * 48;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (kit.noise(i, 9.2) - 0.5) * 4, py + len);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const u = x / w;
        const v = y / h;
        const n = fbm(kit, u * 5.0, v * 1.4);
        const rings = Math.sin((u * 14.0 + n * 4.2) * Math.PI * 2) * 0.5 + 0.5;
        const fine = kit.noise(u * 48.0, v * 6.0);
        const val = Math.round(90 + rings * 55 + fine * 35);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeBrassTextures(THREE, kit, metalHex) {
  const base = new THREE.Color(metalHex);
  const bright = shiftColor(THREE, metalHex, 0.01, -0.04, 0.13);
  const patina = shiftColor(THREE, metalHex, -0.02, 0.05, -0.17);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, cssFromColor(bright));
    g.addColorStop(0.45, cssFromColor(base));
    g.addColorStop(0.8, cssFromColor(patina));
    g.addColorStop(1, cssFromColor(base));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y++) {
      const n = kit.noise(2.1, y * 0.35);
      ctx.fillStyle = n > 0.5
        ? cssFromColor(bright, (n - 0.5) * 0.25)
        : cssFromColor(patina, (0.5 - n) * 0.28);
      ctx.fillRect(0, y, w, 1);
    }

    for (let i = 0; i < 45; i++) {
      const cx = kit.noise(i * 2.3, 1.4) * w;
      const cy = kit.noise(4.7, i * 1.9) * h;
      const rad = 10 + kit.noise(i, i * 0.7) * 28;
      const rg = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
      rg.addColorStop(0, cssFromColor(patina, 0.12));
      rg.addColorStop(1, cssFromColor(patina, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = Math.round(112 + kit.noise(1.3, y * 0.55) * 32);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeEnamelTextures(THREE, kit, accentHex, metalHex) {
  const base = new THREE.Color(accentHex);
  const topTint = shiftColor(THREE, accentHex, 0.01, 0.02, 0.09);
  const deepTint = shiftColor(THREE, accentHex, -0.01, 0.03, -0.10);
  const gold = new THREE.Color(metalHex);
  const paleGold = shiftColor(THREE, metalHex, 0, -0.05, 0.14);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, cssFromColor(deepTint));
    g.addColorStop(0.35, cssFromColor(base));
    g.addColorStop(0.75, cssFromColor(topTint));
    g.addColorStop(1, cssFromColor(deepTint));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle starry enamel shimmer flecks
    for (let i = 0; i < 240; i++) {
      const x = kit.noise(i * 3.17, 2.31) * w;
      const y = kit.noise(5.73, i * 2.89) * h;
      const r = 0.6 + kit.noise(i, i * 1.9) * 1.1;
      const a = 0.06 + kit.noise(i * 4.1, 8.2) * 0.14;
      ctx.fillStyle = cssFromColor(paleGold, a);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine decorative brass-gold pinstripes near front & rear of optical tube
    const stripeRows = [62, 72, 434, 444];
    for (const sy of stripeRows) {
      ctx.fillStyle = cssFromColor(gold, 0.85);
      ctx.fillRect(0, sy, w, sy === 62 || sy === 444 ? 4 : 2);
    }

    // Delicate constellation motif painted delicately on mid-tube
    const stars = [
      [150, 240], [182, 224], [216, 232], [248, 250],
      [278, 236], [295, 265], [260, 278]
    ];
    ctx.strokeStyle = cssFromColor(gold, 0.32);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    stars.forEach(([sx, sy], idx) => {
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();

    for (const [sx, sy] of stars) {
      ctx.fillStyle = cssFromColor(paleGold, 0.72);
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const v = Math.round(122 + kit.noise(x * 0.25, y * 0.25) * 12);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeKnurlBump(THREE, kit) {
  const tex = kit.canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = "rgb(110,110,110)";
    ctx.fillRect(0, 0, w, h);
    const step = 8;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        ctx.fillStyle = "rgb(225,225,225)";
        ctx.beginPath();
        ctx.moveTo(x + step * 0.5, y + 1);
        ctx.lineTo(x + step - 1, y + step * 0.5);
        ctx.lineTo(x + step * 0.5, y + step - 1);
        ctx.lineTo(x + 1, y + step * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

function makeDialTexture(THREE, kit, metalHex) {
  const base = new THREE.Color(metalHex);
  const bright = shiftColor(THREE, metalHex, 0.01, -0.04, 0.14);
  const ink = shiftColor(THREE, metalHex, -0.03, 0.05, -0.45);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rg = ctx.createRadialGradient(cx, cy, 8, cx, cy, cx);
    rg.addColorStop(0, cssFromColor(bright));
    rg.addColorStop(0.7, cssFromColor(base));
    rg.addColorStop(1, cssFromColor(ink));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = cssFromColor(ink, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cx * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, cx * 0.66, 0, Math.PI * 2);
    ctx.stroke();

    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const major = deg % 30 === 0;
      const mid = deg % 15 === 0;
      const r0 = cx * (major ? 0.68 : mid ? 0.74 : 0.80);
      const r1 = cx * 0.88;
      ctx.lineWidth = major ? 2.4 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDrawtubeTexture(THREE, kit, metalHex) {
  const bright = shiftColor(THREE, metalHex, 0.0, -0.18, 0.18);
  const mid = shiftColor(THREE, metalHex, 0.0, -0.15, 0.06);
  const ink = shiftColor(THREE, metalHex, -0.02, 0.05, -0.45);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, cssFromColor(mid));
    g.addColorStop(0.5, cssFromColor(bright));
    g.addColorStop(1, cssFromColor(mid));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Millimeter focus graduation markings along the top strip
    ctx.strokeStyle = cssFromColor(ink, 0.78);
    for (let y = 24; y < h - 24; y += 8) {
      const major = (y - 24) % 40 === 0;
      ctx.lineWidth = major ? 2 : 1;
      const len = major ? 26 : 14;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - len * 0.5, y);
      ctx.lineTo(w * 0.5 + len * 0.5, y);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLensTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rg = ctx.createRadialGradient(cx * 0.85, cy * 0.82, 8, cx, cy, cx);
    rg.addColorStop(0, "rgb(56, 118, 138)");
    rg.addColorStop(0.38, "rgb(34, 58, 108)");
    rg.addColorStop(0.75, "rgb(24, 24, 62)");
    rg.addColorStop(1, "rgb(10, 12, 28)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    // Multi-coat emerald-violet optical shimmer band
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, "rgba(110, 235, 195, 0.28)");
    sheen.addColorStop(0.45, "rgba(130, 110, 245, 0.16)");
    sheen.addColorStop(1, "rgba(40, 165, 220, 0.22)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    // Soft window glint reflection
    ctx.fillStyle = "rgba(255, 250, 235, 0.65)";
    ctx.beginPath();
    ctx.ellipse(cx * 0.66, cy * 0.62, 22, 12, -0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(cx * 0.54, cy * 0.52, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCordTextures(THREE, kit, woodHex) {
  const light = shiftColor(THREE, woodHex, 0.02, -0.22, 0.18);
  const dark = shiftColor(THREE, woodHex, -0.01, -0.18, -0.06);

  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = cssFromColor(light);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = cssFromColor(dark, 0.72);
    ctx.lineWidth = 4;
    for (let i = -h; i < w + h; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h * 0.7, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + h * 0.7, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 8);

  const bumpMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "rgb(100,100,100)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgb(215,215,215)";
    ctx.lineWidth = 4;
    for (let i = -h; i < w + h; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h * 0.7, h);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(1, 8);

  return { map, bumpMap };
}

function buildTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, sectionFn) {
  const positions = [];
  const uvs = [];
  const indices = [];

  const points = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    points.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t).normalize());
  }

  // Parallel-transport (Bishop) frames to prevent twisting along curved paths
  const normals = [];
  const binormals = [];
  const ref = Math.abs(tangents[0].y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(ref, tangents[0]).normalize();
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  for (let i = 1; i <= tubularSegs; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const nPrev = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(Math.max(-1, Math.min(1, prevT.dot(currT))));
      nPrev.applyAxisAngle(axis, angle);
    }
    nPrev.addScaledVector(currT, -nPrev.dot(currT)).normalize();
    const bCurr = new THREE.Vector3().crossVectors(currT, nPrev).normalize();
    normals.push(nPrev);
    binormals.push(bCurr);
  }

  const ringStride = radialSegs + 1;
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const rBase = radiusFn(t);
    const p = points[i];
    const N = normals[i];
    const B = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const sx = sectionFn ? sectionFn(theta, t, true) : Math.cos(theta);
      const sy = sectionFn ? sectionFn(theta, t, false) : Math.sin(theta);
      v.copy(p)
        .addScaledVector(N, sx * rBase)
        .addScaledVector(B, sy * rBase);
      positions.push(v.x, v.y, v.z);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }

  // Start cap
  const startCenterIdx = positions.length / 3;
  positions.push(points[0].x, points[0].y, points[0].z);
  uvs.push(0.5, 0);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startCenterIdx, j + 1, j);
  }

  // End cap
  const endCenterIdx = positions.length / 3;
  const lastRing = tubularSegs * ringStride;
  positions.push(points[tubularSegs].x, points[tubularSegs].y, points[tubularSegs].z);
  uvs.push(0.5, 1);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(endCenterIdx, lastRing + j, lastRing + j + 1);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function sculptSphere(THREE, segW, segH, radius, shapeFn) {
  const geom = new THREE.SphereGeometry(radius, segW, segH);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    shapeFn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function lathePoints(THREE, pairs) {
  return pairs.map(([r, y]) => new THREE.Vector2(r, y));
}

function makeMesh(THREE, geom, mat, slot, name) {
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (slot) mesh.userData.slot = slot;
  if (name) mesh.name = name;
  return mesh;
}

export function build(THREE, opts = {}, kit) {
  const metalHex = opts.metal ?? "#d9c08a";
  const woodHex = opts.wood ?? "#c89462";
  const accentHex = opts.accent ?? "#3d3648";

  // Procedurally painted surface textures
  const woodTex = makeWoodTextures(THREE, kit, woodHex);
  const brassTex = makeBrassTextures(THREE, kit, metalHex);
  const enamelTex = makeEnamelTextures(THREE, kit, accentHex, metalHex);
  const knurlBump = makeKnurlBump(THREE, kit);
  const dialMap = makeDialTexture(THREE, kit, metalHex);
  const drawtubeMap = makeDrawtubeTexture(THREE, kit, metalHex);
  const lensMap = makeLensTexture(THREE, kit);
  const cordTex = makeCordTextures(THREE, kit, woodHex);

  // Materials (MeshPhysicalMaterial throughout)
  const woodMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0025,
    roughness: 0.46,
    metalness: 0.02,
    clearcoat: 0.34,
    clearcoatRoughness: 0.32
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: brassTex.map,
    bumpMap: brassTex.bumpMap,
    bumpScale: 0.0014,
    roughness: 0.27,
    metalness: 0.86,
    clearcoat: 0.16,
    clearcoatRoughness: 0.24
  });

  const brassKnurlMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: brassTex.map,
    bumpMap: knurlBump,
    bumpScale: 0.0045,
    roughness: 0.34,
    metalness: 0.84
  });

  const drawtubeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: drawtubeMap,
    roughness: 0.20,
    metalness: 0.88,
    clearcoat: 0.22,
    clearcoatRoughness: 0.15
  });

  const dialMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: dialMap,
    roughness: 0.30,
    metalness: 0.80,
    clearcoat: 0.20
  });

  const enamelMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: enamelTex.map,
    bumpMap: enamelTex.bumpMap,
    bumpScale: 0.0008,
    roughness: 0.30,
    metalness: 0.12,
    clearcoat: 0.68,
    clearcoatRoughness: 0.16
  });

  const castMountMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, accentHex, 0, -0.05, -0.08),
    bumpMap: enamelTex.bumpMap,
    bumpScale: 0.0022,
    roughness: 0.56,
    metalness: 0.35,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45
  });

  const rubberMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, accentHex, 0, -0.25, -0.22),
    roughness: 0.88,
    metalness: 0.02,
    sheen: 0.45,
    sheenColor: shiftColor(THREE, accentHex, 0, -0.15, 0.05)
  });

  const baffleMat = new THREE.MeshPhysicalMaterial({
    color: 0x121218,
    roughness: 0.96,
    metalness: 0.0
  });

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: lensMap,
    roughness: 0.05,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    emissive: new THREE.Color(0x1b3452),
    emissiveIntensity: 0.32
  });

  const cordMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: cordTex.map,
    bumpMap: cordTex.bumpMap,
    bumpScale: 0.003,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenColor: shiftColor(THREE, woodHex, 0.02, -0.2, 0.32)
  });

  const root = new THREE.Group();
  root.name = "refractorTelescope";

  // =========================================================================
  // 1. BODY: WOODEN TRIPOD, TURNED HUB, SCALLOPED TRAY & SPARE EYEPIECES
  // =========================================================================
  const body = new THREE.Group();
  body.name = "body";
  root.add(body);

  const Y_TOP = 0.768;
  const R_TOP = 0.058;
  const R_FOOT = 0.305;
  const Y_TRAY = 0.370;
  const LEG_ANGLES = [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3];

  // Turned wooden tripod crown hub (LatheGeometry, 20 points)
  const hubWoodGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.735],
      [0.028, 0.736],
      [0.044, 0.741],
      [0.056, 0.747],
      [0.062, 0.753],
      [0.064, 0.760],
      [0.063, 0.770],
      [0.065, 0.776],
      [0.062, 0.783],
      [0.057, 0.788],
      [0.056, 0.793],
      [0.050, 0.797],
      [0.044, 0.798],
      [0.034, 0.798],
      [0.020, 0.798],
      [0.001, 0.798]
    ]),
    40
  );
  body.add(makeMesh(THREE, hubWoodGeom, woodMat, "wood", "tripodHubWood"));

  // Brass azimuth crown cap & underside center lock nut
  const hubBrassGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.797],
      [0.049, 0.797],
      [0.052, 0.799],
      [0.052, 0.804],
      [0.047, 0.807],
      [0.036, 0.808],
      [0.030, 0.808],
      [0.026, 0.811],
      [0.018, 0.811],
      [0.001, 0.811]
    ]),
    36
  );
  body.add(makeMesh(THREE, hubBrassGeom, brassMat, "metal", "tripodHubBrass"));

  const hubDropFinial = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.706],
      [0.007, 0.709],
      [0.011, 0.715],
      [0.008, 0.722],
      [0.015, 0.727],
      [0.018, 0.733],
      [0.014, 0.738],
      [0.001, 0.738]
    ]),
    20
  );
  body.add(makeMesh(THREE, hubDropFinial, brassMat, "metal", "tripodFinial"));

  // Shared leg geometries (reused across all 3 legs)
  const dR = R_FOOT - R_TOP;
  const legLen = Math.hypot(dR, Y_TOP);
  const legTilt = Math.atan2(dR, Y_TOP);
  const tipRadius = 0.009;
  const footCenterS = (Y_TOP - tipRadius) / Math.cos(legTilt);
  const collarS = ((Y_TOP - Y_TRAY) / Y_TOP) * legLen;

  // Rounded-rectangle section helper for artisanal wooden rails
  const roundedRectSection = (theta, _t, isX) => {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const n = 3.2;
    const scale = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), -1 / n);
    return isX ? c * scale * 0.78 : s * scale * 1.15;
  };

  const makeUpperRailGeom = (side) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.023, -0.006, 0.0),
      new THREE.Vector3(side * 0.022, -collarS * 0.38, 0.003),
      new THREE.Vector3(side * 0.018, -collarS * 0.75, 0.002),
      new THREE.Vector3(side * 0.014, -collarS - 0.032, 0.0)
    ]);
    return buildTaperedTube(
      THREE,
      curve,
      20,
      12,
      (t) => 0.0088 * (1 - 0.14 * t),
      roundedRectSection
    );
  };
  const railGeomL = makeUpperRailGeom(-1);
  const railGeomR = makeUpperRailGeom(1);

  // Lower turned wooden slider + brass ferrule + rounded floor foot pad (exact y=0 touch)
  const lowerStartS = collarS - 0.135;
  const ferruleTopS = footCenterS - 0.056;
  const lowerWoodGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, -ferruleTopS - 0.004],
      [0.0092, -ferruleTopS - 0.004],
      [0.0098, -ferruleTopS + 0.02],
      [0.0112, -ferruleTopS + 0.10],
      [0.0124, -collarS - 0.06],
      [0.0130, -collarS],
      [0.0125, -collarS + 0.05],
      [0.0114, -lowerStartS - 0.015],
      [0.0095, -lowerStartS - 0.004],
      [0.001, -lowerStartS]
    ]),
    24
  );

  // Brass ferrule + rubberized rounded foot touching floor cleanly
  const ferrulePts = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI * 0.5);
    ferrulePts.push([
      Math.max(0.0008, Math.sin(a) * tipRadius),
      -footCenterS - Math.cos(a) * tipRadius
    ]);
  }
  ferrulePts.push(
    [tipRadius * 1.02, -footCenterS + 0.004],
    [0.0082, -footCenterS + 0.008],
    [0.0088, -footCenterS + 0.015],
    [0.0095, -footCenterS + 0.026],
    [0.0102, -footCenterS + 0.042],
    [0.0112, -ferruleTopS - 0.005],
    [0.0116, -ferruleTopS],
    [0.0102, -ferruleTopS + 0.004],
    [0.001, -ferruleTopS + 0.004]
  );
  const ferruleGeom = new THREE.LatheGeometry(lathePoints(THREE, ferrulePts), 24);

  // Sculpted brass leg locking collar (oval beveled band wrapping twin rails + slider)
  const collarGeom = sculptSphere(THREE, 28, 18, 1, (v) => {
    const ay = Math.abs(v.y);
    const flatY = Math.sign(v.y) * Math.pow(ay, 0.55) * 0.020;
    const lip = 1 + 0.08 * Math.cos(v.y * Math.PI * 2.5);
    v.x *= 0.0265 * lip;
    v.y = flatY;
    v.z *= 0.0155 * lip;
  });

  // Brass hinge clevis lug at tripod hub
  const clevisGeom = sculptSphere(THREE, 24, 16, 1, (v) => {
    v.x *= 0.029;
    v.y *= 0.017;
    v.z = v.z * 0.020 + 0.006;
  });

  // Reusable small knurled brass thumbscrew (LatheGeometry, 16 points)
  const thumbscrewGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.0],
      [0.0032, 0.0],
      [0.0032, 0.010],
      [0.0045, 0.011],
      [0.0045, 0.013],
      [0.0092, 0.014],
      [0.0102, 0.016],
      [0.0102, 0.021],
      [0.0092, 0.0225],
      [0.0062, 0.0232],
      [0.0055, 0.0242],
      [0.001, 0.0245]
    ]),
    20
  );

  // Brass hinge bolt cap
  const hingeBoltGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, -0.032],
      [0.0052, -0.032],
      [0.0068, -0.030],
      [0.0068, -0.027],
      [0.0045, -0.026],
      [0.0045, 0.026],
      [0.0068, 0.027],
      [0.0068, 0.030],
      [0.0052, 0.032],
      [0.001, 0.032]
    ]),
    16
  );
  hingeBoltGeom.rotateZ(Math.PI * 0.5);

  // Assemble the 3 wooden legs
  LEG_ANGLES.forEach((phi, idx) => {
    const legRoot = new THREE.Group();
    legRoot.name = `leg_${idx}`;
    legRoot.position.set(Math.sin(phi) * R_TOP, Y_TOP, Math.cos(phi) * R_TOP);
    legRoot.rotation.y = phi;

    // Hinge clevis fixed to hub edge
    const clevis = makeMesh(THREE, clevisGeom, brassMat, "metal");
    clevis.position.set(0, 0, -0.008);
    legRoot.add(clevis);

    const bolt = makeMesh(THREE, hingeBoltGeom, brassMat, "metal");
    legRoot.add(bolt);

    // Tilted leg assembly
    const tilted = new THREE.Group();
    tilted.rotation.x = -legTilt;
    legRoot.add(tilted);

    tilted.add(makeMesh(THREE, railGeomL, woodMat, "wood"));
    tilted.add(makeMesh(THREE, railGeomR, woodMat, "wood"));
    tilted.add(makeMesh(THREE, lowerWoodGeom, woodMat, "wood"));
    tilted.add(makeMesh(THREE, ferruleGeom, brassMat, "metal"));

    // Mid-height brass locking collar + outer thumbscrew
    const collar = makeMesh(THREE, collarGeom, brassMat, "metal");
    collar.position.set(0, -collarS, 0);
    tilted.add(collar);

    const lockKnob = makeMesh(THREE, thumbscrewGeom, brassKnurlMat, "metal");
    lockKnob.rotation.x = Math.PI * 0.5;
    lockKnob.position.set(0, -collarS, 0.011);
    tilted.add(lockKnob);

    body.add(legRoot);
  });

  // Scalloped wooden accessory tray (ExtrudeGeometry with bezierCurveTo, beveled & dished)
  const trayGroup = new THREE.Group();
  trayGroup.name = "tray";
  trayGroup.position.set(0, Y_TRAY, 0);
  body.add(trayGroup);

  const trayShape = new THREE.Shape();
  const R_TRAY = 0.098;
  const lobes = 6;
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * Math.PI * 2;
    const a1 = ((i + 1) / lobes) * Math.PI * 2;
    const r0 = R_TRAY * (i % 2 === 0 ? 1.0 : 0.90);
    const r1 = R_TRAY * ((i + 1) % 2 === 0 ? 1.0 : 0.90);
    const am = (a0 + a1) * 0.5;
    const rc = R_TRAY * 0.97;
    const x0 = Math.cos(a0) * r0;
    const y0 = Math.sin(a0) * r0;
    const x1 = Math.cos(a1) * r1;
    const y1 = Math.sin(a1) * r1;
    const cx1 = Math.cos(a0 + (a1 - a0) * 0.34) * rc;
    const cy1 = Math.sin(a0 + (a1 - a0) * 0.34) * rc;
    const cx2 = Math.cos(am + (a1 - a0) * 0.16) * rc;
    const cy2 = Math.sin(am + (a1 - a0) * 0.16) * rc;
    if (i === 0) trayShape.moveTo(x0, y0);
    trayShape.bezierCurveTo(cx1, cy1, cx2, cy2, x1, y1);
  }
  const trayGeom = new THREE.ExtrudeGeometry(trayShape, {
    depth: 0.011,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 4,
    curveSegments: 14
  });
  trayGeom.rotateX(-Math.PI * 0.5);
  // Gently dish the upper face of the tray so eyepieces nestle inside
  {
    const pos = trayGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z) / R_TRAY;
      if (y > 0.007) {
        const dish = Math.max(0, 1 - r * r) * 0.0045;
        pos.setY(i, y - dish);
      }
    }
    pos.needsUpdate = true;
    trayGeom.computeVertexNormals();
  }
  trayGroup.add(makeMesh(THREE, trayGeom, woodMat, "wood", "accessoryTray"));

  // Central brass tray hub button & underside lock nut
  const trayNutGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, -0.016],
      [0.010, -0.014],
      [0.013, -0.008],
      [0.022, -0.004],
      [0.024, 0.002],
      [0.018, 0.012],
      [0.014, 0.015],
      [0.001, 0.016]
    ]),
    24
  );
  trayGroup.add(makeMesh(THREE, trayNutGeom, brassMat, "metal", "trayCenterNut"));

  // 3 graceful arched brass spreader arms connecting tray to leg collars
  const legRadiusAtTray = R_TOP + ((Y_TOP - Y_TRAY) / Y_TOP) * (R_FOOT - R_TOP);
  const spreaderCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.005, 0.022),
    new THREE.Vector3(0, -0.012, 0.088),
    new THREE.Vector3(0, -0.006, 0.140),
    new THREE.Vector3(0, 0.0, legRadiusAtTray - 0.006)
  ]);
  const spreaderArmGeom = buildTaperedTube(
    THREE,
    spreaderCurve,
    18,
    10,
    (t) => 0.0048 - 0.001 * Math.sin(t * Math.PI)
  );
  LEG_ANGLES.forEach((phi) => {
    const arm = makeMesh(THREE, spreaderArmGeom, brassMat, "metal");
    arm.rotation.y = phi;
    trayGroup.add(arm);
  });

  // Two cozy spare eyepieces resting in brass-rimmed sockets on the accessory tray
  const spareSocketGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.011, 0.009],
      [0.015, 0.009],
      [0.0155, 0.013],
      [0.013, 0.0145],
      [0.0105, 0.0135],
      [0.0105, 0.009]
    ]),
    20
  );
  const spareEpGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.008],
      [0.0095, 0.008],
      [0.0095, 0.020],
      [0.0135, 0.022],
      [0.0140, 0.036],
      [0.0125, 0.041],
      [0.0102, 0.043],
      [0.0075, 0.041],
      [0.0072, 0.037],
      [0.001, 0.037]
    ]),
    22
  );
  const spareLensGeom = new THREE.SphereGeometry(0.0072, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45);

  const spareCoords = [
    [0.048, 0.034, 1.0],
    [-0.052, 0.024, 0.84]
  ];
  spareCoords.forEach(([sx, sz, sScale]) => {
    const sg = new THREE.Group();
    sg.position.set(sx, 0, sz);
    sg.add(makeMesh(THREE, spareSocketGeom, brassMat, "metal"));
    const ep = makeMesh(THREE, spareEpGeom, enamelMat, "accent");
    ep.scale.set(1, sScale, 1);
    sg.add(ep);
    const sl = makeMesh(THREE, spareLensGeom, lensMat, "accent");
    sl.position.y = 0.0365 * sScale;
    sg.add(sl);
    trayGroup.add(sg);
  });

  // =========================================================================
  // 2. MOUNT: AZIMUTH COLUMN & SCULPTED ALT-AZIMUTH YOKE CRADLE
  // =========================================================================
  const mount = new THREE.Group();
  mount.name = "mount";
  mount.position.set(0, 0.805, 0);
  mount.userData.baseRy = 0.0;
  root.add(mount);

  // Turned brass azimuth column & bearing collar (LatheGeometry, 20 points)
  const azColGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.0],
      [0.034, 0.0],
      [0.034, 0.008],
      [0.028, 0.012],
      [0.024, 0.016],
      [0.022, 0.022],
      [0.026, 0.026],
      [0.026, 0.035],
      [0.021, 0.039],
      [0.020, 0.050],
      [0.025, 0.054],
      [0.028, 0.060],
      [0.024, 0.064],
      [0.001, 0.064]
    ]),
    32
  );
  mount.add(makeMesh(THREE, azColGeom, brassMat, "metal", "azimuthColumn"));

  // Azimuth friction lock knob
  const azLock = makeMesh(THREE, thumbscrewGeom, brassKnurlMat, "metal");
  azLock.rotation.z = -Math.PI * 0.5;
  azLock.position.set(0.022, 0.030, 0);
  mount.add(azLock);

  // Sculpted cast-metal yoke base (dense SphereGeometry displaced organically, zero boxy seams)
  const yokeBaseGeom = sculptSphere(THREE, 48, 32, 1.0, (v) => {
    const ux = v.x;
    const uy = v.y;
    const uz = v.z;
    // Widen along X to sweep smoothly into both fork arms, pinch gracefully in Z
    const flare = 1 + 0.18 * Math.max(0, uy);
    const saddleDip = -0.009 * Math.exp(-ux * ux * 6.0) * Math.max(0, uy);
    v.x = ux * 0.072 * flare;
    v.y = uy * 0.019 + saddleDip;
    v.z = uz * (0.028 - 0.007 * ux * ux);
  });
  const yokeBase = makeMesh(THREE, yokeBaseGeom, castMountMat, "accent", "yokeBase");
  yokeBase.position.set(0, 0.068, 0);
  mount.add(yokeBase);

  // Extruded & curved yoke fork arms (left and right)
  const yokeArmShape = new THREE.Shape();
  yokeArmShape.moveTo(-0.024, 0.0);
  yokeArmShape.bezierCurveTo(-0.023, 0.038, -0.018, 0.074, -0.016, 0.095);
  yokeArmShape.bezierCurveTo(-0.015, 0.114, 0.015, 0.114, 0.016, 0.095);
  yokeArmShape.bezierCurveTo(0.018, 0.074, 0.023, 0.038, 0.024, 0.0);
  yokeArmShape.bezierCurveTo(0.010, -0.008, -0.010, -0.008, -0.024, 0.0);

  const makeYokeArm = (side) => {
    const geom = new THREE.ExtrudeGeometry(yokeArmShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 4,
      curveSegments: 16
    });
    geom.center();
    geom.rotateY(Math.PI * 0.5);
    // Curve the arm gently outward from the sculpted base up to x = side * 0.064
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 0.058) / 0.116; // 0 at bottom, 1 at top
      const bow = side * (0.054 + 0.012 * Math.sin(t * Math.PI * 0.65));
      pos.setX(i, pos.getX(i) + bow);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    const m = makeMesh(THREE, geom, castMountMat, "accent", side > 0 ? "yokeArmR" : "yokeArmL");
    m.position.set(0, 0.116, 0);
    return m;
  };
  mount.add(makeYokeArm(-1));
  mount.add(makeYokeArm(1));

  // Brass trunnion caps, engraved altitude setting circle dial, and altitude clutch knob
  const Y_HEAD_LOCAL = 0.155;
  const trunnionBossGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.0],
      [0.014, 0.0],
      [0.014, 0.024],
      [0.018, 0.026],
      [0.018, 0.031],
      [0.015, 0.033],
      [0.001, 0.033]
    ]),
    24
  );

  // Left trunnion + engraved brass altitude setting circle
  const trunL = makeMesh(THREE, trunnionBossGeom, brassMat, "metal");
  trunL.rotation.z = Math.PI * 0.5;
  trunL.position.set(-0.042, Y_HEAD_LOCAL, 0);
  mount.add(trunL);

  const dialDiscGeom = new THREE.CylinderGeometry(0.026, 0.026, 0.004, 32);
  dialDiscGeom.rotateZ(Math.PI * 0.5);
  const altDial = makeMesh(THREE, dialDiscGeom, dialMat, "metal", "altitudeDial");
  altDial.position.set(-0.075, Y_HEAD_LOCAL, 0);
  mount.add(altDial);

  const dialCapGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.0],
      [0.011, 0.0],
      [0.011, 0.006],
      [0.007, 0.009],
      [0.001, 0.010]
    ]),
    20
  );
  const dialCap = makeMesh(THREE, dialCapGeom, brassMat, "metal");
  dialCap.rotation.z = Math.PI * 0.5;
  dialCap.position.set(-0.077, Y_HEAD_LOCAL, 0);
  mount.add(dialCap);

  // Right trunnion + large brass altitude clutch wheel
  const trunR = makeMesh(THREE, trunnionBossGeom, brassMat, "metal");
  trunR.rotation.z = -Math.PI * 0.5;
  trunR.position.set(0.042, Y_HEAD_LOCAL, 0);
  mount.add(trunR);

  const altClutchGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.0],
      [0.009, 0.0],
      [0.009, 0.008],
      [0.016, 0.010],
      [0.022, 0.012],
      [0.022, 0.019],
      [0.020, 0.021],
      [0.012, 0.020],
      [0.007, 0.022],
      [0.001, 0.023]
    ]),
    28
  );
  const altClutch = makeMesh(THREE, altClutchGeom, brassKnurlMat, "metal", "altitudeClutch");
  altClutch.rotation.z = -Math.PI * 0.5;
  altClutch.position.set(0.072, Y_HEAD_LOCAL, 0);
  mount.add(altClutch);

  // =========================================================================
  // 3. HEAD: REFRACTOR OPTICAL TUBE, BRASS RINGS, FOCUSER, DIAGONAL, FINDER
  // =========================================================================
  const ELEV = -0.48; // Tilted ~27.5 deg skyward toward +z
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, Y_HEAD_LOCAL, 0);
  head.rotation.x = ELEV;
  head.userData.baseRx = ELEV;
  mount.add(head);

  // Main painted enamel optical tube (LatheGeometry rotated onto +Z, 24 points)
  const mainTubeGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.028, -0.225],
      [0.0345, -0.224],
      [0.0365, -0.218],
      [0.0362, -0.205],
      [0.0366, -0.160],
      [0.0372, -0.100],
      [0.0380, -0.020],
      [0.0388, 0.060],
      [0.0396, 0.140],
      [0.0404, 0.210],
      [0.0410, 0.260],
      [0.0416, 0.270],
      [0.0402, 0.274],
      [0.0365, 0.274],
      [0.0355, 0.265],
      [0.0340, 0.240]
    ]),
    48
  );
  mainTubeGeom.rotateX(Math.PI * 0.5);
  head.add(makeMesh(THREE, mainTubeGeom, enamelMat, "accent", "mainOpticalTube"));

  // Brass objective lens cell transition ring (z = +0.262 to +0.298)
  const objCellGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0395, 0.260],
      [0.0432, 0.262],
      [0.0442, 0.266],
      [0.0442, 0.276],
      [0.0462, 0.280],
      [0.0474, 0.285],
      [0.0474, 0.296],
      [0.0458, 0.298],
      [0.0410, 0.298],
      [0.0400, 0.285]
    ]),
    44
  );
  objCellGeom.rotateX(Math.PI * 0.5);
  head.add(makeMesh(THREE, objCellGeom, brassMat, "metal", "objectiveCell"));

  // Flared enamel dew shield (z = +0.294 to +0.408)
  const dewShieldGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0445, 0.294],
      [0.0472, 0.296],
      [0.0478, 0.315],
      [0.0484, 0.355],
      [0.0490, 0.395],
      [0.0486, 0.404],
      [0.0450, 0.404],
      [0.0442, 0.395],
      [0.0438, 0.345],
      [0.0432, 0.300]
    ]),
    48
  );
  dewShieldGeom.rotateX(Math.PI * 0.5);
  head.add(makeMesh(THREE, dewShieldGeom, enamelMat, "accent", "dewShield"));

  // Rolled brass front dew-shield lip ring (z = +0.396 to +0.418)
  const frontLipGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0442, 0.396],
      [0.0494, 0.396],
      [0.0512, 0.400],
      [0.0518, 0.406],
      [0.0515, 0.413],
      [0.0496, 0.417],
      [0.0468, 0.417],
      [0.0446, 0.413],
      [0.0440, 0.405],
      [0.0442, 0.396]
    ]),
    44
  );
  frontLipGeom.rotateX(Math.PI * 0.5);
  head.add(makeMesh(THREE, frontLipGeom, brassMat, "metal", "dewShieldBrassLip"));

  // Matte-black baffled inner dew-shield liner
  const baffleGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0438, 0.404],
      [0.0435, 0.375],
      [0.0415, 0.372],
      [0.0433, 0.369],
      [0.0430, 0.340],
      [0.0410, 0.337],
      [0.0428, 0.334],
      [0.0424, 0.302],
      [0.0360, 0.302]
    ]),
    36
  );
  baffleGeom.rotateX(Math.PI * 0.5);
  head.add(makeMesh(THREE, baffleGeom, baffleMat, "accent", "dewShieldBaffle"));

  // Multi-coated convex objective lens (LatheGeometry, 16 points)
  const objLensPts = [];
  const lensR = 0.0418;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = Math.max(0.0005, t * lensR);
    const bulge = Math.cos(t * Math.PI * 0.5) * 0.011;
    objLensPts.push([r, 0.306 + bulge]);
  }
  const objLensGeom = new THREE.LatheGeometry(lathePoints(THREE, objLensPts), 40);
  objLensGeom.rotateX(Math.PI * 0.5);
  // Flip winding so convex face normals point forward (+Z)
  {
    const idx = objLensGeom.index;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    objLensGeom.computeVertexNormals();
  }
  head.add(makeMesh(THREE, objLensGeom, lensMat, "accent", "objectiveLens"));

  // Rear decorative brass accent ring at focuser junction
  const rearBrassRingGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.033, -0.226],
      [0.0385, -0.225],
      [0.0398, -0.221],
      [0.0398, -0.212],
      [0.0385, -0.208],
      [0.0360, -0.207]
    ]),
    40
  );
  rearBrassRingGeom.rotateX(Math.PI * 0.5);
  head.add(makeMesh(THREE, rearBrassRingGeom, brassMat, "metal", "rearTrimRing"));

  // Twin sculpted brass mounting rings + split top lugs + clamping thumbscrews
  const mountRingGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0372, -0.013],
      [0.0418, -0.013],
      [0.0445, -0.011],
      [0.0454, -0.008],
      [0.0448, -0.005],
      [0.0462, -0.003],
      [0.0462, 0.003],
      [0.0448, 0.005],
      [0.0454, 0.008],
      [0.0445, 0.011],
      [0.0418, 0.013],
      [0.0372, 0.013]
    ]),
    44
  );
  mountRingGeom.rotateX(Math.PI * 0.5);

  const ringLugGeom = sculptSphere(THREE, 20, 14, 1, (v) => {
    v.x *= 0.012;
    v.y *= 0.011;
    v.z *= 0.011;
  });

  [-0.068, 0.072].forEach((rz, idx) => {
    const ring = makeMesh(THREE, mountRingGeom, brassMat, "metal", `brassRing_${idx}`);
    ring.position.z = rz;
    head.add(ring);

    const lug = makeMesh(THREE, ringLugGeom, brassMat, "metal");
    lug.position.set(0, 0.046, rz);
    head.add(lug);

    const clampScrew = makeMesh(THREE, thumbscrewGeom, brassKnurlMat, "metal");
    clampScrew.scale.setScalar(0.88);
    clampScrew.position.set(0, 0.048, rz);
    head.add(clampScrew);
  });

  // Sculpted brass dovetail cradle saddle under both rings connecting to yoke trunnions
  const cradleGeom = sculptSphere(THREE, 36, 24, 1, (v) => {
    v.x *= 0.044;
    v.y *= 0.014;
    v.z *= 0.095;
  });
  const cradle = makeMesh(THREE, cradleGeom, brassMat, "metal", "cradleSaddle");
  cradle.position.set(0, -0.042, 0.002);
  head.add(cradle);

  // Curved extruded brass maker's nameplate hugging the side of the tube
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-0.022, -0.009);
  plateShape.bezierCurveTo(-0.008, -0.011, 0.008, -0.011, 0.022, -0.009);
  plateShape.bezierCurveTo(0.026, -0.004, 0.026, 0.004, 0.022, 0.009);
  plateShape.bezierCurveTo(0.008, 0.011, -0.008, 0.011, -0.022, 0.009);
  plateShape.bezierCurveTo(-0.026, 0.004, -0.026, -0.004, -0.022, -0.009);
  const plateGeom = new THREE.ExtrudeGeometry(plateShape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0007,
    bevelSegments: 2,
    curveSegments: 16
  });
  plateGeom.center();
  // Bend nameplate around tube circumference (cylinder along Z, placed on +X side)
  {
    const pos = plateGeom.attributes.position;
    const rTube = 0.0398;
    for (let i = 0; i < pos.count; i++) {
      const zAlong = pos.getX(i); // length along tube
      const arc = pos.getY(i);    // arc around tube
      const thick = pos.getZ(i);
      const ang = arc / rTube;
      const rr = rTube + thick + 0.0008;
      pos.setXYZ(i, Math.cos(ang) * rr, Math.sin(ang) * rr, zAlong);
    }
    pos.needsUpdate = true;
    plateGeom.computeVertexNormals();
  }
  const nameplate = makeMesh(THREE, plateGeom, brassMat, "metal", "brassNameplate");
  nameplate.position.set(0, 0, 0.165);
  head.add(nameplate);

  // Curved brass slow-motion adjustment brace beneath the rear cradle
  const braceCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.024, -0.044, -0.068),
    new THREE.Vector3(-0.034, -0.064, -0.105),
    new THREE.Vector3(-0.032, -0.078, -0.145)
  ]);
  const braceGeom = buildTaperedTube(THREE, braceCurve, 16, 10, (t) => 0.0036 - 0.0004 * t);
  head.add(makeMesh(THREE, braceGeom, brassMat, "metal", "slowMotionBrace"));

  const slowKnob = makeMesh(THREE, thumbscrewGeom, brassKnurlMat, "metal");
  slowKnob.scale.setScalar(0.85);
  slowKnob.rotation.x = -Math.PI * 0.62;
  slowKnob.position.set(-0.032, -0.078, -0.145);
  head.add(slowKnob);

  // =========================================================================
  // 4. RACK-AND-PINION FOCUSER, DUAL FOCUS KNOBS, STAR DIAGONAL & EYEPIECE
  // =========================================================================
  const focuserGroup = new THREE.Group();
  focuserGroup.name = "focuser";
  head.add(focuserGroup);

  // Tapered brass focuser housing (z = -0.222 to -0.296)
  const focuserBodyGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.020, -0.296],
      [0.0245, -0.296],
      [0.0255, -0.290],
      [0.0250, -0.278],
      [0.0268, -0.264],
      [0.0295, -0.246],
      [0.0332, -0.232],
      [0.0358, -0.224],
      [0.0358, -0.220]
    ]),
    36
  );
  focuserBodyGeom.rotateX(Math.PI * 0.5);
  focuserGroup.add(makeMesh(THREE, focuserBodyGeom, brassMat, "metal", "focuserHousing"));

  // Sculpted rack-and-pinion gearbox bulge smoothly integrated underneath the focuser
  const gearboxGeom = sculptSphere(THREE, 48, 32, 1.0, (v) => {
    const pinch = 1 - 0.16 * Math.abs(v.z);
    v.x *= 0.024 * pinch;
    v.y *= 0.017;
    v.z *= 0.025;
  });
  const gearbox = makeMesh(THREE, gearboxGeom, castMountMat, "accent", "focuserGearbox");
  gearbox.position.set(0, -0.022, -0.264);
  focuserGroup.add(gearbox);

  // Focus tension lock thumbscrew on top of focuser housing
  const focusLock = makeMesh(THREE, thumbscrewGeom, brassKnurlMat, "metal");
  focusLock.scale.setScalar(0.68);
  focusLock.position.set(0, 0.024, -0.266);
  focuserGroup.add(focusLock);

  // Satin brass graduated focuser drawtube (z = -0.290 to -0.354)
  const drawtubeGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0165, -0.354],
      [0.0205, -0.354],
      [0.0218, -0.350],
      [0.0218, -0.342],
      [0.0195, -0.340],
      [0.0195, -0.290]
    ]),
    36
  );
  drawtubeGeom.rotateX(Math.PI * 0.5);
  focuserGroup.add(makeMesh(THREE, drawtubeGeom, drawtubeMat, "metal", "focuserDrawtube"));

  // Transverse pinion shaft & dual stepped knurled brass focus knobs
  const shaftGeom = new THREE.CylinderGeometry(0.0042, 0.0042, 0.092, 16);
  shaftGeom.rotateZ(Math.PI * 0.5);
  const shaft = makeMesh(THREE, shaftGeom, brassMat, "metal");
  shaft.position.set(0, -0.024, -0.264);
  focuserGroup.add(shaft);

  const focusKnobGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, -0.006],
      [0.009, -0.006],
      [0.012, -0.004],
      [0.020, -0.002],
      [0.0225, 0.000],
      [0.0228, 0.005],
      [0.0225, 0.010],
      [0.0205, 0.012],
      [0.0165, 0.011],
      [0.0135, 0.008],
      [0.0105, 0.009],
      [0.0075, 0.0115],
      [0.0040, 0.0122],
      [0.001, 0.0124]
    ]),
    32
  );
  const focusKnobR = makeMesh(THREE, focusKnobGeom, brassKnurlMat, "metal", "focusKnobR");
  focusKnobR.rotation.z = -Math.PI * 0.5;
  focusKnobR.position.set(0.044, -0.024, -0.264);
  focuserGroup.add(focusKnobR);

  const focusKnobL = makeMesh(THREE, focusKnobGeom, brassKnurlMat, "metal", "focusKnobL");
  focusKnobL.rotation.z = Math.PI * 0.5;
  focusKnobL.position.set(-0.044, -0.024, -0.264);
  focuserGroup.add(focusKnobL);

  // 90-degree star diagonal (tilted gently 12 deg sideways for cozy viewing poise)
  const diagGroup = new THREE.Group();
  diagGroup.name = "starDiagonal";
  diagGroup.position.set(0, 0, -0.354);
  diagGroup.rotation.z = -0.21;
  focuserGroup.add(diagGroup);

  // Sculpted chamfered prism housing (continuous dense sphere displaced into crisp diagonal body)
  const prismGeom = sculptSphere(THREE, 48, 32, 1.0, (v) => {
    const sx = Math.sign(v.x) * Math.pow(Math.abs(v.x), 0.62) * 0.019;
    const sy = Math.sign(v.y) * Math.pow(Math.abs(v.y), 0.62) * 0.022;
    const sz = Math.sign(v.z) * Math.pow(Math.abs(v.z), 0.62) * 0.022;
    // Bevel the rear-bottom 45 deg mirror plane cleanly
    const diagCut = sy + sz;
    let ny = sy;
    let nz = sz;
    if (diagCut < -0.016) {
      const excess = (-0.016 - diagCut) * 0.45;
      ny += excess;
      nz += excess;
    }
    v.set(sx, ny, nz);
  });
  const prismBody = makeMesh(THREE, prismGeom, castMountMat, "accent", "diagonalPrism");
  prismBody.position.set(0, 0.002, -0.020);
  diagGroup.add(prismBody);

  // Brass side accent plates on diagonal
  const sidePlateGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.040, 24);
  sidePlateGeom.rotateZ(Math.PI * 0.5);
  const sidePlate = makeMesh(THREE, sidePlateGeom, brassMat, "metal");
  sidePlate.position.set(0, 0.002, -0.020);
  diagGroup.add(sidePlate);

  // Diagonal brass eyepiece holder collar + thumbscrew
  const epHolderGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.014, 0.016],
      [0.018, 0.016],
      [0.019, 0.022],
      [0.019, 0.036],
      [0.0205, 0.038],
      [0.0205, 0.045],
      [0.0185, 0.047],
      [0.0145, 0.047],
      [0.0145, 0.032]
    ]),
    28
  );
  const epHolder = makeMesh(THREE, epHolderGeom, brassMat, "metal");
  epHolder.position.set(0, 0.002, -0.020);
  diagGroup.add(epHolder);

  const epScrew = makeMesh(THREE, thumbscrewGeom, brassKnurlMat, "metal");
  epScrew.scale.setScalar(0.58);
  epScrew.rotation.z = -Math.PI * 0.5;
  epScrew.position.set(0.018, 0.040, -0.020);
  diagGroup.add(epScrew);

  // Eyepiece barrel (LatheGeometry, 20 points) + soft rolled rubber eyecup + glossy eye lens
  const eyepieceGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.042],
      [0.0138, 0.042],
      [0.0142, 0.052],
      [0.0172, 0.056],
      [0.0182, 0.064],
      [0.0182, 0.076],
      [0.0168, 0.081],
      [0.0148, 0.083],
      [0.0110, 0.083],
      [0.0102, 0.078],
      [0.001, 0.078]
    ]),
    28
  );
  const eyepiece = makeMesh(THREE, eyepieceGeom, enamelMat, "accent", "eyepiece");
  eyepiece.position.set(0, 0.002, -0.020);
  diagGroup.add(eyepiece);

  const eyecupGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0146, 0.079],
      [0.0162, 0.082],
      [0.0168, 0.089],
      [0.0156, 0.094],
      [0.0132, 0.0945],
      [0.0114, 0.091],
      [0.0112, 0.083]
    ]),
    28
  );
  const eyecup = makeMesh(THREE, eyecupGeom, rubberMat, "accent", "rubberEyecup");
  eyecup.position.set(0, 0.002, -0.020);
  diagGroup.add(eyecup);

  const eyeLens = makeMesh(THREE, spareLensGeom, lensMat, "accent", "eyeLens");
  eyeLens.scale.setScalar(1.35);
  eyeLens.position.set(0, 0.079, -0.020);
  diagGroup.add(eyeLens);

  // =========================================================================
  // 5. MINIATURE BRASS FINDER SCOPE & CURVED BRACKET RINGS
  // =========================================================================
  const finderGroup = new THREE.Group();
  finderGroup.name = "finder";
  // Positioned gracefully on upper-left of main optical tube
  finderGroup.rotation.z = 0.62;
  head.add(finderGroup);

  const FINDER_Y = 0.074;

  // Curved extruded brass finder bracket stalk (bezierCurveTo, beveled)
  const stalkShape = new THREE.Shape();
  stalkShape.moveTo(-0.012, 0.032);
  stalkShape.bezierCurveTo(-0.008, 0.044, -0.005, 0.052, -0.006, 0.060);
  stalkShape.lineTo(0.006, 0.060);
  stalkShape.bezierCurveTo(0.005, 0.052, 0.008, 0.044, 0.012, 0.032);
  stalkShape.bezierCurveTo(0.004, 0.030, -0.004, 0.030, -0.012, 0.032);

  const stalkGeom = new THREE.ExtrudeGeometry(stalkShape, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0015,
    bevelSegments: 3,
    curveSegments: 12
  });
  stalkGeom.translate(0, 0, -0.0035);

  const finderRingGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0138, -0.0055],
      [0.0172, -0.0055],
      [0.0182, -0.0035],
      [0.0182, 0.0035],
      [0.0172, 0.0055],
      [0.0138, 0.0055],
      [0.0138, -0.0055]
    ]),
    28
  );
  finderRingGeom.rotateX(Math.PI * 0.5);

  [-0.145, -0.025].forEach((fz) => {
    const stalk = makeMesh(THREE, stalkGeom, brassMat, "metal");
    stalk.position.set(0, 0, fz);
    finderGroup.add(stalk);

    const fRing = makeMesh(THREE, finderRingGeom, brassMat, "metal");
    fRing.position.set(0, FINDER_Y, fz);
    finderGroup.add(fRing);

    // 3 radially spaced brass alignment thumbscrews per finder ring
    for (let k = 0; k < 3; k++) {
      const ang = (k * 2 * Math.PI) / 3 + Math.PI / 6;
      const screw = makeMesh(THREE, thumbscrewGeom, brassKnurlMat, "metal");
      screw.scale.setScalar(0.42);
      screw.position.set(
        Math.cos(ang) * 0.013,
        FINDER_Y + Math.sin(ang) * 0.013,
        fz
      );
      screw.rotation.z = ang - Math.PI * 0.5;
      finderGroup.add(screw);
    }
  });

  // Miniature brass finder optical tube + flared dew shield + eyepiece (LatheGeometry, 24 points)
  const finderTubeGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.0045, -0.212],
      [0.0078, -0.211],
      [0.0092, -0.206],
      [0.0092, -0.194],
      [0.0076, -0.190],
      [0.0088, -0.184],
      [0.0098, -0.175],
      [0.0102, -0.140],
      [0.0106, -0.050],
      [0.0110, 0.006],
      [0.0132, 0.010],
      [0.0140, 0.015],
      [0.0144, 0.042],
      [0.0154, 0.045],
      [0.0154, 0.052],
      [0.0136, 0.054],
      [0.0118, 0.051],
      [0.0116, 0.025],
      [0.0090, 0.022]
    ]),
    32
  );
  finderTubeGeom.rotateX(Math.PI * 0.5);
  const finderTube = makeMesh(THREE, finderTubeGeom, brassMat, "metal", "finderScopeTube");
  finderTube.position.set(0, FINDER_Y, 0);
  finderGroup.add(finderTube);

  // Finder front & rear coated glass lenses
  const finderLensFront = makeMesh(THREE, spareLensGeom, lensMat, "accent");
  finderLensFront.scale.setScalar(1.55);
  finderLensFront.rotation.x = Math.PI * 0.5;
  finderLensFront.position.set(0, FINDER_Y, 0.024);
  finderGroup.add(finderLensFront);

  const finderLensRear = makeMesh(THREE, spareLensGeom, lensMat, "accent");
  finderLensRear.scale.setScalar(0.85);
  finderLensRear.rotation.x = -Math.PI * 0.5;
  finderLensRear.position.set(0, FINDER_Y, -0.208);
  finderGroup.add(finderLensRear);

  // =========================================================================
  // 6. COZY DORM-ROOM DETAIL: HANGING LENS CAP ON BRAIDED CORD + STAR CHARM
  // =========================================================================
  const eyeletGeom = new THREE.TorusGeometry(0.005, 0.0014, 10, 18);
  const eyelet = makeMesh(THREE, eyeletGeom, brassMat, "metal");
  eyelet.position.set(0.032, -0.034, 0.278);
  eyelet.rotation.y = Math.PI * 0.35;
  head.add(eyelet);

  const capPendulum = new THREE.Group();
  capPendulum.name = "capPendulum";
  capPendulum.position.set(0.032, -0.036, 0.278);
  // Counter-rotate by -ELEV so local -Y hangs vertically in world gravity
  capPendulum.rotation.x = -ELEV;
  capPendulum.userData.baseRx = -ELEV;
  head.add(capPendulum);

  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.005, -0.048, 0.004),
    new THREE.Vector3(0.003, -0.105, -0.002),
    new THREE.Vector3(0.007, -0.158, 0.003)
  ]);
  const cordGeom = buildTaperedTube(THREE, cordCurve, 20, 8, () => 0.0020);
  capPendulum.add(makeMesh(THREE, cordGeom, cordMat, "wood", "lensCapCord"));

  // Hanging brass-rimmed objective lens cap (LatheGeometry, 18 points)
  const capGeom = new THREE.LatheGeometry(
    lathePoints(THREE, [
      [0.001, 0.0],
      [0.036, 0.001],
      [0.047, 0.003],
      [0.052, 0.006],
      [0.053, 0.011],
      [0.052, 0.020],
      [0.049, 0.021],
      [0.047, 0.019],
      [0.047, 0.010],
      [0.042, 0.008],
      [0.001, 0.008]
    ]),
    32
  );
  const capRimGeom = new THREE.TorusGeometry(0.0518, 0.0024, 10, 32);
  capRimGeom.rotateX(Math.PI * 0.5);

  const hangingCap = new THREE.Group();
  hangingCap.position.set(0.007, -0.210, 0.003);
  hangingCap.rotation.z = Math.PI * 0.5;
  hangingCap.rotation.y = 0.35;
  hangingCap.add(makeMesh(THREE, capGeom, enamelMat, "accent", "hangingLensCap"));
  const capRim = makeMesh(THREE, capRimGeom, brassMat, "metal");
  capRim.position.y = 0.008;
  hangingCap.add(capRim);
  capPendulum.add(hangingCap);

  // Tiny curved brass crescent-moon dorm charm dangling beside the lens cap
  const charmGroup = new THREE.Group();
  charmGroup.name = "charm";
  charmGroup.position.set(0.005, -0.132, 0.001);
  capPendulum.add(charmGroup);

  const charmShape = new THREE.Shape();
  charmShape.moveTo(0.0, 0.011);
  charmShape.bezierCurveTo(-0.011, 0.010, -0.013, -0.008, 0.0, -0.011);
  charmShape.bezierCurveTo(-0.005, -0.006, -0.005, 0.006, 0.0, 0.011);
  const charmGeom = new THREE.ExtrudeGeometry(charmShape, {
    depth: 0.0016,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 2,
    curveSegments: 14
  });
  charmGeom.center();
  // Gently cup the brass moon charm
  {
    const pos = charmGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, pos.getZ(i) + (x * x + y * y) * 10.0);
    }
    pos.needsUpdate = true;
    charmGeom.computeVertexNormals();
  }
  const charmMesh = makeMesh(THREE, charmGeom, brassMat, "metal", "brassMoonCharm");
  charmMesh.position.set(0.010, -0.012, 0.004);
  charmGroup.add(charmMesh);

  return root;
}

export function idle(group, t) {
  const capPendulum = group.getObjectByName("capPendulum");
  if (capPendulum) {
    const baseRx = capPendulum.userData.baseRx ?? 0.48;
    capPendulum.rotation.z = Math.sin(t * 1.45) * 0.042 + Math.sin(t * 2.35) * 0.012;
    capPendulum.rotation.x = baseRx + Math.cos(t * 1.12) * 0.022;
  }

  const charm = group.getObjectByName("charm");
  if (charm) {
    charm.rotation.z = Math.sin(t * 2.15 + 0.7) * 0.14;
    charm.rotation.y = Math.sin(t * 1.25) * 0.35;
  }

  const head = group.getObjectByName("head");
  if (head) {
    const baseRx = head.userData.baseRx ?? -0.48;
    head.rotation.x = baseRx + Math.sin(t * 0.35) * 0.010;
  }

  const mount = group.getObjectByName("mount");
  if (mount) {
    const baseRy = mount.userData.baseRy ?? 0.0;
    mount.rotation.y = baseRy + Math.sin(t * 0.22) * 0.022;
  }

  const knobR = group.getObjectByName("focusKnobR");
  const knobL = group.getObjectByName("focusKnobL");
  const focusSpin = Math.sin(t * 0.48) * 0.14;
  if (knobR) knobR.rotation.x = focusSpin;
  if (knobL) knobL.rotation.x = focusSpin;
}