export const META = {
  id: 'pegasus-foal',
  name: 'Pegasus Foal',
  kind: 'creature',
  footprint: [0.42, 0.40],
  variants: ['cloud', 'peach', 'lavender', 'starlight'],
  note: 'Stylised pegasus foal (~0.5 m tall) with sculpted body and head, three layers of curved bezier feathers per half-open wing, flowing mane and tail, and soft plush shading.'
};

const PALETTES = {
  cloud: {
    fur: '#faf3eb',
    furAccent: '#a8cdf4',
    eye: '#487cc9',
    skin: '#f4ccc5',
    hoof: '#d9c6b4',
    glow: '#d8ebff'
  },
  peach: {
    fur: '#fff1e5',
    furAccent: '#f2a194',
    eye: '#4d9886',
    skin: '#f5bfb7',
    hoof: '#e0bda7',
    glow: '#ffe0d4'
  },
  lavender: {
    fur: '#f5effa',
    furAccent: '#b89ce8',
    eye: '#7456c4',
    skin: '#f0c6d8',
    hoof: '#cfc0dc',
    glow: '#e5d8ff'
  },
  starlight: {
    fur: '#e2e9f8',
    furAccent: '#f2cf78',
    eye: '#3b5ba8',
    skin: '#e7cbd8',
    hoof: '#dac58f',
    glow: '#fff0b8'
  }
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixColor(THREE, a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

function colorToCss(c, alpha = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function resolvePalette(THREE, opts = {}) {
  const variant = PALETTES[opts.variant] ? opts.variant : 'cloud';
  const base = PALETTES[variant];
  const fur = new THREE.Color(opts.fur !== undefined ? opts.fur : base.fur);
  const furAccent = new THREE.Color(opts.furAccent !== undefined ? opts.furAccent : base.furAccent);
  const eye = new THREE.Color(opts.eye !== undefined ? opts.eye : base.eye);
  const skin = new THREE.Color(base.skin);
  const hoof = new THREE.Color(base.hoof);
  const glow = new THREE.Color(base.glow);
  return { variant, fur, furAccent, eye, skin, hoof, glow };
}

function createFurTextures(THREE, kit, pal) {
  const furBack = mixColor(THREE, pal.fur, pal.furAccent, 0.14).multiplyScalar(0.96);
  const furBelly = mixColor(THREE, pal.fur, '#ffffff', 0.38);
  const furFleckA = mixColor(THREE, pal.fur, '#ffffff', 0.45);
  const furFleckB = mixColor(THREE, pal.fur, pal.furAccent, 0.22).multiplyScalar(0.92);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colorToCss(furBack));
    grad.addColorStop(0.32, colorToCss(pal.fur));
    grad.addColorStop(0.68, colorToCss(pal.fur));
    grad.addColorStop(1.0, colorToCss(furBelly));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const n = kit.noise(x * 0.018 + 3.1, y * 0.018 + 7.4);
        if (n > 0.54) {
          const a = (n - 0.54) * 0.22;
          ctx.fillStyle = colorToCss(furFleckA, a);
          ctx.fillRect(x, y, 7, 7);
        } else if (n < 0.42) {
          const a = (0.42 - n) * 0.18;
          ctx.fillStyle = colorToCss(furFleckB, a);
          ctx.fillRect(x, y, 7, 7);
        }
      }
    }

    ctx.lineCap = 'round';
    for (let i = 0; i < 1600; i++) {
      const fx = kit.noise(i * 0.73, 1.3) * w;
      const fy = kit.noise(2.7, i * 0.61) * h;
      const len = 5 + kit.noise(i * 0.37, 9.1) * 9;
      const ang = Math.PI * 0.5 + (kit.noise(i * 0.19, 4.4) - 0.5) * 0.55;
      const bright = kit.noise(i * 0.41, 8.2) > 0.48;
      ctx.strokeStyle = colorToCss(bright ? furFleckA : furFleckB, 0.14);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (let i = 0; i < 1800; i++) {
      const fx = kit.noise(i * 0.83, 2.1) * w;
      const fy = kit.noise(5.3, i * 0.57) * h;
      const len = 4 + kit.noise(i * 0.29, 3.7) * 7;
      const v = Math.round(98 + kit.noise(i * 0.91, 6.2) * 60);
      ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (kit.noise(i, 1.1) - 0.5) * 2.5, fy + len);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap };
}

function createHeadTexture(THREE, kit, pal) {
  const furTop = mixColor(THREE, pal.fur, pal.furAccent, 0.10).multiplyScalar(0.97);
  const muzzleCol = mixColor(THREE, pal.fur, pal.skin, 0.28);
  const blazeCol = mixColor(THREE, pal.fur, '#ffffff', 0.55);
  const blushCol = mixColor(THREE, pal.skin, '#f38e9a', 0.38);
  const furFleck = mixColor(THREE, pal.fur, '#ffffff', 0.42);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colorToCss(furTop));
    grad.addColorStop(0.45, colorToCss(pal.fur));
    grad.addColorStop(1.0, colorToCss(mixColor(THREE, pal.fur, '#ffffff', 0.22)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Front of SphereGeometry is u = 0.25 -> x = 0.25 * w
    const frontX = w * 0.25;
    const muzzleY = h * 0.56;
    const mGrad = ctx.createRadialGradient(frontX, muzzleY, 6, frontX, muzzleY, w * 0.13);
    mGrad.addColorStop(0.0, colorToCss(muzzleCol, 0.92));
    mGrad.addColorStop(0.65, colorToCss(muzzleCol, 0.45));
    mGrad.addColorStop(1.0, colorToCss(muzzleCol, 0.0));
    ctx.fillStyle = mGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft forehead cream blaze
    ctx.save();
    ctx.translate(frontX, h * 0.37);
    ctx.scale(0.42, 1.0);
    const bGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, h * 0.12);
    bGrad.addColorStop(0.0, colorToCss(blazeCol, 0.62));
    bGrad.addColorStop(0.7, colorToCss(blazeCol, 0.22));
    bGrad.addColorStop(1.0, colorToCss(blazeCol, 0.0));
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Gentle cheek warmth under outer eyes (u ~ 0.13 and u ~ 0.37)
    for (const cx of [w * 0.135, w * 0.365]) {
      const cGrad = ctx.createRadialGradient(cx, h * 0.56, 2, cx, h * 0.56, w * 0.065);
      cGrad.addColorStop(0.0, colorToCss(blushCol, 0.34));
      cGrad.addColorStop(1.0, colorToCss(blushCol, 0.0));
      ctx.fillStyle = cGrad;
      ctx.fillRect(cx - w * 0.07, h * 0.48, w * 0.14, h * 0.16);
    }

    // Fine plush fur strokes
    ctx.lineCap = 'round';
    for (let i = 0; i < 1200; i++) {
      const fx = kit.noise(i * 0.67, 3.3) * w;
      const fy = kit.noise(8.1, i * 0.53) * h;
      const len = 4 + kit.noise(i * 0.31, 4.9) * 7;
      ctx.strokeStyle = colorToCss(furFleck, 0.15);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (kit.noise(i, 2.2) - 0.5) * 2.5, fy + len);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  return map;
}

