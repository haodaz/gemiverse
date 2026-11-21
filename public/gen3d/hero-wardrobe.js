export const META = {
  id: 'wardrobe',
  name: 'Cozy Dorm Wardrobe',
  kind: 'furniture',
  footprint: [0.9, 0.55],
  variants: [
    'Panelled Wood',
    'Painted Mirror Door',
    'Open Rail & Shoe Shelf'
  ],
  note: 'Stylised 0.9 x 0.55 x 1.9 m dorm wardrobe with turned feet, bottom drawer, ajar door with hanging clothes, and a vintage suitcase on top.'
};

// ---------------------------------------------------------------------------
// Colour & Material Helpers
// ---------------------------------------------------------------------------

function toColor(THREE, val, fallback) {
  const c = new THREE.Color();
  try {
    c.set(val !== undefined && val !== null ? val : fallback);
  } catch (_) {
    c.set(fallback);
  }
  return c;
}

function shiftHSL(THREE, color, dh, ds, dl) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const out = new THREE.Color();
  out.setHSL(
    (hsl.h + dh + 1) % 1,
    Math.max(0, Math.min(1, hsl.s + ds)),
    Math.max(0, Math.min(1, hsl.l + dl))
  );
  return out;
}

function resolveFinish(materialOpt) {
  const f = { roughnessBias: 0, clearcoatBias: 0 };
  if (!materialOpt) return f;
  if (typeof materialOpt === 'string') {
    const s = materialOpt.toLowerCase();
    if (s.includes('matte')) { f.roughnessBias = 0.16; f.clearcoatBias = -0.15; }
    else if (s.includes('gloss')) { f.roughnessBias = -0.18; f.clearcoatBias = 0.25; }
    else if (s.includes('satin')) { f.roughnessBias = -0.05; f.clearcoatBias = 0.08; }
  } else if (typeof materialOpt === 'object') {
    if (typeof materialOpt.roughness === 'number') f.roughnessBias = materialOpt.roughness - 0.52;
    if (typeof materialOpt.clearcoat === 'number') f.clearcoatBias = materialOpt.clearcoat - 0.2;
  }
  return f;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function tagMesh(mesh, slot, cast = true, receive = true) {
  if (slot) mesh.userData.slot = slot;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures (using kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function fbm(kit, x, y) {
  return (
    kit.noise(x, y) * 0.55 +
    kit.noise(x * 2.13 + 7.1, y * 2.07 + 3.4) * 0.3 +
    kit.noise(x * 4.31 + 19.3, y * 4.19 + 11.7) * 0.15
  );
}

function makeWoodTextures(THREE, kit, baseColor, grainContrast = 1.0) {
  const darkCol = shiftHSL(THREE, baseColor, -0.012, 0.06, -0.14 * grainContrast);
  const lightCol = shiftHSL(THREE, baseColor, 0.01, -0.03, 0.09 * grainContrast);
  const poreCol = shiftHSL(THREE, baseColor, -0.018, 0.08, -0.22 * grainContrast);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = baseColor.getStyle();
    ctx.fillRect(0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const br = baseColor.r * 255, bg = baseColor.g * 255, bb = baseColor.b * 255;
    const dr = darkCol.r * 255, dg = darkCol.g * 255, db = darkCol.b * 255;
    const lr = lightCol.r * 255, lg = lightCol.g * 255, lb = lightCol.b * 255;
    const pr = poreCol.r * 255, pg = poreCol.g * 255, pb = poreCol.b * 255;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const warp = fbm(kit, nx * 3.8, ny * 1.1) * 1.65;
        const ring = Math.sin((nx * 16.0 + warp * 4.2) * Math.PI) * 0.5 + 0.5;
        const fine = kit.noise(nx * 46.0, ny * 6.5);
        const streak = kit.noise(nx * 95.0, ny * 3.2);
        const tone = ring * 0.52 + fine * 0.34 + streak * 0.14;

        let r, g, b;
        if (tone < 0.5) {
          const t = tone * 2;
          r = dr + (br - dr) * t;
          g = dg + (bg - dg) * t;
          b = db + (bb - db) * t;
        } else {
          const t = (tone - 0.5) * 2;
          r = br + (lr - br) * t;
          g = bg + (lg - bg) * t;
          b = bb + (lb - bb) * t;
        }

        if (streak < 0.22) {
          const pt = (0.22 - streak) / 0.22 * 0.45 * grainContrast;
          r = r * (1 - pt) + pr * pt;
          g = g * (1 - pt) + pg * pt;
          b = b * (1 - pt) + pb * pt;
        }

        const idx = (y * w + x) * 4;
        d[idx] = Math.max(0, Math.min(255, r));
        d[idx + 1] = Math.max(0, Math.min(255, g));
        d[idx + 2] = Math.max(0, Math.min(255, b));
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const warp = fbm(kit, nx * 3.8, ny * 1.1) * 1.65;
        const ring = Math.sin((nx * 16.0 + warp * 4.2) * Math.PI) * 0.5 + 0.5;
        const pore = kit.noise(nx * 68.0, ny * 5.0);
        const v = Math.floor((ring * 0.42 + pore * 0.58) * 255);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

function makePaintedWoodTextures(THREE, kit, baseColor) {
  const shade = shiftHSL(THREE, baseColor, -0.01, 0.04, -0.07);
  const hi = shiftHSL(THREE, baseColor, 0.008, -0.02, 0.06);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const br = baseColor.r * 255, bg = baseColor.g * 255, bb = baseColor.b * 255;
    const sr = shade.r * 255, sg = shade.g * 255, sb = shade.b * 255;
    const hr = hi.r * 255, hg = hi.g * 255, hb = hi.b * 255;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const brush = kit.noise(nx * 34.0, ny * 2.5) * 0.65 + kit.noise(nx * 8.0, ny * 8.0) * 0.35;
        let r, g, b;
        if (brush < 0.5) {
          const t = brush * 2;
          r = sr + (br - sr) * t;
          g = sg + (bg - sg) * t;
          b = sb + (bb - sb) * t;
        } else {
          const t = (brush - 0.5) * 2;
          r = br + (hr - br) * t;
          g = bg + (hg - bg) * t;
          b = bb + (hb - bb) * t;
        }
        const idx = (y * w + x) * 4;
        d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const v = Math.floor((kit.noise(nx * 44, ny * 4) * 0.65 + kit.noise(nx * 14, ny * 14) * 0.35) * 255);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

function makeFabricTextures(THREE, kit, baseColor, pattern = 'knit', accentColor = null) {
  const acc = accentColor || shiftHSL(THREE, baseColor, 0.04, -0.05, 0.24);
  const dark = shiftHSL(THREE, baseColor, -0.01, 0.05, -0.14);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor.getStyle();
    ctx.fillRect(0, 0, w, h);

    if (pattern === 'plaid') {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = dark.getStyle();
      for (let i = 0; i < w; i += 48) {
        ctx.fillRect(i, 0, 14, h);
        ctx.fillRect(0, i, w, 14);
      }
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = acc.getStyle();
      for (let i = 22; i < w; i += 48) {
        ctx.fillRect(i, 0, 4, h);
        ctx.fillRect(0, i, w, 4);
      }
      ctx.globalAlpha = 1.0;
    } else if (pattern === 'stripe') {
      ctx.fillStyle = acc.getStyle();
      for (let y = 0; y < h; y += 28) {
        ctx.fillRect(0, y, w, 9);
      }
    } else if (pattern === 'knit') {
      ctx.strokeStyle = dark.getStyle();
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.32;
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        for (let y = 0; y < h; y += 12) {
          ctx.beginPath();
          ctx.moveTo(x + 2, y);
          ctx.lineTo(x + 8, y + 6);
          ctx.lineTo(x + 14, y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // Subtle fabric weave fleck noise
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const weave = (((x >> 1) + (y >> 1)) & 1) ? 7 : -7;
        const n = (kit.noise(x * 0.18, y * 0.18) - 0.5) * 18;
        const idx = (y * w + x) * 4;
        d[idx] = Math.max(0, Math.min(255, d[idx] + weave + n));
        d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] + weave + n));
        d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] + weave + n));
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v;
        if (pattern === 'knit') {
          const rib = Math.sin((x / w) * Math.PI * 32) * 0.5 + 0.5;
          const stitch = Math.sin(((y + (x % 8)) / h) * Math.PI * 36) * 0.5 + 0.5;
          v = (rib * 0.6 + stitch * 0.4) * 255;
        } else {
          const weft = Math.sin((x / w) * Math.PI * 64) * Math.sin((y / h) * Math.PI * 64) * 0.5 + 0.5;
          v = (weft * 0.55 + kit.noise(x * 0.25, y * 0.25) * 0.45) * 255;
        }
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

function makeSuitcaseTextures(THREE, kit, leatherCol, accentCol) {
  const darkEdge = shiftHSL(THREE, leatherCol, -0.015, 0.08, -0.15);
  const stitchCol = shiftHSL(THREE, accentCol, 0.02, -0.25, 0.22);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = leatherCol.getStyle();
    ctx.fillRect(0, 0, w, h);

    // Subtle vintage patina & pebbled leather grain
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const pebble = kit.noise(nx * 56, ny * 56) * 16 - 8;
        const wear = (fbm(kit, nx * 4, ny * 4) - 0.5) * 24;
        const idx = (y * w + x) * 4;
        d[idx] = Math.max(0, Math.min(255, d[idx] + pebble + wear));
        d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] + pebble + wear));
        d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] + pebble + wear));
      }
    }
    ctx.putImageData(img, 0, 0);

    // Vintage travel sticker 1: Alpine mountain oval badge (on upper lid region)
    ctx.save();
    ctx.translate(152, 138);
    ctx.rotate(-0.22);
    ctx.fillStyle = '#f5ecd7';
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c85a3a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#53827a';
    ctx.beginPath();
    ctx.moveTo(-26, 12);
    ctx.lineTo(-4, -14);
    ctx.lineTo(14, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3b5c58';
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(16, -9);
    ctx.lineTo(30, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2c15a';
    ctx.beginPath();
    ctx.arc(16, -12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Vintage travel sticker 2: Retro striped luggage stamp
    ctx.save();
    ctx.translate(358, 165);
    ctx.rotate(0.18);
    ctx.fillStyle = '#2f4c63';
    ctx.fillRect(-34, -22, 68, 44);
    ctx.strokeStyle = '#f6ecd9';
    ctx.lineWidth = 3;
    ctx.strokeRect(-30, -18, 60, 36);
    ctx.fillStyle = '#e89b4c';
    ctx.fillRect(-26, -4, 52, 9);
    ctx.fillStyle = '#f6ecd9';
    ctx.beginPath();
    ctx.arc(0, -10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Vintage travel sticker 3: Sunburst seal
    ctx.save();
    ctx.translate(262, 118);
    ctx.rotate(-0.08);
    ctx.fillStyle = '#d46a4e';
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fae8c8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Subtle decorative perimeter stitch band
    ctx.strokeStyle = stitchCol.getStyle();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.setLineDash([]);

    // Soft shading near lid split
    const grad = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.56);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, darkEdge.getStyle());
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.44, w, h * 0.12);
    ctx.globalAlpha = 1.0;
  });

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = Math.floor(kit.noise((x / w) * 60, (y / h) * 60) * 255);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

