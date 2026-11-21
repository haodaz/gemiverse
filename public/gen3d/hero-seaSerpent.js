export const META = {
  id: 'baby-sea-serpent',
  name: 'Baby Sea Serpent',
  kind: 'creature',
  footprint: [0.34, 0.82],
  variants: ['lagoon', 'midnight', 'kelp', 'blossom'],
  note: 'Cozy stylised baby sea serpent emerging in three smooth water-rippled arches, with a finned head glancing back, scalloped dorsal frills, and a curved leaf-shaped tail fin.'
};

const PALETTES = {
  lagoon: { fur: '#4ca9a0', furAccent: '#f4b89a', eye: '#266d8c' },
  midnight: { fur: '#4360a3', furAccent: '#8ce3d7', eye: '#e3a23d' },
  kelp: { fur: '#689c6d', furAccent: '#f2db88', eye: '#3c7a62' },
  blossom: { fur: '#d8849a', furAccent: '#f7e1b5', eye: '#5e4c94' }
};

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function colorToRgb(THREE, col) {
  const c = new THREE.Color(col);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function rgbaStr(rgb, a = 1) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

// ---------- Procedural Canvas Textures ----------

function makeScaleTextures(THREE, kit, furCol, accentCol) {
  const base = colorToRgb(THREE, furCol);
  const acc = colorToRgb(THREE, accentCol);
  const darkBack = mixRgb(base, [14, 30, 38], 0.34);
  const lightSide = mixRgb(base, [235, 250, 245], 0.16);
  const belly = mixRgb(acc, [252, 244, 228], 0.56);
  const bellyLine = mixRgb(acc, [130, 95, 80], 0.32);
  const spotCol = mixRgb(acc, [255, 250, 238], 0.35);

  const colorMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // u (x) wraps around circumference: 0 & 1 = dorsal spine, 0.5 = belly center
    // v (y) runs along body length
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const bellyDist = Math.abs(u - 0.5) * 2; // 0 at belly, 1 at dorsal spine
      let col;
      if (bellyDist < 0.34) {
        const t = smoothstep(0.18, 0.34, bellyDist);
        col = mixRgb(belly, lightSide, t);
      } else {
        const t = smoothstep(0.34, 0.92, bellyDist);
        col = mixRgb(lightSide, darkBack, t);
      }
      ctx.fillStyle = rgbaStr(col, 1);
      ctx.fillRect(x, 0, 1, h);
    }

    // Soft organic mottling & faint pastel flank bands
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const u = x / w;
        const v = y / h;
        const bellyDist = Math.abs(u - 0.5) * 2;
        if (bellyDist > 0.32) {
          const n = kit.noise(u * 9.0, v * 14.0);
          const band = 0.5 + 0.5 * Math.sin(v * Math.PI * 10 + n * 2.2);
          const alpha = smoothstep(0.32, 0.65, bellyDist) * 0.12 * band;
          ctx.fillStyle = rgbaStr(darkBack, alpha);
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Layered baby-dragon scalloped scales along back and sides
    const rows = 26;
    const cols = 18;
    const rowH = h / rows;
    const colW = w / cols;
    for (let r = -1; r <= rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols + 1; c++) {
        const cx = c * colW + offset;
        const cy = r * rowH;
        const u = ((cx / w) % 1 + 1) % 1;
        const bellyDist = Math.abs(u - 0.5) * 2;
        if (bellyDist < 0.30) continue;

        const fade = smoothstep(0.30, 0.52, bellyDist);
        const rad = colW * 0.52;
        const n = kit.noise(c * 0.73, r * 0.61);

        // Scale highlight fill
        const scCol = mixRgb(base, n > 0.55 ? spotCol : darkBack, 0.14 * Math.abs(n - 0.5) * 2);
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.92, 0, Math.PI, false);
        ctx.fillStyle = rgbaStr(scCol, 0.28 * fade);
        ctx.fill();

        // Soft shaded crescent edge
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.92, 0.12 * Math.PI, 0.88 * Math.PI, false);
        ctx.strokeStyle = rgbaStr(darkBack, 0.32 * fade);
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Delicate pearlescent top sheen
        ctx.beginPath();
        ctx.arc(cx, cy + 1.5, rad * 0.65, 0.22 * Math.PI, 0.78 * Math.PI, false);
        ctx.strokeStyle = rgbaStr(spotCol, 0.18 * fade);
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }

    // Soft glowing flank freckles
    for (let i = 0; i < 42; i++) {
      const side = i % 2 === 0 ? 0.28 : 0.72;
      const u = side + (kit.noise(i * 1.9, 3.1) - 0.5) * 0.11;
      const v = kit.noise(i * 2.7, 8.4);
      const rad = 3.5 + kit.noise(i * 4.1, 1.2) * 5.5;
      const g = ctx.createRadialGradient(u * w, v * h, 0, u * w, v * h, rad);
      g.addColorStop(0, rgbaStr(spotCol, 0.45));
      g.addColorStop(1, rgbaStr(spotCol, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(u * w, v * h, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ventral belly plates (warm soft ribs around u = 0.5)
    const bellyX0 = w * 0.37;
    const bellyW = w * 0.26;
    for (let i = 0; i < 24; i++) {
      const y = (i / 24) * h;
      const g = ctx.createLinearGradient(bellyX0, y, bellyX0 + bellyW, y);
      g.addColorStop(0, rgbaStr(bellyLine, 0));
      g.addColorStop(0.2, rgbaStr(bellyLine, 0.26));
      g.addColorStop(0.5, rgbaStr(bellyLine, 0.34));
      g.addColorStop(0.8, rgbaStr(bellyLine, 0.26));
      g.addColorStop(1, rgbaStr(bellyLine, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(bellyX0, y);
      ctx.quadraticCurveTo(w * 0.5, y + 4.5, bellyX0 + bellyW, y);
      ctx.stroke();
    }
  });
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    const rows = 26;
    const cols = 18;
    const rowH = h / rows;
    const colW = w / cols;
    for (let r = -1; r <= rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols + 1; c++) {
        const cx = c * colW + offset;
        const cy = r * rowH;
        const u = ((cx / w) % 1 + 1) % 1;
        const bellyDist = Math.abs(u - 0.5) * 2;
        if (bellyDist < 0.32) continue;
        const fade = smoothstep(0.32, 0.54, bellyDist);
        const rad = colW * 0.50;

        const g = ctx.createRadialGradient(cx, cy + rad * 0.2, 1, cx, cy + rad * 0.2, rad);
        g.addColorStop(0, `rgba(235,235,235,${0.55 * fade})`);
        g.addColorStop(0.82, `rgba(150,150,150,${0.25 * fade})`);
        g.addColorStop(1, `rgba(55,55,55,${0.55 * fade})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI, false);
        ctx.fill();
      }
    }

    // Soft belly ridges in bump map
    const bellyX0 = w * 0.38;
    const bellyW = w * 0.24;
    for (let i = 0; i < 24; i++) {
      const y = (i / 24) * h;
      ctx.strokeStyle = 'rgba(55,55,55,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bellyX0, y);
      ctx.quadraticCurveTo(w * 0.5, y + 4.5, bellyX0 + bellyW, y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(215,215,215,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bellyX0, y + 3);
      ctx.quadraticCurveTo(w * 0.5, y + 7.5, bellyX0 + bellyW, y + 3);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { colorMap, bumpMap };
}

function makeHeadTextures(THREE, kit, furCol, accentCol) {
  const base = colorToRgb(THREE, furCol);
  const acc = colorToRgb(THREE, accentCol);
  const crown = mixRgb(base, [15, 32, 42], 0.28);
  const softCheek = mixRgb(base, [240, 252, 248], 0.14);
  const chin = mixRgb(acc, [252, 244, 228], 0.58);
  const freckle = mixRgb(acc, [255, 248, 232], 0.45);

  const colorMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // SphereGeometry UV: u=0.25 is +z (snout), y=0 is +y (top of crown), y=h is -y (chin)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbaStr(crown, 1));
    grad.addColorStop(0.32, rgbaStr(base, 1));
    grad.addColorStop(0.56, rgbaStr(softCheek, 1));
    grad.addColorStop(0.74, rgbaStr(chin, 1));
    grad.addColorStop(1.0, rgbaStr(chin, 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Raise warm cream slightly higher under the lower muzzle (u around 0.25)
    const muzzleGrad = ctx.createRadialGradient(w * 0.25, h * 0.68, w * 0.02, w * 0.25, h * 0.66, w * 0.24);
    muzzleGrad.addColorStop(0, rgbaStr(chin, 0.85));
    muzzleGrad.addColorStop(0.6, rgbaStr(chin, 0.35));
    muzzleGrad.addColorStop(1, rgbaStr(chin, 0));
    ctx.fillStyle = muzzleGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle pearlescent forehead & nose-bridge speckles
    const dots = [
      [0.25, 0.32, 9], [0.22, 0.35, 6], [0.28, 0.35, 6],
      [0.20, 0.29, 7], [0.30, 0.29, 7], [0.25, 0.24, 11],
      [0.18, 0.40, 5], [0.32, 0.40, 5], [0.25, 0.41, 5]
    ];
    for (const [u, v, r] of dots) {
      const g = ctx.createRadialGradient(u * w, v * h, 0, u * w, v * h, r);
      g.addColorStop(0, rgbaStr(freckle, 0.48));
      g.addColorStop(1, rgbaStr(freckle, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(u * w, v * h, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle micro-scales on top-back of head
    for (let r = 2; r < 15; r++) {
      const y = (r / 28) * h;
      const fade = smoothstep(0.52, 0.16, y / h);
      for (let c = 0; c < 24; c++) {
        const x = ((c + (r % 2) * 0.5) / 24) * w;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.strokeStyle = rgbaStr(crown, 0.22 * fade);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  });
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n = kit.noise(x * 0.12, y * 0.12);
        const v = Math.round(114 + n * 28);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  });

  return { colorMap, bumpMap };
}

function makeFinTextures(THREE, kit, furCol, accentCol, isLeaf = false) {
  const base = colorToRgb(THREE, furCol);
  const acc = colorToRgb(THREE, accentCol);
  const rim = mixRgb(acc, [255, 248, 236], 0.46);
  const vein = mixRgb(acc, [120, 72, 62], 0.28);

  const colorMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
    // v=0 (bottom of canvas, y=h) is attached base; v=1 (top, y=0) is outer scalloped rim
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, rgbaStr(mixRgb(base, acc, 0.32), 1));
    grad.addColorStop(0.38, rgbaStr(acc, 1));
    grad.addColorStop(0.84, rgbaStr(rim, 1));
    grad.addColorStop(1.0, rgbaStr([255, 250, 242], 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle pearlescent shimmer noise
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.04, y * 0.06);
        if (n > 0.62) {
          ctx.fillStyle = rgbaStr(rim, (n - 0.62) * 0.45);
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    if (isLeaf) {
      // Central leaf-fin midrib and graceful curved lateral veins
      ctx.strokeStyle = rgbaStr(mixRgb(base, acc, 0.45), 0.72);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h);
      ctx.lineTo(w * 0.5, h * 0.12);
      ctx.stroke();

      for (let i = 1; i <= 9; i++) {
        const t = i / 10;
        const y0 = h * (1 - t * 0.85);
        const span = (1 - Math.abs(t - 0.45) * 1.15) * w * 0.42;
        for (const s of [-1, 1]) {
          ctx.strokeStyle = rgbaStr(vein, 0.34);
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(w * 0.5, y0);
          ctx.quadraticCurveTo(w * 0.5 + s * span * 0.55, y0 - 18, w * 0.5 + s * span, y0 - 38);
          ctx.stroke();

          ctx.strokeStyle = rgbaStr(rim, 0.32);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(w * 0.5, y0 - 2);
          ctx.quadraticCurveTo(w * 0.5 + s * span * 0.55, y0 - 20, w * 0.5 + s * span, y0 - 40);
          ctx.stroke();
        }
      }
    } else {
      // Swept delicate fin rays
      const rayCount = 26;
      for (let i = 0; i <= rayCount; i++) {
        const x0 = (i / rayCount) * w;
        const lean = 18 + (kit.noise(i * 0.8, 2.1) - 0.5) * 12;
        ctx.strokeStyle = rgbaStr(vein, 0.32);
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(x0, h);
        ctx.quadraticCurveTo(x0 + lean * 0.4, h * 0.52, x0 + lean, h * 0.06);
        ctx.stroke();

        ctx.strokeStyle = rgbaStr(rim, 0.36);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x0 + 2, h);
        ctx.quadraticCurveTo(x0 + lean * 0.4 + 2, h * 0.52, x0 + lean + 2, h * 0.06);
        ctx.stroke();
      }
    }
  });
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#787878';
    ctx.fillRect(0, 0, w, h);
    if (isLeaf) {
      ctx.strokeStyle = '#dcdcdc';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h);
      ctx.lineTo(w * 0.5, h * 0.12);
      ctx.stroke();
      for (let i = 1; i <= 9; i++) {
        const t = i / 10;
        const y0 = h * (1 - t * 0.85);
        const span = (1 - Math.abs(t - 0.45) * 1.15) * w * 0.42;
        for (const s of [-1, 1]) {
          ctx.strokeStyle = '#c8c8c8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(w * 0.5, y0);
          ctx.quadraticCurveTo(w * 0.5 + s * span * 0.55, y0 - 18, w * 0.5 + s * span, y0 - 38);
          ctx.stroke();
        }
      }
    } else {
      for (let i = 0; i <= 26; i++) {
        const x0 = (i / 26) * w;
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(x0, h);
        ctx.quadraticCurveTo(x0 + 7, h * 0.52, x0 + 18, h * 0.06);
        ctx.stroke();
      }
    }
  });

  return { colorMap, bumpMap };
}

function makeIrisTexture(THREE, kit, eyeCol) {
  const base = colorToRgb(THREE, eyeCol);
  const darkRim = mixRgb(base, [8, 14, 24], 0.72);
  const glowCrescent = mixRgb(base, [235, 252, 255], 0.55);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    // Outer limbal ring and rich iris gradient
    const g = ctx.createRadialGradient(cx, cy, r * 0.18, cx, cy, r);
    g.addColorStop(0.0, '#070a12');
    g.addColorStop(0.46, '#0b111d');
    g.addColorStop(0.50, rgbaStr(base, 1));
    g.addColorStop(0.84, rgbaStr(base, 1));
    g.addColorStop(0.95, rgbaStr(darkRim, 1));
    g.addColorStop(1.0, '#060910');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Warm luminous lower crescent inside the iris
    const cg = ctx.createRadialGradient(cx, cy + r * 0.32, r * 0.05, cx, cy + r * 0.28, r * 0.62);
    cg.addColorStop(0, rgbaStr(glowCrescent, 0.88));
    cg.addColorStop(0.55, rgbaStr(glowCrescent, 0.35));
    cg.addColorStop(1, rgbaStr(glowCrescent, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Fine radial iris fibres
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.strokeStyle = rgbaStr(i % 2 === 0 ? glowCrescent : darkRim, 0.22);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48);
      ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
      ctx.stroke();
    }

    // Crisp glossy dark pupil on top
    ctx.fillStyle = '#070a12';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.02, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit, accentCol) {
  const acc = colorToRgb(THREE, accentCol);
  const rosy = mixRgb(acc, [242, 128, 140], 0.58);
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0, rgbaStr(rosy, 0.62));
    g.addColorStop(0.55, rgbaStr(rosy, 0.28));
    g.addColorStop(1, rgbaStr(rosy, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRippleTextures(THREE, kit, furCol) {
  const base = colorToRgb(THREE, furCol);
  const waterTint = mixRgb(base, [175, 232, 240], 0.72);
  const foam = [245, 253, 255];

  const colorMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = w * 0.5;

    ctx.fillStyle = rgbaStr(waterTint, 1);
    ctx.fillRect(0, 0, w, h);

    // Subtle radial water glow
    const bg = ctx.createRadialGradient(cx, cy, maxR * 0.1, cx, cy, maxR);
    bg.addColorStop(0.0, rgbaStr(foam, 0.9));
    bg.addColorStop(0.32, rgbaStr(mixRgb(waterTint, foam, 0.45), 1));
    bg.addColorStop(0.7, rgbaStr(waterTint, 1));
    bg.addColorStop(1.0, rgbaStr(mixRgb(waterTint, foam, 0.3), 1));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Concentric sparkling ripple rings
    const rings = [
      { r: 0.36, lw: 6.5, a: 0.85 },
      { r: 0.54, lw: 4.0, a: 0.65 },
      { r: 0.73, lw: 3.0, a: 0.48 },
      { r: 0.88, lw: 2.0, a: 0.32 }
    ];
    for (const rg of rings) {
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const ang = (i / 72) * Math.PI * 2;
        const wob = (kit.noise(Math.cos(ang) * 2.4 + rg.r * 5, Math.sin(ang) * 2.4) - 0.5) * 3.0;
        const rr = rg.r * maxR + wob;
        const px = cx + Math.cos(ang) * rr;
        const py = cy + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = rgbaStr(foam, rg.a);
      ctx.lineWidth = rg.lw;
      ctx.stroke();
    }
  });
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const alphaMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = w * 0.5;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(cx, cy, maxR * 0.12, cx, cy, maxR * 0.98);
    g.addColorStop(0.0, 'rgba(220,220,220,1)');
    g.addColorStop(0.40, 'rgba(185,185,185,1)');
    g.addColorStop(0.72, 'rgba(115,115,115,1)');
    g.addColorStop(0.92, 'rgba(42,42,42,1)');
    g.addColorStop(1.0, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Brighter alpha right along the ripple crests
    const rings = [
      { r: 0.36, lw: 7.0, a: 0.92 },
      { r: 0.54, lw: 4.5, a: 0.72 },
      { r: 0.73, lw: 3.5, a: 0.52 },
      { r: 0.88, lw: 2.2, a: 0.30 }
    ];
    for (const rg of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, rg.r * maxR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${rg.a})`;
      ctx.lineWidth = rg.lw;
      ctx.stroke();
    }
  });

  return { colorMap, alphaMap };
}

// ---------- Geometry Helpers ----------

// Compute twist-free anatomical frame along any arch, neck, or tail curve
function getBodyFrame(THREE, curve, t) {
  const pos = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const sideRef = new THREE.Vector3(-1, 0, 0);
  // dorsal = cross(tangent, sideRef) points cleanly outward along convex back of arch / back of neck
  const dorsal = new THREE.Vector3().crossVectors(tangent, sideRef);
  if (dorsal.lengthSq() < 1e-5) {
    dorsal.set(0, 1, 0);
  } else {
    dorsal.normalize();
  }
  const side = new THREE.Vector3().crossVectors(dorsal, tangent).normalize();
  return { pos, tangent, dorsal, side };
}

// Ring-by-ring tapered & organically sculpted tube along CatmullRomCurve3
function buildTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, opts = {}) {
  const {
    floorClamp = false,
    capStart = false,
    capEnd = false,
    organicSection = true,
    vScale = 1.0,
    vOffset = 0.0
  } = opts;

  const positions = [];
  const uvs = [];
  const indices = [];

  const ringStride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const { pos, dorsal, side } = getBodyFrame(THREE, curve, t);
    const r = radiusFn(t);

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2; // 0 = dorsal spine, PI = ventral belly
      const c = Math.cos(theta);
      const s = Math.sin(theta);

      let radDorsal = r;
      let radSide = r;
      if (organicSection) {
        // Subtle rounded dorsal ridge and gently plush, slightly flattened belly
        radSide = r * (1.03 - 0.06 * Math.max(0, c));
        radDorsal = r * (c > 0 ? 1.06 : 0.94);
      }

      const vx = pos.x + dorsal.x * (c * radDorsal) + side.x * (s * radSide);
      let vy = pos.y + dorsal.y * (c * radDorsal) + side.y * (s * radSide);
      const vz = pos.z + dorsal.z * (c * radDorsal) + side.z * (s * radSide);

      if (floorClamp && vy < 0.0008) {
        vy = 0.0008;
      }

      positions.push(vx, vy, vz);
      uvs.push(u, vOffset + t * vScale);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  if (capStart) {
    const p0 = curve.getPointAt(0);
    const centerIdx = positions.length / 3;
    positions.push(p0.x, floorClamp ? Math.max(0.0008, p0.y) : p0.y, p0.z);
    uvs.push(0.5, vOffset);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j, j + 1);
    }
  }

  if (capEnd) {
    const p1 = curve.getPointAt(1);
    const centerIdx = positions.length / 3;
    positions.push(p1.x, floorClamp ? Math.max(0.0008, p1.y) : p1.y, p1.z);
    uvs.push(0.5, vOffset + vScale);
    const baseRing = tubularSegments * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, baseRing + j + 1, baseRing + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Build a scalloped dorsal frill via ExtrudeGeometry + bezierCurveTo, then bend it onto an arch/neck curve
function buildCurvedDorsalFrill(THREE, curve, radiusFn, cfg) {
  const {
    tStart = 0.08,
    tEnd = 0.92,
    lobes = 6,
    maxHeight = 0.036,
    thickness = 0.0036,
    waveAmp = 0.0045,
    waveFreq = 2.5,
    embedRatio = 0.76
  } = cfg;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);

  // Subdivided base edge so extrusion triangles bend cleanly along the curve
  const baseSteps = lobes * 6;
  for (let i = 1; i <= baseSteps; i++) {
    shape.lineTo(i / baseSteps, 0);
  }

  // Graceful scalloped upper silhouette drawn back from x=1 to x=0 using bezierCurveTo
  for (let l = lobes - 1; l >= 0; l--) {
    const x1 = (l + 1) / lobes;
    const x0 = l / lobes;
    const xm = (x0 + x1) * 0.5;

    const env = (x) => Math.pow(Math.sin(clamp(x, 0, 1) * Math.PI), 0.62);
    const hStart = maxHeight * env(x1) * (l === lobes - 1 ? 0.12 : 0.66);
    const hPeak = maxHeight * env(xm) * 1.06;
    const hEnd = maxHeight * env(x0) * (l === 0 ? 0.12 : 0.66);

    if (l === lobes - 1) {
      shape.lineTo(x1, hStart);
    }

    shape.bezierCurveTo(
      x1 - (x1 - xm) * 0.35, hPeak * 1.02,
      xm + (x1 - xm) * 0.25, hPeak * 1.08,
      xm, hPeak
    );
    shape.bezierCurveTo(
      xm - (xm - x0) * 0.35, hPeak * 0.98,
      x0 + (xm - x0) * 0.25, hEnd * 1.18,
      x0, hEnd
    );
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.45,
    bevelSize: 0.0014,
    bevelSegments: 2,
    curveSegments: 10
  });

  // Center thickness around z = 0
  geo.translate(0, 0, -thickness * 0.5);

  const posAttr = geo.attributes.position;
  const uvAttr = geo.attributes.uv;

  for (let i = 0; i < posAttr.count; i++) {
    const vx = clamp(posAttr.getX(i), 0, 1);
    const vy = Math.max(0, posAttr.getY(i));
    const vz = posAttr.getZ(i);

    const t = tStart + vx * (tEnd - tStart);
    const { pos, dorsal, side } = getBodyFrame(THREE, curve, t);
    const r = radiusFn(t);

    const hFrac = clamp(vy / maxHeight, 0, 1);
    // Gentle silky underwater S-wave toward the free edge of the frill
    const ripple = Math.sin(vx * Math.PI * waveFreq * 2 + 0.6) * waveAmp * hFrac * hFrac;
    const lateral = vz * (1.0 - 0.35 * hFrac) + ripple;

    const lift = r * embedRatio + vy;
    // Right-handed mapping: (T, dorsal, -side) preserves outward winding
    const wx = pos.x + dorsal.x * lift - side.x * lateral;
    const wy = pos.y + dorsal.y * lift - side.y * lateral;
    const wz = pos.z + dorsal.z * lift - side.z * lateral;

    posAttr.setXYZ(i, wx, wy, wz);
    uvAttr.setXY(i, vx, hFrac);
  }

  geo.computeVertexNormals();
  return geo;
}

