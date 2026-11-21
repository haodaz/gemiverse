// Stylised cozy dorm-room single bed (1.0 m wide x 2.0 m long, headboard at -z)
// Plain ES module, no imports, no globals.

export const META = {
  id: 'dorm_single_bed',
  name: 'Cozy Dorm Single Bed',
  kind: 'furniture',
  footprint: [1.0, 2.0],
  variants: ['Slatted Wood', 'Upholstered Tufted', 'Curved Metal'],
  note: 'Hero-quality stylised 1m x 2m single dorm bed with turned legs, sculpted piped mattress, wrinkled duvet with folded cuff, two asymmetric pillows, and cable-knit throw.'
};

// ---------------------------------------------------------------------------
// Colour & math helpers
// ---------------------------------------------------------------------------
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(THREE, col) {
  const c = new THREE.Color(col);
  return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255), c };
}

function shiftColor(THREE, col, dl, ds = 0) {
  const c = new THREE.Color(col);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, clamp(hsl.s + ds, 0, 1), clamp(hsl.l + dl, 0, 1));
  return c;
}

function rgbStr(c, a = 1) {
  const r = clamp(Math.round(c.r * 255), 0, 255);
  const g = clamp(Math.round(c.g * 255), 0, 255);
  const b = clamp(Math.round(c.b * 255), 0, 255);
  return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Procedural CanvasTexture generators (using kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------
function makeWoodTextures(THREE, kit, baseHex, isPainted) {
  const base = new THREE.Color(baseHex);
  const dark = shiftColor(THREE, base, isPainted ? -0.05 : -0.14, isPainted ? -0.02 : 0.04);
  const light = shiftColor(THREE, base, isPainted ? 0.04 : 0.09, -0.02);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, w, h);

    // Subtle organic grain streaks
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const br = base.r * 255, bg = base.g * 255, bb = base.b * 255;
    const dr = dark.r * 255, dg = dark.g * 255, db = dark.b * 255;
    const lr = light.r * 255, lg = light.g * 255, lb = light.b * 255;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const n1 = kit.noise(u * 3.5 + 1.2, v * 14.0 + 0.7);
        const n2 = kit.noise(u * 11.0 + 4.1, v * 42.0 + 2.3);
        const rings = Math.sin((u * 18.0 + n1 * 4.5 + Math.sin(v * Math.PI * 2) * 0.6) * Math.PI);
        const gVal = isPainted
          ? (n2 - 0.5) * 0.35 + rings * 0.08
          : rings * 0.45 + (n2 - 0.5) * 0.4 + (n1 - 0.5) * 0.35;

        const t = clamp(gVal, -1, 1);
        let r, g, b;
        if (t < 0) {
          const k = -t;
          r = br + (dr - br) * k;
          g = bg + (dg - bg) * k;
          b = bb + (db - bb) * k;
        } else {
          r = br + (lr - br) * t;
          g = bg + (lg - bg) * t;
          b = bb + (lb - bb) * t;
        }
        const idx = (y * w + x) * 4;
        d[idx] = clamp(r, 0, 255);
        d[idx + 1] = clamp(g, 0, 255);
        d[idx + 2] = clamp(b, 0, 255);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Fine pore lines
    ctx.strokeStyle = rgbStr(dark, isPainted ? 0.08 : 0.22);
    ctx.lineWidth = 1;
    for (let i = 0; i < (isPainted ? 45 : 130); i++) {
      const px = kit.noise(i * 1.7, 0.3) * w;
      const py = kit.noise(0.8, i * 2.1) * h;
      const len = 18 + kit.noise(i * 3.3, 1.9) * 70;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (kit.noise(i, 4.2) - 0.5) * 4, py + len);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const n1 = kit.noise(u * 4.0 + 1.2, v * 16.0 + 0.7);
        const n2 = kit.noise(u * 14.0 + 4.1, v * 48.0 + 2.3);
        const rings = Math.sin((u * 18.0 + n1 * 4.5) * Math.PI);
        const val = clamp(128 + (isPainted ? 16 : 46) * (rings * 0.4 + (n2 - 0.5) * 0.9), 0, 255);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeMetalTextures(THREE, kit, baseHex) {
  const base = new THREE.Color(baseHex);
  const dark = shiftColor(THREE, base, -0.1, 0);
  const light = shiftColor(THREE, base, 0.1, -0.05);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(y * 0.15, 2.7);
      ctx.fillStyle = n > 0.5 ? rgbStr(light, (n - 0.5) * 0.25) : rgbStr(dark, (0.5 - n) * 0.25);
      ctx.fillRect(0, y, w, 2);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const n = kit.noise(y * 0.28, 7.1);
      const v = clamp(Math.round(115 + n * 28), 0, 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

function makeFabricTextures(THREE, kit, baseHex, style = 'duvet') {
  const base = new THREE.Color(baseHex);
  const dark = shiftColor(THREE, base, style === 'upholstery' ? -0.1 : -0.055, 0.02);
  const light = shiftColor(THREE, base, style === 'upholstery' ? 0.09 : 0.05, -0.02);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, w, h);

    // Woven warp & weft
    const step = style === 'upholstery' ? 6 : 4;
    for (let y = 0; y < h; y += step) {
      const n = kit.noise(0.5, y * 0.06);
      ctx.fillStyle = n > 0.5 ? rgbStr(light, 0.22) : rgbStr(dark, 0.22);
      ctx.fillRect(0, y, w, step * 0.55);
    }
    for (let x = 0; x < w; x += step) {
      const n = kit.noise(x * 0.06, 3.1);
      ctx.fillStyle = n > 0.5 ? rgbStr(light, 0.18) : rgbStr(dark, 0.18);
      ctx.fillRect(x, 0, step * 0.55, h);
    }

    // Fine slub flecks
    for (let i = 0; i < 650; i++) {
      const x = kit.noise(i * 1.13, 0.7) * w;
      const y = kit.noise(2.9, i * 1.37) * h;
      const horiz = i % 2 === 0;
      const len = 6 + kit.noise(i * 0.4, 5.1) * 22;
      ctx.fillStyle = i % 3 === 0 ? rgbStr(light, 0.22) : rgbStr(dark, 0.18);
      ctx.fillRect(x, y, horiz ? len : 1.5, horiz ? 1.5 : len);
    }

    if (style === 'duvet') {
      // Subtle woven tone-on-tone cozy stripe/windowpane weave
      ctx.strokeStyle = rgbStr(light, 0.14);
      ctx.lineWidth = 3;
      for (let x = 32; x < w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.strokeStyle = rgbStr(dark, 0.09);
      ctx.lineWidth = 1.5;
      for (let y = 32; y < h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else if (style === 'mattress') {
      // Diamond-quilted mattress ticking
      const cell = 64;
      ctx.strokeStyle = rgbStr(dark, 0.28);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      for (let i = -h; i < w + h; i += cell) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i, h);
        ctx.lineTo(i + h, 0);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // Soft quilted diamond center highlights
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          const cx = x + cell * 0.5;
          const cy = y + cell * 0.5;
          const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, cell * 0.36);
          g.addColorStop(0, rgbStr(light, 0.28));
          g.addColorStop(1, rgbStr(light, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    const step = style === 'upholstery' ? 4 : 3;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const checker = ((x / step + y / step) % 2) === 0;
        const n = kit.noise(x * 0.12, y * 0.12);
        const val = clamp(Math.round((checker ? 148 : 108) + (n - 0.5) * 26), 0, 255);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(x, y, step, step);
      }
    }
    if (style === 'mattress') {
      const cell = 32;
      ctx.strokeStyle = 'rgb(65,65,65)';
      ctx.lineWidth = 2.5;
      for (let i = -h; i < w + h; i += cell) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i, h);
        ctx.lineTo(i + h, 0);
        ctx.stroke();
      }
    }
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

function makeKnitTextures(THREE, kit, baseHex, stripeHex) {
  const base = new THREE.Color(baseHex);
  const dark = shiftColor(THREE, base, -0.18, 0.05);
  const midDark = shiftColor(THREE, base, -0.08, 0.02);
  const light = shiftColor(THREE, base, 0.14, -0.05);
  const stripe = new THREE.Color(stripeHex);
  const stripeDark = shiftColor(THREE, stripe, -0.14, 0.02);
  const stripeLight = shiftColor(THREE, stripe, 0.1, -0.02);

  function drawKnit(ctx, w, h, isBump) {
    ctx.fillStyle = isBump ? 'rgb(55,55,55)' : rgbStr(dark);
    ctx.fillRect(0, 0, w, h);

    const cols = 16;
    const rows = 28;
    const colW = w / cols;
    const rowH = h / rows;

    // Alternating knit columns: cable braids + stockinette V columns + purl rib
    for (let c = 0; c < cols; c++) {
      const isCableLeft = (c % 4) === 1;
      const isCableRight = (c % 4) === 2;
      const isPurl = (c % 4) === 0;
      const cx = (c + 0.5) * colW;

      for (let r = -1; r <= rows; r++) {
        const cy = (r + 0.5) * rowH;
        const inBand = (r === 3 || r === 4 || r === rows - 4 || r === rows - 5);
        const cBase = inBand ? stripe : base;
        const cLight = inBand ? stripeLight : light;
        const cMid = inBand ? stripeDark : midDark;
        const jitter = (kit.noise(c * 1.9 + 0.4, r * 1.3 + 2.1) - 0.5) * 1.5;

        if (isPurl) {
          // Horizontal purl bump
          ctx.lineCap = 'round';
          ctx.lineWidth = rowH * 0.42;
          ctx.strokeStyle = isBump ? 'rgb(180,180,180)' : rgbStr(cMid);
          ctx.beginPath();
          ctx.moveTo(cx - colW * 0.34, cy + jitter);
          ctx.quadraticCurveTo(cx, cy - rowH * 0.22 + jitter, cx + colW * 0.34, cy + jitter);
          ctx.stroke();

          ctx.lineWidth = rowH * 0.18;
          ctx.strokeStyle = isBump ? 'rgb(235,235,235)' : rgbStr(cLight, 0.8);
          ctx.beginPath();
          ctx.moveTo(cx - colW * 0.26, cy - rowH * 0.08 + jitter);
          ctx.quadraticCurveTo(cx, cy - rowH * 0.24 + jitter, cx + colW * 0.26, cy - rowH * 0.08 + jitter);
          ctx.stroke();
        } else if (isCableLeft || isCableRight) {
          // Braided cable twist strand
          const phase = (r / 4) * Math.PI;
          const side = isCableLeft ? -1 : 1;
          const xOff = Math.sin(phase) * colW * 0.35 * side;
          const xNext = Math.sin(((r + 1) / 4) * Math.PI) * colW * 0.35 * side;
          const onTop = (isCableLeft && Math.cos(phase) >= 0) || (isCableRight && Math.cos(phase) < 0);

          ctx.lineCap = 'round';
          ctx.lineWidth = colW * 0.48;
          ctx.strokeStyle = isBump
            ? (onTop ? 'rgb(220,220,220)' : 'rgb(150,150,150)')
            : rgbStr(onTop ? cBase : cMid);
          ctx.beginPath();
          ctx.moveTo(cx + xOff, cy - rowH * 0.55);
          ctx.quadraticCurveTo(cx + (xOff + xNext) * 0.5 + side * 2, cy, cx + xNext, cy + rowH * 0.55);
          ctx.stroke();

          ctx.lineWidth = colW * 0.18;
          ctx.strokeStyle = isBump
            ? (onTop ? 'rgb(255,255,255)' : 'rgb(190,190,190)')
            : rgbStr(cLight, onTop ? 0.85 : 0.45);
          ctx.beginPath();
          ctx.moveTo(cx + xOff - 1.5, cy - rowH * 0.48);
          ctx.quadraticCurveTo(cx + (xOff + xNext) * 0.5 - 1.5, cy, cx + xNext - 1.5, cy + rowH * 0.48);
          ctx.stroke();
        } else {
          // Classic V-shaped stockinette stitch (two overlapping curved yarn loops)
          const lx0 = cx - colW * 0.34, ly0 = cy - rowH * 0.42;
          const rx0 = cx + colW * 0.34, ry0 = cy - rowH * 0.42;
          const bx = cx, by = cy + rowH * 0.44;

          ctx.lineCap = 'round';
          // Left yarn leg
          ctx.lineWidth = colW * 0.32;
          ctx.strokeStyle = isBump ? 'rgb(205,205,205)' : rgbStr(cBase);
          ctx.beginPath();
          ctx.moveTo(lx0, ly0);
          ctx.quadraticCurveTo(cx - colW * 0.24, cy + rowH * 0.08, bx - colW * 0.06, by);
          ctx.stroke();
          // Right yarn leg
          ctx.beginPath();
          ctx.moveTo(rx0, ry0);
          ctx.quadraticCurveTo(cx + colW * 0.24, cy + rowH * 0.08, bx + colW * 0.06, by);
          ctx.stroke();

          // Yarn highlights along stitch crown
          ctx.lineWidth = colW * 0.12;
          ctx.strokeStyle = isBump ? 'rgb(250,250,250)' : rgbStr(cLight, 0.85);
          ctx.beginPath();
          ctx.moveTo(lx0 + 1, ly0 + 1);
          ctx.quadraticCurveTo(cx - colW * 0.22, cy, bx - colW * 0.08, by - 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(rx0 - 1, ry0 + 1);
          ctx.quadraticCurveTo(cx + colW * 0.22, cy, bx + colW * 0.08, by - 2);
          ctx.stroke();
        }
      }
    }

    // Soft wool fuzz flecks
    if (!isBump) {
      for (let i = 0; i < 900; i++) {
        const fx = kit.noise(i * 0.73, 1.4) * w;
        const fy = kit.noise(3.7, i * 0.91) * h;
        ctx.fillStyle = i % 2 === 0 ? rgbStr(light, 0.24) : rgbStr(dark, 0.22);
        ctx.fillRect(fx, fy, 2, 1.5);
      }
    }
  }

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => drawKnit(ctx, w, h, false));
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.4, 1.5);

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => drawKnit(ctx, w, h, true));
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.4, 1.5);

  return { map, bumpMap };
}

// ---------------------------------------------------------------------------
// Geometry helpers: tapered tube along CatmullRomCurve3, lathe posts, sculpted shapes
// ---------------------------------------------------------------------------
function buildTaperedTube(THREE, points, radiusFn, tubularSegs = 48, radialSegs = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const pts = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const u = closed ? (i % tubularSegs) / tubularSegs : i / tubularSegs;
    pts.push(curve.getPointAt(u));
    tangents.push(curve.getTangentAt(u).normalize());
  }

  // Parallel transport frames
  const up = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(tangents[0], up).normalize();
  normals.push(n0);
  binormals.push(new THREE.Vector3().crossVectors(tangents[0], n0).normalize());

  const axis = new THREE.Vector3();
  for (let i = 1; i <= tubularSegs; i++) {
    const nPrev = normals[i - 1].clone();
    axis.crossVectors(tangents[i - 1], tangents[i]);
    if (axis.lengthSq() > 1e-10) {
      axis.normalize();
      const angle = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
      nPrev.applyAxisAngle(axis, angle);
    }
    nPrev.addScaledVector(tangents[i], -nPrev.dot(tangents[i])).normalize();
    normals.push(nPrev);
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], nPrev).normalize());
  }

  if (closed) {
    const twist = Math.atan2(normals[tubularSegs].dot(binormals[0]), normals[tubularSegs].dot(normals[0]));
    for (let i = 1; i <= tubularSegs; i++) {
      const a = -twist * (i / tubularSegs);
      normals[i].applyAxisAngle(tangents[i], a).normalize();
      binormals[i].crossVectors(tangents[i], normals[i]).normalize();
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const r = radiusFn(t);
    const p = pts[i];
    const N = normals[i];
    const B = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      positions.push(
        p.x + (N.x * ct + B.x * st) * r,
        p.y + (N.y * ct + B.y * st) * r,
        p.z + (N.z * ct + B.z * st) * r
      );
      uvs.push(t * 4, v);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = i * stride + (j + 1);
      const d = (i + 1) * stride + (j + 1);
      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }

  if (!closed) {
    // Rounded end caps
    const r0 = radiusFn(0);
    const startIdx = positions.length / 3;
    positions.push(
      pts[0].x - tangents[0].x * r0 * 0.45,
      pts[0].y - tangents[0].y * r0 * 0.45,
      pts[0].z - tangents[0].z * r0 * 0.45
    );
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startIdx, j + 1, j);
    }

    const r1 = radiusFn(1);
    const endIdx = positions.length / 3;
    const base = tubularSegs * stride;
    positions.push(
      pts[tubularSegs].x + tangents[tubularSegs].x * r1 * 0.45,
      pts[tubularSegs].y + tangents[tubularSegs].y * r1 * 0.45,
      pts[tubularSegs].z + tangents[tubularSegs].z * r1 * 0.45
    );
    uvs.push(1, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildTurnedPostGeo(THREE, height, style = 'woodPost') {
  const pts = [];
  const add = (r, y) => pts.push(new THREE.Vector2(Math.max(0.0005, r), y));

  if (style === 'taperLeg') {
    // Cozy turned tapered wooden leg (height ~ 0.23m)
    const H = height;
    add(0.0005, 0.0);
    add(0.0155, 0.0);
    add(0.0168, 0.008);
    add(0.0155, 0.018);
    add(0.0175, 0.032);
    add(0.0160, 0.044);
    add(0.0188, 0.062);
    add(0.0205, 0.092);
    add(0.0226, 0.125);
    add(0.0245, 0.155);
    add(0.0262, 0.180);
    add(0.0248, 0.192);
    add(0.0278, 0.204);
    add(0.0282, H - 0.008);
    add(0.0265, H);
    add(0.0005, H);
    return new THREE.LatheGeometry(pts, 24);
  }

  if (style === 'metalPost') {
    // Vintage tubular iron bedpost with cast collars & ball finial
    const R = 0.0185;
    const finStart = height - 0.095;
    add(0.0005, 0.0);
    add(0.023, 0.0);
    add(0.024, 0.012);
    add(0.020, 0.025);
    add(R, 0.045);
    add(R, 0.195);
    // Lower rail cast collar
    add(0.0245, 0.215);
    add(0.0255, 0.255);
    add(0.0245, 0.295);
    add(R, 0.315);
    // Mid decorative ring
    const midY = (0.32 + finStart) * 0.5;
    add(R, midY - 0.018);
    add(0.0225, midY - 0.007);
    add(0.0235, midY);
    add(0.0225, midY + 0.007);
    add(R, midY + 0.018);
    // Neck & classic brass/metal ball finial
    add(R, finStart - 0.01);
    add(0.023, finStart + 0.004);
    add(0.015, finStart + 0.018);
    add(0.013, finStart + 0.028);
    add(0.021, finStart + 0.038);
    add(0.0275, finStart + 0.052);
    add(0.0285, finStart + 0.064);
    add(0.0255, finStart + 0.076);
    add(0.0175, finStart + 0.086);
    add(0.008, finStart + 0.092);
    add(0.0005, height);
    return new THREE.LatheGeometry(pts, 24);
  }

  // Default: Classic turned wooden post with spindle foot & acorn finial
  const finStart = height - 0.115;
  add(0.0005, 0.0);
  add(0.017, 0.0);
  add(0.021, 0.012);
  add(0.0185, 0.028);
  add(0.0245, 0.055);
  add(0.0275, 0.095);
  add(0.0235, 0.135);
  add(0.021, 0.165);
  add(0.0265, 0.185);
  add(0.0275, 0.205);
  // Rail junction zone
  add(0.0275, 0.35);
  add(0.025, 0.37);
  // Upper post gentle entasis
  const upperMid = (0.38 + finStart) * 0.5;
  add(0.0245, upperMid);
  add(0.024, finStart - 0.02);
  // Finial cove, bead, and acorn crown
  add(0.028, finStart - 0.005);
  add(0.020, finStart + 0.012);
  add(0.0175, finStart + 0.026);
  add(0.025, finStart + 0.042);
  add(0.031, finStart + 0.062);
  add(0.0295, finStart + 0.080);
  add(0.022, finStart + 0.095);
  add(0.012, finStart + 0.106);
  add(0.004, finStart + 0.112);
  add(0.0005, height);
  return new THREE.LatheGeometry(pts, 24);
}

function buildBeveledBarGeo(THREE, length, height, thickness, axis = 'x') {
  // Chamfered/rounded rectangular extrusion along length
  const hw = thickness * 0.5;
  const hh = height * 0.5;
  const r = Math.min(hw, hh) * 0.28;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.0025,
    bevelSegments: 2,
    curveSegments: 6
  });
  geo.center();
  if (axis === 'x') geo.rotateY(Math.PI / 2);
  else if (axis === 'y') geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function buildArchedRailGeo(THREE, span, railH, archLift, thickness) {
  const hw = span * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.bezierCurveTo(-hw * 0.45, archLift * 0.55, hw * 0.45, archLift * 0.55, hw, 0);
  shape.lineTo(hw, railH);
  shape.bezierCurveTo(hw * 0.45, railH + archLift, -hw * 0.45, railH + archLift, -hw, railH);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 24
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

// Smooth disk (sx, sz) -> squircle (u, v) in [-1, 1]^2
function diskToSquircle(sx, sz, exp = 5.0) {
  const r = Math.hypot(sx, sz);
  if (r < 1e-6) return [0, 0];
  const ca = Math.abs(sx) / r;
  const sa = Math.abs(sz) / r;
  const scale = 1.0 / Math.pow(Math.pow(ca, exp) + Math.pow(sa, exp), 1.0 / exp);
  return [clamp(sx * scale, -1, 1), clamp(sz * scale, -1, 1)];
}

// Sculpt a continuous thick blanket / duvet / throw from a single SphereGeometry
function buildSculptedBlanketGeo(THREE, segU, segV, drapeFn, halfThickFn, uvScale = [1.5, 2.0]) {
  const geo = new THREE.SphereGeometry(1, segU, segV);
  const pos = geo.attributes.position;
  const uvAttr = geo.attributes.uv;

  const p0 = new THREE.Vector3();
  const pu = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const du = new THREE.Vector3();
  const dv = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const eps = 0.006;

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);

    const [u, v] = diskToSquircle(sx, sz, 5.2);
    drapeFn(u, v, p0);
    drapeFn(clamp(u + eps, -1, 1), v, pu);
    drapeFn(u, clamp(v + eps, -1, 1), pv);

    if (u > 1 - eps * 1.5) {
      drapeFn(u - eps, v, pu);
      du.subVectors(p0, pu);
    } else {
      du.subVectors(pu, p0);
    }
    if (v > 1 - eps * 1.5) {
      drapeFn(u, v - eps, pv);
      dv.subVectors(p0, pv);
    } else {
      dv.subVectors(pv, p0);
    }

    // dv x du points outward (+Y on top, +X on right skirt, -X on left skirt, +Z on foot skirt)
    nrm.crossVectors(dv, du);
    if (nrm.lengthSq() < 1e-10) nrm.set(0, 1, 0);
    else nrm.normalize();

    const ht = halfThickFn(u, v);
    // Soften edge profile slightly so hem feels plump and round
    const syShaped = Math.sign(sy) * Math.pow(Math.abs(sy), 0.78);
    pos.setXYZ(
      i,
      p0.x + nrm.x * syShaped * ht,
      p0.y + nrm.y * syShaped * ht,
      p0.z + nrm.z * syShaped * ht
    );
    uvAttr.setXY(i, (u * 0.5 + 0.5) * uvScale[0], (v * 0.5 + 0.5) * uvScale[1]);
  }

  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Component builders