function makeWallpaperTexture(THREE, kit, baseCol) {
  const stripeCol = shiftHSL(THREE, baseCol, 0.015, -0.04, -0.07);
  const dotCol = shiftHSL(THREE, baseCol, -0.02, 0.08, -0.14);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseCol.getStyle();
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = stripeCol.getStyle();
    for (let x = 0; x < w; x += 32) {
      ctx.fillRect(x, 0, 12, h);
    }
    ctx.fillStyle = dotCol.getStyle();
    ctx.globalAlpha = 0.45;
    for (let y = 16; y < h; y += 32) {
      for (let x = 22; x < w; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  });

  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 3.2);
  return map;
}

function makeMirrorTexture(THREE, kit) {
  const map = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w * 0.85, h);
    grad.addColorStop(0.0, '#eaf2f6');
    grad.addColorStop(0.28, '#d4e2ea');
    grad.addColorStop(0.58, '#c5d3db');
    grad.addColorStop(0.84, '#d9d3c9');
    grad.addColorStop(1.0, '#b9c6ce');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle soft diagonal window-light sheen streaks
    ctx.save();
    ctx.translate(w * 0.5, h * 0.45);
    ctx.rotate(-0.42);
    ctx.fillStyle = 'rgba(255, 252, 245, 0.45)';
    ctx.fillRect(-w, -65, w * 2, 42);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(-w, 12, w * 2, 16);
    ctx.restore();

    // Gentle bevel frame edge shading
    ctx.strokeStyle = 'rgba(70, 90, 105, 0.28)';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, w - 28, h - 28);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makePostcardTexture(THREE, kit) {
  const map = kit.canvasTexture(128, 160, (ctx, w, h) => {
    ctx.fillStyle = '#faf5ea';
    ctx.fillRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(10, 10, 10, 118);
    sky.addColorStop(0, '#f4b07e');
    sky.addColorStop(0.6, '#f6d69c');
    sky.addColorStop(1, '#7ea8a2');
    ctx.fillStyle = sky;
    ctx.fillRect(10, 10, w - 20, 108);
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(82, 42, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c6d6b';
    ctx.beginPath();
    ctx.moveTo(10, 118);
    ctx.lineTo(44, 72);
    ctx.lineTo(78, 118);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#364f52';
    ctx.beginPath();
    ctx.moveTo(54, 118);
    ctx.lineTo(92, 66);
    ctx.lineTo(w - 10, 118);
    ctx.closePath();
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeWovenTexture(THREE, kit, baseCol) {
  const dark = shiftHSL(THREE, baseCol, -0.01, 0.05, -0.16);
  const light = shiftHSL(THREE, baseCol, 0.01, -0.04, 0.1);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseCol.getStyle();
    ctx.fillRect(0, 0, w, h);
    const cell = 16;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const odd = (((x / cell) + (y / cell)) & 1) === 1;
        ctx.fillStyle = odd ? light.getStyle() : dark.getStyle();
        if (odd) ctx.fillRect(x + 1, y + 3, cell - 2, cell - 6);
        else ctx.fillRect(x + 3, y + 1, cell - 6, cell - 2);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  return map;
}

// ---------------------------------------------------------------------------
// Core Procedural Geometry Builders
// ---------------------------------------------------------------------------

function applyBoxUVs(geo, grainAxis = 'y', scale = 1.45) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) {
      u = z * scale; v = y * scale;
    } else if (ay >= ax && ay >= az) {
      u = x * scale; v = z * scale;
    } else {
      u = x * scale; v = y * scale;
    }
    if (grainAxis === 'x') {
      const tmp = u; u = v; v = tmp;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

function makeChamferedBlock(THREE, w, h, d, bevel = 0.006, grainAxis = 'y') {
  const b = Math.min(bevel, w * 0.22, h * 0.22, d * 0.35);
  const iw = Math.max(0.001, w - b * 2);
  const ih = Math.max(0.001, h - b * 2);
  const id = Math.max(0.001, d - b * 2);
  const r = Math.min(b * 0.85, iw * 0.25, ih * 0.25);

  const shape = new THREE.Shape();
  const hw = iw * 0.5, hh = ih * 0.5;
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
    depth: id,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 2
  });
  geo.center();
  geo.computeVertexNormals();
  applyBoxUVs(geo, grainAxis);
  return geo;
}

function makeArchedPanel(THREE, w, h, d, archRise = 0.042, bevel = 0.011, grainAxis = 'y') {
  const b = Math.min(bevel, w * 0.14, h * 0.14, d * 0.42);
  const iw = Math.max(0.01, w - b * 2);
  const ih = Math.max(0.01, h - b * 2);
  const id = Math.max(0.002, d - b * 2);
  const hw = iw * 0.5, hh = ih * 0.5;
  const ar = Math.min(archRise, ih * 0.22);

  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh - ar);
  shape.bezierCurveTo(hw, hh - ar * 0.15, hw * 0.46, hh, 0, hh);
  shape.bezierCurveTo(-hw * 0.46, hh, -hw, hh - ar * 0.15, -hw, hh - ar);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 14
  });
  geo.translate(0, 0, -id * 0.5);
  geo.computeVertexNormals();
  applyBoxUVs(geo, grainAxis);
  return geo;
}