// Build a curved cheek/ear fin via ExtrudeGeometry + bezierCurveTo + 3D vertex bending
function buildEarFinGeometry(THREE, scale = 1.0) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.007 * scale);
  // Flowing 3-lobe sea-dragon / betta cheek fin
  shape.bezierCurveTo(
    0.015 * scale, -0.014 * scale,
    0.036 * scale, -0.016 * scale,
    0.048 * scale, -0.006 * scale
  );
  shape.bezierCurveTo(
    0.044 * scale, -0.001 * scale,
    0.056 * scale, 0.002 * scale,
    0.062 * scale, 0.011 * scale
  );
  shape.bezierCurveTo(
    0.052 * scale, 0.015 * scale,
    0.058 * scale, 0.023 * scale,
    0.050 * scale, 0.030 * scale
  );
  shape.bezierCurveTo(
    0.036 * scale, 0.031 * scale,
    0.018 * scale, 0.024 * scale,
    0.0, 0.011 * scale
  );
  shape.closePath();

  const depth = 0.0026 * scale;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0012 * scale,
    bevelSize: 0.0012 * scale,
    bevelSegments: 2,
    curveSegments: 14
  });
  geo.translate(0, 0, -depth * 0.5);

  const posAttr = geo.attributes.position;
  const uvAttr = geo.attributes.uv;
  const maxX = 0.064 * scale;
  const maxY = 0.032 * scale;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const u = clamp(x / maxX, 0, 1);
    const v = clamp((y + 0.016 * scale) / (maxY + 0.016 * scale), 0, 1);

    // Graceful swept-back curve and subtle cupped surface
    const sweepBack = -Math.pow(u, 1.55) * 0.028 * scale;
    const cup = Math.sin(v * Math.PI) * 0.0055 * scale * u;
    const thinZ = z * (1.0 - 0.45 * u);

    posAttr.setXYZ(i, x, y + Math.pow(u, 1.7) * 0.006 * scale, thinZ + sweepBack + cup);
    uvAttr.setXY(i, v, u);
  }

  geo.computeVertexNormals();
  return geo;
}

