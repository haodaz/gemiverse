export const META = {
  id: "jackalope",
  name: "Cozy Jackalope",
  kind: "creature",
  footprint: [0.18, 0.22],
  variants: ["meadow", "snow", "cocoa", "moonlit"],
  note: "Stylised sitting hare with branching antlers, ~0.32 m tall, crafted for a cozy dorm-room diorama."
};

const PALETTES = {
  meadow: {
    fur: "#b78860",
    furAccent: "#efe3ce",
    eye: "#8f4e22",
    nose: "#c47d78",
    innerEar: "#e3a69d",
    blush: "#e5897e",
    glow: null
  },
  snow: {
    fur: "#e6e4df",
    furAccent: "#f7f3eb",
    eye: "#3e7fa6",
    nose: "#d89c98",
    innerEar: "#ebb8b4",
    blush: "#eb9a94",
    glow: null
  },
  cocoa: {
    fur: "#7a5138",
    furAccent: "#e2d3bc",
    eye: "#ba7628",
    nose: "#a46662",
    innerEar: "#cf938a",
    blush: "#d67d72",
    glow: null
  },
  moonlit: {
    fur: "#8a8093",
    furAccent: "#eee8f2",
    eye: "#49a89d",
    nose: "#b78696",
    innerEar: "#d8a8be",
    blush: "#d98ca8",
    glow: "#9df5e8"
  }
};

function parseHex(hex, fallback) {
  const s = typeof hex === "string" ? hex.trim() : fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(s) || /^#?([0-9a-f]{3})$/i.exec(s);
  if (!m) return parseHex(fallback, "#b78860");
  let v = m[1];
  if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
  return [
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255
  ];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixRgb(a, b, t) {
  const k = clamp(t, 0, 1);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
}

function scaleRgb(c, s) {
  return [clamp(c[0] * s, 0, 1), clamp(c[1] * s, 0, 1), clamp(c[2] * s, 0, 1)];
}

function rgbStr(c, a) {
  const r = Math.round(clamp(c[0], 0, 1) * 255);
  const g = Math.round(clamp(c[1], 0, 1) * 255);
  const b = Math.round(clamp(c[2], 0, 1) * 255);
  return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}

function rgbHex(c) {
  const r = Math.round(clamp(c[0], 0, 1) * 255).toString(16).padStart(2, "0");
  const g = Math.round(clamp(c[1], 0, 1) * 255).toString(16).padStart(2, "0");
  const b = Math.round(clamp(c[2], 0, 1) * 255).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function fbm(kit, x, y) {
  return (
    kit.noise(x, y) * 0.6 +
    kit.noise(x * 2.03 + 11.7, y * 2.03 + 5.3) * 0.28 +
    kit.noise(x * 4.11 + 23.1, y * 4.11 + 17.9) * 0.12
  );
}

function smoothSeamNormals(geom, widthSegs, heightSegs) {
  const norm = geom.attributes.normal;
  const stride = widthSegs + 1;
  for (let iy = 0; iy <= heightSegs; iy++) {
    const i0 = iy * stride;
    const i1 = iy * stride + widthSegs;
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(i1, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;
}

function buildTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, options) {
  const opts = options || {};
  const capStart = opts.capStart !== false;
  const capEnd = opts.capEnd !== false;
  const profileFn = opts.profileFn || null;
  const frames = curve.computeFrenetFrames(tubularSegs, false);

  const rings = [];
  const baseRings = tubularSegs + 1;
  for (let i = 0; i < baseRings; i++) {
    const t = i / tubularSegs;
    rings.push({
      p: curve.getPointAt(t),
      N: frames.normals[i],
      B: frames.binormals[i],
      T: frames.tangents[i],
      r: Math.max(0.00005, radiusFn(t)),
      t
    });
  }

  const allRings = [];
  if (capStart) {
    const first = rings[0];
    const r0 = first.r;
    allRings.push({
      p: first.p.clone().addScaledVector(first.T, -r0 * 0.72),
      N: first.N,
      B: first.B,
      r: 0.00003,
      t: 0
    });
    allRings.push({
      p: first.p.clone().addScaledVector(first.T, -r0 * 0.42),
      N: first.N,
      B: first.B,
      r: r0 * 0.72,
      t: 0
    });
  }
  for (let i = 0; i < rings.length; i++) allRings.push(rings[i]);
  if (capEnd) {
    const last = rings[rings.length - 1];
    const r1 = last.r;
    allRings.push({
      p: last.p.clone().addScaledVector(last.T, r1 * 0.45),
      N: last.N,
      B: last.B,
      r: r1 * 0.72,
      t: 1
    });
    allRings.push({
      p: last.p.clone().addScaledVector(last.T, r1 * 0.78),
      N: last.N,
      B: last.B,
      r: 0.00003,
      t: 1
    });
  }

  const ringCount = allRings.length;
  const stride = radialSegs + 1;
  const positions = new Float32Array(ringCount * stride * 3);
  const uvs = new Float32Array(ringCount * stride * 2);
  const indices = [];

  let pIdx = 0;
  let uvIdx = 0;
  for (let i = 0; i < ringCount; i++) {
    const ring = allRings[i];
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cosA = Math.cos(theta);
      const sinA = Math.sin(theta);
      let rad = ring.r;
      if (profileFn) rad *= profileFn(ring.t, theta, cosA, sinA);
      const vx = ring.p.x + (ring.N.x * cosA + ring.B.x * sinA) * rad;
      const vy = ring.p.y + (ring.N.y * cosA + ring.B.y * sinA) * rad;
      const vz = ring.p.z + (ring.N.z * cosA + ring.B.z * sinA) * rad;
      positions[pIdx++] = vx;
      positions[pIdx++] = vy;
      positions[pIdx++] = vz;
      uvs[uvIdx++] = u;
      uvs[uvIdx++] = ring.t;
    }
  }

  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  smoothSeamNormals(geom, radialSegs, ringCount - 1);
  return geom;
}

function subdivideLongEdges(THREE, rawGeom, maxEdgeLen, passes) {
  const src = rawGeom.index ? rawGeom.toNonIndexed() : rawGeom;
  const posAttr = src.attributes.position;
  let tris = [];
  for (let i = 0; i < posAttr.count; i += 3) {
    tris.push([
      [posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)],
      [posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1)],
      [posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2)]
    ]);
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const mid = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];

  for (let p = 0; p < passes; p++) {
    const next = [];
    for (let i = 0; i < tris.length; i++) {
      const [v0, v1, v2] = tris[i];
      const s01 = dist(v0, v1) > maxEdgeLen;
      const s12 = dist(v1, v2) > maxEdgeLen;
      const s20 = dist(v2, v0) > maxEdgeLen;
      const count = (s01 ? 1 : 0) + (s12 ? 1 : 0) + (s20 ? 1 : 0);
      if (count === 0) {
        next.push(tris[i]);
      } else if (count === 3) {
        const m01 = mid(v0, v1);
        const m12 = mid(v1, v2);
        const m20 = mid(v2, v0);
        next.push([v0, m01, m20], [m01, v1, m12], [m20, m12, v2], [m01, m12, m20]);
      } else if (count === 1) {
        if (s01) {
          const m = mid(v0, v1);
          next.push([v0, m, v2], [m, v1, v2]);
        } else if (s12) {
          const m = mid(v1, v2);
          next.push([v0, v1, m], [v0, m, v2]);
        } else {
          const m = mid(v2, v0);
          next.push([v0, v1, m], [m, v1, v2]);
        }
      } else {
        if (s01 && s12) {
          const m01 = mid(v0, v1);
          const m12 = mid(v1, v2);
          next.push([m01, v1, m12], [v0, m01, m12], [v0, m12, v2]);
        } else if (s12 && s20) {
          const m12 = mid(v1, v2);
          const m20 = mid(v2, v0);
          next.push([m12, v2, m20], [v1, m12, m20], [v1, m20, v0]);
        } else {
          const m20 = mid(v2, v0);
          const m01 = mid(v0, v1);
          next.push([m20, v0, m01], [v2, m20, m01], [v2, m01, v1]);
        }
      }
    }
    tris = next;
  }

  const geom = new THREE.BufferGeometry();
  const out = new Float32Array(tris.length * 9);
  let k = 0;
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    for (let j = 0; j < 3; j++) {
      out[k++] = t[j][0];
      out[k++] = t[j][1];
      out[k++] = t[j][2];
    }
  }
  geom.setAttribute("position", new THREE.BufferAttribute(out, 3));
  return geom;
}

