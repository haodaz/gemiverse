export const ENTRANCE = [0, 0.15, 3.45];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setupTex(THREE, tex, rx = 1, ry = 1, repeat = true) {
  if ('colorSpace' in tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function applyBoxUVs(geo, scaleU = 1, scaleV = 1) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    let u = 0;
    let v = 0;
    if (ny >= nx && ny >= nz) {
      u = x * scaleU;
      v = z * scaleV;
    } else if (nx >= ny && nx >= nz) {
      u = z * scaleU;
      v = y * scaleV;
    } else {
      u = x * scaleU;
      v = y * scaleV;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new geo.attributes.position.constructor(uvs, 2));
  return geo;
}

function makeRoundedRectShape(THREE, w, h, r) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw * 0.9, hh * 0.9);
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

function makeRoundedBoxGeo(THREE, w, h, d, r = 0.04, bevel = 0.018, segs = 2, uvScale = 0.5) {
  const b = Math.min(bevel, w * 0.25, h * 0.25, d * 0.25);
  const innerW = Math.max(0.005, w - b * 2);
  const innerH = Math.max(0.005, h - b * 2);
  const innerD = Math.max(0.005, d - b * 2);
  const shape = makeRoundedRectShape(THREE, innerW, innerH, Math.max(0.004, r - b));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerD,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: segs,
    curveSegments: segs,
  });
  geo.center();
  if (uvScale > 0) applyBoxUVs(geo, uvScale, uvScale);
  return geo;
}

function makeArchedWallGeo(THREE, w, h, thickness, openings, gableH = 0, oculus = null) {
  const hw = w * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, h);
  if (gableH > 0) shape.lineTo(0, h + gableH);
  shape.lineTo(-hw, h);
  shape.closePath();

  for (const op of openings) {
    const r = op.w * 0.5;
    const archY = op.y + op.h - r;
    const hole = new THREE.Path();
    hole.moveTo(op.x - r, op.y);
    hole.lineTo(op.x - r, archY);
    hole.absarc(op.x, archY, r, Math.PI, 0, true);
    hole.lineTo(op.x + r, op.y);
    hole.closePath();
    shape.holes.push(hole);
  }

  if (oculus) {
    const oh = new THREE.Path();
    oh.absarc(oculus.x, oculus.y, oculus.r, 0, Math.PI * 2, true);
    shape.holes.push(oh);
  }

  const b = 0.015;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, thickness - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.translate(0, 0, -(thickness - b * 2) * 0.5);
  applyBoxUVs(geo, 0.42, 0.42);
  return geo;
}

function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}

function createTextures(THREE, kit, accentHex) {
  const rng = mulberry32(41029);

  const brickTex = setupTex(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#d6c6b1';
      ctx.fillRect(0, 0, w, h);
      const rows = 12;
      const cols = 6;
      const bh = h / rows;
      const bw = w / cols;
      const palette = ['#b9573b', '#c46344', '#a94d35', '#c8714a', '#b3543b', '#9e4833'];
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (bw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * bw + off;
          const y = r * bh;
          ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
          ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
          ctx.fillStyle = 'rgba(255, 232, 200, 0.12)';
          ctx.fillRect(x + 2, y + 2, bw - 4, 3);
          ctx.fillStyle = 'rgba(55, 20, 12, 0.15)';
          ctx.fillRect(x + 2, y + bh - 4, bw - 4, 2);
        }
      }
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255,245,230,0.08)' : 'rgba(40,20,10,0.08)';
        ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 3, 2);
      }
    }),
    1.15,
    1.15
  );

  const slateTex = setupTex(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#333e4c';
      ctx.fillRect(0, 0, w, h);
      const rows = 10;
      const cols = 8;
      const th = h / rows;
      const tw = w / cols;
      const tones = ['#465465', '#4f5e70', '#3d4a5a', '#556477', '#425061'];
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (tw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * tw + off;
          const y = r * th;
          ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
          ctx.beginPath();
          ctx.moveTo(x + 1.5, y);
          ctx.lineTo(x + tw - 1.5, y);
          ctx.lineTo(x + tw - 1.5, y + th - 5);
          ctx.quadraticCurveTo(x + tw * 0.5, y + th + 2, x + 1.5, y + th - 5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(22, 28, 36, 0.55)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = 'rgba(210, 225, 245, 0.08)';
          ctx.fillRect(x + 3, y + 2, tw - 6, 3);
        }
      }
    }),
    2.6,
    1.7
  );

  const stoneTex = setupTex(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e5dac6';
      ctx.fillRect(0, 0, w, h);
      const rows = 6;
      const cols = 4;
      const bh = h / rows;
      const bw = w / cols;
      const shades = ['#ebe1ce', '#e1d5bf', '#e7dcc8', '#dcd0b8'];
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (bw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * bw + off;
          const y = r * bh;
          ctx.fillStyle = shades[Math.floor(rng() * shades.length)];
          ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        }
      }
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(95,80,60,0.09)';
        ctx.fillRect(rng() * w, rng() * h, 2, 2);
      }
    }),
    1.0,
    1.0
  );

  const woodTex = setupTex(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#9c673c';
      ctx.fillRect(0, 0, w, h);
      const planks = 8;
      const ph = h / planks;
      const tones = ['#a46d41', '#976238', '#ad7446', '#8d5b34'];
      for (let p = 0; p < planks; p++) {
        ctx.fillStyle = tones[p % tones.length];
        ctx.fillRect(0, p * ph, w, ph - 1.5);
        ctx.fillStyle = 'rgba(55, 28, 12, 0.25)';
        ctx.fillRect(0, (p + 1) * ph - 1.5, w, 1.5);
        for (let g = 0; g < 10; g++) {
          ctx.fillStyle = rng() > 0.5 ? 'rgba(255,220,175,0.07)' : 'rgba(50,25,10,0.09)';
          ctx.fillRect(0, p * ph + rng() * ph, w, 1.5);
        }
      }
    }),
    1.4,
    1.4
  );

  const pavingTex = setupTex(
    THREE,
    kit.canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#c8beae';
      ctx.fillRect(0, 0, w, h);
      const cols = 16;
      const rows = 14;
      const tw = w / cols;
      const th = h / rows;
      const tones = ['#ddd3c2', '#d6cbb8', '#e2d8c7', '#cfc4b1', '#dad0be'];
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (tw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * tw + off;
          const y = r * th;
          ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
          ctx.fillRect(x + 2, y + 2, tw - 4, th - 4);
          ctx.fillStyle = 'rgba(255,250,240,0.16)';
          ctx.fillRect(x + 2, y + 2, tw - 4, 2.5);
        }
      }
      // Decorative warm border frame around plaza
      ctx.strokeStyle = '#bfb19b';
      ctx.lineWidth = 14;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.strokeStyle = '#e7decb';
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 24, w - 48, h - 48);

      // Warm central brick-stone runner from entrance (+z = bottom) to hall door
      const pathW = 92;
      const px = (w - pathW) * 0.5;
      const py = h * 0.53;
      const ph = h * 0.45;
      ctx.fillStyle = '#cbb99e';
      ctx.fillRect(px - 6, py, pathW + 12, ph);
      for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 4; c++) {
          const bx = px + c * (pathW / 4) + ((r % 2) * 5 - 2.5);
          const by = py + r * (ph / 14);
          ctx.fillStyle = (r + c) % 2 === 0 ? '#d9c5a9' : '#cfb898';
          ctx.fillRect(bx + 1.5, by + 1.5, pathW / 4 - 3, ph / 14 - 3);
        }
      }
      // Subtle ambient occlusion under building footprint (upper half)
      ctx.fillStyle = 'rgba(55, 42, 30, 0.16)';
      ctx.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.49);

      for (let i = 0; i < 1200; i++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(75,60,45,0.07)';
        ctx.fillRect(rng() * w, rng() * h, 2, 2);
      }
    }),
    1,
    1,
    false
  );

  const awningTex = setupTex(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      const stripes = 8;
      const sw = w / stripes;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? accentHex : '#fff7e6';
        ctx.fillRect(i * sw, 0, sw + 0.5, h);
      }
      // Subtle linen weave
      ctx.fillStyle = 'rgba(90, 65, 30, 0.05)';
      for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1.5);
      // Soft shading gradient toward front valance
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(0,0,0,0.12)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.14)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }),
    1,
    1,
    true
  );

  const umbrellaTex = setupTex(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      const panels = 8;
      const pw = w / panels;
      for (let i = 0; i < panels; i++) {
        ctx.fillStyle = accentHex;
        ctx.fillRect(i * pw, 0, pw + 1, h);
        // Alternating warm sun-bleached sheen & rib piping
        if (i % 2 === 1) {
          ctx.fillStyle = 'rgba(255, 250, 232, 0.18)';
          ctx.fillRect(i * pw, 0, pw, h);
        }
        ctx.fillStyle = 'rgba(100, 70, 20, 0.14)';
        ctx.fillRect(i * pw, 0, 2.5, h);
      }
      // Cream trim band near outer scalloped edge (bottom of V)
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(0, h - 22, w, 10);
      ctx.fillStyle = 'rgba(80, 55, 20, 0.12)';
      ctx.fillRect(0, h - 12, w, 12);
    }),
    1,
    1,
    true
  );

  const menuTex = setupTex(
    THREE,
    kit.canvasTexture(128, 160, (ctx, w, h) => {
      ctx.fillStyle = '#31373c';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d9ccb2';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      // Decorative abstract steaming cup icon (no text)
      ctx.fillStyle = '#f2e8d2';
      ctx.beginPath();
      ctx.arc(w * 0.5, 52, 16, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f2e8d2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w * 0.5 + 16, 56, 6, -Math.PI * 0.4, Math.PI * 0.45);
      ctx.stroke();
      ctx.fillRect(w * 0.5 - 20, 69, 40, 4);
      // Decorative wavy chalk bars (abstract, no letters)
      ctx.fillStyle = accentHex;
      ctx.fillRect(26, 88, 76, 6);
      ctx.fillStyle = 'rgba(242,232,210,0.75)';
      ctx.fillRect(28, 106, 52, 5);
      ctx.fillRect(86, 106, 16, 5);
      ctx.fillRect(28, 120, 44, 5);
      ctx.fillRect(86, 120, 16, 5);
      ctx.fillRect(28, 134, 56, 5);
    }),
    1,
    1,
    false
  );

  return { brickTex, slateTex, stoneTex, woodTex, pavingTex, awningTex, umbrellaTex, menuTex };
}

