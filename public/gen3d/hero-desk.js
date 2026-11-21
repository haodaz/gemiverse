export const META = {
  id: 'cozy_study_desk',
  name: 'Cozy Dorm Study Desk',
  kind: 'furniture',
  footprint: [1.2, 0.6],
  variants: ['Classic Two-Drawer', 'Trestle Legs', 'Standing Metal Frame'],
  note: 'Stylised 1.2m x 0.6m x 0.75m study desk with painted wood grain, drawers with sculpted handles, cable grommet, closed laptop, ceramic pen cup with stationery, and hardcover book stack.'
};

function col(THREE, input, fallback) {
  try {
    return new THREE.Color(input !== undefined && input !== null ? input : fallback);
  } catch (e) {
    return new THREE.Color(fallback);
  }
}

function rgbCss(c, alpha) {
  const r = Math.round(Math.min(1, Math.max(0, c.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c.b)) * 255);
  return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function mixCol(THREE, a, b, t) {
  return a.clone().lerp(b, t);
}

function shadeCol(c, dH, dS, dL) {
  const out = c.clone();
  out.offsetHSL(dH, dS, dL);
  return out;
}

function setSRGB(THREE, tex) {
  if (tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}

function sampleNoise(kit, x, y) {
  if (kit && typeof kit.noise === 'function') return kit.noise(x, y);
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function fbm(kit, x, y, octaves = 3) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += sampleNoise(kit, x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return val / norm;
}

function applyBoxUVs(THREE, geo, sx = 1, sy = 1, sz = 1, ou = 0, ov = 0) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) {
      u = x * sx + ou;
      v = z * sz + ov;
    } else if (nz >= nx && nz >= ny) {
      u = x * sx + ou;
      v = y * sy + ov;
    } else {
      u = z * sz + ou;
      v = y * sy + ov;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function roundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw * 0.9, hh * 0.9);
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

function makeBeveledSlab(THREE, w, d, t, cornerR, bevel = 0.005, curveSegs = 16, bevelSegs = 5, holeSpec = null) {
  const b = Math.min(bevel, t * 0.35, cornerR * 0.45);
  const innerW = Math.max(0.002, w - 2 * b);
  const innerD = Math.max(0.002, d - 2 * b);
  const innerR = Math.max(0.001, cornerR - b);
  const depth = Math.max(0.001, t - 2 * b);
  const shape = roundedRectShape(THREE, innerW, innerD, innerR);

  if (holeSpec) {
    const hole = new THREE.Path();
    hole.absarc(holeSpec.x, -holeSpec.z, holeSpec.r + b, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: bevelSegs,
    curveSegments: curveSegs
  });
  geo.translate(0, 0, b);
  geo.rotateX(-Math.PI * 0.5);
  return geo;
}

function makeBeveledFrontBlock(THREE, w, h, depth, cornerR, bevel = 0.003, bevelSegs = 4) {
  const b = Math.min(bevel, depth * 0.35, cornerR * 0.45);
  const shape = roundedRectShape(THREE, Math.max(0.002, w - 2 * b), Math.max(0.002, h - 2 * b), Math.max(0.001, cornerR - b));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: bevelSegs,
    curveSegments: 14
  });
  geo.translate(0, 0, -depth * 0.5 + b);
  return geo;
}

function taperedTube(THREE, points, radiusFn, tubularSegs = 36, radialSegs = 14, capEnds = true) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    pts.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  const normals = [];
  const binormals = [];
  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(t0, ref).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, t0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    q.setFromUnitVectors(tangents[i - 1], tangents[i]);
    const ni = normals[i - 1].clone().applyQuaternion(q).normalize();
    const bi = new THREE.Vector3().crossVectors(tangents[i], ni).normalize();
    ni.crossVectors(bi, tangents[i]).normalize();
    normals.push(ni);
    binormals.push(bi);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegs + 1;

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const r = Math.max(0.0002, radiusFn(u));
    const p = pts[i];
    const N = normals[i];
    const B = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const th = v * Math.PI * 2;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      positions.push(
        p.x + r * (cs * N.x + sn * B.x),
        p.y + r * (cs * N.y + sn * B.y),
        p.z + r * (cs * N.z + sn * B.z)
      );
      uvs.push(u, v);
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

  if (capEnds) {
    const startIdx = positions.length / 3;
    const pStart = pts[0];
    positions.push(pStart.x, pStart.y, pStart.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startIdx, j + 1, j);
    }

    const endIdx = positions.length / 3;
    const pEnd = pts[tubularSegs];
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(1, 0.5);
    const base = tubularSegs * ringStride;
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

