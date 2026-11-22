export const META = {
  id: "arc-floor-lamp",
  name: "Cozy Arc Floor Lamp",
  kind: "prop",
  footprint: [0.54, 0.86],
  variants: [
    {
      name: "Warm Brass & Cream",
      opts: { metal: "#d9c08a", fabric: "#fff4e0", glow: "#ffd27a" },
    },
    {
      name: "Antique Bronze & Oatmeal",
      opts: { metal: "#7c654d", fabric: "#f1e4ce", glow: "#ffc066" },
    },
    {
      name: "Brushed Nickel & Linen",
      opts: { metal: "#bcc2c7", fabric: "#f5f3ec", glow: "#ffe09c" },
    },
    {
      name: "Rose Brass & Blush",
      opts: { metal: "#d59b8a", fabric: "#fbeae3", glow: "#ffca85" },
    },
  ],
  note: "Tall mid-century arc floor lamp with a weighted domed base, slender tapering curved stem, woven glowing linen drum shade, Edison bulb, pull cord, and braided floor dimmer switch.",
};

const DEFAULT_OPTS = {
  metal: "#d9c08a",
  fabric: "#fff4e0",
  glow: "#ffd27a",
};

function rgbCss(THREE, color, scale = 1, alpha = 1) {
  const r = Math.max(0, Math.min(255, Math.round(color.r * 255 * scale)));
  const g = Math.max(0, Math.min(255, Math.round(color.g * 255 * scale)));
  const b = Math.max(0, Math.min(255, Math.round(color.b * 255 * scale)));
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function createTaperedTube(
  THREE,
  curve,
  tubularSegments,
  radialSegments,
  radiusFn,
  capStart = false,
  capEnd = false,
  uvRepeatV = 1
) {
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    pts.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  const normals = [];
  const binormals = [];

  const firstT = tangents[0];
  const helper =
    Math.abs(firstT.x) < 0.85
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const firstB = new THREE.Vector3().crossVectors(firstT, helper).normalize();
  const firstN = new THREE.Vector3().crossVectors(firstB, firstT).normalize();
  normals.push(firstN);
  binormals.push(firstB);

  for (let i = 1; i <= tubularSegments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const n = normals[i - 1].clone();
    const axis = new THREE.Vector3().crossVectors(prevT, currT);
    const axisLen = axis.length();
    if (axisLen > 1e-6) {
      axis.divideScalar(axisLen);
      const angle = Math.acos(
        THREE.MathUtils.clamp(prevT.dot(currT), -1, 1)
      );
      n.applyAxisAngle(axis, angle);
    }
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    const b = new THREE.Vector3().crossVectors(currT, n).normalize();
    normals.push(n);
    binormals.push(b);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const r = radiusFn(t);
    const center = pts[i];
    const N = normals[i];
    const B = binormals[i];
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const vx = center.x + r * (cosT * N.x + sinT * B.x);
      const vy = center.y + r * (cosT * N.y + sinT * B.y);
      const vz = center.z + r * (cosT * N.z + sinT * B.z);
      positions.push(vx, vy, vz);
      uvs.push(u, t * uvRepeatV);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + j + 1;
      const d = i * ringStride + j + 1;
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  if (capStart) {
    const centerIdx = positions.length / 3;
    const p0 = pts[0];
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j, j + 1);
    }
  }

  if (capEnd) {
    const centerIdx = positions.length / 3;
    const pEnd = pts[tubularSegments];
    const ringOffset = tubularSegments * ringStride;
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(0.5, uvRepeatV);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, ringOffset + j + 1, ringOffset + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeBrushedMetalTextures(THREE, kit, metalColor) {
  const colorTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(THREE, metalColor, 1);
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y++) {
      const n = kit.noise(0.5, y * 0.16);
      const streak = 0.94 + n * 0.12;
      ctx.fillStyle = rgbCss(THREE, metalColor, streak, 0.45);
      ctx.fillRect(0, y, w, 1);
    }

    for (let i = 0; i < 420; i++) {
      const x = kit.noise(i * 1.37, 2.1) * w;
      const y = kit.noise(3.7, i * 0.91) * h;
      const len = 24 + kit.noise(i * 0.4, 9.2) * 90;
      const bright = kit.noise(i * 2.1, 4.4) > 0.5 ? 1.12 : 0.86;
      ctx.fillStyle = rgbCss(THREE, metalColor, bright, 0.16);
      ctx.fillRect(x, y, len, 1);
      if (x + len > w) {
        ctx.fillRect(x - w, y, len, 1);
      }
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(2, 2);

  const roughTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(74,74,74)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = Math.round(56 + kit.noise(1.7, y * 0.22) * 44);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 320; i++) {
      const x = kit.noise(i * 1.9, 5.1) * w;
      const y = kit.noise(8.3, i * 1.1) * h;
      const len = 30 + kit.noise(i * 0.7, 1.3) * 80;
      const v = Math.round(45 + kit.noise(i * 3.1, 7.2) * 65);
      ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.fillRect(x, y, len, 1);
    }
  });
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(2, 2);

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = Math.round(112 + kit.noise(4.2, y * 0.35) * 32);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(2, 2);

  return { colorTex, roughTex, bumpTex };
}