function createFeatherTextures(THREE, kit, pal, tipBlend = 0.92) {
  const baseCol = mixColor(THREE, pal.fur, '#ffffff', 0.16);
  const midCol = mixColor(THREE, pal.fur, pal.furAccent, tipBlend * 0.42);
  const tipCol = mixColor(THREE, pal.fur, pal.furAccent, tipBlend);
  const edgeHighlight = mixColor(THREE, tipCol, '#ffffff', 0.35);
  const quillCol = mixColor(THREE, pal.fur, '#ffffff', 0.55);

  const map = kit.canvasTexture(256, 512, (ctx, w, h) => {
    // v = 0 at feather base (canvas y = h), v = 1 at feather tip (canvas y = 0)
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, colorToCss(baseCol));
    grad.addColorStop(0.46, colorToCss(baseCol));
    grad.addColorStop(0.74, colorToCss(midCol));
    grad.addColorStop(0.95, colorToCss(tipCol));
    grad.addColorStop(1.0, colorToCss(edgeHighlight));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine feather barbs angling upward and outward from central shaft
    ctx.lineCap = 'round';
    for (let i = 0; i < 240; i++) {
      const t = i / 240;
      const y = h * (0.04 + t * 0.92);
      const n = kit.noise(t * 14.0, 2.5);
      const barbCol = n > 0.5
        ? colorToCss(edgeHighlight, 0.16 + 0.10 * (1 - t))
        : colorToCss(mixColor(THREE, tipCol, '#3a4055', 0.16), 0.10);
      ctx.strokeStyle = barbCol;
      ctx.lineWidth = 1.3;

      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5, y);
        ctx.quadraticCurveTo(
          w * (0.5 + side * 0.25),
          y - h * 0.035,
          w * (0.5 + side * 0.52),
          y - h * 0.075
        );
        ctx.stroke();
      }
    }

    // Central rachis (quill)
    const qGrad = ctx.createLinearGradient(0, h, 0, 0);
    qGrad.addColorStop(0.0, colorToCss(quillCol, 0.65));
    qGrad.addColorStop(0.8, colorToCss(quillCol, 0.35));
    qGrad.addColorStop(1.0, colorToCss(quillCol, 0.0));
    ctx.strokeStyle = qGrad;
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.lineTo(w * 0.5, h * 0.08);
    ctx.stroke();
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#787878';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 130; i++) {
      const y = h * (0.04 + (i / 130) * 0.92);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(205,205,205,0.45)' : 'rgba(90,90,90,0.4)';
      ctx.lineWidth = 1.4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5, y);
        ctx.lineTo(w * (0.5 + side * 0.5), y - h * 0.07);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(235,235,235,0.85)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.lineTo(w * 0.5, h * 0.1);
    ctx.stroke();
  });

  return { map, bumpMap };
}

function createHairTextures(THREE, kit, pal) {
  const rootCol = mixColor(THREE, pal.furAccent, '#2a2438', 0.16);
  const midCol = pal.furAccent.clone();
  const tipCol = mixColor(THREE, pal.furAccent, '#ffffff', 0.38);
  const sheenStrand = mixColor(THREE, pal.furAccent, '#ffffff', 0.62);

  const map = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, colorToCss(rootCol));
    grad.addColorStop(0.35, colorToCss(midCol));
    grad.addColorStop(0.85, colorToCss(tipCol));
    grad.addColorStop(1.0, colorToCss(sheenStrand));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 140; i++) {
      const x = (i / 140) * w;
      const n = kit.noise(i * 0.37, 4.2);
      ctx.strokeStyle = n > 0.5
        ? colorToCss(sheenStrand, 0.22)
        : colorToCss(rootCol, 0.20);
      ctx.lineWidth = 1.2 + n * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, h);
      for (let y = h; y >= 0; y -= 32) {
        const wave = (kit.noise(i * 0.15, y * 0.015) - 0.5) * 7;
        ctx.lineTo(x + wave, y);
      }
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 96; i++) {
      const x = (i / 96) * w;
      const v = Math.round(90 + kit.noise(i * 0.55, 1.7) * 90);
      ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap };
}