function makeWoodTextures(THREE, kit, woodCol, seed = 0) {
  const light = shadeCol(woodCol, 0.008, -0.04, 0.08);
  const dark = shadeCol(woodCol, -0.01, 0.06, -0.14);
  const pore = shadeCol(woodCol, -0.015, 0.04, -0.24);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(woodCol);
    ctx.fillRect(0, 0, w, h);

    // Soft horizontal plank tonal bands
    const planks = 4;
    for (let p = 0; p < planks; p++) {
      const y0 = (p / planks) * h;
      const ph = h / planks;
      const nShift = sampleNoise(kit, p * 3.1 + seed, 1.7 + seed);
      const bandCol = mixCol(THREE, light, dark, 0.3 + nShift * 0.4);
      const grad = ctx.createLinearGradient(0, y0, 0, y0 + ph);
      grad.addColorStop(0, rgbCss(shadeCol(bandCol, 0, 0, -0.025), 0.7));
      grad.addColorStop(0.5, rgbCss(bandCol, 0.55));
      grad.addColorStop(1, rgbCss(shadeCol(bandCol, 0, 0, -0.03), 0.7));
      ctx.fillStyle = grad;
      ctx.fillRect(0, y0, w, ph);
    }

    // Organic wood grain rings running along X
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      const plankIdx = Math.floor(ny * planks);
      const plankOff = plankIdx * 17.3 + seed * 9.1;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const warp = fbm(kit, nx * 2.2 + plankOff, ny * 6.5 + seed, 3);
        const fine = sampleNoise(kit, nx * 28.0 + seed, ny * 110.0 + plankOff);
        const ringCoord = ny * 26.0 + warp * 5.2 + Math.sin(nx * Math.PI * 2 + plankOff) * 0.6;
        const ring = 0.5 + 0.5 * Math.sin(ringCoord * Math.PI * 2);
        const ringSharp = Math.pow(ring, 2.6);

        // Occasional gentle wood knot swirl
        const kx = (nx - (0.28 + 0.19 * plankIdx) % 1);
        const ky = (ny - (plankIdx + 0.5) / planks) * 4.5;
        const kd = Math.sqrt(kx * kx + ky * ky);
        const knot = Math.exp(-kd * kd * 42) * 0.32;

        const blend = Math.min(1, ringSharp * 0.52 + (1 - fine) * 0.14 + knot);
        const idx = (y * w + x) * 4;
        const dr = (dark.r - light.r) * 255;
        const dg = (dark.g - light.g) * 255;
        const db = (dark.b - light.b) * 255;

        data[idx] = Math.min(255, Math.max(0, data[idx] * 0.62 + (light.r * 255 + dr * blend) * 0.38 - (fine < 0.12 ? 14 : 0)));
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] * 0.62 + (light.g * 255 + dg * blend) * 0.38 - (fine < 0.12 ? 12 : 0)));
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] * 0.62 + (light.b * 255 + db * blend) * 0.38 - (fine < 0.12 ? 10 : 0)));
      }
    }
    ctx.putImageData(img, 0, 0);

    // Subtle fine longitudinal fiber strokes and subtle plank seams
    ctx.lineWidth = 1;
    for (let i = 0; i < 160; i++) {
      const yy = sampleNoise(kit, i * 1.9 + seed, 5.2) * h;
      const x0 = sampleNoise(kit, i * 3.7, 9.1 + seed) * w;
      const len = 30 + sampleNoise(kit, i * 2.3, 1.4) * 120;
      ctx.strokeStyle = rgbCss(pore, 0.14);
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 + len, yy + (sampleNoise(kit, i, 2) - 0.5) * 3);
      ctx.stroke();
    }
    for (let p = 1; p < planks; p++) {
      const yy = Math.round((p / planks) * h);
      ctx.strokeStyle = rgbCss(pore, 0.22);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
  });
  setSRGB(THREE, map);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const warp = fbm(kit, nx * 2.2 + seed, ny * 6.5 + seed, 2);
        const ring = 0.5 + 0.5 * Math.sin((ny * 26.0 + warp * 5.0) * Math.PI * 2);
        const poreVal = sampleNoise(kit, nx * 24 + seed, ny * 96);
        const v = Math.round((0.55 + ring * 0.25 + (poreVal > 0.15 ? 0.15 : -0.25)) * 255);
        const idx = (y * w + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = Math.min(255, Math.max(0, v));
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeMetalTextures(THREE, kit, metalCol, brushed = true) {
  const lighter = shadeCol(metalCol, 0, -0.02, 0.06);
  const darker = shadeCol(metalCol, 0, 0.02, -0.07);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(metalCol);
    ctx.fillRect(0, 0, w, h);
    if (brushed) {
      for (let y = 0; y < h; y++) {
        const n = sampleNoise(kit, 2.3, y * 0.35);
        ctx.fillStyle = rgbCss(mixCol(THREE, darker, lighter, n), 0.32);
        ctx.fillRect(0, y, w, 1);
      }
      for (let i = 0; i < 180; i++) {
        const y = sampleNoise(kit, i * 1.7, 3.1) * h;
        ctx.strokeStyle = rgbCss(lighter, 0.12);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 1200; i++) {
        const x = sampleNoise(kit, i * 1.3, 4.1) * w;
        const y = sampleNoise(kit, i * 2.9, 8.7) * h;
        const c = i % 2 === 0 ? lighter : darker;
        ctx.fillStyle = rgbCss(c, 0.16);
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  setSRGB(THREE, map);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = Math.round(115 + sampleNoise(kit, 4.2, y * (brushed ? 0.55 : 0.25)) * 28);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeLaptopLidTexture(THREE, kit, baseCol, accentCol) {
  const light = shadeCol(baseCol, 0, -0.02, 0.08);
  const dark = shadeCol(baseCol, 0, 0.01, -0.07);

  const map = kit.canvasTexture(512, 384, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, rgbCss(light));
    grad.addColorStop(0.55, rgbCss(baseCol));
    grad.addColorStop(1, rgbCss(dark));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal brushed sheen
    for (let y = 0; y < h; y += 2) {
      const n = sampleNoise(kit, 1.3, y * 0.28);
      ctx.fillStyle = rgbCss(mixCol(THREE, dark, light, n), 0.16);
      ctx.fillRect(0, y, w, 1);
    }

    // Minimalist centered embossed emblem (stylised cozy leaf / crescent)
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.fillStyle = rgbCss(shadeCol(baseCol, 0, 0, 0.24), 0.72);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0.25, Math.PI * 1.85);
    ctx.arc(8, -4, 17, Math.PI * 1.75, 0.35, true);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -14, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Small tasteful dorm sticker in upper-left corner
    ctx.save();
    ctx.translate(w * 0.22, h * 0.27);
    ctx.rotate(-0.22);
    ctx.fillStyle = '#faf5ea';
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgbCss(accentCol);
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#faf5ea';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI * 0.5;
      const r = i % 2 === 0 ? 11 : 5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  setSRGB(THREE, map);
  return map;
}

function makeCeramicTextures(THREE, kit, glazeCol) {
  const clay = new THREE.Color('#efe7d8');
  const claySpeck = new THREE.Color('#9c866e');
  const glazeLight = shadeCol(glazeCol, 0.005, -0.04, 0.08);
  const glazeDark = shadeCol(glazeCol, -0.01, 0.05, -0.08);

  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    // Three.js LatheGeometry maps v=0 at first point (outer bottom) to v=1 at last point (inner bottom)
    // Outer wall spans roughly v in [0.08, 0.52], rim around 0.55, inner wall [0.58, 0.92]
    ctx.fillStyle = rgbCss(clay);
    ctx.fillRect(0, 0, w, h);

    // Subtle warm clay horizontal banding
    for (let y = 0; y < h; y++) {
      const n = sampleNoise(kit, 4.1, y * 0.18);
      ctx.fillStyle = rgbCss(shadeCol(clay, 0, 0, (n - 0.5) * 0.04), 0.5);
      ctx.fillRect(0, y, w, 1);
    }

    // Dipped glaze band covering lower-to-mid outer cup (canvas y corresponds to 1 - v)
    // v from 0.0 to 0.34 -> canvas y from h*(1-0.34) to h
    const dipBaseY = h * 0.66;
    const grad = ctx.createLinearGradient(0, dipBaseY - 12, 0, h);
    grad.addColorStop(0, rgbCss(glazeLight));
    grad.addColorStop(0.55, rgbCss(glazeCol));
    grad.addColorStop(1, rgbCss(glazeDark));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const wave = Math.sin((x / w) * Math.PI * 6) * 4.5 + (sampleNoise(kit, x * 0.04, 2.7) - 0.5) * 7;
      ctx.lineTo(x, dipBaseY + wave);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle glossy rim accent band around v ~ 0.54 (canvas y ~ 0.46*h)
    ctx.fillStyle = rgbCss(glazeLight, 0.55);
    ctx.fillRect(0, h * 0.43, w, h * 0.06);

    // Stoneware mineral speckles
    for (let i = 0; i < 650; i++) {
      const x = sampleNoise(kit, i * 1.71, 3.3) * w;
      const y = sampleNoise(kit, i * 2.93, 7.1) * h;
      const r = 0.6 + sampleNoise(kit, i * 4.1, 1.2) * 1.4;
      ctx.fillStyle = rgbCss(claySpeck, 0.25 + sampleNoise(kit, i, 5.5) * 0.25);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  setSRGB(THREE, map);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const ring = Math.sin(y * 0.55) * 10 + (sampleNoise(kit, 2.2, y * 0.2) - 0.5) * 14;
      const v = Math.round(128 + ring);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  });

  return { map, bump };
}

function makeBookCoverTextures(THREE, kit, coverCol, foilCol, seed = 0) {
  const lighter = shadeCol(coverCol, 0, -0.04, 0.06);
  const darker = shadeCol(coverCol, 0, 0.04, -0.09);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(coverCol);
    ctx.fillRect(0, 0, w, h);

    // Fine linen cloth weave
    for (let y = 0; y < h; y += 2) {
      const n = sampleNoise(kit, seed + 1.5, y * 0.35);
      ctx.fillStyle = rgbCss(mixCol(THREE, darker, lighter, n), 0.24);
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      const n = sampleNoise(kit, x * 0.35, seed + 4.2);
      ctx.fillStyle = rgbCss(mixCol(THREE, darker, lighter, n), 0.18);
      ctx.fillRect(x, 0, 1, h);
    }

    // Subtle decorative foil stripes across the grain
    ctx.fillStyle = rgbCss(foilCol, 0.72);
    ctx.fillRect(0, h * 0.16, w, 4);
    ctx.fillRect(0, h * 0.82, w, 4);
    ctx.fillStyle = rgbCss(foilCol, 0.35);
    ctx.fillRect(0, h * 0.19, w, 2);
    ctx.fillRect(0, h * 0.79, w, 2);
  });
  setSRGB(THREE, map);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = '#929292';
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      ctx.fillStyle = 'rgba(105,105,105,0.5)';
      ctx.fillRect(x, 0, 1, h);
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makePageEdgesTextures(THREE, kit) {
  const paper = new THREE.Color('#f4ebd9');
  const shadow = new THREE.Color('#cfc0a5');

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(paper);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const n = sampleNoise(kit, 2.7, y * 0.65);
      const line = (y % 3 === 0 ? 0.45 : 0.12) + n * 0.35;
      ctx.fillStyle = rgbCss(mixCol(THREE, paper, shadow, line * 0.72));
      ctx.fillRect(0, y, w, 1);
    }
    // Slight warm occlusion near top and bottom cover junctions
    const gTop = ctx.createLinearGradient(0, 0, 0, h * 0.14);
    gTop.addColorStop(0, 'rgba(110,92,68,0.28)');
    gTop.addColorStop(1, 'rgba(110,92,68,0)');
    ctx.fillStyle = gTop;
    ctx.fillRect(0, 0, w, h * 0.14);

    const gBot = ctx.createLinearGradient(0, h * 0.86, 0, h);
    gBot.addColorStop(0, 'rgba(110,92,68,0)');
    gBot.addColorStop(1, 'rgba(110,92,68,0.28)');
    ctx.fillStyle = gBot;
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  });
  setSRGB(THREE, map);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = Math.round(90 + (y % 3 === 0 ? 0 : 50) + sampleNoise(kit, 1.1, y * 0.7) * 55);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeRulerTexture(THREE, kit, woodCol) {
  const lightWood = shadeCol(woodCol, 0.01, -0.05, 0.18);
  const tickCol = new THREE.Color('#3b2d22');
  const map = kit.canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(lightWood);
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const n = sampleNoise(kit, x * 0.2, 3.1);
      ctx.fillStyle = rgbCss(shadeCol(lightWood, 0, 0, (n - 0.5) * 0.06), 0.5);
      ctx.fillRect(x, 0, 2, h);
    }
    ctx.fillStyle = rgbCss(tickCol, 0.8);
    for (let i = 0; i <= 40; i++) {
      const y = (i / 40) * (h - 24) + 12;
      const len = i % 5 === 0 ? w * 0.42 : w * 0.24;
      const thick = i % 5 === 0 ? 3 : 1.5;
      ctx.fillRect(0, y, len, thick);
    }
  });
  setSRGB(THREE, map);
  return map;
}

function makeSculptedHandle(THREE, width, depth, mat, brassMat) {
  const g = new THREE.Group();
  const hw = width * 0.5;
  const pts = [
    new THREE.Vector3(-hw, 0, 0),
    new THREE.Vector3(-hw * 0.94, 0, depth * 0.72),
    new THREE.Vector3(-hw * 0.48, 0, depth),
    new THREE.Vector3(0, 0, depth * 1.04),
    new THREE.Vector3(hw * 0.48, 0, depth),
    new THREE.Vector3(hw * 0.94, 0, depth * 0.72),
    new THREE.Vector3(hw, 0, 0)
  ];
  const barGeo = taperedTube(
    THREE,
    pts,
    (t) => {
      const edge = Math.min(t, 1 - t);
      const flare = edge < 0.14 ? 0.0046 + (0.14 - edge) * 0.012 : 0.0046;
      const centerSwell = Math.sin(t * Math.PI) * 0.0012;
      return flare + centerSwell;
    },
    32,
    12,
    true
  );
  const bar = new THREE.Mesh(barGeo, mat);
  bar.castShadow = true;
  bar.receiveShadow = true;
  g.add(bar);

  // Turned circular escutcheon rosettes where the handle mounts to the drawer
  const rosPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.0085, 0),
    new THREE.Vector2(0.0088, 0.0018),
    new THREE.Vector2(0.0074, 0.0036),
    new THREE.Vector2(0.0056, 0.0052),
    new THREE.Vector2(0.0048, 0.006)
  ];
  const rosGeo = new THREE.LatheGeometry(rosPts, 18);
  rosGeo.rotateX(Math.PI * 0.5);
  for (const sx of [-hw, hw]) {
    const ros = new THREE.Mesh(rosGeo, brassMat || mat);
    ros.position.set(sx, 0, 0);
    ros.castShadow = true;
    ros.receiveShadow = true;
    g.add(ros);
  }
  return g;
}