// ---------------------------------------------------------------------------
function makeMesh(THREE, geo, mat, slot, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (slot) m.userData.slot = slot;
  return m;
}

function buildMattress(THREE, kit, mats, opts, variant) {
  const group = new THREE.Group();
  group.name = 'mattress';

  const M_HW = 0.445;
  const M_Z0 = -0.925;
  const M_Z1 = variant === 1 ? 0.935 : 0.915;
  const M_HL = (M_Z1 - M_Z0) * 0.5;
  const M_ZC = (M_Z0 + M_Z1) * 0.5;
  const M_BOT = 0.272;
  const M_TOP = 0.492;
  const M_HH = (M_TOP - M_BOT) * 0.5;
  const M_YC = (M_BOT + M_TOP) * 0.5;

  // Sculpted continuous mattress from dense SphereGeometry
  const geo = new THREE.SphereGeometry(1, 64, 40);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);

    // Superellipsoid mapping for plush rounded-box mattress silhouette
    const px = Math.sign(sx) * Math.pow(Math.abs(sx), 0.24) * M_HW;
    const pz = Math.sign(sz) * Math.pow(Math.abs(sz), 0.24) * M_HL;
    let py = Math.sign(sy) * Math.pow(Math.abs(sy), 0.28) * M_HH;

    // Slight plush belly bulge on side walls
    const sideFactor = 1 - Math.abs(sy);
    const wallBulge = 1 + 0.015 * sideFactor * sideFactor;
    const x = px * wallBulge;
    const z = pz * wallBulge + M_ZC;

    // Gentle quilted top crown + very subtle cozy sag under pillows/center
    if (sy > 0) {
      const topMask = smoothstep(0.15, 0.75, sy);
      const qNoise = (kit.noise(x * 7.5 + 1.3, z * 7.5 + 2.1) - 0.5) * 0.0055;
      const crown = (1 - (px / M_HW) * (px / M_HW)) * 0.008;
      const pillowDip = -0.008 * Math.exp(-Math.pow((z + 0.72) / 0.25, 2));
      py += (qNoise + crown + pillowDip) * topMask;
    } else {
      // Flatten underside cleanly onto slats
      py = Math.max(py, -M_HH);
    }

    const y = M_YC + py;
    pos.setXYZ(i, x, y, z);

    // Clean triplanar-ish UVs without polar pinching
    if (Math.abs(sy) > 0.55) {
      uv.setXY(i, (x + M_HW) * 1.4, (z - M_Z0) * 1.4);
    } else {
      const perim = Math.atan2(pz, px) / (Math.PI * 2) + 0.5;
      uv.setXY(i, perim * 6.0, (y - M_BOT) * 3.2);
    }
  }
  geo.computeVertexNormals();
  group.add(makeMesh(THREE, geo, mats.mattress, 'secondary'));

  // Continuous closed piping cords around top & bottom edges of mattress
  const makePipingLoop = (yLevel, inset) => {
    const pts = [];
    const nPts = 64;
    const hw = M_HW - inset;
    const hl = M_HL - inset;
    for (let i = 0; i < nPts; i++) {
      const a = (i / nPts) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = Math.sign(ca) * Math.pow(Math.abs(ca), 0.26) * hw;
      const z = Math.sign(sa) * Math.pow(Math.abs(sa), 0.26) * hl + M_ZC;
      const yWav = (kit.noise(x * 4 + 2.1, z * 4 + 1.3) - 0.5) * 0.003;
      pts.push(new THREE.Vector3(x, yLevel + yWav, z));
    }
    return buildTaperedTube(THREE, pts, () => 0.0082, 88, 8, true);
  };

  group.add(makeMesh(THREE, makePipingLoop(M_TOP - 0.008, 0.006), mats.piping, 'accent'));
  group.add(makeMesh(THREE, makePipingLoop(M_BOT + 0.012, 0.008), mats.piping, 'accent'));

  return { group, M_HW, M_Z0, M_Z1, M_TOP };
}