function weldGeometry(THREE, geom) {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const map = new Map();
  const newPos = [];
  const newUv = [];
  const indices = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * 1e5)}_${Math.round(y * 1e5)}_${Math.round(z * 1e5)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = newPos.length / 3;
      map.set(key, idx);
      newPos.push(x, y, z);
      if (uv) newUv.push(uv.getX(i), uv.getY(i));
    }
    indices.push(idx);
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(newPos, 3));
  if (uv) out.setAttribute("uv", new THREE.Float32BufferAttribute(newUv, 2));
  out.setIndex(indices);
  out.computeVertexNormals();
  return out;
}

function makeFurTextures(THREE, kit, furRgb, accentRgb, mode) {
  const darkFur = scaleRgb(furRgb, 0.62);
  const deepTip = mixRgb(scaleRgb(furRgb, 0.34), [0.16, 0.13, 0.12], 0.55);
  const lightFur = mixRgb(furRgb, accentRgb, 0.58);
  const eyeDirL = [0.62, 0.16, 0.77];
  const eyeDirR = [-0.62, 0.16, 0.77];

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      const theta = (y / (h - 1)) * Math.PI;
      const sinT = Math.sin(theta);
      const dy = Math.cos(theta);

      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const phi = u * Math.PI * 2;
        const dx = -Math.cos(phi) * sinT;
        const dz = Math.sin(phi) * sinT;

        const n1 = fbm(kit, Math.cos(phi) * 2.2 + 4.5, Math.sin(phi) * 2.2 + v * 4.5);
        const n2 = kit.noise(u * 18 + 3.1, v * 18 + 7.4);
        let col = mixRgb(furRgb, darkFur, (n1 - 0.5) * 0.32);

        if (mode === "body") {
          const backMask = smoothstep(-0.05, -0.78, dz) * smoothstep(-0.55, 0.45, dy);
          col = mixRgb(col, darkFur, backMask * 0.38);

          const bellyWidth = Math.exp(-(dx * dx) / 0.24);
          const bellyMask = smoothstep(0.28, 0.78, dz) * bellyWidth * smoothstep(-0.85, 0.58, dy);
          const chestMask = smoothstep(0.25, 0.72, dz) * Math.exp(-(dx * dx) / 0.34) * smoothstep(0.15, 0.72, dy);
          col = mixRgb(col, accentRgb, clamp(bellyMask * 0.82 + chestMask * 0.55, 0, 0.92));

          const haunchWarm = smoothstep(0.38, 0.85, Math.abs(dx)) * smoothstep(0.2, -0.45, dy);
          col = mixRgb(col, lightFur, haunchWarm * 0.16);

          const underAO = smoothstep(-0.55, -0.95, dy);
          col = scaleRgb(col, 1 - underAO * 0.14);
        } else if (mode === "head") {
          const crownMask = smoothstep(0.15, 0.85, dy) * Math.exp(-(dx * dx) / 0.42);
          col = mixRgb(col, darkFur, crownMask * 0.28);

          const muzzleMask = smoothstep(0.68, 0.94, dz) * smoothstep(0.25, -0.35, dy);
          col = mixRgb(col, accentRgb, muzzleMask * 0.68);

          const chinMask = smoothstep(0.32, 0.78, dz) * smoothstep(-0.22, -0.78, dy);
          col = mixRgb(col, accentRgb, chinMask * 0.72);

          const dotL = dx * eyeDirL[0] + dy * eyeDirL[1] + dz * eyeDirL[2];
          const dotR = dx * eyeDirR[0] + dy * eyeDirR[1] + dz * eyeDirR[2];
          const ringL = Math.exp(-Math.pow((dotL - 0.945) / 0.045, 2));
          const ringR = Math.exp(-Math.pow((dotR - 0.945) / 0.045, 2));
          col = mixRgb(col, accentRgb, clamp((ringL + ringR) * 0.48, 0, 0.52));

          const cheekWarm = smoothstep(0.5, 0.88, Math.abs(dx)) * smoothstep(0.15, -0.45, dy) * smoothstep(-0.2, 0.55, dz);
          col = mixRgb(col, lightFur, cheekWarm * 0.24);
        } else if (mode === "ear") {
          const tipMask = smoothstep(0.73, 0.94, v);
          const edgeRim = smoothstep(0.32, 0.49, Math.abs(u - 0.5)) * (1 - tipMask);
          const baseWarm = smoothstep(0.25, 0.0, v);
          col = mixRgb(col, lightFur, edgeRim * 0.42 + baseWarm * 0.2);
          col = mixRgb(col, deepTip, tipMask * 0.85);
        } else if (mode === "tail") {
          const dorsal = Math.exp(-Math.pow((u - 0.5) / 0.16, 2)) * smoothstep(0.95, 0.15, v);
          col = mixRgb(accentRgb, furRgb, dorsal * 0.62);
          col = mixRgb(col, darkFur, dorsal * 0.18 * (n1 > 0.48 ? 1 : 0.4));
        }

        const fleck = (n2 - 0.5) * 0.12;
        const idx = (y * w + x) * 4;
        data[idx] = Math.round(clamp(col[0] + fleck, 0, 1) * 255);
        data[idx + 1] = Math.round(clamp(col[1] + fleck, 0, 1) * 255);
        data[idx + 2] = Math.round(clamp(col[2] + fleck, 0, 1) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const strokeCount = mode === "ear" ? 1800 : 2600;
    ctx.lineCap = "round";
    for (let i = 0; i < strokeCount; i++) {
      const rx = kit.noise(i * 0.731, 1.37);
      const ry = kit.noise(i * 1.193, 9.41);
      const sx = rx * w;
      const sy = ry * h;
      const len = (mode === "ear" ? 10 : 14) + kit.noise(i * 0.37, 4.2) * 10;
      const drift = (kit.noise(sx * 0.02, sy * 0.02) - 0.5) * 6;
      const dirY = mode === "ear" ? -len : len;
      const bright = kit.noise(i * 2.13, 3.7) > 0.46;

      let strokeCol = bright ? lightFur : darkFur;
      if (mode === "ear" && ry < 0.24) strokeCol = deepTip;
      if (mode === "tail") strokeCol = bright ? accentRgb : lightFur;

      ctx.strokeStyle = rgbStr(strokeCol, 0.17);
      ctx.lineWidth = 1.1 + kit.noise(i * 0.91, 6.1) * 1.2;

      const drawSeg = (ox) => {
        ctx.beginPath();
        ctx.moveTo(sx + ox, sy);
        ctx.quadraticCurveTo(sx + ox + drift * 0.5, sy + dirY * 0.5, sx + ox + drift, sy + dirY);
        ctx.stroke();
      };
      drawSeg(0);
      if (sx < 16) drawSeg(w);
      if (sx > w - 16) drawSeg(-w);
    }
  });

  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    for (let i = 0; i < 2200; i++) {
      const sx = kit.noise(i * 0.89, 2.7) * w;
      const sy = kit.noise(i * 1.41, 8.3) * h;
      const len = 7 + kit.noise(i * 0.53, 5.1) * 8;
      const dx = (kit.noise(sx * 0.04, sy * 0.04) - 0.5) * 3.5;
      const shade = Math.round(112 + kit.noise(i * 1.9, 1.1) * 90);
      ctx.strokeStyle = `rgba(${shade},${shade},${shade},0.35)`;
      ctx.lineWidth = 1.2;
      const draw = (ox) => {
        ctx.beginPath();
        ctx.moveTo(sx + ox, sy);
        ctx.lineTo(sx + ox + dx, sy + (mode === "ear" ? -len : len));
        ctx.stroke();
      };
      draw(0);
      if (sx < 10) draw(w);
      if (sx > w - 10) draw(-w);
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap };
}

