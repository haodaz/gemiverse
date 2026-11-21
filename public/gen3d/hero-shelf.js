export const META = {
  id: 'cozy_dorm_bookcase',
  name: 'Cozy Dorm Bookcase',
  kind: 'furniture',
  footprint: [0.8, 0.3],
  variants: [
    'Warm Wooden Bookcase',
    'Metal Frame & Wood Shelves',
    'Leaning Ladder Shelf',
  ],
  note: 'Stylised 0.8x0.3x1.6m dorm-room bookcase with five curated shelves: varied upright, leaning, and stacked books, potted trailing plant, framed abstract art, woven storage box, and ceramic mug.',
};

// -------------------- Colour & Deterministic Helpers --------------------

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function toColor(THREE, value, fallback) {
  const c = new THREE.Color();
  try {
    if (value !== undefined && value !== null) {
      c.set(value);
      return c;
    }
  } catch (_) {}
  c.set(fallback);
  return c;
}

function colorToCSS(c, alpha = 1) {
  const r = Math.round(Math.min(1, Math.max(0, c.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c.b)) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function shiftColor(THREE, base, dh = 0, ds = 0, dl = 0) {
  const c = base.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + dh + 1) % 1,
    Math.min(1, Math.max(0, hsl.s + ds)),
    Math.min(1, Math.max(0, hsl.l + dl))
  );
  return c;
}

function enableShadows(obj, cast = true, receive = true) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return obj;
}

function tagSlot(obj, slot) {
  if (!slot) return obj;
  obj.traverse((child) => {
    if (child.isMesh && !child.userData.slot) {
      child.userData.slot = slot;
    }
  });
  return obj;
}

// -------------------- Geometry Craft Helpers --------------------