function buildDrawersSection(THREE, opts, cfg) {
  const {
    width,
    depth,
    height,
    yTop,
    frontZ,
    woodMat,
    woodDrawerMat,
    darkWoodMat,
    handleMat,
    rosetteMat,
    includeBackAndSides = true
  } = cfg;

  const group = new THREE.Group();
  group.name = 'drawers';

  const wallT = 0.018;
  const yCenter = yTop - height * 0.5;
  const zCenter = frontZ - depth * 0.5;

  if (includeBackAndSides) {
    // Left, right, back, bottom casing panels with softly beveled edges
    const sideGeo = applyBoxUVs(THREE, makeBeveledFrontBlock(THREE, wallT, height, depth, 0.004, 0.002), 1.4, 1.4, 1.4, 0.2, 0.1);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(sideGeo, woodMat);
      side.position.set(sx * (width * 0.5 - wallT * 0.5), yCenter, zCenter);
      side.castShadow = true;
      side.receiveShadow = true;
      group.add(side);
    }

    const backGeo = applyBoxUVs(THREE, makeBeveledFrontBlock(THREE, width - wallT * 1.6, height, wallT, 0.004, 0.002), 1.0, 1.4, 1.4, 0.3, 0.2);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, yCenter, frontZ - depth + wallT * 0.5);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    const botGeo = applyBoxUVs(THREE, makeBeveledSlab(THREE, width - wallT * 1.4, depth - wallT, wallT * 0.85, 0.006, 0.002), 1.0, 1.0, 1.4, 0.1, 0.4);
    const bot = new THREE.Mesh(botGeo, darkWoodMat);
    bot.position.set(0, yTop - height, zCenter - 0.004);
    bot.castShadow = true;
    bot.receiveShadow = true;
    group.add(bot);
  }

  // Center divider stile
  const divGeo = applyBoxUVs(THREE, makeBeveledFrontBlock(THREE, 0.016, height - 0.012, depth * 0.85, 0.003, 0.002), 1.4, 1.4, 1.4);
  const divider = new THREE.Mesh(divGeo, darkWoodMat);
  divider.position.set(0, yCenter, zCenter);
  divider.castShadow = true;
  divider.receiveShadow = true;
  group.add(divider);

  // Two side-by-side drawers (right one subtly ajar 7mm for cozy lived-in realism)
  const innerSpan = width - wallT * 2 - 0.022;
  const drawerW = innerSpan * 0.5 - 0.004;
  const drawerH = height - 0.018;
  const frontT = 0.018;
  const handleW = Math.min(0.115, drawerW * 0.34);

  const frontGeoL = applyBoxUVs(THREE, makeBeveledFrontBlock(THREE, drawerW, drawerH, frontT, 0.007, 0.0035, 5), 1.35, 1.6, 1.4, 0.05, 0.15);
  const frontGeoR = applyBoxUVs(THREE, makeBeveledFrontBlock(THREE, drawerW, drawerH, frontT, 0.007, 0.0035, 5), 1.35, 1.6, 1.4, 0.48, 0.62);

  for (let i = 0; i < 2; i++) {
    const dGroup = new THREE.Group();
    dGroup.name = i === 0 ? 'drawerL' : 'drawerR';
    const sx = i === 0 ? -(drawerW * 0.5 + 0.011) : (drawerW * 0.5 + 0.011);
    const pullOut = i === 1 ? 0.008 : 0.0;

    const frontMesh = new THREE.Mesh(i === 0 ? frontGeoL : frontGeoR, woodDrawerMat);
    frontMesh.position.set(0, 0, frontT * 0.5);
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    dGroup.add(frontMesh);

    // Inner wooden drawer box visible on the slightly pulled drawer
    const boxD = Math.min(0.28, depth - 0.05);
    const boxH = drawerH - 0.014;
    const boxSideGeo = makeBeveledFrontBlock(THREE, 0.011, boxH, boxD, 0.002, 0.001);
    for (const bsx of [-1, 1]) {
      const bSide = new THREE.Mesh(boxSideGeo, darkWoodMat);
      bSide.position.set(bsx * (drawerW * 0.5 - 0.014), -0.003, -boxD * 0.5);
      bSide.castShadow = true;
      bSide.receiveShadow = true;
      dGroup.add(bSide);
    }

    const handle = makeSculptedHandle(THREE, handleW, 0.024, handleMat, rosetteMat);
    handle.position.set(0, 0.002, frontT - 0.001);
    dGroup.add(handle);

    dGroup.position.set(sx, yCenter, frontZ - frontT * 0.7 + pullOut);
    group.add(dGroup);
  }

  return group;
}

function buildClassicFrame(THREE, woodMat, darkWoodMat, brassMat, padMat, yDeskBottom) {
  const frame = new THREE.Group();
  frame.name = 'frame';

  const legH = yDeskBottom - 0.004;
  // Turned mid-century tapered leg profile (20 points)
  const legProfile = [];
  const segs = 20;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * legH;
    let r;
    if (t < 0.02) {
      r = 0.0125 + t * 0.05;
    } else if (t < 0.14) {
      r = 0.0135 + (t - 0.02) * 0.015;
    } else if (t < 0.88) {
      const u = (t - 0.14) / 0.74;
      r = 0.0153 + Math.pow(u, 0.85) * 0.0095 + Math.sin(u * Math.PI) * 0.0014;
    } else {
      const u = (t - 0.88) / 0.12;
      r = 0.0248 + Math.sin(u * Math.PI * 0.5) * 0.002;
    }
    legProfile.push(new THREE.Vector2(r, y));
  }

  const ferruleH = 0.075;
  const ferruleProfile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.0132, 0),
    new THREE.Vector2(0.0138, 0.01),
    new THREE.Vector2(0.0146, ferruleH * 0.5),
    new THREE.Vector2(0.0158, ferruleH),
    new THREE.Vector2(0.0148, ferruleH + 0.002)
  ];

  const padProfile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.0122, 0),
    new THREE.Vector2(0.0128, 0.004),
    new THREE.Vector2(0.0122, 0.005)
  ];

  const corners = [
    { x: -0.49, z: 0.20, sx: -0.052, sz: 0.042 },
    { x: 0.49, z: 0.20, sx: 0.052, sz: 0.042 },
    { x: -0.49, z: -0.20, sx: -0.052, sz: -0.042 },
    { x: 0.49, z: -0.20, sx: 0.052, sz: -0.042 }
  ];

  const shearGeo = (geo, sx, sz, totalH) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const factor = Math.max(0, 1 - y / totalH);
      pos.setX(i, pos.getX(i) + factor * sx);
      pos.setZ(i, pos.getZ(i) + factor * sz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  };

  for (let i = 0; i < corners.length; i++) {
    const c = corners[i];
    const legGeo = shearGeo(new THREE.LatheGeometry(legProfile, 22), c.sx, c.sz, legH);
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(c.x, 0.004, c.z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    frame.add(leg);

    // Brass ferrule sock at bottom of leg (slightly proud so no z-fighting)
    const fGeo = shearGeo(new THREE.LatheGeometry(ferruleProfile, 22), c.sx, c.sz, legH);
    const ferrule = new THREE.Mesh(fGeo, brassMat);
    ferrule.position.set(c.x, 0.004, c.z);
    ferrule.castShadow = true;
    ferrule.receiveShadow = true;
    frame.add(ferrule);

    // Soft dark floor pad resting cleanly at y = 0
    const pGeo = new THREE.LatheGeometry(padProfile, 16);
    const pad = new THREE.Mesh(pGeo, padMat);
    pad.position.set(c.x + c.sx, 0, c.z + c.sz);
    pad.receiveShadow = true;
    frame.add(pad);
  }

  // Sculpted side stretcher rails connecting front and back legs at y = 0.21
  const railY = 0.21;
  const fFactor = 1 - railY / legH;
  for (const side of [-1, 1]) {
    const rx = side * (0.49 + fFactor * 0.052);
    const rzFront = 0.20 + fFactor * 0.042;
    const rzBack = -(0.20 + fFactor * 0.042);
    const railPts = [
      new THREE.Vector3(rx, railY, rzBack),
      new THREE.Vector3(rx, railY + 0.004, 0),
      new THREE.Vector3(rx, railY, rzFront)
    ];
    const railGeo = taperedTube(
      THREE,
      railPts,
      (t) => 0.0095 + Math.sin(t * Math.PI) * 0.0025,
      20,
      12,
      true
    );
    const rail = new THREE.Mesh(railGeo, darkWoodMat);
    rail.castShadow = true;
    rail.receiveShadow = true;
    frame.add(rail);
  }

  // Subtle rear cross stretcher connecting left & right back legs for rigidity
  const bxL = -(0.49 + fFactor * 0.052);
  const bxR = 0.49 + fFactor * 0.052;
  const bz = -(0.20 + fFactor * 0.042);
  const rearBarGeo = taperedTube(
    THREE,
    [
      new THREE.Vector3(bxL, railY, bz),
      new THREE.Vector3(0, railY + 0.006, bz),
      new THREE.Vector3(bxR, railY, bz)
    ],
    (t) => 0.009 + Math.sin(t * Math.PI) * 0.002,
    24,
    12,
    true
  );
  const rearBar = new THREE.Mesh(rearBarGeo, darkWoodMat);
  rearBar.castShadow = true;
  rearBar.receiveShadow = true;
  frame.add(rearBar);

  return frame;
}