function buildBedding(THREE, kit, mats, mattressInfo, variant) {
  const { M_HW, M_Z1, M_TOP } = mattressInfo;
  const duvetGroup = new THREE.Group();
  duvetGroup.name = 'duvet';

  // Head edge curve of duvet (slightly asymmetric, lived-in look)
  const duvetHeadZ = (u) => -0.35 + 0.032 * u + 0.022 * Math.sin(u * 2.8 + 0.5);

  // Shared arc-length drape helper over mattress shoulders
  const sideFlat = 0.72;
  const bendR = 0.058;

  // Duvet drape surface function (also queried by cuff & knitted throw for zero clipping!)
  const duvetDrape = (u, v, out, extraLift = 0, extraSide = 0) => {
    const s = Math.abs(u);
    const sgn = u < 0 ? -1 : 1;

    // Z span from head edge to foot edge
    const zStart = duvetHeadZ(u);
    const openFoot = variant === 1;
    const zFootLimit = openFoot ? M_Z1 : M_Z1 - 0.015;
    const vFlatFoot = openFoot ? 0.84 : 0.92;
    const vNorm = (v + 1) * 0.5; // 0 at head, 1 at foot

    let z, footDrop = 0;
    if (vNorm <= vFlatFoot) {
      const f = vNorm / vFlatFoot;
      z = zStart + (zFootLimit - bendR * 0.75 - zStart) * f;
    } else {
      const f = (vNorm - vFlatFoot) / (1 - vFlatFoot);
      const footLen = openFoot ? 0.21 : 0.11;
      const arc = f * footLen;
      const rB = bendR * 0.85;
      const ang = Math.min(Math.PI * 0.5, arc / rB);
      const extra = Math.max(0, arc - rB * Math.PI * 0.5);
      z = (zFootLimit - rB) + rB * Math.sin(ang) + (openFoot ? extra * 0.06 : -extra * 0.08);
      footDrop = rB * (1 - Math.cos(ang)) + extra;
    }

    // X & side drape
    const hwTop = M_HW + 0.008 + extraSide;
    const sideDropLen = 0.165 + 0.025 * Math.sin(v * 2.4 + (sgn > 0 ? 0.5 : 2.1));
    let x, sideDrop = 0;
    if (s <= sideFlat) {
      x = sgn * (s / sideFlat) * (hwTop - bendR);
    } else {
      const f = (s - sideFlat) / (1 - sideFlat);
      const arc = f * sideDropLen;
      const ang = Math.min(Math.PI * 0.5, arc / bendR);
      const extra = Math.max(0, arc - bendR * Math.PI * 0.5);
      const ripple = Math.sin(z * 11.5 + sgn * 1.4) * 0.009 * f;
      x = sgn * ((hwTop - bendR) + bendR * Math.sin(ang) + extra * 0.14) + ripple;
      sideDrop = bendR * (1 - Math.cos(ang)) + extra;
    }

    // Smooth blend when both side and foot drop near foot corners
    const drop = Math.max(sideDrop, footDrop) + Math.min(sideDrop, footDrop) * 0.22;

    // Gentle organic wrinkles & down-filled loftiness on top of duvet
    const topWeight = smoothstep(0.08, 0.0, drop);
    const nBroad = (kit.noise(x * 2.3 + 4.1, z * 2.1 + 1.7) - 0.5) * 0.026;
    const nFine = (kit.noise(x * 6.8 + 0.9, z * 6.2 + 5.3) - 0.5) * 0.008;
    const diagFold = Math.sin(x * 7.2 + z * 4.8 + nBroad * 28.0) * 0.0075 * topWeight;
    const headRoll = 0.012 * Math.exp(-Math.pow(vNorm / 0.14, 2)) * topWeight;
    const centerPuff = 0.014 * (1 - u * u * 0.7) * topWeight;

    const y = M_TOP + 0.030 + extraLift + centerPuff + headRoll + (nBroad + nFine) * topWeight + diagFold - drop;
    out.set(x, y, z);
    return out;
  };

  // 1. Main sculpted duvet body
  const duvetGeo = buildSculptedBlanketGeo(
    THREE,
    72,
    44,
    (u, v, out) => duvetDrape(u, v, out, 0, 0),
    (u, v) => {
      const edgeFade = smoothstep(1.0, 0.85, Math.max(Math.abs(u), Math.abs(v)));
      return 0.024 + 0.013 * edgeFade;
    },
    [1.8, 2.5]
  );
  duvetGroup.add(makeMesh(THREE, duvetGeo, mats.duvet, 'primary'));

  // 2. Soft folded-back duvet cuff (showing contrasting secondary lining)
  const cuffGeo = buildSculptedBlanketGeo(
    THREE,
    60,
    28,
    (u, v, out) => {
      const vNorm = (v + 1) * 0.5; // 0 = folded back roll crease, 1 = front folded hem
      const cuffDepth = 0.22 + 0.032 * Math.sin(u * 2.5 - 0.6) - 0.018 * u;
      const zHead = duvetHeadZ(u);
      const z = zHead - 0.015 + vNorm * cuffDepth;

      // Map z back into duvet's v parameter so cuff rides over the exact duvet contour
      const openFoot = variant === 1;
      const zFootLimit = openFoot ? M_Z1 : M_Z1 - 0.015;
      const vFlatFoot = openFoot ? 0.84 : 0.92;
      const duvetVNorm = clamp((z - zHead) / Math.max(0.1, zFootLimit - bendR * 0.75 - zHead) * vFlatFoot, 0, 1);
      const duvetV = duvetVNorm * 2 - 1;

      duvetDrape(u * 1.01, duvetV, out, 0.036, 0.014);
      out.z = z;

      // Soft tucked roll along back crease (vNorm near 0) and gentle wavy front edge
      const rollCrease = -0.024 * Math.exp(-Math.pow(vNorm / 0.16, 2));
      const rollPuff = 0.014 * Math.sin(vNorm * Math.PI);
      const cuffWrinkle = (kit.noise(u * 4.5 + 3.2, v * 3.5 + 1.1) - 0.5) * 0.012;
      out.y += rollCrease + rollPuff + cuffWrinkle;
      return out;
    },
    (u, v) => {
      const vNorm = (v + 1) * 0.5;
      return 0.016 + 0.008 * Math.sin(vNorm * Math.PI);
    },
    [1.8, 0.65]
  );
  duvetGroup.add(makeMesh(THREE, cuffGeo, mats.sheet, 'secondary'));

  // 3. Peeking crisp top-sheet strip tucked behind the duvet fold
  const topSheetGeo = buildSculptedBlanketGeo(
    THREE,
    48,
    18,
    (u, v, out) => {
      const vNorm = (v + 1) * 0.5;
      const zHead = duvetHeadZ(u);
      const z = zHead - 0.13 + vNorm * 0.15;
      const s = Math.abs(u);
      const sgn = u < 0 ? -1 : 1;
      const hw = M_HW + 0.004;
      let x, drop = 0;
      if (s <= 0.82) {
        x = sgn * (s / 0.82) * (hw - 0.04);
      } else {
        const f = (s - 0.82) / 0.18;
        const ang = f * Math.PI * 0.48;
        x = sgn * ((hw - 0.04) + 0.04 * Math.sin(ang));
        drop = 0.04 * (1 - Math.cos(ang)) + f * 0.05;
      }
      const w = (kit.noise(x * 5.2 + 2.1, z * 5.2 + 0.4) - 0.5) * 0.008;
      out.set(x, M_TOP + 0.012 + w - drop, z);
      return out;
    },
    () => 0.008,
    [1.6, 0.4]
  );
  duvetGroup.add(makeMesh(THREE, topSheetGeo, mats.sheet, 'secondary'));

  // -------------------------------------------------------------------------
  // Two asymmetric pillows of different sizes
  // -------------------------------------------------------------------------
  const pillowsGroup = new THREE.Group();
  pillowsGroup.name = 'pillows';

  function buildPillow(width, height, thick, mat, pipeMat, slot, pipeSlot, seed) {
    const pGroup = new THREE.Group();
    const hw = width * 0.5;
    const hh = height * 0.5;
    const ht = thick * 0.5;

    const geo = new THREE.SphereGeometry(1, 52, 32);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      const sx = pos.getX(i);
      const sy = pos.getY(i);
      const sz = pos.getZ(i);

      // Pillow squircle planform with softly pinched corners ("dog ears")
      const r2 = sx * sx + sz * sz;
      const x = Math.sign(sx) * Math.pow(Math.abs(sx), 0.58) * hw;
      const z = Math.sign(sz) * Math.pow(Math.abs(sz), 0.58) * hh;
      const cornerFactor = Math.pow(Math.abs(sx * sz), 0.85);
      const xEar = x * (1 + 0.09 * cornerFactor);
      const zEar = z * (1 + 0.09 * cornerFactor);

      // Plump center, pinched seam perimeter
      const edgePinch = Math.pow(clamp(1 - r2 * 0.96, 0, 1), 0.62);
      const seamLip = 0.006 * Math.pow(r2, 2.0);
      let y = Math.sign(sy) * Math.pow(Math.abs(sy), 0.72) * (ht * edgePinch + seamLip);

      // Soft cozy dimple & organic fabric creases
      const headDip = -0.014 * Math.exp(-((x / (hw * 0.55)) ** 2 + (z / (hh * 0.55)) ** 2)) * (sy > 0 ? 1 : 0.25);
      const crinkle = (kit.noise(x * 7.5 + seed, z * 7.5 + seed * 1.7) - 0.5) * 0.011;
      y += headDip + crinkle * (0.4 + 0.6 * r2);

      pos.setXYZ(i, xEar, y, zEar);
      uv.setXY(i, (xEar / width + 0.5) * 1.4, (zEar / height + 0.5) * 1.4);
    }
    geo.computeVertexNormals();
    pGroup.add(makeMesh(THREE, geo, mat, slot));

    // Continuous corded piping around pillow perimeter seam
    const pipePts = [];
    const nPipe = 48;
    for (let i = 0; i < nPipe; i++) {
      const a = (i / nPipe) * Math.PI * 2;
      const sx = Math.cos(a);
      const sz = Math.sin(a);
      const cf = Math.pow(Math.abs(sx * sz), 0.85);
      const x = Math.sign(sx) * Math.pow(Math.abs(sx), 0.58) * hw * (1 + 0.09 * cf);
      const z = Math.sign(sz) * Math.pow(Math.abs(sz), 0.58) * hh * (1 + 0.09 * cf);
      const y = (kit.noise(x * 7.5 + seed, z * 7.5 + seed * 1.7) - 0.5) * 0.008;
      pipePts.push(new THREE.Vector3(x, y, z));
    }
    const pipeGeo = buildTaperedTube(THREE, pipePts, () => 0.0055, 64, 7, true);
    pGroup.add(makeMesh(THREE, pipeGeo, pipeMat, pipeSlot));

    return pGroup;
  }

  // Large sleeping pillow resting against headboard
  const bigPillow = buildPillow(0.66, 0.43, 0.175, mats.sheet, mats.piping, 'secondary', 'accent', 1.3);
  bigPillow.position.set(-0.055, M_TOP + 0.155, -0.745);
  bigPillow.rotation.set(0.92, 0.06, -0.04);
  pillowsGroup.add(bigPillow);

  // Smaller cozy accent throw pillow nestled asymmetrically in front
  const smallPillow = buildPillow(0.42, 0.34, 0.155, mats.accentPillow, mats.sheet, 'accent', 'secondary', 6.4);
  smallPillow.position.set(0.155, M_TOP + 0.145, -0.555);
  smallPillow.rotation.set(1.06, -0.26, 0.08);
  pillowsGroup.add(smallPillow);

  // -------------------------------------------------------------------------
  // Knitted throw draped casually at the foot + swaying yarn tassels
  // -------------------------------------------------------------------------
  const throwGroup = new THREE.Group();
  throwGroup.name = 'throw';
  const swayNodes = [];

  // Throw sits across foot of duvet, angled slightly and hanging deeper on +x side
  const throwDrape = (u, v, out) => {
    const zCenter = 0.58 + u * 0.045;
    const halfLen = 0.245 + 0.015 * Math.sin(u * 3.1 + 0.4);
    const zTarget = zCenter + v * halfLen;

    // Map zTarget into duvet's v parameter so throw hugs duvet seamlessly
    const openFoot = variant === 1;
    const zFootLimit = openFoot ? M_Z1 : M_Z1 - 0.015;
    const vFlatFoot = openFoot ? 0.84 : 0.92;
    const zHead = duvetHeadZ(u);
    const duvetVNorm = clamp((zTarget - zHead) / Math.max(0.1, zFootLimit - bendR * 0.75 - zHead) * vFlatFoot, 0, 1);
    const duvetV = duvetVNorm * 2 - 1;

    // Extend throw slightly further down the sides than the duvet, asymmetric (+x longer!)
    const s = Math.abs(u);
    const sgn = u < 0 ? -1 : 1;
    const baseDuvet = new THREE.Vector3();
    duvetDrape(clamp(u, -0.96, 0.96), duvetV, baseDuvet, 0.035, 0.018);

    const sideFlatThrow = 0.66;
    const hwTop = M_HW + 0.032;
    const dropLen = sgn > 0 ? 0.265 : 0.195;
    let x, y;
    if (s <= sideFlatThrow) {
      const uMapped = (u / sideFlatThrow) * sideFlat;
      duvetDrape(uMapped, duvetV, out, 0.036, 0.02);
      // Casual tossed soft ridges across the knit blanket
      const tossWave = Math.sin(v * 6.5 + u * 3.2) * 0.010 + (kit.noise(u * 4.2 + 7.1, v * 5.0 + 2.3) - 0.5) * 0.014;
      out.y += tossWave;
      out.z = zTarget;
      return out;
    } else {
      const f = (s - sideFlatThrow) / (1 - sideFlatThrow);
      const arc = f * dropLen;
      const rB = 0.062;
      const ang = Math.min(Math.PI * 0.5, arc / rB);
      const extra = Math.max(0, arc - rB * Math.PI * 0.5);
      const ripple = Math.sin(v * 9.5 + sgn * 1.1) * 0.011 * f;
      x = sgn * ((hwTop - rB) + rB * Math.sin(ang) + extra * 0.08) + ripple;

      // Smoothly anchor top of curve to duvet shoulder height
      const shoulder = new THREE.Vector3();
      duvetDrape(sgn * sideFlat, duvetV, shoulder, 0.036, 0.02);
      y = shoulder.y - rB * (1 - Math.cos(ang)) - extra;
      out.set(x, y, zTarget + Math.sin(f * 3.0 + v * 2.0) * 0.008);
      return out;
    }
  };

  const throwGeo = buildSculptedBlanketGeo(
    THREE,
    64,
    34,
    throwDrape,
    (u, v) => {
      const edgeRib = 1 + 0.25 * smoothstep(0.75, 1.0, Math.abs(v));
      return 0.0095 * edgeRib;
    },
    [1.0, 1.0]
  );
  throwGroup.add(makeMesh(THREE, throwGeo, mats.knit, 'accent'));

  // Hand-knotted yarn tassels along both hanging side edges of the knitted throw
  const tasselsGroup = new THREE.Group();
  tasselsGroup.name = 'tassels';
  const tasselBaseGeo = buildTaperedTube(
    THREE,
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.003, -0.022, 0.002),
      new THREE.Vector3(-0.001, -0.048, -0.002),
      new THREE.Vector3(0.002, -0.072, 0.001)
    ],
    (t) => {
      // Knotted bead at top, flared soft yarn bundle below
      if (t < 0.22) return 0.0075 * Math.sin((t / 0.22) * Math.PI * 0.85 + 0.3);
      return 0.0042 + 0.0035 * Math.sin((t - 0.22) * 3.1) * (1 - t * 0.45);
    },
    10,
    6,
    false
  );

  const edgePt = new THREE.Vector3();
  for (const side of [-1, 1]) {
    const count = 9;
    for (let i = 0; i < count; i++) {
      const v = -0.88 + (i / (count - 1)) * 1.76;
      throwDrape(side * 0.995, v, edgePt);
      const pivot = new THREE.Group();
      pivot.position.set(edgePt.x, edgePt.y - 0.002, edgePt.z);
      pivot.rotation.y = side * 0.4 + (kit.noise(i * 2.1, side * 3.7) - 0.5) * 0.6;
      pivot.rotation.z = side * 0.05;
      const m = makeMesh(THREE, tasselBaseGeo, mats.tassel, 'accent', true, false);
      pivot.add(m);
      tasselsGroup.add(pivot);
      swayNodes.push({
        node: pivot,
        baseRotZ: pivot.rotation.z,
        baseRotX: pivot.rotation.x,
        phase: i * 0.73 + (side > 0 ? 1.4 : 0)
      });
    }
  }
  throwGroup.add(tasselsGroup);

  return { duvetGroup, pillowsGroup, throwGroup, swayNodes };
}

