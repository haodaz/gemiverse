export const META = {
  id: 'desk_diary',
  name: 'Cozy Desk Diary',
  kind: 'prop',
  footprint: [0.26, 0.24],
  variants: ['Closed Diary', 'Open Spread', 'Stacked Pair'],
  note: 'Stylised hero hardback diary with sculpted rounded spine, woven cloth cover, painted page edges, elastic strap, curling ribbon bookmark, sticky-note tabs, and a cozy desk pen.'
};

// ---------------------------------------------------------------------------
// Pure Helpers (no globals, THREE & kit always passed in)
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function colHex(THREE, input, fallback) {
  const c = new THREE.Color(input !== undefined ? input : fallback);
  return '#' + c.getHexString();
}

function shiftColor(THREE, input, dh, ds, dl) {
  const c = new THREE.Color(input);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + dh + 1) % 1,
    clamp(hsl.s + ds, 0, 1),
    clamp(hsl.l + dl, 0.02, 0.98)
  );
  return c;
}

function mixHex(THREE, a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  ca.lerp(cb, clamp(t, 0, 1));
  return '#' + ca.getHexString();
}

function seededRand(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures (via kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function createCoverTextures(THREE, kit, primaryCol, accentCol, secondaryCol, motifStyle) {
  const baseHex = colHex(THREE, primaryCol, '#6d4c5c');
  const darkHex = '#' + shiftColor(THREE, baseHex, 0, 0.04, -0.14).getHexString();
  const deepHex = '#' + shiftColor(THREE, baseHex, 0, 0.05, -0.22).getHexString();
  const lightHex = '#' + shiftColor(THREE, baseHex, 0, -0.04, 0.1).getHexString();
  const foilHex = mixHex(THREE, secondaryCol, '#e2c280', 0.55);
  const foilSoftHex = mixHex(THREE, baseHex, foilHex, 0.55);
  const stitchHex = mixHex(THREE, baseHex, secondaryCol, 0.32);

  const map = kit.canvasTexture(1024, 1024, (ctx, w, h) => {
    // Base bookcloth colour
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic tonal variation & linen weave
    const step = 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n1 = kit.noise(x * 0.018, y * 0.018);
        const n2 = kit.noise(x * 0.09 + 11.3, y * 0.09 + 4.7);
        const weave = ((x / step) % 2 === (y / step) % 2) ? 0.035 : -0.03;
        const delta = (n1 - 0.5) * 0.1 + (n2 - 0.5) * 0.06 + weave;
        if (delta > 0) {
          ctx.fillStyle = `rgba(255,248,238,${(delta * 0.55).toFixed(3)})`;
        } else {
          ctx.fillStyle = `rgba(18,10,16,${(-delta * 0.65).toFixed(3)})`;
        }
        ctx.fillRect(x, y, step, step);
      }
    }

    // Fine directional cloth threads
    ctx.strokeStyle = 'rgba(255,250,245,0.035)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(15,8,12,0.045)';
    for (let j = 0; j < h; j += 5) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(w, j);
      ctx.stroke();
    }

    // Soft spine & hinge shading (spine lives in u = [0.44, 0.56])
    const spineGrad = ctx.createLinearGradient(w * 0.41, 0, w * 0.59, 0);
    spineGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
    spineGrad.addColorStop(0.18, 'rgba(15,8,12,0.22)');
    spineGrad.addColorStop(0.32, 'rgba(255,250,245,0.06)');
    spineGrad.addColorStop(0.5, 'rgba(255,250,245,0.11)');
    spineGrad.addColorStop(0.68, 'rgba(255,250,245,0.06)');
    spineGrad.addColorStop(0.82, 'rgba(15,8,12,0.22)');
    spineGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(w * 0.41, 0, w * 0.18, h);

    // Subtle edge patina along top/bottom/fore-edges
    const topV = ctx.createLinearGradient(0, 0, 0, h * 0.08);
    topV.addColorStop(0, 'rgba(15,8,12,0.22)');
    topV.addColorStop(1, 'rgba(15,8,12,0)');
    ctx.fillStyle = topV;
    ctx.fillRect(0, 0, w, h * 0.08);

    const botV = ctx.createLinearGradient(0, h, 0, h * 0.92);
    botV.addColorStop(0, 'rgba(15,8,12,0.22)');
    botV.addColorStop(1, 'rgba(15,8,12,0)');
    ctx.fillStyle = botV;
    ctx.fillRect(0, h * 0.92, w, h * 0.08);

    // Spine decorative bands
    const bandYs = [0.16, 0.34, 0.66, 0.84];
    for (const by of bandYs) {
      const py = h * by;
      ctx.fillStyle = 'rgba(15,8,12,0.22)';
      ctx.fillRect(w * 0.445, py - 5, w * 0.11, 10);
      ctx.strokeStyle = foilSoftHex;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.452, py);
      ctx.lineTo(w * 0.548, py);
      ctx.stroke();
    }

    // Small star ornament on upper spine
    drawFourPointStar(ctx, w * 0.5, h * 0.25, 11, foilHex);

    // Helper for rounded debossed frame on cover panel
    function drawCoverFrame(x0, y0, x1, y1, drawEmblem) {
      const pad = 34;
      const fx = x0 + pad;
      const fy = y0 + pad + 12;
      const fw = x1 - x0 - pad * 2;
      const fh = y1 - y0 - (pad + 12) * 2;

      // Outer debossed groove
      ctx.strokeStyle = deepHex;
      ctx.lineWidth = 4;
      roundRectPath(ctx, fx, fy, fw, fh, 18);
      ctx.stroke();

      // Inner warm foil hairline
      ctx.strokeStyle = foilSoftHex;
      ctx.lineWidth = 1.8;
      roundRectPath(ctx, fx + 8, fy + 8, fw - 16, fh - 16, 13);
      ctx.stroke();

      // Fine cozy perimeter stitching
      ctx.save();
      ctx.strokeStyle = stitchHex;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 7]);
      roundRectPath(ctx, fx - 12, fy - 12, fw + 24, fh + 24, 24);
      ctx.stroke();
      ctx.restore();

      // Corner flourishes
      const corners = [
        [fx + 14, fy + 14, 1, 1],
        [fx + fw - 14, fy + 14, -1, 1],
        [fx + 14, fy + fh - 14, 1, -1],
        [fx + fw - 14, fy + fh - 14, -1, -1]
      ];
      ctx.strokeStyle = foilHex;
      ctx.lineWidth = 2;
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * 28);
        ctx.bezierCurveTo(cx + sx * 4, cy + sy * 6, cx + sx * 6, cy + sy * 4, cx + sx * 28, cy);
        ctx.stroke();
        ctx.fillStyle = foilHex;
        ctx.beginPath();
        ctx.arc(cx + sx * 12, cy + sy * 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (drawEmblem) {
        const ex = fx + fw * 0.5;
        const ey = fy + fh * 0.43;

        // Subtle debossed oval medallion
        ctx.fillStyle = 'rgba(18,10,16,0.16)';
        ctx.beginPath();
        ctx.ellipse(ex, ey, 62, 82, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = foilHex;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 62, 82, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = foilSoftHex;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 53, 72, 0, 0, Math.PI * 2);
        ctx.stroke();

        if (motifStyle === 1) {
          // Botanical sprig motif for secondary notebook in stack
          ctx.strokeStyle = foilHex;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(ex, ey + 44);
          ctx.bezierCurveTo(ex - 6, ey + 10, ex + 8, ey - 14, ex, ey - 44);
          ctx.stroke();
          for (let k = -2; k <= 2; k++) {
            const ly = ey + k * 15;
            const side = k % 2 === 0 ? 1 : -1;
            ctx.fillStyle = foilHex;
            ctx.beginPath();
            ctx.ellipse(ex + side * 14, ly - 4, 12, 5.5, side * -0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          drawFourPointStar(ctx, ex, ey - 50, 9, foilHex);
        } else {
          // Crescent moon & cozy stars motif
          ctx.fillStyle = foilHex;
          ctx.beginPath();
          ctx.arc(ex - 4, ey - 4, 28, 0.35, Math.PI * 2 - 0.35);
          ctx.arc(ex + 9, ey - 10, 23, Math.PI * 2 - 0.55, 0.55, true);
          ctx.closePath();
          ctx.fill();

          drawFourPointStar(ctx, ex + 20, ey - 24, 11, foilHex);
          drawFourPointStar(ctx, ex + 24, ey + 14, 7.5, foilHex);
          drawFourPointStar(ctx, ex - 22, ey + 28, 6.5, foilHex);

          // Tiny dots constellation
          for (const [dx, dy, r] of [[10, 32, 2.2], [-24, -26, 2], [28, -4, 1.8]]) {
            ctx.beginPath();
            ctx.arc(ex + dx, ey + dy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Decorative bottom title lines (non-text ornamental dashes)
        ctx.strokeStyle = foilSoftHex;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(ex - 46, ey + 116);
        ctx.lineTo(ex + 46, ey + 116);
        ctx.stroke();

        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ex - 26, ey + 128);
        ctx.lineTo(ex + 26, ey + 128);
        ctx.stroke();

        drawFourPointStar(ctx, ex, ey + 148, 7, foilSoftHex);
      } else {
        // Discreet back-cover emblem
        drawFourPointStar(ctx, fx + fw * 0.5, fy + fh * 0.85, 8, foilSoftHex);
      }
    }

    // Back cover panel: u in [0.02, 0.42]
    drawCoverFrame(w * 0.02, 0, w * 0.42, h, false);
    // Front cover panel: u in [0.58, 0.98]
    drawCoverFrame(w * 0.58, 0, w * 0.98, h, true);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  // Matching bump map for bookcloth grain + debossed lines
  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    const step = 2;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const wv = ((x / step) % 2 === (y / step) % 2) ? 26 : -22;
        const n = (kit.noise(x * 0.11, y * 0.11) - 0.5) * 32;
        const val = clamp(Math.round(128 + wv + n), 0, 255);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(x, y, step, step);
      }
    }

    // Debossed frames
    ctx.strokeStyle = '#383838';
    ctx.lineWidth = 3;
    roundRectPath(ctx, w * 0.58 + 17, 23, w * 0.4 - 34, h - 46, 9);
    ctx.stroke();
    roundRectPath(ctx, w * 0.02 + 17, 23, w * 0.4 - 34, h - 46, 9);
    ctx.stroke();

    // Debossed oval on front
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * 0.43, 31, 41, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spine bands raised
    ctx.fillStyle = '#c8c8c8';
    for (const by of [0.16, 0.34, 0.66, 0.84]) {
      ctx.fillRect(w * 0.445, h * by - 3, w * 0.11, 6);
    }
  });
  bumpMap.anisotropy = 4;

  return { map, bumpMap, darkHex, lightHex };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFourPointStar(ctx, cx, cy, r, fill) {
  const ir = r * 0.28;
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : ir;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function createPageEdgeTextures(THREE, kit, secondaryCol) {
  const paperHex = colHex(THREE, secondaryCol, '#f3ead8');
  const warmHex = mixHex(THREE, paperHex, '#c8b08a', 0.26);
  const darkLine = mixHex(THREE, paperHex, '#7f694b', 0.42);
  const brightLine = mixHex(THREE, paperHex, '#ffffff', 0.32);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = paperHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle warm paper gradient across thickness
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, warmHex);
    g.addColorStop(0.12, paperHex);
    g.addColorStop(0.88, paperHex);
    g.addColorStop(1, warmHex);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Horizontal page sheet striations with signature groupings
    const rand = seededRand(4021);
    for (let y = 0; y < h; y += 2) {
      const sig = Math.sin((y / h) * Math.PI * 14) * 0.5 + 0.5;
      const n = kit.noise(y * 0.22, 3.1);
      const isDark = (y % 4 === 0) || rand() < 0.35;
      ctx.strokeStyle = isDark ? darkLine : brightLine;
      ctx.globalAlpha = isDark ? (0.14 + sig * 0.16 + n * 0.12) : (0.18 + n * 0.14);
      ctx.lineWidth = isDark ? 1.05 : 0.9;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) {
        const wobble = (kit.noise(x * 0.015, y * 0.08) - 0.5) * 1.4;
        ctx.lineTo(x, y + wobble);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Gentle shadow near cover contact edges
    const topSh = ctx.createLinearGradient(0, 0, 0, 36);
    topSh.addColorStop(0, 'rgba(60,42,25,0.28)');
    topSh.addColorStop(1, 'rgba(60,42,25,0)');
    ctx.fillStyle = topSh;
    ctx.fillRect(0, 0, w, 36);

    const botSh = ctx.createLinearGradient(0, h, 0, h - 36);
    botSh.addColorStop(0, 'rgba(60,42,25,0.28)');
    botSh.addColorStop(1, 'rgba(60,42,25,0)');
    ctx.fillStyle = botSh;
    ctx.fillRect(0, h - 36, w, 36);

    // Subtle paper fiber flecks
    for (let i = 0; i < 240; i++) {
      const fx = rand() * w;
      const fy = rand() * h;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(130,105,72,0.16)' : 'rgba(255,252,245,0.22)';
      ctx.fillRect(fx, fy, 1 + rand() * 3, 1);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 4;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = Math.round(96 + kit.noise(y * 0.45, 7.2) * 84);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1.5);
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap };
}