function applyBoxWoodUVs(geo, grainAxis = 'x', scale = 1.8) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  let uv = geo.attributes.uv;
  if (!uv) {
    uv = new pos.constructor(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    let u = 0;
    let v = 0;
    if (grainAxis === 'x') {
      if (ny >= nx && ny >= nz) {
        u = x * scale;
        v = z * scale;
      } else if (nz >= nx) {
        u = x * scale;
        v = y * scale;
      } else {
        u = z * scale;
        v = y * scale;
      }
    } else if (grainAxis === 'y') {
      if (nx >= ny && nx >= nz) {
        u = y * scale;
        v = z * scale;
      } else if (nz >= ny) {
        u = y * scale;
        v = x * scale;
      } else {
        u = x * scale;
        v = z * scale;
      }
    } else {
      if (ny >= nx && ny >= nz) {
        u = z * scale;
        v = x * scale;
      } else if (nx >= nz) {
        u = z * scale;
        v = y * scale;
      } else {
        u = x * scale;
        v = y * scale;
      }
    }
    uv.setXY(i, u + 0.5, v + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

function roundedRectShape(THREE, w, h, r) {
  const shape = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw * 0.9, hh * 0.9);
  shape.moveTo(-hw + cr, -hh);
  shape.lineTo(hw - cr, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  shape.lineTo(hw, hh - cr);
  shape.quadraticCurveTo(hw, hh, hw - cr, hh);
  shape.lineTo(-hw + cr, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  shape.lineTo(-hw, -hh + cr);
  shape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return shape;
}

function createRoundedBoard(THREE, w, h, d, bevel = 0.0035, grainAxis = 'x') {
  const b = Math.min(bevel, w * 0.22, h * 0.22, d * 0.28);
  const innerW = Math.max(0.002, w - 2 * b);
  const innerH = Math.max(0.002, h - 2 * b);
  const innerD = Math.max(0.001, d - 2 * b);
  const r = Math.min(b * 1.15, innerW * 0.35, innerH * 0.35);
  const shape = roundedRectShape(THREE, innerW, innerH, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerD,
    bevelEnabled: b > 0.0002,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 3,
  });
  geo.translate(0, 0, -innerD * 0.5);
  applyBoxWoodUVs(geo, grainAxis, 1.5);
  return geo;
}

function buildTaperedTube(
  THREE,
  curve,
  radiusFn,
  tubularSegs = 24,
  radialSegs = 10,
  closedCaps = true,
  ovalScale = [1, 1]
) {
  const pts = [];
  const tans = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    pts.push(curve.getPoint(t));
    tans.push(curve.getTangent(t).normalize());
  }

  const normals = [];
  const binormals = [];
  const up = Math.abs(tans[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(tans[0], up).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, tans[0]).normalize();
  normals.push(n0);
  binormals.push(new THREE.Vector3().crossVectors(tans[0], n0).normalize());

  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    q.setFromUnitVectors(tans[i - 1], tans[i]);
    const ni = normals[i - 1].clone().applyQuaternion(q).normalize();
    const bi = new THREE.Vector3().crossVectors(tans[i], ni).normalize();
    normals.push(ni);
    binormals.push(bi);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const r = Math.max(0.0002, radiusFn(t));
    const p = pts[i];
    const n = normals[i];
    const b = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cs = Math.cos(theta) * r * ovalScale[0];
      const sn = Math.sin(theta) * r * ovalScale[1];
      positions.push(
        p.x + n.x * cs + b.x * sn,
        p.y + n.y * cs + b.y * sn,
        p.z + n.z * cs + b.z * sn
      );
      uvs.push(u, t);
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

  if (closedCaps) {
    const startCenterIdx = positions.length / 3;
    positions.push(pts[0].x, pts[0].y, pts[0].z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenterIdx, j + 1, j);
    }
    const endCenterIdx = positions.length / 3;
    const lastRing = tubularSegs * stride;
    positions.push(pts[tubularSegs].x, pts[tubularSegs].y, pts[tubularSegs].z);
    uvs.push(0.5, 1);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenterIdx, lastRing + j, lastRing + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// -------------------- Procedural Canvas Textures --------------------

function makeNoiseFn(kit) {
  if (kit && typeof kit.noise === 'function') return kit.noise;
  return (x, y) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
}

function createWoodTextures(THREE, kit, woodColor, plankGrooves = false) {
  const noise = makeNoiseFn(kit);
  const darkWood = shiftColor(THREE, woodColor, -0.01, 0.06, -0.16);
  const lightWood = shiftColor(THREE, woodColor, 0.015, -0.03, 0.09);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = colorToCSS(woodColor);
    ctx.fillRect(0, 0, w, h);

    // Subtle tonal boards & cathedral wood grain
    for (let y = 0; y < h; y += 2) {
      const ny = y / h;
      for (let x = 0; x < w; x += 4) {
        const nx = x / w;
        const warp = noise(nx * 2.2, ny * 6.5) * 1.8 + noise(nx * 5.0, ny * 14.0) * 0.55;
        const ring = Math.sin((ny * 18.0 + warp * 3.1) * Math.PI);
        const fine = noise(nx * 28.0, ny * 6.0) * 0.35;
        const mix = ring * 0.5 + 0.5;
        if (mix > 0.58) {
          ctx.fillStyle = colorToCSS(lightWood, (mix - 0.55) * 0.32 + fine * 0.08);
          ctx.fillRect(x, y, 4, 2);
        } else {
          ctx.fillStyle = colorToCSS(darkWood, (0.58 - mix) * 0.38 + fine * 0.1);
          ctx.fillRect(x, y, 4, 2);
        }
      }
    }

    // Fine elongated wood pores
    for (let i = 0; i < 420; i++) {
      const px = noise(i * 1.37, 2.1) * w;
      const py = noise(3.7, i * 1.91) * h;
      const len = 18 + noise(i, i * 0.5) * 52;
      ctx.fillStyle = colorToCSS(darkWood, 0.16);
      ctx.fillRect(px, py, len, 1.2);
    }

    if (plankGrooves) {
      const planks = 6;
      for (let p = 1; p < planks; p++) {
        const gx = (p / planks) * w;
        ctx.fillStyle = 'rgba(20, 12, 6, 0.38)';
        ctx.fillRect(gx - 2, 0, 3, h);
        ctx.fillStyle = colorToCSS(lightWood, 0.18);
        ctx.fillRect(gx + 1, 0, 2, h);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const ny = y / h;
      for (let x = 0; x < w; x += 4) {
        const nx = x / w;
        const warp = noise(nx * 2.2, ny * 6.5) * 1.8;
        const ring = Math.sin((ny * 18.0 + warp * 3.1) * Math.PI);
        const v = Math.round(128 + ring * 26 + (noise(nx * 24, ny * 6) - 0.5) * 24);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 4, 2);
      }
    }
    if (plankGrooves) {
      const planks = 6;
      for (let p = 1; p < planks; p++) {
        const gx = (p / planks) * w;
        ctx.fillStyle = '#202020';
        ctx.fillRect(gx - 1.5, 0, 3, h);
      }
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function createWovenFabricTextures(THREE, kit, baseColor) {
  const noise = makeNoiseFn(kit);
  const dark = shiftColor(THREE, baseColor, 0, 0.04, -0.14);
  const light = shiftColor(THREE, baseColor, 0, -0.04, 0.1);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToCSS(baseColor);
    ctx.fillRect(0, 0, w, h);
    const step = 8;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const alt = ((x / step) + (y / step)) % 2 === 0;
        const n = (noise(x * 0.07, y * 0.07) - 0.5) * 0.16;
        ctx.fillStyle = colorToCSS(alt ? light : dark, 0.42 + n);
        if (alt) {
          ctx.fillRect(x + 1, y, step - 2, step);
        } else {
          ctx.fillRect(x, y + 1, step, step - 2);
        }
        ctx.fillStyle = 'rgba(25,18,12,0.12)';
        ctx.fillRect(x, y, 1, step);
        ctx.fillRect(x, y, step, 1);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.2, 2.4);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#606060';
    ctx.fillRect(0, 0, w, h);
    const step = 8;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const alt = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = alt ? '#d6d6d6' : '#a8a8a8';
        if (alt) {
          ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
        } else {
          ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
        }
      }
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(3.2, 2.4);

  return { map, bump };
}

function createAbstractArtTexture(THREE, kit, primary, secondary, accent) {
  const noise = makeNoiseFn(kit);
  const paper = new THREE.Color(0xf6efe4);
  const warmOchre = shiftColor(THREE, accent, 0.07, -0.05, 0.12);
  const deepInk = shiftColor(THREE, primary, 0, -0.15, -0.28);
  const softSage = shiftColor(THREE, primary, 0.02, -0.08, 0.14);

  const map = kit.canvasTexture(512, 640, (ctx, w, h) => {
    ctx.fillStyle = colorToCSS(paper);
    ctx.fillRect(0, 0, w, h);

    // Subtle watercolor paper grain
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const v = noise(x * 0.06, y * 0.06);
        if (v > 0.55) {
          ctx.fillStyle = `rgba(180,160,135,${(v - 0.55) * 0.12})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Soft background organic blush shape
    ctx.save();
    ctx.fillStyle = colorToCSS(secondary, 0.55);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.58);
    ctx.bezierCurveTo(w * 0.04, h * 0.28, w * 0.42, h * 0.12, w * 0.72, h * 0.25);
    ctx.bezierCurveTo(w * 0.94, h * 0.35, w * 0.92, h * 0.78, w * 0.62, h * 0.86);
    ctx.bezierCurveTo(w * 0.34, h * 0.94, w * 0.15, h * 0.76, w * 0.1, h * 0.58);
    ctx.fill();
    ctx.restore();

    // Terracotta Bauhaus arch
    ctx.save();
    ctx.fillStyle = colorToCSS(accent, 0.92);
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.84);
    ctx.lineTo(w * 0.18, h * 0.46);
    ctx.arc(w * 0.42, h * 0.46, w * 0.24, Math.PI, 0, false);
    ctx.lineTo(w * 0.66, h * 0.84);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Overlapping sage organic moon/hill
    ctx.save();
    ctx.fillStyle = colorToCSS(primary, 0.85);
    ctx.beginPath();
    ctx.arc(w * 0.64, h * 0.64, w * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Warm sun disc upper right
    ctx.save();
    ctx.fillStyle = colorToCSS(warmOchre, 0.95);
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.24, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pale overlapping crescent accent
    ctx.save();
    ctx.fillStyle = colorToCSS(softSage, 0.65);
    ctx.beginPath();
    ctx.arc(w * 0.34, h * 0.32, w * 0.095, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sweeping dark minimalist line art
    ctx.save();
    ctx.strokeStyle = colorToCSS(deepInk, 0.88);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.26, h * 0.82);
    ctx.bezierCurveTo(w * 0.32, h * 0.56, w * 0.56, h * 0.48, w * 0.64, h * 0.24);
    ctx.stroke();

    // Little leaf strokes along the stem
    const leafPts = [
      [0.37, 0.63, -0.55],
      [0.45, 0.54, 0.5],
      [0.52, 0.43, -0.48],
      [0.59, 0.34, 0.45],
    ];
    ctx.lineWidth = 4.5;
    for (const [lx, ly, ang] of leafPts) {
      ctx.save();
      ctx.translate(w * lx, h * ly);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(22, -26, 48, -6);
      ctx.quadraticCurveTo(20, 12, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createBookCoverTexture(THREE, kit, baseColor, foilColor, styleIndex, isDisplay = false) {
  const noise = makeNoiseFn(kit);
  const darker = shiftColor(THREE, baseColor, 0, 0.04, -0.13);
  const lighter = shiftColor(THREE, baseColor, 0, -0.04, 0.08);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToCSS(baseColor);
    ctx.fillRect(0, 0, w, h);

    // Subtle linen cloth weave
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = colorToCSS(y % 6 === 0 ? lighter : darker, 0.14);
      ctx.fillRect(0, y, w, 1.5);
    }
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = colorToCSS(darker, 0.08 + noise(x * 0.1, 1.2) * 0.06);
      ctx.fillRect(x, 0, 1.5, h);
    }

    // Subtle spine crease shadow near top/bottom edges
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0.16)');
    grad.addColorStop(0.08, 'rgba(0,0,0,0)');
    grad.addColorStop(0.92, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Foil bands & title motif (visible on spine and covers)
    ctx.fillStyle = colorToCSS(foilColor, 0.88);
    if (styleIndex % 4 === 0) {
      ctx.fillRect(0, h * 0.12, w, 6);
      ctx.fillRect(0, h * 0.16, w, 2.5);
      ctx.fillRect(0, h * 0.82, w, 2.5);
      ctx.fillRect(0, h * 0.85, w, 6);
      ctx.fillStyle = colorToCSS(darker, 0.55);
      ctx.fillRect(w * 0.18, h * 0.25, w * 0.64, h * 0.26);
      ctx.fillStyle = colorToCSS(foilColor, 0.92);
      ctx.fillRect(w * 0.26, h * 0.31, w * 0.48, 7);
      ctx.fillRect(w * 0.32, h * 0.38, w * 0.36, 4);
      ctx.fillRect(w * 0.30, h * 0.44, w * 0.40, 4);
    } else if (styleIndex % 4 === 1) {
      ctx.fillStyle = colorToCSS(lighter, 0.85);
      ctx.fillRect(0, h * 0.22, w, h * 0.28);
      ctx.fillStyle = colorToCSS(darker, 0.85);
      ctx.fillRect(w * 0.2, h * 0.28, w * 0.6, 8);
      ctx.fillRect(w * 0.28, h * 0.36, w * 0.44, 5);
      ctx.fillStyle = colorToCSS(foilColor, 0.85);
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.7, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (styleIndex % 4 === 2) {
      ctx.fillRect(0, h * 0.09, w, 10);
      ctx.fillRect(w * 0.24, h * 0.28, w * 0.52, 8);
      ctx.fillRect(w * 0.32, h * 0.35, w * 0.36, 5);
      ctx.fillRect(0, h * 0.78, w, 4);
      ctx.fillRect(0, h * 0.83, w, 9);
    } else {
      ctx.fillStyle = colorToCSS(foilColor, 0.78);
      ctx.fillRect(w * 0.14, h * 0.14, w * 0.72, 4);
      ctx.fillRect(w * 0.14, h * 0.82, w * 0.72, 4);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.36);
      ctx.lineTo(w * 0.66, h * 0.5);
      ctx.lineTo(w * 0.5, h * 0.64);
      ctx.lineTo(w * 0.34, h * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    if (isDisplay) {
      // Stylized cover artwork for outward-facing display book
      ctx.strokeStyle = colorToCSS(foilColor, 0.9);
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, w - 40, h - 40);
      ctx.fillStyle = colorToCSS(foilColor, 0.85);
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.52, 44, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = colorToCSS(darker, 0.75);
      ctx.fillRect(w * 0.24, h * 0.18, w * 0.52, 12);
      ctx.fillRect(w * 0.32, h * 0.26, w * 0.36, 7);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createPagesTexture(THREE, kit) {
  const noise = makeNoiseFn(kit);
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f3ebd8';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const shade = 212 + Math.round(noise(x * 0.35, 1.5) * 32);
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 22})`;
      ctx.fillRect(x, 0, 1.3, h);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

function createMugTexture(THREE, kit, glazeColor, bandColor) {
  const noise = makeNoiseFn(kit);
  const rawClay = new THREE.Color(0xc8a482);

  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToCSS(glazeColor);
    ctx.fillRect(0, 0, w, h);

    // Subtle organic glaze gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.72, 'rgba(0,0,0,0)');
    g.addColorStop(0.75, 'rgba(90,65,45,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Un-glazed stoneware base dip (LatheGeometry v=0 is bottom, canvas y=h is bottom)
    ctx.fillStyle = colorToCSS(rawClay);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.78);
    for (let x = 0; x <= w; x += 16) {
      const wave = Math.sin((x / w) * Math.PI * 6) * 3.5 + (noise(x * 0.04, 2.0) - 0.5) * 5;
      ctx.lineTo(x, h * 0.78 + wave);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Hand-painted cozy band & minimal dots
    ctx.strokeStyle = colorToCSS(bandColor, 0.88);
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = h * 0.42 + Math.sin((x / w) * Math.PI * 10) * 6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = colorToCSS(bandColor, 0.82);
    for (let i = 0; i < 16; i++) {
      const cx = ((i + 0.5) / 16) * w;
      ctx.beginPath();
      ctx.arc(cx, h * 0.28, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Artisan stoneware speckles
    for (let i = 0; i < 550; i++) {
      const sx = noise(i * 1.13, 4.2) * w;
      const sy = noise(7.3, i * 1.47) * h;
      const r = 0.7 + noise(i, i * 0.3) * 1.4;
      ctx.fillStyle = 'rgba(72, 52, 36, 0.24)';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  return map;
}

function createCoffeeTexture(THREE, kit) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, w * 0.5);
    grad.addColorStop(0, '#5a341c');
    grad.addColorStop(0.58, '#3f2212');
    grad.addColorStop(0.88, '#7a4b29');
    grad.addColorStop(1, '#c79c6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle latte art swirl
    ctx.strokeStyle = 'rgba(235, 214, 184, 0.58)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 42, -0.4, Math.PI * 1.25);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx + 6, cy - 6, 20, 0.2, Math.PI * 1.5);
    ctx.stroke();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createTerracottaTextures(THREE, kit, accent) {
  const noise = makeNoiseFn(kit);
  const terra = new THREE.Color(0xc56946).lerp(accent, 0.35);
  const dark = shiftColor(THREE, terra, -0.01, 0.05, -0.14);
  const light = shiftColor(THREE, terra, 0.01, -0.05, 0.11);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToCSS(terra);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      const ring = Math.sin((y / h) * Math.PI * 26) * 0.5 + 0.5;
      ctx.fillStyle = colorToCSS(ring > 0.5 ? light : dark, 0.16);
      ctx.fillRect(0, y, w, 2);
    }
    for (let i = 0; i < 400; i++) {
      const px = noise(i * 1.7, 3.1) * w;
      const py = noise(5.2, i * 1.3) * h;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,245,230,0.18)' : 'rgba(65,30,15,0.16)';
      ctx.fillRect(px, py, 2, 2);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = Math.round(128 + Math.sin((y / h) * Math.PI * 26) * 24);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 2);
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  return { map, bump };
}

function createLeafTexture(THREE, kit, primary) {
  const noise = makeNoiseFn(kit);
  const baseGreen = new THREE.Color(0x3f7b4c).lerp(primary, 0.22);
  const tipGreen = shiftColor(THREE, baseGreen, 0.025, 0.06, 0.1);
  const veinColor = shiftColor(THREE, baseGreen, 0.04, -0.1, 0.24);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, colorToCSS(shiftColor(THREE, baseGreen, 0, 0, -0.08)));
    grad.addColorStop(0.5, colorToCSS(baseGreen));
    grad.addColorStop(1, colorToCSS(tipGreen));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle creamy variegation spots
    for (let i = 0; i < 24; i++) {
      const vx = (0.2 + noise(i * 2.1, 1.3) * 0.6) * w;
      const vy = (0.15 + noise(4.4, i * 1.9) * 0.7) * h;
      const rx = 6 + noise(i, 7.1) * 14;
      const ry = 3 + noise(2.2, i) * 6;
      ctx.fillStyle = 'rgba(225, 236, 185, 0.22)';
      ctx.beginPath();
      ctx.ellipse(vx, vy, rx, ry, (noise(i, i) - 0.5) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center midrib & lateral veins
    ctx.strokeStyle = colorToCSS(veinColor, 0.75);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.lineTo(w * 0.5, h * 0.06);
    ctx.stroke();

    ctx.lineWidth = 2.5;
    for (let k = 1; k <= 5; k++) {
      const y = h * (0.86 - k * 0.14);
      const span = w * (0.44 - Math.abs(k - 2.4) * 0.06);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, y);
      ctx.quadraticCurveTo(w * 0.5 - span * 0.5, y - 10, w * 0.5 - span, y - 28);
      ctx.moveTo(w * 0.5, y);
      ctx.quadraticCurveTo(w * 0.5 + span * 0.5, y - 10, w * 0.5 + span, y - 28);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createCorkTexture(THREE, kit) {
  const noise = makeNoiseFn(kit);
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b98b5b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 450; i++) {
      const x = noise(i * 1.4, 2.7) * w;
      const y = noise(8.1, i * 1.7) * h;
      const s = 1.5 + noise(i, 4.4) * 3.5;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(92,58,28,0.34)' : 'rgba(232,196,152,0.3)';
      ctx.fillRect(x, y, s, s * 0.7);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createSoilTexture(THREE, kit) {
  const noise = makeNoiseFn(kit);
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#36261b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const x = noise(i * 1.9, 1.1) * w;
      const y = noise(3.3, i * 2.3) * h;
      const r = 1 + noise(i, 5.5) * 2.2;
      ctx.fillStyle = i % 13 === 0 ? 'rgba(218,210,196,0.55)' : 'rgba(22,14,8,0.45)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createLabelCardTexture(THREE, kit) {
  const map = kit.canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f6efe0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(130, 110, 90, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.strokeStyle = '#4e4238';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(22, 27);
    ctx.lineTo(104, 27);
    ctx.moveTo(32, 41);
    ctx.lineTo(94, 41);
    ctx.stroke();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// -------------------- Bookcase Structure Variants --------------------

function buildTurnedFoot(THREE, woodMat, brassMat) {
  const g = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.0001, 0.014),
    new THREE.Vector2(0.0125, 0.014),
    new THREE.Vector2(0.014, 0.022),
    new THREE.Vector2(0.017, 0.036),
    new THREE.Vector2(0.020, 0.048),
    new THREE.Vector2(0.0185, 0.055),
    new THREE.Vector2(0.022, 0.062),
    new THREE.Vector2(0.022, 0.068),
    new THREE.Vector2(0.0001, 0.068),
  ];
  const woodGeo = new THREE.LatheGeometry(pts, 18);
  const woodMesh = new THREE.Mesh(woodGeo, woodMat);
  g.add(woodMesh);

  const ferrulePts = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.011, 0.0),
    new THREE.Vector2(0.012, 0.003),
    new THREE.Vector2(0.013, 0.0145),
    new THREE.Vector2(0.0001, 0.0145),
  ];
  const ferruleMesh = new THREE.Mesh(new THREE.LatheGeometry(ferrulePts, 18), brassMat);
  g.add(ferruleMesh);
  return g;
}

function buildWoodenBookcase(THREE, mats) {
  const frame = new THREE.Group();
  frame.name = 'bookcaseFrame';

  // 4 turned feet resting on y = 0
  const footCoords = [
    [-0.345, -0.105],
    [0.345, -0.105],
    [-0.345, 0.105],
    [0.345, 0.105],
  ];
  for (const [fx, fz] of footCoords) {
    const foot = buildTurnedFoot(THREE, mats.wood, mats.brass);
    foot.position.set(fx, 0, fz);
    frame.add(foot);
  }

  // Scalloped front apron (curved bezier cutout)
  const apronShape = new THREE.Shape();
  apronShape.moveTo(-0.358, 0.0);
  apronShape.lineTo(0.358, 0.0);
  apronShape.lineTo(0.358, -0.036);
  apronShape.bezierCurveTo(0.24, -0.036, 0.18, -0.018, 0.0, -0.018);
  apronShape.bezierCurveTo(-0.18, -0.018, -0.24, -0.036, -0.358, -0.036);
  apronShape.closePath();
  const apronGeo = new THREE.ExtrudeGeometry(apronShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 16,
  });
  apronGeo.translate(0, 0, -0.007);
  applyBoxWoodUVs(apronGeo, 'x', 1.6);
  const apron = new THREE.Mesh(apronGeo, mats.wood);
  apron.position.set(0, 0.082, 0.128);
  frame.add(apron);

  // Side base rails
  const sideApronGeo = createRoundedBoard(THREE, 0.016, 0.034, 0.25, 0.002, 'z');
  for (const sx of [-0.365, 0.365]) {
    const sa = new THREE.Mesh(sideApronGeo, mats.wood);
    sa.position.set(sx, 0.066, 0.0);
    frame.add(sa);
  }

  // Vertical side panels (outer X = ±0.382)
  const sideGeo = createRoundedBoard(THREE, 0.026, 1.49, 0.286, 0.004, 'y');
  for (const sx of [-0.369, 0.369]) {
    const panel = new THREE.Mesh(sideGeo, mats.wood);
    panel.position.set(sx, 0.065 + 1.49 * 0.5, -0.001);
    frame.add(panel);
  }

  // Vertical-plank recessed back panel
  const backGeo = createRoundedBoard(THREE, 0.728, 1.48, 0.012, 0.0015, 'y');
  const backPanel = new THREE.Mesh(backGeo, mats.woodBack);
  backPanel.position.set(0, 0.072 + 1.48 * 0.5, -0.136);
  frame.add(backPanel);

  // 5 bevelled wooden shelves
  const shelfYTops = [0.102, 0.402, 0.702, 1.002, 1.302];
  const shelfThick = 0.022;
  const shelfGeo = createRoundedBoard(THREE, 0.714, shelfThick, 0.268, 0.0035, 'x');
  const pegGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8);
  pegGeo.rotateZ(Math.PI * 0.5);

  const shelfSpecs = [];
  for (let i = 0; i < shelfYTops.length; i++) {
    const yTop = shelfYTops[i];
    const shelf = new THREE.Mesh(shelfGeo, mats.wood);
    shelf.position.set(0, yTop - shelfThick * 0.5, 0.004);
    frame.add(shelf);

    if (i > 0) {
      for (const px of [-0.352, 0.352]) {
        for (const pz of [-0.095, 0.105]) {
          const peg = new THREE.Mesh(pegGeo, mats.brass);
          peg.position.set(px, yTop - shelfThick - 0.003, pz);
          frame.add(peg);
        }
      }
    }

    shelfSpecs.push({
      y: yTop,
      width: 0.696,
      depth: 0.246,
      zCenter: 0.006,
      headroom: i < 4 ? 0.275 : 0.25,
    });
  }

  // Top sub-cap and overhanging moulded crown cornice reaching y = 1.600
  const topBoardGeo = createRoundedBoard(THREE, 0.782, 0.022, 0.292, 0.0035, 'x');
  const topBoard = new THREE.Mesh(topBoardGeo, mats.wood);
  topBoard.position.set(0, 1.566, 0.0);
  frame.add(topBoard);

  const crownGeo = createRoundedBoard(THREE, 0.80, 0.022, 0.30, 0.0055, 'x');
  const crown = new THREE.Mesh(crownGeo, mats.wood);
  crown.position.set(0, 1.589, 0.0);
  frame.add(crown);

  // Decorative curved cornice trim strip under front overhang
  const trimGeo = createRoundedBoard(THREE, 0.752, 0.014, 0.014, 0.003, 'x');
  const trim = new THREE.Mesh(trimGeo, mats.wood);
  trim.position.set(0, 1.548, 0.141);
  frame.add(trim);

  return { group: frame, shelfSpecs };
}

function buildMetalWoodBookcase(THREE, mats) {
  const frame = new THREE.Group();
  frame.name = 'bookcaseFrame';

  // 4 sleek levelling foot pads on y = 0
  const footPts = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.016, 0.0),
    new THREE.Vector2(0.017, 0.005),
    new THREE.Vector2(0.011, 0.009),
    new THREE.Vector2(0.007, 0.018),
    new THREE.Vector2(0.0001, 0.018),
  ];
  const footGeo = new THREE.LatheGeometry(footPts, 16);
  const postCoords = [
    [-0.388, -0.138],
    [0.388, -0.138],
    [-0.388, 0.138],
    [0.388, 0.138],
  ];
  const postGeo = createRoundedBoard(THREE, 0.022, 1.568, 0.022, 0.004, 'y');

  for (const [px, pz] of postCoords) {
    const foot = new THREE.Mesh(footGeo, mats.metal);
    foot.position.set(px, 0, pz);
    frame.add(foot);

    const post = new THREE.Mesh(postGeo, mats.metal);
    post.position.set(px, 0.016 + 1.568 * 0.5, pz);
    frame.add(post);
  }

  // Top curved metal arch caps connecting front & back posts at y = 1.584..1.600
  for (const sx of [-0.388, 0.388]) {
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 1.58, -0.138),
      new THREE.Vector3(sx, 1.592, -0.08),
      new THREE.Vector3(sx, 1.592, 0.08),
      new THREE.Vector3(sx, 1.58, 0.138),
    ]);
    const archMesh = new THREE.Mesh(
      buildTaperedTube(THREE, archCurve, () => 0.0095, 16, 10, true),
      mats.metal
    );
    frame.add(archMesh);
  }

  // Top rear tie bar
  const topBackBar = new THREE.Mesh(
    createRoundedBoard(THREE, 0.776, 0.016, 0.016, 0.003, 'x'),
    mats.metal
  );
  topBackBar.position.set(0, 1.586, -0.138);
  frame.add(topBackBar);

  // Back X-braces (two elegant bays)
  const addXBrace = (yBot, yTop) => {
    const pairs = [
      [new THREE.Vector3(-0.378, yBot, -0.138), new THREE.Vector3(0.378, yTop, -0.138)],
      [new THREE.Vector3(0.378, yBot, -0.138), new THREE.Vector3(-0.378, yTop, -0.138)],
    ];
    for (const [a, b] of pairs) {
      const mid = a.clone().lerp(b, 0.5);
      const curve = new THREE.CatmullRomCurve3([a, mid, b]);
      const rod = new THREE.Mesh(
        buildTaperedTube(THREE, curve, () => 0.0045, 12, 8, true),
        mats.metal
      );
      frame.add(rod);
    }
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14), mats.brass);
    bolt.rotation.x = Math.PI * 0.5;
    bolt.position.set(0, (yBot + yTop) * 0.5, -0.138);
    frame.add(bolt);
  };
  addXBrace(0.11, 0.70);
  addXBrace(0.70, 1.30);

  // 5 thick warm wooden shelves with steel under-supports, side guard rods & brass rivets
  const shelfYTops = [0.105, 0.405, 0.705, 1.005, 1.305];
  const shelfThick = 0.024;
  const shelfGeo = createRoundedBoard(THREE, 0.752, shelfThick, 0.264, 0.004, 'x');
  const sideBarGeo = createRoundedBoard(THREE, 0.014, 0.014, 0.276, 0.003, 'z');
  const guardRodGeo = createRoundedBoard(THREE, 0.007, 0.007, 0.274, 0.002, 'z');
  const frontSupportGeo = createRoundedBoard(THREE, 0.756, 0.012, 0.014, 0.0025, 'x');
  const rivetGeo = new THREE.SphereGeometry(0.0042, 10, 8);

  const shelfSpecs = [];
  for (let i = 0; i < shelfYTops.length; i++) {
    const yTop = shelfYTops[i];
    const shelf = new THREE.Mesh(shelfGeo, mats.wood);
    shelf.position.set(0, yTop - shelfThick * 0.5, 0.0);
    frame.add(shelf);

    // Under-shelf metal frame rails
    for (const sz of [-0.118, 0.118]) {
      const rail = new THREE.Mesh(frontSupportGeo, mats.metal);
      rail.position.set(0, yTop - shelfThick - 0.006, sz);
      frame.add(rail);
    }
    for (const sx of [-0.388, 0.388]) {
      const sb = new THREE.Mesh(sideBarGeo, mats.metal);
      sb.position.set(sx, yTop - shelfThick - 0.004, 0.0);
      frame.add(sb);

      // Slim side book-retainer bar
      const guard = new THREE.Mesh(guardRodGeo, mats.metal);
      guard.position.set(sx, yTop + 0.072, 0.0);
      frame.add(guard);

      // Brass corner rivets
      for (const sz of [-0.138, 0.138]) {
        const rivet = new THREE.Mesh(rivetGeo, mats.brass);
        rivet.position.set(sx + Math.sign(sx) * 0.011, yTop - shelfThick - 0.004, sz);
        frame.add(rivet);
      }
    }

    shelfSpecs.push({
      y: yTop,
      width: 0.728,
      depth: 0.244,
      zCenter: 0.0,
      headroom: i < 4 ? 0.272 : 0.28,
    });
  }

  // Back guard bar above top shelf
  const topGuard = new THREE.Mesh(
    createRoundedBoard(THREE, 0.776, 0.009, 0.009, 0.002, 'x'),
    mats.metal
  );
  topGuard.position.set(0, 1.377, -0.138);
  frame.add(topGuard);

  return { group: frame, shelfSpecs };
}

function buildLadderBookcase(THREE, mats) {
  const frame = new THREE.Group();
  frame.name = 'bookcaseFrame';

  // Leaning A-frame ladder profile:
  // Rear wall rails sit near z = -0.136; front angled rails lean from z = +0.136 (y=0) to z = +0.006 (y=1.59)
  const railXAt = (y) => {
    const t = Math.min(1, Math.max(0, y / 1.59));
    return 0.386 * (1 - t) + 0.356 * t;
  };
  const frontZAt = (y) => {
    const t = Math.min(1, Math.max(0, y / 1.59));
    return 0.136 * (1 - t) + 0.006 * t;
  };
  const backZ = -0.136;

  // Build left and right continuous sculpted wooden side A-frames (curved top cap joining front rail to wall rail)
  for (const side of [-1, 1]) {
    const sideCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * railXAt(0.01), 0.01, frontZAt(0.01)),
      new THREE.Vector3(side * railXAt(0.55), 0.55, frontZAt(0.55)),
      new THREE.Vector3(side * railXAt(1.15), 1.15, frontZAt(1.15)),
      new THREE.Vector3(side * railXAt(1.54), 1.54, frontZAt(1.54)),
      new THREE.Vector3(side * railXAt(1.585), 1.588, -0.055),
      new THREE.Vector3(side * railXAt(1.575), 1.578, backZ),
    ]);
    const frontRail = new THREE.Mesh(
      buildTaperedTube(THREE, sideCurve, (t) => 0.0145 - t * 0.002, 34, 10, true, [0.85, 1.18]),
      mats.wood
    );
    frame.add(frontRail);

    // Rear wall-side vertical-tapered leg
    const rearCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * railXAt(0.01), 0.01, backZ),
      new THREE.Vector3(side * railXAt(0.8), 0.8, backZ),
      new THREE.Vector3(side * railXAt(1.57), 1.57, backZ),
    ]);
    const rearLeg = new THREE.Mesh(
      buildTaperedTube(THREE, rearCurve, () => 0.0125, 18, 10, true, [0.9, 1.1]),
      mats.wood
    );
    frame.add(rearLeg);

    // Subtle rubber floor & wall bumper pads
    const padGeo = new THREE.CylinderGeometry(0.014, 0.015, 0.012, 12);
    const fPad = new THREE.Mesh(padGeo, mats.metal);
    fPad.position.set(side * railXAt(0), 0.006, frontZAt(0));
    frame.add(fPad);
    const bPad = new THREE.Mesh(padGeo, mats.metal);
    bPad.position.set(side * railXAt(0), 0.006, backZ);
    frame.add(bPad);
    const wallPad = new THREE.Mesh(padGeo, mats.metal);
    wallPad.rotation.x = Math.PI * 0.5;
    wallPad.position.set(side * railXAt(1.56), 1.56, -0.144);
    frame.add(wallPad);
  }

  // 5 graduated tray shelves with cosy raised backstop & side lips + side dowel rungs
  const shelfYTops = [0.135, 0.435, 0.735, 1.035, 1.335];
  const shelfThick = 0.02;
  const shelfSpecs = [];

  for (let i = 0; i < shelfYTops.length; i++) {
    const yTop = shelfYTops[i];
    const rx = railXAt(yTop);
    const zF = frontZAt(yTop);
    const innerW = rx * 2 - 0.022;
    const trayDepth = (zF - 0.004) - (backZ + 0.004);
    const zMid = (zF - 0.004 + backZ + 0.004) * 0.5;

    // Shelf board
    const board = new THREE.Mesh(
      createRoundedBoard(THREE, innerW, shelfThick, trayDepth, 0.0035, 'x'),
      mats.wood
    );
    board.position.set(0, yTop - shelfThick * 0.5, zMid);
    frame.add(board);

    // Cozy raised backstop lip
    const backLip = new THREE.Mesh(
      createRoundedBoard(THREE, innerW, 0.036, 0.012, 0.0025, 'x'),
      mats.wood
    );
    backLip.position.set(0, yTop + 0.014, backZ + 0.01);
    frame.add(backLip);

    // Side cross-brace dowel & peg bolts
    for (const side of [-1, 1]) {
      const sideLip = new THREE.Mesh(
        createRoundedBoard(THREE, 0.012, 0.024, trayDepth - 0.012, 0.0025, 'z'),
        mats.wood
      );
      sideLip.position.set(side * (rx - 0.012), yTop + 0.006, zMid);
      frame.add(sideLip);

      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 10), mats.brass);
      peg.rotation.z = Math.PI * 0.5;
      peg.position.set(side * (rx + 0.01), yTop - shelfThick * 0.5, zF - 0.005);
      frame.add(peg);
    }

    shelfSpecs.push({
      y: yTop,
      width: innerW - 0.036,
      depth: trayDepth - 0.026,
      zCenter: zMid + 0.006,
      headroom: i < 4 ? 0.272 : 0.255,
    });
  }

  return { group: frame, shelfSpecs };
}