function makeInnerEarTexture(THREE, kit, innerRgb, accentRgb) {
  const deepRose = scaleRgb(innerRgb, 0.82);
  const softEdge = mixRgb(accentRgb, innerRgb, 0.35);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const cx = (u - 0.5) * 2;
        const radial = Math.min(1, Math.hypot(cx * 1.15, (v - 0.45) * 1.25));
        const n = fbm(kit, u * 6 + 2.1, v * 8 + 4.3);
        let col = mixRgb(deepRose, innerRgb, smoothstep(0.08, 0.65, v));
        col = mixRgb(col, softEdge, smoothstep(0.55, 0.96, radial) * 0.72);
        const fuzz = (n - 0.5) * 0.08;
        const idx = (y * w + x) * 4;
        data[idx] = Math.round(clamp(col[0] + fuzz, 0, 1) * 255);
        data[idx + 1] = Math.round(clamp(col[1] + fuzz, 0, 1) * 255);
        data[idx + 2] = Math.round(clamp(col[2] + fuzz, 0, 1) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.lineCap = "round";
    for (let i = 0; i < 420; i++) {
      const sx = kit.noise(i * 0.91, 3.3) * w;
      const sy = kit.noise(i * 1.27, 7.1) * h;
      ctx.strokeStyle = rgbStr(accentRgb, 0.14);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (sx / w - 0.5) * 4, sy - 7);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAntlerTextures(THREE, kit, accentRgb) {
  const baseTone = mixRgb(scaleRgb(accentRgb, 0.56), [0.36, 0.27, 0.20], 0.45);
  const midTone = mixRgb(accentRgb, [0.85, 0.78, 0.67], 0.25);
  const tipTone = mixRgb(accentRgb, [0.98, 0.96, 0.91], 0.42);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const angle = u * Math.PI * 2;
        const flute = Math.sin(angle * 7 + kit.noise(Math.cos(angle) * 2, v * 4) * 1.4) * 0.5 + 0.5;
        const grain = fbm(kit, Math.cos(angle) * 2.5 + 3, Math.sin(angle) * 2.5 + v * 7);
        let col = mixRgb(baseTone, midTone, smoothstep(0.05, 0.55, v));
        col = mixRgb(col, tipTone, smoothstep(0.58, 0.96, v));
        const grooveDark = (1 - flute) * smoothstep(0.85, 0.0, v) * 0.22;
        col = scaleRgb(col, 1 - grooveDark + (grain - 0.5) * 0.12);
        const idx = (y * w + x) * 4;
        data[idx] = Math.round(clamp(col[0], 0, 1) * 255);
        data[idx + 1] = Math.round(clamp(col[1], 0, 1) * 255);
        data[idx + 2] = Math.round(clamp(col[2], 0, 1) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const angle = u * Math.PI * 2;
        const ridge = Math.sin(angle * 7 + kit.noise(Math.cos(angle) * 2, v * 4) * 1.4) * 0.5 + 0.5;
        const pearl = kit.noise(Math.cos(angle) * 6 + 5, v * 16 + 2) * smoothstep(0.45, 0.0, v);
        const smoothTip = smoothstep(0.65, 1.0, v);
        const val = clamp(0.5 + ((ridge - 0.5) * 0.65 + (pearl - 0.35) * 0.45) * (1 - smoothTip * 0.75), 0, 1);
        const b = Math.round(val * 255);
        const idx = (y * w + x) * 4;
        data[idx] = b;
        data[idx + 1] = b;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeIrisTexture(THREE, kit, eyeRgb) {
  const rimCol = scaleRgb(eyeRgb, 0.32);
  const brightCol = mixRgb(eyeRgb, [1.0, 0.94, 0.78], 0.42);
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = w * 0.48;

    ctx.fillStyle = rgbStr(rimCol);
    ctx.fillRect(0, 0, w, h);

    const grad = ctx.createRadialGradient(cx, cy + maxR * 0.14, maxR * 0.18, cx, cy, maxR);
    grad.addColorStop(0.0, rgbStr(brightCol));
    grad.addColorStop(0.55, rgbStr(eyeRgb));
    grad.addColorStop(0.86, rgbStr(scaleRgb(eyeRgb, 0.55)));
    grad.addColorStop(1.0, rgbStr(rimCol));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 4 + 3, Math.sin(a) * 4 + 3);
      const r0 = maxR * (0.42 + n * 0.08);
      const r1 = maxR * (0.88 + n * 0.08);
      ctx.strokeStyle = rgbStr(n > 0.5 ? brightCol : rimCol, 0.32);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    const crescent = ctx.createRadialGradient(cx, cy + maxR * 0.34, maxR * 0.05, cx, cy + maxR * 0.25, maxR * 0.55);
    crescent.addColorStop(0, rgbStr(brightCol, 0.48));
    crescent.addColorStop(1, rgbStr(brightCol, 0.0));
    ctx.fillStyle = crescent;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.9, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit, blushRgb) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.48);
    g.addColorStop(0.0, rgbStr(blushRgb, 0.46));
    g.addColorStop(0.45, rgbStr(blushRgb, 0.24));
    g.addColorStop(0.85, rgbStr(blushRgb, 0.04));
    g.addColorStop(1.0, rgbStr(blushRgb, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sculptBodyPoint(nx, ny, nz, kit) {
  const t = (ny + 1) * 0.5;
  const rx = 0.058 * (1.06 - 0.42 * smoothstep(0.32, 0.96, t)) * (0.86 + 0.20 * Math.sin(t * Math.PI));
  const rz = 0.068 * (1.08 - 0.38 * smoothstep(0.30, 0.95, t));

  let x = nx * rx;
  let y = 0.072 + ny * 0.077;
  let z = nz * rz - 0.014 + smoothstep(0.18, 0.92, t) * 0.028;

  const haunch =
    Math.exp(-Math.pow((ny + 0.34) / 0.42, 2)) *
    smoothstep(0.22, 0.86, Math.abs(nx)) *
    smoothstep(-0.75, 0.35, nz);
  x += Math.sign(nx) * haunch * 0.0155;
  z -= haunch * 0.006;

  const rump =
    Math.exp(-Math.pow((ny + 0.24) / 0.44, 2)) *
    smoothstep(-0.15, -0.92, nz);
  z -= rump * 0.014;
  y += rump * 0.005;

  const chestPuff =
    Math.exp(-Math.pow((ny - 0.34) / 0.34, 2)) *
    smoothstep(0.25, 0.92, nz) *
    Math.exp(-(nx * nx) / 0.42);
  z += chestPuff * 0.015;
  y -= chestPuff * 0.004;

  const shoulderTaper = smoothstep(0.68, 1.0, ny);
  x *= 1 - shoulderTaper * 0.16;
  z = z * (1 - shoulderTaper * 0.14) + 0.014 * shoulderTaper * 0.14;

  const bellySoft =
    Math.exp(-Math.pow((ny + 0.32) / 0.34, 2)) *
    smoothstep(0.45, 0.95, nz) *
    Math.exp(-(nx * nx) / 0.22);
  z -= bellySoft * 0.0045;

  const furFluff = (fbm(kit, nx * 3.1 + 5.2, ny * 3.1 + nz * 2.4 + 2.7) - 0.5) * 0.0024;
  x += nx * furFluff;
  y += ny * furFluff;
  z += nz * furFluff;

  const k = 0.022;
  if (y < k) {
    y = k * (1 - Math.tanh((k - y) / k));
  }

  return [x, y, z];
}

function buildBodyGeometry(THREE, kit) {
  const segW = 64;
  const segH = 48;
  const geom = new THREE.SphereGeometry(1, segW, segH);
  const pos = geom.attributes.position;

  let minY = Infinity;
  const pts = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const p = sculptBodyPoint(nx, ny, nz, kit);
    pts[i * 3] = p[0];
    pts[i * 3 + 1] = p[1];
    pts[i * 3 + 2] = p[2];
    if (p[1] < minY) minY = p[1];
  }

  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pts[i * 3], pts[i * 3 + 1] - minY, pts[i * 3 + 2]);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  smoothSeamNormals(geom, segW, segH);
  return geom;
}

function sculptHeadPoint(nx, ny, nz, kit) {
  let x = nx * 0.044;
  let y = 0.036 + ny * 0.042;
  let z = 0.009 + nz * 0.048;

  const neckMask = smoothstep(-0.38, -0.96, ny);
  y -= neckMask * 0.022;
  x = x * (1 - neckMask * 0.24);
  z = z * (1 - neckMask * 0.34) - neckMask * 0.004;

  const muzzleMask = smoothstep(0.32, 0.96, nz) * Math.exp(-Math.pow((ny + 0.08) / 0.44, 2));
  z += muzzleMask * 0.019;
  x *= 1 - muzzleMask * 0.20;
  y -= muzzleMask * 0.0025;

  const whiskerL = Math.exp(-(Math.pow((nx - 0.24) / 0.22, 2) + Math.pow((ny + 0.22) / 0.20, 2) + Math.pow((nz - 0.88) / 0.26, 2)));
  const whiskerR = Math.exp(-(Math.pow((nx + 0.24) / 0.22, 2) + Math.pow((ny + 0.22) / 0.20, 2) + Math.pow((nz - 0.88) / 0.26, 2)));
  z += (whiskerL + whiskerR) * 0.0055;
  x += (whiskerL - whiskerR) * 0.0032;

  const philtrum = Math.exp(-(Math.pow(nx / 0.085, 2) + Math.pow((ny + 0.24) / 0.16, 2))) * smoothstep(0.76, 0.96, nz);
  z -= philtrum * 0.0024;

  const cheek =
    Math.exp(-Math.pow((ny + 0.18) / 0.34, 2)) *
    smoothstep(0.35, 0.90, Math.abs(nx)) *
    smoothstep(-0.35, 0.65, nz);
  x += Math.sign(nx) * cheek * 0.0105;
  y -= cheek * 0.002;
  z += cheek * 0.0035;

  const cheekTuft =
    Math.exp(-Math.pow((ny + 0.24) / 0.18, 2)) *
    smoothstep(0.75, 0.98, Math.abs(nx)) *
    Math.exp(-Math.pow((nz - 0.12) / 0.32, 2));
  x += Math.sign(nx) * cheekTuft * 0.0042;

  const browBridge =
    Math.exp(-Math.pow(nx / 0.36, 2)) *
    Math.exp(-Math.pow((ny - 0.32) / 0.28, 2)) *
    smoothstep(0.35, 0.85, nz);
  z += browBridge * 0.0042;
  y += browBridge * 0.0024;

  const eyeDirL = [0.62, 0.16, 0.77];
  const eyeDirR = [-0.62, 0.16, 0.77];
  const dotL = nx * eyeDirL[0] + ny * eyeDirL[1] + nz * eyeDirL[2];
  const dotR = nx * eyeDirR[0] + ny * eyeDirR[1] + nz * eyeDirR[2];
  const socketL = smoothstep(0.92, 0.992, dotL);
  const socketR = smoothstep(0.92, 0.992, dotR);
  const socketDepth = (socketL + socketR) * 0.0042;
  x -= nx * socketDepth;
  y -= ny * socketDepth;
  z -= nz * socketDepth;

  const crown = smoothstep(0.45, 0.98, ny) * smoothstep(0.55, -0.45, nz);
  y += crown * 0.0032;

  const furFluff = (fbm(kit, nx * 3.8 + 1.9, ny * 3.8 + nz * 3.1 + 7.4) - 0.5) * 0.0014;
  const fluffFade = 1 - clamp(socketL + socketR, 0, 1);
  x += nx * furFluff * fluffFade;
  y += ny * furFluff * fluffFade;
  z += nz * furFluff * fluffFade;

  return [x, y, z];
}

function buildHeadGeometry(THREE, kit) {
  const segW = 64;
  const segH = 48;
  const geom = new THREE.SphereGeometry(1, segW, segH);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const p = sculptHeadPoint(pos.getX(i), pos.getY(i), pos.getZ(i), kit);
    pos.setXYZ(i, p[0], p[1], p[2]);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  smoothSeamNormals(geom, segW, segH);
  return geom;
}

function buildHindFootGeometry(THREE, kit) {
  const segW = 36;
  const segH = 24;
  const geom = new THREE.SphereGeometry(1, segW, segH);
  const pos = geom.attributes.position;
  let minY = Infinity;
  const pts = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.0185 * (1 + 0.16 * smoothstep(-0.2, 0.8, nz));
    let y = 0.015 + ny * 0.0155;
    let z = nz * 0.044;

    const instep = Math.exp(-Math.pow((nz + 0.25) / 0.55, 2)) * smoothstep(-0.1, 0.9, ny);
    y += instep * 0.0085;

    const toeZone = smoothstep(0.62, 0.98, nz) * smoothstep(-0.5, 0.35, ny);
    const toeWave = Math.cos(nx * Math.PI * 3.1) * 0.5 + 0.5;
    z += toeZone * toeWave * 0.0038;
    y += toeZone * toeWave * 0.0014;

    const furNoise = (kit.noise(nx * 4.5 + 3.1, nz * 4.5 + ny * 2.2) - 0.5) * 0.0012;
    x += nx * furNoise;
    y += ny * furNoise;
    z += nz * furNoise;

    const k = 0.007;
    if (y < k) y = k * (1 - Math.tanh((k - y) / k));

    pts[i * 3] = x;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = z;
    if (y < minY) minY = y;
  }

  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pts[i * 3], pts[i * 3 + 1] - minY, pts[i * 3 + 2]);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  smoothSeamNormals(geom, segW, segH);
  return geom;
}