function createOpenPageTextures(THREE, kit, primaryCol, secondaryCol, accentCol) {
  const paperHex = colHex(THREE, secondaryCol, '#f3ead8');
  const paperEdge = mixHex(THREE, paperHex, '#d6c4a4', 0.28);
  const inkHex = mixHex(THREE, primaryCol, '#2e2428', 0.68);
  const ruleHex = mixHex(THREE, paperHex, '#8c7e70', 0.34);
  const accentSoft = mixHex(THREE, accentCol, paperHex, 0.45);
  const accentInk = mixHex(THREE, accentCol, '#5a3a30', 0.22);

  const map = kit.canvasTexture(1024, 1024, (ctx, w, h) => {
    // Paper base
    ctx.fillStyle = paperHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle fibrous paper tone
    const step = 8;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n = kit.noise(x * 0.025, y * 0.025) - 0.5;
        ctx.fillStyle = n > 0
          ? `rgba(255,253,248,${(n * 0.14).toFixed(3)})`
          : `rgba(140,115,82,${(-n * 0.12).toFixed(3)})`;
        ctx.fillRect(x, y, step, step);
      }
    }

    // Gentle edge warmth
    const leftEdge = ctx.createLinearGradient(0, 0, 54, 0);
    leftEdge.addColorStop(0, paperEdge);
    leftEdge.addColorStop(1, 'rgba(243,234,216,0)');
    ctx.fillStyle = leftEdge;
    ctx.fillRect(0, 0, 54, h);

    const rightEdge = ctx.createLinearGradient(w, 0, w - 54, 0);
    rightEdge.addColorStop(0, paperEdge);
    rightEdge.addColorStop(1, 'rgba(243,234,216,0)');
    ctx.fillStyle = rightEdge;
    ctx.fillRect(w - 54, 0, 54, h);

    // Helper: draw one page of ruled lines + handwritten-looking wavy non-letter lines
    const rand = seededRand(8813);

    function drawWavyStroke(xStart, yBase, length, amp, freqSeed) {
      ctx.beginPath();
      const segs = Math.max(4, Math.floor(length / 5.5));
      let px = xStart;
      let py = yBase;
      ctx.moveTo(px, py);
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const nx = xStart + t * length;
        const wave = Math.sin(i * 1.65 + freqSeed) * amp
          + Math.sin(i * 0.72 + freqSeed * 1.7) * (amp * 0.55);
        // Occasional soft ascender/descender loop flourish (purely abstract, never letters)
        let loop = 0;
        if (i > 1 && i < segs - 1 && (i % 6 === 0) && rand() < 0.42) {
          loop = (rand() > 0.45 ? -1 : 1) * amp * 1.65;
        }
        const ny = yBase + wave + loop + (t - 0.5) * 1.2;
        const cx = (px + nx) * 0.5;
        const cy = (py + ny) * 0.5 - amp * 0.3;
        ctx.quadraticCurveTo(cx, cy, nx, ny);
        px = nx;
        py = ny;
      }
      ctx.stroke();
    }

    function drawPage(isRight) {
      const px0 = isRight ? w * 0.54 : w * 0.065;
      const px1 = isRight ? w * 0.935 : w * 0.46;
      const pw = px1 - px0;
      const topY = h * 0.11;
      const lineStep = 34;
      const numLines = 24;

      // Top header rule & tiny date/weather emblem
      ctx.strokeStyle = ruleHex;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px0, topY - 12);
      ctx.lineTo(px1, topY - 12);
      ctx.stroke();

      // Tiny accent highlighter bar under header squiggle
      ctx.fillStyle = accentSoft;
      ctx.globalAlpha = 0.48;
      ctx.fillRect(px0 + 4, topY - 34, pw * 0.34, 12);
      ctx.globalAlpha = 1;

      // Header wavy stroke
      ctx.strokeStyle = inkHex;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawWavyStroke(px0 + 8, topY - 27, pw * 0.28, 3.2, isRight ? 9.1 : 1.7);

      // Tiny cozy weather / moon icon on top outer corner
      const iconX = isRight ? px1 - 24 : px0 + pw - 22;
      const iconY = topY - 28;
      ctx.strokeStyle = accentInk;
      ctx.lineWidth = 1.8;
      if (!isRight) {
        // Tiny sun doodle
        ctx.beginPath();
        ctx.arc(iconX, iconY, 7, 0, Math.PI * 2);
        ctx.stroke();
        for (let r = 0; r < 8; r++) {
          const a = (r * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(iconX + Math.cos(a) * 10, iconY + Math.sin(a) * 10);
          ctx.lineTo(iconX + Math.cos(a) * 14, iconY + Math.sin(a) * 14);
          ctx.stroke();
        }
      } else {
        // Tiny crescent doodle
        ctx.beginPath();
        ctx.arc(iconX, iconY, 8, 0.5, Math.PI * 2 - 0.5);
        ctx.stroke();
        drawFourPointStar(ctx, iconX + 12, iconY - 6, 4.5, accentInk);
      }

      // Faint ruled lines
      ctx.strokeStyle = ruleHex;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < numLines; i++) {
        const y = topY + i * lineStep + 18;
        ctx.beginPath();
        ctx.moveTo(px0, y);
        ctx.lineTo(px1, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Handwritten wavy lines (grouped into paragraphs, bullet lists, and a cozy sketch box on right)
      for (let i = 0; i < numLines - 1; i++) {
        // Paragraph breaks
        if (!isRight && (i === 6 || i === 14)) continue;
        if (isRight && (i === 5 || i === 12)) continue;
        // Leave room on lower-right of right page for a cozy doodle vignette
        const hasDoodle = isRight && i >= 14 && i <= 21;

        const y = topY + i * lineStep + 10;
        const isBullet = (!isRight && i >= 15 && i <= 19) || (isRight && i >= 6 && i <= 9);
        let curX = px0 + (isBullet ? 24 : (i === 0 || i === 7 || i === 13 ? 16 : 4));

        if (isBullet) {
          ctx.fillStyle = accentInk;
          ctx.beginPath();
          ctx.arc(px0 + 11, y - 1, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Accent highlight underline on one featured line
        if ((isRight && i === 2) || (!isRight && i === 10)) {
          ctx.fillStyle = accentSoft;
          ctx.globalAlpha = 0.42;
          ctx.fillRect(px0 + 4, y - 4, pw * 0.62, 10);
          ctx.globalAlpha = 1;
        }

        const lineMaxX = hasDoodle
          ? px0 + pw * 0.44
          : px0 + pw * (i === 5 || i === 13 || i === 11 || i === 22 ? 0.58 : (0.82 + rand() * 0.16));

        ctx.strokeStyle = inkHex;
        ctx.lineWidth = 1.7 + rand() * 0.45;
        ctx.globalAlpha = 0.78 + rand() * 0.16;

        while (curX < lineMaxX - 18) {
          const clusterLen = Math.min(lineMaxX - curX, 22 + rand() * 48);
          if (clusterLen < 12) break;
          drawWavyStroke(curX, y, clusterLen, 2.3 + rand() * 1.4, i * 3.1 + curX * 0.13);
          curX += clusterLen + 9 + rand() * 10;
        }
      }
      ctx.globalAlpha = 1;

      // Cozy pasted-in doodle card on lower right page (no text, just cute teacup + stars + washi tape!)
      if (isRight) {
        const bx = px0 + pw * 0.49;
        const by = topY + 14.3 * lineStep;
        const bw = pw * 0.47;
        const bh = lineStep * 6.8;

        ctx.save();
        ctx.translate(bx + bw * 0.5, by + bh * 0.5);
        ctx.rotate(-0.045);

        // Soft paper card shadow
        ctx.fillStyle = 'rgba(70,52,36,0.12)';
        ctx.fillRect(-bw * 0.5 + 4, -bh * 0.5 + 5, bw, bh);

        // Card fill
        ctx.fillStyle = mixHex(THREE, paperHex, '#ffffff', 0.42);
        ctx.fillRect(-bw * 0.5, -bh * 0.5, bw, bh);
        ctx.strokeStyle = ruleHex;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(-bw * 0.5, -bh * 0.5, bw, bh);

        // Washi tape strip holding top of card
        ctx.fillStyle = accentSoft;
        ctx.globalAlpha = 0.78;
        ctx.fillRect(-28, -bh * 0.5 - 9, 56, 18);
        ctx.globalAlpha = 1;

        // Cute cozy mug + rising steam swirls
        ctx.strokeStyle = inkHex;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.roundRect(-24, -4, 42, 34, [4, 4, 14, 14]);
        ctx.stroke();
        // Handle
        ctx.beginPath();
        ctx.arc(20, 12, 10, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
        // Saucer line
        ctx.beginPath();
        ctx.moveTo(-34, 34);
        ctx.lineTo(30, 34);
        ctx.stroke();
        // Steam wisps
        ctx.strokeStyle = accentInk;
        ctx.lineWidth = 1.7;
        for (const sx of [-11, 0, 11]) {
          ctx.beginPath();
          ctx.moveTo(sx, -12);
          ctx.bezierCurveTo(sx - 6, -24, sx + 6, -34, sx - 2, -46);
          ctx.stroke();
        }
        drawFourPointStar(ctx, -38, -32, 6, accentInk);
        drawFourPointStar(ctx, 34, -22, 5, accentInk);

        ctx.restore();
      }
    }

    drawPage(false);
    drawPage(true);

    // Central binding gutter shadow
    const gutter = ctx.createLinearGradient(w * 0.44, 0, w * 0.56, 0);
    gutter.addColorStop(0.0, 'rgba(42,30,18,0)');
    gutter.addColorStop(0.38, 'rgba(42,30,18,0.16)');
    gutter.addColorStop(0.5, 'rgba(32,20,12,0.44)');
    gutter.addColorStop(0.62, 'rgba(42,30,18,0.16)');
    gutter.addColorStop(1.0, 'rgba(42,30,18,0)');
    ctx.fillStyle = gutter;
    ctx.fillRect(w * 0.44, 0, w * 0.12, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const v = clamp(Math.round(128 + (kit.noise(x * 0.18, y * 0.18) - 0.5) * 34), 0, 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });

  return { map, bumpMap };
}

function createEndpaperTexture(THREE, kit, primaryCol, secondaryCol, accentCol) {
  const baseHex = mixHex(THREE, secondaryCol, '#e8dcc6', 0.35);
  const dotHex = mixHex(THREE, primaryCol, baseHex, 0.55);
  const starHex = mixHex(THREE, accentCol, baseHex, 0.35);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle paper grain
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.06, y * 0.06) - 0.5;
        ctx.fillStyle = `rgba(110,85,60,${Math.max(0, -n * 0.12).toFixed(3)})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Cozy repeating miniature botanical/star pattern
    const cell = 48;
    for (let gy = 0; gy < h; gy += cell) {
      for (let gx = 0; gx < w; gx += cell) {
        const ox = gx + ((gy / cell) % 2 === 0 ? 12 : 34);
        const oy = gy + 20;
        drawFourPointStar(ctx, ox, oy, 5.5, starHex);
        ctx.fillStyle = dotHex;
        ctx.beginPath();
        ctx.arc(ox + 18, oy + 14, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createRibbonTexture(THREE, kit, accentCol) {
  const baseHex = colHex(THREE, accentCol, '#d88c72');
  const edgeHex = '#' + shiftColor(THREE, baseHex, 0, 0.05, -0.14).getHexString();
  const hiHex = '#' + shiftColor(THREE, baseHex, 0, -0.05, 0.12).getHexString();

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    // Fine grosgrain cross ribs
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = (y % 6 === 0) ? 'rgba(255,250,245,0.12)' : 'rgba(30,15,10,0.1)';
      ctx.fillRect(0, y, w, 1.5);
    }

    // Woven selvedge borders along left/right edges
    ctx.fillStyle = edgeHex;
    ctx.fillRect(0, 0, 12, h);
    ctx.fillRect(w - 12, 0, 12, h);
    ctx.fillStyle = hiHex;
    ctx.fillRect(14, 0, 4, h);
    ctx.fillRect(w - 18, 0, 4, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 6);
  return map;
}

function createElasticTexture(THREE, kit, primaryCol) {
  const baseHex = '#' + shiftColor(THREE, primaryCol, 0, -0.05, -0.18).getHexString();

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    // Longitudinal ribbed elastic weave
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = 'rgba(255,250,245,0.09)';
      ctx.fillRect(x, 0, 3, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 4, 0, 3, h);
    }
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = (y % 8 === 0) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, y, w, 2);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 14);
  return map;
}

function createStickyTexture(THREE, kit, tabHex, inkHex) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = tabHex;
    ctx.fillRect(0, 0, w, h);

    // Matte paper grain
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.09, y * 0.09) - 0.5;
        ctx.fillStyle = n > 0
          ? `rgba(255,255,255,${(n * 0.14).toFixed(3)})`
          : `rgba(80,60,40,${(-n * 0.12).toFixed(3)})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Subtle darker edge near protruding tip & tiny hand-drawn marker stroke
    ctx.strokeStyle = inkHex;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.42);
    ctx.quadraticCurveTo(w * 0.72, h * 0.34, w * 0.84, h * 0.46);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w * 0.65, h * 0.62);
    ctx.quadraticCurveTo(w * 0.74, h * 0.68, w * 0.81, h * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// ---------------------------------------------------------------------------
// Custom Sculpted Geometry Builders
// ---------------------------------------------------------------------------

/**
 * Builds a smooth ribbon / strap loft along a 3D CatmullRomCurve3 using
 * Parallel Transport frames (zero Frenet flipping), rounded flat oval profile,
 * optional swallowtail V-notch tip, and optional closed loop.
 */
function buildRibbonLoft(THREE, curve, cfg) {
  const steps = cfg.steps || 48;
  const width = cfg.width || 0.0085;
  const thick = cfg.thick || 0.00075;
  const closed = !!cfg.closed;
  const swallowtail = !!cfg.swallowtail;
  const upHint = cfg.upHint || new THREE.Vector3(0, 1, 0);
  const rollFn = cfg.rollFn || (() => 0);
  const widthFn = cfg.widthFn || (() => 1);
  const profN = 10;

  const pts = [];
  const tangents = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  // Build stable normal/binormal frames via Parallel Transport
  const normals = [];
  const binormals = [];
  let n0 = upHint.clone();
  if (Math.abs(n0.dot(tangents[0])) > 0.92) {
    n0.set(1, 0, 0);
  }
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  n0 = new THREE.Vector3().crossVectors(b0, tangents[0]).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= steps; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const dot = clamp(prevT.dot(currT), -1, 1);
    const nPrev = normals[i - 1].clone();
    if (dot < 0.99999) {
      axis.crossVectors(prevT, currT);
      if (axis.lengthSq() > 1e-10) {
        axis.normalize();
        const angle = Math.acos(dot);
        q.setFromAxisAngle(axis, angle);
        nPrev.applyQuaternion(q);
      }
    }
    // Gentle alignment toward upHint if requested (keeps ribbon lying flat on desk)
    if (cfg.alignStrength) {
      const targetN = upHint.clone().addScaledVector(currT, -upHint.dot(currT));
      if (targetN.lengthSq() > 1e-4) {
        targetN.normalize();
        nPrev.lerp(targetN, cfg.alignStrength).normalize();
      }
    }
    const bCurr = new THREE.Vector3().crossVectors(currT, nPrev).normalize();
    const nCurr = new THREE.Vector3().crossVectors(bCurr, currT).normalize();
    normals.push(nCurr);
    binormals.push(bCurr);
  }

  // If closed loop, distribute any twist mismatch seamlessly across steps
  let twistFix = 0;
  if (closed) {
    const nStart = normals[0];
    const nEnd = normals[steps];
    const bStart = binormals[0];
    twistFix = Math.atan2(nEnd.dot(bStart), nEnd.dot(nStart));
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = profN + 1;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const roll = rollFn(t) - twistFix * t;
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const nBase = normals[i];
    const bBase = binormals[i];
    const nVec = nBase.clone().multiplyScalar(cosR).addScaledVector(bBase, sinR);
    const bVec = bBase.clone().multiplyScalar(cosR).addScaledVector(nBase, -sinR);

    const wHalf = width * 0.5 * widthFn(t);
    const tHalf = thick * 0.5;
    const p = pts[i];
    const tan = tangents[i];

    // Swallowtail V-notch pullback on final 2 rings
    const notchFactor = (swallowtail && i >= steps - 2)
      ? ((i - (steps - 2)) / 2) * (width * 0.58)
      : 0;

    for (let j = 0; j <= profN; j++) {
      const u = j / profN;
      const a = u * Math.PI * 2;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      // Slight gentle camber across width so ribbon catches specular highlights
      const camber = (1 - cx * cx) * thick * 0.38;
      const pullback = notchFactor * (1 - Math.abs(cx));

      const vx = p.x + bVec.x * (cx * wHalf) + nVec.x * (cy * tHalf + camber) - tan.x * pullback;
      const vy = p.y + bVec.y * (cx * wHalf) + nVec.y * (cy * tHalf + camber) - tan.y * pullback;
      const vz = p.z + bVec.z * (cx * wHalf) + nVec.z * (cy * tHalf + camber) - tan.z * pullback;

      positions.push(vx, vy, vz);
      uvs.push(Math.abs(cx * 0.5 + 0.5), t);
    }
  }

  for (let i = 0; i < steps; i++) {
    const r0 = i * ringStride;
    const r1 = (i + 1) * ringStride;
    for (let j = 0; j < profN; j++) {
      const a = r0 + j;
      const b = r0 + j + 1;
      const c = r1 + j + 1;
      const d = r1 + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Cap open ends if not closed
  if (!closed) {
    // Start cap
    const sCenter = positions.length / 3;
    positions.push(pts[0].x, pts[0].y, pts[0].z);
    uvs.push(0.5, 0);
    for (let j = 0; j < profN; j++) {
      indices.push(sCenter, j + 1, j);
    }
    // End cap
    const lastRing = steps * ringStride;
    const eCenter = positions.length / 3;
    const endPull = swallowtail ? width * 0.58 : 0;
    positions.push(
      pts[steps].x - tangents[steps].x * endPull,
      pts[steps].y - tangents[steps].y * endPull,
      pts[steps].z - tangents[steps].z * endPull
    );
    uvs.push(0.5, 1);
    for (let j = 0; j < profN; j++) {
      indices.push(eCenter, lastRing + j, lastRing + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tapered-tube ring-by-ring builder along a CatmullRomCurve3.
 */
function buildTaperedTube(THREE, curve, steps, radialSegs, radiusFn) {
  const pts = [];
  const tans = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(curve.getPoint(t));
    tans.push(curve.getTangent(t).normalize());
  }

  const normals = [];
  const binormals = [];
  let n0 = new THREE.Vector3(0, 1, 0);
  if (Math.abs(n0.dot(tans[0])) > 0.9) n0.set(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(tans[0], n0).normalize();
  n0 = new THREE.Vector3().crossVectors(b0, tans[0]).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= steps; i++) {
    const prevT = tans[i - 1];
    const currT = tans[i];
    const dot = clamp(prevT.dot(currT), -1, 1);
    const nPrev = normals[i - 1].clone();
    if (dot < 0.99999) {
      axis.crossVectors(prevT, currT);
      if (axis.lengthSq() > 1e-10) {
        axis.normalize();
        q.setFromAxisAngle(axis, Math.acos(dot));
        nPrev.applyQuaternion(q);
      }
    }
    const bCurr = new THREE.Vector3().crossVectors(currT, nPrev).normalize();
    const nCurr = new THREE.Vector3().crossVectors(bCurr, currT).normalize();
    normals.push(nCurr);
    binormals.push(bCurr);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rad = radiusFn(t);
    const p = pts[i];
    const n = normals[i];
    const b = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      positions.push(
        p.x + (b.x * ca + n.x * sa) * rad,
        p.y + (b.y * ca + n.y * sa) * rad,
        p.z + (b.z * ca + n.z * sa) * rad
      );
      uvs.push(j / radialSegs, t);
    }
  }

  for (let i = 0; i < steps; i++) {
    const r0 = i * stride;
    const r1 = (i + 1) * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(r0 + j, r0 + j + 1, r1 + j + 1, r0 + j, r1 + j + 1, r1 + j);
    }
  }

  // Rounded caps
  const sC = positions.length / 3;
  positions.push(pts[0].x, pts[0].y, pts[0].z);
  uvs.push(0.5, 0);
  for (let j = 0; j < radialSegs; j++) indices.push(sC, j + 1, j);

  const lR = steps * stride;
  const eC = positions.length / 3;
  positions.push(pts[steps].x, pts[steps].y, pts[steps].z);
  uvs.push(0.5, 1);
  for (let j = 0; j < radialSegs; j++) indices.push(eC, lR + j, lR + j + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds ONE continuous sculpted hardback cover (front board, rounded spine,
 * back board, French hinge grooves, spine bands, rounded outer corners, and
 * smoothly beveled bookcloth edges) for either closed or open state.
 */
function buildSculptedCover(THREE, cfg) {
  const W = cfg.W;
  const L = cfg.L;
  const T = cfg.T;
  const boardThick = cfg.boardThick;
  const isOpen = !!cfg.isOpen;

  const rSpine = (T - boardThick) * 0.5;
  const spineArc = Math.PI * rSpine;
  const boardW = W - rSpine;
  const halfP = spineArc * 0.5 + boardW;
  const halfQ = L * 0.5;
  const halfThick = boardThick * 0.5;
  const cornerR = 0.0085;
  const bevelW = 0.0028;

  // Dense subdivided manifold so bending, corner rounding & debossing are silky smooth
  const geo = new THREE.BoxGeometry(2, 2, 2, 76, 4, 34);
  const pos = geo.attributes.position;

  function evalCenterline(p) {
    if (!isOpen) {
      const sHalf = spineArc * 0.5;
      const spineCenterX = -W * 0.5 + rSpine;
      if (Math.abs(p) <= sHalf) {
        const theta = (p / sHalf) * (Math.PI * 0.5);
        return {
          x: spineCenterX - rSpine * 0.86 * Math.cos(theta),
          y: T * 0.5 + rSpine * Math.sin(theta)
        };
      } else {
        const d = Math.abs(p) - sHalf;
        return {
          x: spineCenterX + d,
          y: T * 0.5 + Math.sign(p) * rSpine
        };
      }
    } else {
      // Open flat on desk: p goes from -halfP (back cover on +x) to +halfP (front cover on -x)
      // Outward cloth normal points downward (-y) with preserved winding!
      const sHalf = spineArc * 0.42;
      const absP = Math.abs(p);
      // Slight graceful lift toward outer cover corners + soft spine arch
      const cornerLift = 0.0022 * smoothstep(sHalf, halfP, absP);
      const spineArch = 0.0012 * (1 - smoothstep(0, sHalf * 1.1, absP));
      return {
        x: -p * 0.985,
        y: halfThick + cornerLift + spineArch
      };
    }
  }

  const eps = 0.00035;
  for (let i = 0; i < pos.count; i++) {
    const bx = pos.getX(i);
    const by = pos.getY(i);
    const bz = pos.getZ(i);

    let px = bx * halfP;
    let qz = bz * halfQ;

    // Exact elliptical rounded-corner mapping at the 4 fore-edge corners
    const ux = Math.max(0, Math.abs(px) - (halfP - cornerR)) / cornerR;
    const uz = Math.max(0, Math.abs(qz) - (halfQ - cornerR)) / cornerR;
    let eDist;
    let outRimX = 0;
    let outRimZ = 0;

    if (ux > 0 && uz > 0) {
      const dx = ux * Math.sqrt(Math.max(0, 1 - 0.5 * uz * uz));
      const dz = uz * Math.sqrt(Math.max(0, 1 - 0.5 * ux * ux));
      px = Math.sign(px) * (halfP - cornerR + dx * cornerR);
      qz = Math.sign(qz) * (halfQ - cornerR + dz * cornerR);
      const r = Math.hypot(dx, dz);
      eDist = (1 - r) * cornerR;
      if (r > 1e-5) {
        outRimX = Math.sign(px) * (dx / r);
        outRimZ = Math.sign(qz) * (dz / r);
      }
    } else {
      const dX = halfP - Math.abs(px);
      const dZ = halfQ - Math.abs(qz);
      eDist = Math.min(dX, dZ);
      if (dX < dZ) outRimX = Math.sign(px);
      else outRimZ = Math.sign(qz);
    }

    // Softly beveled cloth-wrapped edge profile (100% watertight at eDist = 0)
    const edgeF = clamp(eDist / bevelW, 0, 1);
    const bevelScale = 0.54 + 0.46 * Math.sqrt(Math.max(0, 1 - (1 - edgeF) * (1 - edgeF)));
    const rimBulge = (eDist < 1e-4) ? 0.00055 * Math.sqrt(Math.max(0, 1 - by * by)) : 0;
    px += outRimX * rimBulge;
    qz += outRimZ * rimBulge;

    let ty = by * halfThick * bevelScale;

    // Sculpted bookbinding details on outer cloth surface (by > 0.5)
    if (by > 0.5) {
      const absP = Math.abs(px);
      const sHalf = spineArc * 0.5;

      // French hinge groove running along spine-board transition
      const hingeDist = (absP - (sHalf + 0.0075)) / 0.0034;
      const hingeGroove = -0.00075 * Math.exp(-hingeDist * hingeDist);

      // Gentle organic board pillowing across front & back covers
      let pillow = 0;
      if (absP > sHalf + 0.012) {
        const uBoard = clamp((absP - (sHalf + 0.012)) / (boardW - 0.018), 0, 1);
        const vBoard = clamp((qz + halfQ) / L, 0, 1);
        pillow = 0.00055 * Math.sin(uBoard * Math.PI) * Math.sin(vBoard * Math.PI);
      }

      // Subtle raised vintage spine bands
      let spineBands = 0;
      if (absP < sHalf * 0.95) {
        const bandPositions = [-0.066, -0.031, 0.031, 0.066];
        for (const bp of bandPositions) {
          const dz = (qz - bp * (L / 0.196)) / 0.0026;
          spineBands += 0.00048 * Math.exp(-dz * dz);
        }
        spineBands *= smoothstep(sHalf, sHalf * 0.65, absP);
      }

      ty += hingeGroove + pillow + spineBands;
    }

    // Evaluate centerline & tangent
    const c0 = evalCenterline(px);
    const cMinus = evalCenterline(px - eps);
    const cPlus = evalCenterline(px + eps);
    let tx = cPlus.x - cMinus.x;
    let tyTan = cPlus.y - cMinus.y;
    const tLen = Math.hypot(tx, tyTan) || 1;
    tx /= tLen;
    tyTan /= tLen;
    const nx = -tyTan;
    const ny = tx;

    pos.setXYZ(i, c0.x + nx * ty, c0.y + ny * ty, qz);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the sculpted closed page block with rounded spine contour, authentic
 * slightly concave fore-edge, and signature micro-ripples.
 */
function buildClosedPageBlock(THREE, cfg) {
  const W = cfg.W;
  const L = cfg.L;
  const T = cfg.T;
  const boardThick = cfg.boardThick;

  const rSpine = (T - boardThick) * 0.5;
  const overhang = 0.0048;
  const pw = W - rSpine * 0.58 - overhang;
  const pl = L - overhang * 2.05;
  const ph = T - boardThick * 2 - 0.0005;

  const geo = new THREE.BoxGeometry(pw, ph, pl, 22, 18, 22);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const norm = geo.attributes.normal;

  const spineCenterX = -W * 0.5 + rSpine * 0.62;
  const blockCenterX = spineCenterX + pw * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const nx = norm.getX(i);
    const nz = norm.getZ(i);

    const nyNorm = y / (ph * 0.5); // [-1, 1]
    const archCurve = 1 - nyNorm * nyNorm; // 1 in middle, 0 at covers

    // Spine side (-x): bulge slightly into rounded spine hollow
    if (x < -pw * 0.3) {
      const f = smoothstep(-pw * 0.3, -pw * 0.5, x);
      x -= f * archCurve * 0.0036;
    }

    // Fore-edge (+x): gentle concave thumb-cut rounding
    if (x > pw * 0.25) {
      const f = smoothstep(pw * 0.25, pw * 0.5, x);
      x -= f * archCurve * 0.0026;
    }

    // Subtle paper-signature ripples along fore-edge, top, and bottom edges
    const ripple = Math.sin(nyNorm * Math.PI * 9) * 0.00018
      + Math.sin(nyNorm * Math.PI * 21 + z * 40) * 0.00009;
    if (Math.abs(nx) > 0.5) x += Math.sign(nx) * ripple;
    if (Math.abs(nz) > 0.5) z += Math.sign(nz) * ripple;

    pos.setXYZ(i, x + blockCenterX, y + T * 0.5, z);

    // Ensure horizontal sheet lines align along Y on all exposed page edges
    const vSheet = (nyNorm + 1) * 0.5;
    if (Math.abs(nx) > 0.5) {
      uv.setXY(i, (z / pl + 0.5) * 1.15, vSheet);
    } else if (Math.abs(nz) > 0.5) {
      uv.setXY(i, (x / pw + 0.5) * 0.85, vSheet);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds one sculpted half of the open fanned page block (left or right stack)
 * with deep gutter dip, arched top spread, and fanned beveled fore-edge.
 */
function buildOpenPageStack(THREE, side, cfg) {
  const sW = cfg.pageW;
  const sL = cfg.pageL;
  const baseH = cfg.boardThick + 0.0004;

  const geo = new THREE.BoxGeometry(1, 1, 1, 32, 12, 24);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const norm = geo.attributes.normal;

  for (let i = 0; i < pos.count; i++) {
    const bx = pos.getX(i); // [-0.5, 0.5]
    const by = pos.getY(i); // [-0.5, 0.5]
    const bz = pos.getZ(i); // [-0.5, 0.5]
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);

    // u = 0 at gutter, u = 1 at outer fore-edge
    const u = side > 0 ? (bx + 0.5) : (0.5 - bx);
    // v = 0 at bottom (touching cover), v = 1 at top spread page
    const v = by + 0.5;
    const z = bz * sL;

    // Bottom surface rests flush on open cover
    const xBot = side * (0.002 + u * sW);
    const yBot = baseH + 0.0022 * smoothstep(0.12, 1.0, u);

    // Top arched open-book spread surface
    const arch = Math.pow(u, 0.56) * (0.0112 + 0.0118 * Math.sin(Math.pow(u, 0.74) * Math.PI));
    const xTop = side * (0.0008 + u * (sW - 0.0075));
    const yTop = baseH + 0.0022 + arch;

    // Slight fanned curve along outer thickness
    const vCurve = Math.pow(v, 1.08);
    let x = xBot + (xTop - xBot) * vCurve;
    let y = yBot + (yTop - yBot) * v;

    // Subtle organic wave along Z near outer fore-edge so pages feel softly hand-turned
    const zWave = Math.sin(bz * Math.PI * 1.4 + (side > 0 ? 0.4 : -0.3)) * 0.0006 * u * v;
    y += zWave;

    // Micro sheet striations on exposed edges
    const ripple = Math.sin(v * Math.PI * 16) * 0.00018;
    if (Math.abs(nx) > 0.5 && u > 0.9) x += side * ripple;

    pos.setXYZ(i, x, y, z);

    // Custom UVs: top face maps cleanly to left/right half of open spread texture
    if (ny > 0.5) {
      const uSpread = side < 0 ? (0.5 * (1 - u)) : (0.5 + 0.5 * u);
      const vSpread = 0.5 - bz; // top (-z) -> 1, bottom (+z) -> 0
      uv.setXY(i, uSpread, vSpread);
    } else if (Math.abs(nx) > 0.5) {
      uv.setXY(i, (bz + 0.5) * 1.1, v);
    } else if (Math.abs(nz) > 0.5) {
      uv.setXY(i, u * 0.9, v);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a single gently arching, corner-curling loose page leaf for the open spread.
 */
function buildLooseCurledLeaf(THREE, side, cfg) {
  const sW = cfg.pageW - 0.008;
  const sL = cfg.pageL - 0.001;
  const baseH = cfg.boardThick + 0.0027;

  const geo = new THREE.PlaneGeometry(1, 1, 28, 22);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i); // [-0.5, 0.5]
    const py = pos.getY(i); // [-0.5, 0.5]
    const u = px + 0.5; // 0 at gutter, 1 at outer edge
    const vz = -py; // -0.5 at top (-z), +0.5 at bottom (+z)

    const arch = Math.pow(u, 0.54) * (0.0124 + 0.0142 * Math.sin(Math.pow(u, 0.72) * Math.PI));
    const lift = side > 0
      ? 0.0036 * Math.sin(u * Math.PI * 0.85) + 0.0095 * Math.pow(u, 2.2) * smoothstep(-0.15, 0.5, vz)
      : 0.0018 * Math.sin(u * Math.PI * 0.85) + 0.0045 * Math.pow(u, 2.3) * smoothstep(0.15, -0.5, vz);

    const x = side * (0.0008 + u * sW - lift * 0.42);
    const y = baseH + arch + lift;
    const z = vz * sL;

    pos.setXYZ(i, x, y, z);

    const uTex = side < 0 ? (0.5 * (1 - u)) : (0.5 + 0.5 * u);
    const vTex = 0.5 - vz;
    uv.setXY(i, uTex, vTex);
  }

  // Flip triangle winding for left side so front normal faces +Y
  if (side < 0) {
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a gently bent sticky-note tab via ExtrudeGeometry from a THREE.Shape
 * with bezierCurveTo, subdivided along length and vertex-displaced to curl.
 */
function buildStickyTab(THREE, len, width, curlY, twist) {
  const shape = new THREE.Shape();
  const hw = width * 0.5;
  const r = Math.min(hw * 0.45, 0.0032);

  // Sample intermediate points along the straight edges so vertex bending is smooth
  shape.moveTo(0, -hw);
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    shape.lineTo(((len - r) * i) / segs, -hw);
  }
  shape.bezierCurveTo(len - r * 0.25, -hw, len, -hw + r * 0.25, len, -hw + r);
  shape.lineTo(len, hw - r);
  shape.bezierCurveTo(len, hw - r * 0.25, len - r * 0.25, hw, len - r, hw);
  for (let i = segs - 1; i >= 0; i--) {
    shape.lineTo(((len - r) * i) / segs, hw);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.00038,
    bevelEnabled: true,
    bevelThickness: 0.00012,
    bevelSize: 0.00014,
    bevelSegments: 2,
    curveSegments: 10
  });

  // Orient flat in XZ (X = protruding outward, Y = thickness, Z = width)
  geo.rotateX(Math.PI * 0.5);

  // Bend the protruding outer half smoothly
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const rootLen = len * 0.46;
  const peekLen = len - rootLen;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);

    if (x > rootLen) {
      const f = clamp((x - rootLen) / peekLen, 0, 1);
      y += curlY * Math.pow(f, 1.75) + (z / hw) * twist * f;
    }
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, clamp(x / len, 0, 1), clamp(z / width + 0.5, 0, 1));
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the hero cozy stylised desk pen using LatheGeometry (28 profile pts)
 * plus a sculpted tapered-tube pocket clip and brass accents.
 */
function buildCozyPen(THREE, primaryCol, accentCol, secondaryCol) {
  const penGroup = new THREE.Group();
  penGroup.name = 'pen';

  const barrelCol = mixHex(THREE, accentCol, primaryCol, 0.38);
  const gripCol = '#' + shiftColor(THREE, primaryCol, 0, -0.06, -0.14).getHexString();
  const brassCol = mixHex(THREE, '#d9b56c', secondaryCol, 0.2);

  const barrelMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(barrelCol),
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.88,
    clearcoatRoughness: 0.14
  });

  const gripMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(gripCol),
    roughness: 0.82,
    metalness: 0.0,
    sheen: 0.45,
    sheenColor: shiftColor(THREE, gripCol, 0, -0.04, 0.16)
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(brassCol),
    roughness: 0.24,
    metalness: 0.86,
    clearcoat: 0.35
  });

  // 1. Main upper barrel & cap (LatheGeometry, 20 points along Y)
  const barrelPts = [
    [0.0046, 0.052],
    [0.0052, 0.055],
    [0.0056, 0.064],
    [0.0058, 0.076],
    [0.0059, 0.088],
    [0.0059, 0.100],
    [0.0058, 0.112],
    [0.0056, 0.122],
    [0.0053, 0.129],
    [0.0049, 0.133],
    [0.0042, 0.135],
    [0.0031, 0.136]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const barrelGeo = new THREE.LatheGeometry(barrelPts, 28);
  const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
  barrelMesh.userData.slot = 'accent';
  barrelMesh.castShadow = true;
  barrelMesh.receiveShadow = true;
  penGroup.add(barrelMesh);

  // 2. Ergonomic softly pinched grip section (LatheGeometry)
  const gripPts = [
    [0.0034, 0.021],
    [0.0041, 0.025],
    [0.0045, 0.031],
    [0.0044, 0.038],
    [0.0046, 0.045],
    [0.0050, 0.051],
    [0.0049, 0.054]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const gripGeo = new THREE.LatheGeometry(gripPts, 28);
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  gripMesh.userData.slot = 'primary';
  gripMesh.castShadow = true;
  gripMesh.receiveShadow = true;
  penGroup.add(gripMesh);

  // 3. Brass nose cone, writing nib, center band, and domed clicker finial
  const nosePts = [
    [0.0001, 0.0],
    [0.00055, 0.0022],
    [0.0008, 0.005],
    [0.0014, 0.0075],
    [0.0022, 0.012],
    [0.0030, 0.017],
    [0.0036, 0.0215],
    [0.0037, 0.0225]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const noseMesh = new THREE.Mesh(new THREE.LatheGeometry(nosePts, 24), brassMat);
  noseMesh.userData.slot = 'accent';
  noseMesh.castShadow = true;
  penGroup.add(noseMesh);

  // Center decorative brass collar ring
  const ringPts = [
    [0.0048, 0.051],
    [0.00545, 0.052],
    [0.0056, 0.0535],
    [0.00545, 0.055],
    [0.0048, 0.056]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const ringMesh = new THREE.Mesh(new THREE.LatheGeometry(ringPts, 24), brassMat);
  ringMesh.userData.slot = 'accent';
  penGroup.add(ringMesh);

  // Top domed clicker finial + upper collar
  const finialPts = [
    [0.0049, 0.128],
    [0.0055, 0.1295],
    [0.0054, 0.1315],
    [0.0045, 0.133],
    [0.0036, 0.1345],
    [0.0035, 0.139],
    [0.0032, 0.1415],
    [0.0021, 0.1432],
    [0.0001, 0.1438]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const finialMesh = new THREE.Mesh(new THREE.LatheGeometry(finialPts, 24), brassMat);
  finialMesh.userData.slot = 'accent';
  finialMesh.castShadow = true;
  penGroup.add(finialMesh);

  // 4. Sculpted pocket clip via tapered-tube helper
  const clipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0046, 0.130, 0),
    new THREE.Vector3(0.0076, 0.127, 0),
    new THREE.Vector3(0.0082, 0.114, 0),
    new THREE.Vector3(0.0080, 0.098, 0),
    new THREE.Vector3(0.0067, 0.087, 0)
  ]);
  const clipGeo = buildTaperedTube(THREE, clipCurve, 22, 10, (t) => {
    // Graceful bulge at tip ball, slender waist in middle
    if (t > 0.86) return 0.00145 + (t - 0.86) * 0.003;
    return 0.00125 - Math.sin(t * Math.PI) * 0.00022;
  });
  const clipMesh = new THREE.Mesh(clipGeo, brassMat);
  clipMesh.userData.slot = 'accent';
  clipMesh.castShadow = true;
  penGroup.add(clipMesh);

  // Rotate pen to lie horizontally on the desk (along Z, tip toward +Z, clip facing up-right)
  penGroup.rotation.order = 'YXZ';
  penGroup.rotation.x = Math.PI * 0.5;
  penGroup.rotation.z = -0.55; // angles clip pleasantly up-right

  // Wrap in pivot group centered along pen length with bottom resting cleanly at y = 0
  const wrapper = new THREE.Group();
  wrapper.name = 'pen';
  penGroup.position.set(0, 0.0059, -0.071);
  wrapper.add(penGroup);
  return wrapper;
}

// ---------------------------------------------------------------------------
// Notebook Sub-Assembly Builder (reused cleanly for Variant 0 and Variant 2)
// ---------------------------------------------------------------------------

function buildClosedNotebook(THREE, kit, cfg) {
  const nb = new THREE.Group();
  const W = cfg.W;
  const L = cfg.L;
  const T = cfg.T;
  const boardThick = cfg.boardThick;
  const primary = cfg.primary;
  const secondary = cfg.secondary;
  const accent = cfg.accent;

  const coverTex = createCoverTextures(THREE, kit, primary, accent, secondary, cfg.motifStyle || 0);
  const pageTex = createPageEdgeTextures(THREE, kit, secondary);
  const endpaperTex = createEndpaperTexture(THREE, kit, primary, secondary, accent);
  const elasticTex = createElasticTexture(THREE, kit, primary);

  const coverMat = new THREE.MeshPhysicalMaterial({
    map: coverTex.map,
    bumpMap: coverTex.bumpMap,
    bumpScale: 0.00065,
    roughness: 0.88,
    metalness: 0.02,
    sheen: 0.72,
    sheenRoughness: 0.75,
    sheenColor: shiftColor(THREE, primary, 0, -0.06, 0.22)
  });

  const endpaperMat = new THREE.MeshPhysicalMaterial({
    map: endpaperTex,
    roughness: 0.92,
    metalness: 0.0
  });

  const pageMat = new THREE.MeshPhysicalMaterial({
    map: pageTex.map,
    bumpMap: pageTex.bumpMap,
    bumpScale: 0.00045,
    roughness: 0.91,
    metalness: 0.0,
    sheen: 0.25,
    sheenColor: new THREE.Color('#fffaf0')
  });

  const elasticMat = new THREE.MeshPhysicalMaterial({
    map: elasticTex,
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.7,
    sheenColor: shiftColor(THREE, primary, 0, -0.05, 0.14)
  });

  // Lift book slightly by bandThickness so the underside of the elastic strap sits flush on y = 0
  const bandThick = 0.0012;
  const liftY = cfg.hasElastic ? bandThick * 0.95 : 0;

  // 1. Continuous sculpted hardback cover
  const coverGeo = buildSculptedCover(THREE, { W, L, T, boardThick, isOpen: false });
  const coverMesh = new THREE.Mesh(coverGeo, [
    coverMat, coverMat, coverMat, endpaperMat, coverMat, coverMat
  ]);
  coverMesh.position.y = liftY;
  coverMesh.userData.slot = 'primary';
  coverMesh.castShadow = true;
  coverMesh.receiveShadow = true;
  nb.add(coverMesh);

  // 2. Sculpted page block with painted page edges
  const pageGeo = buildClosedPageBlock(THREE, { W, L, T, boardThick });
  const pageMesh = new THREE.Mesh(pageGeo, pageMat);
  pageMesh.position.y = liftY;
  pageMesh.userData.slot = 'secondary';
  pageMesh.castShadow = true;
  pageMesh.receiveShadow = true;
  nb.add(pageMesh);

  // 3. Woven headbands / tailbands nestled inside spine ends
  const rSpine = (T - boardThick) * 0.5;
  const hbMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(mixHex(THREE, accent, secondary, 0.3)),
    roughness: 0.88,
    sheen: 0.7,
    sheenColor: new THREE.Color(secondary)
  });
  for (const zSign of [-1, 1]) {
    const zPos = zSign * (L * 0.5 - 0.0062);
    const hbPts = [];
    for (let k = 0; k <= 8; k++) {
      const a = -Math.PI * 0.42 + (k / 8) * Math.PI * 0.84;
      hbPts.push(new THREE.Vector3(
        -W * 0.5 + rSpine - (rSpine - 0.0022) * 0.84 * Math.cos(a),
        liftY + T * 0.5 + (rSpine - 0.0022) * Math.sin(a),
        zPos
      ));
    }
    const hbCurve = new THREE.CatmullRomCurve3(hbPts);
    const hbGeo = buildTaperedTube(THREE, hbCurve, 14, 8, () => 0.0014);
    const hbMesh = new THREE.Mesh(hbGeo, hbMat);
    hbMesh.userData.slot = 'accent';
    nb.add(hbMesh);
  }

  // 4. Snug elastic closure band looping over front, top, back, and bottom edges
  if (cfg.hasElastic) {
    const bx = W * 0.5 - 0.023;
    const hL = L * 0.5;
    const topY = liftY + T + bandThick * 0.42;
    const botY = bandThick * 0.48;
    const midY = liftY + T * 0.5;
    const zOut = hL + 0.0014;

    const bandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, topY, -hL * 0.86),
      new THREE.Vector3(bx, topY + 0.0003, 0),
      new THREE.Vector3(bx, topY, hL * 0.86),
      new THREE.Vector3(bx, topY - 0.002, zOut),
      new THREE.Vector3(bx, midY, zOut + 0.0006),
      new THREE.Vector3(bx, botY + 0.002, zOut),
      new THREE.Vector3(bx, botY, hL * 0.86),
      new THREE.Vector3(bx, botY, 0),
      new THREE.Vector3(bx, botY, -hL * 0.86),
      new THREE.Vector3(bx, botY + 0.002, -zOut),
      new THREE.Vector3(bx, midY, -zOut - 0.0006),
      new THREE.Vector3(bx, topY - 0.002, -zOut)
    ], true, 'catmullrom', 0.28);

    const bandGeo = buildRibbonLoft(THREE, bandCurve, {
      steps: 72,
      width: 0.0086,
      thick: bandThick,
      closed: true,
      upHint: new THREE.Vector3(1, 0, 0),
      rollFn: () => Math.PI * 0.5
    });
    const bandMesh = new THREE.Mesh(bandGeo, elasticMat);
    bandMesh.userData.slot = 'primary';
    bandMesh.castShadow = true;
    bandMesh.receiveShadow = true;
    nb.add(bandMesh);
  }

  // 5. Sticky-note tabs peeking out organically from page edges
  if (cfg.stickyTabs && cfg.stickyTabs.length > 0) {
    const tabGroup = new THREE.Group();
    tabGroup.name = 'stickyTabs';
    const inkHex = mixHex(THREE, primary, '#2c2226', 0.65);

    const tabPalette = [
      colHex(THREE, accent, '#d88c72'),
      '#' + shiftColor(THREE, accent, 0.09, -0.08, 0.12).getHexString(),
      '#' + shiftColor(THREE, accent, -0.14, -0.12, 0.14).getHexString(),
      mixHex(THREE, secondary, '#e9c878', 0.45)
    ];

    for (let i = 0; i < cfg.stickyTabs.length; i++) {
      const spec = cfg.stickyTabs[i];
      const tCol = tabPalette[i % tabPalette.length];
      const tTex = createStickyTexture(THREE, kit, tCol, inkHex);
      const tMat = new THREE.MeshPhysicalMaterial({
        map: tTex,
        roughness: 0.9,
        metalness: 0.0,
        sheen: 0.35,
        sheenColor: new THREE.Color('#fffaf2')
      });

      const tabGeo = buildStickyTab(THREE, 0.028, 0.0145, spec.curl, spec.twist);
      const tabMesh = new THREE.Mesh(tabGeo, tMat);
      tabMesh.userData.slot = 'accent';
      tabMesh.castShadow = true;
      tabMesh.receiveShadow = true;

      if (spec.edge === 'top') {
        tabMesh.rotation.y = Math.PI * 0.5 + (spec.yaw || 0);
        tabMesh.position.set(
          spec.offset,
          liftY + boardThick + spec.yFrac * (T - boardThick * 2),
          -L * 0.5 + 0.0155
        );
      } else {
        tabMesh.rotation.y = spec.yaw || 0;
        tabMesh.position.set(
          W * 0.5 - 0.0155,
          liftY + boardThick + spec.yFrac * (T - boardThick * 2),
          spec.offset
        );
      }
      tabGroup.add(tabMesh);
    }
    nb.add(tabGroup);
  }

  return { group: nb, totalHeight: liftY + T };
}

// ---------------------------------------------------------------------------
// Ribbon Bookmark Builder (with animated "tail" pivot)
// ---------------------------------------------------------------------------

function buildRibbonBookmark(THREE, kit, accentCol, controlPoints, opts) {
  const ribbonTex = createRibbonTexture(THREE, kit, accentCol);
  const ribbonMat = new THREE.MeshPhysicalMaterial({
    map: ribbonTex,
    roughness: 0.62,
    metalness: 0.02,
    sheen: 0.92,
    sheenRoughness: 0.45,
    sheenColor: shiftColor(THREE, accentCol, 0, -0.05, 0.25)
  });

  const pivot = controlPoints[0].clone();
  const localPts = controlPoints.map((p) => p.clone().sub(pivot));
  const curve = new THREE.CatmullRomCurve3(localPts, false, 'catmullrom', 0.45);

  const ribbonGeo = buildRibbonLoft(THREE, curve, {
    steps: (opts && opts.steps) || 54,
    width: (opts && opts.width) || 0.0082,
    thick: 0.00068,
    swallowtail: true,
    upHint: new THREE.Vector3(0, 1, 0),
    alignStrength: 0.35,
    rollFn: (opts && opts.rollFn) || ((t) => Math.sin(t * Math.PI) * 0.22)
  });

  const mesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  mesh.userData.slot = 'accent';
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const tailGroup = new THREE.Group();
  tailGroup.name = (opts && opts.name) || 'tail';
  tailGroup.position.copy(pivot);
  tailGroup.userData.baseRotY = 0;
  tailGroup.userData.baseRotX = 0;
  tailGroup.add(mesh);
  return tailGroup;
}

// ---------------------------------------------------------------------------
// Main Export: build(THREE, opts, kit)
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const primary = opts.primary !== undefined ? opts.primary : '#6d4c5c';
  const secondary = opts.secondary !== undefined ? opts.secondary : '#f3ead8';
  const accent = opts.accent !== undefined ? opts.accent : '#d88c72';
  const variant = opts.variant !== undefined ? opts.variant : 0;

  const root = new THREE.Group();
  root.name = 'desk_diary_root';

  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // Base hero diary dimensions (~0.2 m desk prop)
  const W = 0.144;
  const L = 0.194;
  const T = 0.027;
  const boardThick = 0.0034;

  if (variant === 1) {
    // =======================================================================
    // VARIANT 1: Open Diary with Two Fanned Pages & Handwritten Wavy Lines
    // =======================================================================
    const openGroup = new THREE.Group();
    openGroup.rotation.y = -0.05; // subtle lived-in cozy asymmetry
    body.add(openGroup);

    const coverTex = createCoverTextures(THREE, kit, primary, accent, secondary, 0);
    const endpaperTex = createEndpaperTexture(THREE, kit, primary, secondary, accent);
    const pageEdgeTex = createPageEdgeTextures(THREE, kit, secondary);
    const openSpreadTex = createOpenPageTextures(THREE, kit, primary, secondary, accent);
    const elasticTex = createElasticTexture(THREE, kit, primary);

    const coverMat = new THREE.MeshPhysicalMaterial({
      map: coverTex.map,
      bumpMap: coverTex.bumpMap,
      bumpScale: 0.0006,
      roughness: 0.88,
      metalness: 0.02,
      sheen: 0.72,
      sheenRoughness: 0.75,
      sheenColor: shiftColor(THREE, primary, 0, -0.06, 0.22)
    });

    const endpaperMat = new THREE.MeshPhysicalMaterial({
      map: endpaperTex,
      roughness: 0.92,
      metalness: 0.0
    });

    const spreadMat = new THREE.MeshPhysicalMaterial({
      map: openSpreadTex.map,
      bumpMap: openSpreadTex.bumpMap,
      bumpScale: 0.00028,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.22,
      sheenColor: new THREE.Color('#fffdf7')
    });

    const spreadDoubleMat = new THREE.MeshPhysicalMaterial({
      map: openSpreadTex.map,
      bumpMap: openSpreadTex.bumpMap,
      bumpScale: 0.00028,
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    const edgeMat = new THREE.MeshPhysicalMaterial({
      map: pageEdgeTex.map,
      bumpMap: pageEdgeTex.bumpMap,
      bumpScale: 0.0004,
      roughness: 0.91,
      metalness: 0.0
    });

    // 1. Open sculpted hardback cover resting cleanly at y = 0
    const openCoverGeo = buildSculptedCover(THREE, { W, L, T, boardThick, isOpen: true });
    const openCoverMesh = new THREE.Mesh(openCoverGeo, [
      coverMat, coverMat, coverMat, endpaperMat, coverMat, coverMat
    ]);
    openCoverMesh.userData.slot = 'primary';
    openCoverMesh.castShadow = true;
    openCoverMesh.receiveShadow = true;
    openGroup.add(openCoverMesh);

    // 2. Left & Right sculpted arched page stacks
    const pageCfg = { pageW: 0.132, pageL: L - 0.011, boardThick };
    const stackMats = [edgeMat, edgeMat, spreadMat, edgeMat, edgeMat, edgeMat];

    const leftStack = new THREE.Mesh(buildOpenPageStack(THREE, -1, pageCfg), stackMats);
    leftStack.userData.slot = 'secondary';
    leftStack.castShadow = true;
    leftStack.receiveShadow = true;
    openGroup.add(leftStack);

    const rightStack = new THREE.Mesh(buildOpenPageStack(THREE, 1, pageCfg), stackMats);
    rightStack.userData.slot = 'secondary';
    rightStack.castShadow = true;
    rightStack.receiveShadow = true;
    openGroup.add(rightStack);

    // 3. Two gently lifted fanned top leaves (right leaf animated in idle)
    const leftLeaf = new THREE.Mesh(buildLooseCurledLeaf(THREE, -1, pageCfg), spreadDoubleMat);
    leftLeaf.userData.slot = 'secondary';
    leftLeaf.castShadow = true;
    leftLeaf.receiveShadow = true;
    openGroup.add(leftLeaf);

    const leafPivot = new THREE.Group();
    leafPivot.name = 'pageLeaf';
    leafPivot.userData.baseRotZ = 0;
    const rightLeaf = new THREE.Mesh(buildLooseCurledLeaf(THREE, 1, pageCfg), spreadDoubleMat);
    rightLeaf.userData.slot = 'secondary';
    rightLeaf.castShadow = true;
    rightLeaf.receiveShadow = true;
    leafPivot.add(rightLeaf);
    openGroup.add(leafPivot);

    // 4. Elastic band slipped neatly around right (back) cover board
    const elasticMat = new THREE.MeshPhysicalMaterial({
      map: elasticTex,
      roughness: 0.9,
      sheen: 0.65,
      sheenColor: shiftColor(THREE, primary, 0, -0.05, 0.14)
    });
    const bx = 0.118;
    const hL = L * 0.5;
    const openBandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, boardThick + 0.0022, -hL * 0.85),
      new THREE.Vector3(bx, boardThick + 0.0022, hL * 0.85),
      new THREE.Vector3(bx, boardThick * 0.5 + 0.001, hL + 0.0015),
      new THREE.Vector3(bx, 0.0007, hL * 0.85),
      new THREE.Vector3(bx, 0.0007, -hL * 0.85),
      new THREE.Vector3(bx, boardThick * 0.5 + 0.001, -hL - 0.0015)
    ], true, 'catmullrom', 0.25);
    const openBandMesh = new THREE.Mesh(buildRibbonLoft(THREE, openBandCurve, {
      steps: 56,
      width: 0.0084,
      thick: 0.001,
      closed: true,
      upHint: new THREE.Vector3(1, 0, 0),
      rollFn: () => Math.PI * 0.5
    }), elasticMat);
    openBandMesh.userData.slot = 'primary';
    openBandMesh.castShadow = true;
    openGroup.add(openBandMesh);

    // 5. Ribbon bookmark draped down the open gutter & curling onto desk
    const ribbonOpenPts = [
      new THREE.Vector3(0.0, boardThick + 0.0038, -L * 0.44),
      new THREE.Vector3(0.001, boardThick + 0.004, -L * 0.12),
      new THREE.Vector3(0.004, boardThick + 0.0044, L * 0.22),
      new THREE.Vector3(0.011, boardThick + 0.006, L * 0.46),
      new THREE.Vector3(0.018, 0.0035, L * 0.54),
      new THREE.Vector3(0.032, 0.0008, L * 0.63),
      new THREE.Vector3(0.056, 0.0007, L * 0.66),
      new THREE.Vector3(0.072, 0.0012, L * 0.61)
    ];
    const tail = buildRibbonBookmark(THREE, kit, accent, ribbonOpenPts, {
      rollFn: (t) => Math.sin(t * Math.PI * 1.3) * 0.16
    });
    openGroup.add(tail);

    // 6. Sticky-note tabs peeking from right page stack
    const tabGroup = new THREE.Group();
    tabGroup.name = 'stickyTabs';
    const inkHex = mixHex(THREE, primary, '#2c2226', 0.65);
    const tabPalette = [
      colHex(THREE, accent, '#d88c72'),
      '#' + shiftColor(THREE, accent, 0.09, -0.08, 0.12).getHexString(),
      '#' + shiftColor(THREE, accent, -0.14, -0.12, 0.14).getHexString()
    ];
    const openTabSpecs = [
      { z: -0.054, y: boardThick + 0.009, curl: 0.0028, twist: 0.0008, yaw: 0.04 },
      { z: -0.012, y: boardThick + 0.012, curl: -0.0016, twist: -0.0007, yaw: -0.03 },
      { z: 0.036, y: boardThick + 0.008, curl: 0.0032, twist: 0.0006, yaw: 0.06 }
    ];
    for (let i = 0; i < openTabSpecs.length; i++) {
      const s = openTabSpecs[i];
      const tMat = new THREE.MeshPhysicalMaterial({
        map: createStickyTexture(THREE, kit, tabPalette[i], inkHex),
        roughness: 0.9,
        sheen: 0.35,
        sheenColor: new THREE.Color('#fffaf2')
      });
      const tabMesh = new THREE.Mesh(buildStickyTab(THREE, 0.026, 0.014, s.curl, s.twist), tMat);
      tabMesh.position.set(0.122, s.y, s.z);
      tabMesh.rotation.y = s.yaw;
      tabMesh.userData.slot = 'accent';
      tabMesh.castShadow = true;
      tabGroup.add(tabMesh);
    }
    openGroup.add(tabGroup);

    // 7. Pen resting beside the open spread (angled cozily on the lower-right desk)
    const pen = buildCozyPen(THREE, primary, accent, secondary);
    pen.position.set(0.174, 0, 0.022);
    pen.rotation.y = -0.22;
    root.add(pen);

  } else if (variant === 2) {
    // =======================================================================
    // VARIANT 2: Cozy Stack of Two Hardback Notebooks + Pen
    // =======================================================================
    const bottomPrimary = '#' + shiftColor(THREE, primary, -0.04, -0.04, -0.1).getHexString();
    const bottomAccent = '#' + shiftColor(THREE, accent, 0.08, -0.06, 0.06).getHexString();

    const botW = W * 1.05;
    const botL = L * 1.04;
    const botT = T * 1.04;

    const bottomNB = buildClosedNotebook(THREE, kit, {
      W: botW,
      L: botL,
      T: botT,
      boardThick,
      primary: bottomPrimary,
      secondary,
      accent: bottomAccent,
      motifStyle: 1,
      hasElastic: true,
      stickyTabs: [
        { edge: 'right', offset: -0.048, yFrac: 0.42, curl: 0.0024, twist: 0.0006, yaw: 0.05 },
        { edge: 'right', offset: 0.046, yFrac: 0.68, curl: -0.0018, twist: -0.0005, yaw: -0.04 }
      ]
    });
    bottomNB.group.position.set(-0.016, 0, -0.004);
    bottomNB.group.rotation.y = 0.11;
    body.add(bottomNB.group);

    // Subtle secondary peeking ribbon on bottom notebook
    const botRibbonPts = [
      new THREE.Vector3(-0.032, 0.015, botL * 0.45),
      new THREE.Vector3(-0.036, 0.009, botL * 0.53),
      new THREE.Vector3(-0.048, 0.0014, botL * 0.61),
      new THREE.Vector3(-0.068, 0.0008, botL * 0.64)
    ];
    const botTail = buildRibbonBookmark(THREE, kit, bottomAccent, botRibbonPts, {
      name: 'tailBottom',
      steps: 32,
      width: 0.0076
    });
    bottomNB.group.add(botTail);

    // Top hero notebook stacked snugly on top with playful angle
    const topNB = buildClosedNotebook(THREE, kit, {
      W,
      L,
      T,
      boardThick,
      primary,
      secondary,
      accent,
      motifStyle: 0,
      hasElastic: true,
      stickyTabs: [
        { edge: 'right', offset: -0.052, yFrac: 0.35, curl: 0.0032, twist: 0.0007, yaw: 0.04 },
        { edge: 'right', offset: -0.012, yFrac: 0.64, curl: -0.002, twist: -0.0008, yaw: -0.03 },
        { edge: 'right', offset: 0.032, yFrac: 0.5, curl: 0.0026, twist: 0.0005, yaw: 0.07 },
        { edge: 'top', offset: 0.022, yFrac: 0.58, curl: 0.0025, twist: 0.0004, yaw: -0.05 }
      ]
    });
    const stackY = bottomNB.totalHeight;
    topNB.group.position.set(-0.02, stackY, 0.004);
    topNB.group.rotation.y = -0.18;
    body.add(topNB.group);

    // Cascading ribbon bookmark flowing off top book, down over lower book, curling on desk
    const cascadePts = [
      new THREE.Vector3(-0.024, stackY + T * 0.52, L * 0.46),
      new THREE.Vector3(-0.020, stackY + 0.011, L * 0.54),
      new THREE.Vector3(-0.012, stackY * 0.72, L * 0.60),
      new THREE.Vector3(-0.002, stackY * 0.25, L * 0.65),
      new THREE.Vector3(0.014, 0.0012, L * 0.71),
      new THREE.Vector3(0.038, 0.0008, L * 0.72),
      new THREE.Vector3(0.054, 0.0013, L * 0.66)
    ];
    const mainTail = buildRibbonBookmark(THREE, kit, accent, cascadePts, {
      steps: 60,
      rollFn: (t) => Math.sin(t * Math.PI * 1.4) * 0.24
    });
    body.add(mainTail);

    // Pen lying naturally beside the stacked notebooks
    const pen = buildCozyPen(THREE, primary, accent, secondary);
    pen.position.set(0.095, 0, 0.012);
    pen.rotation.y = -0.24;
    root.add(pen);

  } else {
    // =======================================================================
    // VARIANT 0: Closed Hero Hardback Diary + Ribbon + Sticky Tabs + Pen
    // =======================================================================
    const closedNB = buildClosedNotebook(THREE, kit, {
      W,
      L,
      T,
      boardThick,
      primary,
      secondary,
      accent,
      motifStyle: 0,
      hasElastic: true,
      stickyTabs: [
        { edge: 'right', offset: -0.056, yFrac: 0.34, curl: 0.0032, twist: 0.0008, yaw: 0.05 },
        { edge: 'right', offset: -0.018, yFrac: 0.62, curl: -0.0022, twist: -0.0007, yaw: -0.04 },
        { edge: 'right', offset: 0.026, yFrac: 0.48, curl: 0.0028, twist: 0.0006, yaw: 0.07 },
        { edge: 'top', offset: 0.018, yFrac: 0.56, curl: 0.0026, twist: 0.0005, yaw: -0.06 }
      ]
    });
    closedNB.group.position.set(-0.022, 0, -0.008);
    closedNB.group.rotation.y = -0.09;
    body.add(closedNB.group);

    // Ribbon bookmark emerging from bottom pages and curling gracefully on desk
    const ribbonPts = [
      new THREE.Vector3(-0.018, T * 0.48, L * 0.45),
      new THREE.Vector3(-0.014, T * 0.32, L * 0.525),
      new THREE.Vector3(-0.004, 0.0034, L * 0.595),
      new THREE.Vector3(0.014, 0.0008, L * 0.655),
      new THREE.Vector3(0.039, 0.0007, L * 0.675),
      new THREE.Vector3(0.058, 0.0011, L * 0.635),
      new THREE.Vector3(0.052, 0.0015, L * 0.595)
    ];
    const tail = buildRibbonBookmark(THREE, kit, accent, ribbonPts, {
      steps: 58,
      rollFn: (t) => Math.sin(t * Math.PI * 1.35) * 0.24
    });
    closedNB.group.add(tail);

    // Cozy stylised pen resting beside the diary
    const pen = buildCozyPen(THREE, primary, accent, secondary);
    pen.position.set(0.082, 0, 0.008);
    pen.rotation.y = -0.21;
    root.add(pen);
  }

  return root;
}