// -------------------- Hero Dorm Props --------------------

function createBookCoverGeo(THREE, t, h, d, hasBands = false) {
  // Draw U-shaped wrap-around book cover in XY plane (X = thickness, Y = depth, rounded spine at +Y),
  // extrude by h along +Z, then rotate so extrusion is along +Y (height) and rounded spine faces +Z!
  const coverThick = Math.min(0.0032, t * 0.14);
  const ht = t * 0.5;
  const hd = d * 0.5;
  const spineBulge = Math.min(0.0045, t * 0.22);

  const shape = new THREE.Shape();
  // Outer loop counter-clockwise
  shape.moveTo(-ht, -hd);
  shape.lineTo(-ht + coverThick, -hd);
  shape.lineTo(-ht + coverThick, hd - spineBulge);
  shape.quadraticCurveTo(0, hd - coverThick * 0.4, ht - coverThick, hd - spineBulge);
  shape.lineTo(ht - coverThick, -hd);
  shape.lineTo(ht, -hd);
  shape.lineTo(ht, hd - spineBulge * 0.6);
  shape.quadraticCurveTo(0, hd + spineBulge, -ht, hd - spineBulge * 0.6);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0008,
    bevelSegments: 1,
    curveSegments: 6,
  });
  // Rotate so X stays X (thickness), Z (+h) becomes +Y (height), Y (+hd spine) becomes +Z (front)
  geo.rotateX(-Math.PI * 0.5);
  //Wait: rotateX(-pi/2) maps (x, y, z) -> (x, z, -y), so spine (+Y) went to -Z!
  // Let's rotateY(Math.PI) so spine faces +Z!
  geo.rotateY(Math.PI);

  // Clean UVs so the spine (+Z) maps horizontally across texture width [0..1] and height [0..1]
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const v = Math.min(1, Math.max(0, y / Math.max(0.001, h)));
    let u;
    if (z > hd * 0.55) {
      u = (x / Math.max(0.001, t)) + 0.5;
    } else {
      u = (z / Math.max(0.001, d)) + 0.5;
    }
    uv.setXY(i, Math.min(1, Math.max(0, u)), v);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return { geo, hasBands };
}