// ---------------------------------------------------------------------------
// Bed frame variants (0: slatted wood, 1: upholstered tufted, 2: curved metal)
// ---------------------------------------------------------------------------
function buildUnderSlats(THREE, mat, slot, y = 0.262, zMin = -0.88, zMax = 0.88) {
  const g = new THREE.Group();
  const slatGeo = buildBeveledBarGeo(THREE, 0.90, 0.018, 0.06, 'x');
  const count = 8;
  for (let i = 0; i < count; i++) {
    const z = zMin + (i / (count - 1)) * (zMax - zMin);
    const s = makeMesh(THREE, slatGeo, mat, slot, true, true);
    s.position.set(0, y, z);
    g.add(s);
  }
  return g;
}

function buildVariant0Slatted(THREE, mats) {
  const frameGroup = new THREE.Group();
  frameGroup.name = 'frame';
  const hbGroup = new THREE.Group();
  hbGroup.name = 'headboard';

  const postX = 0.468;
  const headZ = -0.962;
  const footZ = 0.962;

  // Turned headboard & footboard posts
  const headPostGeo = buildTurnedPostGeo(THREE, 1.09, 'woodPost');
  const footPostGeo = buildTurnedPostGeo(THREE, 0.62, 'woodPost');

  for (const sx of [-1, 1]) {
    const hp = makeMesh(THREE, headPostGeo, mats.frame, 'wood');
    hp.position.set(sx * postX, 0, headZ);
    hbGroup.add(hp);

    const fp = makeMesh(THREE, footPostGeo, mats.frame, 'wood');
    fp.position.set(sx * postX, 0, footZ);
    frameGroup.add(fp);
  }

  // Headboard arched crest rail + lower rail + sculpted slats
  const hbArchLift = 0.072;
  const hbTopBaseY = 0.905;
  const hbTopGeo = buildArchedRailGeo(THREE, postX * 2 - 0.03, 0.068, hbArchLift, 0.034);
  const hbTop = makeMesh(THREE, hbTopGeo, mats.frame, 'wood');
  hbTop.position.set(0, hbTopBaseY, headZ);
  hbGroup.add(hbTop);

  const hbLowGeo = buildBeveledBarGeo(THREE, postX * 2 - 0.03, 0.062, 0.032, 'x');
  const hbLow = makeMesh(THREE, hbLowGeo, mats.frame, 'wood');
  hbLow.position.set(0, 0.34, headZ);
  hbGroup.add(hbLow);

  const slatCount = 7;
  for (let i = 0; i < slatCount; i++) {
    const t = (i / (slatCount - 1)) * 2 - 1; // -1..1
    const x = t * 0.36;
    const archCurve = 1 - t * t;
    const topY = hbTopBaseY + 0.02 + hbArchLift * 0.55 * archCurve;
    const botY = 0.35;
    const slatH = topY - botY;
    const slatW = i === 3 ? 0.076 : 0.056;
    const sGeo = buildBeveledBarGeo(THREE, slatH, 0.018, slatW, 'y');
    const sMesh = makeMesh(THREE, sGeo, mats.frame, 'wood');
    sMesh.position.set(x, (topY + botY) * 0.5, headZ);
    hbGroup.add(sMesh);
  }

  // Footboard arched top rail + lower rail + short vertical slats
  const fbArchLift = 0.04;
  const fbTopBaseY = 0.485;
  const fbTopGeo = buildArchedRailGeo(THREE, postX * 2 - 0.03, 0.054, fbArchLift, 0.032);
  const fbTop = makeMesh(THREE, fbTopGeo, mats.frame, 'wood');
  fbTop.position.set(0, fbTopBaseY, footZ);
  frameGroup.add(fbTop);

  const fbLow = makeMesh(THREE, hbLowGeo, mats.frame, 'wood');
  fbLow.position.set(0, 0.255, footZ);
  frameGroup.add(fbLow);

  for (let i = 0; i < slatCount; i++) {
    const t = (i / (slatCount - 1)) * 2 - 1;
    const x = t * 0.36;
    const topY = fbTopBaseY + 0.015 + fbArchLift * 0.55 * (1 - t * t);
    const botY = 0.265;
    const slatH = topY - botY;
    const slatW = i === 3 ? 0.074 : 0.054;
    const sGeo = buildBeveledBarGeo(THREE, slatH, 0.016, slatW, 'y');
    const sMesh = makeMesh(THREE, sGeo, mats.frame, 'wood');
    sMesh.position.set(x, (topY + botY) * 0.5, footZ);
    frameGroup.add(sMesh);
  }

  // Sculpted side rails with subtle decorative bead trim
  const sideRailGeo = buildBeveledBarGeo(THREE, footZ - headZ - 0.03, 0.132, 0.028, 'z');
  const beadGeo = buildBeveledBarGeo(THREE, footZ - headZ - 0.06, 0.016, 0.008, 'z');
  for (const sx of [-1, 1]) {
    const rail = makeMesh(THREE, sideRailGeo, mats.frame, 'wood');
    rail.position.set(sx * postX, 0.272, 0);
    frameGroup.add(rail);

    const bead = makeMesh(THREE, beadGeo, mats.frame, 'wood');
    bead.position.set(sx * (postX + 0.015), 0.272, 0);
    frameGroup.add(bead);
  }

  frameGroup.add(buildUnderSlats(THREE, mats.frame, 'wood'));
  frameGroup.add(hbGroup);
  return frameGroup;
}