function buildTrestleFrame(THREE, woodMat, darkWoodMat, brassMat, padMat, yDeskBottom) {
  const frame = new THREE.Group();
  frame.name = 'frame';

  const legH = yDeskBottom - 0.006;
  const trestleXs = [-0.45, 0.45];

  const makeSlantedBeam = (w, d, h, shearZ) => {
    const shape = roundedRectShape(THREE, w - 0.006, d - 0.006, 0.006);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: h - 0.006,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 4,
      curveSegments: 10
    });
    geo.translate(0, 0, 0.003);
    geo.rotateX(-Math.PI * 0.5);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const frac = 1 - y / h;
      pos.setZ(i, pos.getZ(i) + frac * shearZ);
    }
    pos.needsUpdate = true;
    applyBoxUVs(THREE, geo, 2.0, 1.5, 2.0, 0.1, 0.2);
    return geo;
  };

  const frontLegGeo = makeSlantedBeam(0.044, 0.036, legH, 0.145);
  const backLegGeo = makeSlantedBeam(0.044, 0.036, legH, -0.145);

  const bearerGeo = applyBoxUVs(THREE, makeBeveledSlab(THREE, 0.054, 0.49, 0.028, 0.01, 0.004), 1.6, 1.6, 1.6, 0.2, 0.1);
  const lowerBarGeo = applyBoxUVs(THREE, makeBeveledSlab(THREE, 0.052, 0.51, 0.032, 0.008, 0.004), 1.6, 1.6, 1.6, 0.3, 0.4);
  const shelfGeo = applyBoxUVs(THREE, makeBeveledSlab(THREE, 0.15, 0.38, 0.016, 0.012, 0.003), 1.8, 1.8, 1.4, 0.5, 0.2);
  const padGeo = makeBeveledSlab(THREE, 0.042, 0.038, 0.006, 0.006, 0.001);

  for (const tx of trestleXs) {
    const tg = new THREE.Group();
    tg.position.x = tx;

    const fl = new THREE.Mesh(frontLegGeo, woodMat);
    fl.position.set(0, 0.006, 0.085);
    fl.castShadow = true;
    fl.receiveShadow = true;
    tg.add(fl);

    const bl = new THREE.Mesh(backLegGeo, woodMat);
    bl.position.set(0, 0.006, -0.085);
    bl.castShadow = true;
    bl.receiveShadow = true;
    tg.add(bl);

    // Floor pads at bottom of both splayed A-frame feet
    for (const pz of [0.23, -0.23]) {
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(0, 0, pz);
      pad.receiveShadow = true;
      tg.add(pad);
    }

    // Upper horizontal bearer bar supporting desktop
    const bearer = new THREE.Mesh(bearerGeo, darkWoodMat);
    bearer.position.set(0, yDeskBottom - 0.028, 0);
    bearer.castShadow = true;
    bearer.receiveShadow = true;
    tg.add(bearer);

    // Lower horizontal crossbar with subtle overhanging tenon ends
    const lowerBar = new THREE.Mesh(lowerBarGeo, darkWoodMat);
    lowerBar.position.set(0, 0.185, 0);
    lowerBar.castShadow = true;
    lowerBar.receiveShadow = true;
    tg.add(lowerBar);

    // Cozy side storage tray resting on the trestle crossbar
    const shelf = new THREE.Mesh(shelfGeo, woodMat);
    shelf.position.set(0, 0.217, 0);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    tg.add(shelf);

    // Brass decorative bolts at crossbar junctions
    const boltGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.007, 0),
      new THREE.Vector2(0.007, 0.0025),
      new THREE.Vector2(0.004, 0.0045),
      new THREE.Vector2(0.0005, 0.005)
    ], 14);
    boltGeo.rotateZ(tx < 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
    for (const bz of [-0.18, 0.18]) {
      const bolt = new THREE.Mesh(boltGeo, brassMat);
      bolt.position.set(tx < 0 ? -0.024 : 0.024, 0.201, bz);
      tg.add(bolt);
    }

    frame.add(tg);
  }

  // Rear full-length wooden cross-stretcher linking left & right trestles
  const stretcherGeo = applyBoxUVs(THREE, makeBeveledFrontBlock(THREE, 0.99, 0.036, 0.026, 0.006, 0.003), 1.2, 1.6, 1.6, 0.1, 0.6);
  const stretcher = new THREE.Mesh(stretcherGeo, darkWoodMat);
  stretcher.position.set(0, 0.202, -0.175);
  stretcher.castShadow = true;
  stretcher.receiveShadow = true;
  frame.add(stretcher);

  return frame;
}

function buildStandingFrame(THREE, metalMat, darkMetalMat, padMat, glowMat, yDeskBottom) {
  const frame = new THREE.Group();
  frame.name = 'frame';

  const colXs = [-0.475, 0.475];

  // Sculpted tapered steel T-foot profile extruded along X (width 0.072)
  const footShape = new THREE.Shape();
  footShape.moveTo(-0.265, 0.008);
  footShape.lineTo(0.265, 0.008);
  footShape.quadraticCurveTo(0.268, 0.018, 0.245, 0.021);
  footShape.lineTo(0.07, 0.032);
  footShape.lineTo(-0.07, 0.032);
  footShape.lineTo(-0.245, 0.021);
  footShape.quadraticCurveTo(-0.268, 0.018, -0.265, 0.008);
  const footGeo = new THREE.ExtrudeGeometry(footShape, {
    depth: 0.064,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 4,
    curveSegments: 12
  });
  footGeo.translate(0, 0, -0.032);
  footGeo.rotateY(Math.PI * 0.5);
  applyBoxUVs(THREE, footGeo, 2, 2, 2);

  // Leveling floor glides (LatheGeometry) resting cleanly at y = 0
  const glideGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.022, 0),
    new THREE.Vector2(0.023, 0.005),
    new THREE.Vector2(0.016, 0.008),
    new THREE.Vector2(0.006, 0.010)
  ], 18);

  // Lower outer column & upper inner telescoping column
  const lowerColGeo = applyBoxUVs(THREE, makeBeveledSlab(THREE, 0.074, 0.056, 0.355, 0.011, 0.004), 2, 2, 2);
  const collarGeo = applyBoxUVs(THREE, makeBeveledSlab(THREE, 0.079, 0.061, 0.018, 0.012, 0.003), 2, 2, 2);
  const upperColGeo = applyBoxUVs(THREE, makeBeveledSlab(THREE, 0.060, 0.044, yDeskBottom - 0.385, 0.009, 0.003), 2, 2, 2);

  // Top cantilevered side support wing
  const wingShape = new THREE.Shape();
  wingShape.moveTo(-0.23, 0);
  wingShape.lineTo(0.23, 0);
  wingShape.lineTo(0.22, -0.012);
  wingShape.lineTo(0.055, -0.032);
  wingShape.lineTo(-0.055, -0.032);
  wingShape.lineTo(-0.22, -0.012);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.044,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3
  });
  wingGeo.translate(0, 0, -0.022);
  wingGeo.rotateY(Math.PI * 0.5);
  applyBoxUVs(THREE, wingGeo, 2, 2, 2);

  for (const cx of colXs) {
    const cg = new THREE.Group();
    cg.position.x = cx;

    const foot = new THREE.Mesh(footGeo, metalMat);
    foot.castShadow = true;
    foot.receiveShadow = true;
    cg.add(foot);

    for (const gz of [-0.215, 0.215]) {
      const glide = new THREE.Mesh(glideGeo, padMat);
      glide.position.set(0, 0, gz);
      glide.receiveShadow = true;
      cg.add(glide);
    }

    const lower = new THREE.Mesh(lowerColGeo, metalMat);
    lower.position.set(0, 0.030, -0.02);
    lower.castShadow = true;
    lower.receiveShadow = true;
    cg.add(lower);

    const collar = new THREE.Mesh(collarGeo, darkMetalMat);
    collar.position.set(0, 0.376, -0.02);
    collar.castShadow = true;
    collar.receiveShadow = true;
    cg.add(collar);

    const upper = new THREE.Mesh(upperColGeo, metalMat);
    upper.position.set(0, 0.388, -0.02);
    upper.castShadow = true;
    upper.receiveShadow = true;
    cg.add(upper);

    const wing = new THREE.Mesh(wingGeo, metalMat);
    wing.position.set(0, yDeskBottom, 0);
    wing.castShadow = true;
    wing.receiveShadow = true;
    cg.add(wing);

    frame.add(cg);
  }

  // Twin steel crossbeams under the desktop linking the motorized columns
  const railGeo = applyBoxUVs(THREE, makeBeveledFrontBlock(THREE, 0.94, 0.032, 0.028, 0.005, 0.003), 1.5, 2, 2);
  for (const rz of [-0.085, 0.045]) {
    const rail = new THREE.Mesh(railGeo, metalMat);
    rail.position.set(0, yDeskBottom - 0.018, rz);
    rail.castShadow = true;
    rail.receiveShadow = true;
    frame.add(rail);
  }

  // Rear under-desk curved steel cable management tray
  const trayShape = new THREE.Shape();
  trayShape.moveTo(-0.042, 0.048);
  trayShape.lineTo(-0.042, 0.006);
  trayShape.quadraticCurveTo(-0.042, 0, -0.035, 0);
  trayShape.lineTo(0.035, 0);
  trayShape.quadraticCurveTo(0.042, 0, 0.042, 0.006);
  trayShape.lineTo(0.042, 0.028);
  trayShape.lineTo(0.036, 0.028);
  trayShape.lineTo(0.036, 0.006);
  trayShape.lineTo(-0.036, 0.006);
  trayShape.lineTo(-0.036, 0.048);
  trayShape.closePath();
  const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
    depth: 0.60,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 2
  });
  trayGeo.translate(0, 0, -0.30);
  trayGeo.rotateY(Math.PI * 0.5);
  const tray = new THREE.Mesh(trayGeo, darkMetalMat);
  tray.position.set(0.06, yDeskBottom - 0.095, -0.205);
  tray.castShadow = true;
  tray.receiveShadow = true;
  frame.add(tray);

  // Motorized height control keypad tucked under front-right edge
  const kpGroup = new THREE.Group();
  kpGroup.position.set(0.41, yDeskBottom - 0.015, 0.275);
  const kpBody = new THREE.Mesh(makeBeveledFrontBlock(THREE, 0.108, 0.026, 0.046, 0.006, 0.003), darkMetalMat);
  kpBody.castShadow = true;
  kpBody.receiveShadow = true;
  kpGroup.add(kpBody);

  // Glowing digital height display bar
  const disp = new THREE.Mesh(makeBeveledFrontBlock(THREE, 0.032, 0.010, 0.004, 0.002, 0.001), glowMat);
  disp.position.set(-0.024, 0.001, 0.0225);
  disp.userData.slot = 'glow';
  kpGroup.add(disp);

  // Tiny tactile up/down & preset buttons
  const btnGeo = makeBeveledFrontBlock(THREE, 0.009, 0.007, 0.004, 0.002, 0.001);
  for (let b = 0; b < 4; b++) {
    const btn = new THREE.Mesh(btnGeo, metalMat);
    btn.position.set(0.006 + b * 0.013, 0.001, 0.0225);
    kpGroup.add(btn);
  }
  frame.add(kpGroup);

  return frame;
}