function buildBook(THREE, w, h, d, coverMat, pagesMat, bandMat, hasBands = false) {
  const g = new THREE.Group();
  const { geo: coverGeo } = createBookCoverGeo(THREE, w, h, d, hasBands);
  const coverMesh = new THREE.Mesh(coverGeo, coverMat);
  g.add(coverMesh);

  // Recessed page block with gently indented fore-edge
  const pw = Math.max(0.004, w - 0.0052);
  const ph = Math.max(0.02, h - 0.0065);
  const pd = Math.max(0.02, d - 0.0055);
  const pageGeo = createRoundedBoard(THREE, pw, ph, pd, 0.001, 'y');
  const pages = new THREE.Mesh(pageGeo, pagesMat);
  pages.position.set(0, h * 0.5, -0.001);
  g.add(pages);

  // Optional sculpted raised spine bands for classic hardcovers
  if (hasBands && bandMat) {
    const bandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-w * 0.48, 0, d * 0.49),
      new THREE.Vector3(0, 0, d * 0.5 + Math.min(0.0052, w * 0.24)),
      new THREE.Vector3(w * 0.48, 0, d * 0.49),
    ]);
    const bandGeo = buildTaperedTube(THREE, bandCurve, () => 0.0015, 8, 6, true);
    for (const frac of [0.18, 0.5, 0.82]) {
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = h * frac;
      g.add(band);
    }
  }
  return g;
}