// Build a curved aquatic leaf-shaped tail fin via ExtrudeGeometry + bezierCurveTo + vertex bending
function buildLeafTailFinGeometry(THREE) {
  const L = 0.112;
  const W = 0.044;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);

  // Right scalloped aquatic leaf edge
  shape.bezierCurveTo(W * 0.48, L * 0.12, W * 0.96, L * 0.28, W * 0.98, L * 0.46);
  shape.bezierCurveTo(W * 1.00, L * 0.64, W * 0.66, L * 0.84, 0, L);

  // Left scalloped aquatic leaf edge
  shape.bezierCurveTo(-W * 0.66, L * 0.84, -W * 1.00, L * 0.64, -W * 0.98, L * 0.46);
  shape.bezierCurveTo(-W * 0.96, L * 0.28, -W * 0.48, L * 0.12, 0, 0);
  shape.closePath();

  const depth = 0.0032;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0014,
    bevelSegments: 2,
    curveSegments: 18
  });
  geo.translate(0, 0, -depth * 0.5);

  const posAttr = geo.attributes.position;
  const uvAttr = geo.attributes.uv;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const v = clamp(y / L, 0, 1);
    const u = clamp(x / (W * 2) + 0.5, 0, 1);
    const edgeFactor = Math.abs(x) / W;

    // Gentle S-curve droop and soft leaf cupping + flutter along edges
    const curlZ = Math.sin(v * Math.PI * 1.15) * 0.015 - Math.pow(v, 2.2) * 0.012;
    const cup = (1.0 - edgeFactor * edgeFactor) * 0.0055 * Math.sin(v * Math.PI);
    const edgeWave = Math.sin(v * Math.PI * 3.0) * 0.0028 * edgeFactor;
    const thinZ = z * (1.0 - 0.5 * v);

    posAttr.setXYZ(i, x, y, thinZ + curlZ + cup + edgeWave);
    uvAttr.setXY(i, u, v);
  }

  geo.computeVertexNormals();
  return geo;
}