function buildVariant1Upholstered(THREE, kit, mats) {
  const frameGroup = new THREE.Group();
  frameGroup.name = 'frame';
  const hbGroup = new THREE.Group();
  hbGroup.name = 'headboard';

  // Four turned tapered wooden legs slightly splayed for cozy mid-century silhouette
  const legGeo = buildTurnedPostGeo(THREE, 0.225, 'taperLeg');
  const ferruleGeo = new THREE.CylinderGeometry(0.0172, 0.0162, 0.032, 18);
  const legPositions = [
    [-0.415, -0.905, -0.05, 0.05],
    [0.415, -0.905, 0.05, 0.05],
    [-0.415, 0.905, -0.05, -0.05],
    [0.415, 0.905, 0.05, -0.05]
  ];
  for (const [lx, lz, rz, rx] of legPositions) {
    const lg = new THREE.Group();
    lg.position.set(lx, 0, lz);
    lg.rotation.set(rx, 0, rz);
    lg.add(makeMesh(THREE, legGeo, mats.legWood, 'wood'));
    const fer = makeMesh(THREE, ferruleGeo, mats.metalAccent, 'accent');
    fer.position.y = 0.018;
    lg.add(fer);
    frameGroup.add(lg);
  }

  // Softly upholstered platform base (continuous sculpted rounded surround)
  const baseGeo = new THREE.SphereGeometry(1, 56, 28);
  const bPos = baseGeo.attributes.position;
  const bUv = baseGeo.attributes.uv;
  const bHW = 0.485, bHL = 0.968, bHH = 0.072;
  for (let i = 0; i < bPos.count; i++) {
    const sx = bPos.getX(i), sy = bPos.getY(i), sz = bPos.getZ(i);
    const x = Math.sign(sx) * Math.pow(Math.abs(sx), 0.20) * bHW;
    const z = Math.sign(sz) * Math.pow(Math.abs(sz), 0.20) * bHL;
    const y = 0.275 + Math.sign(sy) * Math.pow(Math.abs(sy), 0.24) * bHH;
    bPos.setXYZ(i, x, y, z);
    bUv.setXY(i, (x + z) * 1.4, y * 2.5);
  }
  baseGeo.computeVertexNormals();
  frameGroup.add(makeMesh(THREE, baseGeo, mats.upholstery, 'wood'));

  // Sculpted continuous tufted headboard with soft arched crest & carved diamond dimples
  const hbHW = 0.495;
  const hbBotY = 0.30;
  const hbTopY = 1.075;
  const hbHH = (hbTopY - hbBotY) * 0.5;
  const hbYC = (hbBotY + hbTopY) * 0.5;
  const hbHD = 0.052;
  const hbZC = -0.946;

  // 7 staggered buttons (4 upper row, 3 lower row)
  const buttons = [
    [-0.31, 0.87], [-0.105, 0.89], [0.105, 0.89], [0.31, 0.87],
    [-0.21, 0.68], [0.0, 0.69], [0.21, 0.68]
  ];

  const hbGeo = new THREE.SphereGeometry(1, 76, 48);
  const hPos = hbGeo.attributes.position;
  const hUv = hbGeo.attributes.uv;

  for (let i = 0; i < hPos.count; i++) {
    const sx = hPos.getX(i);
    const sy = hPos.getY(i);
    const sz = hPos.getZ(i);

    const ux = Math.sign(sx) * Math.pow(Math.abs(sx), 0.30);
    const uy = Math.sign(sy) * Math.pow(Math.abs(sy), 0.32);
    const uz = Math.sign(sz) * Math.pow(Math.abs(sz), 0.42);

    const x = ux * hbHW;
    // Graceful soft camelback/arched top silhouette
    const archLift = uy > 0 ? 0.062 * Math.pow(1 - ux * ux, 1.4) * uy : 0;
    const y = hbYC + uy * hbHH + archLift;
    let zOff = uz * hbHD;

    // Front face button-tufting dimples, star pleats, and diamond cushion puff
    if (sz > 0.05) {
      const frontMask = smoothstep(0.08, 0.48, sz);
      let dimple = 0;
      let pleat = 0;
      let nearestD = 99;
      for (let b = 0; b < buttons.length; b++) {
        const dx = x - buttons[b][0];
        const dy = y - buttons[b][1];
        const d = Math.hypot(dx, dy);
        if (d < nearestD) nearestD = d;
        // Deep smooth button pull-in
        dimple += -0.036 * Math.exp(-(d * d) / (0.048 * 0.048));
        // Radiating X-shaped diamond tufting creases
        const ang = Math.atan2(dy, dx);
        const crease = Math.cos(4 * (ang - Math.PI * 0.25));
        pleat += -0.0065 * crease * Math.exp(-Math.pow((d - 0.065) / 0.048, 2));
      }
      // Subtle cushion puff between dimples
      const puff = 0.011 * smoothstep(0.03, 0.12, nearestD) * (1 - ux * ux * 0.45);
      const subtleTex = (kit.noise(x * 6 + 1.2, y * 6 + 3.4) - 0.5) * 0.003;
      zOff += (dimple + pleat + puff + subtleTex) * frontMask;
    }

    hPos.setXYZ(i, x, y, hbZC + zOff);
    hUv.setXY(i, (x + hbHW) * 1.45, (y - hbBotY) * 1.45);
  }
  hbGeo.computeVertexNormals();
  hbGroup.add(makeMesh(THREE, hbGeo, mats.upholstery, 'wood'));

  // Sculpted fabric-covered buttons seated snugly in each dimple
  const btnPts = [
    new THREE.Vector2(0.0005, -0.004),
    new THREE.Vector2(0.0155, -0.004),
    new THREE.Vector2(0.0165, 0.002),
    new THREE.Vector2(0.0145, 0.0075),
    new THREE.Vector2(0.009, 0.0115),
    new THREE.Vector2(0.0005, 0.0128)
  ];
  const btnGeo = new THREE.LatheGeometry(btnPts, 18);
  btnGeo.rotateX(Math.PI * 0.5);
  for (const [bx, by] of buttons) {
    const btn = makeMesh(THREE, btnGeo, mats.button, 'accent');
    btn.position.set(bx, by, hbZC + hbHD - 0.032);
    hbGroup.add(btn);
  }

  // Continuous piping trim around headboard perimeter contour
  const hbPipePts = [];
  const nHbP = 64;
  for (let i = 0; i < nHbP; i++) {
    const a = (i / nHbP) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ux = Math.sign(ca) * Math.pow(Math.abs(ca), 0.30);
    const uy = Math.sign(sa) * Math.pow(Math.abs(sa), 0.32);
    const x = ux * (hbHW + 0.002);
    const archLift = uy > 0 ? 0.062 * Math.pow(1 - ux * ux, 1.4) * uy : 0;
    const y = hbYC + uy * (hbHH + 0.002) + archLift;
    hbPipePts.push(new THREE.Vector3(x, y, hbZC + 0.016));
  }
  const hbPipeGeo = buildTaperedTube(THREE, hbPipePts, () => 0.0078, 84, 8, true);
  hbGroup.add(makeMesh(THREE, hbPipeGeo, mats.upholsteryTrim, 'wood'));

  frameGroup.add(hbGroup);
  return frameGroup;
}