function placeBookRow(THREE, parent, shelf, startX, count, bookMats, pagesMat, brassMat, rng, optsRow = {}) {
  const {
    leanEnd = true,
    leanDir = 1, // +1 leans left onto right end of row; -1 leans right onto left end
    minH = 0.165,
    maxH = 0.235,
    pullForwardIdx = -1,
    maxX = shelf.width * 0.5 - 0.012,
  } = optsRow;

  let cursorX = startX;
  let lastBookH = 0.2;
  let lastRightEdge = startX;

  for (let i = 0; i < count; i++) {
    const t = 0.02 + rng() * 0.022;
    const h = Math.min(shelf.headroom - 0.015, minH + rng() * (maxH - minH));
    const d = Math.min(shelf.depth - 0.014, 0.125 + rng() * 0.042);

    const isLeaning = leanEnd && i === count - 1 && i > 0;
    const matIdx = Math.floor(rng() * bookMats.length);
    const hasBands = rng() > 0.62;
    const book = buildBook(THREE, t, h, d, bookMats[matIdx], pagesMat, brassMat, hasBands);

    const zFrontJitter = (rng() - 0.5) * 0.018 + (i === pullForwardIdx ? 0.022 : 0);
    const zBase = shelf.zCenter + (shelf.depth * 0.5 - d * 0.5) - 0.014 + zFrontJitter;

    if (isLeaning && leanDir === 1) {
      const alpha = 0.26 + rng() * 0.12; // ~15-22 deg leaning toward -X
      const contactS = Math.min(h, lastBookH / Math.cos(alpha));
      const posX = lastRightEdge + (t * 0.5) * Math.cos(alpha) + contactS * Math.sin(alpha) + 0.001;
      const rightFootX = posX + (t * 0.5) * Math.cos(alpha);
      if (rightFootX <= maxX) {
        book.rotation.z = alpha;
        book.position.set(posX, shelf.y + (t * 0.5) * Math.sin(alpha), zBase);
        parent.add(book);
        cursorX = rightFootX + 0.004;
      }
      break;
    } else {
      if (cursorX + t > maxX) break;
      book.position.set(cursorX + t * 0.5, shelf.y, zBase);
      parent.add(book);
      lastRightEdge = cursorX + t;
      lastBookH = h;
      cursorX += t + 0.0015 + rng() * 0.002;
    }
  }
  return cursorX;
}

function buildFlatBookStack(THREE, shelf, centerX, count, bookMats, pagesMat, brassMat, rng, addBookmark = false, accentMat = null) {
  const stack = new THREE.Group();
  let curY = shelf.y;
  let topBookW = 0.16;
  let topBookD = 0.12;

  for (let i = 0; i < count; i++) {
    const thickness = 0.02 + rng() * 0.014;
    const length = 0.195 - i * 0.014 + (rng() - 0.5) * 0.012;
    const width = Math.min(shelf.depth - 0.02, 0.145 - i * 0.008 + (rng() - 0.5) * 0.008);
    const mat = bookMats[(i * 2 + Math.floor(rng() * bookMats.length)) % bookMats.length];
    const book = buildBook(THREE, thickness, length, width, mat, pagesMat, brassMat, i === 0);

    // Lay flat: rotate -90 deg around Z so book thickness becomes vertical Y!
    // In local coords: x in [-thickness/2, +thickness/2], y in [0, length]
    // After rotateZ(-PI/2): local x -> -Y, local y -> +X; so center horizontally by shifting -length/2 in X,
    // and lift by +thickness/2 in Y so bottom cover rests cleanly at curY!
    const holder = new THREE.Group();
    book.rotation.z = -Math.PI * 0.5;
    book.position.set(-length * 0.5, thickness * 0.5, 0);
    holder.add(book);
    holder.rotation.y = (rng() - 0.5) * 0.22;
    holder.position.set(centerX + (rng() - 0.5) * 0.008, curY, shelf.zCenter + 0.004);
    stack.add(holder);

    curY += thickness + 0.0005;
    topBookW = length;
    topBookD = width;

    if (addBookmark && i === count - 2 && accentMat) {
      // Soft curved ribbon bookmark peeking out the front
      const ribShape = new THREE.Shape();
      ribShape.moveTo(-0.007, 0);
      ribShape.lineTo(0.007, 0);
      ribShape.lineTo(0.007, 0.055);
      ribShape.lineTo(0.0, 0.045);
      ribShape.lineTo(-0.007, 0.055);
      ribShape.closePath();
      const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
        depth: 0.0014,
        bevelEnabled: false,
      });
      // Bend the ribbon gracefully downward as it emerges
      const pos = ribGeo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k);
        const t = y / 0.055;
        const nz = y * 0.85;
        const ny = -Math.pow(t, 1.9) * 0.028;
        pos.setXYZ(k, pos.getX(k), ny, nz);
      }
      ribGeo.computeVertexNormals();
      const ribbon = new THREE.Mesh(ribGeo, accentMat);
      ribbon.position.set(centerX + 0.02, curY - 0.002, shelf.zCenter + width * 0.42);
      ribbon.rotation.y = 0.25;
      stack.add(ribbon);
    }
  }
  return { group: stack, topY: curY, topW: topBookW, topD: topBookD };
}

function buildStorageBox(THREE, kit, mats) {
  const box = new THREE.Group();
  box.name = 'storageBox';

  const w = 0.255;
  const h = 0.195;
  const d = 0.195;

  // Sculpted continuous tapered soft-woven basket walls (ring-by-ring loft so walls bulge gently & taper softly)
  const segU = 36;
  const segV = 12;
  const positions = [];
  const uvs = [];
  const indices = [];

  const superRect = (theta, hw, hd, n = 4.6) => {
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const sx = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n) * hw;
    const sz = Math.sign(st) * Math.pow(Math.abs(st), 2 / n) * hd;
    return [sx, sz];
  };

  // Profile goes: bottom center -> outer base -> outer wall up -> rolled rim -> inner wall down -> inner floor
  const profile = [];
  for (let i = 0; i <= segV; i++) {
    const t = i / segV;
    const flare = 0.94 + t * 0.06;
    const softBulge = 1 + Math.sin(t * Math.PI) * 0.025;
    profile.push({ y: t * (h - 0.008), scale: flare * softBulge, v: t });
  }
  // Rolled soft rim
  profile.push({ y: h, scale: 1.008, v: 1.04 });
  profile.push({ y: h, scale: 0.96, v: 1.08 });
  profile.push({ y: h - 0.012, scale: 0.93, v: 1.12 });
  profile.push({ y: 0.014, scale: 0.88, v: 1.9 });

  const stride = segU + 1;
  for (let p = 0; p < profile.length; p++) {
    const { y, scale, v } = profile[p];
    for (let u = 0; u <= segU; u++) {
      const frac = u / segU;
      const theta = frac * Math.PI * 2;
      const [sx, sz] = superRect(theta, (w * 0.5) * scale, (d * 0.5) * scale, 5.2);
      positions.push(sx, y, sz);
      uvs.push(frac * 3, v);
    }
  }
  for (let p = 0; p < profile.length - 1; p++) {
    for (let u = 0; u < segU; u++) {
      const a = p * stride + u;
      const b = (p + 1) * stride + u;
      const c = p * stride + u + 1;
      const dIdx = (p + 1) * stride + u + 1;
      indices.push(a, b, c);
      indices.push(c, b, dIdx);
    }
  }
  // Bottom cap
  const botCenter = positions.length / 3;
  positions.push(0, 0, 0);
  uvs.push(0.5, 0);
  for (let u = 0; u < segU; u++) {
    indices.push(botCenter, u, u + 1);
  }
  // Inner floor cap
  const inCenter = positions.length / 3;
  const lastRing = (profile.length - 1) * stride;
  positions.push(0, 0.014, 0);
  uvs.push(0.5, 0.5);
  for (let u = 0; u < segU; u++) {
    indices.push(inCenter, lastRing + u + 1, lastRing + u);
  }

  const basketGeo = new THREE.BufferGeometry();
  basketGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  basketGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  basketGeo.setIndex(indices);
  basketGeo.computeVertexNormals();

  const basketMesh = new THREE.Mesh(basketGeo, mats.fabric);
  basketMesh.userData.slot = 'secondary';
  box.add(basketMesh);

  // Curved stitched leather pull-handle on front (+Z)
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.044, h * 0.56, d * 0.49),
    new THREE.Vector3(-0.036, h * 0.56, d * 0.55),
    new THREE.Vector3(0.0, h * 0.555, d * 0.57),
    new THREE.Vector3(0.036, h * 0.56, d * 0.55),
    new THREE.Vector3(0.044, h * 0.56, d * 0.49),
  ]);
  const strapMesh = new THREE.Mesh(
    buildTaperedTube(THREE, strapCurve, () => 0.0085, 18, 8, true, [0.35, 1.35]),
    mats.leather
  );
  box.add(strapMesh);

  // Brass rivets anchoring the leather handle
  const rivetGeo = new THREE.SphereGeometry(0.0052, 10, 8);
  for (const rx of [-0.042, 0.042]) {
    const rivet = new THREE.Mesh(rivetGeo, mats.brass);
    rivet.scale.set(1, 1, 0.65);
    rivet.position.set(rx, h * 0.56, d * 0.512);
    box.add(rivet);
  }

  // Brass label frame + paper card on upper front
  const labelFrame = new THREE.Mesh(
    createRoundedBoard(THREE, 0.072, 0.034, 0.005, 0.0012, 'x'),
    mats.brass
  );
  labelFrame.position.set(0, h * 0.81, d * 0.506);
  box.add(labelFrame);

  const labelTex = createLabelCardTexture(THREE, kit);
  const labelMat = new THREE.MeshPhysicalMaterial({
    map: labelTex,
    roughness: 0.85,
    metalness: 0.0,
  });
  const labelCard = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.025), labelMat);
  labelCard.position.set(0, h * 0.81, d * 0.5095);
  box.add(labelCard);

  return box;
}

