export const META = {
  id: "city-bicycle",
  name: "City Bicycle",
  kind: "prop",
  footprint: [0.76, 1.80],
  variants: [
    { id: "sky", name: "Powder Sky", primary: "#8fc1e8", metal: "#d9d9d9", accent: "#c89462" },
    { id: "sage", name: "Mint Sage", primary: "#93bfa1", metal: "#dcdcdc", accent: "#b87f4f" },
    { id: "cream", name: "Vanilla Cream", primary: "#efe6d3", metal: "#d6ba78", accent: "#8d5836" },
    { id: "terracotta", name: "Warm Terracotta", primary: "#d9846c", metal: "#d9d9d9", accent: "#c89462" }
  ],
  note: "Step-through city bicycle resting on its kickstand with woven front basket, pinstriped fenders, brass bell, sculpted sprung leather saddle, and cross-laced spoked wheels."
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function parseHex(hex) {
  const s = String(hex || "#888888").replace("#", "").trim();
  const full = s.length === 3 ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2] : s.padEnd(6, "8");
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    ((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b))
      .toString(16)
      .slice(1)
  );
}

function mixHex(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex(
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t
  );
}

function shadeHex(hex, factor) {
  const c = parseHex(hex);
  if (factor >= 0) {
    return toHex(
      c[0] + (255 - c[0]) * factor,
      c[1] + (255 - c[1]) * factor,
      c[2] + (255 - c[2]) * factor
    );
  }
  const f = 1 + factor;
  return toHex(c[0] * f, c[1] * f, c[2] * f);
}

// ---------------------------------------------------------------------------
// Geometry craft helpers
// ---------------------------------------------------------------------------