function buildFrontPawGeometry(THREE, kit, flatBottom) {
  const segW = 28;
  const segH = 20;
  const geom = new THREE.SphereGeometry(1, segW, segH);
  const pos = geom.attributes.position;
  let minY = Infinity;
  const pts = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.0135;
    let y = ny * 0.0105;
    let z = nz * 0.0185;

    const toeZone = smoothstep(0.55, 0.98, nz);
    const toes = Math.cos(nx * Math.PI * 2.9) * 0.5 + 0.5;
    z += toeZone * toes * 0.0026;

    const n = (kit.noise(nx * 5 + 1.2, nz * 5 + 4.8) - 0.5) * 0.0008;
    x += nx * n;
    y += ny * n;
    z += nz * n;

    if (flatBottom) {
      y += 0.010;
      const k = 0.0045;
      if (y < k) y = k * (1 - Math.tanh((k - y) / k));
    }
    pts[i * 3] = x;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = z;
    if (y < minY) minY = y;
  }

  const yOffset = flatBottom ? -minY : 0;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pts[i * 3], pts[i * 3 + 1] + yOffset, pts[i * 3 + 2]);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  smoothSeamNormals(geom, segW, segH);
  return geom;
}

function bendEarVertex(x, y, z, length, bendProfile) {
  const v = clamp(y / length, 0, 1);
  const widthAtV = 0.009 + 0.014 * Math.sin(Math.pow(v, 0.72) * Math.PI);
  const uNorm = clamp(x / Math.max(0.005, widthAtV), -1.35, 1.35);

  const cupStrength = Math.sin(v * Math.PI) * 0.0078;
  const cupZ = uNorm * uNorm * cupStrength;

  const forwardCurve =
    Math.pow(v, 1.85) * bendProfile.curveZ +
    Math.sin(v * Math.PI) * 0.0045;
  const sideSway = Math.pow(v, 1.9) * bendProfile.curveX;

  const twist = v * bendProfile.twist;
  const rx = x * Math.cos(twist) - (z + cupZ) * Math.sin(twist);
  const rz = x * Math.sin(twist) + (z + cupZ) * Math.cos(twist);

  const yShorten = y - (forwardCurve * forwardCurve + sideSway * sideSway) * 0.65;

  return [rx + sideSway, yShorten, rz + forwardCurve];
}