function buildVariant2Metal(THREE, mats) {
  const frameGroup = new THREE.Group();
  frameGroup.name = 'frame';
  const hbGroup = new THREE.Group();
  hbGroup.name = 'headboard';

  const postX = 0.472;
  const headZ = -0.962;
  const footZ = 0.962;

  // Four vintage tubular metal posts with turned collars & ball finials
  const headPostGeo = buildTurnedPostGeo(THREE, 1.12, 'metalPost');
  const footPostGeo = buildTurnedPostGeo(THREE, 0.66, 'metalPost');
  for (const sx of [-1, 1]) {
    const hp = makeMesh(THREE, headPostGeo, mats.frame, 'wood');
    hp.position.set(sx * postX, 0, headZ);
    hbGroup.add(hp);

    const fp = makeMesh(THREE, footPostGeo, mats.frame, 'wood');
    fp.position.set(sx * postX, 0, footZ);
    frameGroup.add(fp);
  }

  // Helper for graceful arched tubular rails
  const makeArchPts = (z, yEdge, yPeak, halfSpan) => [
    new THREE.Vector3(-halfSpan, yEdge, z),
    new THREE.Vector3(-halfSpan * 0.68, yEdge + (yPeak - yEdge) * 0.52, z),
    new THREE.Vector3(-halfSpan * 0.28, yEdge + (yPeak - yEdge) * 0.92, z),
    new THREE.Vector3(0, yPeak, z),
    new THREE.Vector3(halfSpan * 0.28, yEdge + (yPeak - yEdge) * 0.92, z),
    new THREE.Vector3(halfSpan * 0.68, yEdge + (yPeak - yEdge) * 0.52, z),
    new THREE.Vector3(halfSpan, yEdge, z)
  ];

  // Headboard upper & secondary sweeping arches
  const hbArchTop = buildTaperedTube(THREE, makeArchPts(headZ, 0.94, 1.12, postX), () => 0.013, 44, 10, false);
  const hbArchMid = buildTaperedTube(THREE, makeArchPts(headZ, 0.81, 0.96, postX), () => 0.0095, 40, 8, false);
  hbGroup.add(makeMesh(THREE, hbArchTop, mats.frame, 'wood'));
  hbGroup.add(makeMesh(THREE, hbArchMid, mats.frame, 'wood'));

  // Headboard lower horizontal crossbars
  const barGeo = buildTaperedTube(
    THREE,
    [new THREE.Vector3(-postX, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(postX, 0, 0)],
    () => 0.011,
    16,
    8,
    false
  );
  const hbLowBar = makeMesh(THREE, barGeo, mats.frame, 'wood');
  hbLowBar.position.set(0, 0.36, headZ);
  hbGroup.add(hbLowBar);

  // Turned ornamental collar bead for vertical metal rods
  const beadPts = [
    new THREE.Vector2(0.007, -0.014),
    new THREE.Vector2(0.0125, -0.006),
    new THREE.Vector2(0.014, 0),
    new THREE.Vector2(0.0125, 0.006),
    new THREE.Vector2(0.007, 0.014)
  ];
  const collarGeo = new THREE.LatheGeometry(beadPts, 14);

  // Vertical slender rods + graceful decorative S-scroll ironwork in headboard
  const rodXs = [-0.36, -0.24, -0.12, 0.0, 0.12, 0.24, 0.36];
  for (const rx of rodXs) {
    const t = rx / postX;
    const archY = 0.81 + (0.96 - 0.81) * (1 - t * t);
    const rodGeo = buildTaperedTube(
      THREE,
      [new THREE.Vector3(rx, 0.36, headZ), new THREE.Vector3(rx, (0.36 + archY) * 0.5, headZ), new THREE.Vector3(rx, archY, headZ)],
      () => 0.0065,
      10,
      7,
      false
    );
    hbGroup.add(makeMesh(THREE, rodGeo, mats.frame, 'wood'));

    const collar = makeMesh(THREE, collarGeo, mats.metalAccent, 'accent');
    collar.position.set(rx, (0.36 + archY) * 0.5 + 0.05, headZ);
    hbGroup.add(collar);
  }

  // Sweeping symmetrical heart/S-scroll curls nestled between the two headboard arches
  for (const sx of [-1, 1]) {
    const scrollPts = [
      new THREE.Vector3(sx * 0.02, 0.965, headZ),
      new THREE.Vector3(sx * 0.07, 1.075, headZ),
      new THREE.Vector3(sx * 0.16, 1.085, headZ),
      new THREE.Vector3(sx * 0.22, 1.015, headZ),
      new THREE.Vector3(sx * 0.19, 0.945, headZ),
      new THREE.Vector3(sx * 0.27, 0.915, headZ),
      new THREE.Vector3(sx * 0.36, 0.975, headZ),
      new THREE.Vector3(sx * 0.42, 0.945, headZ),
      new THREE.Vector3(sx * 0.38, 0.875, headZ)
    ];
    const scrollGeo = buildTaperedTube(
      THREE,
      scrollPts,
      (t) => 0.0068 * (0.85 + 0.25 * Math.sin(t * Math.PI)),
      36,
      7,
      false
    );
    hbGroup.add(makeMesh(THREE, scrollGeo, mats.frame, 'wood'));
  }

  // Footboard sweeping arch + vertical spindles + center scroll
  const fbArchTop = buildTaperedTube(THREE, makeArchPts(footZ, 0.52, 0.64, postX), () => 0.0125, 40, 10, false);
  frameGroup.add(makeMesh(THREE, fbArchTop, mats.frame, 'wood'));

  const fbLowBar = makeMesh(THREE, barGeo, mats.frame, 'wood');
  fbLowBar.position.set(0, 0.26, footZ);
  frameGroup.add(fbLowBar);

  for (const rx of rodXs) {
    const t = rx / postX;
    const archY = 0.52 + (0.64 - 0.52) * (1 - t * t);
    const rodGeo = buildTaperedTube(
      THREE,
      [new THREE.Vector3(rx, 0.26, footZ), new THREE.Vector3(rx, (0.26 + archY) * 0.5, footZ), new THREE.Vector3(rx, archY, footZ)],
      () => 0.0062,
      8,
      7,
      false
    );
    frameGroup.add(makeMesh(THREE, rodGeo, mats.frame, 'wood'));

    const collar = makeMesh(THREE, collarGeo, mats.metalAccent, 'accent');
    collar.position.set(rx, (0.26 + archY) * 0.5, footZ);
    frameGroup.add(collar);
  }

  // Metal side rails (sleek tubular double rails)
  const sideBarGeo = buildTaperedTube(
    THREE,
    [new THREE.Vector3(0, 0, headZ), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, footZ)],
    () => 0.013,
    18,
    8,
    false
  );
  const sideSubGeo = buildTaperedTube(
    THREE,
    [new THREE.Vector3(0, 0, headZ), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, footZ)],
    () => 0.0085,
    18,
    8,
    false
  );
  for (const sx of [-1, 1]) {
    const topR = makeMesh(THREE, sideBarGeo, mats.frame, 'wood');
    topR.position.set(sx * postX, 0.285, 0);
    frameGroup.add(topR);

    const botR = makeMesh(THREE, sideSubGeo, mats.frame, 'wood');
    botR.position.set(sx * postX, 0.23, 0);
    frameGroup.add(botR);
  }

  frameGroup.add(buildUnderSlats(THREE, mats.frame, 'wood', 0.258));
  frameGroup.add(hbGroup);
  return frameGroup;
}

