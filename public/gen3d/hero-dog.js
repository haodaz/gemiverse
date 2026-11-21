export const META = {
  id: 'shiba-puppy',
  name: 'Cozy Shiba Puppy',
  kind: 'creature',
  footprint: [0.22, 0.40],
  variants: 3,
  note: 'Hero-quality stylised Shiba-like puppy (~0.4 m long) with raised front paw, curled bushy tail, blep tongue, 3 coat variants (solid, Shiba urajiro face mask, spotted), and none/bow/scarf accessories.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function noise3(kit, x, y, z) {
  const a = kit.noise(x + z * 0.713, y - z * 0.629);
  const b = kit.noise(z - x * 0.541 + 17.3, y + x * 0.817 - 9.1);
  return (a + b) * 0.5;
}

function fbm3(kit, x, y, z) {
  return (
    noise3(kit, x, y, z) * 0.56 +
    noise3(kit, x * 2.07 + 3.1, y * 2.07 - 1.7, z * 2.07 + 5.4) * 0.29 +
    noise3(kit, x * 4.19 - 6.2, y * 4.19 + 4.8, z * 4.19 - 2.3) * 0.15
  );
}

function colorToRGB(THREE, input, fallback) {
  const c = new THREE.Color();
  try {
    c.set(input != null ? input : fallback);
  } catch (_) {
    c.set(fallback);
  }
  return { r: c.r * 255, g: c.g * 255, b: c.b * 255 };
}

function mixRGB(a, b, t) {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t)
  };
}

function scaleRGB(c, s) {
  return {
    r: clamp(c.r * s, 0, 255),
    g: clamp(c.g * s, 0, 255),
    b: clamp(c.b * s, 0, 255)
  };
}

function rgbToThree(THREE, c) {
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
}