function createIrisTexture(THREE, kit, pal) {
  const darkRim = mixColor(THREE, pal.eye, '#0a0b16', 0.65);
  const deepUpper = mixColor(THREE, pal.eye, '#13162a', 0.42);
  const brightLower = mixColor(THREE, pal.eye, '#ffffff', 0.46);
  const sparkleRim = mixColor(THREE, pal.eye, '#e8f7ff', 0.72);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.48;

    ctx.fillStyle = '#12101a';
    ctx.fillRect(0, 0, w, h);

    // Iris gradient
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0.0, colorToCss(deepUpper));
    g.addColorStop(0.45, colorToCss(pal.eye));
    g.addColorStop(0.84, colorToCss(brightLower));
    g.addColorStop(1.0, colorToCss(sparkleRim));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Radial iris fibres
    for (let i = 0; i < 110; i++) {
      const a = (i / 110) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5);
      const r0 = R * 0.34;
      const r1 = R * (0.82 + n * 0.14);
      ctx.strokeStyle = n > 0.5
        ? colorToCss(sparkleRim, 0.25)
        : colorToCss(darkRim, 0.28);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    // Glowing lower crescent reflection
    const cres = ctx.createRadialGradient(cx, cy + R * 0.44, 4, cx, cy + R * 0.36, R * 0.54);
    cres.addColorStop(0.0, colorToCss(sparkleRim, 0.72));
    cres.addColorStop(0.65, colorToCss(brightLower, 0.25));
    cres.addColorStop(1.0, colorToCss(brightLower, 0.0));
    ctx.fillStyle = cres;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Dark limbal ring
    ctx.strokeStyle = colorToCss(darkRim, 0.92);
    ctx.lineWidth = R * 0.14;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
    ctx.stroke();

    // Soft glossy dark pupil
    const pGrad = ctx.createRadialGradient(cx, cy - R * 0.04, R * 0.1, cx, cy, R * 0.46);
    pGrad.addColorStop(0.0, '#090810');
    pGrad.addColorStop(0.82, '#141222');
    pGrad.addColorStop(1.0, colorToCss(darkRim, 0.0));
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.46, 0, Math.PI * 2);
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createBlushTexture(THREE, kit, pal) {
  const rose = mixColor(THREE, pal.skin, '#f57f8e', 0.52);
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0.0, colorToCss(rose, 0.58));
    g.addColorStop(0.5, colorToCss(rose, 0.26));
    g.addColorStop(1.0, colorToCss(rose, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createInnerEarTexture(THREE, kit, pal) {
  const deepPink = mixColor(THREE, pal.skin, '#e39095', 0.42);
  const edgeCream = mixColor(THREE, pal.fur, pal.skin, 0.45);
  const map = kit.canvasTexture(128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0.0, colorToCss(deepPink));
    g.addColorStop(0.65, colorToCss(pal.skin));
    g.addColorStop(1.0, colorToCss(edgeCream));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function buildTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, opts = {}) {
  const { capStart = true, capEnd = true, twistFn = null } = opts;
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    pts.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  // Parallel transport frames to prevent twisting/pinching
  const normals = [];
  const binormals = [];
  let n0 = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tangents[0].dot(n0)) > 0.92) n0.set(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  n0 = new THREE.Vector3().crossVectors(b0, tangents[0]).normalize();
  normals.push(n0);
  binormals.push(b0);

  for (let i = 1; i <= tubularSegments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const prevN = normals[i - 1].clone();
    const axis = new THREE.Vector3().crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      prevN.applyAxisAngle(axis, angle);
    }
    prevN.addScaledVector(currT, -prevN.dot(currT)).normalize();
    const currB = new THREE.Vector3().crossVectors(currT, prevN).normalize();
    normals.push(prevN);
    binormals.push(currB);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringVerts = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const p = pts[i];
    const rad = radiusFn(u);
    const rx = typeof rad === 'number' ? rad : rad.rx;
    const ry = typeof rad === 'number' ? rad : rad.ry;
    const twist = twistFn ? twistFn(u) : 0;
    const cosTw = Math.cos(twist);
    const sinTw = Math.sin(twist);
    const nVec = normals[i];
    const bVec = binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const cx = Math.cos(theta) * rx;
      const cy = Math.sin(theta) * ry;
      const lx = cx * cosTw - cy * sinTw;
      const ly = cx * sinTw + cy * cosTw;
      positions.push(
        p.x + nVec.x * lx + bVec.x * ly,
        p.y + nVec.y * lx + bVec.y * ly,
        p.z + nVec.z * lx + bVec.z * ly
      );
      uvs.push(v, u);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + j + 1;
      const d = i * ringVerts + j + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  if (capStart) {
    const cIdx = positions.length / 3;
    const p0 = pts[0];
    const r0 = radiusFn(0);
    const rAvg = typeof r0 === 'number' ? r0 : (r0.rx + r0.ry) * 0.5;
    positions.push(
      p0.x - tangents[0].x * rAvg * 0.35,
      p0.y - tangents[0].y * rAvg * 0.35,
      p0.z - tangents[0].z * rAvg * 0.35
    );
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(cIdx, j, j + 1);
    }
  }

  if (capEnd) {
    const cIdx = positions.length / 3;
    const pe = pts[tubularSegments];
    const te = tangents[tubularSegments];
    const re = radiusFn(1);
    const rAvg = typeof re === 'number' ? re : (re.rx + re.ry) * 0.5;
    positions.push(
      pe.x + te.x * rAvg * 0.35,
      pe.y + te.y * rAvg * 0.35,
      pe.z + te.z * rAvg * 0.35
    );
    uvs.push(0.5, 1);
    const base = tubularSegments * ringVerts;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(cIdx, base + j + 1, base + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildSculptedBodyGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.055;
    let y = ny * 0.056;
    let z = nz * 0.112;

    // Proud foal chest fullness
    const chest = smoothstep(0.15, 0.92, nz);
    const chestMidY = Math.exp(-Math.pow((ny + 0.08) / 0.62, 2));
    z += 0.013 * chest * chestMidY;
    x *= 1 + 0.12 * chest * (1 - ny * ny * 0.7);

    // Withers & smooth rise into neck base
    const withers = smoothstep(0.15, 0.78, nz) * smoothstep(0.05, 0.88, ny);
    y += 0.015 * withers;
    z += 0.006 * withers;

    // Gentle saddle dip in mid-back
    const backDip = Math.exp(-Math.pow((nz - 0.02) / 0.36, 2)) * smoothstep(0.1, 0.95, ny);
    y -= 0.0085 * backDip;

    // Rounded cute foal croup & haunches
    const rump = smoothstep(-0.15, -0.88, nz);
    y += 0.010 * rump * smoothstep(-0.15, 0.85, ny);
    x *= 1 + 0.14 * rump * (1 - ny * ny * 0.65);

    // Soft shoulder and hip muscle contours
    const shoulderSwell = Math.exp(-Math.pow((nz - 0.56) / 0.28, 2)) * Math.exp(-Math.pow((ny + 0.12) / 0.55, 2));
    const hipSwell = Math.exp(-Math.pow((nz + 0.56) / 0.30, 2)) * Math.exp(-Math.pow((ny + 0.08) / 0.55, 2));
    x *= 1 + (0.09 * shoulderSwell + 0.11 * hipSwell) * Math.abs(nx);

    // Gentle plump tummy & flattened underside with subtle foal flank tuck
    const bellyMid = Math.exp(-Math.pow((nz - 0.05) / 0.52, 2));
    const underside = smoothstep(-0.22, -0.95, ny);
    y -= 0.005 * bellyMid * underside;
    if (ny < -0.58) {
      y += (-0.58 - ny) * 0.014;
    }
    const flankTuck = Math.exp(-Math.pow((nz + 0.36) / 0.25, 2)) * smoothstep(-0.15, -0.8, ny);
    y += 0.007 * flankTuck;
    x *= 1 - 0.06 * flankTuck;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

const EYE_DIR_L = { x: 0.621, y: 0.060, z: 0.781 };
const EYE_DIR_R = { x: -0.621, y: 0.060, z: 0.781 };

function sculptHeadPoint(nx, ny, nz, out) {
  let x = nx * 0.049;
  let y = ny * 0.051;
  let z = nz * 0.052;

  // Adorable domed forehead
  const forehead = smoothstep(0.12, 0.88, ny) * smoothstep(-0.35, 0.55, nz);
  y += 0.0085 * forehead;
  z += 0.003 * forehead;

  // Soft chibi cheeks
  const cheek = Math.exp(-Math.pow((Math.abs(nx) - 0.70) / 0.34, 2))
    * Math.exp(-Math.pow((ny + 0.18) / 0.42, 2))
    * Math.exp(-Math.pow((nz - 0.22) / 0.54, 2));
  x += Math.sign(nx || 1) * 0.0115 * cheek;
  z += 0.004 * cheek;

  // Continuous equine foal muzzle extending forward and slightly downward
  const fwd = Math.max(0, nz);
  const muzzleVert = smoothstep(0.60, -0.22, ny);
  const muzzleMask = Math.pow(fwd, 1.55) * muzzleVert;
  z += 0.036 * muzzleMask;
  y -= 0.017 * Math.pow(fwd, 1.65) * smoothstep(0.55, -0.25, ny);

  // Taper width across bridge and round off soft velvet nose tip
  const muzzleNarrow = smoothstep(0.42, 0.96, nz) * smoothstep(0.55, -0.45, ny);
  x *= 1 - 0.34 * muzzleNarrow;

  // Plush rounded upper lip / soft blunted muzzle tip
  const nosePad = smoothstep(0.76, 0.99, nz) * Math.exp(-Math.pow((ny + 0.14) / 0.34, 2));
  y += 0.0045 * nosePad;
  z -= 0.003 * smoothstep(0.90, 1.0, nz) * Math.exp(-Math.pow((ny + 0.15) / 0.3, 2));

  // Soft chin & throat taper for seamless skull-to-neck transition
  const chin = smoothstep(0.42, 0.88, nz) * smoothstep(-0.22, -0.78, ny);
  y -= 0.0035 * chin;
  const occiput = smoothstep(-0.25, -0.95, nz) * smoothstep(0.35, -0.65, ny);
  y -= 0.004 * occiput;
  z -= 0.004 * occiput;

  // Gentle eye socket basins so eyes sit slightly inset, never floating
  const dotL = nx * EYE_DIR_L.x + ny * EYE_DIR_L.y + nz * EYE_DIR_L.z;
  const dotR = nx * EYE_DIR_R.x + ny * EYE_DIR_R.y + nz * EYE_DIR_R.z;
  const eyeIndent = Math.max(smoothstep(0.895, 0.985, dotL), smoothstep(0.895, 0.985, dotR));
  x -= nx * 0.0052 * eyeIndent;
  y -= ny * 0.0052 * eyeIndent;
  z -= nz * 0.0052 * eyeIndent;

  // Subtle expressive brow puff just above eyes
  const browL = Math.exp(-Math.pow((nx - 0.52) / 0.28, 2)) * Math.exp(-Math.pow((ny - 0.33) / 0.18, 2)) * smoothstep(0.4, 0.85, nz);
  const browR = Math.exp(-Math.pow((nx + 0.52) / 0.28, 2)) * Math.exp(-Math.pow((ny - 0.33) / 0.18, 2)) * smoothstep(0.4, 0.85, nz);
  const brow = browL + browR;
  z += 0.0032 * brow;
  y += 0.0018 * brow;

  out.set(x, y, z);
  return out;
}

function getHeadSurfaceFrame(THREE, dir) {
  const d = dir.clone().normalize();
  const p = sculptHeadPoint(d.x, d.y, d.z, new THREE.Vector3());
  const up = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t1 = new THREE.Vector3().crossVectors(up, d).normalize();
  const t2 = new THREE.Vector3().crossVectors(d, t1).normalize();
  const eps = 0.015;
  const d1 = d.clone().addScaledVector(t1, eps).normalize();
  const d2 = d.clone().addScaledVector(t2, eps).normalize();
  const p1 = sculptHeadPoint(d1.x, d1.y, d1.z, new THREE.Vector3()).sub(p);
  const p2 = sculptHeadPoint(d2.x, d2.y, d2.z, new THREE.Vector3()).sub(p);
  const normal = new THREE.Vector3().crossVectors(p1, p2).normalize();
  if (normal.dot(d) < 0) normal.negate();
  return { point: p, normal };
}

function buildSculptedHeadGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 60, 44);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    sculptHeadPoint(pos.getX(i), pos.getY(i), pos.getZ(i), v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildHoofGeometry(THREE) {
  // 20-point rotational LatheGeometry profile, flat bottom at y = 0
  const pts = [
    [0.0001, 0.0000],
    [0.0065, 0.0000],
    [0.0125, 0.0000],
    [0.0155, 0.0004],
    [0.0167, 0.0016],
    [0.0170, 0.0036],
    [0.0168, 0.0062],
    [0.0165, 0.0090],
    [0.0161, 0.0118],
    [0.0156, 0.0145],
    [0.0151, 0.0170],
    [0.0146, 0.0192],
    [0.0142, 0.0210],
    [0.0145, 0.0224],
    [0.0140, 0.0236],
    [0.0128, 0.0244],
    [0.0108, 0.0248],
    [0.0080, 0.0249],
    [0.0040, 0.0248],
    [0.0001, 0.0246]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(pts, 24);
  // Subtle oval equine hoof shape (slightly longer along +Z toe)
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) * 1.12;
    const toeSlope = (1 - clamp(y / 0.024, 0, 1)) * 0.0028;
    if (z > 0) z += toeSlope;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildFeatherGeometry(THREE, length, width, arch, cup, tipCurl, side) {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  // Leading vane (smooth bezier sweep)
  shape.bezierCurveTo(
    side * hw * 0.92, length * 0.18,
    side * hw * 1.12, length * 0.62,
    side * hw * 0.28, length * 0.94
  );
  // Soft rounded feather tip
  shape.bezierCurveTo(
    side * hw * 0.12, length * 1.01,
    -side * hw * 0.18, length * 1.01,
    -side * hw * 0.42, length * 0.90
  );
  // Subtle stylised feather-barb notch along trailing vane
  shape.bezierCurveTo(
    -side * hw * 0.85, length * 0.74,
    -side * hw * 0.62, length * 0.68,
    -side * hw * 0.94, length * 0.60
  );
  shape.bezierCurveTo(
    -side * hw * 1.08, length * 0.36,
    -side * hw * 0.82, length * 0.14,
    0, 0
  );

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0024,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0013,
    bevelSegments: 2,
    curveSegments: 9
  });

  // Center extrusion depth around z = 0, bend along length, cup across width, assign clean UVs
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) - 0.0012;

    const t = clamp(y / length, 0, 1);
    const xn = clamp(x / hw, -1.2, 1.2);

    // Taper thickness softly toward feather tip
    z *= 1 - 0.48 * t;
    // Longitudinal graceful arch
    z -= arch * t * t;
    // Concave feather cup across width
    z -= cup * xn * xn * Math.sin(t * Math.PI);
    // Gentle outer tip curl
    x += side * tipCurl * Math.pow(t, 2.3);

    pos.setXYZ(i, x, y, z);
    uv.setXY(i, clamp(0.5 + x / (width * 1.15), 0, 1), t);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildEarShellGeometry(THREE, height, width, depth, cup, bendBack) {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(hw * 1.05, height * 0.15, hw * 0.92, height * 0.64, hw * 0.18, height * 0.95);
  shape.bezierCurveTo(hw * 0.06, height * 1.02, -hw * 0.06, height * 1.02, -hw * 0.18, height * 0.95);
  shape.bezierCurveTo(-hw * 0.92, height * 0.64, -hw * 1.05, height * 0.15, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.0018,
    bevelSegments: 2,
    curveSegments: 10
  });

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) - depth * 0.5;

    const t = clamp(y / height, 0, 1);
    const xn = clamp(x / hw, -1.2, 1.2);

    // Deeply cup the ear forward (+Z edges) and arch gracefully backward toward tip
    z += cup * xn * xn * Math.sin(clamp(t * 1.05, 0, 1) * Math.PI);
    z -= bendBack * t * t;
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, clamp(0.5 + x / (width * 1.1), 0, 1), t);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildFetlockTuftGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.009, -0.002, 0.010, -0.014, 0.002, -0.022);
  shape.bezierCurveTo(-0.002, -0.024, -0.005, -0.020, -0.008, -0.012);
  shape.bezierCurveTo(-0.010, -0.004, -0.006, 0.001, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.0015,
    bevelSegments: 2,
    curveSegments: 8
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) - 0.002;
    const t = clamp(-y / 0.022, 0, 1);
    z -= 0.007 * t * t;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildWing(THREE, side, mats) {
  const wing = new THREE.Group();
  wing.name = side > 0 ? 'wingL' : 'wingR';

  // Sculpted downy wing arm / covert cushion curving up & back from shoulder
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.014, -0.010, 0.006),
    new THREE.Vector3(side * 0.036, 0.056, -0.006),
    new THREE.Vector3(side * 0.078, 0.104, -0.024),
    new THREE.Vector3(side * 0.124, 0.122, -0.056)
  ]);

  const armGeo = buildTaperedTube(THREE, armCurve, 20, 14, (u) => ({
    rx: 0.016 * (1 - 0.52 * u) + 0.005 * Math.sin(u * Math.PI),
    ry: 0.022 * (1 - 0.56 * u) + 0.006 * Math.sin(u * Math.PI)
  }));
  const armMesh = new THREE.Mesh(armGeo, mats.wingPad);
  armMesh.userData.slot = 'fur';
  armMesh.castShadow = true;
  armMesh.receiveShadow = true;
  wing.add(armMesh);

  // Layer 1: Primary flight feathers (7 long outer sweeping bezier feathers)
  const primarySpecs = [
    { u: 0.97, len: 0.152, wid: 0.027, rz: -side * 0.62, rx: -0.26, ry: -side * 0.24, zOff: -0.004 },
    { u: 0.90, len: 0.146, wid: 0.028, rz: -side * 0.80, rx: -0.24, ry: -side * 0.20, zOff: -0.005 },
    { u: 0.82, len: 0.136, wid: 0.028, rz: -side * 0.99, rx: -0.22, ry: -side * 0.16, zOff: -0.006 },
    { u: 0.74, len: 0.126, wid: 0.028, rz: -side * 1.18, rx: -0.19, ry: -side * 0.12, zOff: -0.007 },
    { u: 0.66, len: 0.116, wid: 0.028, rz: -side * 1.38, rx: -0.16, ry: -side * 0.08, zOff: -0.008 },
    { u: 0.58, len: 0.106, wid: 0.027, rz: -side * 1.56, rx: -0.14, ry: -side * 0.05, zOff: -0.009 },
    { u: 0.50, len: 0.096, wid: 0.026, rz: -side * 1.72, rx: -0.12, ry: -side * 0.02, zOff: -0.010 }
  ];

  // Reuse two sculpted primary templates scaled gently for variety
  const primGeoLong = buildFeatherGeometry(THREE, 0.145, 0.028, 0.024, 0.005, 0.011, side);
  const primGeoMid = buildFeatherGeometry(THREE, 0.112, 0.027, 0.019, 0.0045, 0.008, side);

  for (let i = 0; i < primarySpecs.length; i++) {
    const s = primarySpecs[i];
    const anchor = armCurve.getPoint(s.u);
    const useLong = i < 3;
    const baseLen = useLong ? 0.145 : 0.112;
    const mesh = new THREE.Mesh(useLong ? primGeoLong : primGeoMid, mats.featherPrimary);
    mesh.position.set(anchor.x, anchor.y, anchor.z + s.zOff);
    mesh.rotation.set(s.rx, s.ry, s.rz);
    mesh.scale.set(s.wid / 0.028, s.len / baseLen, 1);
    mesh.userData.slot = 'furAccent';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wing.add(mesh);
  }

  // Layer 2: Secondary flight feathers (8 overlapping mid-length bezier feathers)
  const secGeo = buildFeatherGeometry(THREE, 0.090, 0.027, 0.015, 0.0045, 0.005, side);
  const secCount = 8;
  for (let i = 0; i < secCount; i++) {
    const frac = i / (secCount - 1);
    const u = 0.86 - frac * 0.72;
    const anchor = armCurve.getPoint(u);
    const len = 0.098 - frac * 0.036;
    const mesh = new THREE.Mesh(secGeo, mats.featherSecondary);
    mesh.position.set(
      anchor.x - side * 0.002,
      anchor.y + 0.004,
      anchor.z + 0.0045 - frac * 0.003
    );
    mesh.rotation.set(
      -0.18 + frac * 0.10,
      -side * (0.20 - frac * 0.18),
      -side * (0.94 + frac * 1.15)
    );
    mesh.scale.set(1.0 + frac * 0.08, len / 0.090, 1);
    mesh.userData.slot = 'fur';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wing.add(mesh);
  }

  // Layer 3: Plump upper covert feathers (9 soft overlapping shoulder/top feathers)
  const covGeo = buildFeatherGeometry(THREE, 0.052, 0.025, 0.010, 0.0042, 0.002, side);
  const covCount = 9;
  for (let i = 0; i < covCount; i++) {
    const frac = i / (covCount - 1);
    const u = 0.82 - frac * 0.76;
    const anchor = armCurve.getPoint(u);
    const len = 0.058 - frac * 0.022;
    const mesh = new THREE.Mesh(covGeo, mats.featherCovert);
    mesh.position.set(
      anchor.x,
      anchor.y + 0.0085,
      anchor.z + 0.0105 - frac * 0.002
    );
    mesh.rotation.set(
      -0.10 + frac * 0.12,
      -side * (0.16 - frac * 0.15),
      -side * (1.02 + frac * 1.08)
    );
    mesh.scale.set(1.04, len / 0.052, 1.05);
    mesh.userData.slot = 'fur';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wing.add(mesh);
  }

  // Soft back-side under-coverts so rear silhouette is equally lush
  const underCount = 5;
  for (let i = 0; i < underCount; i++) {
    const frac = i / (underCount - 1);
    const u = 0.74 - frac * 0.62;
    const anchor = armCurve.getPoint(u);
    const mesh = new THREE.Mesh(covGeo, mats.featherCovert);
    mesh.position.set(anchor.x, anchor.y + 0.002, anchor.z - 0.010);
    mesh.rotation.set(-0.26, -side * 0.12, -side * (1.12 + frac * 0.88));
    mesh.scale.set(0.95, (0.054 - frac * 0.016) / 0.052, 0.9);
    mesh.userData.slot = 'fur';
    mesh.castShadow = true;
    wing.add(mesh);
  }

  return wing;
}