function buildFramedArt(THREE, kit, mats, primary, secondary, accent) {
  const root = new THREE.Group();
  root.name = 'framedPhoto';

  const fw = 0.146;
  const fh = 0.186;
  const fd = 0.015;
  const tilt = 0.16; // ~9.2 deg backward lean

  const tilted = new THREE.Group();
  tilted.rotation.x = -tilt;
  root.add(tilted);

  // Sculpted hollow picture frame via ExtrudeGeometry with bevel
  const outer = roundedRectShape(THREE, fw, fh, 0.005);
  const innerHole = new THREE.Path();
  const hw = fw * 0.5 - 0.013;
  const hh = fh * 0.5 - 0.013;
  innerHole.moveTo(-hw, -hh);
  innerHole.lineTo(-hw, hh);
  innerHole.lineTo(hw, hh);
  innerHole.lineTo(hw, -hh);
  innerHole.closePath();
  outer.holes.push(innerHole);

  const frameGeo = new THREE.ExtrudeGeometry(outer, {
    depth: fd - 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 4,
  });
  frameGeo.translate(0, fh * 0.5, -(fd - 0.004) * 0.5);
  applyBoxWoodUVs(frameGeo, 'x', 2.4);
  const frameMesh = new THREE.Mesh(frameGeo, mats.frameWood);
  tilted.add(frameMesh);

  // Thin inner brass fillet accent
  const filletOuter = roundedRectShape(THREE, fw - 0.024, fh - 0.024, 0.002);
  const filletHole = new THREE.Path();
  const fhw = fw * 0.5 - 0.016;
  const fhh = fh * 0.5 - 0.016;
  filletHole.moveTo(-fhw, -fhh);
  filletHole.lineTo(-fhw, fhh);
  filletHole.lineTo(fhw, fhh);
  filletHole.lineTo(fhw, -fhh);
  filletHole.closePath();
  filletOuter.holes.push(filletHole);
  const filletGeo = new THREE.ExtrudeGeometry(filletOuter, {
    depth: 0.003,
    bevelEnabled: false,
  });
  filletGeo.translate(0, fh * 0.5, 0.0025);
  tilted.add(new THREE.Mesh(filletGeo, mats.brass));

  // Cream mat board backing
  const matBoard = new THREE.Mesh(
    createRoundedBoard(THREE, fw - 0.022, fh - 0.022, 0.004, 0.0005, 'x'),
    mats.creamPaper
  );
  matBoard.position.set(0, fh * 0.5, -0.001);
  tilted.add(matBoard);

  // Abstract artwork canvas
  const artTex = createAbstractArtTexture(THREE, kit, primary, secondary, accent);
  const artMat = new THREE.MeshPhysicalMaterial({
    map: artTex,
    roughness: 0.78,
    metalness: 0.0,
    sheen: 0.15,
  });
  const artPlane = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.044, fh - 0.044), artMat);
  artPlane.position.set(0, fh * 0.5, 0.0015);
  tilted.add(artPlane);

  // Subtle clearcoat glass pane
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.16,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.025, fh - 0.025), glassMat);
  glass.position.set(0, fh * 0.5, 0.0042);
  glass.castShadow = false;
  tilted.add(glass);

  // Dark backing panel
  const backPanel = new THREE.Mesh(
    createRoundedBoard(THREE, fw - 0.018, fh - 0.018, 0.005, 0.001, 'x'),
    mats.metal
  );
  backPanel.position.set(0, fh * 0.5, -0.006);
  tilted.add(backPanel);

  // Hinged easel leg touching y = 0 cleanly behind the tilted frame
  const hingeY = fh * 0.62;
  const worldHingeY = hingeY * Math.cos(tilt);
  const worldHingeZ = -hingeY * Math.sin(tilt) - 0.008;
  const footZ = worldHingeZ - 0.052;
  const dy = worldHingeY;
  const dz = worldHingeZ - footZ;
  const legLen = Math.hypot(dy, dz);
  const legMesh = new THREE.Mesh(
    createRoundedBoard(THREE, 0.032, legLen, 0.005, 0.001, 'y'),
    mats.metal
  );
  legMesh.position.set(0, dy * 0.5, (worldHingeZ + footZ) * 0.5);
  legMesh.rotation.x = Math.atan2(dz, dy);
  root.add(legMesh);

  return root;
}

function createCurvedLeafGeo(THREE, len, width) {
  // Heart-shaped pothos leaf drawn with bezierCurveTo, bevel-extruded, then organically cupped & arched
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-width * 0.48, -len * 0.12, -width * 0.62, len * 0.36, -width * 0.28, len * 0.72);
  shape.bezierCurveTo(-width * 0.12, len * 0.88, -width * 0.03, len * 0.96, 0, len);
  shape.bezierCurveTo(width * 0.03, len * 0.96, width * 0.12, len * 0.88, width * 0.28, len * 0.72);
  shape.bezierCurveTo(width * 0.62, len * 0.36, width * 0.48, -len * 0.12, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0014,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0006,
    bevelSegments: 1,
    curveSegments: 8,
  });

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ty = Math.min(1, Math.max(0, y / Math.max(0.001, len)));
    const tx = x / Math.max(0.001, width * 0.5);

    // Graceful arch along length + V-cup across width + subtle organic wave
    const archZ = Math.sin(ty * Math.PI * 0.85) * len * 0.22 - Math.pow(ty, 2.2) * len * 0.28;
    const cupZ = Math.abs(tx) * width * 0.12 * (1 - ty * 0.4);
    const twistZ = tx * Math.sin(ty * Math.PI) * width * 0.05;

    pos.setXYZ(i, x, y, z + archZ + cupZ + twistZ);
    uv.setXY(i, (x / Math.max(0.001, width)) + 0.5, ty);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildPottedPlant(THREE, kit, mats, rng) {
  const root = new THREE.Group();
  root.name = 'pottedPlant';

  // Terracotta saucer (LatheGeometry, 16+ pts)
  const saucerPts = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.044, 0.0),
    new THREE.Vector2(0.049, 0.002),
    new THREE.Vector2(0.054, 0.007),
    new THREE.Vector2(0.057, 0.014),
    new THREE.Vector2(0.056, 0.017),
    new THREE.Vector2(0.053, 0.017),
    new THREE.Vector2(0.050, 0.011),
    new THREE.Vector2(0.045, 0.006),
    new THREE.Vector2(0.0001, 0.0055),
  ];
  const saucer = new THREE.Mesh(new THREE.LatheGeometry(saucerPts, 24), mats.terracotta);
  saucer.userData.slot = 'accent';
  root.add(saucer);

  // Sculpted terracotta pot (LatheGeometry, 20+ pts)
  const potPts = [
    new THREE.Vector2(0.0001, 0.0055),
    new THREE.Vector2(0.036, 0.0055),
    new THREE.Vector2(0.038, 0.009),
    new THREE.Vector2(0.042, 0.025),
    new THREE.Vector2(0.047, 0.048),
    new THREE.Vector2(0.051, 0.072),
    new THREE.Vector2(0.053, 0.082),
    new THREE.Vector2(0.0565, 0.085),
    new THREE.Vector2(0.0575, 0.094),
    new THREE.Vector2(0.0555, 0.098),
    new THREE.Vector2(0.051, 0.098),
    new THREE.Vector2(0.048, 0.093),
    new THREE.Vector2(0.046, 0.078),
    new THREE.Vector2(0.041, 0.052),
    new THREE.Vector2(0.0001, 0.052),
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts, 28), mats.terracotta);
  pot.userData.slot = 'accent';
  root.add(pot);

  // Organic displaced soil mound
  const noise = makeNoiseFn(kit);
  const soilGeo = new THREE.SphereGeometry(0.047, 24, 14);
  const sPos = soilGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i);
    const y = sPos.getY(i);
    const z = sPos.getZ(i);
    const n = (noise(x * 48 + 2.1, z * 48 + 3.7) - 0.5) * 0.008;
    const ny = y > 0 ? y * 0.32 + n : y * 0.18;
    sPos.setXYZ(i, x, ny, z);
  }
  soilGeo.computeVertexNormals();
  const soil = new THREE.Mesh(soilGeo, mats.soil);
  soil.position.y = 0.082;
  root.add(soil);

  // Foliage group for gentle idle breeze animation
  const foliage = new THREE.Group();
  foliage.name = 'plantFoliage';
  foliage.position.y = 0.084;
  root.add(foliage);

  const leafGeoSmall = createCurvedLeafGeo(THREE, 0.046, 0.036);
  const leafGeoMed = createCurvedLeafGeo(THREE, 0.058, 0.046);
  const leafGeoLarge = createCurvedLeafGeo(THREE, 0.066, 0.052);
  const leafGeos = [leafGeoSmall, leafGeoMed, leafGeoLarge];

  // Upright arching stems (8 stems radiating warmly)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const h = 0.075 + rng() * 0.065;
    const spread = 0.045 + rng() * 0.042;
    const rBase = 0.008 + rng() * 0.016;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * rBase, -0.004, Math.sin(ang) * rBase),
      new THREE.Vector3(Math.cos(ang) * (rBase + spread * 0.35), h * 0.62, Math.sin(ang) * (rBase + spread * 0.35)),
      new THREE.Vector3(Math.cos(ang) * spread, h, Math.sin(ang) * spread),
      new THREE.Vector3(Math.cos(ang) * (spread + 0.016), h * 0.9, Math.sin(ang) * (spread + 0.016)),
    ]);
    const stem = new THREE.Mesh(
      buildTaperedTube(THREE, curve, (t) => 0.0028 * (1 - t * 0.55), 14, 6, true),
      mats.stem
    );
    foliage.add(stem);

    const tip = curve.getPoint(1);
    const leaf = new THREE.Mesh(leafGeos[i % leafGeos.length], mats.leaf);
    leaf.position.copy(tip);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = Math.atan2(Math.cos(ang), Math.sin(ang));
    // Face outward along radial direction
    leaf.rotation.y = Math.atan2(tip.x, tip.z);
    leaf.rotation.x = 0.72 + rng() * 0.42;
    leaf.rotation.z = (rng() - 0.5) * 0.35;
    foliage.add(leaf);
  }

  // 3 graceful trailing vines draping over the front/sides of the pot
  const vines = [];
  const vineConfigs = [
    { ang: 0.35, drop: 0.095, out: 0.088 },
    { ang: -0.25, drop: 0.12, out: 0.096 },
    { ang: 0.95, drop: 0.072, out: 0.078 },
  ];
  for (let vIdx = 0; vIdx < vineConfigs.length; vIdx++) {
    const { ang, drop, out } = vineConfigs[vIdx];
    const vineGroup = new THREE.Group();
    const dx = Math.sin(ang);
    const dz = Math.cos(ang);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dx * 0.02, -0.004, dz * 0.02),
      new THREE.Vector3(dx * 0.048, 0.036, dz * 0.048),
      new THREE.Vector3(dx * 0.072, 0.014, dz * 0.072),
      new THREE.Vector3(dx * out, -drop * 0.52, dz * out),
      new THREE.Vector3(dx * (out + 0.012), -drop, dz * (out + 0.012)),
    ]);
    const vineMesh = new THREE.Mesh(
      buildTaperedTube(THREE, curve, (t) => 0.0024 * (1 - t * 0.5), 18, 6, true),
      mats.stem
    );
    vineGroup.add(vineMesh);

    const leafTs = [0.35, 0.62, 0.84, 1.0];
    for (let k = 0; k < leafTs.length; k++) {
      const pt = curve.getPoint(leafTs[k]);
      const leaf = new THREE.Mesh(leafGeos[k % 2], mats.leaf);
      leaf.position.copy(pt);
      leaf.rotation.order = 'YXZ';
      leaf.rotation.y = ang + (k % 2 === 0 ? 0.42 : -0.42);
      leaf.rotation.x = 1.25 + k * 0.18;
      leaf.rotation.z = (k % 2 === 0 ? 0.25 : -0.25);
      vineGroup.add(leaf);
    }
    foliage.add(vineGroup);
    vines.push(vineGroup);
  }

  return { group: root, foliage, vines };
}