function makeFabricShadeTextures(THREE, kit, fabricColor, glowColor) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(THREE, fabricColor, 1);
    ctx.fillRect(0, 0, w, h);

    // Subtle warm vertical tone (slightly toastier near rolled trims)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbCss(THREE, fabricColor, 0.89, 0.55));
    grad.addColorStop(0.08, rgbCss(THREE, fabricColor, 0.98, 0.2));
    grad.addColorStop(0.5, rgbCss(THREE, fabricColor, 1.03, 0.12));
    grad.addColorStop(0.92, rgbCss(THREE, fabricColor, 0.98, 0.2));
    grad.addColorStop(1.0, rgbCss(THREE, fabricColor, 0.88, 0.55));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Woven horizontal linen weft threads with organic slubs
    for (let y = 0; y < h; y += 2) {
      const slub = kit.noise(1.3, y * 0.14);
      const tone = 0.92 + slub * 0.13;
      ctx.fillStyle = rgbCss(THREE, fabricColor, tone, 0.36);
      ctx.fillRect(0, y, w, 1);
      if (slub > 0.68) {
        const sx = kit.noise(y * 0.37, 4.9) * w;
        const sw = 18 + kit.noise(y * 0.51, 9.1) * 76;
        ctx.fillStyle = rgbCss(THREE, fabricColor, 0.86, 0.24);
        ctx.fillRect(sx, y, sw, 1.5);
      }
    }

    // Woven vertical warp threads
    for (let x = 0; x < w; x += 3) {
      const n = kit.noise(x * 0.17, 2.7);
      const tone = 0.93 + n * 0.11;
      ctx.fillStyle = rgbCss(THREE, fabricColor, tone, 0.28);
      ctx.fillRect(x, 0, 1, h);
    }

    // Subtle linen oatmeal flecks
    for (let i = 0; i < 650; i++) {
      const fx = kit.noise(i * 1.71, 0.83) * w;
      const fy = kit.noise(2.91, i * 1.13) * h;
      const fw = 1 + kit.noise(i * 0.63, 7.2) * 3;
      const fh = 1 + kit.noise(5.4, i * 0.89) * 1.5;
      ctx.fillStyle = rgbCss(THREE, fabricColor, 0.78, 0.18);
      ctx.fillRect(fx, fy, fw, fh);
    }

    // Top & bottom rolled fabric trim seam shadow lines
    const trimH = 22;
    ctx.fillStyle = rgbCss(THREE, fabricColor, 0.76, 0.42);
    ctx.fillRect(0, trimH, w, 2);
    ctx.fillRect(0, h - trimH - 2, w, 2);

    // Subtle vertical fabric overlap seam near u = 0 (placed at back of shade)
    ctx.fillStyle = rgbCss(THREE, fabricColor, 0.82, 0.38);
    ctx.fillRect(0, 0, 7, h);
    ctx.fillStyle = rgbCss(THREE, fabricColor, 0.72, 0.45);
    ctx.fillRect(7, 0, 1.5, h);
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 2) {
      const v = Math.round(108 + kit.noise(2.1, y * 0.19) * 44);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 3) {
      const v = Math.round(112 + kit.noise(x * 0.21, 5.4) * 38);
      ctx.fillStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.fillRect(x, 0, 1, h);
    }

    // Raised rolled trim ridges
    ctx.fillStyle = "rgb(172,172,172)";
    ctx.fillRect(0, 0, w, 20);
    ctx.fillRect(0, h - 20, w, 20);
    ctx.fillStyle = "rgb(78,78,78)";
    ctx.fillRect(0, 20, w, 3);
    ctx.fillRect(0, h - 23, w, 3);
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  // Emissive map: warm glowing bulb core through woven linen, dimmer at double-thick trims & overlap seam
  const emissiveTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const deepGlow = glowColor.clone().multiplyScalar(0.55);
    const midGlow = glowColor.clone().lerp(new THREE.Color("#ffffff"), 0.25);
    const hotGlow = glowColor.clone().lerp(new THREE.Color("#ffffff"), 0.58);

    // Canvas Y=0 corresponds to UV v=1 (top rim of shade), Y=h corresponds to v=0 (bottom rim)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbCss(THREE, deepGlow, 0.52));
    grad.addColorStop(0.06, rgbCss(THREE, deepGlow, 0.82));
    grad.addColorStop(0.22, rgbCss(THREE, midGlow, 0.96));
    grad.addColorStop(0.47, rgbCss(THREE, hotGlow, 1.0));
    grad.addColorStop(0.74, rgbCss(THREE, midGlow, 0.95));
    grad.addColorStop(0.93, rgbCss(THREE, deepGlow, 0.78));
    grad.addColorStop(1.0, rgbCss(THREE, deepGlow, 0.48));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Woven thread attenuation so linen texture glows warmly from behind
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(3.3, y * 0.15);
      const dark = 0.05 + (1 - n) * 0.14;
      ctx.fillStyle = `rgba(38,18,6,${dark.toFixed(3)})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 3) {
      const n = kit.noise(x * 0.19, 6.1);
      const dark = 0.04 + (1 - n) * 0.1;
      ctx.fillStyle = `rgba(38,18,6,${dark.toFixed(3)})`;
      ctx.fillRect(x, 0, 1, h);
    }

    // Dimmer double-layer fabric seam & rolled trim bands
    ctx.fillStyle = "rgba(42,18,5,0.42)";
    ctx.fillRect(0, 0, 8, h);
    ctx.fillStyle = "rgba(38,16,4,0.38)";
    ctx.fillRect(0, 0, w, 20);
    ctx.fillRect(0, h - 20, w, 20);
  });
  emissiveTex.colorSpace = THREE.SRGBColorSpace;
  emissiveTex.wrapS = THREE.RepeatWrapping;
  emissiveTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, bumpTex, emissiveTex };
}

function makeBraidedCordTextures(THREE, kit) {
  const colorTex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#3c332c";
    ctx.fillRect(0, 0, w, h);
    const step = 16;
    for (let y = -h; y < h * 2; y += step) {
      for (let x = 0; x < w; x += step) {
        const n = kit.noise(x * 0.12, y * 0.12);
        const shade = Math.round(52 + n * 28);
        ctx.strokeStyle = `rgb(${shade + 14},${shade + 6},${shade})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + step * 0.5, y + step * 0.5);
        ctx.stroke();

        ctx.strokeStyle = `rgb(${shade - 8},${shade - 12},${shade - 15})`;
        ctx.beginPath();
        ctx.moveTo(x + step, y);
        ctx.lineTo(x + step * 0.5, y + step * 0.5);
        ctx.stroke();
      }
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "rgb(110,110,110)";
    ctx.fillRect(0, 0, w, h);
    const step = 16;
    ctx.strokeStyle = "rgb(188,188,188)";
    ctx.lineWidth = 4;
    for (let y = -h; y < h * 2; y += step) {
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + step * 0.5, y + step * 0.5);
        ctx.lineTo(x + step, y);
        ctx.stroke();
      }
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  return { colorTex, bumpTex };
}

function makeFeltTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#262220";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      const x = kit.noise(i * 1.4, 2.2) * w;
      const y = kit.noise(7.1, i * 0.87) * h;
      const v = Math.round(28 + kit.noise(i * 0.5, 4.3) * 34);
      ctx.fillStyle = `rgb(${v + 4},${v + 2},${v})`;
      ctx.fillRect(x, y, 2, 1.5);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildCurvedPlaqueGeometry(THREE) {
  const shape = new THREE.Shape();
  const hw = 0.022;
  const hh = 0.0085;
  shape.moveTo(-hw + hh, -hh);
  shape.lineTo(hw - hh, -hh);
  shape.bezierCurveTo(hw + 0.002, -hh, hw + 0.002, hh, hw - hh, hh);
  shape.lineTo(-hw + hh, hh);
  shape.bezierCurveTo(-hw - 0.002, hh, -hw - 0.002, -hh, -hw + hh, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0007,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.center();

  // Bend plaque gently to conform to the circular domed base front
  const pos = geo.attributes.position;
  const bendRadius = 0.128;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = x / bendRadius;
    const r = bendRadius + z;
    const nx = Math.sin(angle) * r;
    const nz = (Math.cos(angle) - 1) * r + z;
    // Slight dome curvature vertically too
    const ny = y;
    const domeZ = nz - y * y * 1.8;
    pos.setXYZ(i, nx, ny, domeZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBentWingLeverGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.0042);
  shape.bezierCurveTo(0.011, -0.0048, 0.024, -0.0075, 0.033, -0.0052);
  shape.bezierCurveTo(0.039, -0.0034, 0.039, 0.0034, 0.033, 0.0052);
  shape.bezierCurveTo(0.024, 0.0075, 0.011, 0.0048, 0, 0.0042);
  shape.bezierCurveTo(-0.0045, 0.0032, -0.0045, -0.0032, 0, -0.0042);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelThickness: 0.0011,
    bevelSize: 0.001,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.0013);

  // Sculpt ergonomic gentle curve along the lever length
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = Math.max(0, x / 0.036);
    const bendZ = t * t * 0.0065;
    const archY = y * (1 + 0.08 * Math.sin(t * Math.PI));
    pos.setXYZ(i, x, archY, z + bendZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildDrumShadeGeometry(THREE) {
  // Double-walled tapered fabric drum shade with rolled top & bottom trim beads
  // Coordinates relative to shadePivot (0, 0, 0) = world (0, 1.685, 0.295)
  const topY = -0.075;
  const botY = -0.345;
  const topR = 0.168;
  const botR = 0.198;
  const wallT = 0.0055;

  const pts = [];

  // Start inside near bottom rolled lip, trace outward around bottom bead,
  // up the outer wall, over top rolled bead, and down the inner wall back to start.
  pts.push(new THREE.Vector2(botR - wallT, botY + 0.006));
  pts.push(new THREE.Vector2(botR - wallT + 0.0012, botY + 0.0015));
  pts.push(new THREE.Vector2(botR - wallT * 0.45, botY - 0.0005));
  pts.push(new THREE.Vector2(botR + 0.0004, botY + 0.0008));
  pts.push(new THREE.Vector2(botR + 0.0018, botY + 0.0042));
  pts.push(new THREE.Vector2(botR + 0.0006, botY + 0.0095));

  // Outer fabric wall (bottom to top) with subtle taut organic curve
  const wallSteps = 10;
  for (let i = 1; i < wallSteps; i++) {
    const f = i / wallSteps;
    const y = THREE.MathUtils.lerp(botY + 0.01, topY - 0.01, f);
    const r =
      THREE.MathUtils.lerp(botR, topR, f) + 0.0014 * Math.sin(f * Math.PI);
    pts.push(new THREE.Vector2(r, y));
  }

  // Top rolled trim bead
  pts.push(new THREE.Vector2(topR + 0.0006, topY - 0.0095));
  pts.push(new THREE.Vector2(topR + 0.0016, topY - 0.0042));
  pts.push(new THREE.Vector2(topR + 0.0003, topY - 0.0006));
  pts.push(new THREE.Vector2(topR - wallT * 0.48, topY + 0.0006));
  pts.push(new THREE.Vector2(topR - wallT + 0.0008, topY - 0.0016));
  pts.push(new THREE.Vector2(topR - wallT, topY - 0.0065));

  // Inner fabric wall (top to bottom)
  for (let i = wallSteps - 1; i >= 1; i--) {
    const f = i / wallSteps;
    const y = THREE.MathUtils.lerp(botY + 0.01, topY - 0.01, f);
    const r =
      THREE.MathUtils.lerp(botR - wallT, topR - wallT, f) +
      0.001 * Math.sin(f * Math.PI);
    pts.push(new THREE.Vector2(r, y));
  }

  // Close back cleanly to starting point
  pts.push(new THREE.Vector2(botR - wallT, botY + 0.006));

  const geo = new THREE.LatheGeometry(pts, 64);

  // Remap UV.y by physical height so the warm glow gradient & top/bottom trims align cleanly on inner & outer walls
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const minY = botY - 0.001;
  const maxY = topY + 0.001;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const v = THREE.MathUtils.clamp((y - minY) / (maxY - minY), 0, 1);
    uv.setY(i, v);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function build(THREE, opts, kit) {
  const cfg = Object.assign({}, DEFAULT_OPTS, opts || {});
  const metalColor = new THREE.Color(cfg.metal);
  const fabricColor = new THREE.Color(cfg.fabric);
  const glowColor = new THREE.Color(cfg.glow);
  const fabricSheenColor = fabricColor.clone().lerp(new THREE.Color("#ffffff"), 0.55);
  const darkMetalColor = metalColor.clone().multiplyScalar(0.55);

  const root = new THREE.Group();
  root.name = "arcFloorLamp";

  // Procedural textures
  const metalTex = makeBrushedMetalTextures(THREE, kit, metalColor);
  const fabricTex = makeFabricShadeTextures(THREE, kit, fabricColor, glowColor);
  const cordTex = makeBraidedCordTextures(THREE, kit);
  const feltTex = makeFeltTexture(THREE, kit);

  // Materials (MeshPhysicalMaterial)
  const metalMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: metalTex.colorTex,
    roughnessMap: metalTex.roughTex,
    bumpMap: metalTex.bumpTex,
    bumpScale: 0.0008,
    metalness: 0.88,
    roughness: 0.34,
    clearcoat: 0.22,
    clearcoatRoughness: 0.32,
  });

  const darkMetalMat = new THREE.MeshPhysicalMaterial({
    color: darkMetalColor,
    metalness: 0.82,
    roughness: 0.42,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
  });

  const shadeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: fabricTex.colorTex,
    bumpMap: fabricTex.bumpTex,
    bumpScale: 0.0032,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.72,
    sheenColor: fabricSheenColor,
    emissive: glowColor,
    emissiveMap: fabricTex.emissiveTex,
    emissiveIntensity: 1.48,
  });

  const bulbGlassMat = new THREE.MeshPhysicalMaterial({
    color: fabricColor.clone().lerp(new THREE.Color("#ffffff"), 0.5),
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    emissive: glowColor,
    emissiveIntensity: 1.95,
  });

  const filamentMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff8e6,
    roughness: 0.2,
    metalness: 0.1,
    emissive: glowColor.clone().lerp(new THREE.Color("#ffffff"), 0.45),
    emissiveIntensity: 3.2,
  });

  const cordMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: cordTex.colorTex,
    bumpMap: cordTex.bumpTex,
    bumpScale: 0.0022,
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color("#6a5b4e"),
  });

  const feltMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: feltTex,
    roughness: 0.96,
    metalness: 0.0,
    sheen: 0.6,
    sheenRoughness: 0.9,
    sheenColor: new THREE.Color("#48423e"),
  });

  const switchBodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#2b2623"),
    roughness: 0.42,
    metalness: 0.05,
    clearcoat: 0.28,
    clearcoatRoughness: 0.35,
  });

  const switchButtonMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#423a35"),
    roughness: 0.55,
    metalness: 0.05,
    clearcoat: 0.15,
  });

  // Main structural group
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  root.add(bodyGroup);

  const baseZ = -0.16;

  // 1. Weighted Round Base (LatheGeometry, 24 profile points)
  const baseProfile = [
    new THREE.Vector2(0.0, 0.004),
    new THREE.Vector2(0.164, 0.004),
    new THREE.Vector2(0.171, 0.0045),
    new THREE.Vector2(0.1745, 0.007),
    new THREE.Vector2(0.1755, 0.011),
    new THREE.Vector2(0.1755, 0.0185),
    new THREE.Vector2(0.1745, 0.0225),
    new THREE.Vector2(0.171, 0.0255),
    new THREE.Vector2(0.165, 0.0278),
    new THREE.Vector2(0.152, 0.0312),
    new THREE.Vector2(0.132, 0.0352),
    new THREE.Vector2(0.108, 0.0388),
    new THREE.Vector2(0.082, 0.0416),
    new THREE.Vector2(0.058, 0.0434),
    new THREE.Vector2(0.046, 0.0442),
    new THREE.Vector2(0.0435, 0.0458),
    new THREE.Vector2(0.042, 0.0472),
    new THREE.Vector2(0.036, 0.0476),
    new THREE.Vector2(0.031, 0.049),
    new THREE.Vector2(0.0285, 0.0525),
    new THREE.Vector2(0.0265, 0.055),
    new THREE.Vector2(0.022, 0.056),
    new THREE.Vector2(0.012, 0.056),
    new THREE.Vector2(0.0, 0.056),
  ];
  const baseGeo = new THREE.LatheGeometry(baseProfile, 64);
  baseGeo.computeVertexNormals();
  const baseMesh = new THREE.Mesh(baseGeo, metalMat);
  baseMesh.position.set(0, 0, baseZ);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.userData.slot = "metal";
  bodyGroup.add(baseMesh);

  // Subtle recessed felt pad sitting flush on the floor (y = 0)
  const feltProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.163, 0.0),
    new THREE.Vector2(0.1655, 0.0012),
    new THREE.Vector2(0.1655, 0.0045),
    new THREE.Vector2(0.0, 0.0045),
  ];
  const feltGeo = new THREE.LatheGeometry(feltProfile, 48);
  const feltMesh = new THREE.Mesh(feltGeo, feltMat);
  feltMesh.position.set(0, 0, baseZ);
  feltMesh.receiveShadow = true;
  feltMesh.userData.slot = "accent";
  bodyGroup.add(feltMesh);

  // Curved brass maker's medallion conforming to front dome of weighted base
  const plaqueGeo = buildCurvedPlaqueGeometry(THREE);
  const plaqueMesh = new THREE.Mesh(plaqueGeo, darkMetalMat);
  plaqueMesh.position.set(0, 0.0362, baseZ + 0.128);
  plaqueMesh.rotation.x = -Math.PI * 0.43;
  plaqueMesh.castShadow = true;
  plaqueMesh.receiveShadow = true;
  plaqueMesh.userData.slot = "metal";
  bodyGroup.add(plaqueMesh);

  // 2. Sculpted Stem Anchor Collar (LatheGeometry, 18 points)
  const collarProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.0245, 0.0),
    new THREE.Vector2(0.025, 0.004),
    new THREE.Vector2(0.0235, 0.008),
    new THREE.Vector2(0.0215, 0.0105),
    new THREE.Vector2(0.0222, 0.0135),
    new THREE.Vector2(0.0212, 0.0165),
    new THREE.Vector2(0.0185, 0.022),
    new THREE.Vector2(0.0168, 0.032),
    new THREE.Vector2(0.0156, 0.044),
    new THREE.Vector2(0.0148, 0.056),
    new THREE.Vector2(0.0156, 0.060),
    new THREE.Vector2(0.0152, 0.064),
    new THREE.Vector2(0.0138, 0.067),
    new THREE.Vector2(0.0124, 0.070),
    new THREE.Vector2(0.0112, 0.071),
    new THREE.Vector2(0.009, 0.071),
    new THREE.Vector2(0.009, 0.0),
  ];
  const collarGeo = new THREE.LatheGeometry(collarProfile, 40);
  const collarMesh = new THREE.Mesh(collarGeo, metalMat);
  collarMesh.position.set(0, 0.053, baseZ);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  collarMesh.userData.slot = "metal";
  bodyGroup.add(collarMesh);

  // 3. Slim Curved Arc Stem (Tapered Tube along CatmullRomCurve3)
  const stemCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0.048, baseZ),
      new THREE.Vector3(0, 0.34, baseZ - 0.004),
      new THREE.Vector3(0, 0.78, baseZ - 0.012),
      new THREE.Vector3(0, 1.18, baseZ - 0.008),
      new THREE.Vector3(0, 1.52, baseZ + 0.048),
      new THREE.Vector3(0, 1.755, 0.025),
      new THREE.Vector3(0, 1.825, 0.165),
      new THREE.Vector3(0, 1.775, 0.268),
      new THREE.Vector3(0, 1.69, 0.295),
    ],
    false,
    "centripetal",
    0.5
  );

  const stemGeo = createTaperedTube(
    THREE,
    stemCurve,
    80,
    24,
    (t) => {
      // Smooth slight telescoping taper from lower shaft to graceful upper arc
      const baseR = 0.0118;
      const tipR = 0.0082;
      const stepT = THREE.MathUtils.smoothstep(t, 0.36, 0.44);
      return THREE.MathUtils.lerp(baseR, tipR, t * 0.65 + stepT * 0.35);
    },
    true,
    true,
    6
  );
  const stemMesh = new THREE.Mesh(stemGeo, metalMat);
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;
  stemMesh.userData.slot = "metal";
  bodyGroup.add(stemMesh);

  // 4. Mid-Stem Telescoping Joint Sleeve & Thumbscrew
  const jointT = 0.4;
  const jointPos = stemCurve.getPoint(jointT);
  const jointTan = stemCurve.getTangent(jointT).normalize();
  const sleeveProfile = [
    new THREE.Vector2(0.009, -0.028),
    new THREE.Vector2(0.0132, -0.028),
    new THREE.Vector2(0.0148, -0.024),
    new THREE.Vector2(0.0154, -0.018),
    new THREE.Vector2(0.0154, -0.004),
    new THREE.Vector2(0.0164, -0.002),
    new THREE.Vector2(0.0164, 0.002),
    new THREE.Vector2(0.0152, 0.004),
    new THREE.Vector2(0.0146, 0.018),
    new THREE.Vector2(0.0134, 0.025),
    new THREE.Vector2(0.0118, 0.028),
    new THREE.Vector2(0.0085, 0.028),
  ];
  const sleeveGeo = new THREE.LatheGeometry(sleeveProfile, 32);
  const sleeveGroup = new THREE.Group();
  sleeveGroup.position.copy(jointPos);
  sleeveGroup.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    jointTan
  );

  const sleeveMesh = new THREE.Mesh(sleeveGeo, metalMat);
  sleeveMesh.castShadow = true;
  sleeveMesh.receiveShadow = true;
  sleeveMesh.userData.slot = "metal";
  sleeveGroup.add(sleeveMesh);

  // Small brass knurled locking thumbscrew on the back of the telescoping sleeve
  const thumbProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.0038, 0.0),
    new THREE.Vector2(0.0038, 0.008),
    new THREE.Vector2(0.0068, 0.0095),
    new THREE.Vector2(0.0072, 0.013),
    new THREE.Vector2(0.0066, 0.016),
    new THREE.Vector2(0.0045, 0.0172),
    new THREE.Vector2(0.0, 0.0174),
  ];
  const thumbGeo = new THREE.LatheGeometry(thumbProfile, 24);
  const thumbMesh = new THREE.Mesh(thumbGeo, darkMetalMat);
  thumbMesh.position.set(0, 0.005, -0.014);
  thumbMesh.rotation.x = -Math.PI / 2;
  thumbMesh.castShadow = true;
  thumbMesh.userData.slot = "metal";
  sleeveGroup.add(thumbMesh);

  bodyGroup.add(sleeveGroup);

  // 5. Stem Tip Ferrule & Swivel Knuckle Collar
  const tipPos = stemCurve.getPoint(1);
  const tipTan = stemCurve.getTangent(1).normalize();
  const ferruleProfile = [
    new THREE.Vector2(0.007, -0.026),
    new THREE.Vector2(0.0102, -0.026),
    new THREE.Vector2(0.0112, -0.022),
    new THREE.Vector2(0.0114, -0.006),
    new THREE.Vector2(0.0124, -0.003),
    new THREE.Vector2(0.0124, 0.003),
    new THREE.Vector2(0.0108, 0.007),
    new THREE.Vector2(0.006, 0.008),
  ];
  const ferruleGeo = new THREE.LatheGeometry(ferruleProfile, 28);
  const ferruleMesh = new THREE.Mesh(ferruleGeo, metalMat);
  ferruleMesh.position.copy(tipPos);
  ferruleMesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    tipTan
  );
  ferruleMesh.castShadow = true;
  ferruleMesh.userData.slot = "metal";
  bodyGroup.add(ferruleMesh);

  // Swivel knuckle barrel sitting cleanly at the pivot joint
  const pivotPos = new THREE.Vector3(0, 1.685, 0.295);
  const knuckleProfile = [
    new THREE.Vector2(0.0, -0.014),
    new THREE.Vector2(0.0102, -0.014),
    new THREE.Vector2(0.0124, -0.012),
    new THREE.Vector2(0.0128, -0.005),
    new THREE.Vector2(0.0128, 0.005),
    new THREE.Vector2(0.0124, 0.012),
    new THREE.Vector2(0.0102, 0.014),
    new THREE.Vector2(0.0, 0.014),
  ];
  const knuckleGeo = new THREE.LatheGeometry(knuckleProfile, 28);
  const knuckleMesh = new THREE.Mesh(knuckleGeo, metalMat);
  knuckleMesh.position.copy(pivotPos);
  knuckleMesh.rotation.z = Math.PI / 2;
  knuckleMesh.castShadow = true;
  knuckleMesh.userData.slot = "metal";
  bodyGroup.add(knuckleMesh);

  // Sculpted bent brass tension wing-lever (ExtrudeGeometry + bezierCurveTo + bent)
  const leverGeo = buildBentWingLeverGeometry(THREE);
  const leverMesh = new THREE.Mesh(leverGeo, darkMetalMat);
  leverMesh.position.set(pivotPos.x + 0.012, pivotPos.y, pivotPos.z);
  leverMesh.rotation.y = -0.35;
  leverMesh.rotation.z = -0.25;
  leverMesh.castShadow = true;
  leverMesh.userData.slot = "metal";
  bodyGroup.add(leverMesh);

  // 6. Hanging Lamp Head Group ("head") — sways gently from the swivel pivot
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.copy(pivotPos);
  root.add(headGroup);

  // Vertical pendant drop rod & decorative stepped brass shade cap (LatheGeometry, 22 points)
  const capProfile = [
    new THREE.Vector2(0.0, 0.004),
    new THREE.Vector2(0.0085, 0.004),
    new THREE.Vector2(0.0085, -0.048),
    new THREE.Vector2(0.0135, -0.052),
    new THREE.Vector2(0.015, -0.057),
    new THREE.Vector2(0.0125, -0.062),
    new THREE.Vector2(0.018, -0.067),
    new THREE.Vector2(0.028, -0.074),
    new THREE.Vector2(0.032, -0.082),
    new THREE.Vector2(0.031, -0.090),
    new THREE.Vector2(0.024, -0.094),
    new THREE.Vector2(0.0225, -0.102),
    new THREE.Vector2(0.0225, -0.132),
    new THREE.Vector2(0.0242, -0.136),
    new THREE.Vector2(0.0242, -0.144),
    new THREE.Vector2(0.0218, -0.148),
    new THREE.Vector2(0.0205, -0.162),
    new THREE.Vector2(0.0185, -0.166),
    new THREE.Vector2(0.014, -0.166),
    new THREE.Vector2(0.013, -0.156),
    new THREE.Vector2(0.0, -0.156),
  ];
  const capGeo = new THREE.LatheGeometry(capProfile, 40);
  capGeo.computeVertexNormals();
  const capMesh = new THREE.Mesh(capGeo, metalMat);
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  capMesh.userData.slot = "metal";
  headGroup.add(capMesh);

  // Fabric Drum Shade (Double-walled LatheGeometry with rolled top & bottom trim beads)
  const shadeGeo = buildDrumShadeGeometry(THREE);
  const shadeMesh = new THREE.Mesh(shadeGeo, shadeMat);
  // Rotate so the subtle fabric overlap seam sits cleanly at the back (-z)
  shadeMesh.rotation.y = -Math.PI / 2;
  shadeMesh.castShadow = true;
  shadeMesh.receiveShadow = true;
  shadeMesh.userData.slot = "fabric";
  shadeMesh.name = "drumShade";
  headGroup.add(shadeMesh);

  // Inner top brass support wire ring & three spider fitter spokes
  const ringCurvePts = [];
  const ringR = 0.1625;
  const ringY = -0.091;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ringCurvePts.push(
      new THREE.Vector3(Math.cos(a) * ringR, ringY, Math.sin(a) * ringR)
    );
  }
  const innerWireCurve = new THREE.CatmullRomCurve3(ringCurvePts, true);
  const innerWireGeo = createTaperedTube(
    THREE,
    innerWireCurve,
    48,
    8,
    () => 0.0022,
    false,
    false,
    4
  );
  const innerWireMesh = new THREE.Mesh(innerWireGeo, metalMat);
  innerWireMesh.userData.slot = "metal";
  headGroup.add(innerWireMesh);

  // Three curved spider spokes connecting central brass collar to inner wire ring
  for (let s = 0; s < 3; s++) {
    const ang = (s / 3) * Math.PI * 2 + Math.PI / 6;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const spokeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.022, -0.096, sa * 0.022),
      new THREE.Vector3(ca * 0.065, -0.098, sa * 0.065),
      new THREE.Vector3(ca * 0.125, -0.094, sa * 0.125),
      new THREE.Vector3(ca * 0.164, -0.091, sa * 0.164),
    ]);
    const spokeGeo = createTaperedTube(
      THREE,
      spokeCurve,
      18,
      8,
      (t) => THREE.MathUtils.lerp(0.0028, 0.0022, t),
      true,
      true,
      1
    );
    const spokeMesh = new THREE.Mesh(spokeGeo, metalMat);
    spokeMesh.userData.slot = "metal";
    headGroup.add(spokeMesh);
  }

  // Warm Glowing Edison Globe Bulb (LatheGeometry, 20 points)
  const bulbProfile = [
    new THREE.Vector2(0.0, -0.278),
    new THREE.Vector2(0.011, -0.277),
    new THREE.Vector2(0.022, -0.273),
    new THREE.Vector2(0.032, -0.265),
    new THREE.Vector2(0.039, -0.254),
    new THREE.Vector2(0.0425, -0.240),
    new THREE.Vector2(0.0425, -0.225),
    new THREE.Vector2(0.039, -0.211),
    new THREE.Vector2(0.033, -0.199),
    new THREE.Vector2(0.0255, -0.188),
    new THREE.Vector2(0.0195, -0.178),
    new THREE.Vector2(0.0165, -0.169),
    new THREE.Vector2(0.0155, -0.160),
    new THREE.Vector2(0.013, -0.158),
    new THREE.Vector2(0.0, -0.158),
  ];
  const bulbGeo = new THREE.LatheGeometry(bulbProfile, 36);
  bulbGeo.computeVertexNormals();
  const bulbMesh = new THREE.Mesh(bulbGeo, bulbGlassMat);
  bulbMesh.castShadow = false;
  bulbMesh.userData.slot = "glow";
  bulbMesh.name = "glowBulb";
  headGroup.add(bulbMesh);

  // Inner glowing warm filament loop (visible as a subtle bright core)
  const filCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.007, -0.185, 0),
    new THREE.Vector3(-0.013, -0.222, 0.003),
    new THREE.Vector3(0, -0.246, 0),
    new THREE.Vector3(0.013, -0.222, -0.003),
    new THREE.Vector3(0.007, -0.185, 0),
  ]);
  const filGeo = createTaperedTube(
    THREE,
    filCurve,
    24,
    8,
    () => 0.0014,
    true,
    true,
    1
  );
  const filMesh = new THREE.Mesh(filGeo, filamentMat);
  filMesh.castShadow = false;
  filMesh.userData.slot = "glow";
  filMesh.name = "glowFilament";
  headGroup.add(filMesh);

  // 7. Delicate Pull Cord & Sculpted Brass Teardrop Finial ("tail")
  const pullCordGroup = new THREE.Group();
  pullCordGroup.name = "tail";
  pullCordGroup.position.set(0.019, -0.146, 0.012);
  headGroup.add(pullCordGroup);

  // Tiny brass eyelet grommet where pull cord exits socket
  const eyeletProfile = [
    new THREE.Vector2(0.0018, 0.0),
    new THREE.Vector2(0.0046, 0.0),
    new THREE.Vector2(0.0052, -0.0035),
    new THREE.Vector2(0.0036, -0.007),
    new THREE.Vector2(0.0022, -0.007),
  ];
  const eyeletGeo = new THREE.LatheGeometry(eyeletProfile, 16);
  const eyeletMesh = new THREE.Mesh(eyeletGeo, metalMat);
  eyeletMesh.userData.slot = "metal";
  pullCordGroup.add(eyeletMesh);

  // Tapered pull cord hanging below the shade bottom edge
  const pullCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.003, 0),
    new THREE.Vector3(0.002, -0.085, 0.001),
    new THREE.Vector3(-0.001, -0.175, -0.001),
    new THREE.Vector3(0, -0.258, 0),
  ]);
  const pullCordGeo = createTaperedTube(
    THREE,
    pullCurve,
    24,
    10,
    (t) => THREE.MathUtils.lerp(0.0016, 0.0013, t),
    true,
    true,
    8
  );
  const pullCordMesh = new THREE.Mesh(pullCordGeo, cordMat);
  pullCordMesh.castShadow = true;
  pullCordMesh.userData.slot = "accent";
  pullCordGroup.add(pullCordMesh);

  // Sculpted brass teardrop finial at end of pull cord (LatheGeometry, 18 points)
  const finialProfile = [
    new THREE.Vector2(0.0, -0.034),
    new THREE.Vector2(0.0026, -0.0332),
    new THREE.Vector2(0.0058, -0.0305),
    new THREE.Vector2(0.0082, -0.0265),
    new THREE.Vector2(0.0092, -0.022),
    new THREE.Vector2(0.0088, -0.0175),
    new THREE.Vector2(0.0072, -0.013),
    new THREE.Vector2(0.0054, -0.009),
    new THREE.Vector2(0.0042, -0.006),
    new THREE.Vector2(0.0052, -0.0045),
    new THREE.Vector2(0.0052, -0.003),
    new THREE.Vector2(0.0038, -0.0016),
    new THREE.Vector2(0.0032, 0.001),
    new THREE.Vector2(0.0022, 0.0025),
    new THREE.Vector2(0.0, 0.0025),
  ];
  const finialGeo = new THREE.LatheGeometry(finialProfile, 28);
  finialGeo.computeVertexNormals();
  const finialMesh = new THREE.Mesh(finialGeo, metalMat);
  finialMesh.position.set(0, -0.258, 0);
  finialMesh.castShadow = true;
  finialMesh.userData.slot = "metal";
  pullCordGroup.add(finialMesh);

  // 8. Rear Base Brass Grommet, Braided Fabric Power Cord & Floor Foot-Dimmer Switch
  const grommetProfile = [
    new THREE.Vector2(0.004, 0.0),
    new THREE.Vector2(0.0095, 0.0),
    new THREE.Vector2(0.0095, 0.004),
    new THREE.Vector2(0.0075, 0.009),
    new THREE.Vector2(0.0062, 0.015),
    new THREE.Vector2(0.0048, 0.016),
    new THREE.Vector2(0.0035, 0.016),
  ];
  const grommetGeo = new THREE.LatheGeometry(grommetProfile, 20);
  const grommetMesh = new THREE.Mesh(grommetGeo, darkMetalMat);
  grommetMesh.position.set(0, 0.014, baseZ - 0.172);
  grommetMesh.rotation.x = -Math.PI / 2;
  grommetMesh.castShadow = true;
  grommetMesh.userData.slot = "metal";
  bodyGroup.add(grommetMesh);

  const cordR = 0.0042;
  const switchX = 0.21;
  const switchZ = -0.22;

  // Braided cord segment from rear base grommet to floor foot-dimmer switch
  const cordCurve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.014, baseZ - 0.178),
    new THREE.Vector3(0.015, 0.0075, baseZ - 0.205),
    new THREE.Vector3(0.085, cordR, baseZ - 0.215),
    new THREE.Vector3(0.165, cordR, baseZ - 0.165),
    new THREE.Vector3(switchX - 0.012, 0.006, switchZ - 0.032),
  ]);
  const cordGeo1 = createTaperedTube(
    THREE,
    cordCurve1,
    40,
    12,
    () => cordR,
    true,
    true,
    18
  );
  const cordMesh1 = new THREE.Mesh(cordGeo1, cordMat);
  cordMesh1.castShadow = true;
  cordMesh1.receiveShadow = true;
  cordMesh1.userData.slot = "accent";
  bodyGroup.add(cordMesh1);

  // Braided cord tail gracefully curving out behind the foot switch
  const cordCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(switchX + 0.01, 0.006, switchZ - 0.032),
    new THREE.Vector3(switchX + 0.035, cordR, switchZ - 0.085),
    new THREE.Vector3(switchX + 0.012, cordR, switchZ - 0.155),
    new THREE.Vector3(switchX - 0.045, cordR, switchZ - 0.195),
  ]);
  const cordGeo2 = createTaperedTube(
    THREE,
    cordCurve2,
    28,
    12,
    () => cordR,
    true,
    true,
    12
  );
  const cordMesh2 = new THREE.Mesh(cordGeo2, cordMat);
  cordMesh2.castShadow = true;
  cordMesh2.receiveShadow = true;
  cordMesh2.userData.slot = "accent";
  bodyGroup.add(cordMesh2);

  // Floor Foot-Dimmer Switch Housing (LatheGeometry, 16 points) resting flush on y = 0
  const switchGroup = new THREE.Group();
  switchGroup.position.set(switchX, 0, switchZ);
  bodyGroup.add(switchGroup);

  const switchProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.032, 0.0),
    new THREE.Vector2(0.0345, 0.002),
    new THREE.Vector2(0.0355, 0.006),
    new THREE.Vector2(0.0352, 0.013),
    new THREE.Vector2(0.0338, 0.017),
    new THREE.Vector2(0.0305, 0.0195),
    new THREE.Vector2(0.025, 0.021),
    new THREE.Vector2(0.020, 0.0212),
    new THREE.Vector2(0.0182, 0.020),
    new THREE.Vector2(0.0175, 0.0185),
    new THREE.Vector2(0.0, 0.0185),
  ];
  const switchBodyGeo = new THREE.LatheGeometry(switchProfile, 36);
  switchBodyGeo.computeVertexNormals();
  const switchBodyMesh = new THREE.Mesh(switchBodyGeo, switchBodyMat);
  switchBodyMesh.castShadow = true;
  switchBodyMesh.receiveShadow = true;
  switchBodyMesh.userData.slot = "accent";
  switchGroup.add(switchBodyMesh);

  // Brass accent bezel ring around the foot switch button
  const bezelProfile = [
    new THREE.Vector2(0.0165, 0.019),
    new THREE.Vector2(0.0205, 0.019),
    new THREE.Vector2(0.0212, 0.0216),
    new THREE.Vector2(0.0195, 0.0228),
    new THREE.Vector2(0.0172, 0.0226),
    new THREE.Vector2(0.0162, 0.021),
  ];
  const bezelGeo = new THREE.LatheGeometry(bezelProfile, 32);
  const bezelMesh = new THREE.Mesh(bezelGeo, metalMat);
  bezelMesh.castShadow = true;
  bezelMesh.userData.slot = "metal";
  switchGroup.add(bezelMesh);

  // Push-button plunger cap
  const btnProfile = [
    new THREE.Vector2(0.0, 0.019),
    new THREE.Vector2(0.0155, 0.019),
    new THREE.Vector2(0.0155, 0.0265),
    new THREE.Vector2(0.0145, 0.0285),
    new THREE.Vector2(0.011, 0.0298),
    new THREE.Vector2(0.005, 0.0303),
    new THREE.Vector2(0.0, 0.0304),
  ];
  const btnGeo = new THREE.LatheGeometry(btnProfile, 28);
  const btnMesh = new THREE.Mesh(btnGeo, switchButtonMat);
  btnMesh.castShadow = true;
  btnMesh.receiveShadow = true;
  btnMesh.userData.slot = "accent";
  switchGroup.add(btnMesh);

  // Store animation references in userData for zero-allocation idle updates
  root.userData.anim = {
    head: headGroup,
    tail: pullCordGroup,
    shadeMat,
    bulbGlassMat,
    filamentMat,
  };

  return root;
}

export function idle(group, t) {
  const anim = group.userData && group.userData.anim;
  if (!anim) return;

  // Subtle cozy breeze sway on the hanging drum shade
  const swayZ = Math.sin(t * 0.85) * 0.0075 + Math.sin(t * 1.65) * 0.0025;
  const swayX = Math.cos(t * 0.65) * 0.0055;
  anim.head.rotation.z = swayZ;
  anim.head.rotation.x = swayX;

  // Secondary delayed pendulum motion on the dangling brass-finial pull cord
  anim.tail.rotation.z = -swayZ * 0.65 + Math.sin(t * 1.45 - 0.9) * 0.018;
  anim.tail.rotation.x = -swayX * 0.65 + Math.cos(t * 1.15 - 0.6) * 0.012;

  // Gentle warm evening glow breathing
  const pulse =
    Math.sin(t * 1.6) * 0.055 + Math.sin(t * 3.9 + 1.1) * 0.02;
  anim.shadeMat.emissiveIntensity = 1.48 + pulse;
  anim.bulbGlassMat.emissiveIntensity = 1.95 + pulse * 1.35;
  anim.filamentMat.emissiveIntensity = 3.2 + pulse * 1.8;
}