function buildEyeGroup(THREE, side, mats, eyeGeoBase, irisGeo) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';

  // Layer 1: Dark glossy eye dome with clearcoat
  const dome = new THREE.Mesh(eyeGeoBase, mats.eyeDark);
  dome.scale.set(0.95, 1.06, 0.58);
  dome.userData.slot = 'eye';
  eyeGroup.add(dome);

  // Layer 2: Coloured iris spherical cap sitting flush on cornea front
  const iris = new THREE.Mesh(irisGeo, mats.eyeIris);
  iris.scale.set(0.95, 1.06, 0.58);
  iris.userData.slot = 'eye';
  eyeGroup.add(iris);

  // Layer 3: Two crisp glossy white highlight catchlights up and to viewer's left (+localX, +localY)
  const hlBigGeo = new THREE.SphereGeometry(0.0033, 14, 10);
  const hlBig = new THREE.Mesh(hlBigGeo, mats.eyeHighlight);
  hlBig.scale.set(1.0, 1.15, 0.35);
  hlBig.position.set(0.0044, 0.0052, 0.0085);
  hlBig.userData.slot = 'glow';
  eyeGroup.add(hlBig);

  const hlSmallGeo = new THREE.SphereGeometry(0.0017, 12, 8);
  const hlSmall = new THREE.Mesh(hlSmallGeo, mats.eyeHighlight);
  hlSmall.scale.set(1.0, 1.0, 0.35);
  hlSmall.position.set(-0.0042, -0.0044, 0.0086);
  hlSmall.userData.slot = 'glow';
  eyeGroup.add(hlSmall);

  // Delicate curved upper eyelash rim flaring gently at outer corner
  const outer = -side;
  const lashPts = [
    new THREE.Vector3(-outer * 0.0105, 0.0082, 0.0068),
    new THREE.Vector3(-outer * 0.0040, 0.0144, 0.0062),
    new THREE.Vector3(outer * 0.0048, 0.0146, 0.0056),
    new THREE.Vector3(outer * 0.0128, 0.0094, 0.0042),
    new THREE.Vector3(outer * 0.0168, 0.0112, 0.0022)
  ];
  const lashCurve = new THREE.CatmullRomCurve3(lashPts);
  const lashGeo = buildTaperedTube(THREE, lashCurve, 16, 8, (u) => {
    const taper = Math.sin(Math.pow(u, 0.7) * Math.PI);
    return 0.0007 + 0.0014 * taper;
  });
  const lash = new THREE.Mesh(lashGeo, mats.eyeLash);
  lash.userData.slot = 'eye';
  eyeGroup.add(lash);

  return eyeGroup;
}