function buildCeramicMug(THREE, kit, mats) {
  const root = new THREE.Group();
  root.name = 'ceramicMug';

  // Bevelled cork coaster resting on y = 0
  const coasterPts = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.048, 0.0),
    new THREE.Vector2(0.050, 0.0018),
    new THREE.Vector2(0.050, 0.0042),
    new THREE.Vector2(0.048, 0.0055),
    new THREE.Vector2(0.0001, 0.0055),
  ];
  const coaster = new THREE.Mesh(new THREE.LatheGeometry(coasterPts, 28), mats.cork);
  root.add(coaster);

  // Hand-thrown ceramic mug (LatheGeometry, 24 profile points)
  const mugPts = [
    new THREE.Vector2(0.0001, 0.0055),
    new THREE.Vector2(0.032, 0.0055),
    new THREE.Vector2(0.0345, 0.007),
    new THREE.Vector2(0.0355, 0.012),
    new THREE.Vector2(0.0395, 0.025),
    new THREE.Vector2(0.0425, 0.045),
    new THREE.Vector2(0.043, 0.066),
    new THREE.Vector2(0.0418, 0.084),
    new THREE.Vector2(0.0412, 0.095),
    new THREE.Vector2(0.0422, 0.100),
    new THREE.Vector2(0.0405, 0.1025),
    new THREE.Vector2(0.0378, 0.102),
    new THREE.Vector2(0.0365, 0.098),
    new THREE.Vector2(0.0368, 0.082),
    new THREE.Vector2(0.037, 0.055),
    new THREE.Vector2(0.034, 0.026),
    new THREE.Vector2(0.028, 0.015),
    new THREE.Vector2(0.0001, 0.014),
  ];
  const mugGeo = new THREE.LatheGeometry(mugPts, 32);
  const mugMesh = new THREE.Mesh(mugGeo, mats.ceramicMug);
  mugMesh.userData.slot = 'primary';
  root.add(mugMesh);

  // Sculpted tapered ceramic handle deeply overlapping mug body
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.036, 0.084, 0.0),
    new THREE.Vector3(0.056, 0.085, 0.0),
    new THREE.Vector3(0.068, 0.068, 0.0),
    new THREE.Vector3(0.064, 0.044, 0.0),
    new THREE.Vector3(0.050, 0.031, 0.0),
    new THREE.Vector3(0.034, 0.031, 0.0),
  ]);
  const handleGeo = buildTaperedTube(
    THREE,
    handleCurve,
    (t) => 0.0062 + Math.pow(Math.abs(t - 0.5) * 2, 2) * 0.0022,
    22,
    10,
    true,
    [0.72, 1.15]
  );
  const handleMesh = new THREE.Mesh(handleGeo, mats.ceramicGlazeSolid);
  handleMesh.userData.slot = 'primary';
  root.add(handleMesh);

  // Coffee meniscus surface inside mug
  const coffeePts = [
    new THREE.Vector2(0.0001, 0.082),
    new THREE.Vector2(0.022, 0.082),
    new THREE.Vector2(0.034, 0.0825),
    new THREE.Vector2(0.0372, 0.0842),
  ];
  const coffeeGeo = new THREE.LatheGeometry(coffeePts, 24);
  // Planarize top UVs for latte swirl
  const cPos = coffeeGeo.attributes.position;
  const cUv = coffeeGeo.attributes.uv;
  for (let i = 0; i < cPos.count; i++) {
    cUv.setXY(i, cPos.getX(i) / 0.076 + 0.5, cPos.getZ(i) / 0.076 + 0.5);
  }
  cUv.needsUpdate = true;
  const coffee = new THREE.Mesh(coffeeGeo, mats.coffee);
  root.add(coffee);

  // Delicate teabag string & hanging paper tag
  const stringCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.015, 0.081, 0.015),
    new THREE.Vector3(-0.028, 0.104, 0.028),
    new THREE.Vector3(-0.034, 0.095, 0.034),
    new THREE.Vector3(-0.036, 0.068, 0.036),
  ]);
  const stringMesh = new THREE.Mesh(
    buildTaperedTube(THREE, stringCurve, () => 0.0008, 16, 6, true),
    mats.creamPaper
  );
  root.add(stringMesh);

  const tagPivot = new THREE.Group();
  tagPivot.position.set(-0.036, 0.068, 0.036);
  const tagMesh = new THREE.Mesh(
    createRoundedBoard(THREE, 0.014, 0.018, 0.0014, 0.0003, 'x'),
    mats.accentPaper
  );
  tagMesh.position.y = -0.009;
  tagMesh.rotation.y = -Math.PI * 0.25;
  tagPivot.add(tagMesh);
  root.add(tagPivot);

  return { group: root, tagPivot };
}

function buildMiniBudVase(THREE, mats) {
  const root = new THREE.Group();
  root.name = 'budVase';

  // Sculpted stoneware bud vase (LatheGeometry, 18 points)
  const vasePts = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.022, 0.0),
    new THREE.Vector2(0.027, 0.012),
    new THREE.Vector2(0.034, 0.032),
    new THREE.Vector2(0.035, 0.052),
    new THREE.Vector2(0.028, 0.072),
    new THREE.Vector2(0.016, 0.088),
    new THREE.Vector2(0.013, 0.102),
    new THREE.Vector2(0.016, 0.112),
    new THREE.Vector2(0.015, 0.114),
    new THREE.Vector2(0.012, 0.113),
    new THREE.Vector2(0.010, 0.098),
    new THREE.Vector2(0.0001, 0.088),
  ];
  const vase = new THREE.Mesh(new THREE.LatheGeometry(vasePts, 24), mats.vaseCeramic);
  vase.userData.slot = 'secondary';
  root.add(vase);

  // Dried eucalyptus sprigs for cozy dorm charm
  const sprig = new THREE.Group();
  sprig.position.set(0, 0.095, 0);
  root.add(sprig);

  const roundLeafGeo = createCurvedLeafGeo(THREE, 0.024, 0.022);
  const stemConfigs = [
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.014, 0.052, 0.008), new THREE.Vector3(-0.028, 0.096, 0.018)],
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.016, 0.044, -0.006), new THREE.Vector3(0.034, 0.078, 0.008)],
  ];
  for (const pts of stemConfigs) {
    const c = new THREE.CatmullRomCurve3(pts);
    const stemMesh = new THREE.Mesh(
      buildTaperedTube(THREE, c, (t) => 0.0018 * (1 - t * 0.5), 12, 6, true),
      mats.stem
    );
    sprig.add(stemMesh);
    for (let k = 1; k <= 3; k++) {
      const p = c.getPoint(k * 0.28);
      for (const side of [-1, 1]) {
        const l = new THREE.Mesh(roundLeafGeo, mats.leaf);
        l.position.copy(p);
        l.rotation.order = 'YXZ';
        l.rotation.y = side * 1.1 + 0.3;
        l.rotation.x = 0.85;
        sprig.add(l);
      }
    }
  }
  return { group: root, sprig };
}

function buildArchBookend(THREE, mats) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.036, 0);
  shape.lineTo(0.036, 0);
  shape.lineTo(0.036, 0.078);
  shape.absarc(0, 0.078, 0.036, 0, Math.PI, false);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.0025,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.011);
  geo.rotateY(Math.PI * 0.5);
  const mesh = new THREE.Mesh(geo, mats.brass);
  return mesh;
}

// -------------------- Main Build & Idle Exports --------------------