function buildCableGrommetAndCord(THREE, holeX, holeZ, yTop, deskT, darkMetalMat, rubberMat, cableStartWorld) {
  const g = new THREE.Group();
  g.name = 'cable';

  // Sculpted LatheGeometry cable grommet collar seated cleanly in the physical tabletop hole
  const gromPts = [
    new THREE.Vector2(0.0235, -deskT - 0.003),
    new THREE.Vector2(0.0258, -deskT - 0.003),
    new THREE.Vector2(0.0258, -0.001),
    new THREE.Vector2(0.0355, -0.0005),
    new THREE.Vector2(0.0365, 0.0012),
    new THREE.Vector2(0.0345, 0.0028),
    new THREE.Vector2(0.0265, 0.0030),
    new THREE.Vector2(0.0238, 0.0015),
    new THREE.Vector2(0.0235, -deskT - 0.003)
  ];
  const gromGeo = new THREE.LatheGeometry(gromPts, 28);
  const grommet = new THREE.Mesh(gromGeo, darkMetalMat);
  grommet.position.set(holeX, yTop, holeZ);
  grommet.castShadow = true;
  grommet.receiveShadow = true;
  g.add(grommet);

  // Recessed half-moon cover plate leaving a realistic crescent cable opening
  const capShape = new THREE.Shape();
  capShape.absarc(0, 0, 0.0235, -Math.PI * 0.25, Math.PI * 1.15, false);
  capShape.quadraticCurveTo(0.006, -0.004, Math.cos(-Math.PI * 0.25) * 0.0235, Math.sin(-Math.PI * 0.25) * 0.0235);
  const capGeo = new THREE.ExtrudeGeometry(capShape, {
    depth: 0.0025,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0006,
    bevelSegments: 2,
    curveSegments: 20
  });
  capGeo.rotateX(-Math.PI * 0.5);
  const cap = new THREE.Mesh(capGeo, rubberMat);
  cap.position.set(holeX, yTop - 0.001, holeZ);
  cap.receiveShadow = true;
  g.add(cap);

  // Smooth charging cord running from laptop side across desktop and diving down into the grommet
  const cordPts = [
    cableStartWorld.clone(),
    new THREE.Vector3(cableStartWorld.x + 0.045, yTop + 0.004, cableStartWorld.z - 0.018),
    new THREE.Vector3(0.25, yTop + 0.0028, -0.145),
    new THREE.Vector3(0.355, yTop + 0.0032, -0.195),
    new THREE.Vector3(holeX - 0.006, yTop + 0.004, holeZ + 0.008),
    new THREE.Vector3(holeX + 0.004, yTop - 0.022, holeZ + 0.007),
    new THREE.Vector3(holeX - 0.025, yTop - 0.068, holeZ - 0.010),
    new THREE.Vector3(holeX - 0.14, yTop - 0.082, holeZ - 0.015)
  ];
  const cordGeo = taperedTube(THREE, cordPts, (t) => (t < 0.04 ? 0.0034 : 0.0024), 48, 10, true);
  const cord = new THREE.Mesh(cordGeo, rubberMat);
  cord.castShadow = true;
  cord.receiveShadow = true;
  g.add(cord);

  return g;
}

function buildLaptop(THREE, kit, opts, metalBaseCol, accentCol, rubberMat, glowMat) {
  const group = new THREE.Group();
  group.name = 'laptop';

  const w = 0.332;
  const d = 0.226;

  const bodyTex = makeMetalTextures(THREE, kit, metalBaseCol, true);
  const lidMap = makeLaptopLidTexture(THREE, kit, metalBaseCol, accentCol);

  const chassisMat = new THREE.MeshPhysicalMaterial({
    map: bodyTex.map,
    bumpMap: bodyTex.bump,
    bumpScale: 0.0004,
    roughness: 0.34,
    metalness: 0.68,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3
  });

  const lidMat = new THREE.MeshPhysicalMaterial({
    map: lidMap,
    bumpMap: bodyTex.bump,
    bumpScale: 0.0003,
    roughness: 0.30,
    metalness: 0.62,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25
  });

  const darkMetal = new THREE.MeshPhysicalMaterial({
    color: shadeCol(metalBaseCol, 0, 0, -0.35),
    roughness: 0.55,
    metalness: 0.4
  });

  // 4 low-profile rubber feet resting cleanly on local y = 0
  const footGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.0085, 0),
    new THREE.Vector2(0.009, 0.0018),
    new THREE.Vector2(0.008, 0.0024)
  ], 14);
  for (const fx of [-w * 0.41, w * 0.41]) {
    for (const fz of [-d * 0.38, d * 0.38]) {
      const foot = new THREE.Mesh(footGeo, rubberMat);
      foot.position.set(fx, 0, fz);
      group.add(foot);
    }
  }

  // Sculpted lower unibody chassis (subtle bottom taper)
  const baseGeo = makeBeveledSlab(THREE, w, d, 0.0095, 0.015, 0.0028, 16, 4);
  const bPos = baseGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const y = bPos.getY(i);
    if (y < 0.003) {
      const t = (0.003 - y) / 0.003;
      bPos.setX(i, bPos.getX(i) * (1 - t * 0.018));
      bPos.setZ(i, bPos.getZ(i) * (1 - t * 0.022));
    }
  }
  bPos.needsUpdate = true;
  applyBoxUVs(THREE, baseGeo, 2.5, 2.5, 2.5);
  const base = new THREE.Mesh(baseGeo, chassisMat);
  base.position.y = 0.002;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Thin dark rubber display gasket line between base and closed lid
  const gasketGeo = makeBeveledSlab(THREE, w - 0.004, d - 0.004, 0.0018, 0.014, 0.0004, 14, 2);
  const gasket = new THREE.Mesh(gasketGeo, rubberMat);
  gasket.position.y = 0.011;
  group.add(gasket);

  // Upper closed lid with gentle organic dome sculpting and dedicated UV mapping for emblem/sticker
  const lidGeo = makeBeveledSlab(THREE, w - 0.001, d - 0.001, 0.0056, 0.015, 0.0018, 16, 4);
  const lPos = lidGeo.attributes.position;
  const lUv = new Float32Array(lPos.count * 2);
  for (let i = 0; i < lPos.count; i++) {
    const x = lPos.getX(i);
    const y = lPos.getY(i);
    const z = lPos.getZ(i);
    const nx = x / (w * 0.5);
    const nz = z / (d * 0.5);
    const dome = Math.max(0, 1 - (nx * nx * 0.55 + nz * nz * 0.55));
    if (y > 0.0028) {
      lPos.setY(i, y + dome * 0.0009);
    }
    lUv[i * 2] = x / w + 0.5;
    lUv[i * 2 + 1] = 0.5 - z / d;
  }
  lPos.needsUpdate = true;
  lidGeo.setAttribute('uv', new THREE.BufferAttribute(lUv, 2));
  lidGeo.computeVertexNormals();
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.y = 0.0124;
  lid.castShadow = true;
  lid.receiveShadow = true;
  group.add(lid);

  // Rear hinge clutch bar
  const hingeGeo = makeBeveledFrontBlock(THREE, w * 0.62, 0.0068, 0.0085, 0.003, 0.0018);
  const hinge = new THREE.Mesh(hingeGeo, darkMetal);
  hinge.position.set(0, 0.0108, -d * 0.5 + 0.0025);
  group.add(hinge);

  // Front thumb-opening scoop recess
  const notchGeo = makeBeveledFrontBlock(THREE, 0.048, 0.0036, 0.004, 0.0015, 0.0008);
  const notch = new THREE.Mesh(notchGeo, darkMetal);
  notch.position.set(0, 0.0095, d * 0.5 - 0.001);
  group.add(notch);

  // Side USB-C port recesses & plugged-in charging connector on right-back side
  const portGeo = makeBeveledFrontBlock(THREE, 0.002, 0.0028, 0.008, 0.001, 0.0003);
  const port = new THREE.Mesh(portGeo, darkMetal);
  port.position.set(w * 0.5 - 0.0005, 0.0068, -d * 0.25);
  group.add(port);

  const plugGeo = makeBeveledFrontBlock(THREE, 0.016, 0.0056, 0.0095, 0.0024, 0.0012);
  const plug = new THREE.Mesh(plugGeo, rubberMat);
  plug.position.set(w * 0.5 + 0.007, 0.0068, -d * 0.34);
  plug.castShadow = true;
  group.add(plug);

  // Tiny sleep indicator LED on front-right lip
  const ledGeo = makeBeveledFrontBlock(THREE, 0.0085, 0.0016, 0.0016, 0.0006, 0.0003);
  const led = new THREE.Mesh(ledGeo, glowMat);
  led.position.set(w * 0.31, 0.0068, d * 0.5 - 0.0002);
  led.userData.slot = 'glow';
  group.add(led);

  return { group, plugLocalPos: new THREE.Vector3(w * 0.5 + 0.015, 0.0068, -d * 0.34) };
}