function buildEar(THREE, side, outerGeo, innerGeo, mats) {
  const ear = new THREE.Group();
  ear.name = side > 0 ? 'earL' : 'earR';

  const outer = new THREE.Mesh(outerGeo, mats.fur);
  outer.userData.slot = 'fur';
  outer.castShadow = true;
  outer.receiveShadow = true;
  ear.add(outer);

  const inner = new THREE.Mesh(innerGeo, mats.innerEar);
  inner.position.set(0, 0.006, 0.0028);
  inner.userData.slot = 'skin';
  inner.receiveShadow = true;
  ear.add(inner);

  // Small ear fluff tuft near inner base
  const fluffCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.008, 0.012, 0.005),
    new THREE.Vector3(side * 0.001, 0.017, 0.007),
    new THREE.Vector3(side * 0.008, 0.022, 0.005)
  ]);
  const fluffGeo = buildTaperedTube(THREE, fluffCurve, 10, 8, (u) => 0.0042 * (1 - 0.72 * u));
  const fluff = new THREE.Mesh(fluffGeo, mats.fur);
  fluff.userData.slot = 'fur';
  ear.add(fluff);

  return ear;
}

function buildLeg(THREE, name, pts, radiusScale, hoofPos, hoofRot, hoofGeo, tuftGeo, mats) {
  const leg = new THREE.Group();
  leg.name = name;

  const curve = new THREE.CatmullRomCurve3(pts);
  const legGeo = buildTaperedTube(THREE, curve, 28, 16, (u) => {
    // Equine foal leg taper: muscular upper -> subtle knee/hock -> slender cannon -> fetlock -> pastern
    let r = 0.026 * Math.pow(1 - u, 1.35) + 0.0118;
    const joint = Math.exp(-Math.pow((u - 0.46) / 0.09, 2)) * 0.0024;
    const fetlock = Math.exp(-Math.pow((u - 0.87) / 0.06, 2)) * 0.0026;
    const flareTop = Math.exp(-Math.pow(u / 0.14, 2)) * 0.0065;
    r += joint + fetlock + flareTop;
    const depthBoost = 1 + 0.22 * Math.exp(-Math.pow(u / 0.26, 2));
    return { rx: r * radiusScale, ry: r * radiusScale * depthBoost };
  });

  const legMesh = new THREE.Mesh(legGeo, mats.fur);
  legMesh.userData.slot = 'fur';
  legMesh.castShadow = true;
  legMesh.receiveShadow = true;
  leg.add(legMesh);

  // Soft fetlock feather tuft
  const fetPt = curve.getPoint(0.86);
  const tuft = new THREE.Mesh(tuftGeo, mats.fur);
  tuft.position.set(fetPt.x, fetPt.y + 0.003, fetPt.z - 0.010);
  tuft.rotation.x = 0.24;
  tuft.userData.slot = 'fur';
  tuft.castShadow = true;
  leg.add(tuft);

  // Sculpted glossy LatheGeometry hoof
  const hoof = new THREE.Mesh(hoofGeo, mats.hoof);
  hoof.position.copy(hoofPos);
  if (hoofRot) hoof.rotation.set(hoofRot.x, hoofRot.y, hoofRot.z);
  hoof.userData.slot = 'secondary';
  hoof.castShadow = true;
  hoof.receiveShadow = true;
  leg.add(hoof);

  return leg;
}