export function build(THREE, opts = {}, kit = {}) {
  const primary = toColor(THREE, opts.primary, 0x4f756a);
  const secondary = toColor(THREE, opts.secondary, 0xd8c2a6);
  const accent = toColor(THREE, opts.accent, 0xd66b43);
  const woodCol = toColor(THREE, opts.wood, 0xa87043);
  const metalCol = toColor(THREE, opts.metal, 0x2f3238);
  const rawVariant = typeof opts.variant === 'number' ? opts.variant : 0;
  const variant = ((Math.round(rawVariant) % 3) + 3) % 3;

  const rng = makeRng(1337 + variant * 97);

  // Build shared procedural textures & MeshPhysicalMaterials
  const woodTex = createWoodTextures(THREE, kit, woodCol, false);
  const woodBackTex = createWoodTextures(THREE, kit, shiftColor(THREE, woodCol, 0, -0.04, -0.06), true);
  const fabricTex = createWovenFabricTextures(THREE, kit, secondary);
  const pagesTex = createPagesTexture(THREE, kit);
  const terraTex = createTerracottaTextures(THREE, kit, accent);
  const leafTex = createLeafTexture(THREE, kit, primary);
  const corkTex = createCorkTexture(THREE, kit);
  const soilTex = createSoilTexture(THREE, kit);
  const mugGlazeBase = shiftColor(THREE, secondary, 0, -0.14, 0.16);
  const mugTex = createMugTexture(THREE, kit, mugGlazeBase, accent);
  const coffeeTex = createCoffeeTexture(THREE, kit);

  const mats = {
    wood: new THREE.MeshPhysicalMaterial({
      map: woodTex.map,
      bumpMap: woodTex.bump,
      bumpScale: 0.0022,
      roughness: 0.52,
      metalness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.36,
    }),
    woodBack: new THREE.MeshPhysicalMaterial({
      map: woodBackTex.map,
      bumpMap: woodBackTex.bump,
      bumpScale: 0.0026,
      roughness: 0.62,
      metalness: 0.0,
      clearcoat: 0.08,
    }),
    frameWood: new THREE.MeshPhysicalMaterial({
      map: woodTex.map,
      color: shiftColor(THREE, woodCol, 0.01, 0.04, -0.08),
      roughness: 0.42,
      metalness: 0.04,
      clearcoat: 0.32,
      clearcoatRoughness: 0.28,
    }),
    metal: new THREE.MeshPhysicalMaterial({
      color: metalCol,
      roughness: 0.38,
      metalness: 0.82,
      clearcoat: 0.14,
      clearcoatRoughness: 0.4,
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: 0xc9a35b,
      roughness: 0.28,
      metalness: 0.88,
      clearcoat: 0.25,
    }),
    fabric: new THREE.MeshPhysicalMaterial({
      map: fabricTex.map,
      bumpMap: fabricTex.bump,
      bumpScale: 0.0032,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.72,
      sheenColor: shiftColor(THREE, secondary, 0, -0.08, 0.18),
    }),
    leather: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, woodCol, -0.02, 0.14, -0.18),
      roughness: 0.64,
      metalness: 0.0,
      clearcoat: 0.12,
      sheen: 0.3,
    }),
    pages: new THREE.MeshPhysicalMaterial({
      map: pagesTex,
      roughness: 0.9,
      metalness: 0.0,
    }),
    creamPaper: new THREE.MeshPhysicalMaterial({
      color: 0xf4ecdd,
      roughness: 0.88,
      metalness: 0.0,
    }),
    accentPaper: new THREE.MeshPhysicalMaterial({
      color: accent,
      roughness: 0.85,
      metalness: 0.0,
    }),
    terracotta: new THREE.MeshPhysicalMaterial({
      map: terraTex.map,
      bumpMap: terraTex.bump,
      bumpScale: 0.0022,
      roughness: 0.76,
      metalness: 0.0,
      sheen: 0.15,
    }),
    soil: new THREE.MeshPhysicalMaterial({
      map: soilTex,
      roughness: 0.96,
      metalness: 0.0,
    }),
    stem: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, new THREE.Color(0x3a6a3f), 0, -0.04, -0.06),
      roughness: 0.62,
      metalness: 0.0,
    }),
    leaf: new THREE.MeshPhysicalMaterial({
      map: leafTex,
      roughness: 0.42,
      metalness: 0.0,
      clearcoat: 0.24,
      clearcoatRoughness: 0.32,
      sheen: 0.25,
      sheenColor: new THREE.Color(0xaad29c),
    }),
    cork: new THREE.MeshPhysicalMaterial({
      map: corkTex,
      roughness: 0.88,
      metalness: 0.0,
    }),
    ceramicMug: new THREE.MeshPhysicalMaterial({
      map: mugTex,
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 0.82,
      clearcoatRoughness: 0.14,
    }),
    ceramicGlazeSolid: new THREE.MeshPhysicalMaterial({
      color: mugGlazeBase,
      roughness: 0.2,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
    }),
    coffee: new THREE.MeshPhysicalMaterial({
      map: coffeeTex,
      roughness: 0.07,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    }),
    vaseCeramic: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, primary, 0.02, -0.18, 0.22),
      roughness: 0.34,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
    }),
  };

  // Curated harmonious book palette built from opts + warm dorm tones
  const foilGold = new THREE.Color(0xe6c88a);
  const foilCream = new THREE.Color(0xf4ead8);
  const bookPalette = [
    { col: primary, foil: foilGold, slot: 'primary' },
    { col: accent, foil: foilCream, slot: 'accent' },
    { col: shiftColor(THREE, secondary, -0.02, 0.06, -0.14), foil: foilCream, slot: 'secondary' },
    { col: shiftColor(THREE, primary, 0.08, -0.1, -0.14), foil: foilGold, slot: 'primary' },
    { col: new THREE.Color(0x3a4a5e), foil: foilGold, slot: 'primary' },
    { col: new THREE.Color(0xc99648), foil: foilCream, slot: 'accent' },
    { col: new THREE.Color(0x8e4b48), foil: foilGold, slot: 'accent' },
    { col: new THREE.Color(0x5d6e52), foil: foilCream, slot: 'primary' },
  ];

  const bookMats = bookPalette.map((entry, idx) => {
    const tex = createBookCoverTexture(THREE, kit, entry.col, entry.foil, idx, false);
    const m = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.84,
      metalness: 0.0,
      sheen: 0.55,
      sheenColor: shiftColor(THREE, entry.col, 0, -0.1, 0.18),
    });
    m.userData = { slot: entry.slot };
    return m;
  });

  const displayBookMat = new THREE.MeshPhysicalMaterial({
    map: createBookCoverTexture(THREE, kit, accent, foilCream, 0, true),
    roughness: 0.78,
    sheen: 0.5,
  });

  // Root bookcase group
  const root = new THREE.Group();
  root.name = 'body';

  // Build selected furniture variant
  let structure;
  if (variant === 1) {
    structure = buildMetalWoodBookcase(THREE, mats);
  } else if (variant === 2) {
    structure = buildLadderBookcase(THREE, mats);
  } else {
    structure = buildWoodenBookcase(THREE, mats);
  }
  root.add(structure.group);
  const shelves = structure.shelfSpecs;

  const propsGroup = new THREE.Group();
  propsGroup.name = 'shelfProps';
  root.add(propsGroup);

  // -------------------- Shelf 0 (Bottom): Storage Box + Tall Textbooks --------------------
  {
    const s = shelves[0];
    const storageBox = buildStorageBox(THREE, kit, mats);
    storageBox.position.set(-s.width * 0.5 + 0.145, s.y, s.zCenter + 0.008);
    storageBox.rotation.y = 0.03;
    propsGroup.add(storageBox);

    // Tall art books & textbooks on right side of bottom shelf
    placeBookRow(THREE, propsGroup, s, -s.width * 0.5 + 0.305, 8, bookMats, mats.pages, mats.brass, rng, {
      leanEnd: true,
      minH: 0.2,
      maxH: 0.245,
      pullForwardIdx: 2,
      maxX: s.width * 0.5 - 0.015,
    });
  }

  // -------------------- Shelf 1 (Lower-Mid): Books + Bookend + Flat Stack + Ceramic Mug --------------------
  {
    const s = shelves[1];
    const rowEnd = placeBookRow(THREE, propsGroup, s, -s.width * 0.5 + 0.016, 7, bookMats, mats.pages, mats.brass, rng, {
      leanEnd: false,
      minH: 0.175,
      maxH: 0.228,
      pullForwardIdx: 4,
      maxX: -0.06,
    });

    // Sculpted brass arch bookend holding the row neatly
    const bookend = buildArchBookend(THREE, mats);
    bookend.position.set(rowEnd + 0.014, s.y, s.zCenter + 0.01);
    propsGroup.add(bookend);

    // Casual flat stack of 3 books in center-right
    const flatStack = buildFlatBookStack(THREE, s, 0.095, 3, bookMats, mats.pages, mats.brass, rng, false, null);
    propsGroup.add(flatStack.group);

    // Ceramic mug on cork coaster on right side of Shelf 1
    const mugBuilt = buildCeramicMug(THREE, kit, mats);
    mugBuilt.group.position.set(s.width * 0.5 - 0.088, s.y, s.zCenter + 0.022);
    mugBuilt.group.rotation.y = -0.58;
    propsGroup.add(mugBuilt.group);
    root.userData.teabagTag = mugBuilt.tagPivot;
  }

  // -------------------- Shelf 2 (Middle Hero Shelf): Framed Abstract Art + Novels + Potted Plant --------------------
  {
    const s = shelves[2];
    const framedArt = buildFramedArt(THREE, kit, mats, primary, secondary, accent);
    framedArt.position.set(-s.width * 0.5 + 0.102, s.y, s.zCenter + 0.028);
    framedArt.rotation.y = 0.24;
    propsGroup.add(framedArt);

    // Cozy mid-shelf cluster of 5 novels with a leaning end book
    placeBookRow(THREE, propsGroup, s, -0.095, 6, bookMats, mats.pages, mats.brass, rng, {
      leanEnd: true,
      minH: 0.168,
      maxH: 0.215,
      pullForwardIdx: 1,
      maxX: s.width * 0.5 - 0.165,
    });

    // Lush trailing potted plant on the right
    const plantBuilt = buildPottedPlant(THREE, kit, mats, rng);
    plantBuilt.group.position.set(s.width * 0.5 - 0.088, s.y, s.zCenter + 0.014);
    plantBuilt.group.rotation.y = -0.22;
    propsGroup.add(plantBuilt.group);
    root.userData.plantFoliage = plantBuilt.foliage;
    root.userData.plantVines = plantBuilt.vines;
  }

  // -------------------- Shelf 3 (Upper-Mid): Flat Stack + Mini Bud Vase + Long Book Row --------------------
  {
    const s = shelves[3];
    // Small flat stack on the left with mini ceramic bud vase perched on top
    const leftStack = buildFlatBookStack(THREE, s, -s.width * 0.5 + 0.12, 2, bookMats, mats.pages, mats.brass, rng, false, null);
    propsGroup.add(leftStack.group);

    const vaseBuilt = buildMiniBudVase(THREE, mats);
    vaseBuilt.group.position.set(-s.width * 0.5 + 0.115, leftStack.topY, s.zCenter + 0.008);
    propsGroup.add(vaseBuilt.group);
    root.userData.botanicalSprig = vaseBuilt.sprig;

    // Expressive row of 10 varied books with leaning book on right
    placeBookRow(THREE, propsGroup, s, -0.055, 10, bookMats, mats.pages, mats.brass, rng, {
      leanEnd: true,
      minH: 0.16,
      maxH: 0.224,
      pullForwardIdx: 3,
      maxX: s.width * 0.5 - 0.015,
    });
  }

  // -------------------- Shelf 4 (Top Shelf): Paperbacks + Sketchbook Stack w/ Ribbon + Display Book --------------------
  {
    const s = shelves[4];
    placeBookRow(THREE, propsGroup, s, -s.width * 0.5 + 0.018, 6, bookMats, mats.pages, mats.brass, rng, {
      leanEnd: true,
      minH: 0.155,
      maxH: 0.205,
      pullForwardIdx: 2,
      maxX: -0.04,
    });

    // Flat stack of sketchbooks with peeking accent bookmark ribbon
    const topStack = buildFlatBookStack(THREE, s, 0.078, 3, bookMats, mats.pages, mats.brass, rng, true, mats.accentPaper);
    propsGroup.add(topStack.group);

    // Outward-facing leaning display hardcover on right side of top shelf
    const dispH = Math.min(s.headroom - 0.02, 0.205);
    const dispD = Math.min(s.depth - 0.022, 0.135);
    const dispBook = buildBook(THREE, 0.026, dispH, dispD, displayBookMat, mats.pages, mats.brass, false);
    // Rotate so cover faces forward-left and leans gently back
    const dispHolder = new THREE.Group();
    dispBook.rotation.y = Math.PI * 0.5;
    dispBook.position.set(0, 0, 0);
    dispHolder.add(dispBook);
    dispHolder.rotation.y = -0.34;
    dispHolder.rotation.x = -0.14;
    dispHolder.position.set(s.width * 0.5 - 0.095, s.y + 0.002, s.zCenter + 0.008);
    propsGroup.add(dispHolder);
  }

  // Propagate userData.slot from materials onto meshes where helpful
  root.traverse((child) => {
    if (child.isMesh && !child.userData.slot && child.material && child.material.userData && child.material.userData.slot) {
      child.userData.slot = child.material.userData.slot;
    }
  });
  tagSlot(structure.group, 'primary');
  enableShadows(root, true, true);

  return root;
}

export function idle(group, t) {
  if (!group || !group.userData) return;

  // Gentle open-window breeze swaying the potted plant leaves and trailing vines
  const foliage = group.userData.plantFoliage;
  if (foliage) {
    foliage.rotation.z = Math.sin(t * 1.15) * 0.024 + Math.sin(t * 2.1) * 0.008;
    foliage.rotation.x = Math.cos(t * 0.92) * 0.016;
  }

  const vines = group.userData.plantVines;
  if (Array.isArray(vines)) {
    for (let i = 0; i < vines.length; i++) {
      vines[i].rotation.z = Math.sin(t * 1.45 + i * 1.3) * 0.035;
      vines[i].rotation.x = Math.cos(t * 1.1 + i * 0.9) * 0.022;
    }
  }

  // Subtle sway on the hanging teabag tag and dried eucalyptus sprig
  const tag = group.userData.teabagTag;
  if (tag) {
    tag.rotation.z = Math.sin(t * 1.7 + 0.6) * 0.06;
  }

  const sprig = group.userData.botanicalSprig;
  if (sprig) {
    sprig.rotation.z = Math.sin(t * 1.25 + 2.1) * 0.022;
  }
}