function mergeGeos(THREE, geos) {
  const list = geos.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  let totalVerts = 0;
  for (let i = 0; i < list.length; i++) {
    totalVerts += list[i].attributes.position.count;
  }
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  let offset = 0;
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    const count = g.attributes.position.count;
    pos.set(g.attributes.position.array, offset * 3);
    if (g.attributes.normal) {
      norm.set(g.attributes.normal.array, offset * 3);
    }
    if (g.attributes.uv) {
      uv.set(g.attributes.uv.array, offset * 2);
    }
    offset += count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

function makeTaperedTube(THREE, curve, radiusFn, tubularSegs, radialSegs, opts = {}) {
  const closed = !!opts.closed;
  const capStart = opts.capStart !== undefined ? opts.capStart : !closed;
  const capEnd = opts.capEnd !== undefined ? opts.capEnd : !closed;
  const scaleN = opts.scaleN || 1;
  const scaleB = opts.scaleB || 1;

  const frames = curve.computeFrenetFrames(tubularSegs, closed);
  const rings = tubularSegs + 1;
  const cols = radialSegs + 1;

  const positions = [];
  const uvs = [];
  const indices = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();

  for (let i = 0; i < rings; i++) {
    const u = i / tubularSegs;
    curve.getPointAt(u, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = typeof radiusFn === "function" ? radiusFn(u) : radiusFn;
    for (let j = 0; j < cols; j++) {
      const v = j / radialSegs;
      const th = v * Math.PI * 2;
      const cn = Math.cos(th) * r * scaleN;
      const sb = Math.sin(th) * r * scaleB;
      positions.push(
        P.x + cn * N.x + sb * B.x,
        P.y + cn * N.y + sb * B.y,
        P.z + cn * N.z + sb * B.z
      );
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * cols + j;
      const b = i * cols + (j + 1);
      const c = (i + 1) * cols + (j + 1);
      const d = (i + 1) * cols + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  if (capStart) {
    curve.getPointAt(0, P);
    const r0 = typeof radiusFn === "function" ? radiusFn(0) : radiusFn;
    const t0 = frames.tangents[0];
    const centerIdx = positions.length / 3;
    positions.push(P.x - t0.x * r0 * 0.28, P.y - t0.y * r0 * 0.28, P.z - t0.z * r0 * 0.28);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    curve.getPointAt(1, P);
    const r1 = typeof radiusFn === "function" ? radiusFn(1) : radiusFn;
    const t1 = frames.tangents[tubularSegs];
    const base = tubularSegs * cols;
    const centerIdx = positions.length / 3;
    positions.push(P.x + t1.x * r1 * 0.28, P.y + t1.y * r1 * 0.28, P.z + t1.z * r1 * 0.28);
    uvs.push(1, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeWheelRing(THREE, profilePts, segs) {
  // profilePts: array of [x, r] ordered CCW around the cross-section (closed if first === last)
  const M = profilePts.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const phi = u * Math.PI * 2;
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    for (let j = 0; j < M; j++) {
      const x = profilePts[j][0];
      const r = profilePts[j][1];
      positions.push(x, r * sp, r * cp);
      uvs.push(u * 8, j / (M - 1));
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j;
      const b = i * M + j + 1;
      const c = (i + 1) * M + j + 1;
      const d = (i + 1) * M + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeCurvedFender(THREE, radius, halfWidth, depth, thick, phiStart, phiEnd, arcSegs, crossSegs) {
  // Solid crescent-profile mudguard hugging a wheel in the YZ plane
  const cols = crossSegs + 1;
  const rows = arcSegs + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  function samplePoint(u, v, isInner) {
    const phi = phiStart + u * (phiEnd - phiStart);
    const s = v * 2 - 1; // -1..1 across width
    const taperEnds = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);
    const endFlare = 0.88 + 0.12 * Math.pow(taperEnds, 0.25);
    const x = s * halfWidth * endFlare;
    const arch = 1 - Math.pow(Math.abs(s), 2.15);
    const bead = Math.abs(s) > 0.88 ? 0.0022 * Math.sin(((Math.abs(s) - 0.88) / 0.12) * Math.PI) : 0;
    const r = radius + arch * depth + bead - (isInner ? thick : 0);
    return [x, r * Math.sin(phi), r * Math.cos(phi)];
  }

  // Outer shell (0 .. rows*cols - 1)
  for (let i = 0; i < rows; i++) {
    const u = i / arcSegs;
    for (let j = 0; j < cols; j++) {
      const v = j / crossSegs;
      const p = samplePoint(u, v, false);
      positions.push(p[0], p[1], p[2]);
      uvs.push(u, v);
    }
  }
  const innerOffset = rows * cols;
  for (let i = 0; i < rows; i++) {
    const u = i / arcSegs;
    for (let j = 0; j < cols; j++) {
      const v = j / crossSegs;
      const p = samplePoint(u, v, true);
      positions.push(p[0], p[1], p[2]);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < arcSegs; i++) {
    for (let j = 0; j < crossSegs; j++) {
      const a = i * cols + j;
      const b = i * cols + j + 1;
      const c = (i + 1) * cols + j + 1;
      const d = (i + 1) * cols + j;
      indices.push(a, b, d, b, c, d);

      const ia = innerOffset + a;
      const ib = innerOffset + b;
      const ic = innerOffset + c;
      const id = innerOffset + d;
      indices.push(ia, id, ib, ib, id, ic);
    }
  }

  // Stitch left & right rims
  for (let i = 0; i < arcSegs; i++) {
    const o0 = i * cols;
    const o1 = (i + 1) * cols;
    const n0 = innerOffset + o0;
    const n1 = innerOffset + o1;
    indices.push(o0, o1, n0, o1, n1, n0);

    const ro0 = i * cols + crossSegs;
    const ro1 = (i + 1) * cols + crossSegs;
    const rn0 = innerOffset + ro0;
    const rn1 = innerOffset + ro1;
    indices.push(ro0, rn0, ro1, ro1, rn0, rn1);
  }

  // Stitch start & end caps
  for (let j = 0; j < crossSegs; j++) {
    const s0 = j;
    const s1 = j + 1;
    const ns0 = innerOffset + s0;
    const ns1 = innerOffset + s1;
    indices.push(s0, ns0, s1, s1, ns0, ns1);

    const e0 = arcSegs * cols + j;
    const e1 = arcSegs * cols + j + 1;
    const ne0 = innerOffset + e0;
    const ne1 = innerOffset + e1;
    indices.push(e0, e1, ne0, e1, ne1, ne0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeCurvedExtrude(THREE, shape, extrudeOpts, bendFn) {
  const geo = new THREE.ExtrudeGeometry(shape, extrudeOpts);
  if (bendFn) {
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      bendFn(v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

function makeSculptedGeometry(THREE, segU, segV, shapeFn) {
  const geo = new THREE.SphereGeometry(1, segU, segV);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const u = uv ? uv.getX(i) : 0.5;
    const w = uv ? uv.getY(i) : 0.5;
    shapeFn(v, u, w);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeLathe(THREE, pts, segs = 28) {
  const vecs = pts.map((p) => new THREE.Vector2(Math.max(0.0001, p[0]), p[1]));
  const geo = new THREE.LatheGeometry(vecs, segs);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Procedural CanvasTexture generators (using kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function makeFenderTexture(THREE, kit, primaryHex) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle enamel tonal sheen across cross-section
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, shadeHex(primaryHex, -0.1));
    grad.addColorStop(0.22, primaryHex);
    grad.addColorStop(0.5, shadeHex(primaryHex, 0.08));
    grad.addColorStop(0.78, primaryHex);
    grad.addColorStop(1, shadeHex(primaryHex, -0.1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Vintage twin cream coach-line pinstripes along the centre
    ctx.fillStyle = "#f7efe0";
    ctx.fillRect(0, h * 0.445, w, h * 0.028);
    ctx.fillRect(0, h * 0.527, w, h * 0.028);

    // Thin gold hairline accent between stripes
    ctx.fillStyle = "#d9b46c";
    ctx.fillRect(0, h * 0.492, w, h * 0.016);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeChainguardTexture(THREE, kit, primaryHex) {
  const tex = kit.canvasTexture(256, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, shadeHex(primaryHex, 0.1));
    grad.addColorStop(0.55, primaryHex);
    grad.addColorStop(1, shadeHex(primaryHex, -0.14));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Classic horizontal cream vintage speed-stripe
    ctx.fillStyle = "#f7efe0";
    ctx.fillRect(0, h * 0.44, w, h * 0.09);
    ctx.fillStyle = "#d9b46c";
    ctx.fillRect(0, h * 0.54, w, h * 0.025);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeLeatherTextures(THREE, kit, accentHex) {
  const baseDark = shadeHex(accentHex, -0.24);
  const baseMid = accentHex;
  const baseLight = shadeHex(accentHex, 0.14);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.08, w * 0.5, h * 0.5, w * 0.62);
    grad.addColorStop(0, baseLight);
    grad.addColorStop(0.65, baseMid);
    grad.addColorStop(1, baseDark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Organic leather pebble flecks
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n = kit.noise(x * 0.14, y * 0.14);
        const n2 = kit.noise(x * 0.35 + 11, y * 0.35 + 7);
        const v = (n * 0.6 + n2 * 0.4 - 0.5) * 42;
        if (Math.abs(v) > 4) {
          ctx.fillStyle = v > 0 ? "rgba(255,235,205,0.09)" : "rgba(45,22,8,0.12)";
          ctx.fillRect(x, y, 3, 3);
        }
      }
    }

    // Subtle cream saddle stitching near edges
    ctx.strokeStyle = "rgba(248,236,210,0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.setLineDash([]);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = kit.noise(x * 0.22, y * 0.22);
        const g = Math.floor(96 + n * 72);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeWickerTextures(THREE, kit, accentHex) {
  const reedLight = shadeHex(mixHex(accentHex, "#ebd2a2", 0.45), 0.1);
  const reedMid = mixHex(accentHex, "#d9b57c", 0.38);
  const reedDark = shadeHex(mixHex(accentHex, "#9c6d3e", 0.35), -0.28);
  const crevice = shadeHex(accentHex, -0.58);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = crevice;
    ctx.fillRect(0, 0, w, h);

    const rows = 16;
    const cols = 8;
    const rowH = h / rows;
    const colW = w / cols;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = c * colW;
        const y0 = r * rowH;
        const shift = (r % 2) * (colW * 0.5);
        const rx = (x0 + shift) % w;
        const n = kit.noise(c * 1.7 + r * 0.4, r * 1.3);
        const tone = mixHex(reedMid, reedLight, n);

        // Draw rounded reed capsule (wrapping across X)
        const drawReed = (px) => {
          const g = ctx.createLinearGradient(px, y0 + 1, px, y0 + rowH - 1);
          g.addColorStop(0, reedDark);
          g.addColorStop(0.28, tone);
          g.addColorStop(0.55, reedLight);
          g.addColorStop(0.85, reedMid);
          g.addColorStop(1, crevice);
          ctx.fillStyle = g;
          ctx.fillRect(px + 1.5, y0 + 1.2, colW - 3, rowH - 2.4);

          // Left/right woven tuck shading
          const sg = ctx.createLinearGradient(px + 1.5, 0, px + colW - 1.5, 0);
          sg.addColorStop(0, "rgba(35,18,6,0.42)");
          sg.addColorStop(0.22, "rgba(35,18,6,0)");
          sg.addColorStop(0.78, "rgba(35,18,6,0)");
          sg.addColorStop(1, "rgba(35,18,6,0.42)");
          ctx.fillStyle = sg;
          ctx.fillRect(px + 1.5, y0 + 1.2, colW - 3, rowH - 2.4);

          // Fine wood fiber streaks
          ctx.fillStyle = "rgba(95,55,20,0.16)";
          ctx.fillRect(px + 3, y0 + rowH * 0.42, colW - 6, 1);
        };

        drawReed(rx);
        if (rx + colW > w) drawReed(rx - w);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.5, 1.4);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, w, h);

    const rows = 16;
    const cols = 8;
    const rowH = h / rows;
    const colW = w / cols;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const y0 = r * rowH;
        const rx = ((c * colW) + (r % 2) * (colW * 0.5)) % w;
        const drawCell = (px) => {
          const g = ctx.createLinearGradient(px, y0 + 1, px, y0 + rowH - 1);
          g.addColorStop(0, "#353535");
          g.addColorStop(0.45, "#f0f0f0");
          g.addColorStop(1, "#2a2a2a");
          ctx.fillStyle = g;
          ctx.fillRect(px + 1.8, y0 + 1.4, colW - 3.6, rowH - 2.8);
        };
        drawCell(rx);
        if (rx + colW > w) drawCell(rx - w);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(3.5, 1.4);

  return { map, bump };
}

function makeTireTextures(THREE, kit, accentHex) {
  const gumWall = mixHex("#e7d6b4", accentHex, 0.28);
  const gumEdge = shadeHex(gumWall, -0.15);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    // v goes around cross section: 0..0.14 inner bead, 0.14..0.33 left sidewall,
    // 0.33..0.67 dark rubber tread crown, 0.67..0.86 right sidewall, 0.86..1 inner bead
    ctx.fillStyle = "#2b2c30";
    ctx.fillRect(0, 0, w, h);

    // Cream gum-wall bands on both sides
    const drawSidewall = (yStart, yEnd) => {
      const g = ctx.createLinearGradient(0, yStart, 0, yEnd);
      g.addColorStop(0, gumEdge);
      g.addColorStop(0.5, gumWall);
      g.addColorStop(1, gumEdge);
      ctx.fillStyle = g;
      ctx.fillRect(0, yStart, w, yEnd - yStart);
    };
    drawSidewall(h * 0.12, h * 0.32);
    drawSidewall(h * 0.68, h * 0.88);

    // Subtle dark rubber tread shading
    const tg = ctx.createLinearGradient(0, h * 0.32, 0, h * 0.68);
    tg.addColorStop(0, "#232528");
    tg.addColorStop(0.5, "#33363b");
    tg.addColorStop(1, "#232528");
    ctx.fillStyle = tg;
    ctx.fillRect(0, h * 0.32, w, h * 0.36);

    // Fine herringbone tread accents
    ctx.strokeStyle = "#1c1d20";
    ctx.lineWidth = 3;
    for (let x = -32; x < w + 32; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.5);
      ctx.lineTo(x + 12, h * 0.35);
      ctx.moveTo(x, h * 0.5);
      ctx.lineTo(x + 12, h * 0.65);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#888888";
    ctx.fillRect(0, 0, w, h);

    // Center water groove & herringbone tread channels
    ctx.strokeStyle = "#303030";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    ctx.lineWidth = 3.5;
    for (let x = -32; x < w + 32; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.49);
      ctx.lineTo(x + 12, h * 0.34);
      ctx.moveTo(x, h * 0.51);
      ctx.lineTo(x + 12, h * 0.66);
      ctx.stroke();
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bump };
}

function makeLinerTextures(THREE, kit, primaryHex) {
  const cream = "#f5efe3";
  const stripe = mixHex(primaryHex, "#ffffff", 0.32);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = cream;
    ctx.fillRect(0, 0, w, h);

    // Soft cozy ticking stripes
    ctx.fillStyle = stripe;
    for (let x = 0; x < w; x += 32) {
      ctx.fillRect(x, 0, 10, h);
      ctx.fillRect(x + 14, 0, 3, h);
    }

    // Fine linen crosshatch weave
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? "rgba(120,105,85,0.06)" : "rgba(255,255,255,0.06)";
      ctx.fillRect(0, y, w, 2);
    }
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? "rgba(120,105,85,0.05)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(x, 0, 2, h);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const checker = ((x + y) % 6 === 0) ? 148 : 112;
        ctx.fillStyle = `rgb(${checker},${checker},${checker})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(3, 3);

  return { map, bump };
}

function makeMetalBump(THREE, kit) {
  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(0.5, y * 0.25);
      const g = Math.floor(115 + n * 28);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(0, y, w, 2);
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  return bump;
}

// ---------------------------------------------------------------------------
// Component builders
// ---------------------------------------------------------------------------

function buildWheel(THREE, mats, opts) {
  const { isRear, R, rTube } = opts;
  const group = new THREE.Group();
  group.name = isRear ? "rearWheel" : "frontWheel";

  const Rc = R - rTube; // tire centerline radius = 0.298
  const rimOuter = R - rTube * 1.48; // 0.2874
  const rimInner = rimOuter - 0.015; // 0.2724

  // 1. Contoured City Tire (slightly flattened crown + smooth gum sidewall + rim bead)
  const tireProf = [];
  const profSteps = 20;
  for (let j = 0; j <= profSteps; j++) {
    const t = j / profSteps;
    // t=0 inner bottom bead -> t=0.5 outer crown -> t=1 inner bottom bead
    const ang = -Math.PI * 0.5 + t * Math.PI * 2;
    let lx = Math.cos(ang);
    let lr = Math.sin(ang);
    // Subtle city-tire tread profile: slightly fuller shoulders, softly flattened crown
    if (lr > 0) {
      lr = Math.pow(lr, 0.88);
    } else {
      lx *= 0.72;
      lr *= 0.78;
    }
    const x = lx * rTube * 0.96;
    const r = Rc + lr * rTube;
    tireProf.push([x, r]);
  }
  const tireGeo = makeWheelRing(THREE, tireProf, 64);
  const tireMesh = new THREE.Mesh(tireGeo, mats.tire);
  tireMesh.userData.slot = "accent";
  tireMesh.castShadow = true;
  tireMesh.receiveShadow = true;
  group.add(tireMesh);
  group.userData.tireMesh = tireMesh;

  // 2. Alloy Double-Wall Rim
  const rw = 0.0135;
  const rimProf = [
    [-rw * 0.65, rimInner],
    [-rw, rimInner + 0.006],
    [-rw, rimOuter - 0.001],
    [-rw * 0.76, rimOuter],
    [0, rimOuter - 0.0045],
    [rw * 0.76, rimOuter],
    [rw, rimOuter - 0.001],
    [rw, rimInner + 0.006],
    [rw * 0.65, rimInner],
    [0, rimInner - 0.002],
    [-rw * 0.65, rimInner]
  ];
  const rimGeo = makeWheelRing(THREE, rimProf, 64);
  const rimMesh = new THREE.Mesh(rimGeo, mats.chrome);
  rimMesh.userData.slot = "secondary";
  rimMesh.castShadow = true;
  rimMesh.receiveShadow = true;
  group.add(rimMesh);

  // 3. Hub shell via LatheGeometry (>= 18 points), aligned along X-axis
  const halfHub = isRear ? 0.056 : 0.048;
  const flangeX = isRear ? 0.030 : 0.027;
  const flangeR = 0.0235;
  const hubPts = [
    [0.0045, -halfHub],
    [0.0085, -halfHub],
    [0.0095, -halfHub + 0.006],
    [0.0125, -flangeX - 0.005],
    [flangeR, -flangeX - 0.002],
    [flangeR, -flangeX + 0.002],
    [0.0135, -flangeX + 0.006],
    [0.0110, -flangeX * 0.45],
    [0.0105, 0],
    [0.0110, flangeX * 0.45],
    [0.0135, flangeX - 0.006],
    [flangeR, flangeX - 0.002],
    [flangeR, flangeX + 0.002],
    [0.0125, flangeX + 0.005],
    [0.0095, halfHub - 0.006],
    [0.0085, halfHub],
    [0.0045, halfHub],
    [0.0045, halfHub + 0.010]
  ];
  const hubGeo = makeLathe(THREE, hubPts, 24);
  hubGeo.rotateZ(-Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, mats.chrome);
  hubMesh.userData.slot = "secondary";
  hubMesh.castShadow = true;
  group.add(hubMesh);

  // Axle acorn nuts
  const nutGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.008, 6);
  nutGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const nut = new THREE.Mesh(nutGeo, mats.chrome);
    nut.position.x = side * (halfHub + 0.008);
    nut.userData.slot = "secondary";
    group.add(nut);
  }

  // 4. Cross-2 Tangential Spoke Lacing (24 spokes + 24 brass nipples, merged!)
  const spokeCount = 24;
  const spokeGeos = [];
  const nippleGeos = [];
  const yAxis = new THREE.Vector3(0, 1, 0);
  const aPt = new THREE.Vector3();
  const bPt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const mat4 = new THREE.Matrix4();
  const scl = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < spokeCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const isLeading = Math.floor(i / 2) % 2 === 0;
    const rimAng = (i / spokeCount) * Math.PI * 2;
    const crossOffset = (isLeading ? 1 : -1) * (1.85 / spokeCount) * Math.PI * 2;
    const hubAng = rimAng + crossOffset;

    const hubX = side * (flangeX + (isLeading ? 0.0018 : -0.0018));
    const hubR = flangeR - 0.003;
    aPt.set(hubX, Math.sin(hubAng) * hubR, Math.cos(hubAng) * hubR);

    const rimX = side * 0.0032;
    const rimR = rimInner + 0.001;
    bPt.set(rimX, Math.sin(rimAng) * rimR, Math.cos(rimAng) * rimR);

    dir.subVectors(bPt, aPt);
    const len = dir.length();
    dir.normalize();
    mid.addVectors(aPt, bPt).multiplyScalar(0.5);
    quat.setFromUnitVectors(yAxis, dir);

    const sGeo = new THREE.CylinderGeometry(0.00105, 0.00105, len, 5, 1, true);
    mat4.compose(mid, quat, scl);
    sGeo.applyMatrix4(mat4);
    spokeGeos.push(sGeo);

    // Brass spoke nipple near rim
    const nPos = bPt.clone().addScaledVector(dir, -0.0055);
    const nGeo = new THREE.CylinderGeometry(0.0021, 0.0017, 0.009, 6);
    mat4.compose(nPos, quat, scl);
    nGeo.applyMatrix4(mat4);
    nippleGeos.push(nGeo);
  }

  const spokesMesh = new THREE.Mesh(mergeGeos(THREE, spokeGeos), mats.spoke);
  spokesMesh.userData.slot = "secondary";
  group.add(spokesMesh);

  const nipplesMesh = new THREE.Mesh(mergeGeos(THREE, nippleGeos), mats.brass);
  nipplesMesh.userData.slot = "accent";
  group.add(nipplesMesh);

  // 5. Brass valve stem at bottom of rim
  const valveGeo = new THREE.CylinderGeometry(0.0028, 0.0034, 0.026, 8);
  const valve = new THREE.Mesh(valveGeo, mats.brass);
  valve.position.set(0, -(rimInner - 0.011), 0);
  valve.userData.slot = "accent";
  group.add(valve);

  const valveCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.007, 8), mats.rubber);
  valveCap.position.set(0, -(rimInner - 0.024), 0);
  valveCap.userData.slot = "accent";
  group.add(valveCap);

  // 6. Rear cog (freewheel) on rider's right (-X)
  if (isRear) {
    const cogShape = new THREE.Shape();
    const teeth = 18;
    const rOut = 0.036;
    const rIn = 0.030;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? rOut : rIn;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) cogShape.moveTo(px, py);
      else cogShape.lineTo(px, py);
    }
    cogShape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.014, 0, Math.PI * 2, true);
    cogShape.holes.push(hole);

    const cogGeo = new THREE.ExtrudeGeometry(cogShape, {
      depth: 0.0045,
      bevelEnabled: true,
      bevelThickness: 0.0008,
      bevelSize: 0.0008,
      bevelSegments: 2
    });
    cogGeo.rotateY(Math.PI / 2);
    const cog = new THREE.Mesh(cogGeo, mats.darkMetal);
    cog.position.set(-0.044, 0, 0);
    cog.userData.slot = "secondary";
    group.add(cog);
  }

  return group;
}

function buildFrame(THREE, mats, geom) {
  const group = new THREE.Group();
  group.name = "frame";

  const { REAR, BB, SEAT_TOP, HT_BOT, HT_TOP, steerAxis } = geom;

  // 1. Head tube + subtle brazed end lugs
  const htCurve = new THREE.CatmullRomCurve3([HT_BOT, HT_TOP]);
  const headTube = new THREE.Mesh(
    makeTaperedTube(THREE, htCurve, (u) => 0.0172 + 0.0018 * Math.pow(Math.abs(u * 2 - 1), 6), 16, 18),
    mats.paint
  );
  headTube.userData.slot = "primary";
  headTube.castShadow = true;
  headTube.receiveShadow = true;
  group.add(headTube);

  // Chrome headset cups (top & bottom of head tube)
  const cupPts = [
    [0.013, 0.0],
    [0.0185, 0.0],
    [0.0205, 0.004],
    [0.0215, 0.009],
    [0.0195, 0.014],
    [0.017, 0.017],
    [0.0185, 0.021],
    [0.0185, 0.026],
    [0.0155, 0.028],
    [0.0135, 0.030],
    [0.0125, 0.032],
    [0.0115, 0.033],
    [0.011, 0.034],
    [0.011, 0.035],
    [0.011, 0.036],
    [0.011, 0.037]
  ];
  const topCup = new THREE.Mesh(makeLathe(THREE, cupPts, 20), mats.chrome);
  topCup.position.copy(HT_TOP);
  topCup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), steerAxis);
  topCup.userData.slot = "secondary";
  group.add(topCup);

  const botCupPts = cupPts.slice(0, 16).map((p) => [p[0], -p[1] * 0.52]);
  const botCup = new THREE.Mesh(makeLathe(THREE, botCupPts, 20), mats.chrome);
  botCup.position.copy(HT_BOT);
  botCup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), steerAxis);
  botCup.userData.slot = "secondary";
  group.add(botCup);

  // 2. Seat tube
  const stCurve = new THREE.CatmullRomCurve3([BB, SEAT_TOP]);
  const seatTube = new THREE.Mesh(
    makeTaperedTube(THREE, stCurve, (u) => 0.0158 - 0.0008 * u, 16, 18),
    mats.paint
  );
  seatTube.userData.slot = "primary";
  seatTube.castShadow = true;
  seatTube.receiveShadow = true;
  group.add(seatTube);

  // Seatpost clamp collar
  const seatDir = new THREE.Vector3().subVectors(SEAT_TOP, BB).normalize();
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.018, 0.022, 18), mats.chrome);
  clamp.position.copy(SEAT_TOP);
  clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), seatDir);
  clamp.userData.slot = "secondary";
  group.add(clamp);

  // Bottom bracket shell (horizontal cylinder)
  const bbShell = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.072, 20), mats.paint);
  bbShell.rotation.z = Math.PI / 2;
  bbShell.position.copy(BB);
  bbShell.userData.slot = "primary";
  bbShell.castShadow = true;
  group.add(bbShell);

  // 3. Lower curved swan-neck step-through down tube
  const dtStart = HT_BOT.clone().addScaledVector(steerAxis, 0.028);
  const downCurve = new THREE.CatmullRomCurve3([
    dtStart,
    new THREE.Vector3(0, 0.56, 0.25),
    new THREE.Vector3(0, 0.40, 0.12),
    new THREE.Vector3(0, 0.295, 0.005),
    BB.clone()
  ]);
  const downTube = new THREE.Mesh(
    makeTaperedTube(THREE, downCurve, (u) => 0.0165 + 0.0012 * Math.sin(u * Math.PI), 32, 16),
    mats.paint
  );
  downTube.userData.slot = "primary";
  downTube.castShadow = true;
  downTube.receiveShadow = true;
  group.add(downTube);

  // 4. Upper curved twin step-through tube (classic Dutch omafiets line!)
  const utStart = HT_TOP.clone().addScaledVector(steerAxis, -0.024);
  const utEnd = BB.clone().lerp(SEAT_TOP, 0.34);
  const upperCurve = new THREE.CatmullRomCurve3([
    utStart,
    new THREE.Vector3(0, 0.72, 0.21),
    new THREE.Vector3(0, 0.55, 0.08),
    new THREE.Vector3(0, 0.445, -0.04),
    utEnd
  ]);
  const upperTube = new THREE.Mesh(
    makeTaperedTube(THREE, upperCurve, (u) => 0.0138 + 0.0008 * (1 - u), 32, 16),
    mats.paint
  );
  upperTube.userData.slot = "primary";
  upperTube.castShadow = true;
  upperTube.receiveShadow = true;
  group.add(upperTube);

  // Decorative reinforcing brace between twin step-through tubes
  const braceA = downCurve.getPointAt(0.46);
  const braceB = upperCurve.getPointAt(0.48);
  const braceCurve = new THREE.CatmullRomCurve3([braceA, braceB]);
  const brace = new THREE.Mesh(makeTaperedTube(THREE, braceCurve, 0.0075, 8, 12), mats.paint);
  brace.userData.slot = "primary";
  group.add(brace);

  // 5. Chainstays & Seatstays (left & right, gracefully curved around rear tire)
  for (const side of [-1, 1]) {
    const csCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.024, BB.y, BB.z),
      new THREE.Vector3(side * 0.052, BB.y + 0.006, BB.z - 0.10),
      new THREE.Vector3(side * 0.068, BB.y + 0.022, BB.z - 0.25),
      new THREE.Vector3(side * 0.059, REAR.y, REAR.z)
    ]);
    const cs = new THREE.Mesh(
      makeTaperedTube(THREE, csCurve, (u) => 0.0115 * (1 - 0.38 * u), 24, 12),
      mats.paint
    );
    cs.userData.slot = "primary";
    cs.castShadow = true;
    group.add(cs);

    const ssStart = SEAT_TOP.clone().addScaledVector(seatDir, -0.026);
    const ssCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.016, ssStart.y, ssStart.z),
      new THREE.Vector3(side * 0.052, ssStart.y - 0.07, ssStart.z - 0.09),
      new THREE.Vector3(side * 0.065, 0.49, -0.41),
      new THREE.Vector3(side * 0.059, REAR.y, REAR.z)
    ]);
    const ss = new THREE.Mesh(
      makeTaperedTube(THREE, ssCurve, (u) => 0.0092 * (1 - 0.25 * u), 24, 12),
      mats.paint
    );
    ss.userData.slot = "primary";
    ss.castShadow = true;
    group.add(ss);

    // Rear dropout plate
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.005, 14), mats.paint);
    drop.rotation.z = Math.PI / 2;
    drop.position.set(side * 0.059, REAR.y, REAR.z);
    drop.userData.slot = "primary";
    group.add(drop);
  }

  // Seatstay fender bridge
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.11, 10), mats.paint);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 0.635, -0.345);
  bridge.userData.slot = "primary";
  group.add(bridge);

  return group;
}

function buildSaddle(THREE, mats, geom) {
  const group = new THREE.Group();
  group.name = "saddle";

  const { BB, SEAT_TOP, SADDLE_CLAMP } = geom;

  // 1. Chrome Seatpost
  const postCurve = new THREE.CatmullRomCurve3([
    SEAT_TOP.clone().lerp(BB, 0.12),
    SADDLE_CLAMP.clone()
  ]);
  const seatpost = new THREE.Mesh(makeTaperedTube(THREE, postCurve, 0.0122, 10, 16), mats.chrome);
  seatpost.userData.slot = "secondary";
  seatpost.castShadow = true;
  group.add(seatpost);

  // Saddle top sub-group centered over SADDLE_CLAMP
  const topGroup = new THREE.Group();
  topGroup.position.set(0, SADDLE_CLAMP.y + 0.056, SADDLE_CLAMP.z - 0.012);
  topGroup.rotation.x = -0.025; // tiny ergonomic nose tilt
  group.add(topGroup);

  // 2. Sculpted Continuous Leather Saddle Top (56 x 36 dense sphere -> displaced)
  const saddleGeo = makeSculptedGeometry(THREE, 56, 36, (v) => {
    // v is on unit sphere: v.z in [-1, 1] (rear = -1, nose = +1), v.x in [-1, 1], v.y in [-1, 1]
    const zNorm = v.z; // -1 rear to +1 nose
    const t = (zNorm + 1) * 0.5; // 0 rear .. 1 nose

    // Smooth width envelope: broad rounded city-bike sitting platform at rear, narrow tapered nose
    const rearBroad = Math.pow(Math.max(0, 1 - Math.pow(t, 1.55)), 0.72);
    const halfW = 0.026 + 0.088 * rearBroad;

    // Length: 0.27m total (from -0.145 rear to +0.125 nose)
    const z = -0.01 + zNorm * 0.138;
    const x = v.x * halfW;

    // Vertical profile: hammock dip in the middle, gently raised rear cantle, slightly upturned nose
    const cantleLift = 0.015 * Math.pow(Math.max(0, 1 - t * 2.2), 2);
    const noseLift = 0.008 * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2);
    const hammock = -0.009 * Math.sin(t * Math.PI);

    // Cross-sectional dome & flared side skirts
    const edgeFactor = Math.min(1, Math.abs(v.x));
    let y;
    if (v.y >= 0) {
      // Top sitting leather: gently crowned, subtle central relief groove
      const crown = Math.pow(v.y, 0.78) * (0.020 + 0.006 * (1 - t));
      const relief = -0.0028 * Math.exp(-Math.pow(v.x * 4.5, 2)) * Math.sin(t * Math.PI);
      y = crown + relief;
    } else {
      // Underside: tucked slightly inward to create crisp hanging leather side skirts!
      const skirtDrop = (0.024 + 0.012 * rearBroad) * Math.pow(edgeFactor, 1.6);
      y = v.y * 0.008 - skirtDrop * Math.abs(v.y);
    }

    // Subtle rolled lip around the rear skirt
    const skirtFlare = v.y < 0 ? 1 + 0.05 * Math.pow(edgeFactor, 2) * (-v.y) : 1;

    v.set(x * skirtFlare, y + cantleLift + noseLift + hammock, z);
  });

  const saddleMesh = new THREE.Mesh(saddleGeo, mats.leather);
  saddleMesh.userData.slot = "accent";
  saddleMesh.castShadow = true;
  saddleMesh.receiveShadow = true;
  topGroup.add(saddleMesh);

  // 3. Seven Domed Brass Rivets along the rear cantle arc
  const rivetGeos = [];
  for (let i = -3; i <= 3; i++) {
    const f = i / 3; // -1..1
    const rx = f * 0.072;
    const rz = -0.118 + Math.abs(f) * Math.abs(f) * 0.032;
    const ry = 0.027 - Math.abs(f) * Math.abs(f) * 0.009;
    const rGeo = new THREE.SphereGeometry(0.0048, 10, 8);
    rGeo.scale(1, 0.45, 1);
    rGeo.translate(rx, ry, rz);
    rivetGeos.push(rGeo);
  }
  const rivets = new THREE.Mesh(mergeGeos(THREE, rivetGeos), mats.brass);
  rivets.userData.slot = "accent";
  topGroup.add(rivets);

  // 4. Twin Rear Helical Coil Springs (TubeGeometry along helical curves!)
  for (const side of [-1, 1]) {
    const sx = side * 0.056;
    const sz = -0.088;
    const turns = 5.2;
    const springPts = [];
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const ang = u * turns * Math.PI * 2;
      // Classic barrel-conical Brooks-style spring profile
      const rad = 0.0145 + 0.0065 * Math.sin(u * Math.PI) + 0.003 * (1 - u);
      const sy = -0.068 + u * 0.068;
      springPts.push(new THREE.Vector3(sx + Math.cos(ang) * rad, sy, sz + Math.sin(ang) * rad));
    }
    const springCurve = new THREE.CatmullRomCurve3(springPts);
    const springMesh = new THREE.Mesh(
      makeTaperedTube(THREE, springCurve, 0.0032, 72, 7),
      mats.chrome
    );
    springMesh.userData.slot = "secondary";
    springMesh.castShadow = true;
    topGroup.add(springMesh);

    // Top & bottom spring retainer washers
    for (const wy of [-0.071, 0.002]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.006, 14), mats.chrome);
      cap.position.set(sx, wy, sz);
      cap.userData.slot = "secondary";
      topGroup.add(cap);
    }

    // Steel saddle undercarriage rails
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.012, -0.014, 0.082),
      new THREE.Vector3(side * 0.022, -0.056, 0.042),
      new THREE.Vector3(side * 0.024, -0.060, -0.020),
      new THREE.Vector3(sx, -0.072, sz)
    ]);
    const rail = new THREE.Mesh(makeTaperedTube(THREE, railCurve, 0.0038, 22, 8), mats.chrome);
    rail.userData.slot = "secondary";
    topGroup.add(rail);
  }

  // Rear bridge bar joining spring bottoms
  const rearBar = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.125, 10), mats.chrome);
  rearBar.rotation.z = Math.PI / 2;
  rearBar.position.set(0, -0.072, -0.088);
  rearBar.userData.slot = "secondary";
  topGroup.add(rearBar);

  // Cast seatpost-to-rail clamp hardware
  const clampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.056, 14), mats.chrome);
  clampBody.rotation.z = Math.PI / 2;
  clampBody.position.set(0, -0.058, 0.008);
  clampBody.userData.slot = "secondary";
  topGroup.add(clampBody);

  return group;
}

function buildRearFenderAndLamp(THREE, mats, geom) {
  const group = new THREE.Group();
  group.name = "rearFender";

  const { REAR, R } = geom;
  const fendR = R + 0.016; // 0.336

  // Rear fender sweeps from behind BB (phi = 0.05 rad) up over top (PI/2) down rear (PI + 0.38)
  const phiStart = -0.10;
  const phiEnd = Math.PI + 0.44;
  const fenderGeo = makeCurvedFender(THREE, fendR, 0.029, 0.016, 0.0028, phiStart, phiEnd, 52, 12);
  const fender = new THREE.Mesh(fenderGeo, mats.fender);
  fender.position.copy(REAR);
  fender.userData.slot = "primary";
  fender.castShadow = true;
  fender.receiveShadow = true;
  group.add(fender);

  // Chrome fender stays (2 pairs)
  const stayAngles = [Math.PI * 0.86, Math.PI + 0.28];
  for (const ang of stayAngles) {
    const sy = Math.sin(ang) * (fendR + 0.008);
    const sz = Math.cos(ang) * (fendR + 0.008);
    for (const side of [-1, 1]) {
      const stayCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(REAR.x + side * 0.062, REAR.y - 0.006, REAR.z - 0.008),
        new THREE.Vector3(REAR.x + side * 0.056, REAR.y + sy * 0.55, REAR.z + sz * 0.55),
        new THREE.Vector3(REAR.x + side * 0.030, REAR.y + sy, REAR.z + sz)
      ]);
      const stay = new THREE.Mesh(makeTaperedTube(THREE, stayCurve, 0.0022, 14, 7), mats.chrome);
      stay.userData.slot = "secondary";
      group.add(stay);
    }
  }

  // Petite Vintage Ruby Tail Lamp on rear fender
  const lampAng = Math.PI + 0.12;
  const lampGroup = new THREE.Group();
  lampGroup.position.set(
    REAR.x,
    REAR.y + Math.sin(lampAng) * (fendR + 0.017),
    REAR.z + Math.cos(lampAng) * (fendR + 0.017)
  );
  lampGroup.rotation.x = 0.14;

  const lampPts = [
    [0.003, -0.012],
    [0.010, -0.011],
    [0.013, -0.006],
    [0.014, 0.0],
    [0.0135, 0.008],
    [0.0125, 0.014],
    [0.0115, 0.018],
    [0.011, 0.020],
    [0.0105, 0.021],
    [0.010, 0.0215],
    [0.0095, 0.022],
    [0.0085, 0.022],
    [0.007, 0.022],
    [0.005, 0.022],
    [0.003, 0.022],
    [0.001, 0.022]
  ];
  const lampBody = new THREE.Mesh(makeLathe(THREE, lampPts, 18), mats.chrome);
  lampBody.rotation.x = -Math.PI / 2;
  lampBody.userData.slot = "secondary";
  lampGroup.add(lampBody);

  const rubyLens = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 16, 12), mats.rubyGlow);
  rubyLens.scale.set(1, 1, 0.62);
  rubyLens.position.z = -0.021;
  rubyLens.userData.slot = "glow";
  lampGroup.add(rubyLens);

  group.add(lampGroup);
  return group;
}

function buildDrivetrain(THREE, mats, geom) {
  const group = new THREE.Group();
  group.name = "drivetrain";

  const { BB, REAR } = geom;
  const rightX = -0.046; // rider's right side

  // 1. Classic Sweeping Dutch Chainguard (ExtrudeGeometry + curved dome bend!)
  const cgShape = new THREE.Shape();
  // Local 2D: x along -Z (from BB=0 toward rear=+0.43), y along +Y
  cgShape.moveTo(-0.105, 0.0);
  cgShape.bezierCurveTo(-0.105, 0.088, -0.02, 0.112, 0.06, 0.095);
  cgShape.bezierCurveTo(0.20, 0.068, 0.34, 0.068, 0.455, 0.062);
  cgShape.bezierCurveTo(0.49, 0.060, 0.495, 0.026, 0.468, 0.015);
  cgShape.bezierCurveTo(0.36, -0.005, 0.21, -0.012, 0.08, -0.048);
  cgShape.bezierCurveTo(0.02, -0.072, -0.04, -0.082, -0.078, -0.062);
  cgShape.bezierCurveTo(-0.102, -0.048, -0.105, -0.02, -0.105, 0.0);

  const cgGeo = makeCurvedExtrude(
    THREE,
    cgShape,
    {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.005,
      bevelSegments: 4,
      curveSegments: 24
    },
    (v) => {
      // Gently bow outward like stamped sheet steel
      const bulge = 0.009 * Math.max(0, 1 - Math.pow((v.x - 0.02) / 0.35, 2));
      v.z += bulge;
    }
  );
  // Map chainguard UVs cleanly for the painted vintage stripe
  const cgPos = cgGeo.attributes.position;
  const cgUv = cgGeo.attributes.uv;
  for (let i = 0; i < cgPos.count; i++) {
    const px = cgPos.getX(i);
    const py = cgPos.getY(i);
    cgUv.setXY(i, (px + 0.11) / 0.62, (py + 0.09) / 0.21);
  }
  cgUv.needsUpdate = true;

  // Rotate so shape +X goes along -Z (from BB to REAR), and depth goes outward along -X
  cgGeo.rotateY(Math.PI / 2);
  const chainguard = new THREE.Mesh(cgGeo, mats.chainguard);
  chainguard.position.set(rightX - 0.024, BB.y + 0.006, BB.z);
  chainguard.userData.slot = "primary";
  chainguard.castShadow = true;
  chainguard.receiveShadow = true;
  group.add(chainguard);

  // 2. Perforated Classic Chainring (partially visible below chainguard)
  const crShape = new THREE.Shape();
  crShape.absarc(0, 0, 0.084, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * 0.048, Math.sin(a) * 0.048, 0.017, 0, Math.PI * 2, true);
    crShape.holes.push(h);
  }
  const crGeo = new THREE.ExtrudeGeometry(crShape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 24
  });
  crGeo.rotateY(Math.PI / 2);
  const chainring = new THREE.Mesh(crGeo, mats.chrome);
  chainring.position.set(rightX, BB.y, BB.z);
  chainring.userData.slot = "secondary";
  group.add(chainring);

  // 3. Lower & Upper Chain Loop
  const chainPts = [
    new THREE.Vector3(rightX + 0.002, BB.y - 0.084, BB.z),
    new THREE.Vector3(rightX + 0.002, (BB.y - 0.084 + REAR.y - 0.034) * 0.5 - 0.004, (BB.z + REAR.z) * 0.5),
    new THREE.Vector3(rightX + 0.002, REAR.y - 0.034, REAR.z),
    new THREE.Vector3(rightX + 0.002, REAR.y, REAR.z - 0.035),
    new THREE.Vector3(rightX + 0.002, REAR.y + 0.034, REAR.z),
    new THREE.Vector3(rightX + 0.002, BB.y + 0.084, BB.z),
    new THREE.Vector3(rightX + 0.002, BB.y, BB.z + 0.084)
  ];
  const chainCurve = new THREE.CatmullRomCurve3(chainPts, true);
  const chainMesh = new THREE.Mesh(
    makeTaperedTube(THREE, chainCurve, 0.0042, 48, 6, { closed: true, scaleN: 1.25, scaleB: 0.7 }),
    mats.darkMetal
  );
  chainMesh.userData.slot = "secondary";
  group.add(chainMesh);

  // 4. Tapered Crank Arms & Vintage Block Pedals (180 deg opposed)
  const crankLen = 0.165;
  const crankAng = 0.52; // pleasing diagonal pose

  // Crank spindle
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.135, 14), mats.chrome);
  spindle.rotation.z = Math.PI / 2;
  spindle.position.copy(BB);
  spindle.userData.slot = "secondary";
  group.add(spindle);

  for (const side of [-1, 1]) {
    const a = side === -1 ? crankAng : crankAng + Math.PI;
    const cx = side * 0.068;
    const endY = BB.y + Math.sin(a) * crankLen;
    const endZ = BB.z + Math.cos(a) * crankLen;

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx, BB.y, BB.z),
      new THREE.Vector3(cx + side * 0.011, BB.y + Math.sin(a) * crankLen * 0.5, BB.z + Math.cos(a) * crankLen * 0.5),
      new THREE.Vector3(cx + side * 0.014, endY, endZ)
    ]);
    const arm = new THREE.Mesh(
      makeTaperedTube(THREE, armCurve, (u) => 0.0135 - 0.0038 * u, 14, 10, { scaleN: 0.55, scaleB: 1.15 }),
      mats.chrome
    );
    arm.userData.slot = "secondary";
    arm.castShadow = true;
    group.add(arm);

    // Vintage Rubber-Block Pedal (always level!)
    const pedal = new THREE.Group();
    pedal.position.set(cx + side * 0.056, endY, endZ);

    const pShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.088, 10), mats.chrome);
    pShaft.rotation.z = Math.PI / 2;
    pShaft.position.x = -side * 0.010;
    pShaft.userData.slot = "secondary";
    pedal.add(pShaft);

    // Front & back sculpted rubber tread blocks
    for (const pz of [-0.023, 0.023]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.019, 0.018), mats.rubber);
      block.position.set(0, 0, pz);
      block.userData.slot = "accent";
      block.castShadow = true;
      pedal.add(block);
    }

    // Chrome side endplates
    for (const px of [-0.042, 0.042]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.068), mats.chrome);
      plate.position.set(px, 0, 0);
      plate.userData.slot = "secondary";
      pedal.add(plate);
    }

    // Tiny amber pedal reflectors
    for (const pz of [-0.034, 0.034]) {
      const refl = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.009, 0.003), mats.amberGlow);
      refl.position.set(0, 0, pz);
      refl.userData.slot = "glow";
      pedal.add(refl);
    }

    group.add(pedal);
  }

  return group;
}

function buildBasket(THREE, mats, geom) {
  const group = new THREE.Group();
  group.name = "basket";

  // Rounded-rectangle lofted wicker basket (open top, solid woven walls + floor)
  const h = 0.205;
  const botW = 0.128; // half-width bottom (25.6cm wide)
  const botD = 0.088; // half-depth bottom (17.6cm deep)
  const topW = 0.156; // half-width top (31.2cm wide)
  const topD = 0.112; // half-depth top (22.4cm deep)
  const wallT = 0.010;

  function superEllipse(ang, rx, rz) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const p = 0.42; // rounded rectangle corner exponent
    const sx = Math.sign(c) * Math.pow(Math.abs(c), p);
    const sz = Math.sign(s) * Math.pow(Math.abs(s), p);
    return [sx * rx, -sz * rz];
  }

  const segU = 44;
  const segV = 12;
  const cols = segU + 1;
  const rows = segV + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Outer wall
  for (let i = 0; i < rows; i++) {
    const v = i / segV;
    const bulge = 0.006 * Math.sin(v * Math.PI);
    const rx = botW + (topW - botW) * v + bulge;
    const rz = botD + (topD - botD) * v + bulge;
    const y = v * h;
    for (let j = 0; j < cols; j++) {
      const u = j / segU;
      const ang = u * Math.PI * 2;
      const [px, pz] = superEllipse(ang, rx, rz);
      positions.push(px, y, pz);
      uvs.push(u, v);
    }
  }
  const innerOff = rows * cols;
  // Inner wall
  for (let i = 0; i < rows; i++) {
    const v = i / segV;
    const bulge = 0.006 * Math.sin(v * Math.PI);
    const rx = botW + (topW - botW) * v + bulge - wallT;
    const rz = botD + (topD - botD) * v + bulge - wallT;
    const y = 0.008 + v * (h - 0.008);
    for (let j = 0; j < cols; j++) {
      const u = j / segU;
      const ang = u * Math.PI * 2;
      const [px, pz] = superEllipse(ang, rx, rz);
      positions.push(px, y, pz);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < segV; i++) {
    for (let j = 0; j < segU; j++) {
      const a = i * cols + j;
      const b = i * cols + j + 1;
      const c = (i + 1) * cols + j + 1;
      const d = (i + 1) * cols + j;
      // Outer: dTh x dV points outward -> (a, b, d)
      indices.push(a, b, d, b, c, d);

      const ia = innerOff + a;
      const ib = innerOff + b;
      const ic = innerOff + c;
      const id = innerOff + d;
      indices.push(ia, id, ib, ib, id, ic);
    }
  }

  // Bottom floor cap (both underside & inner floor)
  const botCenterOuter = positions.length / 3;
  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);
  const botCenterInner = positions.length / 3;
  positions.push(0, 0.008, 0);
  uvs.push(0.5, 0.5);

  for (let j = 0; j < segU; j++) {
    indices.push(botCenterOuter, j + 1, j);
    indices.push(botCenterInner, innerOff + j, innerOff + j + 1);
  }

  const basketGeo = new THREE.BufferGeometry();
  basketGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  basketGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  basketGeo.setIndex(indices);
  basketGeo.computeVertexNormals();

  const basketMesh = new THREE.Mesh(basketGeo, mats.wicker);
  basketMesh.userData.slot = "accent";
  basketMesh.castShadow = true;
  basketMesh.receiveShadow = true;
  group.add(basketMesh);

  // Thick braided wicker top rim roll & base rim roll
  const makeRimRoll = (yPos, rx, rz, rad) => {
    const pts = [];
    for (let j = 0; j < 36; j++) {
      const [px, pz] = superEllipse((j / 36) * Math.PI * 2, rx, rz);
      pts.push(new THREE.Vector3(px, yPos, pz));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const mesh = new THREE.Mesh(
      makeTaperedTube(THREE, curve, (u) => rad * (1 + 0.06 * Math.sin(u * Math.PI * 48)), 72, 10, { closed: true }),
      mats.wickerRim
    );
    mesh.userData.slot = "accent";
    mesh.castShadow = true;
    return mesh;
  };
  group.add(makeRimRoll(h, topW - wallT * 0.5, topD - wallT * 0.5, 0.0125));
  group.add(makeRimRoll(0.006, botW - wallT * 0.35, botD - wallT * 0.35, 0.009));

  // Cozy folded cream-and-primary ticking-stripe linen cushion pad inside the basket!
  const padGeo = makeSculptedGeometry(THREE, 32, 20, (v) => {
    // Softly puffed rounded-rectangle cloth cushion nestled inside the basket floor
    const p = 0.55;
    const sx = Math.sign(v.x) * Math.pow(Math.abs(v.x), p);
    const sz = Math.sign(v.z) * Math.pow(Math.abs(v.z), p);
    const rx = (botW - wallT - 0.008) * sx;
    const rz = (botD - wallT - 0.008) * sz;
    const fold = 0.004 * Math.sin(v.x * 5 + v.z * 3);
    const y = 0.022 + v.y * 0.016 + (v.y > 0 ? fold : 0);
    v.set(rx, y, rz);
  });
  const padMesh = new THREE.Mesh(padGeo, mats.liner);
  padMesh.userData.slot = "primary";
  padMesh.receiveShadow = true;
  group.add(padMesh);

  // Twin Buckled Leather Straps looping from rear basket wall to handlebars
  for (const side of [-1, 1]) {
    const sx = side * 0.088;
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, h - 0.042, -topD + 0.004),
      new THREE.Vector3(sx, h - 0.025, -topD - 0.022),
      new THREE.Vector3(sx, h + 0.016, -topD - 0.042),
      new THREE.Vector3(sx, h + 0.036, -topD - 0.022),
      new THREE.Vector3(sx, h + 0.012, -topD - 0.002),
      new THREE.Vector3(sx, h - 0.042, -topD + 0.004)
    ]);
    const strap = new THREE.Mesh(
      makeTaperedTube(THREE, strapCurve, 0.0075, 24, 8, { closed: true, scaleN: 0.35, scaleB: 1.4 }),
      mats.leather
    );
    strap.userData.slot = "accent";
    strap.castShadow = true;
    group.add(strap);

    // Brass buckle frame on top of strap
    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0022, 8, 12), mats.brass);
    buckle.position.set(sx, h - 0.015, -topD - 0.020);
    buckle.rotation.x = Math.PI * 0.38;
    buckle.userData.slot = "accent";
    group.add(buckle);
  }

  // Chrome basket support strut from basket bottom down to fork crown
  const strutTarget = geom.basketStrutTarget;
  for (const side of [-1, 1]) {
    const strutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.055, 0.002, 0.02),
      new THREE.Vector3(side * 0.055, -0.008, -0.06),
      new THREE.Vector3(side * 0.032, strutTarget.y * 0.55, strutTarget.z * 0.72),
      new THREE.Vector3(side * 0.014, strutTarget.y, strutTarget.z)
    ]);
    const strut = new THREE.Mesh(makeTaperedTube(THREE, strutCurve, 0.0036, 18, 8), mats.chrome);
    strut.userData.slot = "secondary";
    group.add(strut);
  }

  return group;
}

function buildFrontAssembly(THREE, mats, geom) {
  // Built in steerTurn local frame:
  // Origin = FORK_CROWN, local +Y = steerAxis, local +Z = steerFwd
  const steerTurn = new THREE.Group();
  steerTurn.name = "head";

  const { headTilt, R, rTube, forkLength, rake } = geom;
  const FRONT_LOCAL = new THREE.Vector3(0, -forkLength, rake);

  // 1. Fork Crown (sculpted rounded shoulder bridge)
  const crownGeo = makeSculptedGeometry(THREE, 28, 18, (v) => {
    v.set(v.x * 0.058, v.y * 0.017, v.z * 0.022);
  });
  const crown = new THREE.Mesh(crownGeo, mats.paint);
  crown.userData.slot = "primary";
  crown.castShadow = true;
  steerTurn.add(crown);

  // Steerer tube stub rising into head tube
  const steerer = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.19, 14), mats.chrome);
  steerer.position.y = 0.095;
  steerer.userData.slot = "secondary";
  steerTurn.add(steerer);

  // 2. Curved & Tapered Front Fork Blades (graceful vintage J-rake!)
  for (const side of [-1, 1]) {
    const forkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.044, 0.0, 0.0),
      new THREE.Vector3(side * 0.053, -forkLength * 0.36, rake * 0.08),
      new THREE.Vector3(side * 0.054, -forkLength * 0.72, rake * 0.42),
      new THREE.Vector3(side * 0.051, -forkLength, rake)
    ]);
    const blade = new THREE.Mesh(
      makeTaperedTube(THREE, forkCurve, (u) => 0.0125 * (1 - 0.38 * u), 24, 14, { scaleN: 1.28, scaleB: 0.75 }),
      mats.paint
    );
    blade.userData.slot = "primary";
    blade.castShadow = true;
    blade.receiveShadow = true;
    steerTurn.add(blade);

    // Front dropout tab
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.005, 12), mats.paint);
    drop.rotation.z = Math.PI / 2;
    drop.position.set(side * 0.051, -forkLength, rake);
    drop.userData.slot = "primary";
    steerTurn.add(drop);
  }

  // 3. Front Wheel + Front Fender + Leather Mudflap (level sub-group at FRONT_LOCAL)
  const frontWheelLevel = new THREE.Group();
  frontWheelLevel.position.copy(FRONT_LOCAL);
  frontWheelLevel.rotation.x = headTilt; // restores true horizontal/vertical in local space
  steerTurn.add(frontWheelLevel);

  const frontWheel = buildWheel(THREE, mats, { isRear: false, R, rTube });
  frontWheelLevel.add(frontWheel);
  steerTurn.userData.frontTireMesh = frontWheel.userData.tireMesh;

  // Front Fender
  const fendR = R + 0.016;
  const fPhiStart = Math.PI * 0.22;
  const fPhiEnd = Math.PI + 0.36;
  const fFenderGeo = makeCurvedFender(THREE, fendR, 0.029, 0.016, 0.0028, fPhiStart, fPhiEnd, 44, 12);
  const frontFender = new THREE.Mesh(fFenderGeo, mats.fender);
  frontFender.userData.slot = "primary";
  frontFender.castShadow = true;
  frontFender.receiveShadow = true;
  frontWheelLevel.add(frontFender);

  // Cute chrome fender tip ornament at the front crest
  const finCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, Math.sin(0.82) * (fendR + 0.017), Math.cos(0.82) * (fendR + 0.017)),
    new THREE.Vector3(0, Math.sin(0.70) * (fendR + 0.024), Math.cos(0.70) * (fendR + 0.024)),
    new THREE.Vector3(0, Math.sin(0.56) * (fendR + 0.018), Math.cos(0.56) * (fendR + 0.018))
  ]);
  const crestFin = new THREE.Mesh(makeTaperedTube(THREE, finCurve, (u) => 0.002 + 0.004 * Math.sin(u * Math.PI), 12, 8), mats.chrome);
  crestFin.userData.slot = "secondary";
  frontWheelLevel.add(crestFin);

  // Front Fender Stays
  const fStayAng = Math.PI + 0.18;
  const fsy = Math.sin(fStayAng) * (fendR + 0.008);
  const fsz = Math.cos(fStayAng) * (fendR + 0.008);
  for (const side of [-1, 1]) {
    const stayCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.054, -0.004, -0.006),
      new THREE.Vector3(side * 0.050, fsy * 0.55, fsz * 0.55),
      new THREE.Vector3(side * 0.029, fsy, fsz)
    ]);
    const stay = new THREE.Mesh(makeTaperedTube(THREE, stayCurve, 0.0022, 14, 7), mats.chrome);
    stay.userData.slot = "secondary";
    frontWheelLevel.add(stay);
  }

  // Sculpted Leather Mudflap at bottom tail of front fender (ExtrudeGeometry + bend!)
  const flapGroup = new THREE.Group();
  flapGroup.name = "mudflap";
  flapGroup.position.set(0, Math.sin(fPhiEnd) * (fendR + 0.008), Math.cos(fPhiEnd) * (fendR + 0.008));
  flapGroup.rotation.x = 0.22;

  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.024, 0.0);
  flapShape.bezierCurveTo(-0.027, -0.032, -0.036, -0.068, -0.030, -0.088);
  flapShape.bezierCurveTo(-0.016, -0.104, 0.016, -0.104, 0.030, -0.088);
  flapShape.bezierCurveTo(0.036, -0.068, 0.027, -0.032, 0.024, 0.0);
  flapShape.closePath();

  const flapGeo = makeCurvedExtrude(
    THREE,
    flapShape,
    { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2 },
    (v) => {
      // Gently curl around wheel width and flare slightly backward at the tip
      v.z += -0.012 * Math.pow(v.x / 0.034, 2) - 0.018 * Math.pow(v.y / 0.10, 2);
    }
  );
  const flapMesh = new THREE.Mesh(flapGeo, mats.leather);
  flapMesh.userData.slot = "accent";
  flapMesh.castShadow = true;
  flapGroup.add(flapMesh);

  // Two tiny brass mudflap rivets
  for (const rx of [-0.012, 0.012]) {
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 8, 6), mats.brass);
    riv.position.set(rx, -0.014, 0.003);
    riv.userData.slot = "accent";
    flapGroup.add(riv);
  }
  frontWheelLevel.add(flapGroup);

  // 4. Front Dual-Pivot Caliper Brake (hugging front rim below fork crown)
  const brakeGroup = new THREE.Group();
  brakeGroup.position.set(0, -0.012, 0.022);
  brakeGroup.rotation.x = headTilt;
  for (const side of [-1, 1]) {
    const armC = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.005, 0),
      new THREE.Vector3(side * 0.034, -0.018, 0.004),
      new THREE.Vector3(side * 0.026, -0.056, 0.002)
    ]);
    const armM = new THREE.Mesh(makeTaperedTube(THREE, armC, 0.0042, 12, 8), mats.chrome);
    armM.userData.slot = "secondary";
    brakeGroup.add(armM);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.012, 0.036), mats.rubber);
    pad.position.set(side * 0.019, -0.055, 0.0);
    pad.userData.slot = "accent";
    brakeGroup.add(pad);
  }
  steerTurn.add(brakeGroup);

  // 5. Vintage Bullet Headlight (LatheGeometry >= 18 points) on fork-crown bracket
  const hlGroup = new THREE.Group();
  hlGroup.position.set(0, 0.028, 0.092);
  hlGroup.rotation.x = headTilt;

  // Chrome bracket from fork crown to headlight
  const brkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.026, -0.078),
    new THREE.Vector3(0, -0.026, -0.030),
    new THREE.Vector3(0, -0.012, -0.006)
  ]);
  const hlBracket = new THREE.Mesh(makeTaperedTube(THREE, brkCurve, 0.0038, 12, 8), mats.chrome);
  hlBracket.userData.slot = "secondary";
  hlGroup.add(hlBracket);

  const hlPts = [
    [0.001, -0.048],
    [0.009, -0.046],
    [0.016, -0.041],
    [0.021, -0.033],
    [0.0245, -0.024],
    [0.027, -0.014],
    [0.0285, -0.003],
    [0.0295, 0.008],
    [0.030, 0.018],
    [0.0305, 0.025],
    [0.031, 0.030],
    [0.0315, 0.034],
    [0.030, 0.036],
    [0.0285, 0.035],
    [0.027, 0.032],
    [0.0255, 0.028],
    [0.024, 0.026],
    [0.022, 0.026]
  ];
  const hlBody = new THREE.Mesh(makeLathe(THREE, hlPts, 24), mats.paint);
  hlBody.rotation.x = Math.PI / 2;
  hlBody.userData.slot = "primary";
  hlBody.castShadow = true;
  hlGroup.add(hlBody);

  // Chrome visor bezel ring
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.0302, 0.0036, 10, 24), mats.chrome);
  bezel.position.z = 0.033;
  bezel.userData.slot = "secondary";
  hlGroup.add(bezel);

  // Glowing warm glass headlight lens
  const hlLens = new THREE.Mesh(new THREE.SphereGeometry(0.0285, 20, 14), mats.headlightGlow);
  hlLens.scale.set(1, 1, 0.36);
  hlLens.position.z = 0.031;
  hlLens.name = "headlightGlow";
  hlLens.userData.slot = "glow";
  hlGroup.add(hlLens);

  steerTurn.add(hlGroup);

  // 6. Quill Stem + Swept-Back Dutch Handlebars + Leather Grips + Bell + Brake Levers
  const stemTopY = 0.335; // rises ~14cm above head tube top
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.165, 0),
    new THREE.Vector3(0, stemTopY - 0.02, 0),
    new THREE.Vector3(0, stemTopY + 0.018, 0.022),
    new THREE.Vector3(0, stemTopY + 0.028, 0.068)
  ]);
  const quillStem = new THREE.Mesh(makeTaperedTube(THREE, stemCurve, 0.0112, 20, 14), mats.chrome);
  quillStem.userData.slot = "secondary";
  quillStem.castShadow = true;
  steerTurn.add(quillStem);

  // Handlebar sub-group centered at stem clamp, levelled horizontally
  const barGroup = new THREE.Group();
  barGroup.position.set(0, stemTopY + 0.028, 0.068);
  barGroup.rotation.x = headTilt;
  steerTurn.add(barGroup);

  // Stem clamp barrel
  const stemClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.044, 16), mats.chrome);
  stemClamp.rotation.z = Math.PI / 2;
  stemClamp.userData.slot = "secondary";
  barGroup.add(stemClamp);

  // Swept-back North Road / Dutch Cruiser Handlebar (one continuous smooth tube!)
  const barPts = [
    new THREE.Vector3(-0.278, 0.012, -0.175),
    new THREE.Vector3(-0.268, 0.026, -0.065),
    new THREE.Vector3(-0.222, 0.032, 0.012),
    new THREE.Vector3(-0.115, 0.016, 0.016),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.115, 0.016, 0.016),
    new THREE.Vector3(0.222, 0.032, 0.012),
    new THREE.Vector3(0.268, 0.026, -0.065),
    new THREE.Vector3(0.278, 0.012, -0.175)
  ];
  const barCurve = new THREE.CatmullRomCurve3(barPts);
  const handlebar = new THREE.Mesh(makeTaperedTube(THREE, barCurve, 0.0112, 56, 14), mats.chrome);
  handlebar.userData.slot = "secondary";
  handlebar.castShadow = true;
  barGroup.add(handlebar);

  // Ergonomic Leather Handlebar Grips (LatheGeometry >= 18 points)
  const gripPts = [
    [0.0115, 0.0],
    [0.0175, 0.002],
    [0.0185, 0.006],
    [0.0155, 0.012],
    [0.0148, 0.024],
    [0.0155, 0.038],
    [0.0166, 0.054],
    [0.0172, 0.070],
    [0.0170, 0.084],
    [0.0162, 0.096],
    [0.0156, 0.106],
    [0.0168, 0.114],
    [0.0172, 0.119],
    [0.0160, 0.123],
    [0.0135, 0.126],
    [0.0095, 0.128],
    [0.0045, 0.129],
    [0.001, 0.1295]
  ];
  const gripGeo = makeLathe(THREE, gripPts, 20);
  const yUp = new THREE.Vector3(0, 1, 0);

  for (const side of [-1, 1]) {
    const uStart = side === -1 ? 0.155 : 0.845;
    const uEnd = side === -1 ? 0.005 : 0.995;
    const pStart = barCurve.getPointAt(uStart);
    const pEnd = barCurve.getPointAt(uEnd);
    const gDir = new THREE.Vector3().subVectors(pEnd, pStart).normalize();

    const grip = new THREE.Mesh(gripGeo, mats.leather);
    grip.position.copy(pStart);
    grip.quaternion.setFromUnitVectors(yUp, gDir);
    grip.userData.slot = "accent";
    grip.castShadow = true;
    barGroup.add(grip);

    // Chrome end-cap stud
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), mats.chrome);
    cap.scale.set(1, 0.45, 1);
    cap.position.copy(pStart).addScaledVector(gDir, 0.129);
    cap.quaternion.setFromUnitVectors(yUp, gDir);
    cap.userData.slot = "secondary";
    barGroup.add(cap);

    // Curved Chrome Brake Lever tucked beneath grip
    const lvClampPos = barCurve.getPointAt(side === -1 ? 0.175 : 0.825);
    const lvClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.016, 12), mats.chrome);
    lvClamp.position.copy(lvClampPos);
    lvClamp.quaternion.setFromUnitVectors(yUp, gDir);
    lvClamp.userData.slot = "secondary";
    barGroup.add(lvClamp);

    const leverCurve = new THREE.CatmullRomCurve3([
      lvClampPos.clone().add(new THREE.Vector3(side * 0.010, -0.010, 0.006)),
      lvClampPos.clone().add(new THREE.Vector3(side * 0.032, -0.020, -0.034)),
      lvClampPos.clone().add(new THREE.Vector3(side * 0.036, -0.025, -0.088)),
      lvClampPos.clone().add(new THREE.Vector3(side * 0.044, -0.027, -0.104))
    ]);
    const lever = new THREE.Mesh(
      makeTaperedTube(THREE, leverCurve, (u) => 0.0052 - 0.0015 * u + (u > 0.88 ? 0.0028 : 0), 16, 8, { scaleN: 1.4, scaleB: 0.65 }),
      mats.chrome
    );
    lever.userData.slot = "secondary";
    barGroup.add(lever);
  }

  // 7. Classic Gleaming Bicycle Bell (on rider's left +X inner curve, LatheGeometry >= 18 pts)
  const bellPos = barCurve.getPointAt(0.765);
  const bellGroup = new THREE.Group();
  bellGroup.name = "bell";
  bellGroup.position.copy(bellPos).add(new THREE.Vector3(-0.004, 0.015, 0.004));
  bellGroup.rotation.z = -0.14;

  // Handlebar clamp ring
  const bClamp = new THREE.Mesh(new THREE.TorusGeometry(0.0128, 0.0028, 8, 16), mats.chrome);
  bClamp.position.y = -0.015;
  bClamp.rotation.y = 0.5;
  bClamp.userData.slot = "secondary";
  bellGroup.add(bClamp);

  // Bell pedestal + gleaming dome + top finial
  const bellPts = [
    [0.005, -0.006],
    [0.009, -0.004],
    [0.012, 0.001],
    [0.024, 0.003],
    [0.0275, 0.006],
    [0.0282, 0.010],
    [0.0278, 0.015],
    [0.0260, 0.020],
    [0.0230, 0.0245],
    [0.0188, 0.0282],
    [0.0138, 0.0308],
    [0.0085, 0.0322],
    [0.0045, 0.0328],
    [0.0052, 0.0345],
    [0.0048, 0.0365],
    [0.0032, 0.0378],
    [0.0015, 0.0382],
    [0.0005, 0.0384]
  ];
  const bellDome = new THREE.Mesh(makeLathe(THREE, bellPts, 28), mats.bellMetal);
  bellDome.userData.slot = "secondary";
  bellDome.castShadow = true;
  bellGroup.add(bellDome);

  // Bell thumb clapper lever (named for charming idle tap!)
  const clapperPivot = new THREE.Group();
  clapperPivot.name = "bellClapper";
  clapperPivot.position.set(0, 0.004, 0);
  const clapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.014, 0, -0.008),
    new THREE.Vector3(0.024, -0.002, -0.026),
    new THREE.Vector3(0.031, -0.002, -0.044)
  ]);
  const clapArm = new THREE.Mesh(makeTaperedTube(THREE, clapCurve, 0.0024, 10, 7), mats.brass);
  clapArm.userData.slot = "accent";
  clapperPivot.add(clapArm);

  const thumbPad = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.0035, 12), mats.brass);
  thumbPad.position.set(0.032, -0.001, -0.046);
  thumbPad.rotation.x = Math.PI / 2;
  thumbPad.rotation.z = -0.35;
  thumbPad.userData.slot = "accent";
  clapperPivot.add(thumbPad);
  bellGroup.add(clapperPivot);

  barGroup.add(bellGroup);

  // 8. Woven Wicker Front Basket (mounted ahead of handlebars, supported by fork crown)
  const basketPos = new THREE.Vector3(0, stemTopY - 0.165, 0.195);
  const basketGroup = new THREE.Group();
  basketGroup.position.copy(basketPos);
  basketGroup.rotation.x = headTilt - 0.03; // nearly level, very slight nostalgic tilt

  // Compute fork crown point in basketGroup local coordinates for exact support strut contact
  const crownInBasket = new THREE.Vector3(0, -basketPos.y, -basketPos.z);
  crownInBasket.applyAxisAngle(new THREE.Vector3(1, 0, 0), -(headTilt - 0.03));
  const basketContent = buildBasket(THREE, mats, { basketStrutTarget: crownInBasket });
  basketGroup.add(basketContent);
  steerTurn.add(basketGroup);

  // 9. Sweeping Vintage Cream Brake Cable (from left brake lever gracefully down to front brake caliper)
  const cableStart = barCurve.getPointAt(0.185).clone().add(new THREE.Vector3(0, -0.008, 0.014));
  // Transform cableStart from barGroup space to steerTurn space
  const cableStartSteer = cableStart.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), headTilt).add(barGroup.position);
  const cableCurve = new THREE.CatmullRomCurve3([
    cableStartSteer,
    new THREE.Vector3(-0.145, stemTopY - 0.04, 0.135),
    new THREE.Vector3(-0.085, 0.175, 0.125),
    new THREE.Vector3(-0.028, 0.058, 0.058),
    new THREE.Vector3(-0.012, -0.002, 0.025)
  ]);
  const brakeCable = new THREE.Mesh(makeTaperedTube(THREE, cableCurve, 0.0026, 28, 7), mats.cable);
  brakeCable.userData.slot = "accent";
  steerTurn.add(brakeCable);

  return steerTurn;
}

function buildKickstand(THREE, mats, localPivot, localFloorPt, localFloorNormal) {
  const group = new THREE.Group();
  group.name = "kickstand";

  // Mounting plate clamped beneath chainstays just behind bottom bracket
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.014, 0.036), mats.chrome);
  plate.position.copy(localPivot).add(new THREE.Vector3(-0.012, 0.010, 0));
  plate.userData.slot = "secondary";
  group.add(plate);

  // Hinge knuckle
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.026, 12), mats.chrome);
  knuckle.rotation.x = Math.PI / 2;
  knuckle.position.copy(localPivot);
  knuckle.userData.slot = "secondary";
  group.add(knuckle);

  // Kickstand tapered chrome leg from pivot straight to exact floor point (minus rubber foot thickness)
  const footH = 0.016;
  const footTop = localFloorPt.clone().addScaledVector(localFloorNormal, footH * 0.72);
  const midPt = localPivot.clone().lerp(footTop, 0.52);
  midPt.x += 0.008; // subtle natural outward bend

  const legCurve = new THREE.CatmullRomCurve3([localPivot.clone(), midPt, footTop]);
  const leg = new THREE.Mesh(
    makeTaperedTube(THREE, legCurve, (u) => 0.0072 - 0.0014 * u, 16, 10),
    mats.chrome
  );
  leg.userData.slot = "secondary";
  leg.castShadow = true;
  group.add(leg);

  // Small tension spring beside upper kickstand
  const spA = localPivot.clone().add(new THREE.Vector3(-0.012, -0.012, -0.010));
  const spB = localPivot.clone().lerp(midPt, 0.42).add(new THREE.Vector3(-0.008, 0, -0.008));
  const spCurve = new THREE.CatmullRomCurve3([spA, spB]);
  const spMesh = new THREE.Mesh(makeTaperedTube(THREE, spCurve, 0.0042, 8, 8), mats.darkMetal);
  spMesh.userData.slot = "secondary";
  group.add(spMesh);

  // Textured Rubber Kickstand Foot oriented parallel to the world floor (y = 0)
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.016, footH, 12), mats.rubber);
  foot.position.copy(localFloorPt).addScaledVector(localFloorNormal, footH * 0.5);
  foot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localFloorNormal);
  foot.userData.slot = "accent";
  foot.castShadow = true;
  foot.receiveShadow = true;
  group.add(foot);

  return group;
}

// ---------------------------------------------------------------------------
// Helper to measure exact lowest Y of a mesh in world space
// ---------------------------------------------------------------------------

function getMeshMinY(THREE, mesh) {
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  const mat = mesh.matrixWorld;
  let minY = Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mat);
    if (v.y < minY) minY = v.y;
  }
  return minY;
}

// ---------------------------------------------------------------------------
// Main exported builder
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const primaryHex = opts.primary || "#8fc1e8";
  const metalHex = opts.metal || opts.secondary || "#d9d9d9";
  const accentHex = opts.accent || "#c89462";

  // Procedural CanvasTextures
  const fenderTex = makeFenderTexture(THREE, kit, primaryHex);
  const chainguardTex = makeChainguardTexture(THREE, kit, primaryHex);
  const leatherTex = makeLeatherTextures(THREE, kit, accentHex);
  const wickerTex = makeWickerTextures(THREE, kit, accentHex);
  const tireTex = makeTireTextures(THREE, kit, accentHex);
  const linerTex = makeLinerTextures(THREE, kit, primaryHex);
  const metalBump = makeMetalBump(THREE, kit);

  // Shared MeshPhysicalMaterial library
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({
      color: primaryHex,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.88,
      clearcoatRoughness: 0.14
    }),
    fender: new THREE.MeshPhysicalMaterial({
      map: fenderTex,
      roughness: 0.26,
      metalness: 0.08,
      clearcoat: 0.90,
      clearcoatRoughness: 0.13
    }),
    chainguard: new THREE.MeshPhysicalMaterial({
      map: chainguardTex,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.86,
      clearcoatRoughness: 0.15
    }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: metalHex,
      roughness: 0.18,
      metalness: 0.92,
      clearcoat: 0.45,
      clearcoatRoughness: 0.12,
      bumpMap: metalBump,
      bumpScale: 0.0005
    }),
    bellMetal: new THREE.MeshPhysicalMaterial({
      color: shadeHex(metalHex, 0.08),
      roughness: 0.11,
      metalness: 0.96,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08
    }),
    spoke: new THREE.MeshPhysicalMaterial({
      color: shadeHex(metalHex, 0.05),
      roughness: 0.22,
      metalness: 0.90
    }),
    darkMetal: new THREE.MeshPhysicalMaterial({
      color: shadeHex(metalHex, -0.58),
      roughness: 0.42,
      metalness: 0.78
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: mixHex("#dfb562", accentHex, 0.25),
      roughness: 0.22,
      metalness: 0.88,
      clearcoat: 0.35
    }),
    leather: new THREE.MeshPhysicalMaterial({
      map: leatherTex.map,
      bumpMap: leatherTex.bump,
      bumpScale: 0.0025,
      roughness: 0.56,
      metalness: 0.0,
      sheen: 0.35,
      sheenColor: new THREE.Color(shadeHex(accentHex, 0.25)),
      clearcoat: 0.16,
      clearcoatRoughness: 0.45
    }),
    wicker: new THREE.MeshPhysicalMaterial({
      map: wickerTex.map,
      bumpMap: wickerTex.bump,
      bumpScale: 0.0085,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.28,
      sheenColor: new THREE.Color("#f5e3c2")
    }),
    wickerRim: new THREE.MeshPhysicalMaterial({
      map: wickerTex.map,
      bumpMap: wickerTex.bump,
      bumpScale: 0.006,
      color: shadeHex("#fff4e0", -0.04),
      roughness: 0.84,
      metalness: 0.0
    }),
    liner: new THREE.MeshPhysicalMaterial({
      map: linerTex.map,
      bumpMap: linerTex.bump,
      bumpScale: 0.002,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.85,
      sheenColor: new THREE.Color("#ffffff")
    }),
    tire: new THREE.MeshPhysicalMaterial({
      map: tireTex.map,
      bumpMap: tireTex.bump,
      bumpScale: 0.0038,
      roughness: 0.88,
      metalness: 0.0
    }),
    rubber: new THREE.MeshPhysicalMaterial({
      color: "#2b2c30",
      roughness: 0.86,
      metalness: 0.0
    }),
    cable: new THREE.MeshPhysicalMaterial({
      color: mixHex("#ede3d2", accentHex, 0.15),
      roughness: 0.48,
      metalness: 0.05
    }),
    headlightGlow: new THREE.MeshPhysicalMaterial({
      color: "#fff7e2",
      emissive: new THREE.Color("#ffdfa0"),
      emissiveIntensity: 1.45,
      roughness: 0.12,
      clearcoat: 0.95
    }),
    rubyGlow: new THREE.MeshPhysicalMaterial({
      color: "#c92b2b",
      emissive: new THREE.Color("#ff3b2f"),
      emissiveIntensity: 1.35,
      roughness: 0.16,
      clearcoat: 0.90
    }),
    amberGlow: new THREE.MeshPhysicalMaterial({
      color: "#e69a2e",
      emissive: new THREE.Color("#ff9d1c"),
      emissiveIntensity: 0.65,
      roughness: 0.25,
      clearcoat: 0.6
    })
  };

  // Core bicycle geometry constants (metres, Y up, facing +Z)
  const R = 0.32;
  const rTube = 0.022;
  const headTilt = (19.5 * Math.PI) / 180; // 70.5 deg classic city head angle
  const steerAxis = new THREE.Vector3(0, Math.cos(headTilt), -Math.sin(headTilt)).normalize();
  const steerFwd = new THREE.Vector3(0, Math.sin(headTilt), Math.cos(headTilt)).normalize();
  const rake = 0.045;
  const forkLength = 0.365;

  const REAR = new THREE.Vector3(0, R, -0.52);
  const FRONT = new THREE.Vector3(0, R, 0.52);
  const P0 = FRONT.clone().addScaledVector(steerFwd, -rake);
  const FORK_CROWN = P0.clone().addScaledVector(steerAxis, forkLength);
  const HT_BOT = P0.clone().addScaledVector(steerAxis, forkLength + 0.028);
  const HT_TOP = P0.clone().addScaledVector(steerAxis, forkLength + 0.190);
  const BB = new THREE.Vector3(0, 0.275, -0.09);
  const SEAT_TOP = new THREE.Vector3(0, 0.72, -0.235);
  const seatDir = new THREE.Vector3().subVectors(SEAT_TOP, BB).normalize();
  const SADDLE_CLAMP = SEAT_TOP.clone().addScaledVector(seatDir, 0.125);

  const geom = {
    R,
    rTube,
    headTilt,
    steerAxis,
    steerFwd,
    rake,
    forkLength,
    REAR,
    FRONT,
    FORK_CROWN,
    HT_BOT,
    HT_TOP,
    BB,
    SEAT_TOP,
    SADDLE_CLAMP
  };

  // Root group (origin on floor under center, facing +Z)
  const root = new THREE.Group();
  root.name = "cityBicycle";

  // Tilt pivot group: pivoting at y = rTube keeps the rear tire touching y = 0 under lean!
  const leanAngle = 0.125; // ~7.2 deg cozy parked lean onto left kickstand
  const steerAngle = 0.24; // ~13.7 deg natural parked turn to left

  const tiltGroup = new THREE.Group();
  tiltGroup.name = "body";
  tiltGroup.position.set(0, rTube, 0);
  tiltGroup.rotation.z = -leanAngle; // leans top of bike toward +X (rider's left)
  root.add(tiltGroup);

  const bikeLocal = new THREE.Group();
  bikeLocal.position.set(0, -rTube, 0);
  tiltGroup.add(bikeLocal);

  // Assemble bicycle components inside bikeLocal
  const frame = buildFrame(THREE, mats, geom);
  bikeLocal.add(frame);

  const rearWheel = buildWheel(THREE, mats, { isRear: true, R, rTube });
  rearWheel.position.copy(REAR);
  bikeLocal.add(rearWheel);

  const rearFender = buildRearFenderAndLamp(THREE, mats, geom);
  bikeLocal.add(rearFender);

  const saddle = buildSaddle(THREE, mats, geom);
  bikeLocal.add(saddle);

  const drivetrain = buildDrivetrain(THREE, mats, geom);
  bikeLocal.add(drivetrain);

  // Front steering assembly (pivoted on true angled head-tube axis)
  const steerPivot = new THREE.Group();
  steerPivot.position.copy(FORK_CROWN);
  steerPivot.rotation.x = -headTilt;
  bikeLocal.add(steerPivot);

  const steerTurn = buildFrontAssembly(THREE, mats, geom);
  steerTurn.rotation.y = steerAngle;
  steerPivot.add(steerTurn);

  // Calibrate exact 2-wheel floor contact (both rear & front tires kiss y = 0.000)
  root.updateMatrixWorld(true);
  const rearTireMesh = rearWheel.userData.tireMesh;
  const frontTireMesh = steerTurn.userData.frontTireMesh;
  const yRear0 = getMeshMinY(THREE, rearTireMesh);
  const yFront0 = getMeshMinY(THREE, frontTireMesh);

  // Tiny pitch correction so front tire matches rear tire height, then snap both to y = 0
  const pitchAdj = Math.atan2(yFront0 - yRear0, 1.04);
  tiltGroup.rotation.x += pitchAdj;
  root.updateMatrixWorld(true);

  const yMinBoth = Math.min(getMeshMinY(THREE, rearTireMesh), getMeshMinY(THREE, frontTireMesh));
  tiltGroup.position.y -= yMinBoth;
  root.updateMatrixWorld(true);

  // Build Kickstand directly to exact world floor y = 0 after lean & pitch calibration!
  const ksPivotLocal = new THREE.Vector3(0.030, BB.y - 0.015, BB.z - 0.072);
  const ksPivotWorld = ksPivotLocal.clone().applyMatrix4(bikeLocal.matrixWorld);
  const ksFloorWorld = new THREE.Vector3(ksPivotWorld.x + 0.165, 0.0, ksPivotWorld.z - 0.055);

  const invBike = bikeLocal.matrixWorld.clone().invert();
  const ksFloorLocal = ksFloorWorld.clone().applyMatrix4(invBike);
  const localFloorNormal = new THREE.Vector3(0, 1, 0)
    .transformDirection(invBike)
    .normalize();

  const kickstand = buildKickstand(THREE, mats, ksPivotLocal, ksFloorLocal, localFloorNormal);
  bikeLocal.add(kickstand);

  // Center X/Z nicely over origin while keeping Y strictly grounded on floor
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  tiltGroup.position.x -= cx;
  tiltGroup.position.z -= cz;

  // Store references for subtle idle animation
  root.userData.baseSteer = steerAngle;
  root.userData.steerTurn = steerTurn;
  root.userData.bellClapper = steerTurn.getObjectByName("bellClapper");
  root.userData.mudflap = steerTurn.getObjectByName("mudflap");
  root.userData.headlightGlow = steerTurn.getObjectByName("headlightGlow");

  return root;
}

// ---------------------------------------------------------------------------
// Cozy diorama idle animation
// ---------------------------------------------------------------------------

export function idle(group, t) {
  if (!group || !group.userData) return;

  // 1. Barely perceptible soft-breeze micro-settle on steering (keeps tires rock-solid on floor)
  const steer = group.userData.steerTurn;
  if (steer) {
    steer.rotation.y = (group.userData.baseSteer || 0.24) + Math.sin(t * 0.85) * 0.0045;
  }

  // 2. Soft gentle flutter on hanging leather front mudflap
  const flap = group.userData.mudflap;
  if (flap) {
    flap.rotation.x = 0.22 + Math.sin(t * 1.65 + 0.7) * 0.018;
  }

  // 3. Playful periodic bell clapper micro-flick every ~6.5 seconds
  const clapper = group.userData.bellClapper;
  if (clapper) {
    const cycle = t % 6.5;
    let flick = 0;
    if (cycle < 0.45) {
      flick = Math.sin((cycle / 0.45) * Math.PI * 3) * Math.exp(-cycle * 5.0) * 0.22;
    }
    clapper.rotation.y = flick;
  }

  // 4. Warm vintage dynamo headlight glow breath
  const hl = group.userData.headlightGlow;
  if (hl && hl.material) {
    hl.material.emissiveIntensity = 1.40 + Math.sin(t * 1.4) * 0.16;
  }
}