function buildEarMeshPair(THREE, outerMat, innerMat, bendProfile) {
  const earLen = 0.116;

  const outerShape = new THREE.Shape();
  outerShape.moveTo(-0.0085, 0);
  outerShape.bezierCurveTo(-0.0185, 0.022, -0.0235, 0.056, -0.0165, 0.088);
  outerShape.bezierCurveTo(-0.0115, 0.106, -0.0042, earLen, 0, earLen);
  outerShape.bezierCurveTo(0.0042, earLen, 0.0115, 0.106, 0.0165, 0.088);
  outerShape.bezierCurveTo(0.0235, 0.056, 0.0185, 0.022, 0.0085, 0);
  outerShape.quadraticCurveTo(0, -0.005, -0.0085, 0);

  const outerRaw = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.0036,
    bevelEnabled: true,
    bevelThickness: 0.0024,
    bevelSize: 0.0022,
    bevelSegments: 4,
    curveSegments: 26
  });
  outerRaw.translate(0, 0, -0.0018);

  const outerSub = subdivideLongEdges(THREE, outerRaw, 0.0075, 3);
  const oPos = outerSub.attributes.position;
  const oUv = new Float32Array(oPos.count * 2);
  for (let i = 0; i < oPos.count; i++) {
    const x = oPos.getX(i);
    const y = oPos.getY(i);
    const z = oPos.getZ(i);
    oUv[i * 2] = clamp(0.5 + x / 0.052, 0, 1);
    oUv[i * 2 + 1] = clamp(y / earLen, 0, 1);
    const b = bendEarVertex(x, y, z, earLen, bendProfile);
    oPos.setXYZ(i, b[0], b[1], b[2]);
  }
  outerSub.setAttribute("uv", new THREE.BufferAttribute(oUv, 2));
  const outerGeom = weldGeometry(THREE, outerSub);

  const innerShape = new THREE.Shape();
  innerShape.moveTo(-0.0045, 0.011);
  innerShape.bezierCurveTo(-0.0115, 0.028, -0.0145, 0.056, -0.0095, 0.082);
  innerShape.bezierCurveTo(-0.0055, 0.094, -0.0022, 0.098, 0, 0.098);
  innerShape.bezierCurveTo(0.0022, 0.098, 0.0055, 0.094, 0.0095, 0.082);
  innerShape.bezierCurveTo(0.0145, 0.056, 0.0115, 0.028, 0.0045, 0.011);
  innerShape.quadraticCurveTo(0, 0.007, -0.0045, 0.011);

  const innerRaw = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.0010,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0011,
    bevelSegments: 3,
    curveSegments: 22
  });
  innerRaw.translate(0, 0, 0.0023);

  const innerSub = subdivideLongEdges(THREE, innerRaw, 0.0075, 2);
  const iPos = innerSub.attributes.position;
  const iUv = new Float32Array(iPos.count * 2);
  for (let i = 0; i < iPos.count; i++) {
    const x = iPos.getX(i);
    const y = iPos.getY(i);
    const z = iPos.getZ(i);
    iUv[i * 2] = clamp(0.5 + x / 0.032, 0, 1);
    iUv[i * 2 + 1] = clamp((y - 0.008) / 0.092, 0, 1);
    const b = bendEarVertex(x, y, z, earLen, bendProfile);
    iPos.setXYZ(i, b[0], b[1], b[2]);
  }
  innerSub.setAttribute("uv", new THREE.BufferAttribute(iUv, 2));
  const innerGeom = weldGeometry(THREE, innerSub);

  const outerMesh = new THREE.Mesh(outerGeom, outerMat);
  outerMesh.userData.slot = "fur";
  const innerMesh = new THREE.Mesh(innerGeom, innerMat);
  innerMesh.userData.slot = "skin";

  const earGroup = new THREE.Group();
  earGroup.add(outerMesh, innerMesh);
  return earGroup;
}

function buildAntlerBurrGeometry(THREE, kit, seed) {
  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -0.003 + t * 0.012;
    let r = 0.0062;
    if (t < 0.25) {
      r = 0.0048 + smoothstep(0, 0.25, t) * 0.0036;
    } else if (t < 0.62) {
      const bulge = Math.sin(((t - 0.25) / 0.37) * Math.PI);
      r = 0.0080 + bulge * 0.0018;
    } else {
      r = 0.0080 - smoothstep(0.62, 1.0, t) * 0.0028;
    }
    pts.push(new THREE.Vector2(r, y));
  }
  const geom = new THREE.LatheGeometry(pts, 22);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const pearl = (Math.sin(ang * 9 + seed) * 0.5 + 0.5) * Math.exp(-Math.pow((y - 0.002) / 0.0032, 2));
    const n = (kit.noise(Math.cos(ang) * 3 + seed, y * 120) - 0.5) * 0.0008;
    const scale = 1 + pearl * 0.14 + n * 40;
    pos.setXYZ(i, x * scale, y, z * scale);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function buildAntlersGroup(THREE, kit, antlerMat, glowMat) {
  const hornGroup = new THREE.Group();
  hornGroup.name = "horn";

  const configs = [
    {
      side: 1,
      seed: 1.7,
      main: [
        [0.0, -0.004, 0.0],
        [0.008, 0.015, 0.002],
        [0.022, 0.036, -0.004],
        [0.034, 0.057, -0.002],
        [0.037, 0.077, 0.007]
      ],
      brow: [
        [0.009, 0.017, 0.002],
        [0.013, 0.025, 0.014],
        [0.011, 0.037, 0.022]
      ],
      outerFork: [
        [0.022, 0.037, -0.004],
        [0.037, 0.048, -0.012],
        [0.049, 0.064, -0.013]
      ],
      innerPoint: [
        [0.031, 0.052, -0.002],
        [0.025, 0.064, 0.003],
        [0.019, 0.074, 0.008]
      ]
    },
    {
      side: -1,
      seed: 5.3,
      main: [
        [0.0, -0.004, 0.0],
        [-0.009, 0.016, 0.001],
        [-0.024, 0.038, -0.005],
        [-0.036, 0.060, -0.001],
        [-0.035, 0.080, 0.009]
      ],
      brow: [
        [-0.010, 0.018, 0.001],
        [-0.014, 0.027, 0.013],
        [-0.010, 0.040, 0.020]
      ],
      outerFork: [
        [-0.024, 0.039, -0.005],
        [-0.040, 0.051, -0.011],
        [-0.050, 0.067, -0.010]
      ],
      innerPoint: [
        [-0.032, 0.055, -0.002],
        [-0.025, 0.067, 0.004],
        [-0.020, 0.076, 0.009]
      ]
    }
  ];

  const makeCurve = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));

  for (const cfg of configs) {
    const branch = new THREE.Group();
    const anchor = sculptHeadPoint(0.32 * cfg.side, 0.72, 0.28, kit);
    branch.position.set(anchor[0], anchor[1] - 0.003, anchor[2]);
    branch.rotation.set(0.08, cfg.side * 0.06, -cfg.side * 0.05);

    const burrGeom = buildAntlerBurrGeometry(THREE, kit, cfg.seed);
    const burrMesh = new THREE.Mesh(burrGeom, antlerMat);
    burrMesh.userData.slot = "furAccent";
    branch.add(burrMesh);

    const profileFn = (t, theta) => 1 + 0.065 * Math.sin(theta * 5 + t * 3 + cfg.seed) * (1 - t * 0.75);

    const mainCurve = makeCurve(cfg.main);
    const mainGeom = buildTaperedTube(
      THREE,
      mainCurve,
      26,
      14,
      (t) => 0.0056 * Math.pow(1 - t * 0.72, 0.85),
      { capStart: true, capEnd: true, profileFn }
    );
    const mainMesh = new THREE.Mesh(mainGeom, antlerMat);
    mainMesh.userData.slot = "furAccent";
    branch.add(mainMesh);

    const tineSpecs = [
      { pts: cfg.brow, r0: 0.0037, r1: 0.0013 },
      { pts: cfg.outerFork, r0: 0.0036, r1: 0.0013 },
      { pts: cfg.innerPoint, r0: 0.0029, r1: 0.0012 }
    ];

    const tipCurves = [mainCurve];
    for (const sp of tineSpecs) {
      const c = makeCurve(sp.pts);
      tipCurves.push(c);
      const g = buildTaperedTube(
        THREE,
        c,
        16,
        12,
        (t) => sp.r0 + (sp.r1 - sp.r0) * Math.pow(t, 0.85),
        { capStart: true, capEnd: true, profileFn }
      );
      const m = new THREE.Mesh(g, antlerMat);
      m.userData.slot = "furAccent";
      branch.add(m);
    }

    if (glowMat) {
      const tipGeom = new THREE.SphereGeometry(0.0022, 12, 10);
      for (const tc of tipCurves) {
        const tipPt = tc.getPointAt(1);
        const bead = new THREE.Mesh(tipGeom, glowMat);
        bead.position.copy(tipPt);
        bead.userData.slot = "glow";
        branch.add(bead);
      }
    }

    hornGroup.add(branch);
  }

  return hornGroup;
}