// Parallel-transport tapered tube helper along a CatmullRomCurve3.
// Supports smooth hemispherical caps on open tubes and seamless twist-corrected closed loops.
function createTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, options) {
  const cfg = options || {};
  const closed = !!curve.closed;
  const capStart = !closed && cfg.capStart !== false;
  const capEnd = !closed && cfg.capEnd !== false;
  const capRings = cfg.capRings || 4;

  const ringCount = tubularSegs + 1;
  const centers = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i < ringCount; i++) {
    const t = i / tubularSegs;
    centers.push(curve.getPointAt(closed && i === tubularSegs ? 0 : t));
    tangents.push(curve.getTangentAt(closed && i === tubularSegs ? 0 : t).normalize());
  }

  // Initial normal perpendicular to first tangent
  const up = Math.abs(tangents[0].y) < 0.92
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(up, tangents[0]).normalize();
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i < ringCount; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const nextN = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      q.setFromAxisAngle(axis, angle);
      nextN.applyQuaternion(q);
    }
    nextN.addScaledVector(currT, -nextN.dot(currT)).normalize();
    const nextB = new THREE.Vector3().crossVectors(currT, nextN).normalize();
    normals.push(nextN);
    binormals.push(nextB);
  }

  // Eliminate twist discontinuity on closed loops
  if (closed) {
    const endN = normals[ringCount - 1];
    const delta = Math.atan2(endN.dot(binormals[0]), endN.dot(normals[0]));
    for (let i = 0; i < ringCount; i++) {
      const a = -delta * (i / tubularSegs);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const n = normals[i];
      const b = binormals[i];
      const rn = n.clone().multiplyScalar(ca).addScaledVector(b, sa).normalize();
      const rb = new THREE.Vector3().crossVectors(tangents[i], rn).normalize();
      normals[i] = rn;
      binormals[i] = rb;
    }
  }

  const rings = [];
  const addRing = (center, T, N, B, tParam, rScale, axialOffset) => {
    const ring = [];
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const angle = u * Math.PI * 2;
      const r = Math.max(0.0001, radiusFn(tParam, angle) * rScale);
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const px = center.x + T.x * axialOffset + (N.x * ca + B.x * sa) * r;
      const py = center.y + T.y * axialOffset + (N.y * ca + B.y * sa) * r;
      const pz = center.z + T.z * axialOffset + (N.z * ca + B.z * sa) * r;
      ring.push({ x: px, y: py, z: pz, u, v: tParam });
    }
    rings.push(ring);
  };

  if (capStart) {
    const r0 = radiusFn(0, 0);
    for (let c = capRings; c >= 1; c--) {
      const a = (c / capRings) * (Math.PI * 0.5);
      addRing(centers[0], tangents[0], normals[0], binormals[0], 0, Math.cos(a), -Math.sin(a) * r0 * 0.85);
    }
  }

  for (let i = 0; i < ringCount; i++) {
    const t = i / tubularSegs;
    addRing(centers[i], tangents[i], normals[i], binormals[i], t, 1.0, 0);
  }

  if (capEnd) {
    const last = ringCount - 1;
    const r1 = radiusFn(1, 0);
    for (let c = 1; c <= capRings; c++) {
      const a = (c / capRings) * (Math.PI * 0.5);
      addRing(centers[last], tangents[last], normals[last], binormals[last], 1, Math.cos(a), Math.sin(a) * r1 * 0.85);
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    for (let j = 0; j < stride; j++) {
      const p = ring[j];
      positions.push(p.x, p.y, p.z);
      uvs.push(p.u, p.v);
    }
  }

  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const v00 = i * stride + j;
      const v10 = (i + 1) * stride + j;
      const v01 = i * stride + (j + 1);
      const v11 = (i + 1) * stride + (j + 1);
      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Procedural Textures (CanvasTexture + kit.noise)
// ============================================================================

function createFurBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        // Seamless tileable fur strand bump using periodic angles
        const ax = Math.cos(u * Math.PI * 2);
        const ay = Math.sin(u * Math.PI * 2);
        const bx = Math.cos(v * Math.PI * 2);
        const by = Math.sin(v * Math.PI * 2);
        const fine = kit.noise(ax * 14 + bx * 4.2, ay * 14 + by * 4.2);
        const strand = kit.noise(ax * 26 + 3.7, by * 8.5 + ay * 18);
        const soft = kit.noise(bx * 6.5 - 2.1, ax * 6.5 + by * 6.5);
        const val = clamp((fine * 0.42 + strand * 0.38 + soft * 0.20) * 255, 0, 255);
        const idx = (y * w + x) * 4;
        d[idx] = val;
        d[idx + 1] = val;
        d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createHeadFurTexture(THREE, kit, furRGB, accRGB, variant) {
  const darkFur = scaleRGB(furRGB, 0.78);
  const warmMid = mixRGB(furRGB, accRGB, 0.22);
  const softCream = mixRGB(accRGB, { r: 255, g: 248, b: 238 }, 0.12);

  const tex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;

    for (let py = 0; py < h; py++) {
      const v = (py + 0.5) / h;
      const theta = v * Math.PI;
      const sinT = Math.sin(theta);
      const ny = Math.cos(theta);

      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const phi = u * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const nz = Math.sin(phi) * sinT;

        const fleck = fbm3(kit, nx * 16.0, ny * 22.0, nz * 16.0);
        const fineHair = noise3(kit, nx * 38.0, ny * 24.0, nz * 38.0);
        const edgeJitter = (fbm3(kit, nx * 9.5, ny * 9.5, nz * 9.5) - 0.5) * 0.14;

        let col;

        if (variant === 0) {
          // Solid Shiba: warm dorsal shading, subtle lighter muzzle/chin, lush fur flecks
          const dorsal = smoothstep(-0.2, 0.78, ny);
          const chinLight = smoothstep(0.15, -0.65, ny) * smoothstep(-0.1, 0.7, nz);
          col = mixRGB(furRGB, darkFur, dorsal * 0.22);
          col = mixRGB(col, warmMid, chinLight * 0.45);
        } else if (variant === 1) {
          // Iconic two-tone Shiba Inu urajiro face mask
          const ax = Math.abs(nx);
          // Classic "M" brow dip on bridge, curving around lower cheeks & entire muzzle
          const bridgeDip = Math.exp(-Math.pow(ax / 0.24, 2)) * 0.12 * smoothstep(0.3, 0.9, nz);
          const cheekSweep = 0.03 + 0.11 * smoothstep(0.15, 0.85, nz) - 0.10 * smoothstep(0.42, 0.88, ax) - bridgeDip;
          const muzzleMask = smoothstep(cheekSweep + 0.08, cheekSweep - 0.06, ny + edgeJitter) *
                             smoothstep(-0.42, 0.28, nz + edgeJitter);
          const throatMask = smoothstep(-0.22, -0.58, ny + edgeJitter * 0.7);

          // Cute creamy Shiba "maro" eyebrow dots above the eyes
          const browDistL = Math.hypot((nx - 0.29) * 1.15, (ny - 0.41) * 1.65, (nz - 0.84) * 1.2);
          const browDistR = Math.hypot((nx + 0.29) * 1.15, (ny - 0.41) * 1.65, (nz - 0.84) * 1.2);
          const maroBrow = Math.max(
            smoothstep(0.18, 0.07, browDistL + edgeJitter * 0.35),
            smoothstep(0.18, 0.07, browDistR + edgeJitter * 0.35)
          );

          const creamAmt = clamp(Math.max(muzzleMask, throatMask, maroBrow * 0.92), 0, 1);

          // Subtle darker shading at crown and nose bridge
          const crownShade = smoothstep(0.25, 0.92, ny) * 0.20;
          const baseFur = mixRGB(furRGB, darkFur, crownShade);
          col = mixRGB(baseFur, softCream, creamAmt);
        } else {
          // Variant 2: Spotted piebald puppy (creamy coat + organic asymmetric warm fur patches)
          const patchField = fbm3(kit, nx * 2.1 + 1.4, ny * 2.1 - 0.6, nz * 2.1 + 2.3);
          // Big charming patch over right eye & right ear (nx < 0)
          const rightEyePatch = smoothstep(0.76, 0.46, Math.hypot(nx + 0.56, ny - 0.34, nz - 0.42) + edgeJitter * 1.6);
          // Smaller ear/crown patch on left side (nx > 0)
          const leftEarPatch = smoothstep(0.56, 0.30, Math.hypot(nx - 0.62, ny - 0.58, nz + 0.12) + edgeJitter * 1.4);
          // Small cute spot on back of head
          const napeSpot = smoothstep(0.48, 0.26, Math.hypot(nx + 0.15, ny - 0.05, nz + 0.92) + edgeJitter * 1.2);
          const organicPatch = smoothstep(0.60, 0.50, patchField + edgeJitter * 0.5) * smoothstep(-0.35, 0.15, ny);
          const patchAmt = clamp(Math.max(rightEyePatch, leftEarPatch, napeSpot, organicPatch * 0.65), 0, 1);

          const crownShade = smoothstep(0.3, 0.95, ny) * 0.14;
          const patchedFur = mixRGB(furRGB, darkFur, crownShade);
          col = mixRGB(softCream, patchedFur, patchAmt);
        }

        // Subtle warm eye-socket ambient occlusion so eyes sit warmly nested
        const eyeL = Math.hypot(nx - 0.44, ny - 0.14, nz - 0.887);
        const eyeR = Math.hypot(nx + 0.44, ny - 0.14, nz - 0.887);
        const eyeAO = Math.max(smoothstep(0.24, 0.05, eyeL), smoothstep(0.24, 0.05, eyeR));
        col = scaleRGB(col, 1.0 - eyeAO * 0.16);

        // Fur flecks & micro-variation
        const toneShift = 0.91 + fleck * 0.13 + (fineHair - 0.5) * 0.08;
        col = scaleRGB(col, toneShift);

        const idx = (py * w + px) * 4;
        d[idx] = col.r;
        d[idx + 1] = col.g;
        d[idx + 2] = col.b;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createBodyFurTexture(THREE, kit, furRGB, accRGB, variant) {
  const darkFur = scaleRGB(furRGB, 0.76);
  const softCream = mixRGB(accRGB, { r: 255, g: 248, b: 238 }, 0.10);

  const tex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;

    for (let py = 0; py < h; py++) {
      const v = (py + 0.5) / h;
      const theta = v * Math.PI;
      const sinT = Math.sin(theta);
      const ny = Math.cos(theta);

      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const phi = u * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const nz = Math.sin(phi) * sinT;

        const fleck = fbm3(kit, nx * 15.0, ny * 18.0, nz * 15.0);
        const fineHair = noise3(kit, nx * 36.0, ny * 26.0, nz * 36.0);
        const edgeJitter = (fbm3(kit, nx * 8.5, ny * 8.5, nz * 8.5) - 0.5) * 0.16;

        let col;
        if (variant === 0) {
          const spine = smoothstep(0.15, 0.92, ny) * 0.25;
          const belly = smoothstep(-0.1, -0.78, ny) * 0.28;
          col = mixRGB(furRGB, darkFur, spine);
          col = mixRGB(col, softCream, belly);
        } else if (variant === 1) {
          // Rich dorsal fur + fluffy creamy chest ruff and warm belly
          const chestMask = smoothstep(0.30, 0.78, nz + edgeJitter) * smoothstep(0.45, -0.05, ny + edgeJitter);
          const bellyMask = smoothstep(-0.08, -0.46, ny + edgeJitter);
          const creamAmt = clamp(Math.max(chestMask, bellyMask), 0, 1);

          const spine = smoothstep(0.25, 0.95, ny) * 0.24;
          const baseFur = mixRGB(furRGB, darkFur, spine);
          col = mixRGB(baseFur, softCream, creamAmt);
        } else {
          // Variant 2: Cozy spotted saddle + shoulder + rump patches
          const saddle = smoothstep(0.78, 0.48, Math.hypot((nx - 0.12) * 0.95, (ny - 0.52) * 1.15, (nz + 0.08) * 0.85) + edgeJitter * 1.5);
          const rumpSpot = smoothstep(0.62, 0.34, Math.hypot(nx + 0.35, ny - 0.25, nz + 0.72) + edgeJitter * 1.4);
          const flankSpot = smoothstep(0.46, 0.22, Math.hypot(nx - 0.78, ny + 0.05, nz - 0.32) + edgeJitter * 1.2);
          const shoulderSpot = smoothstep(0.52, 0.26, Math.hypot(nx + 0.52, ny - 0.28, nz - 0.58) + edgeJitter * 1.3);
          const patchAmt = clamp(Math.max(saddle, rumpSpot, flankSpot, shoulderSpot), 0, 1);

          const spine = smoothstep(0.25, 0.92, ny) * 0.16;
          const patchedFur = mixRGB(furRGB, darkFur, spine);
          col = mixRGB(softCream, patchedFur, patchAmt);
        }

        const toneShift = 0.90 + fleck * 0.14 + (fineHair - 0.5) * 0.08;
        col = scaleRGB(col, toneShift);

        const idx = (py * w + px) * 4;
        d[idx] = col.r;
        d[idx + 1] = col.g;
        d[idx + 2] = col.b;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createLimbFurTexture(THREE, kit, furRGB, accRGB, variant, isTail) {
  const darkFur = scaleRGB(furRGB, 0.80);
  const softCream = mixRGB(accRGB, { r: 255, g: 248, b: 238 }, 0.10);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;

    for (let py = 0; py < h; py++) {
      // flipY=true => py=0 is v=1 (tip/paw), py=h is v=0 (root/shoulder)
      const t = 1.0 - (py + 0.5) / h;
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const ang = u * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);

        const n = kit.noise(ca * 3.5 + t * 5.0, sa * 3.5 + t * 5.0);
        const fleck = kit.noise(ca * 10.0 + 4.1, sa * 10.0 + t * 18.0);
        const jitter = (n - 0.5) * 0.14;

        let col;
        if (isTail) {
          if (variant === 0) {
            const outerDark = smoothstep(-0.3, 0.8, ca) * 0.18;
            const tipLight = smoothstep(0.65, 1.0, t) * 0.25;
            col = mixRGB(furRGB, darkFur, outerDark);
            col = mixRGB(col, softCream, tipLight);
          } else if (variant === 1) {
            // Shiba tail: warm ginger outer curve, creamy underside & fluffy cream tip
            const under = smoothstep(0.15, -0.55, sa + jitter);
            const tip = smoothstep(0.62, 0.90, t + jitter);
            col = mixRGB(furRGB, softCream, clamp(Math.max(under * 0.85, tip), 0, 1));
          } else {
            // Spotted tail: warm base patch transitioning to fluffy cream plume
            const patch = smoothstep(0.62, 0.28, t + jitter * 1.4);
            col = mixRGB(softCream, furRGB, patch);
          }
        } else {
          // Legs: t=0 shoulder/hip -> t=1 ankle/paw
          if (variant === 0) {
            const lowerLight = smoothstep(0.45, 0.95, t) * 0.22;
            col = mixRGB(furRGB, softCream, lowerLight);
          } else if (variant === 1) {
            // Classic creamy Shiba "socks" on lower legs
            const sock = smoothstep(0.42, 0.72, t + jitter);
            col = mixRGB(furRGB, softCream, sock);
          } else {
            // Spotted legs: cream with cute upper leg spot
            const spot = smoothstep(0.46, 0.18, t + jitter * 1.3 + ca * 0.12);
            col = mixRGB(softCream, furRGB, spot);
          }
        }

        col = scaleRGB(col, 0.91 + n * 0.11 + (fleck - 0.5) * 0.08);
        const idx = (py * w + px) * 4;
        d[idx] = col.r;
        d[idx + 1] = col.g;
        d[idx + 2] = col.b;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0.0, 'rgba(240, 122, 118, 0.48)');
    g.addColorStop(0.55, 'rgba(240, 128, 122, 0.22)');
    g.addColorStop(1.0, 'rgba(240, 130, 125, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFabricTextures(THREE, kit, style) {
  const isScarf = style === 'scarf';

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    if (isScarf) {
      // Cozy dorm-room knit scarf: warm crimson base with cream & mustard tartan stripes
      ctx.fillStyle = '#b93b37';
      ctx.fillRect(0, 0, w, h);

      // Tartan horizontal & vertical bands
      ctx.fillStyle = 'rgba(246, 232, 206, 0.78)';
      ctx.fillRect(0, 44, w, 16);
      ctx.fillRect(0, 172, w, 16);
      ctx.fillRect(44, 0, 16, h);
      ctx.fillRect(172, 0, 16, h);

      ctx.fillStyle = 'rgba(222, 165, 68, 0.72)';
      ctx.fillRect(0, 68, w, 7);
      ctx.fillRect(0, 196, w, 7);
      ctx.fillRect(68, 0, 7, h);
      ctx.fillRect(196, 0, 7, h);

      ctx.fillStyle = 'rgba(58, 42, 46, 0.35)';
      ctx.fillRect(0, 112, w, 22);
      ctx.fillRect(112, 0, 22, h);

      // Knit rib yarn texture overlay
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 6) {
          const n = kit.noise(x * 0.08, y * 0.08);
          ctx.fillStyle = n > 0.5 ? 'rgba(255,250,242,0.10)' : 'rgba(30,12,12,0.12)';
          ctx.fillRect(x, y, 4, 2);
        }
      }
    } else {
      // Cozy coral-crimson woven ribbon with subtle cream stitch dots
      ctx.fillStyle = '#c8454b';
      ctx.fillRect(0, 0, w, h);

      // Fine diagonal twill weave
      ctx.strokeStyle = 'rgba(255, 235, 228, 0.10)';
      ctx.lineWidth = 1.5;
      for (let i = -h; i < w + h; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }

      // Soft polka dot accents
      ctx.fillStyle = 'rgba(252, 240, 224, 0.42)';
      for (let y = 16; y < h; y += 32) {
        for (let x = 16; x < w; x += 32) {
          const ox = ((y / 32) % 2) * 16;
          ctx.beginPath();
          ctx.arc((x + ox) % w, y, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(isScarf ? 3 : 2, isScarf ? 2 : 2);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const rib = isScarf
          ? Math.sin(x * 0.45) * 0.35 + Math.sin(y * 0.65 + (x % 8) * 0.4) * 0.25
          : Math.sin((x + y) * 0.85) * 0.3 + Math.sin((x - y) * 0.85) * 0.2;
        const n = kit.noise(x * 0.12, y * 0.12) * 0.4;
        const v = clamp((0.5 + rib * 0.45 + (n - 0.2)) * 255, 0, 255);
        const idx = (y * w + x) * 4;
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.copy(map.repeat);

  return { map, bump };
}

// ============================================================================
// Sculpted Continuous Surfaces
// ============================================================================

// Pure shaping function for the continuous Shiba head + cheeks + muzzle + sockets.
// Used both to sculpt the dense SphereGeometry AND to place eyes/nose/mouth flush on the surface.
function sculptHeadPoint(ux, uy, uz, kit) {
  const ax = Math.abs(ux);

  // Base generous chibi-Shiba skull proportions
  let x = ux * 0.068;
  let y = uy * 0.061;
  let z = uz * 0.065;

  // Plush wide Shiba cheeks (bulging outward on ±x, slightly low & forward)
  const cheekW = Math.exp(-Math.pow((ax - 0.78) / 0.34, 2)) *
                 Math.exp(-Math.pow((uy + 0.16) / 0.44, 2)) *
                 smoothstep(-0.35, 0.38, uz);
  x += Math.sign(ux) * 0.0155 * cheekW;
  y -= 0.004 * cheekW;
  z += 0.005 * cheekW;

  // Gently narrow upper cranium for clean dog silhouette
  const crownW = smoothstep(0.32, 0.96, uy);
  x *= 1.0 - 0.12 * crownW;

  // Continuous sculpted muzzle projecting smoothly in +z
  const muzzleGauss = Math.exp(-Math.pow(ax / 0.44, 2) - Math.pow((uy + 0.19) / 0.35, 2));
  const muzzleW = muzzleGauss * smoothstep(0.18, 0.72, uz);
  z += 0.043 * muzzleW;
  // Taper muzzle softly toward the nose tip & give cute canine bridge stop
  const tipFocus = Math.exp(-Math.pow(ax / 0.25, 2) - Math.pow((uy + 0.15) / 0.22, 2)) * smoothstep(0.65, 0.98, uz);
  x *= 1.0 - 0.18 * muzzleW;
  y -= 0.005 * muzzleW;
  // Subtle forehead stop dip right between the eyes
  const stopDip = Math.exp(-Math.pow(ax / 0.22, 2) - Math.pow((uy - 0.06) / 0.16, 2)) * smoothstep(0.55, 0.95, uz);
  z -= 0.0048 * stopDip;

  // Twin soft whisker-pad puffs flanking the nose/mouth
  const padW = (
    Math.exp(-Math.pow((ux - 0.16) / 0.17, 2)) +
    Math.exp(-Math.pow((ux + 0.16) / 0.17, 2))
  ) * Math.exp(-Math.pow((uy + 0.27) / 0.16, 2)) * smoothstep(0.55, 0.94, uz);
  z += 0.0042 * padW;
  y -= 0.0018 * padW;

  // Small tucked chin underneath muzzle
  const chinW = Math.exp(-Math.pow(ax / 0.26, 2) - Math.pow((uy + 0.49) / 0.20, 2)) * smoothstep(0.30, 0.85, uz);
  z += 0.011 * chinW;
  y += 0.003 * chinW;

  // Softly flatten nose-tip cap so the button nose seats snugly
  z -= 0.0025 * tipFocus;

  // Inset eye sockets so glossy eyes nestle naturally into the fur
  const eyeDL = Math.hypot(ux - 0.44, uy - 0.14, uz - 0.887);
  const eyeDR = Math.hypot(ux + 0.44, uy - 0.14, uz - 0.887);
  const sockL = Math.exp(-Math.pow(eyeDL / 0.16, 2));
  const sockR = Math.exp(-Math.pow(eyeDR / 0.16, 2));
  const sock = sockL + sockR;
  x -= ux * 0.0048 * sock;
  y -= uy * 0.0048 * sock;
  z -= uz * 0.0052 * sock;

  // Gentle brow ridge puff above eyes
  const browW = (
    Math.exp(-Math.pow((ux - 0.34) / 0.22, 2)) +
    Math.exp(-Math.pow((ux + 0.34) / 0.22, 2))
  ) * Math.exp(-Math.pow((uy - 0.35) / 0.16, 2)) * smoothstep(0.45, 0.90, uz);
  z += 0.0035 * browW;
  y += 0.0020 * browW;

  // Slight ear-root thickening on upper sides of skull
  const earBase = (
    Math.exp(-Math.pow((ux - 0.56) / 0.22, 2)) +
    Math.exp(-Math.pow((ux + 0.56) / 0.22, 2))
  ) * Math.exp(-Math.pow((uy - 0.72) / 0.22, 2)) * Math.exp(-Math.pow((uz - 0.06) / 0.32, 2));
  y += 0.0038 * earBase;

  // Lower-back neck overlap extension so head merges cleanly into body neck
  const neckOverlap = smoothstep(-0.42, -0.92, uy) * smoothstep(0.32, -0.35, uz);
  y -= 0.009 * neckOverlap;
  z -= 0.004 * neckOverlap;

  // Subtle plush fur loft along cheek fluff
  if (kit) {
    const loft = (noise3(kit, ux * 7.5, uy * 7.5, uz * 7.5) - 0.5) * 0.0022 * (0.4 + cheekW * 1.1);
    x += ux * loft;
    y += uy * loft;
    z += uz * loft;
  }

  return { x, y, z };
}

function sculptHeadNormal(THREE, ux, uy, uz) {
  const base = new THREE.Vector3(ux, uy, uz).normalize();
  const ref = Math.abs(base.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(ref, base).normalize();
  const t2 = new THREE.Vector3().crossVectors(base, t1).normalize();
  const eps = 0.015;
  const p0 = sculptHeadPoint(base.x, base.y, base.z, null);
  const u1 = base.clone().addScaledVector(t1, eps).normalize();
  const u2 = base.clone().addScaledVector(t2, eps).normalize();
  const p1 = sculptHeadPoint(u1.x, u1.y, u1.z, null);
  const p2 = sculptHeadPoint(u2.x, u2.y, u2.z, null);
  const d1 = new THREE.Vector3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
  const d2 = new THREE.Vector3(p2.x - p0.x, p2.y - p0.y, p2.z - p0.z);
  const n = new THREE.Vector3().crossVectors(d1, d2).normalize();
  if (n.dot(base) < 0) n.negate();
  return n;
}

function buildHeadGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const len = Math.hypot(ux, uy, uz) || 1;
    const p = sculptHeadPoint(ux / len, uy / len, uz / len, kit);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBodyGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const ux = vx / len;
    const uy = vy / len;
    const uz = vz / len;
    const ax = Math.abs(ux);

    let x = ux * 0.072;
    let y = uy * 0.062;
    let z = uz * 0.116;

    // Proud fluffy Shiba chest ruff in front
    const chestW = smoothstep(0.15, 0.88, uz) * Math.exp(-Math.pow((uy + 0.08) / 0.62, 2));
    z += 0.014 * chestW;
    y -= 0.006 * chestW;
    x *= 1.0 + 0.07 * chestW;

    // Sculpted neck column rising smoothly upward & forward to merge deeply into head
    const neckW = smoothstep(0.24, 0.78, uz) * smoothstep(0.08, 0.82, uy) * Math.exp(-Math.pow(ax / 0.62, 2));
    y += 0.044 * neckW;
    z += 0.018 * neckW;

    // Shoulder fullness around front leg roots
    const shoulderW = Math.exp(-Math.pow((uz - 0.50) / 0.30, 2)) *
                      Math.exp(-Math.pow((ax - 0.72) / 0.35, 2)) *
                      Math.exp(-Math.pow((uy + 0.08) / 0.45, 2));
    x += Math.sign(ux) * 0.008 * shoulderW;

    // Plump rounded haunches / thighs in rear
    const haunchW = Math.exp(-Math.pow((uz + 0.58) / 0.34, 2)) *
                    Math.exp(-Math.pow((ax - 0.70) / 0.38, 2)) *
                    Math.exp(-Math.pow((uy + 0.05) / 0.52, 2));
    x += Math.sign(ux) * 0.011 * haunchW;
    z -= 0.006 * haunchW;

    // Gentle waist tuck in lower flank (cozy, still plump)
    const waistW = Math.exp(-Math.pow((uz + 0.18) / 0.28, 2)) * smoothstep(0.15, -0.75, uy);
    x *= 1.0 - 0.07 * waistW;
    y += 0.006 * waistW;

    // Subtle back spine contour (slight sway between shoulders and rump)
    const backDip = Math.exp(-Math.pow((uz + 0.08) / 0.34, 2)) * smoothstep(0.35, 0.95, uy);
    y -= 0.0045 * backDip;

    // Tail-base rise on upper rump so tail emerges organically
    const rumpRise = smoothstep(-0.35, -0.88, uz) * smoothstep(0.10, 0.78, uy) * Math.exp(-Math.pow(ax / 0.50, 2));
    y += 0.010 * rumpRise;
    z -= 0.008 * rumpRise;

    // Softly flattened underside for grounded cozy silhouette
    const bellyFlat = smoothstep(-0.48, -0.95, uy);
    y += 0.007 * bellyFlat;

    // Subtle organic fur loft along chest & rump
    const loft = (noise3(kit, ux * 7.0, uy * 7.0, uz * 7.0) - 0.5) * 0.0024 * (0.45 + chestW * 0.8 + haunchW * 0.6);
    x += ux * loft;
    y += uy * loft;
    z += uz * loft;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Ears (ExtrudeGeometry + bezierCurveTo + bevel + 3D cupping vertex bend)
// ============================================================================

function bendEarGeometry(geo, isInner) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const h = clamp(y / 0.064, 0, 1);

    // Taper ear thickness gracefully toward the rounded tip
    z *= lerp(isInner ? 0.95 : 1.18, 0.36, Math.pow(h, 1.25));

    // Slight flare at the base so ear blends seamlessly into the skull
    const baseFlare = Math.pow(1.0 - h, 2.6);
    x *= 1.0 + 0.14 * baseFlare;

    // Hollow out the front face of the outer ear slightly for cozy concavity
    if (!isInner && z > 0) {
      const innerHollow = Math.exp(-Math.pow(x / 0.013, 2)) * Math.sin(clamp((h - 0.06) / 0.82, 0, 1) * Math.PI);
      z -= 0.0036 * innerHollow;
    }

    // Cup the whole ear forward in 3D (edges curve forward, center recedes)
    const cup = x * x * 15.0 * (1.0 - 0.32 * h);
    z += cup;

    // Gentle forward arch and tiny perk at the tip
    z += Math.sin(h * Math.PI) * 0.0055 - h * h * 0.0025;

    if (isInner) {
      z += 0.0036;
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildEar(THREE, outerMat, innerMat, side) {
  const earGroup = new THREE.Group();
  earGroup.name = side > 0 ? 'earL' : 'earR';

  // Classic plump triangular-rounded Shiba ear silhouette
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-0.023, -0.006);
  outerShape.bezierCurveTo(-0.025, 0.016, -0.017, 0.044, -0.005, 0.060);
  outerShape.bezierCurveTo(-0.001, 0.065, 0.004, 0.065, 0.008, 0.059);
  outerShape.bezierCurveTo(0.019, 0.042, 0.025, 0.015, 0.023, -0.006);
  outerShape.bezierCurveTo(0.010, -0.010, -0.010, -0.010, -0.023, -0.006);

  const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.0085,
    bevelEnabled: true,
    bevelThickness: 0.0038,
    bevelSize: 0.0034,
    bevelSegments: 4,
    curveSegments: 20
  });
  outerGeo.translate(0, 0, -0.00425);
  bendEarGeometry(outerGeo, false);

  if (side < 0) {
    // Mirror subtle asymmetry cleanly across X
    const p = outerGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
    // Flip winding after X mirror
    const idx = outerGeo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, b);
      }
    } else {
      for (let i = 0; i < p.count; i += 3) {
        const x1 = p.getX(i + 1), y1 = p.getY(i + 1), z1 = p.getZ(i + 1);
        p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
        p.setXYZ(i + 2, x1, y1, z1);
      }
    }
    outerGeo.computeVertexNormals();
  }

  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  outerMesh.userData.slot = 'fur';
  earGroup.add(outerMesh);

  // Soft curved inner ear lining
  const innerShape = new THREE.Shape();
  innerShape.moveTo(-0.014, 0.003);
  innerShape.bezierCurveTo(-0.015, 0.019, -0.009, 0.038, -0.002, 0.048);
  innerShape.bezierCurveTo(0.001, 0.051, 0.003, 0.051, 0.005, 0.047);
  innerShape.bezierCurveTo(0.011, 0.036, 0.015, 0.018, 0.014, 0.003);
  innerShape.bezierCurveTo(0.006, 0.000, -0.006, 0.000, -0.014, 0.003);

  const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 16
  });
  innerGeo.translate(0, 0, -0.0013);
  bendEarGeometry(innerGeo, true);

  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.receiveShadow = true;
  innerMesh.userData.slot = 'furAccent';
  earGroup.add(innerMesh);

  return earGroup;
}

// ============================================================================
// Face Details: 3-Layer Glossy Eyes, Sculpted Nose, Curved Mouth, Blep Tongue
// ============================================================================

function buildEye(THREE, eyeColor, side) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';

  const r = 0.0156;
  const zScale = 0.56;

  // Layer 1: Dark glossy clearcoat eyeball dome
  const darkGeo = new THREE.SphereGeometry(r, 24, 18);
  darkGeo.scale(1.0, 1.04, zScale);
  const darkMat = new THREE.MeshPhysicalMaterial({
    color: 0x160e0a,
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });
  const darkMesh = new THREE.Mesh(darkGeo, darkMat);
  darkMesh.userData.slot = 'secondary';
  eyeGroup.add(darkMesh);

  // Layer 2: Coloured iris ring crafted via LatheGeometry (18-point smooth dome-hugging profile)
  const rhoIn = 0.0064;
  const rhoOut = 0.0124;
  const irisPts = [];
  const frontSteps = 10;
  for (let i = 0; i <= frontSteps; i++) {
    const f = i / frontSteps;
    const rho = lerp(rhoIn, rhoOut, f);
    const zSurf = zScale * Math.sqrt(Math.max(0, r * r - rho * rho)) + 0.00048;
    irisPts.push(new THREE.Vector2(rho, zSurf));
  }
  const backSteps = 7;
  for (let i = 0; i <= backSteps; i++) {
    const f = i / backSteps;
    const rho = lerp(rhoOut, rhoIn, f);
    const zSurf = zScale * Math.sqrt(Math.max(0, r * r - rho * rho)) - 0.00035;
    irisPts.push(new THREE.Vector2(rho, zSurf));
  }
  const irisGeo = new THREE.LatheGeometry(irisPts, 28);
  irisGeo.rotateX(Math.PI * 0.5);
  irisGeo.scale(1.0, 1.04, 1.0);
  irisGeo.computeVertexNormals();

  const irisColor = new THREE.Color(eyeColor || '#5e351c');
  // Gently warm/lift very dark eye hues so the iris ring reads clearly against the glossy dark pupil
  const hsl = { h: 0, s: 0, l: 0 };
  irisColor.getHSL(hsl);
  if (hsl.l < 0.24) {
    irisColor.setHSL(hsl.h, Math.min(1, hsl.s + 0.1), 0.26);
  }
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: irisColor,
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });
  const irisMesh = new THREE.Mesh(irisGeo, irisMat);
  irisMesh.userData.slot = 'eye';
  eyeGroup.add(irisMesh);

  // Layer 3: Two crisp white catchlight highlight dots placed up and to one side
  const hlMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const hl1Geo = new THREE.SphereGeometry(0.0033, 14, 10);
  hl1Geo.scale(0.95, 1.15, 0.38);
  const hl1 = new THREE.Mesh(hl1Geo, hlMat);
  const hx1 = 0.0044;
  const hy1 = 0.0052;
  const hz1 = zScale * Math.sqrt(Math.max(0, r * r - hx1 * hx1 - (hy1 / 1.04) * (hy1 / 1.04))) + 0.00085;
  hl1.position.set(hx1, hy1, hz1);
  hl1.rotation.set(-0.26, 0.24, -0.18);
  eyeGroup.add(hl1);

  const hl2Geo = new THREE.SphereGeometry(0.0016, 12, 8);
  hl2Geo.scale(1.0, 1.0, 0.42);
  const hl2 = new THREE.Mesh(hl2Geo, hlMat);
  const hx2 = -0.0045;
  const hy2 = -0.0044;
  const hz2 = zScale * Math.sqrt(Math.max(0, r * r - hx2 * hx2 - (hy2 / 1.04) * (hy2 / 1.04))) + 0.00080;
  hl2.position.set(hx2, hy2, hz2);
  eyeGroup.add(hl2);

  return eyeGroup;
}