function buildHairLock(THREE, points, maxRx, maxRy, twistTotal, mat) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = buildTaperedTube(THREE, curve, 26, 12, (u) => {
    const profile = Math.sin(Math.pow(u, 0.55) * Math.PI * 0.92) * (1 - 0.18 * u);
    const rootBulge = 0.45 * Math.exp(-Math.pow(u / 0.14, 2));
    const s = Math.max(0.06, profile + rootBulge * (1 - u));
    return { rx: maxRx * s, ry: maxRy * s };
  }, {
    capStart: true,
    capEnd: true,
    twistFn: (u) => twistTotal * u
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.slot = 'furAccent';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function build(THREE, opts = {}, kit) {
  const pal = resolvePalette(THREE, opts);

  // Procedural CanvasTexture maps (redrawn from opts)
  const furTex = createFurTextures(THREE, kit, pal);
  const headMap = createHeadTexture(THREE, kit, pal);
  const featherPrimaryTex = createFeatherTextures(THREE, kit, pal, 0.94);
  const featherSecondaryTex = createFeatherTextures(THREE, kit, pal, 0.55);
  const featherCovertTex = createFeatherTextures(THREE, kit, pal, 0.22);
  const hairTex = createHairTextures(THREE, kit, pal);
  const irisMap = createIrisTexture(THREE, kit, pal);
  const blushMap = createBlushTexture(THREE, kit, pal);
  const innerEarMap = createInnerEarTexture(THREE, kit, pal);

  const sheenFur = mixColor(THREE, pal.fur, '#ffffff', 0.65);
  const sheenHair = mixColor(THREE, pal.furAccent, '#ffffff', 0.68);
  const sheenFeather = mixColor(THREE, pal.fur, pal.furAccent, 0.35).lerp(new THREE.Color('#ffffff'), 0.45);

  const mats = {
    fur: new THREE.MeshPhysicalMaterial({
      map: furTex.map,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.0022,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.65,
      sheenColor: sheenFur
    }),
    headFur: new THREE.MeshPhysicalMaterial({
      map: headMap,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.0018,
      roughness: 0.89,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.62,
      sheenColor: sheenFur
    }),
    wingPad: new THREE.MeshPhysicalMaterial({
      map: furTex.map,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.0020,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.6,
      sheenColor: sheenFur
    }),
    featherPrimary: new THREE.MeshPhysicalMaterial({
      map: featherPrimaryTex.map,
      bumpMap: featherPrimaryTex.bumpMap,
      bumpScale: 0.0026,
      roughness: 0.82,
      metalness: 0.0,
      sheen: 0.80,
      sheenRoughness: 0.55,
      sheenColor: sheenFeather
    }),
    featherSecondary: new THREE.MeshPhysicalMaterial({
      map: featherSecondaryTex.map,
      bumpMap: featherSecondaryTex.bumpMap,
      bumpScale: 0.0024,
      roughness: 0.85,
      metalness: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.58,
      sheenColor: sheenFeather
    }),
    featherCovert: new THREE.MeshPhysicalMaterial({
      map: featherCovertTex.map,
      bumpMap: featherCovertTex.bumpMap,
      bumpScale: 0.0020,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.84,
      sheenRoughness: 0.62,
      sheenColor: sheenFur
    }),
    hair: new THREE.MeshPhysicalMaterial({
      map: hairTex.map,
      bumpMap: hairTex.bumpMap,
      bumpScale: 0.0028,
      roughness: 0.62,
      metalness: 0.0,
      sheen: 0.92,
      sheenRoughness: 0.42,
      sheenColor: sheenHair
    }),
    innerEar: new THREE.MeshPhysicalMaterial({
      map: innerEarMap,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.65,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color('#ffe8e4')
    }),
    hoof: new THREE.MeshPhysicalMaterial({
      color: pal.hoof,
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.92,
      clearcoatRoughness: 0.14
    }),
    eyeDark: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#14111c'),
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    eyeIris: new THREE.MeshPhysicalMaterial({
      map: irisMap,
      roughness: 0.06,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.45,
      roughness: 0.05,
      clearcoat: 1.0
    }),
    eyeLash: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#2c2233'),
      roughness: 0.68,
      metalness: 0.0
    }),
    noseDetail: new THREE.MeshPhysicalMaterial({
      color: mixColor(THREE, pal.skin, '#6e474b', 0.56),
      roughness: 0.78,
      metalness: 0.0
    }),
    blush: new THREE.MeshPhysicalMaterial({
      map: blushMap,
      transparent: true,
      depthWrite: false,
      roughness: 0.96,
      polygonOffset: true,
      polygonOffsetFactor: -1
    })
  };

  const root = new THREE.Group();
  root.name = 'pegasus_foal';

  // === BODY GROUP (holds torso, neck, head, wings, tail, raised leg) ===
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(0, 0.212, 0);
  root.add(body);

  // Continuous sculpted torso
  const torsoMesh = new THREE.Mesh(buildSculptedBodyGeometry(THREE), mats.fur);
  torsoMesh.position.set(0, 0, -0.012);
  torsoMesh.userData.slot = 'fur';
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  body.add(torsoMesh);

  // Sculpted graceful arching neck deeply embedded into chest & skull
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.008, 0.054),
    new THREE.Vector3(0, 0.056, 0.088),
    new THREE.Vector3(0, 0.104, 0.106),
    new THREE.Vector3(0, 0.148, 0.115)
  ]);
  const neckGeo = buildTaperedTube(THREE, neckCurve, 24, 22, (u) => {
    const rx = 0.044 * (1 - 0.34 * u) + 0.004 * Math.exp(-Math.pow((1 - u) / 0.18, 2));
    const ry = 0.050 * (1 - 0.36 * u) + 0.004 * Math.exp(-Math.pow((1 - u) / 0.18, 2));
    return { rx, ry };
  });
  const neckMesh = new THREE.Mesh(neckGeo, mats.fur);
  neckMesh.userData.slot = 'fur';
  neckMesh.castShadow = true;
  neckMesh.receiveShadow = true;
  body.add(neckMesh);

  // === HEAD GROUP (tilted gently for charming asymmetry) ===
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.148, 0.116);
  head.rotation.set(0.06, -0.10, 0.085);
  body.add(head);

  const headOffset = new THREE.Vector3(0, 0.012, 0.006);
  const headMesh = new THREE.Mesh(buildSculptedHeadGeometry(THREE), mats.headFur);
  headMesh.position.copy(headOffset);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  // Three-layer glossy eyes nestled accurately into the sculpted sockets
  const eyeGeoBase = new THREE.SphereGeometry(0.0155, 26, 20);
  const irisGeo = new THREE.SphereGeometry(0.01585, 26, 16, 0, Math.PI * 2, 0, 0.88);
  irisGeo.rotateX(Math.PI * 0.5);
  const irisPos = irisGeo.attributes.position;
  const irisUv = irisGeo.attributes.uv;
  const irisMaxR = 0.01585 * Math.sin(0.88);
  for (let i = 0; i < irisPos.count; i++) {
    irisUv.setXY(
      i,
      clamp(0.5 + irisPos.getX(i) / (2 * irisMaxR), 0, 1),
      clamp(0.5 + irisPos.getY(i) / (2 * irisMaxR), 0, 1)
    );
  }

  for (const side of [1, -1]) {
    const dir = new THREE.Vector3(side * EYE_DIR_L.x, EYE_DIR_L.y, EYE_DIR_L.z);
    const frame = getHeadSurfaceFrame(THREE, dir);
    const eyeGroup = buildEyeGroup(THREE, side, mats, eyeGeoBase, irisGeo);
    const pos = frame.point.clone().add(headOffset).addScaledVector(frame.normal, 0.0014);
    eyeGroup.position.copy(pos);
    // Gently bias look direction slightly forward for warm gaze
    const gazeDir = frame.normal.clone().lerp(new THREE.Vector3(side * 0.45, 0.04, 0.89), 0.25).normalize();
    eyeGroup.lookAt(pos.clone().add(gazeDir));
    head.add(eyeGroup);
  }

  // Soft nostrils placed directly on the sculpted muzzle tip
  const nostrilGeo = new THREE.SphereGeometry(0.0028, 12, 10);
  for (const side of [1, -1]) {
    const nDir = new THREE.Vector3(side * 0.25, -0.07, 0.965);
    const nFrame = getHeadSurfaceFrame(THREE, nDir);
    const nostril = new THREE.Mesh(nostrilGeo, mats.noseDetail);
    nostril.position.copy(nFrame.point).add(headOffset).addScaledVector(nFrame.normal, 0.0004);
    nostril.lookAt(nostril.position.clone().add(nFrame.normal));
    nostril.rotateZ(side * 0.36);
    nostril.scale.set(0.76, 1.32, 0.36);
    nostril.userData.slot = 'skin';
    head.add(nostril);
  }

  // Curved smile mouth line made from a thin tapered tube hugging the muzzle
  const smilePts = [];
  for (let i = 0; i <= 6; i++) {
    const s = (i / 6) * 2 - 1;
    const nx = 0.22 * s;
    const ny = -0.31 + 0.052 * s * s;
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
    const p = sculptHeadPoint(nx, ny, nz, new THREE.Vector3()).add(headOffset);
    p.z += 0.0012;
    p.y -= 0.0004;
    smilePts.push(p);
  }
  const smileGeo = buildTaperedTube(THREE, new THREE.CatmullRomCurve3(smilePts), 16, 8, (u) => {
    return 0.0007 + 0.00085 * Math.sin(u * Math.PI);
  });
  const smileMesh = new THREE.Mesh(smileGeo, mats.noseDetail);
  smileMesh.userData.slot = 'skin';
  head.add(smileMesh);

  // Subtle curved cheek blush discs
  const blushGeo = new THREE.SphereGeometry(0.014, 16, 12, 0, Math.PI * 2, 0, 0.55);
  blushGeo.rotateX(Math.PI * 0.5);
  const bPos = blushGeo.attributes.position;
  const bUv = blushGeo.attributes.uv;
  const bMaxR = 0.014 * Math.sin(0.55);
  for (let i = 0; i < bPos.count; i++) {
    bUv.setXY(i, clamp(0.5 + bPos.getX(i) / (2 * bMaxR), 0, 1), clamp(0.5 + bPos.getY(i) / (2 * bMaxR), 0, 1));
  }
  for (const side of [1, -1]) {
    const cDir = new THREE.Vector3(side * 0.72, -0.19, 0.66);
    const cFrame = getHeadSurfaceFrame(THREE, cDir);
    const blush = new THREE.Mesh(blushGeo, mats.blush);
    const bOrigin = cFrame.point.clone().add(headOffset).addScaledVector(cFrame.normal, -0.0124);
    blush.position.copy(bOrigin);
    blush.lookAt(bOrigin.clone().add(cFrame.normal));
    blush.scale.set(1.35, 0.92, 1.0);
    blush.userData.slot = 'skin';
    head.add(blush);
  }

  // Cupped foal ears (ExtrudeGeometry with bezierCurveTo, bent & cupped)
  const earOuterGeo = buildEarShellGeometry(THREE, 0.072, 0.036, 0.0046, 0.0085, 0.008);
  const earInnerGeo = buildEarShellGeometry(THREE, 0.054, 0.023, 0.0022, 0.0068, 0.006);

  const earL = buildEar(THREE, 1, earOuterGeo, earInnerGeo, mats);
  earL.position.set(0.029, 0.054, -0.006);
  earL.rotation.set(0.14, 0.28, -0.34);
  head.add(earL);

  const earR = buildEar(THREE, -1, earOuterGeo, earInnerGeo, mats);
  earR.position.set(-0.029, 0.052, -0.008);
  earR.rotation.set(0.18, -0.36, 0.44);
  head.add(earR);

  // Curled forelock locks between ears (children of head so they follow head tilt!)
  const forelock1 = buildHairLock(THREE, [
    new THREE.Vector3(0.002, 0.062, -0.002),
    new THREE.Vector3(0.012, 0.068, 0.032),
    new THREE.Vector3(-0.006, 0.056, 0.058),
    new THREE.Vector3(-0.024, 0.036, 0.064),
    new THREE.Vector3(-0.020, 0.024, 0.054)
  ], 0.015, 0.009, 0.55, mats.hair);
  head.add(forelock1);

  const forelock2 = buildHairLock(THREE, [
    new THREE.Vector3(-0.004, 0.060, 0.002),
    new THREE.Vector3(0.018, 0.058, 0.030),
    new THREE.Vector3(0.030, 0.040, 0.048),
    new THREE.Vector3(0.022, 0.028, 0.044)
  ], 0.011, 0.007, -0.45, mats.hair);
  head.add(forelock2);

  // Flowing crest mane cascading gracefully down the left side (+X) of the neck
  const maneSpecs = [
    {
      pts: [
        new THREE.Vector3(0.004, 0.168, 0.088),
        new THREE.Vector3(0.034, 0.150, 0.084),
        new THREE.Vector3(0.050, 0.112, 0.092),
        new THREE.Vector3(0.048, 0.072, 0.106),
        new THREE.Vector3(0.036, 0.048, 0.114)
      ],
      rx: 0.016, ry: 0.010, tw: 0.5
    },
    {
      pts: [
        new THREE.Vector3(0.002, 0.146, 0.076),
        new THREE.Vector3(0.036, 0.126, 0.074),
        new THREE.Vector3(0.056, 0.086, 0.084),
        new THREE.Vector3(0.058, 0.046, 0.094),
        new THREE.Vector3(0.044, 0.022, 0.100)
      ],
      rx: 0.018, ry: 0.010, tw: 0.6
    },
    {
      pts: [
        new THREE.Vector3(0.000, 0.122, 0.066),
        new THREE.Vector3(0.036, 0.102, 0.064),
        new THREE.Vector3(0.058, 0.064, 0.070),
        new THREE.Vector3(0.062, 0.026, 0.074),
        new THREE.Vector3(0.052, 0.002, 0.082)
      ],
      rx: 0.018, ry: 0.010, tw: 0.45
    },
    {
      pts: [
        new THREE.Vector3(0.000, 0.098, 0.056),
        new THREE.Vector3(0.034, 0.082, 0.054),
        new THREE.Vector3(0.056, 0.048, 0.056),
        new THREE.Vector3(0.060, 0.014, 0.058),
        new THREE.Vector3(0.054, -0.008, 0.064)
      ],
      rx: 0.017, ry: 0.009, tw: 0.35
    },
    {
      pts: [
        new THREE.Vector3(-0.004, 0.156, 0.082),
        new THREE.Vector3(-0.022, 0.132, 0.076),
        new THREE.Vector3(-0.034, 0.094, 0.076),
        new THREE.Vector3(-0.032, 0.064, 0.084)
      ],
      rx: 0.012, ry: 0.008, tw: -0.4
    },
    {
      pts: [
        new THREE.Vector3(0.000, 0.076, 0.048),
        new THREE.Vector3(0.026, 0.062, 0.046),
        new THREE.Vector3(0.044, 0.036, 0.046),
        new THREE.Vector3(0.048, 0.014, 0.042)
      ],
      rx: 0.014, ry: 0.008, tw: 0.3
    }
  ];

  for (const ms of maneSpecs) {
    body.add(buildHairLock(THREE, ms.pts, ms.rx, ms.ry, ms.tw, mats.hair));
  }

  // === HALF-OPEN FEATHERED WINGS (3 layers of curved bezier feathers each) ===
  const wingL = buildWing(THREE, 1, mats);
  wingL.position.set(0.036, 0.044, 0.020);
  wingL.rotation.set(0.08, -0.22, -0.06);
  body.add(wingL);

  const wingR = buildWing(THREE, -1, mats);
  wingR.position.set(-0.036, 0.044, 0.020);
  wingR.rotation.set(0.10, 0.25, 0.08);
  body.add(wingR);

  // === FLOWING CURLED TAIL ===
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.026, -0.110);
  body.add(tail);

  const tailSpecs = [
    {
      pts: [
        new THREE.Vector3(0.000, 0.000, 0.006),
        new THREE.Vector3(-0.008, 0.022, -0.042),
        new THREE.Vector3(-0.024, -0.022, -0.084),
        new THREE.Vector3(-0.048, -0.095, -0.102),
        new THREE.Vector3(-0.066, -0.155, -0.086),
        new THREE.Vector3(-0.052, -0.176, -0.064)
      ],
      rx: 0.022, ry: 0.013, tw: 0.85
    },
    {
      pts: [
        new THREE.Vector3(0.004, 0.002, 0.004),
        new THREE.Vector3(0.014, 0.018, -0.038),
        new THREE.Vector3(0.002, -0.030, -0.078),
        new THREE.Vector3(-0.018, -0.102, -0.094),
        new THREE.Vector3(-0.032, -0.152, -0.078)
      ],
      rx: 0.019, ry: 0.011, tw: 0.65
    },
    {
      pts: [
        new THREE.Vector3(-0.005, 0.000, 0.002),
        new THREE.Vector3(-0.024, 0.012, -0.036),
        new THREE.Vector3(-0.048, -0.038, -0.068),
        new THREE.Vector3(-0.068, -0.104, -0.076),
        new THREE.Vector3(-0.074, -0.144, -0.056)
      ],
      rx: 0.017, ry: 0.010, tw: -0.55
    },
    {
      pts: [
        new THREE.Vector3(0.002, -0.004, 0.004),
        new THREE.Vector3(0.000, -0.006, -0.044),
        new THREE.Vector3(-0.010, -0.066, -0.074),
        new THREE.Vector3(-0.026, -0.132, -0.066),
        new THREE.Vector3(-0.018, -0.162, -0.048)
      ],
      rx: 0.016, ry: 0.010, tw: 0.50
    },
    {
      pts: [
        new THREE.Vector3(0.006, 0.004, 0.002),
        new THREE.Vector3(0.024, 0.006, -0.032),
        new THREE.Vector3(0.022, -0.048, -0.064),
        new THREE.Vector3(0.006, -0.104, -0.072)
      ],
      rx: 0.014, ry: 0.009, tw: 0.45
    },
    {
      pts: [
        new THREE.Vector3(-0.004, 0.008, 0.002),
        new THREE.Vector3(-0.018, 0.028, -0.034),
        new THREE.Vector3(-0.042, 0.004, -0.076),
        new THREE.Vector3(-0.064, -0.052, -0.098),
        new THREE.Vector3(-0.078, -0.088, -0.092)
      ],
      rx: 0.013, ry: 0.008, tw: 0.70
    }
  ];

  for (const ts of tailSpecs) {
    tail.add(buildHairLock(THREE, ts.pts, ts.rx, ts.ry, ts.tw, mats.hair));
  }

  // === FOUR SCULPTED LEGS + LATHE HOOVES ===
  const hoofGeo = buildHoofGeometry(THREE);
  const tuftGeo = buildFetlockTuftGeometry(THREE);

  // Planted Front-Left Leg (armL) — rests firmly at Y = 0
  const armL = buildLeg(
    THREE,
    'armL',
    [
      new THREE.Vector3(0.034, 0.204, 0.062),
      new THREE.Vector3(0.036, 0.146, 0.058),
      new THREE.Vector3(0.035, 0.094, 0.067),
      new THREE.Vector3(0.035, 0.038, 0.064),
      new THREE.Vector3(0.035, 0.017, 0.070)
    ],
    0.94,
    new THREE.Vector3(0.035, 0.0, 0.072),
    null,
    hoofGeo,
    tuftGeo,
    mats
  );
  root.add(armL);

  // Playfully Lifted Front-Right Leg (armR) — pivoted at shoulder inside body
  const armR = buildLeg(
    THREE,
    'armR',
    [
      new THREE.Vector3(0.000, 0.004, 0.000),
      new THREE.Vector3(-0.004, -0.048, 0.024),
      new THREE.Vector3(-0.006, -0.092, 0.054),
      new THREE.Vector3(-0.005, -0.136, 0.032),
      new THREE.Vector3(-0.005, -0.150, 0.038)
    ],
    0.93,
    new THREE.Vector3(-0.005, -0.165, 0.046),
    new THREE.Euler(0.62, -0.08, 0.04),
    hoofGeo,
    tuftGeo,
    mats
  );
  armR.position.set(-0.034, -0.010, 0.064);
  body.add(armR);

  // Planted Hind-Left Leg (legL) — rests firmly at Y = 0
  const legL = buildLeg(
    THREE,
    'legL',
    [
      new THREE.Vector3(0.038, 0.210, -0.068),
      new THREE.Vector3(0.040, 0.152, -0.054),
      new THREE.Vector3(0.039, 0.100, -0.092),
      new THREE.Vector3(0.038, 0.040, -0.082),
      new THREE.Vector3(0.038, 0.017, -0.074)
    ],
    1.04,
    new THREE.Vector3(0.038, 0.0, -0.072),
    null,
    hoofGeo,
    tuftGeo,
    mats
  );
  root.add(legL);

  // Planted Hind-Right Leg (legR) — slightly forward to balance raised front-right hoof
  const legR = buildLeg(
    THREE,
    'legR',
    [
      new THREE.Vector3(-0.038, 0.210, -0.060),
      new THREE.Vector3(-0.040, 0.152, -0.044),
      new THREE.Vector3(-0.039, 0.100, -0.080),
      new THREE.Vector3(-0.039, 0.040, -0.070),
      new THREE.Vector3(-0.039, 0.017, -0.062)
    ],
    1.04,
    new THREE.Vector3(-0.039, 0.0, -0.060),
    null,
    hoofGeo,
    tuftGeo,
    mats
  );
  root.add(legR);

  // Cache base poses for smooth, drift-free idle animation
  const animTargets = ['body', 'head', 'earL', 'earR', 'wingL', 'wingR', 'tail', 'armR'];
  const base = {};
  for (const key of animTargets) {
    const obj = root.getObjectByName(key);
    if (obj) {
      base[key] = {
        px: obj.position.x,
        py: obj.position.y,
        pz: obj.position.z,
        rx: obj.rotation.x,
        ry: obj.rotation.y,
        rz: obj.rotation.z
      };
    }
  }
  root.userData.base = base;

  return root;
}