function makeMitredMoulding(THREE, baseW, baseD, profilePts, backFlush = true) {
  // profilePts: [[outOffset, y], ...] from bottom to top
  const hx = baseW * 0.5;
  const hz = baseD * 0.5;
  const m = profilePts.length;

  const positions = [];
  const uvs = [];
  const indices = [];

  function corner(side, k) {
    const [o, y] = profilePts[k];
    const zBack = backFlush ? -hz : -hz - o;
    if (side === 0) return [-hx - o, y, hz + o];      // FL
    if (side === 1) return [hx + o, y, hz + o];       // FR
    if (side === 2) return [hx + o, y, zBack];        // BR
    return [-hx - o, y, zBack];                       // BL
  }

  // 4 vertical perimeter strips with crisp 90-deg mitred corners
  for (let s = 0; s < 4; s++) {
    const sNext = (s + 1) % 4;
    const baseIdx = positions.length / 3;
    for (let k = 0; k < m; k++) {
      const p0 = corner(s, k);
      const p1 = corner(sNext, k);
      const vCoord = k / (m - 1);
      positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
      uvs.push(0, vCoord * 0.35, 1.3, vCoord * 0.35);
    }
    for (let k = 0; k < m - 1; k++) {
      const a = baseIdx + k * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Top cap (+Y)
  const topBase = positions.length / 3;
  for (let s = 0; s < 4; s++) {
    const p = corner(s, m - 1);
    positions.push(p[0], p[1], p[2]);
    uvs.push((p[0] + 0.5) * 1.4, (p[2] + 0.3) * 1.4);
  }
  indices.push(topBase, topBase + 1, topBase + 2, topBase, topBase + 2, topBase + 3);

  // Bottom cap (-Y)
  const botBase = positions.length / 3;
  for (let s = 0; s < 4; s++) {
    const p = corner(s, 0);
    positions.push(p[0], p[1], p[2]);
    uvs.push((p[0] + 0.5) * 1.4, (p[2] + 0.3) * 1.4);
  }
  indices.push(botBase, botBase + 2, botBase + 1, botBase, botBase + 3, botBase + 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, capStart = true, capEnd = true) {
  const pts = curve.getSpacedPoints(tubularSegments);
  const tangents = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    tangents.push(curve.getTangent(t).normalize());
  }

  // Parallel-transport frames so tubes never twist or pinch
  const normals = [];
  const binormals = [];
  const ref = Math.abs(tangents[0].y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, tangents[0]).normalize();
  normals.push(n0);
  binormals.push(new THREE.Vector3().crossVectors(tangents[0], n0).normalize());

  const axis = new THREE.Vector3();
  for (let i = 1; i <= tubularSegments; i++) {
    const nPrev = normals[i - 1].clone();
    axis.crossVectors(tangents[i - 1], tangents[i]);
    if (axis.lengthSq() > 1e-10) {
      axis.normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, tangents[i - 1].dot(tangents[i]))));
      nPrev.applyAxisAngle(axis, angle);
    }
    nPrev.addScaledVector(tangents[i], -nPrev.dot(tangents[i])).normalize();
    normals.push(nPrev);
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], nPrev).normalize());
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const P = pts[i];
    const N = normals[i];
    const B = binormals[i];
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const r = typeof radiusFn === 'function' ? radiusFn(t, theta) : radiusFn;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const px = P.x + (N.x * cos + B.x * sin) * r;
      const py = P.y + (N.y * cos + B.y * sin) * r;
      const pz = P.z + (N.z * cos + B.z * sin) * r;
      positions.push(px, py, pz);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + j + 1;
      const d = i * ringStride + j + 1;
      indices.push(a, d, b, d, c, b);
    }
  }

  if (capStart) {
    const cIdx = positions.length / 3;
    positions.push(pts[0].x, pts[0].y, pts[0].z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(cIdx, j + 1, j);
    }
  }
  if (capEnd) {
    const cIdx = positions.length / 3;
    const endP = pts[tubularSegments];
    const ringOff = tubularSegments * ringStride;
    positions.push(endP.x, endP.y, endP.z);
    uvs.push(0.5, 1);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(cIdx, ringOff + j, ringOff + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeTurnedFootGeo(THREE) {
  // 26-point lathe profile: floor pad -> ankle -> plump bun -> incised bead -> graceful cove -> upper collar
  const pts = [
    [0.000, 0.000],
    [0.017, 0.000],
    [0.020, 0.004],
    [0.019, 0.011],
    [0.023, 0.017],
    [0.030, 0.024],
    [0.036, 0.033],
    [0.039, 0.043],
    [0.038, 0.053],
    [0.034, 0.061],
    [0.027, 0.067],
    [0.023, 0.071],
    [0.029, 0.075],
    [0.032, 0.078],
    [0.029, 0.081],
    [0.024, 0.084],
    [0.025, 0.089],
    [0.030, 0.094],
    [0.036, 0.098],
    [0.040, 0.102],
    [0.040, 0.108],
    [0.000, 0.108]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  return geo;
}

function makeRosetteGeo(THREE, radius = 0.014, depth = 0.008) {
  const pts = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = radius * (1 - t * 0.72) + Math.sin(t * Math.PI * 2) * radius * 0.08;
    const y = t * depth;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function makeShapedHandle(THREE, metalMat, vertical = true, span = 0.13) {
  const g = new THREE.Group();
  const half = span * 0.5;
  const proj = vertical ? 0.028 : 0.024;

  const ctrlPts = vertical
    ? [
        new THREE.Vector3(0, -half, 0.001),
        new THREE.Vector3(0, -half * 0.78, proj * 0.72),
        new THREE.Vector3(0, -half * 0.34, proj),
        new THREE.Vector3(0, 0, proj * 1.08),
        new THREE.Vector3(0, half * 0.34, proj),
        new THREE.Vector3(0, half * 0.78, proj * 0.72),
        new THREE.Vector3(0, half, 0.001)
      ]
    : [
        new THREE.Vector3(-half, 0, 0.001),
        new THREE.Vector3(-half * 0.78, 0, proj * 0.72),
        new THREE.Vector3(-half * 0.34, 0, proj),
        new THREE.Vector3(0, 0, proj * 1.08),
        new THREE.Vector3(half * 0.34, 0, proj),
        new THREE.Vector3(half * 0.78, 0, proj * 0.72),
        new THREE.Vector3(half, 0, 0.001)
      ];

  const curve = new THREE.CatmullRomCurve3(ctrlPts);
  const pullGeo = makeTaperedTube(THREE, curve, 28, 12, (t) => {
    const bell = Math.sin(t * Math.PI);
    const swell = Math.pow(bell, 0.65);
    const collar = (t < 0.08 || t > 0.92) ? 0.0016 : 0;
    return 0.0044 + swell * 0.0038 + collar;
  });
  g.add(tagMesh(new THREE.Mesh(pullGeo, metalMat), 'accent'));

  const rosGeo = makeRosetteGeo(THREE, 0.012, 0.006);
  const m1 = tagMesh(new THREE.Mesh(rosGeo, metalMat), 'accent');
  const m2 = tagMesh(new THREE.Mesh(rosGeo, metalMat), 'accent');
  if (vertical) {
    m1.position.set(0, -half, 0);
    m2.position.set(0, half, 0);
  } else {
    m1.position.set(-half, 0, 0);
    m2.position.set(half, 0, 0);
  }
  g.add(m1, m2);
  return g;
}

function makeBrassHinge(THREE, metalMat) {
  const g = new THREE.Group();
  const pinPts = [
    [0.000, -0.032], [0.0055, -0.030], [0.0065, -0.025], [0.0048, -0.021],
    [0.0055, -0.018], [0.0055, 0.018], [0.0048, 0.021], [0.0065, 0.025],
    [0.0055, 0.030], [0.000, 0.032]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const pinGeo = new THREE.LatheGeometry(pinPts, 14);
  g.add(tagMesh(new THREE.Mesh(pinGeo, metalMat), 'accent'));
  return g;
}

// ---------------------------------------------------------------------------
// Hero Props: Hanging Clothes, Shoes, Blanket, Basket, Suitcase
// ---------------------------------------------------------------------------

function makeSculptedGarment(THREE, style, fabricMat, trimMat, metalMat) {
  const g = new THREE.Group();
  // Oriented with shoulders spanning Z (-halfW..+halfW) and cloth thickness along X
  const len = style.length || 0.62;
  const shoulderHalf = style.shoulderHalf || 0.165;
  const thick = style.thick || 0.036;
  const flare = style.flare || 1.12;
  const folds = style.folds || 6;
  const seed = style.seed || 0.5;

  // Continuous sculpted draped torso built from a dense parametric grid
  const uSegs = 32;
  const vSegs = 22;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs; // 0 = top shoulder/collar, 1 = bottom hem
    // Shoulder cap opens rapidly then drapes straight with gentle flare
    const capT = Math.min(1, v / 0.15);
    const shoulderCurve = Math.sin(capT * Math.PI * 0.5);
    const waistDip = 1 - Math.sin(v * Math.PI) * (style.waist || 0.07);
    const hemFlare = 1 + Math.pow(v, 1.8) * (flare - 1);
    const zRad = (0.042 + (shoulderHalf - 0.042) * shoulderCurve) * waistDip * hemFlare;
    const xRad = (0.016 + (thick - 0.016) * Math.pow(shoulderCurve, 0.6)) * (1 + v * 0.28);
    const yBase = -v * len;

    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // Soft natural hanging drapery folds growing toward bottom hem
      const foldAmp = Math.pow(v, 1.35) * 0.011;
      const pleat =
        Math.sin(theta * folds + seed * 4.2) * foldAmp +
        Math.cos(theta * (folds - 2) - seed * 2.7 + v * 1.4) * foldAmp * 0.45;

      // Slight vertical hem undulation & shoulder slope
      const shoulderSlope = (1 - capT) * (1 - Math.abs(cos)) * 0.022;
      const hemWave = Math.pow(v, 2.2) * Math.sin(theta * folds + seed * 3.1) * 0.008;

      const px = (xRad + pleat) * cos;
      const pz = (zRad + pleat * 0.7) * sin;
      const py = yBase - shoulderSlope + hemWave;

      positions.push(px, py, pz);
      uvs.push(u * 2.0, v * 1.8);
    }
  }

  const stride = uSegs + 1;
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = iv * stride + iu;
      const b = (iv + 1) * stride + iu;
      const c = (iv + 1) * stride + iu + 1;
      const d = iv * stride + iu + 1;
      indices.push(a, d, b, d, c, b);
    }
  }

  // Close top neckline softly so it reads solid from above
  const topCenter = positions.length / 3;
  positions.push(0, -0.012, 0);
  uvs.push(0.5, 0);
  for (let iu = 0; iu < uSegs; iu++) {
    indices.push(topCenter, iu + 1, iu);
  }

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();
  g.add(tagMesh(new THREE.Mesh(bodyGeo, fabricMat), style.slot || 'secondary'));

  // Sculpted sleeves (tapered oval tubes overlapping deeply into shoulders)
  if (style.sleeves !== false) {
    const sleeveLen = len * (style.sleeveRatio || 0.78);
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.035, side * (shoulderHalf * 0.72)),
        new THREE.Vector3(side * 0.006, -0.085, side * (shoulderHalf * 1.02)),
        new THREE.Vector3(side * 0.010, -sleeveLen * 0.55, side * (shoulderHalf * 0.99)),
        new THREE.Vector3(side * 0.005, -sleeveLen, side * (shoulderHalf * 0.93))
      ]);
      const slGeo = makeTaperedTube(THREE, curve, 16, 12, (t, th) => {
        const r = (0.044 * (1 - t * 0.34)) * (1 + Math.sin(t * Math.PI) * 0.08);
        // Slightly flattened sleeve oval
        return r * (0.76 + 0.24 * Math.abs(Math.sin(th)));
      });
      g.add(tagMesh(new THREE.Mesh(slGeo, fabricMat), style.slot || 'secondary'));

      // Soft ribbed cuff band
      if (trimMat) {
        const cuffCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.006, -sleeveLen + 0.03, side * (shoulderHalf * 0.94)),
          new THREE.Vector3(side * 0.005, -sleeveLen - 0.008, side * (shoulderHalf * 0.925))
        ]);
        const cuffGeo = makeTaperedTube(THREE, cuffCurve, 5, 12, (t, th) => {
          return 0.029 * (0.78 + 0.22 * Math.abs(Math.sin(th)));
        });
        g.add(tagMesh(new THREE.Mesh(cuffGeo, trimMat), 'secondary'));
      }
    }
  }

  // Sculpted collar ring around neck
  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.022, 0.004, 0),
    new THREE.Vector3(0.012, 0.008, 0.044),
    new THREE.Vector3(-0.020, 0.010, 0.036),
    new THREE.Vector3(-0.024, 0.010, -0.036),
    new THREE.Vector3(0.012, 0.008, -0.044)
  ], true);
  const colGeo = makeTaperedTube(THREE, collarCurve, 20, 8, (t) => 0.011 + Math.sin(t * Math.PI) * 0.004, false, false);
  g.add(tagMesh(new THREE.Mesh(colGeo, trimMat || fabricMat), style.slot || 'secondary'));

  // Optional tiny brass/wood buttons along the front-edge placket
  if (style.buttons && metalMat) {
    const btnGeo = new THREE.SphereGeometry(0.0055, 10, 8);
    btnGeo.scale(0.5, 1, 1);
    for (let i = 0; i < 4; i++) {
      const btn = tagMesh(new THREE.Mesh(btnGeo, metalMat), 'accent');
      btn.position.set(thick * 1.02, -0.09 - i * 0.11, 0);
      g.add(btn);
    }
  }

  return g;
}

function makeHangerWithClothes(THREE, woodMat, metalMat, style, fabricMat, trimMat) {
  // Pivot is at (0, 0, 0) = centre of the brass hanging rail!
  const pivot = new THREE.Group();

  // Curved brass hook looping over the rail
  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.004, -0.013),
    new THREE.Vector3(0, 0.016, 0),
    new THREE.Vector3(0, 0.006, 0.014),
    new THREE.Vector3(0, -0.014, 0.008),
    new THREE.Vector3(0, -0.036, 0),
    new THREE.Vector3(0, -0.056, 0)
  ]);
  const hookGeo = makeTaperedTube(THREE, hookCurve, 18, 8, (t) => 0.0024 + (t > 0.85 ? 0.001 : 0));
  pivot.add(tagMesh(new THREE.Mesh(hookGeo, metalMat), 'accent'));

  // Curved wooden hanger shoulder bar
  const barCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.098, -0.172),
    new THREE.Vector3(0, -0.072, -0.092),
    new THREE.Vector3(0, -0.055, 0),
    new THREE.Vector3(0, -0.072, 0.092),
    new THREE.Vector3(0, -0.098, 0.172)
  ]);
  const barGeo = makeTaperedTube(THREE, barCurve, 22, 10, (t, th) => {
    const base = 0.0075 + Math.sin(t * Math.PI) * 0.0035;
    return base * (0.72 + 0.28 * Math.abs(Math.sin(th)));
  });
  pivot.add(tagMesh(new THREE.Mesh(barGeo, woodMat), 'secondary'));

  // Hanging garment nestled onto the wooden hanger shoulders
  const garment = makeSculptedGarment(THREE, style, fabricMat, trimMat, metalMat);
  garment.position.set(0, -0.068, 0);
  pivot.add(garment);

  return pivot;
}