function buildNose(THREE) {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const ax = Math.abs(ux);

    // Classic cute canine shield/button nose: wider on top, softly tapered at bottom
    const topWide = lerp(0.74, 1.16, smoothstep(-0.85, 0.72, uy));
    let x = ux * 0.0112 * topWide;
    let y = uy * 0.0076;
    let z = uz * 0.0084;

    // Gentle flat bridge top
    y -= 0.0012 * smoothstep(0.45, 0.98, uy);

    // Tiny vertical philtrum cleft at lower center
    const cleft = Math.exp(-Math.pow(ax / 0.18, 2)) * smoothstep(0.25, -0.85, uy) * smoothstep(0.1, 0.95, uz);
    z -= 0.0014 * cleft;

    // Subtle nostril dimples
    const nostril = (
      Math.exp(-Math.pow((ux - 0.44) / 0.22, 2)) +
      Math.exp(-Math.pow((ux + 0.44) / 0.22, 2))
    ) * Math.exp(-Math.pow((uy + 0.14) / 0.26, 2)) * smoothstep(0.2, 0.9, uz);
    z -= 0.0012 * nostril;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x251a17,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.78,
    clearcoatRoughness: 0.18
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = 'secondary';
  return mesh;
}

function buildMouthAndTongue(THREE) {
  const group = new THREE.Group();

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a1a15,
    roughness: 0.55,
    clearcoat: 0.2
  });

  // Helper to project a unit-sphere direction onto the sculpted muzzle surface + tiny proud offset
  const muzzlePt = (ux, uy, uz, lift) => {
    const len = Math.hypot(ux, uy, uz) || 1;
    const nx = ux / len, ny = uy / len, nz = uz / len;
    const p = sculptHeadPoint(nx, ny, nz, null);
    const n = sculptHeadNormal(THREE, nx, ny, nz);
    return new THREE.Vector3(p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift);
  };

  // Vertical philtrum from under nose to smile junction
  const philCurve = new THREE.CatmullRomCurve3([
    muzzlePt(0, -0.22, 0.975, 0.0005),
    muzzlePt(0, -0.29, 0.957, 0.0008),
    muzzlePt(0, -0.35, 0.937, 0.0006)
  ]);
  const philGeo = createTaperedTube(THREE, philCurve, 8, 8, () => 0.00135, { capStart: true, capEnd: true, capRings: 2 });
  const philMesh = new THREE.Mesh(philGeo, mouthMat);
  philMesh.userData.slot = 'secondary';
  group.add(philMesh);

  // Two symmetrical curved smile tubes (:3 shiba smile) hugging the sculpted muzzle
  for (const s of [-1, 1]) {
    const smileCurve = new THREE.CatmullRomCurve3([
      muzzlePt(0, -0.35, 0.937, 0.0006),
      muzzlePt(s * 0.08, -0.39, 0.917, 0.0008),
      muzzlePt(s * 0.17, -0.395, 0.903, 0.0008),
      muzzlePt(s * 0.25, -0.355, 0.900, 0.0007),
      muzzlePt(s * 0.31, -0.305, 0.900, 0.0003)
    ]);
    const smileGeo = createTaperedTube(
      THREE,
      smileCurve,
      18,
      8,
      (t) => lerp(0.00145, 0.00095, smoothstep(0.65, 1.0, t)),
      { capStart: true, capEnd: true, capRings: 2 }
    );
    const smileMesh = new THREE.Mesh(smileGeo, mouthMat);
    smileMesh.userData.slot = 'secondary';
    group.add(smileMesh);
  }

  // Cute blep tongue (ExtrudeGeometry with bezierCurveTo + bevel, bent gracefully downward)
  const tongueShape = new THREE.Shape();
  tongueShape.moveTo(-0.0062, 0.0);
  tongueShape.bezierCurveTo(-0.0076, -0.007, -0.0078, -0.016, -0.0042, -0.0205);
  tongueShape.bezierCurveTo(-0.0015, -0.0230, 0.0015, -0.0230, 0.0042, -0.0205);
  tongueShape.bezierCurveTo(0.0078, -0.016, 0.0076, -0.007, 0.0062, 0.0);
  tongueShape.closePath();

  const tongueGeo = new THREE.ExtrudeGeometry(tongueShape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelThickness: 0.0013,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 16
  });
  tongueGeo.translate(0, 0, -0.0013);

  const tPos = tongueGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const y = tPos.getY(i);
    let z = tPos.getZ(i);

    const t = clamp(-y / 0.0225, 0, 1);
    // Curve gently forward out of the mouth and droop softly at the tip
    const newY = -0.020 * Math.sin(t * 1.12);
    let newZ = z + 0.0135 * Math.sin(t * 1.45) + 0.003 * t;

    // Subtle central tongue groove on top face
    if (z > 0) {
      const groove = Math.exp(-Math.pow(x / 0.0024, 2)) * Math.sin(t * Math.PI);
      newZ -= 0.0011 * groove;
    }

    tPos.setXYZ(i, x, newY, newZ);
  }
  tongueGeo.computeVertexNormals();

  const tongueMat = new THREE.MeshPhysicalMaterial({
    color: 0xec8692,
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 0.48,
    clearcoatRoughness: 0.24,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xffccd4)
  });

  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  const mouthAnchor = muzzlePt(0.04, -0.385, 0.922, -0.003);
  tongueMesh.position.copy(mouthAnchor);
  tongueMesh.rotation.set(0.28, 0.08, -0.10); // Slight jaunty off-center blep
  tongueMesh.castShadow = true;
  tongueMesh.receiveShadow = true;
  tongueMesh.userData.slot = 'skin';
  group.add(tongueMesh);

  return group;
}