// Rotational translucent water ripple disc via LatheGeometry (20 profile points)
function buildRippleDiscGeometry(THREE) {
  const pts = [];
  const profileSteps = 20;
  for (let i = 0; i <= profileSteps; i++) {
    const t = i / profileSteps; // 0 = center, 1 = outer rim
    const r = 0.01 + t * 0.99;
    // Slight raised meniscus near r=0.35 where body enters, decaying concentric ripples outward
    const meniscus = Math.exp(-Math.pow((t - 0.34) / 0.10, 2)) * 0.0042;
    const waves =
      Math.sin(t * Math.PI * 6.5) * 0.0014 * smoothstep(0.18, 0.38, t) * (1.0 - smoothstep(0.68, 1.0, t));
    const y = Math.max(0.0004, 0.001 + meniscus + waves);
    pts.push(new THREE.Vector2(r, y));
  }

  const geo = new THREE.LatheGeometry(pts, 40);
  // Remap UVs to planar top-down disc coordinates [0, 1] x [0, 1]
  const posAttr = geo.attributes.position;
  const uvAttr = geo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    uvAttr.setXY(i, x * 0.5 + 0.5, z * 0.5 + 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- Sculpted Head Surface Evaluator ----------

// Continuous analytical sculpting function for the baby sea serpent head
// Used both to deform the dense sphere AND to nestle eyes, smile, nostrils, blush, and fins on the exact surface
function evalHeadPoint(nx, ny, nz) {
  let x = nx * 0.043;
  let y = ny * 0.039;
  let z = nz * 0.050;

  // 1. Soft rounded chibi snout protruding gently forward (+z)
  const snout = smoothstep(0.10, 0.96, nz);
  const snoutTaper = 1.0 - 0.32 * snout;
  x *= snoutTaper;
  z += 0.010 * snout;
  // Adorable forehead-to-nose stop (scooped upper bridge, plump lower muzzle)
  const bridgeScoop = smoothstep(0.18, 0.85, nz) * smoothstep(0.08, 0.65, ny);
  y -= 0.0068 * bridgeScoop;
  // Slightly lifted cute nose tip
  const noseTip = smoothstep(0.75, 1.0, nz) * smoothstep(-0.3, 0.35, ny);
  y += 0.0024 * noseTip;

  // 2. Plump baby cheeks on ±x
  const cheekL = Math.max(0, nx * 0.78 - ny * 0.22 + nz * 0.34);
  const cheekR = Math.max(0, -nx * 0.78 - ny * 0.22 + nz * 0.34);
  const cheek = Math.pow(Math.max(cheekL, cheekR), 3.4);
  x += Math.sign(nx) * 0.0072 * cheek;
  y -= 0.0018 * cheek;

  // 3. High domed cranium & gentle expressive brow puffs
  const dome = smoothstep(0.15, 0.95, ny) * smoothstep(0.35, -0.55, nz);
  y += 0.0042 * dome;

  const browDirL = [0.46, 0.50, 0.73];
  const browDirR = [-0.46, 0.50, 0.73];
  const dBrow = Math.max(
    nx * browDirL[0] + ny * browDirL[1] + nz * browDirL[2],
    nx * browDirR[0] + ny * browDirR[1] + nz * browDirR[2]
  );
  const browPuff = smoothstep(0.84, 0.99, dBrow);
  x += nx * 0.0024 * browPuff;
  y += 0.0026 * browPuff;
  z += 0.0016 * browPuff;

  // 4. Sculpted eye socket recesses so large glossy eyes sit nestled IN the face
  const eyeDirL = [0.63, 0.16, 0.76];
  const eyeDirR = [-0.63, 0.16, 0.76];
  const dEye = Math.max(
    nx * eyeDirL[0] + ny * eyeDirL[1] + nz * eyeDirL[2],
    nx * eyeDirR[0] + ny * eyeDirR[1] + nz * eyeDirR[2]
  );
  const socket = smoothstep(0.86, 0.985, dEye);
  x -= nx * 0.0046 * socket;
  y -= ny * 0.0042 * socket;
  z -= nz * 0.0046 * socket;

  // 5. Softly flattened chin & neck-blend underside
  if (ny < -0.18) {
    const chinFlat = smoothstep(-0.18, -0.88, ny);
    y += 0.0045 * chinFlat * smoothstep(-0.1, 0.7, nz);
    // Pull lower-back cranium slightly down to merge deeply with the neck
    const neckJoin = chinFlat * smoothstep(0.15, -0.65, nz);
    y -= 0.0055 * neckJoin;
  }

  return [x, y, z];
}

function buildSculptedHeadGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const nx = posAttr.getX(i);
    const ny = posAttr.getY(i);
    const nz = posAttr.getZ(i);
    const [x, y, z] = evalHeadPoint(nx, ny, nz);
    posAttr.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Build a curved blush patch conforming tightly to the cheek surface
function buildCheekBlushPatch(THREE, sideSign) {
  const geo = new THREE.PlaneGeometry(1, 1, 8, 8);
  const posAttr = geo.attributes.position;
  const centerDir = new THREE.Vector3(sideSign * 0.78, -0.16, 0.59).normalize();
  const upRef = new THREE.Vector3(0, 1, 0);
  const tangU = new THREE.Vector3().crossVectors(upRef, centerDir).normalize();
  const tangV = new THREE.Vector3().crossVectors(centerDir, tangU).normalize();

  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i) * 0.30;
    const py = posAttr.getY(i) * 0.21;
    const d = centerDir
      .clone()
      .addScaledVector(tangU, px)
      .addScaledVector(tangV, py)
      .normalize();
    const [x, y, z] = evalHeadPoint(d.x, d.y, d.z);
    // Lift 0.6 mm off the cheek surface so there is no z-fighting
    posAttr.setXYZ(i, x + d.x * 0.0006, y + d.y * 0.0006, z + d.z * 0.0006);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- Main Exported Builder ----------

export function build(THREE, opts = {}, kit) {
  const variantName = PALETTES[opts.variant] ? opts.variant : 'lagoon';
  const basePal = PALETTES[variantName];
  const furCol = opts.fur || basePal.fur;
  const accentCol = opts.furAccent || basePal.furAccent;
  const eyeCol = opts.eye || basePal.eye;

  const root = new THREE.Group();
  root.name = 'baby-sea-serpent';

  // Textures derived from opts
  const scaleTex = makeScaleTextures(THREE, kit, furCol, accentCol);
  const headTex = makeHeadTextures(THREE, kit, furCol, accentCol);
  const finTex = makeFinTextures(THREE, kit, furCol, accentCol, false);
  const leafTex = makeFinTextures(THREE, kit, furCol, accentCol, true);
  const irisTex = makeIrisTexture(THREE, kit, eyeCol);
  const blushTex = makeBlushTexture(THREE, kit, accentCol);
  const rippleTex = makeRippleTextures(THREE, kit, furCol);

  const furSheen = new THREE.Color(furCol).lerp(new THREE.Color('#ffffff'), 0.62);
  const accentSheen = new THREE.Color(accentCol).lerp(new THREE.Color('#ffffff'), 0.65);

  // Shared Materials (MeshPhysicalMaterial)
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: scaleTex.colorMap,
    bumpMap: scaleTex.bumpMap,
    bumpScale: 0.0018,
    roughness: 0.44,
    metalness: 0.0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.36,
    sheen: 0.62,
    sheenRoughness: 0.65,
    sheenColor: furSheen
  });

  const headMat = new THREE.MeshPhysicalMaterial({
    map: headTex.colorMap,
    bumpMap: headTex.bumpMap,
    bumpScale: 0.0009,
    roughness: 0.46,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.40,
    sheen: 0.65,
    sheenRoughness: 0.68,
    sheenColor: furSheen
  });

  const finMat = new THREE.MeshPhysicalMaterial({
    map: finTex.colorMap,
    bumpMap: finTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.32,
    sheen: 0.78,
    sheenRoughness: 0.55,
    sheenColor: accentSheen,
    emissive: new THREE.Color(accentCol),
    emissiveIntensity: 0.09
  });

  const leafFinMat = new THREE.MeshPhysicalMaterial({
    map: leafTex.colorMap,
    bumpMap: leafTex.bumpMap,
    bumpScale: 0.0014,
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.30,
    sheen: 0.78,
    sheenRoughness: 0.52,
    sheenColor: accentSheen,
    emissive: new THREE.Color(accentCol),
    emissiveIntensity: 0.10
  });

  const eyeOuterMat = new THREE.MeshPhysicalMaterial({
    color: '#0c121e',
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.10,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.06
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 0.7,
    roughness: 0.05
  });

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(furCol).lerp(new THREE.Color('#231820'), 0.76),
    roughness: 0.52,
    clearcoat: 0.2
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushTex,
    transparent: true,
    depthWrite: false,
    roughness: 0.85,
    sheen: 0.5,
    sheenColor: accentSheen
  });

  const rippleMat = new THREE.MeshPhysicalMaterial({
    map: rippleTex.colorMap,
    alphaMap: rippleTex.alphaMap,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide
  });

  // =========================================================================
  // 1. BODY GROUP (Neck + Three Smooth Arches + Scalloped Dorsal Frills)
  // =========================================================================
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  root.add(bodyGroup);

  // Track every water entry/exit point for the ripple discs
  const waterContacts = [];

  // --- Graceful S-Curved Neck rising from floor ---
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.032, -0.008, 0.345),
    new THREE.Vector3(-0.038, 0.068, 0.376),
    new THREE.Vector3(-0.028, 0.146, 0.368),
    new THREE.Vector3(-0.017, 0.208, 0.346)
  ]);
  const neckRadius = (t) => 0.036 - 0.011 * smoothstep(0.0, 0.92, t) - 0.002 * Math.sin(t * Math.PI);
  const neckGeo = buildTaperedTube(THREE, neckCurve, 30, 28, neckRadius, {
    floorClamp: true,
    capEnd: true,
    vScale: 0.85,
    vOffset: 0.0
  });
  const neckMesh = new THREE.Mesh(neckGeo, bodyMat);
  neckMesh.userData.slot = 'fur';
  bodyGroup.add(neckMesh);
  waterContacts.push({ x: -0.032, z: 0.345, r: 0.072 });

  // Neck dorsal frill running gracefully down the back of the neck
  const neckFrillGeo = buildCurvedDorsalFrill(THREE, neckCurve, neckRadius, {
    tStart: 0.10,
    tEnd: 0.86,
    lobes: 5,
    maxHeight: 0.028,
    thickness: 0.0032,
    waveAmp: 0.0032,
    waveFreq: 2.0,
    embedRatio: 0.74
  });
  const neckFrillMesh = new THREE.Mesh(neckFrillGeo, finMat);
  neckFrillMesh.userData.slot = 'furAccent';
  bodyGroup.add(neckFrillMesh);

  // --- Three Smooth Body Arches rising from the floor ---
  const archSpecs = [
    {
      pts: [
        [0.024, -0.008, 0.258],
        [0.045, 0.080, 0.232],
        [0.058, 0.136, 0.168],
        [0.044, 0.080, 0.104],
        [0.022, -0.008, 0.078]
      ],
      radiusFn: (t) => 0.037 + 0.006 * Math.sin(t * Math.PI) - 0.002 * t,
      lobes: 6,
      frillH: 0.036,
      vScale: 1.15,
      vOffset: 0.15,
      rippleA: 0.072,
      rippleB: 0.068
    },
    {
      pts: [
        [-0.024, -0.008, 0.002],
        [-0.044, 0.064, -0.022],
        [-0.056, 0.106, -0.076],
        [-0.043, 0.062, -0.128],
        [-0.024, -0.008, -0.152]
      ],
      radiusFn: (t) => 0.032 + 0.005 * Math.sin(t * Math.PI) - 0.002 * t,
      lobes: 5,
      frillH: 0.031,
      vScale: 0.98,
      vOffset: 0.45,
      rippleA: 0.062,
      rippleB: 0.058
    },
    {
      pts: [
        [0.018, -0.008, -0.212],
        [0.034, 0.046, -0.230],
        [0.044, 0.076, -0.268],
        [0.033, 0.044, -0.305],
        [0.016, -0.008, -0.324]
      ],
      radiusFn: (t) => 0.025 + 0.004 * Math.sin(t * Math.PI) - 0.002 * t,
      lobes: 4,
      frillH: 0.025,
      vScale: 0.78,
      vOffset: 0.75,
      rippleA: 0.052,
      rippleB: 0.048
    }
  ];

  for (let i = 0; i < archSpecs.length; i++) {
    const sp = archSpecs[i];
    const curve = new THREE.CatmullRomCurve3(sp.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));

    const archGeo = buildTaperedTube(THREE, curve, 38 - i * 4, 28 - i * 2, sp.radiusFn, {
      floorClamp: true,
      vScale: sp.vScale,
      vOffset: sp.vOffset
    });
    const archMesh = new THREE.Mesh(archGeo, bodyMat);
    archMesh.userData.slot = 'fur';
    bodyGroup.add(archMesh);

    const frillGeo = buildCurvedDorsalFrill(THREE, curve, sp.radiusFn, {
      tStart: 0.07,
      tEnd: 0.93,
      lobes: sp.lobes,
      maxHeight: sp.frillH,
      thickness: 0.0036 - i * 0.0004,
      waveAmp: 0.0045 - i * 0.0006,
      waveFreq: 2.0 + i * 0.25,
      embedRatio: 0.76
    });
    const frillMesh = new THREE.Mesh(frillGeo, finMat);
    frillMesh.userData.slot = 'furAccent';
    bodyGroup.add(frillMesh);

    const pStart = sp.pts[0];
    const pEnd = sp.pts[sp.pts.length - 1];
    waterContacts.push({ x: pStart[0], z: pStart[2], r: sp.rippleA });
    waterContacts.push({ x: pEnd[0], z: pEnd[2], r: sp.rippleB });
  }

  // =========================================================================
  // 2. HEAD GROUP (Sculpted Continuous Head Looking Back + Face + Ear Fins)
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(-0.016, 0.214, 0.344);
  // Looking gracefully back over its shoulder toward its gleaming arches (and 3/4 viewer)
  headGroup.rotation.set(0.15, 1.92, -0.14);
  headGroup.userData.basePos = [headGroup.position.x, headGroup.position.y, headGroup.position.z];
  headGroup.userData.baseRot = [headGroup.rotation.x, headGroup.rotation.y, headGroup.rotation.z];
  root.add(headGroup);

  const headMesh = new THREE.Mesh(buildSculptedHeadGeometry(THREE), headMat);
  headMesh.userData.slot = 'fur';
  headGroup.add(headMesh);

  // Soft crown crest fin swept along the top-back of the sculpted head
  const crownPts = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    const ang = -0.15 + u * 1.45; // top-front forehead sweeping over crown down back of skull
    const ny = Math.cos(ang);
    const nz = -Math.sin(ang);
    const [x, y, z] = evalHeadPoint(0, ny, nz);
    crownPts.push(new THREE.Vector3(x, y, z));
  }
  const crownCurve = new THREE.CatmullRomCurve3(crownPts);
  const crownGeo = buildCurvedDorsalFrill(THREE, crownCurve, () => 0.002, {
    tStart: 0.05,
    tEnd: 0.95,
    lobes: 3,
    maxHeight: 0.022,
    thickness: 0.0026,
    waveAmp: 0.0018,
    waveFreq: 1.5,
    embedRatio: -1.8 // embed cleanly into the sculpted skull
  });
  const crownMesh = new THREE.Mesh(crownGeo, finMat);
  crownMesh.userData.slot = 'furAccent';
  headGroup.add(crownMesh);

  // --- Three-Layer Glossy Eyes (eyeL & eyeR for blink animation) ---
  const eyeOuterGeo = new THREE.SphereGeometry(0.0126, 24, 18);
  eyeOuterGeo.scale(1.0, 1.06, 0.72);
  const irisGeo = new THREE.CircleGeometry(0.0102, 24);
  const hlBigGeo = new THREE.SphereGeometry(0.0028, 12, 10);
  const hlSmallGeo = new THREE.SphereGeometry(0.0013, 10, 8);

  for (const sideSign of [1, -1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = sideSign > 0 ? 'eyeL' : 'eyeR';

    const dir = new THREE.Vector3(sideSign * 0.63, 0.16, 0.76).normalize();
    const [sx, sy, sz] = evalHeadPoint(dir.x, dir.y, dir.z);
    // Nestle slightly inset into the sculpted eye socket
    eyeGroup.position.set(sx - dir.x * 0.0032, sy - dir.y * 0.0032, sz - dir.z * 0.0032);
    eyeGroup.lookAt(
      eyeGroup.position.x + dir.x,
      eyeGroup.position.y + dir.y,
      eyeGroup.position.z + dir.z
    );

    // Layer 1: Dark glossy outer eye with clearcoat
    const outerEye = new THREE.Mesh(eyeOuterGeo, eyeOuterMat);
    eyeGroup.add(outerEye);

    // Layer 2: Coloured iris ring sitting cleanly just inside the glossy cornea curvature
    const irisMesh = new THREE.Mesh(irisGeo, irisMat);
    irisMesh.position.z = 0.0086;
    irisMesh.userData.slot = 'eye';
    eyeGroup.add(irisMesh);

    // Layer 3: Two crisp white catchlight highlight dots placed up and to one side
    const hlBig = new THREE.Mesh(hlBigGeo, highlightMat);
    hlBig.position.set(-0.0032 * sideSign, 0.0044, 0.0092);
    hlBig.scale.set(1.0, 1.0, 0.45);
    eyeGroup.add(hlBig);

    const hlSmall = new THREE.Mesh(hlSmallGeo, highlightMat);
    hlSmall.position.set(0.0034 * sideSign, -0.0030, 0.0090);
    hlSmall.scale.set(1.0, 1.0, 0.45);
    eyeGroup.add(hlSmall);

    // Delicate curved upper lash / eyelid rim hugging the top of the eye
    const lashPts = [];
    for (let k = 0; k <= 8; k++) {
      const a = -0.35 + (k / 8) * (Math.PI + 0.55);
      const lx = Math.cos(a) * 0.0132 * sideSign;
      const ly = Math.sin(a) * 0.0138 + 0.0005;
      const lz = 0.0045 - Math.abs(k / 8 - 0.5) * 0.0035;
      lashPts.push(new THREE.Vector3(lx, ly, lz));
    }
    const lashCurve = new THREE.CatmullRomCurve3(lashPts);
    const lashGeo = buildTaperedTube(
      THREE,
      lashCurve,
      14,
      8,
      (t) => 0.0014 * Math.sin(t * Math.PI) + 0.0004,
      { organicSection: false }
    );
    const lashMesh = new THREE.Mesh(lashGeo, mouthMat);
    eyeGroup.add(lashMesh);

    headGroup.add(eyeGroup);
  }

  // --- Curved Sweet Smile Tube hugging the sculpted muzzle ---
  const smilePts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const ang = (u - 0.5) * 1.38;
    // Gentle cozy ":3"-hinted upturned baby sea-serpent smile
    const d = new THREE.Vector3(
      Math.sin(ang) * 0.72,
      -0.25 + 0.14 * Math.pow(Math.abs(ang) / 0.69, 2.0) - 0.035 * Math.cos(ang * 3.0),
      Math.cos(ang) * 0.78 + 0.26
    ).normalize();
    const [sx, sy, sz] = evalHeadPoint(d.x, d.y, d.z);
    smilePts.push(new THREE.Vector3(sx + d.x * 0.0007, sy + d.y * 0.0007, sz + d.z * 0.0007));
  }
  const smileCurve = new THREE.CatmullRomCurve3(smilePts);
  const smileGeo = buildTaperedTube(
    THREE,
    smileCurve,
    20,
    8,
    (t) => 0.0011 * (0.45 + 0.55 * Math.sin(t * Math.PI)),
    { organicSection: false, capStart: true, capEnd: true }
  );
  const smileMesh = new THREE.Mesh(smileGeo, mouthMat);
  headGroup.add(smileMesh);

  // --- Tiny Sculpted Nostril Accents ---
  const nostrilGeo = new THREE.SphereGeometry(0.0018, 10, 8);
  nostrilGeo.scale(0.8, 0.55, 1.2);
  for (const s of [1, -1]) {
    const d = new THREE.Vector3(s * 0.22, 0.07, 0.97).normalize();
    const [nx, ny, nz] = evalHeadPoint(d.x, d.y, d.z);
    const nost = new THREE.Mesh(nostrilGeo, mouthMat);
    nost.position.set(nx - d.x * 0.0004, ny - d.y * 0.0004, nz - d.z * 0.0004);
    nost.rotation.set(0.2, s * 0.3, s * -0.25);
    headGroup.add(nost);
  }

  // --- Subtle Rosy Cheek Blush Discs conforming to cheeks ---
  for (const s of [1, -1]) {
    const blushMesh = new THREE.Mesh(buildCheekBlushPatch(THREE, s), blushMat);
    blushMesh.userData.slot = 'furAccent';
    headGroup.add(blushMesh);
  }

  // --- Delicate Baby Sea-Dragon Cheek Barbels / Whiskers (tapered tubes) ---
  for (const s of [1, -1]) {
    const d0 = new THREE.Vector3(s * 0.72, -0.18, 0.66).normalize();
    const [bx, by, bz] = evalHeadPoint(d0.x, d0.y, d0.z);
    const wCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx - d0.x * 0.003, by, bz - d0.z * 0.003),
      new THREE.Vector3(bx + s * 0.015, by - 0.004, bz - 0.006),
      new THREE.Vector3(bx + s * 0.028, by - 0.008, bz - 0.022),
      new THREE.Vector3(bx + s * 0.032, by - 0.004, bz - 0.038)
    ]);
    const wGeo = buildTaperedTube(
      THREE,
      wCurve,
      16,
      8,
      (t) => 0.0024 * (1.0 - 0.78 * t),
      { organicSection: false, capEnd: true }
    );
    const wMesh = new THREE.Mesh(wGeo, finMat);
    wMesh.userData.slot = 'furAccent';
    headGroup.add(wMesh);
  }

  // --- Side Head Fins (earL & earR for gentle underwater flutter animation) ---
  const mainEarGeo = buildEarFinGeometry(THREE, 1.0);
  const subEarGeo = buildEarFinGeometry(THREE, 0.62);

  for (const s of [1, -1]) {
    const earGroup = new THREE.Group();
    earGroup.name = s > 0 ? 'earL' : 'earR';

    const anchorDir = new THREE.Vector3(s * 0.88, 0.14, -0.26).normalize();
    const [ex, ey, ez] = evalHeadPoint(anchorDir.x, anchorDir.y, anchorDir.z);
    // Embed root slightly inside the sculpted temple for a seamless transition
    earGroup.position.set(ex - anchorDir.x * 0.005, ey - anchorDir.y * 0.004, ez - anchorDir.z * 0.004);
    earGroup.rotation.set(0.14, s > 0 ? 0.32 : Math.PI - 0.32, s > 0 ? 0.22 : -0.22);

    const mainFin = new THREE.Mesh(mainEarGeo, finMat);
    mainFin.userData.slot = 'furAccent';
    if (s < 0) {
      // Mirror cleanly on Z so swept-back curve matches on both sides
      mainFin.scale.z = -1;
    }
    earGroup.add(mainFin);

    // Smaller lower layered cheek finlet
    const subFin = new THREE.Mesh(subEarGeo, finMat);
    subFin.position.set(0.001, -0.015, s > 0 ? 0.005 : -0.005);
    subFin.rotation.z = -0.34;
    if (s < 0) {
      subFin.scale.z = -1;
    }
    subFin.userData.slot = 'furAccent';
    earGroup.add(subFin);

    earGroup.userData.baseRot = [earGroup.rotation.x, earGroup.rotation.y, earGroup.rotation.z];
    headGroup.add(earGroup);
  }

  // =========================================================================
  // 3. TAIL GROUP (Curled Tapered Tail + Curved Leaf-Shaped Tail Fin)
  // =========================================================================
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(-0.016, 0.0, -0.362);
  tailGroup.userData.baseRot = [0, 0, 0];
  root.add(tailGroup);

  waterContacts.push({ x: -0.016, z: -0.362, r: 0.046 });

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, -0.006, 0.0),
    new THREE.Vector3(-0.014, 0.036, -0.014),
    new THREE.Vector3(-0.028, 0.078, -0.022),
    new THREE.Vector3(-0.032, 0.112, -0.036)
  ]);
  const tailRadius = (t) => 0.020 * (1.0 - 0.72 * t) + 0.0025 * Math.sin(t * Math.PI);
  const tailTubeGeo = buildTaperedTube(THREE, tailCurve, 26, 22, tailRadius, {
    floorClamp: true,
    capEnd: true,
    vScale: 0.65,
    vOffset: 0.2
  });
  const tailMesh = new THREE.Mesh(tailTubeGeo, bodyMat);
  tailMesh.userData.slot = 'fur';
  tailGroup.add(tailMesh);

  // Small tapered dorsal tail-ridge frill flowing up into the leaf fin
  const tailFrillGeo = buildCurvedDorsalFrill(THREE, tailCurve, tailRadius, {
    tStart: 0.12,
    tEnd: 0.85,
    lobes: 3,
    maxHeight: 0.015,
    thickness: 0.0024,
    waveAmp: 0.0020,
    waveFreq: 1.5,
    embedRatio: 0.72
  });
  const tailFrillMesh = new THREE.Mesh(tailFrillGeo, finMat);
  tailFrillMesh.userData.slot = 'furAccent';
  tailGroup.add(tailFrillMesh);

  // Leaf-shaped tail fin overlapping seamlessly onto the curled tail tip
  const tailEnd = tailCurve.getPointAt(0.94);
  const tailTan = tailCurve.getTangentAt(0.96).normalize();
  const leafPivot = new THREE.Group();
  leafPivot.position.copy(tailEnd);
  leafPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tailTan);
  // Tilt slightly for an asymmetric playful 3/4 silhouette
  leafPivot.rotateY(0.42);
  leafPivot.rotateX(-0.26);

  const leafMesh = new THREE.Mesh(buildLeafTailFinGeometry(THREE), leafFinMat);
  leafMesh.position.y = -0.008; // Overlap deeply with tail stem
  leafMesh.userData.slot = 'furAccent';
  leafPivot.add(leafMesh);

  // Sculpted central midrib stem tapering smoothly into the leaf fin
  const midribCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.010, 0),
    new THREE.Vector3(0, 0.028, 0.010),
    new THREE.Vector3(0, 0.068, 0.013)
  ]);
  const midribGeo = buildTaperedTube(THREE, midribCurve, 12, 10, (t) => 0.0052 * (1.0 - 0.78 * t), {
    organicSection: false,
    capEnd: true
  });
  const midribMesh = new THREE.Mesh(midribGeo, bodyMat);
  midribMesh.userData.slot = 'fur';
  leafPivot.add(midribMesh);

  tailGroup.add(leafPivot);

  // =========================================================================
  // 4. TRANSLUCENT WATER RIPPLE DISCS (Under Every Floor Contact)
  // =========================================================================
  const ripplesGroup = new THREE.Group();
  ripplesGroup.name = 'ripples';
  root.add(ripplesGroup);

  const sharedRippleGeo = buildRippleDiscGeometry(THREE);

  for (let i = 0; i < waterContacts.length; i++) {
    const wc = waterContacts[i];
    const disc = new THREE.Mesh(sharedRippleGeo, rippleMat);
    // Tiny vertical stagger eliminates any z-fighting where neighboring water rings softly meet
    disc.position.set(wc.x, 0.0004 + i * 0.00022, wc.z);
    disc.scale.set(wc.r, 1.0, wc.r * 1.06);
    disc.rotation.y = i * 1.37;
    disc.renderOrder = 10 + i;
    disc.userData.slot = 'accent';
    disc.userData.baseScale = [wc.r, 1.0, wc.r * 1.06];
    disc.userData.phase = i * 0.75;
    ripplesGroup.add(disc);
  }

  return root;
}