function buildEyeGroup(THREE, side, eyeBaseMat, irisMat, catchlightMat, lashMat) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? "eyeL" : "eyeR";

  const R = 0.0114;

  const globePts = [];
  const globeSteps = 22;
  for (let i = 0; i <= globeSteps; i++) {
    const a = (i / globeSteps) * Math.PI;
    const sinA = Math.sin(a);
    const cosA = Math.cos(a);
    const cornea = smoothstep(0.65, 1.0, cosA) * 0.0009;
    const rad = Math.max(0.00004, sinA * R);
    const y = cosA * R + cornea;
    globePts.push(new THREE.Vector2(rad, y));
  }
  const globeGeom = new THREE.LatheGeometry(globePts, 24);
  globeGeom.rotateX(Math.PI * 0.5);
  const globeMesh = new THREE.Mesh(globeGeom, eyeBaseMat);
  globeMesh.userData.slot = "eye";
  eyeGroup.add(globeMesh);

  const irisPts = [];
  const irisSteps = 18;
  const minA = 0.34;
  const maxA = 0.96;
  for (let i = 0; i <= irisSteps; i++) {
    const t = i / irisSteps;
    const a = minA + t * (maxA - minA);
    const sinA = Math.sin(a);
    const cosA = Math.cos(a);
    const cornea = smoothstep(0.65, 1.0, cosA) * 0.0009;
    const r = sinA * (R + 0.00042);
    const y = cosA * (R + 0.00042) + cornea;
    irisPts.push(new THREE.Vector2(r, y));
  }
  const irisGeom = new THREE.LatheGeometry(irisPts, 28);
  irisGeom.rotateX(Math.PI * 0.5);
  const iPos = irisGeom.attributes.position;
  const iUv = irisGeom.attributes.uv;
  for (let i = 0; i < iPos.count; i++) {
    const px = iPos.getX(i);
    const py = iPos.getY(i);
    iUv.setXY(i, 0.5 + px / (R * 1.72), 0.5 + py / (R * 1.72));
  }
  iUv.needsUpdate = true;

  const irisMesh = new THREE.Mesh(irisGeom, irisMat);
  irisMesh.userData.slot = "eye";
  eyeGroup.add(irisMesh);

  const hl1Geom = new THREE.SphereGeometry(0.0023, 14, 10);
  hl1Geom.scale(1.12, 1.0, 0.42);
  const hl1 = new THREE.Mesh(hl1Geom, catchlightMat);
  hl1.position.set(0.0034, 0.0040, R - 0.0001);
  hl1.rotation.set(-0.34, 0.28, 0);
  eyeGroup.add(hl1);

  const hl2Geom = new THREE.SphereGeometry(0.00105, 10, 8);
  hl2Geom.scale(1.0, 1.0, 0.42);
  const hl2 = new THREE.Mesh(hl2Geom, catchlightMat);
  hl2.position.set(-0.0031, -0.0032, R - 0.0003);
  hl2.rotation.set(0.28, -0.26, 0);
  eyeGroup.add(hl2);

  const lashPts = [];
  for (let i = 0; i <= 10; i++) {
    const u = -1 + (i / 10) * 2;
    const ang = u * 1.15;
    const lx = Math.sin(ang) * (R + 0.0008);
    const ly = Math.cos(ang * 0.85) * (R + 0.0006) * 0.84 + 0.0024;
    const lz = Math.sqrt(Math.max(0.00001, (R + 0.0011) * (R + 0.0011) - lx * lx - ly * ly * 0.65));
    lashPts.push(new THREE.Vector3(lx, ly, lz * 0.88));
  }
  const lashCurve = new THREE.CatmullRomCurve3(lashPts);
  const lashGeom = buildTaperedTube(
    THREE,
    lashCurve,
    18,
    8,
    (t) => 0.0011 * Math.sin(t * Math.PI) + 0.00025,
    { capStart: true, capEnd: true }
  );
  const lashMesh = new THREE.Mesh(lashGeom, lashMat);
  lashMesh.userData.slot = "skin";
  eyeGroup.add(lashMesh);

  return eyeGroup;
}

function buildNoseAndMouth(THREE, kit, noseMat, mouthMat, whiskerMat) {
  const noseGroup = new THREE.Group();
  noseGroup.name = "nose";

  const tipAnchor = sculptHeadPoint(0, -0.08, 0.996, kit);
  noseGroup.position.set(tipAnchor[0], tipAnchor[1], tipAnchor[2]);

  const noseGeom = new THREE.SphereGeometry(1, 24, 18);
  const nPos = noseGeom.attributes.position;
  for (let i = 0; i < nPos.count; i++) {
    const nx = nPos.getX(i);
    const ny = nPos.getY(i);
    const nz = nPos.getZ(i);
    const topWide = 1 + smoothstep(-0.4, 0.6, ny) * 0.36;
    const bottomPinch = 1 - smoothstep(0.1, -0.95, ny) * 0.44;
    let x = nx * 0.0056 * topWide * bottomPinch;
    let y = ny * 0.0040 - smoothstep(0.5, -0.8, ny) * 0.0006;
    let z = nz * 0.0042 + smoothstep(-0.3, 0.8, nz) * 0.001;
    const cleft = Math.exp(-(nx * nx) / 0.08) * smoothstep(0.0, -0.8, ny) * smoothstep(0.2, 0.9, nz);
    z -= cleft * 0.0010;
    nPos.setXYZ(i, x, y, z);
  }
  nPos.needsUpdate = true;
  noseGeom.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeom, noseMat);
  noseMesh.position.set(0, 0.0008, 0.0002);
  noseMesh.userData.slot = "skin";
  noseGroup.add(noseMesh);

  const rel = (nx, ny, nz, push) => {
    const len = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / len;
    const uy = ny / len;
    const uz = nz / len;
    const p = sculptHeadPoint(ux, uy, uz, kit);
    return new THREE.Vector3(
      p[0] - tipAnchor[0] + ux * push,
      p[1] - tipAnchor[1] + uy * push,
      p[2] - tipAnchor[2] + uz * push
    );
  };

  const stemCurve = new THREE.CatmullRomCurve3([
    rel(0, -0.14, 0.99, 0.0006),
    rel(0, -0.22, 0.975, 0.0008),
    rel(0, -0.30, 0.954, 0.0007)
  ]);
  const stemGeom = buildTaperedTube(THREE, stemCurve, 10, 8, () => 0.00075, { capStart: true, capEnd: true });
  const stemMesh = new THREE.Mesh(stemGeom, mouthMat);
  stemMesh.userData.slot = "skin";
  noseGroup.add(stemMesh);

  for (const side of [1, -1]) {
    const smileCurve = new THREE.CatmullRomCurve3([
      rel(0, -0.30, 0.954, 0.0007),
      rel(side * 0.09, -0.33, 0.940, 0.0009),
      rel(side * 0.19, -0.31, 0.931, 0.0009),
      rel(side * 0.27, -0.26, 0.927, 0.0006)
    ]);
    const smileGeom = buildTaperedTube(
      THREE,
      smileCurve,
      14,
      8,
      (t) => 0.00082 * (1 - t * 0.42),
      { capStart: true, capEnd: true }
    );
    const smileMesh = new THREE.Mesh(smileGeom, mouthMat);
    smileMesh.userData.slot = "skin";
    noseGroup.add(smileMesh);

    const whiskerSpecs = [
      { dy: -0.16, dz: 0.94, spreadY: 0.005, len: 0.036, sweepZ: -0.008 },
      { dy: -0.22, dz: 0.93, spreadY: -0.001, len: 0.041, sweepZ: -0.011 },
      { dy: -0.28, dz: 0.92, spreadY: -0.007, len: 0.033, sweepZ: -0.009 }
    ];
    for (const ws of whiskerSpecs) {
      const base = rel(side * 0.26, ws.dy, ws.dz, -0.0015);
      const midPt = base.clone().add(new THREE.Vector3(side * ws.len * 0.52, ws.spreadY * 0.65, ws.sweepZ * 0.35));
      const tipPt = base.clone().add(new THREE.Vector3(side * ws.len, ws.spreadY - 0.003, ws.sweepZ));
      const wCurve = new THREE.CatmullRomCurve3([base, midPt, tipPt]);
      const wGeom = buildTaperedTube(
        THREE,
        wCurve,
        12,
        6,
        (t) => 0.00046 * (1 - t * 0.68),
        { capStart: false, capEnd: true }
      );
      const wMesh = new THREE.Mesh(wGeom, whiskerMat);
      wMesh.userData.slot = "furAccent";
      noseGroup.add(wMesh);
    }
  }

  return noseGroup;
}