export function idle(group, t) {
  const base = group.userData.base;
  if (!base) return;

  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const earL = group.getObjectByName('earL');
  const earR = group.getObjectByName('earR');
  const wingL = group.getObjectByName('wingL');
  const wingR = group.getObjectByName('wingR');
  const tail = group.getObjectByName('tail');
  const armR = group.getObjectByName('armR');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');

  const breath = Math.sin(t * 2.1);

  if (body && base.body) {
    body.scale.set(1 + 0.008 * breath, 1 + 0.013 * breath, 1 + 0.006 * breath);
    body.position.y = base.body.py + 0.0018 * breath;
  }

  if (head && base.head) {
    head.rotation.x = base.head.rx + 0.035 * Math.sin(t * 1.15);
    head.rotation.y = base.head.ry + 0.055 * Math.sin(t * 0.72 + 0.5);
    head.rotation.z = base.head.rz + 0.032 * Math.sin(t * 0.94 + 1.2);
  }

  if (earL && base.earL) {
    const flickCycle = (t + 0.6) % 4.6;
    const flick = flickCycle < 0.24 ? Math.sin((flickCycle / 0.24) * Math.PI) * 0.16 : 0;
    earL.rotation.z = base.earL.rz - 0.04 * Math.sin(t * 1.7) - flick;
    earL.rotation.x = base.earL.rx + 0.03 * Math.sin(t * 1.3);
  }

  if (earR && base.earR) {
    const flickCycle = (t + 2.8) % 5.3;
    const flick = flickCycle < 0.22 ? Math.sin((flickCycle / 0.22) * Math.PI) * 0.14 : 0;
    earR.rotation.z = base.earR.rz + 0.04 * Math.sin(t * 1.5 + 0.9) + flick;
    earR.rotation.x = base.earR.rx + 0.025 * Math.sin(t * 1.2 + 0.4);
  }

  const wingWave = Math.sin(t * 2.1 - 0.45);
  const flutterCycle = (t + 1.4) % 6.2;
  const flutter = flutterCycle < 0.55
    ? Math.sin((flutterCycle / 0.55) * Math.PI * 3) * Math.sin((flutterCycle / 0.55) * Math.PI) * 0.075
    : 0;

  if (wingL && base.wingL) {
    wingL.rotation.z = base.wingL.rz + 0.042 * wingWave + flutter;
    wingL.rotation.y = base.wingL.ry - 0.032 * wingWave - flutter * 0.5;
  }

  if (wingR && base.wingR) {
    wingR.rotation.z = base.wingR.rz - 0.042 * wingWave - flutter;
    wingR.rotation.y = base.wingR.ry + 0.032 * wingWave + flutter * 0.5;
  }

  if (tail && base.tail) {
    tail.rotation.y = base.tail.ry + 0.11 * Math.sin(t * 1.65) + 0.035 * Math.sin(t * 3.1);
    tail.rotation.x = base.tail.rx + 0.04 * Math.sin(t * 1.1 + 0.6);
  }

  if (armR && base.armR) {
    armR.rotation.x = base.armR.rx + 0.055 * Math.sin(t * 1.45 + 0.3);
  }

  // Natural blink every ~3.8 seconds by scaling eye groups on Y
  const blinkPeriod = 3.8;
  const phase = (t + 1.1) % blinkPeriod;
  let eyeScaleY = 1.0;
  if (phase < 0.18) {
    const s = Math.sin((phase / 0.18) * Math.PI);
    eyeScaleY = 1.0 - 0.92 * s * s;
  } else if (Math.floor((t + 1.1) / blinkPeriod) % 3 === 1 && phase > 0.26 && phase < 0.42) {
    // Occasional cute double blink
    const s = Math.sin(((phase - 0.26) / 0.16) * Math.PI);
    eyeScaleY = 1.0 - 0.88 * s * s;
  }
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;
}