// ---------- Idle Animation ----------

export function idle(group, t) {
  const breath = Math.sin(t * 2.1);

  const body = group.getObjectByName('body');
  if (body) {
    body.scale.y = 1.0 + 0.018 * breath;
    body.position.y = 0.0018 * breath;
  }

  const head = group.getObjectByName('head');
  if (head) {
    const bp = head.userData.basePos || [-0.016, 0.214, 0.344];
    const br = head.userData.baseRot || [0.15, 1.92, -0.14];
    head.position.y = bp[1] + 0.0038 * breath;
    head.rotation.x = br[0] + 0.045 * Math.sin(t * 1.35 + 0.4);
    head.rotation.y = br[1] + 0.075 * Math.sin(t * 0.85);
    head.rotation.z = br[2] + 0.055 * Math.sin(t * 1.15 + 1.1);

    // Subtle underwater flutter on cheek/ear fins
    const earL = head.getObjectByName('earL');
    const earR = head.getObjectByName('earR');
    if (earL) {
      const er = earL.userData.baseRot || [0.14, 0.32, 0.22];
      earL.rotation.y = er[1] + 0.14 * Math.sin(t * 3.1);
      earL.rotation.z = er[2] + 0.07 * Math.sin(t * 2.4 + 0.5);
    }
    if (earR) {
      const er = earR.userData.baseRot || [0.14, Math.PI - 0.32, -0.22];
      earR.rotation.y = er[1] - 0.14 * Math.sin(t * 3.1 + 0.35);
      earR.rotation.z = er[2] - 0.07 * Math.sin(t * 2.4 + 0.85);
    }

    // Natural periodic blink every ~4.2 s (with occasional double-blink)
    const cycle = t % 4.2;
    let blinkScale = 1.0;
    if (cycle > 3.92 && cycle < 4.08) {
      const u = (cycle - 3.92) / 0.16;
      blinkScale = 1.0 - 0.92 * Math.sin(u * Math.PI);
    } else if (Math.floor(t / 4.2) % 3 === 1 && cycle > 3.66 && cycle < 3.82) {
      const u = (cycle - 3.66) / 0.16;
      blinkScale = 1.0 - 0.90 * Math.sin(u * Math.PI);
    }

    const eyeL = head.getObjectByName('eyeL');
    const eyeR = head.getObjectByName('eyeR');
    if (eyeL) eyeL.scale.y = blinkScale;
    if (eyeR) eyeR.scale.y = blinkScale;
  }

  const tail = group.getObjectByName('tail');
  if (tail) {
    tail.rotation.y = 0.12 * Math.sin(t * 1.9 - 1.2);
    tail.rotation.z = 0.07 * Math.sin(t * 1.45 - 0.6);
    tail.rotation.x = 0.04 * Math.cos(t * 1.9 - 1.2);
  }

  const ripples = group.getObjectByName('ripples');
  if (ripples) {
    for (let i = 0; i < ripples.children.length; i++) {
      const disc = ripples.children[i];
      const bs = disc.userData.baseScale;
      if (!bs) continue;
      const pulse = 1.0 + 0.032 * Math.sin(t * 2.1 - (disc.userData.phase || 0));
      disc.scale.set(bs[0] * pulse, bs[1], bs[2] * pulse);
    }
  }
}