// ============================================================================
// Sculpted Paws & Tapered-Tube Limbs
// ============================================================================

function buildPaw(THREE, furMat, padMat, isStanding) {
  const pawGroup = new THREE.Group();

  // Sculpted continuous 3-toed canine paw (sole rests cleanly at local y = 0)
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    let x = ux * 0.0205;
    let y = uy * 0.0155;
    let z = uz * 0.0265;

    // Elongate gently forward into toes, rounder heel in back
    if (uz > 0) {
      z *= 1.12;
      // Sculpt 3 soft rounded toe lobes along the front
      const toeWave = Math.cos(ux * Math.PI * 2.8) * 0.5 + 0.5;
      const toeW = smoothstep(0.15, 0.92, uz) * Math.exp(-Math.pow((uy + 0.05) / 0.65, 2));
      z += 0.0032 * toeWave * toeW;
      y += 0.0012 * toeWave * toeW;
    }

    // Taper smoothly upward into ankle wrist
    const topW = smoothstep(0.25, 0.98, uy);
    x *= 1.0 - 0.16 * topW;
    z *= 1.0 - 0.18 * topW;
    y += 0.005 * topW;

    // Flatten sole cleanly for weight resting on the floor
    if (uy < -0.25) {
      const flat = smoothstep(-0.25, -0.82, uy);
      y = lerp(y, -0.0135, isStanding ? flat * 0.92 : flat * 0.55);
    }

    // Shift up so underside sits right at local y = 0
    pos.setXYZ(i, x, y + 0.0138, z + 0.004);
  }
  geo.computeVertexNormals();

  const pawMesh = new THREE.Mesh(geo, furMat);
  pawMesh.castShadow = true;
  pawMesh.receiveShadow = true;
  pawMesh.userData.slot = 'fur';
  pawGroup.add(pawMesh);

  // Cute soft paw pads underneath (especially charming on the raised front paw!)
  const mainPadGeo = new THREE.SphereGeometry(0.0088, 16, 12);
  mainPadGeo.scale(1.15, 0.38, 1.0);
  const mainPad = new THREE.Mesh(mainPadGeo, padMat);
  mainPad.position.set(0, 0.0022, -0.001);
  mainPad.userData.slot = 'skin';
  pawGroup.add(mainPad);

  const toeOffsets = [
    [-0.0095, 0.0024, 0.0145, -0.22],
    [0.0,     0.0024, 0.0185,  0.0],
    [0.0095,  0.0024, 0.0145,  0.22]
  ];
  const toePadGeo = new THREE.SphereGeometry(0.0044, 12, 10);
  toePadGeo.scale(0.88, 0.42, 1.25);
  for (const [tx, ty, tz, rotY] of toeOffsets) {
    const toePad = new THREE.Mesh(toePadGeo, padMat);
    toePad.position.set(tx, ty, tz);
    toePad.rotation.y = rotY;
    toePad.userData.slot = 'skin';
    pawGroup.add(toePad);
  }

  return pawGroup;
}