function buildPenCupAndStationery(THREE, kit, primaryCol, secondaryCol, accentCol, woodCol, brassMat) {
  const group = new THREE.Group();
  group.name = 'penCup';

  // Ceramic pen cup (LatheGeometry with 26 points: outer wall, rounded rim, hollow interior down to inner floor)
  const cupPts = [
    new THREE.Vector2(0.0005, 0.0),
    new THREE.Vector2(0.032, 0.0),
    new THREE.Vector2(0.0355, 0.0025),
    new THREE.Vector2(0.0365, 0.007),
    new THREE.Vector2(0.0392, 0.022),
    new THREE.Vector2(0.0418, 0.042),
    new THREE.Vector2(0.0424, 0.062),
    new THREE.Vector2(0.0414, 0.082),
    new THREE.Vector2(0.0398, 0.097),
    new THREE.Vector2(0.0392, 0.1025),
    new THREE.Vector2(0.0378, 0.1052),
    new THREE.Vector2(0.0358, 0.1054),
    new THREE.Vector2(0.0342, 0.1032),
    new THREE.Vector2(0.0338, 0.096),
    new THREE.Vector2(0.0348, 0.078),
    new THREE.Vector2(0.0355, 0.058),
    new THREE.Vector2(0.0348, 0.036),
    new THREE.Vector2(0.0325, 0.018),
    new THREE.Vector2(0.0285, 0.0115),
    new THREE.Vector2(0.016, 0.0102),
    new THREE.Vector2(0.0005, 0.010)
  ];
  const cupGeo = new THREE.LatheGeometry(cupPts, 36);
  const ceramicTex = makeCeramicTextures(THREE, kit, primaryCol);
  const cupMat = new THREE.MeshPhysicalMaterial({
    map: ceramicTex.map,
    bumpMap: ceramicTex.bump,
    bumpScale: 0.0006,
    roughness: 0.24,
    metalness: 0.02,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14
  });
  const cupMesh = new THREE.Mesh(cupGeo, cupMat);
  cupMesh.castShadow = true;
  cupMesh.receiveShadow = true;
  group.add(cupMesh);

  // Materials for stationery
  const graphiteMat = new THREE.MeshPhysicalMaterial({ color: '#2b2d30', roughness: 0.45, metalness: 0.2 });
  const rawWoodMat = new THREE.MeshPhysicalMaterial({ color: '#e6c598', roughness: 0.78, metalness: 0 });
  const eraserMat = new THREE.MeshPhysicalMaterial({ color: '#e48d94', roughness: 0.85, sheen: 0.4, sheenColor: '#f7b8bd' });
  const silverMat = new THREE.MeshPhysicalMaterial({ color: '#cfd4da', roughness: 0.22, metalness: 0.85, clearcoat: 0.3 });

  const makeWoodenPencil = (bodyColor, slotName, length = 0.165) => {
    const p = new THREE.Group();
    const bodyLen = length - 0.036;
    const shaftGeo = new THREE.CylinderGeometry(0.0038, 0.0038, bodyLen, 6);
    shaftGeo.translate(0, 0.018 + bodyLen * 0.5, 0);
    const shaftMat = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      roughness: 0.38,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    if (slotName) shaft.userData.slot = slotName;
    shaft.castShadow = true;
    p.add(shaft);

    // Crimped brass ferrule at base (or top)
    const ferrGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.0037, 0.009),
      new THREE.Vector2(0.0040, 0.010),
      new THREE.Vector2(0.0038, 0.013),
      new THREE.Vector2(0.0040, 0.016),
      new THREE.Vector2(0.0039, 0.019)
    ], 16);
    const ferr = new THREE.Mesh(ferrGeo, brassMat);
    ferr.castShadow = true;
    p.add(ferr);

    // Rounded pink eraser at bottom y = 0..0.010
    const erGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.0005, 0),
      new THREE.Vector2(0.0028, 0.0005),
      new THREE.Vector2(0.0037, 0.0025),
      new THREE.Vector2(0.0038, 0.0095)
    ], 16);
    const er = new THREE.Mesh(erGeo, eraserMat);
    p.add(er);

    // Sharpened wooden cone + graphite tip at top
    const coneStart = 0.018 + bodyLen;
    const woodConeGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.0037, coneStart),
      new THREE.Vector2(0.0025, coneStart + 0.006),
      new THREE.Vector2(0.0012, coneStart + 0.0125)
    ], 14);
    const woodCone = new THREE.Mesh(woodConeGeo, rawWoodMat);
    woodCone.castShadow = true;
    p.add(woodCone);

    const tipGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.0012, coneStart + 0.0124),
      new THREE.Vector2(0.0004, coneStart + 0.0175),
      new THREE.Vector2(0.0001, coneStart + 0.0185)
    ], 12);
    const tip = new THREE.Mesh(tipGeo, graphiteMat);
    p.add(tip);
    return p;
  };

  const makeGelPen = (barrelColor, slotName, length = 0.152) => {
    const p = new THREE.Group();
    const prof = [
      new THREE.Vector2(0.0004, 0),
      new THREE.Vector2(0.0018, 0.006),
      new THREE.Vector2(0.0042, 0.019),
      new THREE.Vector2(0.0049, 0.036),
      new THREE.Vector2(0.0048, length - 0.014),
      new THREE.Vector2(0.0043, length - 0.006),
      new THREE.Vector2(0.0026, length - 0.005)
    ];
    const bodyGeo = new THREE.LatheGeometry(prof, 18);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: barrelColor,
      roughness: 0.25,
      clearcoat: 0.6,
      clearcoatRoughness: 0.16
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    if (slotName) body.userData.slot = slotName;
    body.castShadow = true;
    p.add(body);

    // Click button + silver collar
    const clickGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.0044, length - 0.018),
      new THREE.Vector2(0.0050, length - 0.016),
      new THREE.Vector2(0.0050, length - 0.013),
      new THREE.Vector2(0.0028, length - 0.006),
      new THREE.Vector2(0.0026, length + 0.005),
      new THREE.Vector2(0.0005, length + 0.006)
    ], 16);
    const click = new THREE.Mesh(clickGeo, silverMat);
    click.castShadow = true;
    p.add(click);

    // Curved tapered pocket clip
    const clipPts = [
      new THREE.Vector3(0.0044, length - 0.013, 0),
      new THREE.Vector3(0.0074, length - 0.017, 0),
      new THREE.Vector3(0.0072, length - 0.044, 0),
      new THREE.Vector3(0.0052, length - 0.048, 0)
    ];
    const clipGeo = taperedTube(THREE, clipPts, (t) => 0.0011 - t * 0.00025, 16, 8, true);
    const clip = new THREE.Mesh(clipGeo, silverMat);
    p.add(clip);
    return p;
  };

  const makeHighlighter = (colorVal, slotName) => {
    const p = new THREE.Group();
    const bodyShape = roundedRectShape(THREE, 0.014, 0.009, 0.004);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.095,
      bevelEnabled: true,
      bevelThickness: 0.0015,
      bevelSize: 0.0012,
      bevelSegments: 3,
      curveSegments: 10
    });
    bodyGeo.rotateX(-Math.PI * 0.5);
    const hMat = new THREE.MeshPhysicalMaterial({
      color: colorVal,
      roughness: 0.34,
      clearcoat: 0.32
    });
    const body = new THREE.Mesh(bodyGeo, hMat);
    if (slotName) body.userData.slot = slotName;
    body.position.y = 0.002;
    body.castShadow = true;
    p.add(body);

    // Chunky cap on top
    const capShape = roundedRectShape(THREE, 0.0155, 0.0102, 0.0044);
    const capGeo = new THREE.ExtrudeGeometry(capShape, {
      depth: 0.036,
      bevelEnabled: true,
      bevelThickness: 0.0014,
      bevelSize: 0.001,
      bevelSegments: 3,
      curveSegments: 10
    });
    capGeo.rotateX(-Math.PI * 0.5);
    const capMat = new THREE.MeshPhysicalMaterial({
      color: shadeCol(colorVal, 0, 0.05, -0.10),
      roughness: 0.42
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.098;
    cap.castShadow = true;
    p.add(cap);
    return p;
  };

  // Place stationery leaning naturally inside the cup (resting on inner floor y ~ 0.012, clear of walls)
  const pencil1 = makeWoodenPencil(accentCol, 'accent', 0.168);
  pencil1.position.set(-0.008, 0.012, -0.006);
  pencil1.rotation.set(0.18, 0.4, -0.16);
  group.add(pencil1);

  const pencil2 = makeWoodenPencil(shadeCol(primaryCol, 0.04, -0.05, 0.12), 'primary', 0.148);
  pencil2.position.set(0.010, 0.012, 0.008);
  pencil2.rotation.set(-0.16, 1.1, 0.19);
  group.add(pencil2);

  const pen1 = makeGelPen(shadeCol(primaryCol, 0, 0.05, -0.08), 'primary', 0.150);
  pen1.position.set(0.006, 0.012, -0.010);
  pen1.rotation.set(0.22, -0.8, 0.12);
  group.add(pen1);

  const pen2 = makeGelPen('#f5eee2', null, 0.142);
  pen2.position.set(-0.011, 0.012, 0.009);
  pen2.rotation.set(-0.19, 2.2, -0.14);
  group.add(pen2);

  const highlighter = makeHighlighter(secondaryCol, 'secondary');
  highlighter.position.set(-0.002, 0.012, 0.011);
  highlighter.rotation.set(-0.17, 0.35, 0.08);
  group.add(highlighter);

  // Small wooden studio ruler leaning at the back of the pen cup
  const rulerTex = makeRulerTexture(THREE, kit, woodCol);
  const rulerMat = new THREE.MeshPhysicalMaterial({
    map: rulerTex,
    roughness: 0.62,
    clearcoat: 0.12
  });
  const rulerGeo = makeBeveledFrontBlock(THREE, 0.024, 0.172, 0.0032, 0.002, 0.0008);
  const rPos = rulerGeo.attributes.position;
  const rUv = new Float32Array(rPos.count * 2);
  for (let i = 0; i < rPos.count; i++) {
    rUv[i * 2] = rPos.getX(i) / 0.024 + 0.5;
    rUv[i * 2 + 1] = rPos.getY(i) / 0.172 + 0.5;
  }
  rulerGeo.setAttribute('uv', new THREE.BufferAttribute(rUv, 2));
  const ruler = new THREE.Mesh(rulerGeo, rulerMat);
  ruler.position.set(-0.012, 0.096, -0.014);
  ruler.rotation.set(-0.18, 0.25, 0.13);
  ruler.castShadow = true;
  group.add(ruler);

  return group;
}