function makeSculptedShoe(THREE, upperMat, soleMat, accentMat, isBoot = false) {
  const g = new THREE.Group();
  const bootH = isBoot ? 0.125 : 0.088;

  // Sculpted continuous upper from dense displaced sphere
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); // width (-1..1)
    let y = pos.getY(i); // height (-1..1)
    let z = pos.getZ(i); // length (-1 heel .. +1 toe)

    // Length & width shaping
    let lenZ = z * 0.118;
    let widX = x * (0.044 - Math.max(0, z) * 0.006);

    // Toe box lowers gracefully, ankle collar rises at heel
    let heightY;
    if (y > 0) {
      const ankleFactor = Math.max(0, 0.25 - z) / 1.25;
      const topH = 0.036 + Math.pow(ankleFactor, 1.35) * (bootH - 0.036);
      heightY = y * topH;
      // Slight ankle collar indentation at very top back
      if (y > 0.72 && z < 0.08 && Math.abs(x) < 0.55) {
        heightY -= (y - 0.72) * 0.045;
      }
    } else {
      // Flat underside resting on sole
      heightY = y * 0.006;
    }

    // Subtle medial/lateral ergonomic curve
    widX += Math.sin(z * 1.4) * 0.003;

    pos.setXYZ(i, widX, heightY + 0.017, lenZ);
  }
  geo.computeVertexNormals();
  g.add(tagMesh(new THREE.Mesh(geo, upperMat), isBoot ? 'secondary' : 'primary'));

  // Sculpted vulcanized rubber sole / boot outsole
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-0.036, -0.116);
  soleShape.bezierCurveTo(-0.047, -0.04, -0.049, 0.06, -0.038, 0.112);
  soleShape.bezierCurveTo(-0.018, 0.128, 0.018, 0.128, 0.038, 0.112);
  soleShape.bezierCurveTo(0.049, 0.06, 0.047, -0.04, 0.036, -0.116);
  soleShape.bezierCurveTo(0.018, -0.126, -0.018, -0.126, -0.036, -0.116);

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 14
  });
  soleGeo.rotateX(Math.PI * 0.5);
  soleGeo.translate(0, 0.018, 0);
  soleGeo.computeVertexNormals();
  g.add(tagMesh(new THREE.Mesh(soleGeo, soleMat), 'secondary'));

  // Shoelaces (sneakers) or heel pull loop (boots)
  if (!isBoot) {
    for (let i = 0; i < 3; i++) {
      const zOff = 0.02 + i * 0.022;
      const yOff = 0.064 - i * 0.008;
      const laceCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.022, yOff, zOff),
        new THREE.Vector3(0, yOff + 0.007, zOff + 0.004),
        new THREE.Vector3(0.022, yOff, zOff)
      ]);
      const laceGeo = makeTaperedTube(THREE, laceCurve, 10, 6, 0.0032);
      g.add(tagMesh(new THREE.Mesh(laceGeo, accentMat), 'accent'));
    }
  } else {
    const loopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, bootH + 0.004, -0.098),
      new THREE.Vector3(0, bootH + 0.026, -0.114),
      new THREE.Vector3(0, bootH + 0.006, -0.108)
    ]);
    const loopGeo = makeTaperedTube(THREE, loopCurve, 10, 6, 0.0032);
    g.add(tagMesh(new THREE.Mesh(loopGeo, accentMat), 'accent'));
  }

  return g;
}

function makeFoldedBlanket(THREE, mat1, mat2, w = 0.22, d = 0.24, layers = 2) {
  const g = new THREE.Group();
  const layerH = 0.042;
  for (let l = 0; l < layers; l++) {
    const geo = new THREE.SphereGeometry(1, 32, 20);
    const pos = geo.attributes.position;
    const hw = w * (0.5 - l * 0.03);
    const hd = d * (0.5 - l * 0.03);
    const hh = layerH * 0.5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.52) * hw;
      const sy = Math.sign(y) * Math.pow(Math.abs(y), 0.62) * hh;
      const sz = Math.sign(z) * Math.pow(Math.abs(z), 0.52) * hd;
      const wrinkle = Math.sin(sx * 42 + l * 2.1) * Math.cos(sz * 34) * 0.0022;
      pos.setXYZ(i, sx, sy + wrinkle, sz);
    }
    geo.computeVertexNormals();
    const mesh = tagMesh(new THREE.Mesh(geo, l % 2 === 0 ? mat1 : mat2), l % 2 === 0 ? 'primary' : 'secondary');
    mesh.position.set((l - 0.5) * 0.005, hh + l * (layerH * 0.88), 0);
    mesh.rotation.y = l * 0.07;
    g.add(mesh);
  }
  return g;
}

function makeWovenBasket(THREE, basketMat, rimMat, rBottom = 0.105, rTop = 0.132, h = 0.155) {
  const g = new THREE.Group();
  const pts = [
    [0.000, 0.000],
    [rBottom * 0.92, 0.000],
    [rBottom, 0.010],
    [rBottom + (rTop - rBottom) * 0.28, h * 0.28],
    [rBottom + (rTop - rBottom) * 0.65, h * 0.62],
    [rTop * 0.99, h * 0.88],
    [rTop * 1.03, h * 0.96],
    [rTop * 0.99, h],
    [rTop * 0.92, h],
    [rTop * 0.88, h * 0.88],
    [rBottom * 0.86, 0.020],
    [0.000, 0.020]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  g.add(tagMesh(new THREE.Mesh(geo, basketMat), 'secondary'));

  // Braided rope handles on left and right sides
  for (const side of [-1, 1]) {
    const hCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * rTop * 0.97, h * 0.93, -0.042),
      new THREE.Vector3(side * (rTop + 0.015), h * 1.05, 0),
      new THREE.Vector3(side * rTop * 0.97, h * 0.93, 0.042)
    ]);
    const hGeo = makeTaperedTube(THREE, hCurve, 14, 8, 0.0065);
    g.add(tagMesh(new THREE.Mesh(hGeo, rimMat), 'accent'));
  }
  return g;
}