// ---------------------------------------------------------------------------
// Idle Animation: subtle dorm-breeze sway on ribbon & loose page corner
// ---------------------------------------------------------------------------

export function idle(group, t) {
  if (!group) return;

  const tail = group.getObjectByName('tail');
  if (tail) {
    const by = tail.userData.baseRotY || 0;
    const bx = tail.userData.baseRotX || 0;
    tail.rotation.y = by + Math.sin(t * 1.15) * 0.024 + Math.sin(t * 2.1) * 0.006;
    tail.rotation.x = bx + Math.sin(t * 0.85 + 0.9) * 0.006;
  }

  const tailBottom = group.getObjectByName('tailBottom');
  if (tailBottom) {
    tailBottom.rotation.y = Math.sin(t * 1.05 + 1.4) * 0.016;
  }

  const pageLeaf = group.getObjectByName('pageLeaf');
  if (pageLeaf) {
    const bz = pageLeaf.userData.baseRotZ || 0;
    pageLeaf.rotation.z = bz + Math.sin(t * 1.35) * 0.016 + Math.sin(t * 2.6 + 0.4) * 0.005;
  }

  const tabs = group.getObjectByName('stickyTabs');
  if (tabs) {
    tabs.rotation.x = Math.sin(t * 1.55 + 0.6) * 0.0035;
  }
}