function buildBook(THREE, kit, bw, bl, bt, coverCol, foilCol, pageMat, slotName, seed) {
  const book = new THREE.Group();
  const ct = 0.0036; // hardcover board thickness
  const spineR = bt * 0.5;
  const hw = bw * 0.5;
  const ht = bt * 0.5;

  // Sculpted continuous C-shaped hardcover wrap with genuinely rounded spine
  const shape = new THREE.Shape();
  shape.moveTo(hw, -ht);
  shape.lineTo(hw, -ht + ct);
  shape.lineTo(-hw + spineR, -ht + ct);
  shape.bezierCurveTo(
    -hw + ct * 1.15, -ht + ct,
    -hw + ct * 1.15, ht - ct,
    -hw + spineR, ht - ct
  );
  shape.lineTo(hw, ht - ct);
  shape.lineTo(hw, ht);
  shape.lineTo(-hw + spineR, ht);
  shape.bezierCurveTo(
    -hw - 0.002, ht,
    -hw - 0.002, -ht,
    -hw + spineR, -ht
  );
  shape.closePath();

  const b = 0.0008;
  const coverGeo = new THREE.ExtrudeGeometry(shape, {
    depth: bl - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 16
  });
  coverGeo.translate(0, ht, -(bl - 2 * b) * 0.5);
  applyBoxUVs(THREE, coverGeo, 3.5, 4.0, 3.5, seed * 0.1, seed * 0.2);

  const coverTex = makeBookCoverTextures(THREE, kit, coverCol, foilCol, seed);
  const coverMat = new THREE.MeshPhysicalMaterial({
    map: coverTex.map,
    bumpMap: coverTex.bump,
    bumpScale: 0.0007,
    roughness: 0.86,
    sheen: 0.65,
    sheenRoughness: 0.75,
    sheenColor: shadeCol(coverCol, 0, -0.08, 0.22)
  });

  const coverMesh = new THREE.Mesh(coverGeo, coverMat);
  if (slotName) coverMesh.userData.slot = slotName;
  coverMesh.castShadow = true;
  coverMesh.receiveShadow = true;
  book.add(coverMesh);

  // Raised binding bands wrapping across the rounded spine
  const bandMat = new THREE.MeshPhysicalMaterial({
    color: foilCol,
    roughness: 0.32,
    metalness: 0.58,
    clearcoat: 0.25
  });
  for (const bz of [-bl * 0.34, bl * 0.34]) {
    const bandPts = [
      new THREE.Vector3(-hw + spineR * 0.85, ct * 0.8, bz),
      new THREE.Vector3(-hw + 0.001, bt * 0.25, bz),
      new THREE.Vector3(-hw - 0.0012, bt * 0.5, bz),
      new THREE.Vector3(-hw + 0.001, bt * 0.75, bz),
      new THREE.Vector3(-hw + spineR * 0.85, bt - ct * 0.8, bz)
    ];
    const bandGeo = taperedTube(THREE, bandPts, () => 0.0013, 14, 8, true);
    const band = new THREE.Mesh(bandGeo, bandMat);
    book.add(band);
  }

  // Inset page block with fine layered paper texture on all three exposed edges
  const pageW = bw - ct - 0.006;
  const pageL = bl - 0.010;
  const pageT = bt - ct * 2 - 0.0006;
  const pageGeo = makeBeveledSlab(THREE, pageW, pageL, pageT, 0.0025, 0.0008, 8, 2);
  applyBoxUVs(THREE, pageGeo, 4.0, 22.0, 4.0);
  const pages = new THREE.Mesh(pageGeo, pageMat);
  pages.position.set(ct * 0.5 - 0.001, ct + 0.0003, 0);
  pages.castShadow = true;
  pages.receiveShadow = true;
  book.add(pages);

  return book;
}

function buildBookStack(THREE, kit, primaryCol, secondaryCol, accentCol) {
  const stack = new THREE.Group();
  stack.name = 'books';

  const pageTex = makePageEdgesTextures(THREE, kit);
  const pageMat = new THREE.MeshPhysicalMaterial({
    map: pageTex.map,
    bumpMap: pageTex.bump,
    bumpScale: 0.0009,
    roughness: 0.90,
    sheen: 0.25,
    sheenColor: '#fffaf0'
  });

  const goldFoil = new THREE.Color('#e3c681');
  const creamFoil = new THREE.Color('#f2e6cf');

  // Rotate books so rounded coloured spines face front-left (+z) AND creamy page edges face front-right (+x)
  const baseSpineAngle = Math.PI * 0.5 - 0.32;

  const b1 = buildBook(THREE, kit, 0.164, 0.232, 0.036, primaryCol, goldFoil, pageMat, 'primary', 1.2);
  b1.position.set(0, 0, 0);
  b1.rotation.y = baseSpineAngle;
  stack.add(b1);

  const b2 = buildBook(THREE, kit, 0.148, 0.212, 0.030, secondaryCol, creamFoil, pageMat, 'secondary', 2.7);
  b2.position.set(0.005, 0.036, 0.004);
  b2.rotation.y = baseSpineAngle - 0.17;
  stack.add(b2);

  const b3 = buildBook(THREE, kit, 0.134, 0.194, 0.024, shadeCol(accentCol, -0.02, 0.04, -0.06), creamFoil, pageMat, 'accent', 4.3);
  b3.position.set(-0.004, 0.066, -0.005);
  b3.rotation.y = baseSpineAngle + 0.24;
  stack.add(b3);

  // Soft curved ribbon bookmark peeking out from the middle book and draping gracefully down
  const ribShape = new THREE.Shape();
  ribShape.moveTo(-0.006, 0);
  ribShape.lineTo(0.006, 0);
  ribShape.lineTo(0.006, 0.068);
  ribShape.lineTo(0, 0.058);
  ribShape.lineTo(-0.006, 0.068);
  ribShape.closePath();

  const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
    depth: 0.001,
    bevelEnabled: true,
    bevelThickness: 0.0003,
    bevelSize: 0.0003,
    bevelSegments: 2
  });
  // Bend the extruded ribbon smoothly downward along its length
  const rPos = ribGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const s = rPos.getY(i) / 0.068;
    const zOrig = rPos.getZ(i);
    const outDist = Math.sin(s * Math.PI * 0.5) * 0.028;
    const dropY = -Math.pow(s, 1.85) * 0.046;
    const waveX = Math.sin(s * Math.PI * 1.4) * 0.003;
    rPos.setX(i, rPos.getX(i) + waveX);
    rPos.setY(i, dropY + zOrig);
    rPos.setZ(i, outDist + zOrig * 0.4);
  }
  rPos.needsUpdate = true;
  ribGeo.computeVertexNormals();

  const ribMat = new THREE.MeshPhysicalMaterial({
    color: accentCol,
    roughness: 0.85,
    sheen: 0.85,
    sheenColor: shadeCol(accentCol, 0, -0.1, 0.28)
  });
  const ribbon = new THREE.Mesh(ribGeo, ribMat);
  ribbon.userData.slot = 'accent';
  ribbon.position.set(0.088, 0.051, 0.036);
  ribbon.rotation.y = 0.65;
  ribbon.castShadow = true;
  stack.add(ribbon);

  return { group: stack, ribbon };
}