function makeCurvedAwningGeo(THREE, width, depth, dropY, valanceH, scallops = 6) {
  const segX = scallops * 4;
  const segZ = 8;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const t = iz / segZ;
    let z, y;
    if (iz < segZ) {
      const s = iz / (segZ - 1);
      z = s * depth;
      y = (1 - s * s * 0.85 - s * 0.15) * dropY;
    } else {
      z = depth;
      y = -valanceH;
    }
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const x = (u - 0.5) * width;
      let yy = y;
      if (iz === segZ) {
        const sc = Math.abs(Math.sin(u * scallops * Math.PI));
        yy = -valanceH * (0.35 + 0.65 * sc);
      }
      positions.push(x, yy, z);
      uvs.push(u, t);
    }
  }

  const row = segX + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeUmbrellaCanopyGeo(THREE, radius = 0.56, height = 0.25, panels = 8) {
  const sub = 4;
  const segs = panels * sub;
  const rings = 5;
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let ir = 0; ir <= rings; ir++) {
    const v = ir / rings;
    for (let is = 0; is <= segs; is++) {
      const u = is / segs;
      const ang = u * Math.PI * 2;
      const pFrac = (is % sub) / sub;
      const puff = Math.sin(pFrac * Math.PI);
      const r = v * radius * (1 + (ir === rings ? 0.025 * puff : 0.01 * puff));
      const yBase = height * (1 - Math.pow(v, 1.55));
      const yScallop = ir === rings ? -0.028 * puff : 0.012 * puff * v;
      pos.push(Math.cos(ang) * r, yBase + yScallop, Math.sin(ang) * r);
      uvs.push(u, v);
    }
  }
  const stride = segs + 1;
  for (let ir = 0; ir < rings; ir++) {
    for (let is = 0; is < segs; is++) {
      const a = ir * stride + is;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function makeArchedFrameGeo(THREE, w, h, border, depth) {
  const r = w * 0.5;
  const archY = h - r;
  const outer = new THREE.Shape();
  outer.moveTo(-r - border, 0);
  outer.lineTo(-r - border, archY);
  outer.absarc(0, archY, r + border, Math.PI, 0, true);
  outer.lineTo(r + border, 0);
  outer.closePath();

  const inner = new THREE.Path();
  inner.moveTo(-r, 0.02);
  inner.lineTo(r, 0.02);
  inner.lineTo(r, archY);
  inner.absarc(0, archY, r, 0, Math.PI, false);
  inner.closePath();
  outer.holes.push(inner);

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

function makeArchedPaneGeo(THREE, w, h) {
  const r = w * 0.5;
  const archY = h - r;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, archY);
  s.absarc(0, archY, r, 0, Math.PI, false);
  s.closePath();
  return new THREE.ShapeGeometry(s, 10);
}

export function build(THREE, opts, kit) {
  const options = opts || {};
  const accentColor = new THREE.Color(options.accent !== undefined ? options.accent : '#f4c430');
  const accentHex = '#' + accentColor.getHexString();
  const root = new THREE.Group();
  root.name = 'student_commons';

  const hl = {
    windows: [],
    lights: [],
    awnings: [],
  };
  root.userData._hl = hl;

  const tex = createTextures(THREE, kit, accentHex);

  // Shared materials
  const matBrick = new THREE.MeshStandardMaterial({ map: tex.brickTex, roughness: 0.86, metalness: 0.02 });
  const matSlate = new THREE.MeshStandardMaterial({ map: tex.slateTex, roughness: 0.72, metalness: 0.08 });
  const matStone = new THREE.MeshStandardMaterial({ map: tex.stoneTex, roughness: 0.82, metalness: 0.02 });
  const matPaving = new THREE.MeshStandardMaterial({ map: tex.pavingTex, roughness: 0.84, metalness: 0.02 });
  const matWood = new THREE.MeshStandardMaterial({ map: tex.woodTex, roughness: 0.68, metalness: 0.04 });
  const matWoodDark = new THREE.MeshStandardMaterial({ color: 0x5c3a24, roughness: 0.65, metalness: 0.05 });
  const matCreamTrim = new THREE.MeshStandardMaterial({ color: 0xf4ead6, roughness: 0.62, metalness: 0.03 });
  const matIron = new THREE.MeshStandardMaterial({ color: 0x2c3035, roughness: 0.48, metalness: 0.55 });
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xd5a84c, roughness: 0.32, metalness: 0.75 });
  const matCopper = new THREE.MeshStandardMaterial({ color: 0x5f8f7b, roughness: 0.45, metalness: 0.45 });
  const matTerracotta = new THREE.MeshStandardMaterial({ color: 0xb96243, roughness: 0.82, metalness: 0.03 });
  const matSoil = new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.95 });
  const matCeramic = new THREE.MeshStandardMaterial({ color: 0xf7f1e3, roughness: 0.35, metalness: 0.05 });
  const matRedAccent = new THREE.MeshStandardMaterial({ color: 0xb94438, roughness: 0.38, metalness: 0.25 });
  const matMenu = new THREE.MeshStandardMaterial({ map: tex.menuTex, roughness: 0.8 });

  // Highlightable materials
  const matWinGlass = new THREE.MeshStandardMaterial({
    color: 0xffe4b0,
    emissive: 0xffb84d,
    emissiveIntensity: 0.38,
    roughness: 0.14,
    metalness: 0.08,
    transparent: true,
    opacity: 0.46,
    side: THREE.DoubleSide,
  });
  hl.windows.push({ mat: matWinGlass, base: 0.38, hi: 1.08 });

  const matCupolaGlass = new THREE.MeshStandardMaterial({
    color: 0xffebc2,
    emissive: 0xffbe55,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.05,
  });
  hl.windows.push({ mat: matCupolaGlass, base: 0.6, hi: 1.45 });

  const matInteriorGlow = new THREE.MeshStandardMaterial({
    color: 0xf5e2be,
    emissive: 0xffbe66,
    emissiveIntensity: 0.48,
    roughness: 0.8,
  });
  hl.windows.push({ mat: matInteriorGlow, base: 0.48, hi: 1.05 });

  const matWarmLamp = new THREE.MeshStandardMaterial({
    color: 0xfff3cf,
    emissive: 0xffc65c,
    emissiveIntensity: 0.95,
    roughness: 0.2,
  });
  hl.lights.push({ mat: matWarmLamp, base: 0.95, hi: 2.15 });

  const matBulb = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: 0xffc44d,
    emissiveIntensity: 0.95,
    roughness: 0.18,
  });
  hl.lights.push({ mat: matBulb, base: 0.95, hi: 2.3 });

  const awningHiEmissive = accentColor.clone().lerp(new THREE.Color(0xfff0c2), 0.35);
  const matAwning = new THREE.MeshStandardMaterial({
    map: tex.awningTex,
    roughness: 0.78,
    metalness: 0.02,
    emissive: awningHiEmissive,
    emissiveIntensity: 0.0,
    side: THREE.DoubleSide,
  });
  hl.awnings.push({ mat: matAwning, base: 0.0, hi: 0.26 });

  const matUmbrella = new THREE.MeshStandardMaterial({
    map: tex.umbrellaTex,
    roughness: 0.76,
    metalness: 0.02,
    emissive: awningHiEmissive,
    emissiveIntensity: 0.0,
    side: THREE.DoubleSide,
  });
  hl.awnings.push({ mat: matUmbrella, base: 0.0, hi: 0.22 });

  // Layout constants
  const y0 = 0.15;
  const hallW = 6.5;
  const hallD = 3.3;
  const zBack = -2.95;
  const zFront = zBack + hallD; // +0.35
  const zMid = (zBack + zFront) * 0.5; // -1.30
  const wallH = 2.7;
  const wallT = 0.24;
  const gableRise = 1.5; // ridge at y0 + wallH + gableRise = 4.35
  const yEave = y0 + wallH; // 2.85
  const yRidge = yEave + gableRise; // 4.35

  // 1. PAVED BASE (8 x 7 x 0.15)
  const baseGeo = makeRoundedBoxGeo(THREE, 8.0, 0.15, 7.0, 0.22, 0.03, 3, 0.35);
  addMesh(root, baseGeo, matStone, 0, 0.075, 0, false, true);

  const pavingDeckGeo = makeRoundedBoxGeo(THREE, 7.72, 0.024, 6.72, 0.14, 0.01, 2, 0);
  // Assign top-down planar UVs for the dedicated plaza paving map
  {
    const pos = pavingDeckGeo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = pos.getX(i) / 7.72 + 0.5;
      uvs[i * 2 + 1] = 1 - (pos.getZ(i) / 6.72 + 0.5);
    }
    pavingDeckGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  addMesh(root, pavingDeckGeo, matPaving, 0, 0.144, 0, false, true);

  // 2. HALL WALLS WITH REAL ARCHED OPENINGS & STONE TRIM
  const frontOpenings = [
    { x: -2.42, y: 0.44, w: 0.82, h: 1.82 },
    { x: -1.36, y: 0.44, w: 0.82, h: 1.82 },
    { x: 0.0, y: 0.04, w: 1.12, h: 2.02 },
    { x: 1.36, y: 0.44, w: 0.82, h: 1.82 },
    { x: 2.42, y: 0.44, w: 0.82, h: 1.82 },
  ];
  const backOpenings = [
    { x: -2.42, y: 0.44, w: 0.82, h: 1.82 },
    { x: -1.21, y: 0.44, w: 0.82, h: 1.82 },
    { x: 0.0, y: 0.44, w: 0.82, h: 1.82 },
    { x: 1.21, y: 0.44, w: 0.82, h: 1.82 },
    { x: 2.42, y: 0.44, w: 0.82, h: 1.82 },
  ];
  const sideOpenings = [
    { x: -0.78, y: 0.44, w: 0.78, h: 1.78 },
    { x: 0.78, y: 0.44, w: 0.78, h: 1.78 },
  ];
  const oculusSpec = { x: 0, y: wallH + 0.62, r: 0.3 };

  const frontWallGeo = makeArchedWallGeo(THREE, hallW, wallH, wallT, frontOpenings);
  addMesh(root, frontWallGeo, matBrick, 0, y0, zFront - wallT * 0.5);

  const backWallGeo = makeArchedWallGeo(THREE, hallW, wallH, wallT, backOpenings);
  addMesh(root, backWallGeo, matBrick, 0, y0, zBack + wallT * 0.5);

  const sideWallGeo = makeArchedWallGeo(THREE, hallD - 0.04, wallH, wallT, sideOpenings, gableRise, oculusSpec);
  const leftWall = addMesh(root, sideWallGeo, matBrick, -hallW * 0.5 + wallT * 0.5, y0, zMid);
  leftWall.rotation.y = Math.PI * 0.5;
  const rightWall = addMesh(root, sideWallGeo, matBrick, hallW * 0.5 - wallT * 0.5, y0, zMid);
  rightWall.rotation.y = -Math.PI * 0.5;

  // Stone plinth foundation bands (split around front doorway)
  const plinthH = 0.42;
  const plinthSideFrontGeo = makeRoundedBoxGeo(THREE, 2.66, plinthH, 0.14, 0.03, 0.015, 2, 0.6);
  addMesh(root, plinthSideFrontGeo, matStone, -1.98, y0 + plinthH * 0.5, zFront + 0.02);
  addMesh(root, plinthSideFrontGeo, matStone, 1.98, y0 + plinthH * 0.5, zFront + 0.02);
  addMesh(root, makeRoundedBoxGeo(THREE, hallW + 0.12, plinthH, 0.14, 0.03, 0.015, 2, 0.6), matStone, 0, y0 + plinthH * 0.5, zBack - 0.02);
  const plinthEndGeo = makeRoundedBoxGeo(THREE, 0.14, plinthH, hallD + 0.12, 0.03, 0.015, 2, 0.6);
  addMesh(root, plinthEndGeo, matStone, -hallW * 0.5 - 0.02, y0 + plinthH * 0.5, zMid);
  addMesh(root, plinthEndGeo, matStone, hallW * 0.5 + 0.02, y0 + plinthH * 0.5, zMid);

  // Corner stone pilasters / quoins
  const cornerPilGeo = makeRoundedBoxGeo(THREE, 0.26, wallH - 0.04, 0.26, 0.035, 0.015, 2, 0.55);
  for (const sx of [-1, 1]) {
    for (const sz of [zBack + 0.08, zFront - 0.08]) {
      addMesh(root, cornerPilGeo, matStone, sx * (hallW * 0.5 - 0.04), y0 + wallH * 0.5, sz);
    }
  }

  // Stone cornice under front & back eaves
  const corniceGeo = makeRoundedBoxGeo(THREE, hallW + 0.2, 0.13, 0.16, 0.03, 0.015, 2, 0.5);
  addMesh(root, corniceGeo, matStone, 0, yEave - 0.06, zFront + 0.04);
  addMesh(root, corniceGeo, matStone, 0, yEave - 0.06, zBack - 0.04);

  // Projecting front entrance surround pilasters + small pediment gable
  const entryPilGeo = makeRoundedBoxGeo(THREE, 0.22, 2.66, 0.2, 0.035, 0.015, 2, 0.6);
  addMesh(root, entryPilGeo, matStone, -0.78, y0 + 1.33, zFront + 0.06);
  addMesh(root, entryPilGeo, matStone, 0.78, y0 + 1.33, zFront + 0.06);

  // Front entrance steps
  addMesh(root, makeRoundedBoxGeo(THREE, 1.65, 0.09, 0.56, 0.06, 0.018, 2, 0.6), matStone, 0, y0 + 0.045, zFront + 0.22);
  addMesh(root, makeRoundedBoxGeo(THREE, 1.36, 0.08, 0.34, 0.05, 0.015, 2, 0.6), matStone, 0, y0 + 0.11, zFront + 0.12);

  // 3. COZY VISIBLE INTERIOR (LONG DINING TABLES, BENCHES, PENDANT LAMPS)
  const interior = new THREE.Group();
  root.add(interior);
  const inW = hallW - wallT * 2 - 0.02;
  const inD = hallD - wallT * 2 - 0.02;

  // Honey wood floor + central warm runner rug
  addMesh(interior, makeRoundedBoxGeo(THREE, inW, 0.04, inD, 0.02, 0.01, 1, 0.7), matWood, 0, y0 + 0.03, zMid, false, true);
  addMesh(interior, makeRoundedBoxGeo(THREE, 0.88, 0.015, inD - 0.3, 0.04, 0.005, 2, 0.5), matRedAccent, 0, y0 + 0.055, zMid, false, true);

  // Warm glowing ceiling plane + exposed timber rafters
  addMesh(interior, makeRoundedBoxGeo(THREE, inW, 0.06, inD, 0.02, 0.01, 1, 0.5), matInteriorGlow, 0, yEave - 0.05, zMid, false, false);
  const beamGeo = makeRoundedBoxGeo(THREE, 0.12, 0.14, inD, 0.02, 0.01, 1, 0.6);
  for (const bx of [-2.0, -0.7, 0.7, 2.0]) {
    addMesh(interior, beamGeo, matWoodDark, bx, yEave - 0.14, zMid, false, false);
  }

  // Four long refectory dining tables with benches, plates & glowing table lamps
  const longTopGeo = makeRoundedBoxGeo(THREE, 2.05, 0.07, 0.54, 0.035, 0.012, 2, 0.7);
  const longLegGeo = makeRoundedBoxGeo(THREE, 0.08, 0.42, 0.42, 0.02, 0.01, 2, 0.5);
  const benchGeo = makeRoundedBoxGeo(THREE, 1.92, 0.05, 0.18, 0.02, 0.01, 2, 0.7);
  const benchLegGeo = makeRoundedBoxGeo(THREE, 0.06, 0.25, 0.14, 0.015, 0.008, 1, 0.5);
  const plateGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.018, 10);
  const tableLampBaseGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.08, 10);
  const tableLampShadeGeo = new THREE.CylinderGeometry(0.035, 0.065, 0.085, 10);

  const tableCoords = [
    [-1.78, zMid + 0.58],
    [1.78, zMid + 0.58],
    [-1.78, zMid - 0.58],
    [1.78, zMid - 0.58],
  ];
  for (const [tx, tz] of tableCoords) {
    const tg = new THREE.Group();
    tg.position.set(tx, y0 + 0.05, tz);
    interior.add(tg);
    addMesh(tg, longTopGeo, matWood, 0, 0.44, 0, false, true);
    addMesh(tg, longLegGeo, matWoodDark, -0.78, 0.21, 0, false, true);
    addMesh(tg, longLegGeo, matWoodDark, 0.78, 0.21, 0, false, true);
    for (const bz of [-0.39, 0.39]) {
      addMesh(tg, benchGeo, matWood, 0, 0.27, bz, false, true);
      addMesh(tg, benchLegGeo, matWoodDark, -0.72, 0.125, bz, false, true);
      addMesh(tg, benchLegGeo, matWoodDark, 0.72, 0.125, bz, false, true);
    }
    // Glowing table lamps & ceramic plates visible through windows
    for (const lx of [-0.52, 0.52]) {
      addMesh(tg, tableLampBaseGeo, matBrass, lx, 0.51, 0, false, false);
      addMesh(tg, tableLampShadeGeo, matWarmLamp, lx, 0.58, 0, false, false);
    }
    for (const px of [-0.82, -0.22, 0.22, 0.82]) {
      addMesh(tg, plateGeo, matCeramic, px, 0.485, 0.14, false, false);
      addMesh(tg, plateGeo, matCeramic, px, 0.485, -0.14, false, false);
    }
  }

  // Pendant chandeliers hanging inside
  const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.52, 6);
  const pendantGlobeGeo = new THREE.SphereGeometry(0.095, 12, 10);
  const pendantCapGeo = new THREE.CylinderGeometry(0.03, 0.075, 0.05, 10);
  for (const [px, pz] of [[-1.85, zMid], [0, zMid], [1.85, zMid], [-1.85, zMid + 0.65], [1.85, zMid + 0.65]]) {
    addMesh(interior, cordGeo, matIron, px, yEave - 0.34, pz, false, false);
    addMesh(interior, pendantCapGeo, matBrass, px, yEave - 0.6, pz, false, false);
    addMesh(interior, pendantGlobeGeo, matWarmLamp, px, yEave - 0.68, pz, false, false);
  }

  // 4. ARCHED WINDOWS, MULLIONS, SILLS, FRONT DOUBLE DOORS & LANTERNS
  const winTrimGeo = makeArchedFrameGeo(THREE, 0.82, 1.82, 0.075, 0.06);
  const winFrameGeo = makeArchedFrameGeo(THREE, 0.8, 1.8, 0.032, 0.08);
  const winPaneGeo = makeArchedPaneGeo(THREE, 0.81, 1.81);
  const sillGeo = makeRoundedBoxGeo(THREE, 0.98, 0.075, 0.32, 0.025, 0.012, 2, 0.6);
  const keystoneGeo = makeRoundedBoxGeo(THREE, 0.14, 0.18, 0.09, 0.02, 0.01, 2, 0.5);
  const vMulGeo = makeRoundedBoxGeo(THREE, 0.032, 1.74, 0.04, 0.008, 0.004, 1, 0);
  const hMulGeo = makeRoundedBoxGeo(THREE, 0.78, 0.032, 0.04, 0.008, 0.004, 1, 0);
  const fanSpokeGeo = makeRoundedBoxGeo(THREE, 0.024, 0.38, 0.035, 0.006, 0.003, 1, 0);

  function addArchedWindow(x, y, z, rotY, scaleX = 1, scaleY = 1) {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    wg.rotation.y = rotY;
    wg.scale.set(scaleX, scaleY, 1);
    root.add(wg);

    addMesh(wg, sillGeo, matStone, 0, -0.02, 0.04);
    addMesh(wg, winTrimGeo, matStone, 0, 0, 0.115);
    addMesh(wg, keystoneGeo, matStone, 0, 1.84, 0.13);
    addMesh(wg, winFrameGeo, matCreamTrim, 0, 0, 0.01);
    addMesh(wg, winPaneGeo, matWinGlass, 0, 0, 0.0, false, false);
    addMesh(wg, vMulGeo, matCreamTrim, 0, 0.88, 0.01, false, false);
    addMesh(wg, hMulGeo, matCreamTrim, 0, 0.5, 0.01, false, false);
    addMesh(wg, hMulGeo, matCreamTrim, 0, 0.98, 0.01, false, false);
    addMesh(wg, hMulGeo, matCreamTrim, 0, 1.41, 0.01, false, false);
    for (const ang of [-0.62, 0.62]) {
      const sp = addMesh(wg, fanSpokeGeo, matCreamTrim, Math.sin(ang) * 0.18, 1.41 + Math.cos(ang) * 0.18, 0.01, false, false);
      sp.rotation.z = -ang;
    }
  }

  for (const op of frontOpenings) {
    if (op.x === 0) continue;
    addArchedWindow(op.x, y0 + op.y, zFront - wallT * 0.5, 0);
  }
  for (const op of backOpenings) {
    addArchedWindow(op.x, y0 + op.y, zBack + wallT * 0.5, Math.PI);
  }
  for (const op of sideOpenings) {
    addArchedWindow(-hallW * 0.5 + wallT * 0.5, y0 + op.y, zMid - op.x, -Math.PI * 0.5, 0.95, 0.978);
    addArchedWindow(hallW * 0.5 - wallT * 0.5, y0 + op.y, zMid + op.x, Math.PI * 0.5, 0.95, 0.978);
  }

  // Round oculus windows in left & right gables
  const oculusRimGeo = new THREE.TorusGeometry(0.31, 0.048, 10, 20);
  const oculusGlassGeo = new THREE.CircleGeometry(0.29, 18);
  const oculusBarGeo = makeRoundedBoxGeo(THREE, 0.56, 0.028, 0.035, 0.006, 0.003, 1, 0);
  for (const sx of [-1, 1]) {
    const og = new THREE.Group();
    og.position.set(sx * (hallW * 0.5 - wallT * 0.5), y0 + oculusSpec.y, zMid);
    og.rotation.y = sx * Math.PI * 0.5;
    root.add(og);
    addMesh(og, oculusRimGeo, matStone, 0, 0, 0.12);
    addMesh(og, oculusGlassGeo, matWinGlass, 0, 0, 0.0, false, false);
    addMesh(og, oculusBarGeo, matCreamTrim, 0, 0, 0.02, false, false);
    const vb = addMesh(og, oculusBarGeo, matCreamTrim, 0, 0, 0.02, false, false);
    vb.rotation.z = Math.PI * 0.5;
  }

  // Central Front Arched Double Doors + Fanlight + Carriage Lanterns
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, y0 + 0.04, zFront - wallT * 0.5);
  root.add(doorGroup);
  addMesh(doorGroup, makeArchedFrameGeo(THREE, 1.12, 2.02, 0.095, 0.08), matStone, 0, 0, 0.125);
  addMesh(doorGroup, makeRoundedBoxGeo(THREE, 0.18, 0.22, 0.11, 0.025, 0.01, 2, 0.5), matStone, 0, 2.05, 0.14);
  addMesh(doorGroup, makeArchedFrameGeo(THREE, 1.1, 2.0, 0.04, 0.09), matWoodDark, 0, 0, 0.02);
  addMesh(doorGroup, makeArchedPaneGeo(THREE, 1.08, 1.98), matWinGlass, 0, 0, 0.0, false, false);

  const doorLeafGeo = makeRoundedBoxGeo(THREE, 0.49, 0.72, 0.06, 0.02, 0.01, 2, 0.6);
  const doorStileGeo = makeRoundedBoxGeo(THREE, 0.08, 1.44, 0.06, 0.015, 0.008, 1, 0.6);
  const doorHandleGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8);
  for (const sx of [-1, 1]) {
    addMesh(doorGroup, doorLeafGeo, matWoodDark, sx * 0.26, 0.38, 0.01);
    addMesh(doorGroup, doorStileGeo, matWoodDark, sx * 0.48, 0.74, 0.01);
    addMesh(doorGroup, doorStileGeo, matWoodDark, sx * 0.045, 0.74, 0.01);
    addMesh(doorGroup, doorHandleGeo, matBrass, sx * 0.09, 0.76, 0.06);
  }
  addMesh(doorGroup, makeRoundedBoxGeo(THREE, 1.06, 0.07, 0.07, 0.015, 0.008, 1, 0.6), matWoodDark, 0, 1.44, 0.01);
  for (const ang of [-0.8, -0.35, 0.35, 0.8]) {
    const sp = addMesh(doorGroup, makeRoundedBoxGeo(THREE, 0.025, 0.52, 0.035, 0.005, 0.002, 1, 0), matCreamTrim, Math.sin(ang) * 0.25, 1.46 + Math.cos(ang) * 0.25, 0.015, false, false);
    sp.rotation.z = -ang;
  }

  // Flanking wrought-iron carriage wall lanterns
  const lanternBracketGeo = makeRoundedBoxGeo(THREE, 0.05, 0.18, 0.14, 0.015, 0.006, 1, 0);
  const lanternBodyGeo = new THREE.CylinderGeometry(0.065, 0.048, 0.15, 6);
  const lanternCapGeo = new THREE.ConeGeometry(0.085, 0.08, 6);
  for (const sx of [-1, 1]) {
    const lx = sx * 0.78;
    addMesh(root, lanternBracketGeo, matIron, lx, y0 + 1.84, zFront + 0.18);
    addMesh(root, lanternBodyGeo, matWarmLamp, lx, y0 + 1.88, zFront + 0.24, false, false);
    addMesh(root, lanternCapGeo, matIron, lx, y0 + 1.98, zFront + 0.24);
  }

  // 5. SLATE PITCHED ROOF, FRONT ENTRY GABLE, TWO CHIMNEYS & CUPOLA
  const halfRunWall = hallD * 0.5;
  const eaveOverhang = 0.28;
  const roofAngle = Math.atan2(gableRise, halfRunWall);
  const slopeLen = (halfRunWall + eaveOverhang) / Math.cos(roofAngle);
  const roofW = hallW + 0.52;
  const roofSlabT = 0.11;

  const slopeGeo = makeRoundedBoxGeo(THREE, roofW, roofSlabT, slopeLen, 0.03, 0.018, 2, 0.55);
  // Adjust UV scale nicely for roof slates
  applyBoxUVs(slopeGeo, 0.45, 0.55);
  const midOffRun = (halfRunWall + eaveOverhang) * 0.5;
  const midOffY = gableRise - midOffRun * Math.tan(roofAngle) + 0.04;

  const frontSlope = addMesh(root, slopeGeo, matSlate, 0, yEave + midOffY, zMid + midOffRun);
  frontSlope.rotation.x = roofAngle;
  const backSlope = addMesh(root, slopeGeo, matSlate, 0, yEave + midOffY, zMid - midOffRun);
  backSlope.rotation.x = -roofAngle;

  // Roof ridge beam & gable stone bargeboards
  addMesh(root, makeRoundedBoxGeo(THREE, roofW + 0.06, 0.12, 0.14, 0.04, 0.018, 2, 0.5), matStone, 0, yRidge + 0.06, zMid);
  const bargeGeo = makeRoundedBoxGeo(THREE, 0.1, 0.14, slopeLen + 0.04, 0.025, 0.01, 2, 0.5);
  for (const sx of [-1, 1]) {
    const fb = addMesh(root, bargeGeo, matCreamTrim, sx * (roofW * 0.5 - 0.05), yEave + midOffY - 0.03, zMid + midOffRun);
    fb.rotation.x = roofAngle;
    const bb = addMesh(root, bargeGeo, matCreamTrim, sx * (roofW * 0.5 - 0.05), yEave + midOffY - 0.03, zMid - midOffRun);
    bb.rotation.x = -roofAngle;
  }

  // Front central entrance cross-gable roof & pediment
  const pedShape = new THREE.Shape();
  pedShape.moveTo(-0.92, 0);
  pedShape.lineTo(0.92, 0);
  pedShape.lineTo(0, 0.72);
  pedShape.closePath();
  const pedGeo = new THREE.ExtrudeGeometry(pedShape, {
    depth: 0.95,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  pedGeo.translate(0, 0, -0.95);
  applyBoxUVs(pedGeo, 0.45, 0.45);
  addMesh(root, pedGeo, matBrick, 0, yEave - 0.04, zFront + 0.12);
  // Decorative stone rosette in entrance pediment
  addMesh(root, new THREE.TorusGeometry(0.14, 0.035, 8, 16), matStone, 0, yEave + 0.28, zFront + 0.13);
  addMesh(root, new THREE.SphereGeometry(0.07, 10, 8), matStone, 0, yEave + 0.28, zFront + 0.13);

  const dAngle = Math.atan2(0.72, 0.92);
  const dSlopeLen = 1.06 / Math.cos(dAngle);
  const dSlopeGeo = makeRoundedBoxGeo(THREE, dSlopeLen, 0.09, 1.38, 0.025, 0.015, 2, 0.5);
  for (const sx of [-1, 1]) {
    const ds = addMesh(root, dSlopeGeo, matSlate, sx * 0.52, yEave + 0.36, zFront - 0.25);
    ds.rotation.z = -sx * dAngle;
  }
  addMesh(root, makeRoundedBoxGeo(THREE, 0.11, 0.1, 1.4, 0.03, 0.015, 2, 0.5), matStone, 0, yEave + 0.74, zFront - 0.25);

  // Two brick chimneys with stone caps & lathe terracotta chimney pots
  const potProfile = [
    new THREE.Vector2(0.065, 0),
    new THREE.Vector2(0.062, 0.16),
    new THREE.Vector2(0.075, 0.21),
    new THREE.Vector2(0.06, 0.25),
    new THREE.Vector2(0.068, 0.28),
    new THREE.Vector2(0.045, 0.28),
    new THREE.Vector2(0.045, 0.22),
  ];
  const potGeo = new THREE.LatheGeometry(potProfile, 14);
  const chimShaftGeo = makeRoundedBoxGeo(THREE, 0.56, 1.45, 0.56, 0.04, 0.02, 2, 0.55);
  const chimCapGeo = makeRoundedBoxGeo(THREE, 0.68, 0.11, 0.68, 0.04, 0.02, 2, 0.5);
  const chimNeckGeo = makeRoundedBoxGeo(THREE, 0.62, 0.07, 0.62, 0.03, 0.015, 2, 0.5);

  for (const cx of [-2.35, 2.35]) {
    const cg = new THREE.Group();
    cg.position.set(cx, 3.25, zMid - 0.55);
    root.add(cg);
    addMesh(cg, chimShaftGeo, matBrick, 0, 0.72, 0);
    addMesh(cg, chimNeckGeo, matStone, 0, 1.38, 0);
    addMesh(cg, chimCapGeo, matStone, 0, 1.48, 0);
    addMesh(cg, potGeo, matTerracotta, -0.13, 1.52, 0);
    addMesh(cg, potGeo, matTerracotta, 0.13, 1.52, 0);
  }

  // Small central cupola (total height ~5.55)
  const cupola = new THREE.Group();
  cupola.position.set(0, yRidge - 0.32, zMid);
  root.add(cupola);
  addMesh(cupola, makeRoundedBoxGeo(THREE, 0.88, 0.56, 0.88, 0.05, 0.02, 2, 0.5), matCreamTrim, 0, 0.28, 0);
  addMesh(cupola, makeRoundedBoxGeo(THREE, 0.98, 0.09, 0.98, 0.04, 0.02, 2, 0.5), matStone, 0, 0.58, 0);

  // Octagonal lantern drum with glowing glass core and 8 slim corner columns
  addMesh(cupola, new THREE.CylinderGeometry(0.32, 0.32, 0.44, 8), matCupolaGlass, 0, 0.84, 0, false, false);
  const cupColGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.46, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    addMesh(cupola, cupColGeo, matCreamTrim, Math.cos(a) * 0.35, 0.84, Math.sin(a) * 0.35);
  }
  addMesh(cupola, new THREE.CylinderGeometry(0.43, 0.41, 0.075, 8), matStone, 0, 1.09, 0);

  // Graceful ogee copper dome + brass finial
  const domePts = [
    new THREE.Vector2(0.41, 0.0),
    new THREE.Vector2(0.39, 0.08),
    new THREE.Vector2(0.31, 0.18),
    new THREE.Vector2(0.18, 0.27),
    new THREE.Vector2(0.07, 0.34),
    new THREE.Vector2(0.025, 0.39),
    new THREE.Vector2(0.0, 0.41),
  ];
  addMesh(cupola, new THREE.LatheGeometry(domePts, 16), matCopper, 0, 1.12, 0);
  const finialPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.048, 0.04),
    new THREE.Vector2(0.015, 0.09),
    new THREE.Vector2(0.028, 0.13),
    new THREE.Vector2(0.008, 0.24),
    new THREE.Vector2(0.0, 0.27),
  ];
  addMesh(cupola, new THREE.LatheGeometry(finialPts, 10), matBrass, 0, 1.5, 0);

  // 6. YELLOW STRIPED AWNINGS OVER FRONT ARCHED WINDOWS
  const awningGeo = makeCurvedAwningGeo(THREE, 0.96, 0.56, 0.28, 0.11, 6);
  const bracketGeo = makeRoundedBoxGeo(THREE, 0.025, 0.025, 0.5, 0.006, 0.003, 1, 0);
  for (const ax of [-2.42, -1.36, 1.36, 2.42]) {
    const ag = new THREE.Group();
    ag.position.set(ax, y0 + 2.18, zFront + 0.02);
    root.add(ag);
    addMesh(ag, awningGeo, matAwning, 0, 0, 0, true, true);
    for (const bx of [-0.43, 0.43]) {
      const br = addMesh(ag, bracketGeo, matIron, bx, -0.02, 0.24, false, false);
      br.rotation.x = -0.35;
    }
  }

  // 7. TERRACE ON +Z SIDE: 4 ROUND TABLES, INSTANCED CHAIRS & YELLOW UMBRELLAS
  const tablePedGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.18, 0.0),
      new THREE.Vector2(0.17, 0.03),
      new THREE.Vector2(0.05, 0.08),
      new THREE.Vector2(0.032, 0.44),
      new THREE.Vector2(0.11, 0.47),
    ],
    14
  );
  const tableTopGeo = new THREE.CylinderGeometry(0.36, 0.35, 0.045, 20);
  const poleGeo = new THREE.CylinderGeometry(0.022, 0.025, 1.72, 10);
  const umbCanopyGeo = makeUmbrellaCanopyGeo(THREE, 0.56, 0.25, 8);
  const umbFinialGeo = new THREE.SphereGeometry(0.038, 10, 8);
  const mugGeo = new THREE.CylinderGeometry(0.028, 0.024, 0.05, 10);

  const terraceTables = [
    { x: -2.55, z: 1.44, rot: 0.25 },
    { x: -1.42, z: 2.52, rot: -0.35 },
    { x: 1.28, z: 2.52, rot: 0.4 },
    { x: 2.28, z: 1.38, rot: -0.2 },
  ];

  const chairPlacements = [];
  for (const tb of terraceTables) {
    const tg = new THREE.Group();
    tg.position.set(tb.x, y0, tb.z);
    tg.rotation.y = tb.rot;
    root.add(tg);

    addMesh(tg, tablePedGeo, matIron, 0, 0, 0);
    addMesh(tg, tableTopGeo, matWood, 0, 0.48, 0);
    // Umbrella pole, scalloped canopy & brass finial
    addMesh(tg, poleGeo, matWoodDark, 0, 0.88, 0);
    addMesh(tg, umbCanopyGeo, matUmbrella, 0, 1.5, 0, true, true);
    addMesh(tg, umbFinialGeo, matBrass, 0, 1.77, 0);

    // Small ceramic cups & saucers on table
    addMesh(tg, plateGeo, matCeramic, 0.16, 0.51, 0.08, false, true);
    addMesh(tg, mugGeo, matCeramic, 0.16, 0.54, 0.08, false, false);
    addMesh(tg, mugGeo, matTerracotta, -0.15, 0.53, -0.11, false, false);

    // 3 cozy chairs per round table
    for (let c = 0; c < 3; c++) {
      const ang = tb.rot + c * ((Math.PI * 2) / 3) + 0.42;
      const dist = 0.47;
      chairPlacements.push({
        x: tb.x + Math.cos(ang) * dist,
        z: tb.z + Math.sin(ang) * dist,
        rotY: Math.atan2(-Math.cos(ang), -Math.sin(ang)),
      });
    }
  }

  // Instanced cafe chairs (seat, curved back, 4 slender legs via 3 InstancedMeshes)
  const chairCount = chairPlacements.length;
  const seatGeo = new THREE.CylinderGeometry(0.16, 0.15, 0.036, 14);
  const backGeo = makeRoundedBoxGeo(THREE, 0.28, 0.17, 0.032, 0.04, 0.01, 2, 0.5);
  const legGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.28, 6);
  const postGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.34, 6);

  const instSeats = new THREE.InstancedMesh(seatGeo, matWood, chairCount);
  const instBacks = new THREE.InstancedMesh(backGeo, matWood, chairCount);
  const instLegs = new THREE.InstancedMesh(legGeo, matIron, chairCount * 4);
  const instPosts = new THREE.InstancedMesh(postGeo, matIron, chairCount * 2);
  for (const im of [instSeats, instBacks, instLegs, instPosts]) {
    im.castShadow = true;
    im.receiveShadow = true;
    root.add(im);
  }

  const dummy = new THREE.Object3D();
  const childDummy = new THREE.Object3D();
  const baseMat = new THREE.Matrix4();
  const localMat = new THREE.Matrix4();

  chairPlacements.forEach((ch, idx) => {
    dummy.position.set(ch.x, y0, ch.z);
    dummy.rotation.set(0, ch.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    baseMat.copy(dummy.matrix);

    childDummy.position.set(0, 0.28, 0);
    childDummy.rotation.set(0, 0, 0);
    childDummy.updateMatrix();
    localMat.multiplyMatrices(baseMat, childDummy.matrix);
    instSeats.setMatrixAt(idx, localMat);

    childDummy.position.set(0, 0.52, -0.145);
    childDummy.rotation.set(-0.12, 0, 0);
    childDummy.updateMatrix();
    localMat.multiplyMatrices(baseMat, childDummy.matrix);
    instBacks.setMatrixAt(idx, localMat);

    const legCoords = [
      [-0.1, -0.1],
      [0.1, -0.1],
      [-0.1, 0.1],
      [0.1, 0.1],
    ];
    legCoords.forEach(([lx, lz], li) => {
      childDummy.position.set(lx, 0.14, lz);
      childDummy.rotation.set(0, 0, 0);
      childDummy.updateMatrix();
      localMat.multiplyMatrices(baseMat, childDummy.matrix);
      instLegs.setMatrixAt(idx * 4 + li, localMat);
    });

    [-0.1, 0.1].forEach((px, pi) => {
      childDummy.position.set(px, 0.43, -0.13);
      childDummy.rotation.set(-0.08, 0, 0);
      childDummy.updateMatrix();
      localMat.multiplyMatrices(baseMat, childDummy.matrix);
      instPosts.setMatrixAt(idx * 2 + pi, localMat);
    });
  });
  for (const im of [instSeats, instBacks, instLegs, instPosts]) im.instanceMatrix.needsUpdate = true;

  // 8. STRING LIGHTS ON WROUGHT-IRON POLES
  const poleCoords = [
    [-3.52, 0.72],
    [-3.52, 3.12],
    [-0.82, 3.12],
    [0.82, 3.12],
    [3.52, 3.12],
    [3.52, 0.72],
  ];
  const sPoleH = 2.16;
  const sPoleGeo = new THREE.CylinderGeometry(0.024, 0.034, sPoleH, 8);
  const sPoleBaseGeo = new THREE.CylinderGeometry(0.055, 0.085, 0.16, 10);
  const sPoleTopGeo = new THREE.SphereGeometry(0.048, 10, 8);

  const instSPoles = new THREE.InstancedMesh(sPoleGeo, matIron, poleCoords.length);
  const instSBases = new THREE.InstancedMesh(sPoleBaseGeo, matIron, poleCoords.length);
  const instSTops = new THREE.InstancedMesh(sPoleTopGeo, matBrass, poleCoords.length);
  for (const im of [instSPoles, instSBases, instSTops]) {
    im.castShadow = true;
    im.receiveShadow = true;
    root.add(im);
  }
  poleCoords.forEach(([px, pz], i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(px, y0 + sPoleH * 0.5, pz);
    dummy.updateMatrix();
    instSPoles.setMatrixAt(i, dummy.matrix);

    dummy.position.set(px, y0 + 0.08, pz);
    dummy.updateMatrix();
    instSBases.setMatrixAt(i, dummy.matrix);

    dummy.position.set(px, y0 + sPoleH + 0.02, pz);
    dummy.updateMatrix();
    instSTops.setMatrixAt(i, dummy.matrix);
  });
  for (const im of [instSPoles, instSBases, instSTops]) im.instanceMatrix.needsUpdate = true;

  // Catenary light strands & instanced glowing bulbs
  const topY = y0 + sPoleH - 0.03;
  const strandDefs = [
    { a: [-3.52, topY, 0.72], b: [-3.52, topY, 3.12], sag: 0.24, count: 7 },
    { a: [-3.52, topY, 3.12], b: [-0.82, topY, 3.12], sag: 0.26, count: 8 },
    { a: [-0.82, topY, 3.12], b: [0.82, topY, 3.12], sag: 0.16, count: 6 },
    { a: [0.82, topY, 3.12], b: [3.52, topY, 3.12], sag: 0.26, count: 8 },
    { a: [3.52, topY, 3.12], b: [3.52, topY, 0.72], sag: 0.24, count: 7 },
    { a: [-0.82, topY, 3.12], b: [-0.82, yEave - 0.16, zFront + 0.06], sag: 0.22, count: 8 },
    { a: [0.82, topY, 3.12], b: [0.82, yEave - 0.16, zFront + 0.06], sag: 0.22, count: 8 },
  ];

  const bulbPositions = [];
  for (const st of strandDefs) {
    const pts = [];
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = st.a[0] + (st.b[0] - st.a[0]) * t;
      const y = st.a[1] + (st.b[1] - st.a[1]) * t - 4 * st.sag * t * (1 - t);
      const z = st.a[2] + (st.b[2] - st.a[2]) * t;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const cableGeo = new THREE.TubeGeometry(curve, 16, 0.01, 5, false);
    addMesh(root, cableGeo, matIron, 0, 0, 0, false, false);

    for (let j = 1; j <= st.count; j++) {
      const t = j / (st.count + 1);
      bulbPositions.push(curve.getPoint(t));
    }
  }

  const bulbGeo = new THREE.SphereGeometry(0.036, 8, 7);
  const socketGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.03, 6);
  const instBulbs = new THREE.InstancedMesh(bulbGeo, matBulb, bulbPositions.length);
  const instSockets = new THREE.InstancedMesh(socketGeo, matIron, bulbPositions.length);
  root.add(instBulbs, instSockets);
  bulbPositions.forEach((bp, i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(bp.x, bp.y - 0.018, bp.z);
    dummy.updateMatrix();
    instSockets.setMatrixAt(i, dummy.matrix);

    dummy.position.set(bp.x, bp.y - 0.052, bp.z);
    dummy.updateMatrix();
    instBulbs.setMatrixAt(i, dummy.matrix);
  });
  instBulbs.instanceMatrix.needsUpdate = true;
  instSockets.instanceMatrix.needsUpdate = true;

  // 9. COFFEE CART ON THE FRONT-RIGHT TERRACE
  const cart = new THREE.Group();
  cart.position.set(2.85, y0, 2.52);
  cart.rotation.y = -0.58;
  root.add(cart);

  // Cart painted cream body & butcher-block counter
  addMesh(cart, makeRoundedBoxGeo(THREE, 0.88, 0.58, 0.48, 0.04, 0.018, 2, 0.6), matCreamTrim, 0, 0.47, 0);
  addMesh(cart, makeRoundedBoxGeo(THREE, 0.82, 0.36, 0.51, 0.025, 0.01, 2, 0.6), matWood, 0, 0.47, 0);
  addMesh(cart, makeRoundedBoxGeo(THREE, 0.98, 0.06, 0.58, 0.03, 0.012, 2, 0.7), matWood, 0, 0.78, 0);

  // Two spoked vintage wheels on left + two legs on right + push handle
  const wheelRimGeo = new THREE.TorusGeometry(0.19, 0.022, 8, 18);
  const spokeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.36, 5);
  for (const wz of [-0.26, 0.26]) {
    const wg = new THREE.Group();
    wg.position.set(-0.24, 0.21, wz);
    cart.add(wg);
    addMesh(wg, wheelRimGeo, matIron, 0, 0, 0);
    addMesh(wg, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), matBrass, 0, 0, 0).rotation.x = Math.PI * 0.5;
    for (let s = 0; s < 4; s++) {
      const sp = addMesh(wg, spokeGeo, matWoodDark, 0, 0, 0, false, false);
      sp.rotation.z = (s * Math.PI) / 4;
    }
  }
  for (const lz of [-0.18, 0.18]) {
    addMesh(cart, new THREE.CylinderGeometry(0.022, 0.018, 0.22, 8), matIron, 0.34, 0.11, lz);
  }
  // Curved push handle
  addMesh(cart, new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8), matBrass, 0.54, 0.72, 0).rotation.x = Math.PI * 0.5;
  for (const hz of [-0.18, 0.18]) {
    addMesh(cart, makeRoundedBoxGeo(THREE, 0.14, 0.025, 0.025, 0.006, 0.003, 1, 0), matIron, 0.48, 0.72, hz);
  }

  // Mini espresso machine + brass trim
  addMesh(cart, makeRoundedBoxGeo(THREE, 0.28, 0.24, 0.22, 0.03, 0.012, 2, 0.4), matRedAccent, -0.22, 0.92, -0.04);
  addMesh(cart, makeRoundedBoxGeo(THREE, 0.26, 0.04, 0.2, 0.015, 0.008, 1, 0), matBrass, -0.22, 1.05, -0.04);
  addMesh(cart, new THREE.CylinderGeometry(0.024, 0.02, 0.05, 8), matBrass, -0.22, 0.9, 0.09);

  // Pastry display platter & transparent glass dome with miniature pastries
  addMesh(cart, new THREE.CylinderGeometry(0.14, 0.13, 0.025, 14), matWoodDark, 0.18, 0.82, 0.02);
  const domeGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.1,
    metalness: 0.08,
    transparent: true,
    opacity: 0.32,
  });
  addMesh(cart, new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), domeGlassMat, 0.18, 0.83, 0.02, false, false);
  addMesh(cart, new THREE.SphereGeometry(0.018, 8, 6), matBrass, 0.18, 0.96, 0.02);
  const pastryGeo = new THREE.SphereGeometry(0.028, 8, 6);
  addMesh(cart, pastryGeo, matTerracotta, 0.14, 0.85, 0.05, false, false);
  addMesh(cart, pastryGeo, matCreamTrim, 0.22, 0.85, 0.03, false, false);
  addMesh(cart, pastryGeo, matBrass, 0.18, 0.85, -0.03, false, false);

  // Stacked takeaway cups
  for (let c = 0; c < 3; c++) {
    addMesh(cart, mugGeo, matCeramic, 0.37, 0.835 + c * 0.038, -0.14, false, false);
  }

  // Four brass canopy posts & striped mini-awning on cart
  const cartPostGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.78, 8);
  for (const cx of [-0.44, 0.44]) {
    for (const cz of [-0.24, 0.24]) {
      addMesh(cart, cartPostGeo, matBrass, cx, 1.18, cz);
    }
  }
  const cartCanopy = makeCurvedAwningGeo(THREE, 1.06, 0.72, 0.18, 0.09, 6);
  addMesh(cart, cartCanopy, matAwning, 0, 1.56, -0.36, true, true);

  // Small wooden A-frame chalkboard menu easel beside cart (abstract graphics only)
  const easel = new THREE.Group();
  easel.position.set(2.34, y0, 2.94);
  easel.rotation.y = -0.32;
  root.add(easel);
  const boardGeo = makeRoundedBoxGeo(THREE, 0.34, 0.48, 0.035, 0.02, 0.008, 2, 0.5);
  const frontBoard = addMesh(easel, boardGeo, matWoodDark, 0, 0.27, 0.06);
  frontBoard.rotation.x = -0.22;
  const backBoard = addMesh(easel, boardGeo, matWoodDark, 0, 0.27, -0.06);
  backBoard.rotation.x = 0.22;
  const faceMesh = addMesh(easel, new THREE.PlaneGeometry(0.28, 0.4), matMenu, 0, 0.275, 0.082, false, false);
  faceMesh.rotation.x = -0.22;

  // Cozy wooden terrace bench on front-left corner to balance the coffee cart
  const benchG = new THREE.Group();
  benchG.position.set(-2.96, y0, 2.52);
  benchG.rotation.y = 0.58;
  root.add(benchG);
  addMesh(benchG, makeRoundedBoxGeo(THREE, 0.92, 0.055, 0.34, 0.025, 0.01, 2, 0.7), matWood, 0, 0.29, 0);
  const benchBack = addMesh(benchG, makeRoundedBoxGeo(THREE, 0.92, 0.22, 0.045, 0.025, 0.01, 2, 0.7), matWood, 0, 0.5, -0.16);
  benchBack.rotation.x = -0.18;
  for (const bx of [-0.36, 0.36]) {
    addMesh(benchG, makeRoundedBoxGeo(THREE, 0.06, 0.29, 0.32, 0.015, 0.008, 1, 0), matIron, bx, 0.145, 0);
    addMesh(benchG, makeRoundedBoxGeo(THREE, 0.05, 0.3, 0.05, 0.012, 0.005, 1, 0), matIron, bx, 0.42, -0.15);
  }

  // 10. STONE PLANTERS WITH INSTANCED FOLIAGE & FLOWERS
  const planterSpecs = [
    { x: -2.18, z: 3.16, w: 0.88, d: 0.38, h: 0.34, rot: 0 },
    { x: 2.18, z: 3.16, w: 0.88, d: 0.38, h: 0.34, rot: 0 },
    { x: -3.5, z: 1.92, w: 0.86, d: 0.38, h: 0.34, rot: Math.PI * 0.5 },
    { x: 3.5, z: 1.92, w: 0.86, d: 0.38, h: 0.34, rot: Math.PI * 0.5 },
    { x: -0.96, z: 0.66, w: 0.44, d: 0.44, h: 0.36, rot: 0 },
    { x: 0.96, z: 0.66, w: 0.44, d: 0.44, h: 0.36, rot: 0 },
    { x: -3.55, z: -2.92, w: 0.52, d: 0.52, h: 0.38, rot: 0 },
    { x: 3.55, z: -2.92, w: 0.52, d: 0.52, h: 0.38, rot: 0 },
  ];

  const foliageTransforms = [];
  const flowerTransforms = [];
  const pRng = mulberry32(90217);
  const greenPalette = [0x4c7c45, 0x5c8f4c, 0x3e6b3b, 0x6b9c54];
  const flowerPalette = [0xf7c948, 0xf27d65, 0xfff3db, 0xc98be6, 0xff9d5c];

  for (const pl of planterSpecs) {
    const pg = new THREE.Group();
    pg.position.set(pl.x, y0, pl.z);
    pg.rotation.y = pl.rot;
    root.add(pg);

    addMesh(pg, makeRoundedBoxGeo(THREE, pl.w, pl.h, pl.d, 0.04, 0.018, 2, 0.6), matStone, 0, pl.h * 0.5, 0);
    addMesh(pg, makeRoundedBoxGeo(THREE, pl.w + 0.06, 0.06, pl.d + 0.06, 0.03, 0.015, 2, 0.6), matStone, 0, pl.h - 0.01, 0);
    addMesh(pg, makeRoundedBoxGeo(THREE, pl.w - 0.1, 0.06, pl.d - 0.1, 0.03, 0.01, 1, 0), matSoil, 0, pl.h, 0, false, true);

    const isBig = pl.w > 0.65;
    const isCorner = pl.z < 0;
    const bushCount = isBig ? 9 : isCorner ? 7 : 5;
    const cosR = Math.cos(pl.rot);
    const sinR = Math.sin(pl.rot);

    for (let b = 0; b < bushCount; b++) {
      const lx = isBig ? ((b / (bushCount - 1)) - 0.5) * (pl.w - 0.24) + (pRng() - 0.5) * 0.08 : (pRng() - 0.5) * (pl.w - 0.24);
      const lz = (pRng() - 0.5) * (pl.d - 0.18);
      const wx = pl.x + lx * cosR + lz * sinR;
      const wz = pl.z - lx * sinR + lz * cosR;
      const s = (isCorner ? 0.18 : 0.13) + pRng() * 0.07;
      const wy = y0 + pl.h + s * 0.68 + (isCorner && b === 0 ? 0.26 : pRng() * 0.08);
      foliageTransforms.push({
        x: wx,
        y: wy,
        z: wz,
        sx: s * (0.95 + pRng() * 0.25),
        sy: s * (0.85 + pRng() * 0.35),
        sz: s * (0.95 + pRng() * 0.25),
        col: greenPalette[Math.floor(pRng() * greenPalette.length)],
      });

      // Cluster cheerful flower blossoms atop the foliage
      if (!isCorner || b > 1) {
        const fCount = isBig ? 3 : 2;
        for (let f = 0; f < fCount; f++) {
          const fa = pRng() * Math.PI * 2;
          const fr = s * (0.45 + pRng() * 0.45);
          flowerTransforms.push({
            x: wx + Math.cos(fa) * fr,
            y: wy + s * (0.48 + pRng() * 0.35),
            z: wz + Math.sin(fa) * fr,
            s: 0.032 + pRng() * 0.02,
            col: flowerPalette[Math.floor(pRng() * flowerPalette.length)],
          });
        }
      }
    }
  }

  const foliageGeo = new THREE.IcosahedronGeometry(1, 2);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.0 });
  const instFoliage = new THREE.InstancedMesh(foliageGeo, foliageMat, foliageTransforms.length);
  instFoliage.castShadow = true;
  instFoliage.receiveShadow = true;
  root.add(instFoliage);
  const tmpColor = new THREE.Color();
  foliageTransforms.forEach((ft, i) => {
    dummy.position.set(ft.x, ft.y, ft.z);
    dummy.rotation.set(pRng() * 3, pRng() * 3, 0);
    dummy.scale.set(ft.sx, ft.sy, ft.sz);
    dummy.updateMatrix();
    instFoliage.setMatrixAt(i, dummy.matrix);
    instFoliage.setColorAt(i, tmpColor.setHex(ft.col));
  });
  instFoliage.instanceMatrix.needsUpdate = true;
  instFoliage.instanceColor.needsUpdate = true;

  const flowerGeo = new THREE.IcosahedronGeometry(1, 1);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.02 });
  const instFlowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerTransforms.length);
  instFlowers.castShadow = false;
  instFlowers.receiveShadow = true;
  root.add(instFlowers);
  flowerTransforms.forEach((fl, i) => {
    dummy.position.set(fl.x, fl.y, fl.z);
    dummy.rotation.set(pRng() * 3, pRng() * 3, 0);
    dummy.scale.set(fl.s, fl.s * 0.8, fl.s);
    dummy.updateMatrix();
    instFlowers.setMatrixAt(i, dummy.matrix);
    instFlowers.setColorAt(i, tmpColor.setHex(fl.col));
  });
  instFlowers.instanceMatrix.needsUpdate = true;
  instFlowers.instanceColor.needsUpdate = true;

  return root;
}

export function setHighlight(group, on) {
  if (!group || !group.userData || !group.userData._hl) return;
  const hl = group.userData._hl;
  const active = Boolean(on);
  for (const item of hl.windows) {
    item.mat.emissiveIntensity = active ? item.hi : item.base;
  }
  for (const item of hl.lights) {
    item.mat.emissiveIntensity = active ? item.hi : item.base;
  }
  for (const item of hl.awnings) {
    item.mat.emissiveIntensity = active ? item.hi : item.base;
  }
}