function buildBlushDisc(THREE, kit, side, blushMat) {
  const geom = new THREE.PlaneGeometry(0.017, 0.0115, 8, 6);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const zCurve = -(x * x + y * y) * 14.0;
    pos.setZ(i, zCurve);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, blushMat);
  mesh.userData.slot = "skin";

  const dir = new THREE.Vector3(side * 0.72, -0.14, 0.68).normalize();
  const anchor = sculptHeadPoint(dir.x, dir.y, dir.z, kit);
  mesh.position.set(
    anchor[0] + dir.x * 0.0012,
    anchor[1] + dir.y * 0.0012,
    anchor[2] + dir.z * 0.0012
  );
  mesh.lookAt(mesh.position.clone().add(dir));
  return mesh;
}

export function build(THREE, opts, kit) {
  const safeOpts = opts || {};
  const variant = PALETTES[safeOpts.variant] ? safeOpts.variant : "meadow";
  const pal = PALETTES[variant];

  const furRgb = parseHex(safeOpts.fur, pal.fur);
  const accentRgb = parseHex(safeOpts.furAccent, pal.furAccent);
  const eyeRgb = parseHex(safeOpts.eye, pal.eye);
  const noseRgb = mixRgb(parseHex(pal.nose, pal.nose), furRgb, 0.12);
  const innerEarRgb = mixRgb(parseHex(pal.innerEar, pal.innerEar), accentRgb, 0.18);
  const blushRgb = parseHex(pal.blush, pal.blush);

  const sheenHex = rgbHex(mixRgb(furRgb, [1, 0.98, 0.95], 0.52));
  const accentSheenHex = rgbHex(mixRgb(accentRgb, [1, 1, 1], 0.5));

  const bodyTex = makeFurTextures(THREE, kit, furRgb, accentRgb, "body");
  const headTex = makeFurTextures(THREE, kit, furRgb, accentRgb, "head");
  const earTex = makeFurTextures(THREE, kit, furRgb, accentRgb, "ear");
  const tailTex = makeFurTextures(THREE, kit, furRgb, accentRgb, "tail");
  const innerEarTex = makeInnerEarTexture(THREE, kit, innerEarRgb, accentRgb);
  const antlerTex = makeAntlerTextures(THREE, kit, accentRgb);
  const irisTex = makeIrisTexture(THREE, kit, eyeRgb);
  const blushTex = makeBlushTexture(THREE, kit, blushRgb);

  const makeFurMat = (texPair, sheenCol) =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texPair.map,
      bumpMap: texPair.bumpMap,
      bumpScale: 0.0022,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color(sheenCol)
    });

  const bodyFurMat = makeFurMat(bodyTex, sheenHex);
  const headFurMat = makeFurMat(headTex, sheenHex);
  const earFurMat = makeFurMat(earTex, sheenHex);
  const tailFurMat = makeFurMat(tailTex, accentSheenHex);

  const limbFurMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbHex(mixRgb(furRgb, accentRgb, 0.14))),
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0018,
    roughness: 0.91,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(sheenHex)
  });

  const pawFurMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbHex(mixRgb(furRgb, accentRgb, 0.42))),
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0016,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(accentSheenHex)
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: innerEarTex,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(rgbHex(mixRgb(innerEarRgb, [1, 0.96, 0.95], 0.45)))
  });

  const antlerMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: antlerTex.map,
    bumpMap: antlerTex.bumpMap,
    bumpScale: 0.0018,
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.48,
    clearcoatRoughness: 0.26
  });

  const glowMat = pal.glow
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(pal.glow),
        emissive: new THREE.Color(pal.glow),
        emissiveIntensity: 1.5,
        roughness: 0.2,
        clearcoat: 0.8
      })
    : null;

  const eyeBaseMat = new THREE.MeshPhysicalMaterial({
    color: 0x110b09,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: irisTex,
    roughness: 0.07,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  const catchlightMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const lashMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbHex(scaleRgb(furRgb, 0.24))),
    roughness: 0.65,
    sheen: 0.3
  });

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbHex(noseRgb)),
    roughness: 0.44,
    metalness: 0.0,
    clearcoat: 0.26,
    clearcoatRoughness: 0.38,
    sheen: 0.35,
    sheenColor: new THREE.Color(rgbHex(mixRgb(noseRgb, [1, 0.9, 0.9], 0.4)))
  });

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbHex(scaleRgb(noseRgb, 0.42))),
    roughness: 0.55
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbHex(mixRgb(accentRgb, [1, 1, 1], 0.55))),
    roughness: 0.4,
    clearcoat: 0.3
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: blushTex,
    transparent: true,
    depthWrite: false,
    roughness: 0.95
  });

  const root = new THREE.Group();
  root.name = "jackalope";

  // --- BODY GROUP ---
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";

  const bodyGeom = buildBodyGeometry(THREE, kit);
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyFurMat);
  bodyMesh.userData.slot = "fur";
  bodyGroup.add(bodyMesh);

  // Hind legs / feet (legL, legR)
  const hindFootGeom = buildHindFootGeometry(THREE, kit);
  for (const side of [1, -1]) {
    const legGroup = new THREE.Group();
    legGroup.name = side > 0 ? "legL" : "legR";
    legGroup.position.set(side * 0.044, 0, 0.022);
    legGroup.rotation.y = side * 0.24;

    const footMesh = new THREE.Mesh(hindFootGeom, pawFurMat);
    footMesh.userData.slot = "fur";
    legGroup.add(footMesh);
    bodyGroup.add(legGroup);
  }

  // Right arm resting softly on the ground (armR, -X)
  const armRGroup = new THREE.Group();
  armRGroup.name = "armR";
  armRGroup.position.set(-0.032, 0.114, 0.028);

  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.008, 0.004, -0.008),
    new THREE.Vector3(-0.006, -0.036, 0.018),
    new THREE.Vector3(-0.003, -0.074, 0.036),
    new THREE.Vector3(0.005, -0.102, 0.042)
  ]);
  const armRGeom = buildTaperedTube(
    THREE,
    armRCurve,
    22,
    14,
    (t) => 0.0195 * (1 - t * 0.44),
    { capStart: true, capEnd: true }
  );
  const armRMesh = new THREE.Mesh(armRGeom, limbFurMat);
  armRMesh.userData.slot = "fur";
  armRGroup.add(armRMesh);

  const restingPawGeom = buildFrontPawGeometry(THREE, kit, true);
  const pawRMesh = new THREE.Mesh(restingPawGeom, pawFurMat);
  pawRMesh.position.set(0.006, -0.114, 0.049);
  pawRMesh.rotation.y = -0.12;
  pawRMesh.userData.slot = "fur";
  armRGroup.add(pawRMesh);
  bodyGroup.add(armRGroup);

  // Left arm gently raised in an alert curious pose (armL, +X)
  const armLGroup = new THREE.Group();
  armLGroup.name = "armL";
  armLGroup.position.set(0.032, 0.114, 0.028);

  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.008, 0.004, -0.008),
    new THREE.Vector3(0.008, -0.028, 0.019),
    new THREE.Vector3(0.003, -0.048, 0.039),
    new THREE.Vector3(-0.009, -0.042, 0.049)
  ]);
  const armLGeom = buildTaperedTube(
    THREE,
    armLCurve,
    22,
    14,
    (t) => 0.0195 * (1 - t * 0.45),
    { capStart: true, capEnd: true }
  );
  const armLMesh = new THREE.Mesh(armLGeom, limbFurMat);
  armLMesh.userData.slot = "fur";
  armLGroup.add(armLMesh);

  const raisedPawGeom = buildFrontPawGeometry(THREE, kit, false);
  const pawLMesh = new THREE.Mesh(raisedPawGeom, pawFurMat);
  pawLMesh.position.set(-0.012, -0.047, 0.056);
  pawLMesh.rotation.set(0.58, -0.26, 0.14);
  pawLMesh.userData.slot = "fur";
  armLGroup.add(pawLMesh);
  bodyGroup.add(armLGroup);

  // Fluffy curled hare tail (tail)
  const tailGroup = new THREE.Group();
  tailGroup.name = "tail";
  tailGroup.position.set(0, 0.036, -0.072);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.012),
    new THREE.Vector3(0.002, 0.005, -0.012),
    new THREE.Vector3(0.006, 0.022, -0.026),
    new THREE.Vector3(0.009, 0.042, -0.022)
  ]);
  const tailGeom = buildTaperedTube(
    THREE,
    tailCurve,
    24,
    20,
    (t) => 0.012 + Math.sin(Math.pow(t, 0.78) * Math.PI) * 0.0175,
    {
      capStart: true,
      capEnd: true,
      profileFn: (t, theta) =>
        1 + (kit.noise(Math.cos(theta) * 2.5 + 4, t * 4 + 2) - 0.5) * 0.18
    }
  );
  const tailMesh = new THREE.Mesh(tailGeom, tailFurMat);
  tailMesh.userData.slot = "furAccent";
  tailGroup.add(tailMesh);
  bodyGroup.add(tailGroup);

  root.add(bodyGroup);

  // --- HEAD GROUP ---
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.set(0, 0.143, 0.015);
  headGroup.rotation.set(0.03, -0.09, 0.07);

  const headGeom = buildHeadGeometry(THREE, kit);
  const headMesh = new THREE.Mesh(headGeom, headFurMat);
  headMesh.userData.slot = "fur";
  headGroup.add(headMesh);

  // Eyes nestled into sculpted orbital hollows
  const eyeGroups = [];
  for (const side of [1, -1]) {
    const socketDir = new THREE.Vector3(side * 0.62, 0.16, 0.77).normalize();
    const socketPt = sculptHeadPoint(socketDir.x, socketDir.y, socketDir.z, kit);
    const eyeG = buildEyeGroup(THREE, side, eyeBaseMat, irisMat, catchlightMat, lashMat);
    eyeG.position.set(
      socketPt[0] - socketDir.x * 0.0036,
      socketPt[1] - socketDir.y * 0.0036,
      socketPt[2] - socketDir.z * 0.0036
    );
    const lookDir = new THREE.Vector3(side * 0.54, 0.10, 0.835).normalize();
    eyeG.lookAt(eyeG.position.clone().add(lookDir));
    headGroup.add(eyeG);
    eyeGroups.push(eyeG);
  }

  // Nose, curved tube mouth & delicate whiskers
  const noseGroup = buildNoseAndMouth(THREE, kit, noseMat, mouthMat, whiskerMat);
  headGroup.add(noseGroup);

  // Subtle curved cheek blush discs
  headGroup.add(buildBlushDisc(THREE, kit, 1, blushMat));
  headGroup.add(buildBlushDisc(THREE, kit, -1, blushMat));

  // Long alert ears (earL, earR)
  const earAnchorL = sculptHeadPoint(0.42, 0.76, -0.22, kit);
  const earL = buildEarMeshPair(THREE, earFurMat, innerEarMat, {
    curveZ: 0.006,
    curveX: 0.005,
    twist: -0.06
  });
  earL.name = "earL";
  earL.position.set(earAnchorL[0], earAnchorL[1] - 0.009, earAnchorL[2]);
  earL.rotation.set(0.08, 0.30, -0.15);
  headGroup.add(earL);

  const earAnchorR = sculptHeadPoint(-0.42, 0.76, -0.22, kit);
  const earR = buildEarMeshPair(THREE, earFurMat, innerEarMat, {
    curveZ: -0.004,
    curveX: -0.011,
    twist: 0.10
  });
  earR.name = "earR";
  earR.position.set(earAnchorR[0], earAnchorR[1] - 0.009, earAnchorR[2]);
  earR.rotation.set(-0.04, -0.24, 0.25);
  headGroup.add(earR);

  // Branching antlers (horn)
  const hornGroup = buildAntlersGroup(THREE, kit, antlerMat, glowMat);
  headGroup.add(hornGroup);

  root.add(headGroup);

  // Store rest transforms for smooth deterministic idle animation
  root.userData.anim = {
    body: bodyGroup,
    head: headGroup,
    earL,
    earR,
    armL: armLGroup,
    tail: tailGroup,
    nose: noseGroup,
    eyeL: eyeGroups[0],
    eyeR: eyeGroups[1],
    headPosY: headGroup.position.y,
    headRot: [headGroup.rotation.x, headGroup.rotation.y, headGroup.rotation.z],
    earLRot: [earL.rotation.x, earL.rotation.y, earL.rotation.z],
    earRRot: [earR.rotation.x, earR.rotation.y, earR.rotation.z],
    armLRot: [armLGroup.rotation.x, armLGroup.rotation.y, armLGroup.rotation.z],
    tailRot: [tailGroup.rotation.x, tailGroup.rotation.y, tailGroup.rotation.z],
    nosePosY: noseGroup.position.y
  };

  return root;
}