function buildLimb(THREE, name, pivotPos, curvePts, radiusFn, limbMat, pawMat, padMat, pawCfg) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(pivotPos[0], pivotPos[1], pivotPos[2]);

  const curve = new THREE.CatmullRomCurve3(
    curvePts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
  );
  const shaftGeo = createTaperedTube(THREE, curve, 22, 16, radiusFn, {
    capStart: true,
    capEnd: true,
    capRings: 3
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, limbMat);
  shaftMesh.castShadow = true;
  shaftMesh.receiveShadow = true;
  shaftMesh.userData.slot = 'fur';
  group.add(shaftMesh);

  const paw = buildPaw(THREE, pawMat, padMat, pawCfg.isStanding);
  paw.position.set(pawCfg.pos[0], pawCfg.pos[1], pawCfg.pos[2]);
  if (pawCfg.rot) {
    paw.rotation.set(pawCfg.rot[0], pawCfg.rot[1], pawCfg.rot[2]);
  }
  group.add(paw);

  return group;
}

// ============================================================================
// Accessories ("scarf" and "bow")
// ============================================================================

function buildScarfAccessory(THREE, kit) {
  const accGroup = new THREE.Group();
  accGroup.name = 'accessoryScarf';

  const { map, bump } = createFabricTextures(THREE, kit, 'scarf');
  const scarfMat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.0032,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xf4d2c8)
  });

  // Closed-loop plush knit scarf collar hugging the tilted neck junction
  const collarPts = [];
  const steps = 16;
  const cx = 0.0;
  const cy = 0.194;
  const cz = 0.068;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rx = 0.056;
    const rz = 0.058;
    const lx = Math.cos(a) * rx;
    const lz = Math.sin(a) * rz;
    // Tilt collar down toward front chest & up toward back of neck
    const ly = -lz * 0.32 + Math.sin(a * 2) * 0.003;
    collarPts.push(new THREE.Vector3(cx + lx, cy + ly, cz + lz));
  }
  const collarCurve = new THREE.CatmullRomCurve3(collarPts, true);
  const collarGeo = createTaperedTube(
    THREE,
    collarCurve,
    40,
    16,
    (t, a) => {
      const puff = 1.0 + 0.12 * Math.sin(t * Math.PI * 6);
      const oval = 1.0 + 0.18 * Math.cos(a * 2);
      return 0.0145 * puff * oval;
    },
    {}
  );
  const collarMesh = new THREE.Mesh(collarGeo, scarfMat);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  collarMesh.userData.slot = 'accent';
  accGroup.add(collarMesh);

  // Two overlapping draped scarf tails (ExtrudeGeometry + bezierCurveTo + 3D chest drape bend)
  const makeScarfTail = (length, width, zBend, xSway) => {
    const sh = new THREE.Shape();
    sh.moveTo(-width * 0.44, 0);
    sh.bezierCurveTo(-width * 0.50, -length * 0.35, -width * 0.54, -length * 0.72, -width * 0.52, -length);
    sh.lineTo(width * 0.52, -length);
    sh.bezierCurveTo(width * 0.54, -length * 0.72, width * 0.50, -length * 0.35, width * 0.44, 0);
    sh.closePath();

    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.0055,
      bevelEnabled: true,
      bevelThickness: 0.0022,
      bevelSize: 0.0018,
      bevelSegments: 3,
      curveSegments: 14
    });
    g.translate(0, 0, -0.00275);

    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const f = clamp(-y / length, 0, 1);
      // Drape gently over the chest curve with a cozy flutter at the end
      x += Math.sin(f * Math.PI * 0.85) * xSway;
      z += Math.sin(f * Math.PI) * zBend + Math.sin(x * 80) * 0.0012 * f;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();

    const tailMesh = new THREE.Mesh(g, scarfMat);
    tailMesh.castShadow = true;
    tailMesh.receiveShadow = true;
    tailMesh.userData.slot = 'accent';

    // Tiny soft fringe tassels at scarf hem
    const fringeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0e1c8,
      roughness: 0.94,
      sheen: 0.7
    });
    const tailWrap = new THREE.Group();
    tailWrap.add(tailMesh);
    for (let k = -2; k <= 2; k++) {
      const fx = k * (width * 0.21) + Math.sin(0.85 * Math.PI) * xSway;
      const fCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(fx, -length + 0.002, 0),
        new THREE.Vector3(fx + k * 0.0012, -length - 0.008, 0.002),
        new THREE.Vector3(fx + k * 0.002, -length - 0.015, 0.001)
      ]);
      const fGeo = createTaperedTube(THREE, fCurve, 6, 6, (t) => lerp(0.0016, 0.0011, t), { capStart: false, capEnd: true, capRings: 2 });
      const fMesh = new THREE.Mesh(fGeo, fringeMat);
      fMesh.userData.slot = 'primary';
      tailWrap.add(fMesh);
    }
    return tailWrap;
  };

  const tailFront = makeScarfTail(0.072, 0.032, 0.012, 0.008);
  tailFront.position.set(0.024, 0.174, 0.118);
  tailFront.rotation.set(-0.24, 0.34, 0.16);
  accGroup.add(tailFront);

  const tailBack = makeScarfTail(0.056, 0.028, 0.008, -0.005);
  tailBack.position.set(0.036, 0.172, 0.106);
  tailBack.rotation.set(-0.14, 0.56, 0.28);
  accGroup.add(tailBack);

  // Cozy turned wooden/brass toggle button pinning the scarf fold (LatheGeometry, 18 profile points)
  const togglePts = [];
  const tProfile = [
    [0.0001, -0.0125], [0.0024, -0.0122], [0.0040, -0.0108], [0.0048, -0.0085],
    [0.0050, -0.0058], [0.0045, -0.0032], [0.0038, -0.0015], [0.0036,  0.0000],
    [0.0038,  0.0015], [0.0045,  0.0032], [0.0050,  0.0058], [0.0048,  0.0085],
    [0.0040,  0.0108], [0.0024,  0.0122], [0.0010,  0.0125], [0.0001,  0.0126]
  ];
  for (const [rx, ry] of tProfile) togglePts.push(new THREE.Vector2(rx, ry));
  const toggleGeo = new THREE.LatheGeometry(togglePts, 20);
  const toggleMat = new THREE.MeshPhysicalMaterial({
    color: 0xc89548,
    roughness: 0.34,
    metalness: 0.45,
    clearcoat: 0.4
  });
  const toggleMesh = new THREE.Mesh(toggleGeo, toggleMat);
  toggleMesh.position.set(0.022, 0.174, 0.129);
  toggleMesh.rotation.set(0.15, 0.25, 1.38);
  toggleMesh.castShadow = true;
  toggleMesh.userData.slot = 'primary';
  accGroup.add(toggleMesh);

  return accGroup;
}