// ---------------------------------------------------------------------------
// Main exported build() & idle()
// ---------------------------------------------------------------------------
export function build(THREE, opts = {}, kit) {
  const variant = clamp(Math.round(opts?.variant ?? 0), 0, 2);
  const defaultMat = variant === 2 ? 'metal' : variant === 1 ? 'fabric' : 'wood';
  const matMode = opts?.material ?? defaultMat;

  const palette = {
    primary: opts?.primary ?? '#6d8fa6',     // cozy muted slate-blue duvet
    secondary: opts?.secondary ?? '#f5efe6', // warm cream sheets & large pillow
    accent: opts?.accent ?? '#c97b5d',       // terracotta knitted throw & accent pillow
    wood: opts?.wood ?? (variant === 2 && !opts?.wood ? '#4b4e54' : '#a6764c')
  };

  // Build procedural textures
  const duvetTex = makeFabricTextures(THREE, kit, palette.primary, 'duvet');
  const sheetTex = makeFabricTextures(THREE, kit, palette.secondary, 'sheet');
  const mattressTex = makeFabricTextures(THREE, kit, palette.secondary, 'mattress');
  const accentPillowTex = makeFabricTextures(THREE, kit, palette.accent, 'upholstery');
  const knitTex = makeKnitTextures(THREE, kit, palette.accent, palette.secondary);

  // Frame material responds to opts.material ('wood' | 'painted' | 'metal' | 'fabric')
  let frameMat;
  if (matMode === 'metal') {
    const mTex = makeMetalTextures(THREE, kit, palette.wood);
    frameMat = new THREE.MeshPhysicalMaterial({
      map: mTex.map,
      bumpMap: mTex.bumpMap,
      bumpScale: 0.0025,
      roughness: 0.30,
      metalness: 0.84,
      clearcoat: 0.18,
      clearcoatRoughness: 0.32
    });
  } else if (matMode === 'painted') {
    const pTex = makeWoodTextures(THREE, kit, palette.wood, true);
    frameMat = new THREE.MeshPhysicalMaterial({
      map: pTex.map,
      bumpMap: pTex.bumpMap,
      bumpScale: 0.002,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.25,
      clearcoatRoughness: 0.34
    });
  } else if (matMode === 'fabric') {
    const fTex = makeFabricTextures(THREE, kit, palette.wood, 'upholstery');
    frameMat = new THREE.MeshPhysicalMaterial({
      map: fTex.map,
      bumpMap: fTex.bumpMap,
      bumpScale: 0.006,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.72,
      sheenColor: shiftColor(THREE, palette.wood, 0.22, -0.05)
    });
  } else {
    const wTex = makeWoodTextures(THREE, kit, palette.wood, false);
    frameMat = new THREE.MeshPhysicalMaterial({
      map: wTex.map,
      bumpMap: wTex.bumpMap,
      bumpScale: 0.004,
      roughness: 0.48,
      metalness: 0.0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.42
    });
  }

  // Dedicated upholstered fabric + warm wooden legs for Variant 1
  const upholColor = shiftColor(THREE, palette.wood, 0.08, -0.06);
  const upholTex = makeFabricTextures(THREE, kit, upholColor, 'upholstery');
  const legWoodTex = makeWoodTextures(THREE, kit, shiftColor(THREE, palette.wood, -0.06, 0.04), matMode === 'painted');

  const mats = {
    frame: frameMat,
    legWood: matMode === 'metal'
      ? frameMat
      : new THREE.MeshPhysicalMaterial({
          map: legWoodTex.map,
          bumpMap: legWoodTex.bumpMap,
          bumpScale: 0.0035,
          roughness: 0.46,
          clearcoat: 0.16,
          clearcoatRoughness: 0.4
        }),
    upholstery: new THREE.MeshPhysicalMaterial({
      map: upholTex.map,
      bumpMap: upholTex.bumpMap,
      bumpScale: 0.0065,
      roughness: 0.93,
      sheen: 0.82,
      sheenRoughness: 0.68,
      sheenColor: shiftColor(THREE, upholColor, 0.22, -0.05)
    }),
    upholsteryTrim: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, upholColor, -0.08, 0.02),
      roughness: 0.9,
      sheen: 0.7,
      sheenColor: shiftColor(THREE, upholColor, 0.14, 0)
    }),
    button: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, palette.accent, -0.04, 0),
      roughness: 0.88,
      sheen: 0.75,
      sheenColor: shiftColor(THREE, palette.accent, 0.2, -0.05)
    }),
    metalAccent: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, palette.accent, 0.08, 0.05),
      roughness: 0.28,
      metalness: 0.82,
      clearcoat: 0.22
    }),
    mattress: new THREE.MeshPhysicalMaterial({
      map: mattressTex.map,
      bumpMap: mattressTex.bumpMap,
      bumpScale: 0.0055,
      roughness: 0.92,
      sheen: 0.68,
      sheenRoughness: 0.75,
      sheenColor: shiftColor(THREE, palette.secondary, 0.12, -0.04)
    }),
    piping: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, palette.accent, 0.06, -0.08),
      roughness: 0.86,
      sheen: 0.65,
      sheenColor: shiftColor(THREE, palette.accent, 0.24, -0.1)
    }),
    duvet: new THREE.MeshPhysicalMaterial({
      map: duvetTex.map,
      bumpMap: duvetTex.bumpMap,
      bumpScale: 0.0045,
      roughness: 0.92,
      sheen: 0.82,
      sheenRoughness: 0.68,
      sheenColor: shiftColor(THREE, palette.primary, 0.22, -0.08)
    }),
    sheet: new THREE.MeshPhysicalMaterial({
      map: sheetTex.map,
      bumpMap: sheetTex.bumpMap,
      bumpScale: 0.003,
      roughness: 0.89,
      sheen: 0.72,
      sheenRoughness: 0.74,
      sheenColor: shiftColor(THREE, palette.secondary, 0.1, -0.04)
    }),
    accentPillow: new THREE.MeshPhysicalMaterial({
      map: accentPillowTex.map,
      bumpMap: accentPillowTex.bumpMap,
      bumpScale: 0.006,
      roughness: 0.93,
      sheen: 0.85,
      sheenRoughness: 0.65,
      sheenColor: shiftColor(THREE, palette.accent, 0.22, -0.08)
    }),
    knit: new THREE.MeshPhysicalMaterial({
      map: knitTex.map,
      bumpMap: knitTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.96,
      sheen: 0.92,
      sheenRoughness: 0.62,
      sheenColor: shiftColor(THREE, palette.accent, 0.25, -0.1)
    }),
    tassel: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, palette.accent, -0.04, 0.02),
      roughness: 0.96,
      sheen: 0.85,
      sheenColor: shiftColor(THREE, palette.accent, 0.2, -0.05)
    })
  };

  const root = new THREE.Group();
  root.name = 'dorm_single_bed';

  // Build selected frame variant
  let frame;
  if (variant === 1) frame = buildVariant1Upholstered(THREE, kit, mats);
  else if (variant === 2) frame = buildVariant2Metal(THREE, mats);
  else frame = buildVariant0Slatted(THREE, mats);
  root.add(frame);

  // Build sculpted piped mattress
  const mattressInfo = buildMattress(THREE, kit, mats, opts, variant);
  root.add(mattressInfo.group);

  // Build duvet with soft folded cuff, two asymmetric pillows, and knitted throw
  const { duvetGroup, pillowsGroup, throwGroup, swayNodes } = buildBedding(
    THREE,
    kit,
    mats,
    mattressInfo,
    variant
  );
  root.add(duvetGroup);
  root.add(pillowsGroup);
  root.add(throwGroup);

  root.userData._swayNodes = swayNodes;
  return root;
}

export function idle(group, t) {
  // Subtle cozy ambient draft gently swaying the hanging yarn tassels of the knitted throw
  const nodes = group?.userData?._swayNodes;
  if (!nodes || !nodes.length) return;
  for (let i = 0; i < nodes.length; i++) {
    const item = nodes[i];
    const gust = Math.sin(t * 1.15 + item.phase) * 0.022 + Math.sin(t * 2.4 + item.phase * 1.7) * 0.008;
    item.node.rotation.z = item.baseRotZ + gust;
    item.node.rotation.x = item.baseRotX + Math.cos(t * 0.95 + item.phase) * 0.012;
  }
}