export function idle(group, t) {
  const a = group && group.userData && group.userData.anim;
  if (!a) return;

  // Gentle cozy breathing
  const breath = Math.sin(t * 2.55) * 0.5 + Math.sin(t * 5.1 + 0.4) * 0.08;
  a.body.scale.set(1 + breath * 0.007, 1 + breath * 0.013, 1 + breath * 0.008);

  // Curious head sway, gentle nod and breathing sync
  a.head.position.y = a.headPosY + breath * 0.0016;
  a.head.rotation.x = a.headRot[0] + Math.sin(t * 1.15) * 0.026 + breath * 0.01;
  a.head.rotation.y = a.headRot[1] + Math.sin(t * 0.72) * 0.062 + Math.sin(t * 1.65) * 0.015;
  a.head.rotation.z = a.headRot[2] + Math.sin(t * 0.93 + 1.1) * 0.036;

  // Alert listening ear motion + occasional crisp twitch
  const twitchCycleR = (t + 1.2) % 4.7;
  const twitchR = twitchCycleR < 0.24 ? Math.sin((twitchCycleR / 0.24) * Math.PI) * 0.095 : 0;
  const twitchCycleL = (t + 3.4) % 5.9;
  const twitchL = twitchCycleL < 0.22 ? Math.sin((twitchCycleL / 0.22) * Math.PI) * 0.075 : 0;

  a.earL.rotation.x = a.earLRot[0] + Math.sin(t * 1.45 + 0.5) * 0.028 + twitchL * 0.35;
  a.earL.rotation.z = a.earLRot[2] + Math.sin(t * 1.05) * 0.026 - twitchL;

  a.earR.rotation.x = a.earRRot[0] + Math.sin(t * 1.32 + 2.1) * 0.032 - twitchR * 0.3;
  a.earR.rotation.z = a.earRRot[2] + Math.sin(t * 1.12 + 1.4) * 0.030 + twitchR;

  // Subtle bob on raised curious front paw
  a.armL.rotation.x = a.armLRot[0] + Math.sin(t * 2.55 - 0.5) * 0.038;
  a.armL.rotation.z = a.armLRot[2] + Math.sin(t * 1.4 + 0.8) * 0.018;

  // Cozy tail wiggle
  a.tail.rotation.x = a.tailRot[0] + Math.sin(t * 2.55 + 0.7) * 0.045;
  a.tail.rotation.z = a.tailRot[2] + Math.sin(t * 3.2) * 0.035;

  // Classic bunny double nose wiggle every few seconds
  const noseCycle = t % 3.4;
  let noseWiggle = 0;
  if (noseCycle < 0.36) {
    noseWiggle = Math.sin((noseCycle / 0.36) * Math.PI * 4) * Math.sin((noseCycle / 0.36) * Math.PI) * 0.0009;
  }
  a.nose.position.y = a.nosePosY + noseWiggle;

  // Natural eye blink every ~3.9 s
  const blinkCycle = (t + 0.8) % 3.9;
  let eyeScaleY = 1;
  if (blinkCycle < 0.16) {
    const p = blinkCycle / 0.16;
    eyeScaleY = 1 - Math.sin(p * Math.PI) * 0.92;
  }
  a.eyeL.scale.y = eyeScaleY;
  a.eyeR.scale.y = eyeScaleY;
}