function buildBowAccessory(THREE, kit) {
  const accGroup = new THREE.Group();
  accGroup.name = 'accessoryBow';

  const { map, bump } = createFabricTextures(THREE, kit, 'bow');
  const ribbonMat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.0022,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.82,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0xffd6d8)
  });

  // Soft ribbon collar strap around the neck
  const collarPts = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const lx = Math.cos(a) * 0.052;
    const lz = Math.sin(a) * 0.054;
    const ly = -lz * 0.32;
    collarPts.push(new THREE.Vector3(lx, 0.194 + ly, 0.068 + lz));
  }
  const collarCurve = new THREE.CatmullRomCurve3(collarPts, true);
  const collarGeo = createTaperedTube(
    THREE,
    collarCurve,
    36,
    12,
    (_t, a) => 0.0065 * (1.0 + 0.38 * Math.cos(a * 2)),
    {}
  );
  const collarMesh = new THREE.Mesh(collarGeo, ribbonMat);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  collarMesh.userData.slot = 'primary';
  accGroup.add(collarMesh);

  // Plump front bow centered on chest
  const bowCenter = new THREE.Group();
  bowCenter.position.set(0.0, 0.176, 0.126);
  bowCenter.rotation.set(-0.22, 0.0, 0.04);

  // Sculpted pinched fabric knot
  const knotGeo = new THREE.SphereGeometry(0.0105, 20, 16);
  knotGeo.scale(0.88, 1.05, 0.78);
  const knotMesh = new THREE.Mesh(knotGeo, ribbonMat);
  knotMesh.castShadow = true;
  knotMesh.userData.slot = 'accent';
  bowCenter.add(knotMesh);

  // Two puffed bent ribbon loops (ExtrudeGeometry + bezierCurveTo + 3D puff bend)
  for (const s of [-1, 1]) {
    const loopShape = new THREE.Shape();
    loopShape.moveTo(0, -0.005);
    loopShape.bezierCurveTo(s * 0.014, -0.014, s * 0.036, -0.022, s * 0.038, 0.0);
    loopShape.bezierCurveTo(s * 0.036, 0.022, s * 0.014, 0.014, 0, 0.005);
    loopShape.closePath();

    const loopGeo = new THREE.ExtrudeGeometry(loopShape, {
      depth: 0.006,
      bevelEnabled: true,
      bevelThickness: 0.0032,
      bevelSize: 0.0028,
      bevelSegments: 4,
      curveSegments: 18
    });
    loopGeo.translate(0, 0, -0.003);

    const p = loopGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const dist = Math.abs(x) / 0.038;
      // Puff front & curve loop smoothly backward around chest
      z *= lerp(0.75, 1.35, Math.sin(dist * Math.PI));
      z -= dist * dist * 0.013;
      // Subtle center crease pinch along loop
      z -= Math.exp(-Math.pow(y / 0.005, 2)) * 0.0022 * Math.sin(dist * Math.PI);
      p.setXYZ(i, x, y, z);
    }
    loopGeo.computeVertexNormals();

    const loopMesh = new THREE.Mesh(loopGeo, ribbonMat);
    loopMesh.castShadow = true;
    loopMesh.receiveShadow = true;
    loopMesh.userData.slot = 'accent';
    bowCenter.add(loopMesh);
  }

  // Two gently curving swallowtail ribbon ends
  for (const s of [-1, 1]) {
    const rtShape = new THREE.Shape();
    rtShape.moveTo(0, 0);
    rtShape.bezierCurveTo(s * 0.008, -0.014, s * 0.018, -0.028, s * 0.024, -0.042);
    rtShape.lineTo(s * 0.014, -0.036);
    rtShape.lineTo(s * 0.007, -0.044);
    rtShape.bezierCurveTo(s * 0.004, -0.028, s * 0.001, -0.014, 0, 0);
    rtShape.closePath();

    const rtGeo = new THREE.ExtrudeGeometry(rtShape, {
      depth: 0.0032,
      bevelEnabled: true,
      bevelThickness: 0.0012,
      bevelSize: 0.001,
      bevelSegments: 2,
      curveSegments: 12
    });
    rtGeo.translate(0, 0, -0.0016);
    const p = rtGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      let z = p.getZ(i);
      const f = clamp(-y / 0.044, 0, 1);
      z += Math.sin(f * Math.PI) * 0.006 - f * 0.004;
      p.setXYZ(i, x, y, z);
    }
    rtGeo.computeVertexNormals();

    const rtMesh = new THREE.Mesh(rtGeo, ribbonMat);
    rtMesh.position.set(0, -0.004, -0.002);
    rtMesh.castShadow = true;
    rtMesh.userData.slot = 'accent';
    bowCenter.add(rtMesh);
  }

  // Tiny turned satin-brass jingle bell charm beneath bow knot (LatheGeometry, 18 profile points)
  const bellPts = [
    [0.0001,  0.0095], [0.0022,  0.0093], [0.0028,  0.0082], [0.0016,  0.0070],
    [0.0038,  0.0062], [0.0064,  0.0046], [0.0080,  0.0022], [0.0085,  0.0004],
    [0.0091,  0.0000], [0.0085, -0.0005], [0.0080, -0.0024], [0.0068, -0.0046],
    [0.0052, -0.0064], [0.0032, -0.0076], [0.0014, -0.0082], [0.0001, -0.0084]
  ].map(([rx, ry]) => new THREE.Vector2(rx, ry));

  const bellGeo = new THREE.LatheGeometry(bellPts, 24);
  const bellMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6b852,
    metalness: 0.84,
    roughness: 0.22,
    clearcoat: 0.35
  });
  const bellMesh = new THREE.Mesh(bellGeo, bellMat);
  bellMesh.position.set(0, -0.0155, 0.002);
  bellMesh.castShadow = true;
  bellMesh.userData.slot = 'accent';
  bowCenter.add(bellMesh);

  accGroup.add(bowCenter);
  return accGroup;
}