function makeVintageSuitcase(THREE, kit, leatherCol, strapCol, metalMat, finish) {
  const g = new THREE.Group();
  g.name = 'suitcase';

  const sw = 0.54;
  const sh = 0.215;
  const sd = 0.35;

  const tex = makeSuitcaseTextures(THREE, kit, leatherCol, strapCol);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: 0.0028,
    roughness: clamp01(0.58 + finish.roughnessBias),
    metalness: 0.02,
    sheen: 0.35,
    sheenRoughness: 0.7,
    sheenColor: shiftHSL(THREE, leatherCol, 0, -0.08, 0.2),
    clearcoat: clamp01(0.16 + finish.clearcoatBias),
    clearcoatRoughness: 0.45
  });

  const strapMat = new THREE.MeshPhysicalMaterial({
    color: strapCol,
    bumpMap: tex.bump,
    bumpScale: 0.0022,
    roughness: clamp01(0.54 + finish.roughnessBias),
    sheen: 0.3,
    sheenColor: shiftHSL(THREE, strapCol, 0, -0.05, 0.22),
    clearcoat: clamp01(0.14 + finish.clearcoatBias)
  });

  // 1. Sculpted continuous vintage hard-shell suitcase from dense superellipsoid sphere
  const bodyGeo = new THREE.SphereGeometry(1, 48, 32);
  const pos = bodyGeo.attributes.position;
  const uvs = bodyGeo.attributes.uv;
  const p = 4.6;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
    let sx = Math.sign(nx) * Math.pow(Math.abs(nx), 2 / p) * (sw * 0.5);
    let sy = Math.sign(ny) * Math.pow(Math.abs(ny), 2 / p) * (sh * 0.5);
    let sz = Math.sign(nz) * Math.pow(Math.abs(nz), 2 / p) * (sd * 0.5);

    // Subtle vintage cushion puff on top lid, flatter stable base
    if (ny > 0.2) {
      sy += (1 - (sx * sx) / (sw * sw * 0.32) - (sz * sz) / (sd * sd * 0.32)) * 0.006 * ny;
    } else if (ny < -0.65) {
      sy = Math.max(sy, -sh * 0.485);
    }

    // Crisp equatorial lid-split groove around y = +0.012
    const grooveDist = Math.abs(sy - 0.012);
    if (grooveDist < 0.010) {
      const indent = (1 - grooveDist / 0.010) * 0.0055;
      const radialLen = Math.hypot(sx, sz) || 1;
      sx -= (sx / radialLen) * indent;
      sz -= (sz / radialLen) * indent;
    }

    pos.setXYZ(i, sx, sy + sh * 0.5, sz);

    // Planar-friendly top/front UV so travel stickers sit crisp on top lid!
    if (ny > 0.28) {
      uvs.setXY(i, (sx / sw) + 0.5, 0.5 - (sz / sd) * 0.65);
    }
  }
  bodyGeo.computeVertexNormals();
  g.add(tagMesh(new THREE.Mesh(bodyGeo, bodyMat), 'secondary'));

  // 2. Brass valance trim ring along the lid split
  const rimPts = [];
  const rimSteps = 36;
  for (let i = 0; i < rimSteps; i++) {
    const a = (i / rimSteps) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rx = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p) * (sw * 0.496);
    const rz = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p) * (sd * 0.496);
    rimPts.push(new THREE.Vector3(rx, sh * 0.5 + 0.012, rz));
  }
  const rimCurve = new THREE.CatmullRomCurve3(rimPts, true);
  const rimGeo = makeTaperedTube(THREE, rimCurve, 48, 8, 0.0038, false, false);
  g.add(tagMesh(new THREE.Mesh(rimGeo, metalMat), 'accent'));

  // 3. Twin wrapped leather cinch straps with brass buckles
  const strapXs = [-0.152, 0.152];
  for (const sx of strapXs) {
    const sPts = [];
    const sSteps = 32;
    for (let i = 0; i < sSteps; i++) {
      const a = (i / sSteps) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const ry = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p) * (sh * 0.505) + sh * 0.5;
      const rz = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p) * (sd * 0.506);
      sPts.push(new THREE.Vector3(sx, Math.max(0.004, ry), rz));
    }
    const strapCurve = new THREE.CatmullRomCurve3(sPts, true);
    const strapGeo = makeTaperedTube(THREE, strapCurve, 44, 10, (t, th) => {
      // Flattened wide leather belt profile (wide in X, thin radially)
      const cx = Math.cos(th), sy = Math.sin(th);
      return 0.0045 + Math.abs(cx) * 0.0005 + Math.abs(sy) * 0.0145;
    }, false, false);
    g.add(tagMesh(new THREE.Mesh(strapGeo, strapMat), 'primary'));

    // Brass buckle frame on front face (+Z)
    const buckle = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, 0.036, 0.028, 0.011, 0.0025), metalMat), 'accent');
    buckle.position.set(sx, sh * 0.52, sd * 0.504);
    g.add(buckle);

    // Brass pin bar across buckle
    const pin = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, 0.026, 0.005, 0.014, 0.001), metalMat), 'accent');
    pin.position.set(sx, sh * 0.52, sd * 0.507);
    g.add(pin);
  }

  // 4. Reinforced leather corner protectors with tiny brass rivets
  const cornerGeo = new THREE.SphereGeometry(0.044, 16, 12);
  const cPos = cornerGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const x = cPos.getX(i), y = cPos.getY(i), z = cPos.getZ(i);
    cPos.setXYZ(
      i,
      Math.sign(x) * Math.pow(Math.abs(x) / 0.044, 0.65) * 0.044,
      Math.sign(y) * Math.pow(Math.abs(y) / 0.044, 0.65) * 0.036,
      Math.sign(z) * Math.pow(Math.abs(z) / 0.044, 0.65) * 0.044
    );
  }
  cornerGeo.computeVertexNormals();
  const rivetGeo = new THREE.SphereGeometry(0.0042, 8, 6);

  for (const cx of [-1, 1]) {
    for (const cy of [-1, 1]) {
      for (const cz of [-1, 1]) {
        const cap = tagMesh(new THREE.Mesh(cornerGeo, strapMat), 'primary');
        cap.position.set(
          cx * (sw * 0.5 - 0.036),
          sh * 0.5 + cy * (sh * 0.5 - 0.030),
          cz * (sd * 0.5 - 0.036)
        );
        g.add(cap);

        if (cy > 0) {
          const riv = tagMesh(new THREE.Mesh(rivetGeo, metalMat), 'accent');
          riv.position.set(
            cx * (sw * 0.5 - 0.028),
            sh - 0.002,
            cz * (sd * 0.5 - 0.028)
          );
          g.add(riv);
        }
      }
    }
  }

  // 5. Twin brass drawbolt clasps flanking the front handle
  for (const side of [-1, 1]) {
    const clasp = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, 0.026, 0.042, 0.012, 0.003), metalMat), 'accent');
    clasp.position.set(side * 0.095, sh * 0.5 + 0.012, sd * 0.502);
    g.add(clasp);
  }

  // 6. Sculpted stitched leather carry handle on front (+Z) face
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.056, sh * 0.48, sd * 0.496),
    new THREE.Vector3(-0.052, sh * 0.48, sd * 0.542),
    new THREE.Vector3(-0.022, sh * 0.48, sd * 0.562),
    new THREE.Vector3(0.022, sh * 0.48, sd * 0.562),
    new THREE.Vector3(0.052, sh * 0.48, sd * 0.542),
    new THREE.Vector3(0.056, sh * 0.48, sd * 0.496)
  ]);
  const handleGeo = makeTaperedTube(THREE, handleCurve, 24, 10, (t) => {
    return 0.0075 + Math.sin(t * Math.PI) * 0.0045;
  });
  g.add(tagMesh(new THREE.Mesh(handleGeo, strapMat), 'primary'));

  const loopGeo = new THREE.TorusGeometry(0.011, 0.0028, 8, 16);
  for (const side of [-1, 1]) {
    const loop = tagMesh(new THREE.Mesh(loopGeo, metalMat), 'accent');
    loop.position.set(side * 0.056, sh * 0.48, sd * 0.503);
    loop.rotation.y = Math.PI * 0.5;
    g.add(loop);
  }

  // 7. Dangling luggage tag hanging slightly forward over the cornice lip (animated in idle)
  const tagPivot = new THREE.Group();
  tagPivot.name = 'luggageTag';
  tagPivot.position.set(0.056, sh * 0.47, sd * 0.525);

  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.006, -0.028, 0.014),
    new THREE.Vector3(0.009, -0.058, 0.020)
  ]);
  tagPivot.add(tagMesh(new THREE.Mesh(makeTaperedTube(THREE, cordCurve, 10, 6, 0.0022), strapMat), 'primary'));

  const tagShape = new THREE.Shape();
  tagShape.moveTo(-0.018, -0.036);
  tagShape.lineTo(0.018, -0.036);
  tagShape.lineTo(0.018, 0.018);
  tagShape.lineTo(0.008, 0.030);
  tagShape.lineTo(-0.008, 0.030);
  tagShape.lineTo(-0.018, 0.018);
  tagShape.closePath();

  const tagGeo = new THREE.ExtrudeGeometry(tagShape, {
    depth: 0.003,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 2
  });
  // Gently bend the leather tag so it isn't flat
  const tPos = tagGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const ty = tPos.getY(i);
    tPos.setZ(i, tPos.getZ(i) + Math.sin((ty + 0.036) * 28) * 0.0025);
  }
  tagGeo.computeVertexNormals();

  const tagCardMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4e7cc,
    roughness: 0.78,
    sheen: 0.35
  });
  const tagMeshObj = tagMesh(new THREE.Mesh(tagGeo, tagCardMat), 'secondary');
  tagMeshObj.position.set(0.010, -0.086, 0.021);
  tagMeshObj.rotation.y = 0.25;
  tagPivot.add(tagMeshObj);

  g.add(tagPivot);
  return g;
}

function makeSideScarf(THREE, scarfMat, woodMat) {
  const g = new THREE.Group();
  // Turned wooden peg mounted to right side panel
  const pegPts = [
    [0.000, 0.000], [0.015, 0.000], [0.015, 0.006], [0.008, 0.010],
    [0.007, 0.032], [0.012, 0.038], [0.012, 0.044], [0.000, 0.046]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const pegGeo = new THREE.LatheGeometry(pegPts, 16);
  pegGeo.rotateZ(-Math.PI * 0.5);
  g.add(tagMesh(new THREE.Mesh(pegGeo, woodMat), 'secondary'));

  // Soft draped scarf hanging from the peg (animated gently in idle)
  const scarfPivot = new THREE.Group();
  scarfPivot.name = 'sideScarf';
  scarfPivot.position.set(0.024, 0, 0);

  for (const strand of [0, 1]) {
    const sCurve = new THREE.CatmullRomCurve3(
      strand === 0
        ? [
            new THREE.Vector3(0, 0.008, -0.014),
            new THREE.Vector3(0.016, -0.055, -0.018),
            new THREE.Vector3(0.012, -0.185, -0.008),
            new THREE.Vector3(0.022, -0.315, -0.016)
          ]
        : [
            new THREE.Vector3(0, 0.008, 0.014),
            new THREE.Vector3(0.018, -0.065, 0.020),
            new THREE.Vector3(0.022, -0.215, 0.012),
            new THREE.Vector3(0.014, -0.375, 0.024)
          ]
    );
    const sGeo = makeTaperedTube(THREE, sCurve, 22, 10, (t, th) => {
      const base = 0.016 + Math.sin(t * Math.PI * 0.85) * 0.005;
      return base * (0.42 + 0.58 * Math.abs(Math.sin(th)));
    });
    scarfPivot.add(tagMesh(new THREE.Mesh(sGeo, scarfMat), 'primary'));
  }

  g.add(scarfPivot);
  return g;
}

// ---------------------------------------------------------------------------
// Door Builder (Panelled Wood or Painted / Mirror Door)
// ---------------------------------------------------------------------------

function makeWardrobeDoor(THREE, kit, cfg) {
  const {
    w, h, thickness,
    isRight, isMirror,
    frameMat, panelMat, innerTrimMat, metalMat,
    mirrorMat, postcardMat
  } = cfg;

  const pivot = new THREE.Group();
  pivot.name = isRight ? 'doorR' : 'doorL';

  // Local coordinates: hinge along x = 0; door extends toward -x (right door) or +x (left door)
  const dir = isRight ? -1 : 1;
  const cx = dir * (w * 0.5);
  const stileW = 0.054;
  const topRailH = 0.062;
  const botRailH = 0.068;
  const midRailH = 0.050;
  const midRailY = 0.36;

  // Vertical stiles
  const stileGeo = makeChamferedBlock(THREE, stileW, h, thickness, 0.0045, 'y');
  const outerStile = tagMesh(new THREE.Mesh(stileGeo, frameMat), 'primary');
  outerStile.position.set(dir * (stileW * 0.5), h * 0.5, 0);
  const innerStile = tagMesh(new THREE.Mesh(stileGeo, frameMat), 'primary');
  innerStile.position.set(dir * (w - stileW * 0.5), h * 0.5, 0);
  pivot.add(outerStile, innerStile);

  const railSpan = w - stileW * 2 + 0.004;
  // Top & bottom rails
  const topRail = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, railSpan, topRailH, thickness, 0.0045, 'x'), frameMat), 'primary');
  topRail.position.set(cx, h - topRailH * 0.5, 0);
  const botRail = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, railSpan, botRailH, thickness, 0.0045, 'x'), frameMat), 'primary');
  botRail.position.set(cx, botRailH * 0.5, 0);
  pivot.add(topRail, botRail);

  const panelW = w - stileW * 2 + 0.006;

  if (isMirror) {
    // Full-length recessed mirror backing + glowing bevelled glass pane + cute tucked dorm postcard
    const openH = h - topRailH - botRailH + 0.006;
    const backBoard = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, panelW, openH, 0.008, 0.002, 'y'), innerTrimMat), 'secondary');
    backBoard.position.set(cx, botRailH + openH * 0.5 - 0.003, -0.004);
    pivot.add(backBoard);

    const glassGeo = makeArchedPanel(THREE, panelW - 0.012, openH - 0.012, 0.008, 0.048, 0.004, 'y');
    const glassMesh = tagMesh(new THREE.Mesh(glassGeo, mirrorMat), 'accent', false, true);
    glassMesh.position.set(cx, botRailH + openH * 0.5 - 0.003, 0.004);
    pivot.add(glassMesh);

    // Arched inner bezel moulding above the mirror
    const archTrimGeo = makeArchedPanel(THREE, panelW + 0.002, openH + 0.002, 0.010, 0.052, 0.005, 'y');
    const archBack = tagMesh(new THREE.Mesh(archTrimGeo, frameMat), 'primary');
    archBack.position.set(cx, botRailH + openH * 0.5 - 0.003, -0.001);
    pivot.add(archBack);

    // Cute slightly curved dorm postcard tucked into bottom-right corner of mirror frame
    const cardShape = new THREE.Shape();
    cardShape.moveTo(-0.036, -0.046);
    cardShape.lineTo(0.036, -0.046);
    cardShape.lineTo(0.036, 0.046);
    cardShape.lineTo(-0.036, 0.046);
    cardShape.closePath();
    const cardGeo = new THREE.ExtrudeGeometry(cardShape, {
      depth: 0.0018,
      bevelEnabled: true,
      bevelThickness: 0.0005,
      bevelSize: 0.0005,
      bevelSegments: 1
    });
    const cPos = cardGeo.attributes.position;
    const cUv = cardGeo.attributes.uv;
    for (let i = 0; i < cPos.count; i++) {
      const x = cPos.getX(i), y = cPos.getY(i);
      cPos.setZ(i, cPos.getZ(i) + Math.pow((y + 0.046) / 0.092, 1.8) * 0.0045);
      cUv.setXY(i, (x + 0.036) / 0.072, (y + 0.046) / 0.092);
    }
    cardGeo.computeVertexNormals();
    const card = tagMesh(new THREE.Mesh(cardGeo, postcardMat), 'secondary');
    card.position.set(cx + dir * (panelW * 0.30), botRailH + 0.054, 0.010);
    card.rotation.z = -0.14;
    pivot.add(card);
  } else {
    // Classic 2-panel shaker/cathedral-arch raised door
    const midRail = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, railSpan, midRailH, thickness, 0.0045, 'x'), frameMat), 'primary');
    midRail.position.set(cx, midRailY, 0);
    pivot.add(midRail);

    // Recessed backing panel
    const backH = h - topRailH - botRailH + 0.006;
    const recessBack = tagMesh(new THREE.Mesh(makeChamferedBlock(THREE, panelW, backH, 0.009, 0.002, 'y'), innerTrimMat), 'primary');
    recessBack.position.set(cx, botRailH + backH * 0.5 - 0.003, -0.002);
    pivot.add(recessBack);

    // Upper cathedral-arched raised bevelled panel
    const upY0 = midRailY + midRailH * 0.5;
    const upY1 = h - topRailH;
    const upH = upY1 - upY0 - 0.014;
    const upPanelGeo = makeArchedPanel(THREE, panelW - 0.016, upH, 0.016, 0.044, 0.009, 'y');
    const upPanel = tagMesh(new THREE.Mesh(upPanelGeo, panelMat), 'primary');
    upPanel.position.set(cx, (upY0 + upY1) * 0.5, 0.003);
    pivot.add(upPanel);

    // Lower raised bevelled rectangular panel
    const loY0 = botRailH;
    const loY1 = midRailY - midRailH * 0.5;
    const loH = loY1 - loY0 - 0.014;
    const loPanelGeo = makeChamferedBlock(THREE, panelW - 0.016, loH, 0.016, 0.0085, 'y');
    const loPanel = tagMesh(new THREE.Mesh(loPanelGeo, panelMat), 'primary');
    loPanel.position.set(cx, (loY0 + loY1) * 0.5, 0.003);
    pivot.add(loPanel);
  }

  // Shaped brass handle on the centre-opening stile
  const handle = makeShapedHandle(THREE, metalMat, true, 0.132);
  handle.position.set(dir * (w - stileW * 0.56), 0.56, thickness * 0.5);
  pivot.add(handle);

  // Ornamental keyhole escutcheon on right door
  if (isRight) {
    const escGeo = makeArchedPanel(THREE, 0.018, 0.036, 0.004, 0.007, 0.0015);
    const esc = tagMesh(new THREE.Mesh(escGeo, metalMat), 'accent');
    esc.position.set(dir * (w - stileW * 0.56), 0.445, thickness * 0.5 + 0.001);
    pivot.add(esc);
  }

  // Two visible brass barrel hinges on outer edge
  for (const hy of [0.18, h - 0.18]) {
    const hinge = makeBrassHinge(THREE, metalMat);
    hinge.position.set(0, hy, thickness * 0.48);
    pivot.add(hinge);
  }

  return pivot;
}