export function build(THREE, opts = {}, kit = {}) {
  const primaryCol = col(THREE, opts.primary, '#4e738c');
  const secondaryCol = col(THREE, opts.secondary, '#d67e61');
  const accentCol = col(THREE, opts.accent, '#e3b456');
  const woodCol = col(THREE, opts.wood, '#b8804e');
  const metalCol = col(THREE, opts.metal, '#434a54');
  const variant = Number.isFinite(opts.variant) ? Math.max(0, Math.min(2, Math.round(opts.variant))) : 0;

  const root = new THREE.Group();
  root.name = 'studyDesk';

  // Core dimensions: 1.2m wide, 0.6m deep, 0.75m high
  const W = 1.20;
  const D = 0.60;
  const H = 0.75;
  const topT = 0.032;
  const yDeskBottom = H - topT;
  const holeX = 0.44;
  const holeZ = -0.19;

  // Painted wood textures (redrawn from opts.wood)
  const woodTex = makeWoodTextures(THREE, kit, woodCol, 0.5);
  const darkWoodCol = shadeCol(woodCol, -0.006, 0.04, -0.09);
  const darkWoodTex = makeWoodTextures(THREE, kit, darkWoodCol, 3.7);

  const isGlossyFinish = opts.material === 'lacquer' || opts.material === 'gloss';
  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0014,
    roughness: isGlossyFinish ? 0.34 : 0.54,
    metalness: 0.02,
    clearcoat: isGlossyFinish ? 0.55 : 0.24,
    clearcoatRoughness: isGlossyFinish ? 0.18 : 0.38
  });

  const woodDrawerMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0012,
    roughness: isGlossyFinish ? 0.36 : 0.52,
    metalness: 0.02,
    clearcoat: isGlossyFinish ? 0.5 : 0.22,
    clearcoatRoughness: 0.35
  });

  const darkWoodMat = new THREE.MeshPhysicalMaterial({
    map: darkWoodTex.map,
    bumpMap: darkWoodTex.bump,
    bumpScale: 0.0012,
    roughness: 0.60,
    metalness: 0.02,
    clearcoat: 0.14,
    clearcoatRoughness: 0.45
  });

  // Painted metal & hardware materials
  const metalTex = makeMetalTextures(THREE, kit, metalCol, variant !== 2);
  const metalMat = new THREE.MeshPhysicalMaterial({
    map: metalTex.map,
    bumpMap: metalTex.bump,
    bumpScale: 0.0005,
    roughness: variant === 2 ? 0.46 : 0.34,
    metalness: variant === 2 ? 0.55 : 0.72,
    clearcoat: 0.22,
    clearcoatRoughness: 0.32
  });

  const darkMetalMat = new THREE.MeshPhysicalMaterial({
    color: shadeCol(metalCol, 0, 0, -0.18),
    roughness: 0.48,
    metalness: 0.45,
    clearcoat: 0.15
  });

  const brassCol = mixCol(THREE, accentCol, new THREE.Color('#d9b263'), 0.55);
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: brassCol,
    roughness: 0.26,
    metalness: 0.84,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2
  });

  const rubberMat = new THREE.MeshPhysicalMaterial({
    color: '#2b2d32',
    roughness: 0.84,
    metalness: 0.05
  });

  const padMat = new THREE.MeshPhysicalMaterial({
    color: '#252427',
    roughness: 0.92,
    sheen: 0.35,
    sheenColor: '#4a484e'
  });

  const glowMat = new THREE.MeshPhysicalMaterial({
    color: accentCol,
    emissive: accentCol,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    clearcoat: 0.8
  });

  // 1. Desktop slab with slightly rounded corners, beveled edges, and physical cable hole
  const desktopGroup = new THREE.Group();
  desktopGroup.name = 'desktop';
  const topGeo = makeBeveledSlab(THREE, W, D, topT, 0.032, 0.0065, 20, 6, { x: holeX, z: holeZ, r: 0.025 });
  applyBoxUVs(THREE, topGeo, 0.88, 1.4, 1.45, 0.5, 0.5);
  const topMesh = new THREE.Mesh(topGeo, woodMat);
  topMesh.position.y = yDeskBottom;
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  desktopGroup.add(topMesh);
  root.add(desktopGroup);

  // 2. Variant-specific frame & tailored dual drawers with shaped handles
  if (variant === 0) {
    // Classic cozy two-drawer desk with splayed tapered legs & brass ferrules
    const drawers = buildDrawersSection(THREE, opts, {
      width: 1.06,
      depth: 0.48,
      height: 0.118,
      yTop: yDeskBottom,
      frontZ: 0.245,
      woodMat,
      woodDrawerMat,
      darkWoodMat,
      handleMat: brassMat,
      rosetteMat: brassMat
    });
    root.add(drawers);
    root.add(buildClassicFrame(THREE, woodMat, darkWoodMat, brassMat, padMat, yDeskBottom));
  } else if (variant === 1) {
    // Trestle legs desk with slim under-top dual drawers & lower storage trays
    const drawers = buildDrawersSection(THREE, opts, {
      width: 0.82,
      depth: 0.44,
      height: 0.088,
      yTop: yDeskBottom,
      frontZ: 0.235,
      woodMat,
      woodDrawerMat,
      darkWoodMat,
      handleMat: brassMat,
      rosetteMat: darkMetalMat
    });
    root.add(drawers);
    root.add(buildTrestleFrame(THREE, woodMat, darkWoodMat, brassMat, padMat, yDeskBottom));
  } else {
    // Standing desk with telescoping metal frame, cable tray, controller & slim drawers
    const drawers = buildDrawersSection(THREE, opts, {
      width: 0.78,
      depth: 0.36,
      height: 0.072,
      yTop: yDeskBottom,
      frontZ: 0.235,
      woodMat: darkMetalMat,
      woodDrawerMat,
      darkWoodMat,
      handleMat: metalMat,
      rosetteMat: darkMetalMat
    });
    root.add(drawers);
    root.add(buildStandingFrame(THREE, metalMat, darkMetalMat, padMat, glowMat, yDeskBottom));
  }

  // 3. Tabletop hero props
  // Closed laptop centered slightly left-front with cozy skew
  const laptopMetalCol = mixCol(THREE, metalCol, new THREE.Color('#b6bec7'), 0.65);
  const laptopBuilt = buildLaptop(THREE, kit, opts, laptopMetalCol, accentCol, rubberMat, glowMat);
  laptopBuilt.group.position.set(-0.015, H, 0.048);
  laptopBuilt.group.rotation.y = 0.085;
  root.add(laptopBuilt.group);

  // Compute world position of laptop charging plug to connect the cord cleanly to the cable hole
  laptopBuilt.group.updateMatrixWorld(true);
  const plugWorld = laptopBuilt.plugLocalPos.clone().applyMatrix4(laptopBuilt.group.matrixWorld);
  root.add(buildCableGrommetAndCord(THREE, holeX, holeZ, H, topT, darkMetalMat, rubberMat, plugWorld));

  // Ceramic pen cup with varied pens, pencils, highlighter & wooden ruler
  const penCup = buildPenCupAndStationery(THREE, kit, primaryCol, secondaryCol, accentCol, woodCol, brassMat);
  penCup.position.set(0.36, H, 0.025);
  penCup.rotation.y = -0.35;
  root.add(penCup);

  // Small stack of 3 hardcover books with coloured spines, layered page edges & ribbon bookmark
  const booksBuilt = buildBookStack(THREE, kit, primaryCol, secondaryCol, accentCol);
  booksBuilt.group.position.set(-0.385, H, -0.048);
  root.add(booksBuilt.group);

  root.userData.anim = {
    glowMat,
    ribbon: booksBuilt.ribbon,
    ribbonBaseRotZ: booksBuilt.ribbon.rotation.z
  };

  return root;
}

export function idle(group, t) {
  if (!group || !group.userData || !group.userData.anim) return;
  const { glowMat, ribbon, ribbonBaseRotZ } = group.userData.anim;
  if (glowMat) {
    glowMat.emissiveIntensity = 1.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.9));
  }
  if (ribbon) {
    ribbon.rotation.z = ribbonBaseRotZ + Math.sin(t * 1.35) * 0.015;
  }
}