// ============================================================================
// Main Builder
// ============================================================================

export function build(THREE, opts, kit) {
  const o = opts || {};
  const variant = o.variant === 0 || o.variant === 1 || o.variant === 2 ? o.variant : 1;
  const accessory = o.accessory === 'none' || o.accessory === 'bow' || o.accessory === 'scarf'
    ? o.accessory
    : 'scarf';

  const furRGB = colorToRGB(THREE, o.fur, '#d9863f');
  const accRGB = colorToRGB(THREE, o.furAccent, '#f6ebd7');
  const eyeColor = o.eye || '#5e3418';

  const sheenColor = rgbToThree(THREE, mixRGB(furRGB, { r: 255, g: 246, b: 232 }, 0.62));
  const creamSheen = rgbToThree(THREE, mixRGB(accRGB, { r: 255, g: 252, b: 246 }, 0.55));

  // Shared fur bump map and procedural coat colour maps
  const furBump = createFurBumpTexture(THREE, kit);
  const headMap = createHeadFurTexture(THREE, kit, furRGB, accRGB, variant);
  const bodyMap = createBodyFurTexture(THREE, kit, furRGB, accRGB, variant);
  const limbMap = createLimbFurTexture(THREE, kit, furRGB, accRGB, variant, false);
  const tailMap = createLimbFurTexture(THREE, kit, furRGB, accRGB, variant, true);

  const headFurMat = new THREE.MeshPhysicalMaterial({
    map: headMap,
    bumpMap: furBump,
    bumpScale: 0.0022,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.68,
    sheenColor
  });

  const bodyFurMat = new THREE.MeshPhysicalMaterial({
    map: bodyMap,
    bumpMap: furBump,
    bumpScale: 0.0024,
    roughness: 0.93,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.68,
    sheenColor
  });

  const limbFurMat = new THREE.MeshPhysicalMaterial({
    map: limbMap,
    bumpMap: furBump,
    bumpScale: 0.0020,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.82,
    sheenRoughness: 0.70,
    sheenColor
  });

  const tailFurMat = new THREE.MeshPhysicalMaterial({
    map: tailMap,
    bumpMap: furBump,
    bumpScale: 0.0026,
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.92,
    sheenRoughness: 0.65,
    sheenColor: creamSheen
  });

  // Paw fur matches the lower end of the limb (creamy sock for variant 1 & 2, warm lighter fur for 0)
  const pawRGB = variant === 0
    ? mixRGB(furRGB, accRGB, 0.22)
    : mixRGB(accRGB, { r: 255, g: 248, b: 238 }, 0.12);
  const pawFurMat = new THREE.MeshPhysicalMaterial({
    color: rgbToThree(THREE, pawRGB),
    bumpMap: furBump,
    bumpScale: 0.0018,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.80,
    sheenRoughness: 0.70,
    sheenColor: creamSheen
  });

  // Outer ear fur (warm fur on both ears for variants 0 & 1; asymmetric spotted ears on variant 2)
  const earOuterMat = new THREE.MeshPhysicalMaterial({
    color: rgbToThree(THREE, scaleRGB(furRGB, 0.94)),
    bumpMap: furBump,
    bumpScale: 0.0022,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.68,
    sheenColor
  });

  const innerEarRGB = mixRGB(accRGB, { r: 242, g: 184, b: 174 }, 0.42);
  const earInnerMat = new THREE.MeshPhysicalMaterial({
    color: rgbToThree(THREE, innerEarRGB),
    bumpMap: furBump,
    bumpScale: 0.0014,
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.75,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xffe8e2)
  });

  const padMat = new THREE.MeshPhysicalMaterial({
    color: 0xd28588,
    roughness: 0.64,
    metalness: 0.0,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xf6c8ca)
  });

  const root = new THREE.Group();
  root.name = 'shibaPuppy';

  // --------------------------------------------------------------------------
  // 1. Sculpted Body
  // --------------------------------------------------------------------------
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.145, -0.012);
  const bodyMesh = new THREE.Mesh(buildBodyGeometry(THREE, kit), bodyFurMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.slot = 'fur';
  bodyGroup.add(bodyMesh);
  bodyGroup.userData.basePos = bodyGroup.position.clone();
  root.add(bodyGroup);

  // --------------------------------------------------------------------------
  // 2. Sculpted Head + Ears + Charming Face
  // --------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.242, 0.092);
  headGroup.rotation.set(0.05, -0.07, 0.13); // Gentle charming tilt toward raised paw

  const headMesh = new THREE.Mesh(buildHeadGeometry(THREE, kit), headFurMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headMesh.userData.slot = 'fur';
  headGroup.add(headMesh);

  // Perky cupped Shiba ears rooted cleanly into the upper skull
  for (const side of [-1, 1]) {
    const ear = buildEar(THREE, earOuterMat, earInnerMat, side);
    const ex = side * 0.54;
    const ey = 0.76;
    const ez = 0.06;
    const len = Math.hypot(ex, ey, ez);
    const ep = sculptHeadPoint(ex / len, ey / len, ez / len, null);
    // Embed ear base slightly into skull so there is zero seam
    ear.position.set(ep.x * 0.90, ep.y * 0.86, ep.z - 0.002);
    ear.rotation.set(0.16, side * 0.24, -side * 0.36);
    ear.userData.baseRot = ear.rotation.clone();
    headGroup.add(ear);
  }

  // Large 3-layer glossy eyes seated inside sculpted sockets
  for (const side of [-1, 1]) {
    const eye = buildEye(THREE, eyeColor, side);
    const ux = side * 0.44;
    const uy = 0.14;
    const uz = 0.887;
    const len = Math.hypot(ux, uy, uz);
    const ep = sculptHeadPoint(ux / len, uy / len, uz / len, null);
    const en = sculptHeadNormal(THREE, ux / len, uy / len, uz / len);
    const lookDir = en.clone().multiplyScalar(0.62).add(new THREE.Vector3(0, 0, 0.38)).normalize();

    eye.position.set(
      ep.x - lookDir.x * 0.0020,
      ep.y - lookDir.y * 0.0020,
      ep.z - lookDir.z * 0.0020
    );
    eye.lookAt(eye.position.clone().add(lookDir));
    headGroup.add(eye);
  }

  // Shaped button nose seated at muzzle tip
  const nose = buildNose(THREE);
  const np = sculptHeadPoint(0, -0.15, 0.988, null);
  nose.position.set(np.x, np.y + 0.001, np.z + 0.0015);
  nose.rotation.x = 0.08;
  headGroup.add(nose);

  // Curved :3 smile mouth + blep tongue
  headGroup.add(buildMouthAndTongue(THREE));

  // Subtle rosy blush discs hugging the sculpted cheeks below the eyes
  const blushTex = createBlushTexture(THREE, kit);
  const blushMat = new THREE.MeshBasicMaterial({
    map: blushTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  const blushGeo = new THREE.CircleGeometry(0.015, 20);
  for (const side of [-1, 1]) {
    const ux = side * 0.64;
    const uy = -0.11;
    const uz = 0.76;
    const len = Math.hypot(ux, uy, uz);
    const bp = sculptHeadPoint(ux / len, uy / len, uz / len, null);
    const bn = sculptHeadNormal(THREE, ux / len, uy / len, uz / len);

    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.position.set(bp.x + bn.x * 0.0016, bp.y + bn.y * 0.0016, bp.z + bn.z * 0.0016);
    blush.lookAt(blush.position.clone().add(bn));
    blush.userData.slot = 'skin';
    headGroup.add(blush);
  }

  headGroup.userData.basePos = headGroup.position.clone();
  headGroup.userData.baseRot = headGroup.rotation.clone();
  root.add(headGroup);

  // --------------------------------------------------------------------------
  // 3. Curled Bushy Shiba Tail (Tapered Tube)
  // --------------------------------------------------------------------------
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0, 0.184, -0.118);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.000, -0.018,  0.022),
    new THREE.Vector3(0.000,  0.006, -0.016),
    new THREE.Vector3(0.006,  0.050, -0.050),
    new THREE.Vector3(0.018,  0.095, -0.026),
    new THREE.Vector3(0.023,  0.092,  0.022),
    new THREE.Vector3(0.015,  0.056,  0.035),
    new THREE.Vector3(0.007,  0.048,  0.006)
  ]);

  const tailGeo = createTaperedTube(
    THREE,
    tailCurve,
    38,
    18,
    (t, angle) => {
      // Plush Shiba plume: slender root, super fluffy middle curl, soft tapered tip
      const base = lerp(0.017, 0.030, smoothstep(0.0, 0.36, t));
      const taper = lerp(1.0, 0.24, smoothstep(0.58, 1.0, t));
      const fluff = 1.0 + 0.07 * Math.sin(angle * 3.0 + t * 9.0) * smoothstep(0.1, 0.5, t);
      return base * taper * fluff;
    },
    { capStart: true, capEnd: true, capRings: 4 }
  );
  const tailMesh = new THREE.Mesh(tailGeo, tailFurMat);
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tailMesh.userData.slot = 'fur';
  tailGroup.add(tailMesh);
  tailGroup.userData.baseRot = tailGroup.rotation.clone();
  root.add(tailGroup);

  // --------------------------------------------------------------------------
  // 4. Four Limbs: 3 Planted on Ground (y = 0), Front-Right Paw Raised!
  // --------------------------------------------------------------------------

  // Front-left standing leg (armL, +x)
  const armL = buildLimb(
    THREE,
    'armL',
    [0.046, 0.132, 0.058],
    [
      [0.000,  0.016, -0.004],
      [0.004, -0.036,  0.004],
      [0.005, -0.084,  0.010],
      [0.004, -0.114,  0.012]
    ],
    (t) => lerp(0.029, 0.0165, smoothstep(0.0, 0.88, t)),
    limbFurMat,
    pawFurMat,
    padMat,
    { pos: [0.004, -0.132, 0.014], rot: [0, 0.06, 0], isStanding: true }
  );
  armL.userData.baseRot = armL.rotation.clone();
  root.add(armL);

  // Front-right RAISED PAW (armR, -x) — lifted forward in a friendly wave!
  const armR = buildLimb(
    THREE,
    'armR',
    [-0.046, 0.136, 0.058],
    [
      [ 0.000,  0.016, -0.006],
      [-0.005, -0.032,  0.024],
      [-0.007, -0.035,  0.066],
      [-0.007, -0.026,  0.092]
    ],
    (t) => lerp(0.029, 0.0165, smoothstep(0.0, 0.90, t)),
    limbFurMat,
    pawFurMat,
    padMat,
    { pos: [-0.007, -0.034, 0.097], rot: [0.76, 0.18, -0.08], isStanding: false }
  );
  armR.userData.baseRot = armR.rotation.clone();
  root.add(armR);

  // Back-left standing hind leg (legL, +x) with natural canine hock bend
  const legL = buildLimb(
    THREE,
    'legL',
    [0.050, 0.134, -0.088],
    [
      [0.000,  0.018,  0.006],
      [0.005, -0.034, -0.018],
      [0.005, -0.072, -0.028],
      [0.004, -0.114, -0.016]
    ],
    (t) => {
      const thigh = lerp(0.034, 0.019, smoothstep(0.0, 0.55, t));
      return lerp(thigh, 0.0165, smoothstep(0.55, 1.0, t));
    },
    limbFurMat,
    pawFurMat,
    padMat,
    { pos: [0.004, -0.134, -0.014], rot: [0, 0.08, 0], isStanding: true }
  );
  legL.userData.baseRot = legL.rotation.clone();
  root.add(legL);

  // Back-right standing hind leg (legR, -x)
  const legR = buildLimb(
    THREE,
    'legR',
    [-0.050, 0.134, -0.084],
    [
      [ 0.000,  0.018,  0.006],
      [-0.005, -0.034, -0.016],
      [-0.005, -0.072, -0.025],
      [-0.004, -0.114, -0.014]
    ],
    (t) => {
      const thigh = lerp(0.034, 0.019, smoothstep(0.0, 0.55, t));
      return lerp(thigh, 0.0165, smoothstep(0.55, 1.0, t));
    },
    limbFurMat,
    pawFurMat,
    padMat,
    { pos: [-0.004, -0.134, -0.012], rot: [0, -0.08, 0], isStanding: true }
  );
  legR.userData.baseRot = legR.rotation.clone();
  root.add(legR);

  // --------------------------------------------------------------------------
  // 5. Optional Cozy Accessory ("none" | "bow" | "scarf")
  // --------------------------------------------------------------------------
  if (accessory === 'scarf') {
    const scarf = buildScarfAccessory(THREE, kit);
    scarf.userData.basePos = scarf.position.clone();
    root.add(scarf);
  } else if (accessory === 'bow') {
    const bow = buildBowAccessory(THREE, kit);
    bow.userData.basePos = bow.position.clone();
    root.add(bow);
  }

  return root;
}