// ---------------------------------------------------------------------------
// Main Build Export
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const group = new THREE.Group();
  group.name = 'wardrobe';

  const variant = Math.max(0, Math.min(2, Number(opts.variant ?? 0) | 0));
  const finish = resolveFinish(opts.material);

  // Palette resolution respecting opts = { primary, secondary, wood, metal, material, variant }
  const defaultWood = variant === 2 ? '#a97a50' : '#96633d';
  const defaultPrimary =
    variant === 0 ? '#b27a4d'
    : variant === 1 ? '#7d9b8f'
    : '#c5835c';
  const defaultSecondary =
    variant === 0 ? '#b86a46'
    : variant === 1 ? '#d8c3a2'
    : '#d6b68a';

  const woodCol = toColor(THREE, opts.wood, defaultWood);
  const primaryCol = toColor(THREE, opts.primary, defaultPrimary);
  const secondaryCol = toColor(THREE, opts.secondary, defaultSecondary);
  const metalCol = toColor(THREE, opts.metal, '#cba254');

  // Procedural textures
  const woodTex = makeWoodTextures(THREE, kit, woodCol, 1.0);
  const panelWoodTex = variant === 1
    ? makePaintedWoodTextures(THREE, kit, primaryCol)
    : makeWoodTextures(THREE, kit, primaryCol, 0.92);
  const bodyTex = variant === 1
    ? makePaintedWoodTextures(THREE, kit, shiftHSL(THREE, primaryCol, 0, -0.03, 0.05))
    : woodTex;

  const wallpaperBase = variant === 1
    ? shiftHSL(THREE, secondaryCol, 0.01, -0.14, 0.16)
    : new THREE.Color('#efe4d1');
  const wallpaperMap = makeWallpaperTexture(THREE, kit, wallpaperBase);

  // Core MeshPhysicalMaterials
  const carcassMat = new THREE.MeshPhysicalMaterial({
    map: bodyTex.map,
    bumpMap: bodyTex.bump,
    bumpScale: variant === 1 ? 0.0014 : 0.0028,
    roughness: clamp01((variant === 1 ? 0.50 : 0.56) + finish.roughnessBias),
    metalness: 0.02,
    clearcoat: clamp01((variant === 1 ? 0.24 : 0.18) + finish.clearcoatBias),
    clearcoatRoughness: 0.36
  });

  const woodAccentMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.003,
    roughness: clamp01(0.54 + finish.roughnessBias),
    metalness: 0.02,
    clearcoat: clamp01(0.20 + finish.clearcoatBias),
    clearcoatRoughness: 0.35
  });

  const doorPanelMat = new THREE.MeshPhysicalMaterial({
    map: panelWoodTex.map,
    bumpMap: panelWoodTex.bump,
    bumpScale: variant === 1 ? 0.0014 : 0.0026,
    roughness: clamp01((variant === 1 ? 0.48 : 0.52) + finish.roughnessBias),
    metalness: 0.02,
    clearcoat: clamp01((variant === 1 ? 0.26 : 0.22) + finish.clearcoatBias),
    clearcoatRoughness: 0.32
  });

  const innerTrimMat = new THREE.MeshPhysicalMaterial({
    color: shiftHSL(THREE, variant === 1 ? primaryCol : woodCol, 0, 0.02, -0.07),
    map: bodyTex.map,
    bumpMap: bodyTex.bump,
    bumpScale: 0.0018,
    roughness: clamp01(0.58 + finish.roughnessBias),
    clearcoat: clamp01(0.14 + finish.clearcoatBias)
  });

  const backWallMat = new THREE.MeshPhysicalMaterial({
    map: wallpaperMap,
    roughness: 0.84,
    sheen: 0.25,
    sheenColor: new THREE.Color('#fff9ee')
  });

  const metalMat = new THREE.MeshPhysicalMaterial({
    color: metalCol,
    roughness: clamp01(0.24 + finish.roughnessBias * 0.4),
    metalness: 0.88,
    clearcoat: 0.35,
    clearcoatRoughness: 0.18
  });

  const mirrorMat = new THREE.MeshPhysicalMaterial({
    map: makeMirrorTexture(THREE, kit),
    color: 0xffffff,
    roughness: 0.05,
    metalness: 0.88,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const postcardMat = new THREE.MeshPhysicalMaterial({
    map: makePostcardTexture(THREE, kit),
    roughness: 0.65,
    clearcoat: 0.15
  });

  // -------------------------------------------------------------------------
  // Dimensions (exact 0.90 m wide x 0.55 m deep x 1.90 m total height)
  // -------------------------------------------------------------------------
  const bodyW = 0.830;
  const bodyD = 0.490;
  const wallT = 0.026;
  const zBack = -0.265;
  const zFront = zBack + bodyD; // +0.225
  const zCenter = (zBack + zFront) * 0.5; // -0.020
  const innerW = bodyW - wallT * 2; // 0.778

  const yPlinthBot = 0.100;
  const yPlinthTop = 0.142;
  const yMidDiv = variant === 2 ? 0.376 : 0.404;
  const yCarcassTop = 1.592;
  const yCorniceTop = 1.670;

  // -------------------------------------------------------------------------
  // 1. Turned Feet (4 x LatheGeometry)
  // -------------------------------------------------------------------------
  const footGeo = makeTurnedFootGeo(THREE);
  const footMat = variant === 1 ? woodAccentMat : carcassMat;
  const footCoords = [
    [-0.356, zFront - 0.042],
    [0.356, zFront - 0.042],
    [-0.356, zBack + 0.055],
    [0.356, zBack + 0.055]
  ];
  for (const [fx, fz] of footCoords) {
    const foot = tagMesh(new THREE.Mesh(footGeo, footMat), 'secondary');
    foot.position.set(fx, 0, fz);
    group.add(foot);
  }

  // -------------------------------------------------------------------------
  // 2. Sculpted Mitred Base Plinth & Crown Cornice Mouldings
  // -------------------------------------------------------------------------
  const plinthProfile = [
    [0.024, yPlinthBot],
    [0.026, yPlinthBot + 0.010],
    [0.022, yPlinthBot + 0.018],
    [0.014, yPlinthBot + 0.026],
    [0.008, yPlinthBot + 0.034],
    [0.002, yPlinthTop]
  ];
  const plinthGeo = makeMitredMoulding(THREE, bodyW, bodyD, plinthProfile, true);
  const plinthMesh = tagMesh(new THREE.Mesh(plinthGeo, carcassMat), variant === 1 ? 'primary' : 'secondary');
  plinthMesh.position.z = zCenter;
  group.add(plinthMesh);

  // Crown cornice reaches exact outer 0.90 m wide (+0.035 per side) and 0.55 m deep
  const corniceProfile = [
    [0.002, yCarcassTop - 0.004],
    [0.009, yCarcassTop + 0.008],
    [0.014, yCarcassTop + 0.018],
    [0.011, yCarcassTop + 0.026],
    [0.022, yCarcassTop + 0.042],
    [0.032, yCarcassTop + 0.058],
    [0.035, yCarcassTop + 0.068],
    [0.035, yCorniceTop]
  ];
  const corniceGeo = makeMitredMoulding(THREE, bodyW, bodyD + 0.015, corniceProfile, true);
  const corniceMesh = tagMesh(new THREE.Mesh(corniceGeo, carcassMat), variant === 1 ? 'primary' : 'secondary');
  corniceMesh.position.z = zCenter + 0.004;
  group.add(corniceMesh);

  // -------------------------------------------------------------------------
  // 3. Wardrobe Carcass (Hollow cabinet with chamfers & wallpapered back)
  // -------------------------------------------------------------------------
  const sideH = yCarcassTop - yPlinthTop + 0.006;
  const sideGeo = makeChamferedBlock(THREE, wallT, sideH, bodyD, 0.0045, 'y');
  for (const s of [-1, 1]) {
    const sideWall = tagMesh(new THREE.Mesh(sideGeo, carcassMat), variant === 1 ? 'primary' : 'secondary');
    sideWall.position.set(s * (bodyW * 0.5 - wallT * 0.5), yPlinthTop + sideH * 0.5 - 0.003, zCenter);
    group.add(sideWall);

    // Subtle decorative side-panel recessed moulding frame on exterior sides
    const sideRecess = tagMesh(
      new THREE.Mesh(makeChamferedBlock(THREE, 0.008, sideH - 0.24, bodyD - 0.14, 0.003, 'y'), doorPanelMat),
      'primary'
    );
    sideRecess.position.set(s * (bodyW * 0.5 + 0.001), yPlinthTop + sideH * 0.5 + 0.02, zCenter);
    group.add(sideRecess);
  }

  // Exterior back wall + interior cozy patterned wallpaper panel
  const backOuter = tagMesh(
    new THREE.Mesh(makeChamferedBlock(THREE, bodyW - 0.006, sideH, 0.016, 0.003, 'y'), carcassMat),
    'secondary'
  );
  backOuter.position.set(0, yPlinthTop + sideH * 0.5 - 0.003, zBack + 0.008);
  group.add(backOuter);

  const backInner = tagMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(innerW, sideH - 0.02), backWallMat),
    'secondary',
    false,
    true
  );
  backInner.position.set(0, yPlinthTop + sideH * 0.5, zBack + 0.018);
  group.add(backInner);

  // Horizontal carcass boards: floor, mid divider, top ceiling, upper interior shelf
  const boardGeo = makeChamferedBlock(THREE, innerW + 0.004, 0.024, bodyD - 0.016, 0.004, 'x');
  const floorBoard = tagMesh(new THREE.Mesh(boardGeo, carcassMat), 'secondary');
  floorBoard.position.set(0, yPlinthTop + 0.010, zCenter + 0.006);
  group.add(floorBoard);

  const midDivider = tagMesh(
    new THREE.Mesh(makeChamferedBlock(THREE, innerW + 0.006, 0.026, bodyD - 0.004, 0.005, 'x'), carcassMat),
    variant === 1 ? 'primary' : 'secondary'
  );
  midDivider.position.set(0, yMidDiv, zCenter + 0.005);
  group.add(midDivider);

  const topBoard = tagMesh(new THREE.Mesh(boardGeo, carcassMat), 'secondary');
  topBoard.position.set(0, yCarcassTop - 0.010, zCenter + 0.006);
  group.add(topBoard);

  // Upper interior cubby shelf
  const upperShelfY = 1.448;
  const upperShelf = tagMesh(
    new THREE.Mesh(makeChamferedBlock(THREE, innerW, 0.020, bodyD - 0.056, 0.004, 'x'), woodAccentMat),
    'secondary'
  );
  upperShelf.position.set(0, upperShelfY, zBack + 0.018 + (bodyD - 0.056) * 0.5);
  group.add(upperShelf);

  // -------------------------------------------------------------------------
  // 4. Bottom Drawer (slightly pulled open for cozy lived-in charm)
  // -------------------------------------------------------------------------
  const drawerGroup = new THREE.Group();
  drawerGroup.name = 'drawer';
  const drawerH = (yMidDiv - 0.013) - (yPlinthTop + 0.010) - 0.010;
  const drawerW = innerW - 0.008;
  const drawerY = yPlinthTop + 0.015 + drawerH * 0.5;
  const pullOutZ = 0.018; // subtly ajar!

  // Drawer front slab + recessed bevelled panel
  const dFront = tagMesh(
    new THREE.Mesh(makeChamferedBlock(THREE, drawerW, drawerH, 0.024, 0.005, 'x'), carcassMat),
    variant === 1 ? 'primary' : 'secondary'
  );
  dFront.position.set(0, drawerY, zFront + 0.010 + pullOutZ);
  drawerGroup.add(dFront);

  const dPanel = tagMesh(
    new THREE.Mesh(makeChamferedBlock(THREE, drawerW - 0.078, drawerH - 0.062, 0.014, 0.0065, 'x'), doorPanelMat),
    'primary'
  );
  dPanel.position.set(0, drawerY, zFront + 0.019 + pullOutZ);
  drawerGroup.add(dPanel);

  // Wooden drawer side boxes visible in the slight pull-out reveal
  const boxSideGeo = makeChamferedBlock(THREE, 0.014, drawerH - 0.032, 0.36, 0.002, 'x');
  for (const s of [-1, 1]) {
    const side = tagMesh(new THREE.Mesh(boxSideGeo, woodAccentMat), 'secondary');
    side.position.set(s * (drawerW * 0.5 - 0.016), drawerY - 0.004, zFront - 0.165 + pullOutZ);
    drawerGroup.add(side);
  }

  // Twin horizontal shaped brass pulls on the bottom drawer
  for (const sx of [-0.20, 0.20]) {
    const pull = makeShapedHandle(THREE, metalMat, false, 0.112);
    pull.position.set(sx, drawerY, zFront + 0.026 + pullOutZ);
    drawerGroup.add(pull);
  }
  group.add(drawerGroup);

  // -------------------------------------------------------------------------
  // 5. Interior Brass Rail & Sculpted Hanging Clothes
  // -------------------------------------------------------------------------
  const railY = 1.375;
  const railZ = -0.015;
  const railGeo = new THREE.CylinderGeometry(0.0095, 0.0095, innerW, 16);
  railGeo.rotateZ(Math.PI * 0.5);
  const railMesh = tagMesh(new THREE.Mesh(railGeo, metalMat), 'accent');
  railMesh.position.set(0, railY, railZ);
  group.add(railMesh);

  // Lathed brass rail end-flanges mounted flush to interior walls
  const flangeGeo = makeRosetteGeo(THREE, 0.020, 0.014);
  for (const s of [-1, 1]) {
    const fl = tagMesh(new THREE.Mesh(flangeGeo, metalMat), 'accent');
    fl.position.set(s * (innerW * 0.5), railY, railZ);
    fl.rotation.y = s > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    group.add(fl);
  }

  // Curated cozy dorm fabric materials (high roughness + soft sheen)
  function makeClothMat(hex, pattern, accentHex) {
    const col = toColor(THREE, hex, '#c8825a');
    const acc = accentHex ? toColor(THREE, accentHex, '#f0e5cf') : null;
    const t = makeFabricTextures(THREE, kit, col, pattern, acc);
    return new THREE.MeshPhysicalMaterial({
      map: t.map,
      bumpMap: t.bump,
      bumpScale: 0.004,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.72,
      sheenColor: shiftHSL(THREE, col, 0, -0.1, 0.28)
    });
  }

  const clothMats = {
    sweaterMustard: makeClothMat('#d59a47', 'knit', '#f3dcb0'),
    flannelPlaid: makeClothMat('#587b6f', 'plaid', '#e8c48c'),
    jacketDenim: makeClothMat('#475e78', 'twill', '#c7b89c'),
    creamKnit: makeClothMat('#e9dec9', 'knit', '#d2c2a7'),
    terracottaStripe: makeClothMat('#c56c52', 'stripe', '#f4ead8'),
    plumCardigan: makeClothMat('#7b5263', 'knit', '#d9b8c2'),
    trimCream: makeClothMat('#efe5d2', 'knit'),
    trimNavy: makeClothMat('#35485c', 'twill')
  };

  // Garment lineup (well-spaced along X; right-side garments shine through the ajar door!)
  const garmentSpecs = variant === 2
    ? [
        { x: -0.295, yaw: 0.06, mat: clothMats.jacketDenim, trim: clothMats.trimNavy, length: 0.64, thick: 0.036, buttons: true, seed: 1.1, slot: 'secondary' },
        { x: -0.185, yaw: -0.05, mat: clothMats.creamKnit, trim: clothMats.trimCream, length: 0.58, thick: 0.038, seed: 2.3, slot: 'secondary' },
        { x: -0.072, yaw: 0.08, mat: clothMats.flannelPlaid, trim: clothMats.trimCream, length: 0.62, thick: 0.033, buttons: true, seed: 3.4, slot: 'primary' },
        { x: 0.045, yaw: -0.04, mat: clothMats.sweaterMustard, trim: clothMats.trimCream, length: 0.60, thick: 0.038, seed: 4.5, slot: 'accent' },
        { x: 0.160, yaw: 0.07, mat: clothMats.terracottaStripe, trim: clothMats.trimCream, length: 0.56, thick: 0.032, sleeveRatio: 0.52, seed: 5.2, slot: 'primary' },
        { x: 0.275, yaw: -0.10, mat: clothMats.plumCardigan, trim: clothMats.trimCream, length: 0.65, thick: 0.036, buttons: true, seed: 6.1, slot: 'secondary' }
      ]
    : [
        { x: -0.255, yaw: 0.05, mat: clothMats.jacketDenim, trim: clothMats.trimNavy, length: 0.68, thick: 0.037, buttons: true, seed: 1.2, slot: 'secondary' },
        { x: -0.130, yaw: -0.06, mat: clothMats.creamKnit, trim: clothMats.trimCream, length: 0.62, thick: 0.038, seed: 2.4, slot: 'secondary' },
        { x: 0.015, yaw: 0.09, mat: clothMats.flannelPlaid, trim: clothMats.trimCream, length: 0.66, thick: 0.034, buttons: true, seed: 3.3, slot: 'primary' },
        { x: 0.138, yaw: -0.08, mat: clothMats.sweaterMustard, trim: clothMats.trimCream, length: 0.64, thick: 0.038, seed: 4.7, slot: 'accent' },
        { x: 0.258, yaw: 0.14, mat: clothMats.terracottaStripe, trim: clothMats.trimCream, length: 0.61, thick: 0.034, buttons: true, seed: 5.5, slot: 'primary' }
      ];

  const hangersGroup = new THREE.Group();
  hangersGroup.name = 'hangers';
  garmentSpecs.forEach((spec, idx) => {
    const h = makeHangerWithClothes(THREE, woodAccentMat, metalMat, spec, spec.mat, spec.trim);
    h.name = `hanger_${idx}`;
    h.position.set(spec.x, railY, railZ);
    h.rotation.y = spec.yaw;
    h.userData.baseYaw = spec.yaw;
    hangersGroup.add(h);
  });
  group.add(hangersGroup);

  // Upper cubby shelf contents (folded knit sweaters + woven dorm basket)
  const basketTex = makeWovenTexture(THREE, kit, new THREE.Color('#c8a274'));
  const basketMat = new THREE.MeshPhysicalMaterial({
    map: basketTex,
    roughness: 0.88,
    sheen: 0.55,
    sheenColor: new THREE.Color('#f0dec0')
  });
  const topSweaters = makeFoldedBlanket(THREE, clothMats.creamKnit, clothMats.flannelPlaid, 0.25, 0.24, 2);
  topSweaters.position.set(-0.20, upperShelfY + 0.010, -0.03);
  group.add(topSweaters);

  const topBasket = makeWovenBasket(THREE, basketMat, woodAccentMat, 0.092, 0.112, 0.112);
  topBasket.position.set(0.19, upperShelfY + 0.010, -0.02);
  group.add(topBasket);

  // -------------------------------------------------------------------------
  // 6. Variant-Specific Front: Panelled Doors / Mirror Door / Open Rail + Shoe Shelf
  // -------------------------------------------------------------------------
  if (variant === 0 || variant === 1) {
    const doorW = 0.390;
    const doorH = yCarcassTop - yMidDiv - 0.024;
    const doorT = 0.024;
    const doorY = yMidDiv + 0.015;
    const doorZ = zFront + 0.012;

    const doorL = makeWardrobeDoor(THREE, kit, {
      w: doorW, h: doorH, thickness: doorT,
      isRight: false,
      isMirror: variant === 1,
      frameMat: carcassMat,
      panelMat: doorPanelMat,
      innerTrimMat,
      metalMat,
      mirrorMat,
      postcardMat
    });
    doorL.position.set(-0.394, doorY, doorZ);
    doorL.rotation.y = 0;
    group.add(doorL);

    const doorR = makeWardrobeDoor(THREE, kit, {
      w: doorW, h: doorH, thickness: doorT,
      isRight: true,
      isMirror: false,
      frameMat: carcassMat,
      panelMat: doorPanelMat,
      innerTrimMat,
      metalMat,
      mirrorMat,
      postcardMat
    });
    doorR.position.set(0.394, doorY, doorZ);
    // Slightly ajar to reveal the cozy hanging clothes inside!
    const ajarAngle = 0.50;
    doorR.rotation.y = ajarAngle;
    doorR.userData.baseAngle = ajarAngle;
    group.add(doorR);

    // Subtle interior floor basket tucked on the right side so peeking in rewards the eye
    const floorBasket = makeWovenBasket(THREE, basketMat, woodAccentMat, 0.10, 0.125, 0.145);
    floorBasket.position.set(0.18, yMidDiv + 0.013, -0.02);
    group.add(floorBasket);
  } else {
    // Variant 2: Open rail with decorative arched valence, slatted shoe shelf, sculpted shoes & side scarf!
    const valShape = new THREE.Shape();
    const vw = innerW * 0.5;
    valShape.moveTo(-vw, 0.095);
    valShape.lineTo(vw, 0.095);
    valShape.lineTo(vw, 0);
    valShape.bezierCurveTo(vw * 0.72, 0.065, vw * 0.32, 0.068, 0, 0.072);
    valShape.bezierCurveTo(-vw * 0.32, 0.068, -vw * 0.72, 0.065, -vw, 0);
    valShape.closePath();

    const valGeo = new THREE.ExtrudeGeometry(valShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.003,
      bevelSegments: 2,
      curveSegments: 16
    });
    valGeo.translate(0, 0, -0.009);
    valGeo.computeVertexNormals();
    applyBoxUVs(valGeo, 'x');
    const valence = tagMesh(new THREE.Mesh(valGeo, doorPanelMat), 'primary');
    valence.position.set(0, yCarcassTop - 0.110, zFront - 0.008);
    group.add(valence);

    // Front bevelled framing pilasters flanking the open rail
    const pilH = yCarcassTop - yMidDiv - 0.018;
    const pilGeo = makeChamferedBlock(THREE, 0.024, pilH, 0.024, 0.004, 'y');
    for (const s of [-1, 1]) {
      const pil = tagMesh(new THREE.Mesh(pilGeo, doorPanelMat), 'primary');
      pil.position.set(s * (innerW * 0.5 - 0.008), yMidDiv + 0.012 + pilH * 0.5, zFront - 0.006);
      group.add(pil);
    }

    // Slatted wooden shoe shelf raised just above the bottom drawer divider
    const shelfY = yMidDiv + 0.042;
    const railSupportGeo = makeChamferedBlock(THREE, 0.020, 0.022, bodyD - 0.065, 0.003, 'y');
    for (const s of [-1, 1]) {
      const sup = tagMesh(new THREE.Mesh(railSupportGeo, woodAccentMat), 'secondary');
      sup.position.set(s * (innerW * 0.5 - 0.010), shelfY - 0.014, zCenter + 0.006);
      group.add(sup);
    }

    const slatCount = 5;
    const slatGeo = makeChamferedBlock(THREE, innerW - 0.006, 0.014, 0.044, 0.0035, 'x');
    for (let i = 0; i < slatCount; i++) {
      const zSlat = zBack + 0.075 + i * 0.082;
      const slat = tagMesh(new THREE.Mesh(slatGeo, woodAccentMat), 'secondary');
      slat.position.set(0, shelfY, zSlat);
      group.add(slat);
    }

    // Two pairs of cute sculpted dorm shoes on the slatted shelf
    const sneakerMat = makeClothMat('#587a74', 'twill');
    const bootMat = new THREE.MeshPhysicalMaterial({
      color: shiftHSL(THREE, secondaryCol, -0.03, 0.08, -0.22),
      roughness: 0.56,
      sheen: 0.35,
      clearcoat: 0.14
    });
    const soleWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf2ece0, roughness: 0.72 });
    const soleDarkMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2d24, roughness: 0.68 });
    const laceMat = new THREE.MeshPhysicalMaterial({ color: 0xfaf5eb, roughness: 0.85, sheen: 0.6 });

    const shoeY = shelfY + 0.007;
    const sneakerL = makeSculptedShoe(THREE, sneakerMat, soleWhiteMat, laceMat, false);
    sneakerL.position.set(-0.245, shoeY, 0.015);
    sneakerL.rotation.y = 0.14;
    const sneakerR = makeSculptedShoe(THREE, sneakerMat, soleWhiteMat, laceMat, false);
    sneakerR.position.set(-0.115, shoeY, 0.025);
    sneakerR.rotation.y = -0.08;
    group.add(sneakerL, sneakerR);

    const bootL = makeSculptedShoe(THREE, bootMat, soleDarkMat, metalMat, true);
    bootL.position.set(0.105, shoeY, 0.005);
    bootL.rotation.y = 0.06;
    const bootR = makeSculptedShoe(THREE, bootMat, soleDarkMat, metalMat, true);
    bootR.position.set(0.240, shoeY, 0.020);
    bootR.rotation.y = -0.22;
    group.add(bootL, bootR);

    // Side wooden peg + hanging cozy knit scarf on exterior right panel
    const sideScarf = makeSideScarf(THREE, clothMats.terracottaStripe, woodAccentMat);
    sideScarf.position.set(bodyW * 0.5, 1.32, 0.02);
    group.add(sideScarf);
  }

  // -------------------------------------------------------------------------
  // 7. Hero Vintage Suitcase & Cozy Folded Blanket on Top (Reaching ~1.90 m)
  // -------------------------------------------------------------------------
  const suitcaseLeatherCol = variant === 0
    ? shiftHSL(THREE, secondaryCol, 0, 0.04, -0.05)
    : variant === 1
      ? new THREE.Color('#c68a5c')
      : shiftHSL(THREE, primaryCol, -0.02, 0.02, -0.06);
  const suitcaseStrapCol = shiftHSL(THREE, suitcaseLeatherCol, -0.02, 0.08, -0.22);

  const suitcase = makeVintageSuitcase(THREE, kit, suitcaseLeatherCol, suitcaseStrapCol, metalMat, finish);
  suitcase.position.set(-0.072, yCorniceTop, 0.012);
  suitcase.rotation.y = -0.14;
  group.add(suitcase);

  // Cozy folded throw blanket balancing the right side of the top cornice
  const topBlanket = makeFoldedBlanket(THREE, clothMats.terracottaStripe, clothMats.creamKnit, 0.21, 0.24, 2);
  topBlanket.position.set(0.295, yCorniceTop, -0.012);
  topBlanket.rotation.y = 0.16;
  group.add(topBlanket);

  return group;
}