// ============================================================================
// Idle Animation
// ============================================================================

export function idle(group, t) {
  if (!group) return;

  // Soft cozy breathing rhythm (~0.38 Hz)
  const breath = Math.sin(t * 2.4);

  const body = group.getObjectByName('body');
  if (body) {
    body.scale.set(
      1.0 + breath * 0.013,
      1.0 + breath * 0.018,
      1.0 + breath * 0.009
    );
  }

  // Gentle head bob and inquisitive tilt/sway
  const head = group.getObjectByName('head');
  if (head) {
    const bp = head.userData.basePos;
    const br = head.userData.baseRot;
    if (bp) {
      head.position.y = bp.y + breath * 0.0022;
    }
    if (br) {
      head.rotation.x = br.x + Math.sin(t * 1.15 + 0.5) * 0.035;
      head.rotation.y = br.y + Math.sin(t * 0.72) * 0.065;
      head.rotation.z = br.z + Math.sin(t * 0.94 + 1.1) * 0.045;
    }

    // Perky ear sway + occasional cute quick ear flick
    const earL = head.getObjectByName('earL');
    const earR = head.getObjectByName('earR');
    const flickCycle = t % 4.6;
    const flick = flickCycle < 0.22 ? Math.sin((flickCycle / 0.22) * Math.PI) * 0.14 : 0;

    if (earL && earL.userData.baseRot) {
      earL.rotation.z = earL.userData.baseRot.z - Math.sin(t * 1.9) * 0.028 - flick;
      earL.rotation.x = earL.userData.baseRot.x + Math.sin(t * 1.3 + 0.4) * 0.025;
    }
    if (earR && earR.userData.baseRot) {
      earR.rotation.z = earR.userData.baseRot.z + Math.sin(t * 1.9 + 0.6) * 0.028;
      earR.rotation.x = earR.userData.baseRot.x + Math.sin(t * 1.3 + 1.0) * 0.025;
    }

    // Blink every ~3.4 seconds by scaling the eye groups on Y
    const blinkPeriod = 3.4;
    const bt = t % blinkPeriod;
    let eyeScaleY = 1.0;
    if (bt > 3.18 && bt < 3.34) {
      const phase = (bt - 3.18) / 0.16;
      eyeScaleY = 1.0 - Math.sin(phase * Math.PI) * 0.93;
    }
    const eyeL = head.getObjectByName('eyeL');
    const eyeR = head.getObjectByName('eyeR');
    if (eyeL) eyeL.scale.y = eyeScaleY;
    if (eyeR) eyeR.scale.y = eyeScaleY;
  }

  // Happy curled Shiba tail wag
  const tail = group.getObjectByName('tail');
  if (tail && tail.userData.baseRot) {
    tail.rotation.z = tail.userData.baseRot.z + Math.sin(t * 5.2) * 0.15;
    tail.rotation.x = tail.userData.baseRot.x + Math.sin(t * 2.6) * 0.045;
  }

  // Friendly gentle wave on the raised front-right paw
  const armR = group.getObjectByName('armR');
  if (armR && armR.userData.baseRot) {
    armR.rotation.x = armR.userData.baseRot.x + Math.sin(t * 2.3) * 0.075;
    armR.rotation.z = armR.userData.baseRot.z + Math.sin(t * 1.5 + 0.4) * 0.03;
  }

  // Subtle accessory breath lift so scarf/bow rides naturally on the chest
  const acc = group.getObjectByName('accessoryScarf') || group.getObjectByName('accessoryBow');
  if (acc && acc.userData.basePos) {
    acc.position.y = acc.userData.basePos.y + breath * 0.0014;
  }
}