// ---------------------------------------------------------------------------
// Subtle Cozy Ambient Animation
// ---------------------------------------------------------------------------

export function idle(group, t) {
  if (!group) return;
  let cache = group.userData._animCache;
  if (!cache) {
    const hangers = [];
    const hGroup = group.getObjectByName('hangers');
    if (hGroup) {
      for (const child of hGroup.children) hangers.push(child);
    }
    cache = {
      doorR: group.getObjectByName('doorR'),
      luggageTag: group.getObjectByName('luggageTag'),
      sideScarf: group.getObjectByName('sideScarf'),
      hangers
    };
    group.userData._animCache = cache;
  }

  // Soft draft breathing on the ajar door
  if (cache.doorR && typeof cache.doorR.userData.baseAngle === 'number') {
    cache.doorR.rotation.y = cache.doorR.userData.baseAngle + Math.sin(t * 0.68) * 0.016;
  }

  // Delicate staggered pendulum sway on hanging clothes
  for (let i = 0; i < cache.hangers.length; i++) {
    const h = cache.hangers[i];
    const phase = i * 0.95;
    h.rotation.z = Math.sin(t * 1.12 + phase) * 0.014;
    h.rotation.x = Math.cos(t * 0.85 + phase * 1.3) * 0.008;
  }

  // Gentle flutter on the suitcase luggage tag hanging over the cornice
  if (cache.luggageTag) {
    cache.luggageTag.rotation.z = Math.sin(t * 1.45 + 0.5) * 0.042;
    cache.luggageTag.rotation.x = Math.cos(t * 0.98) * 0.022;
  }

  // Soft breeze sway on Variant 2's hanging side scarf
  if (cache.sideScarf) {
    cache.sideScarf.rotation.z = Math.sin(t * 1.05 + 1.1) * 0.024;
    cache.sideScarf.rotation.x = Math.cos(t * 0.78) * 0.012;
  }
}