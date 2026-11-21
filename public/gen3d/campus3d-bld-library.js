export const ENTRANCE = [0, 0.15, 3.38];

export function setHighlight(group, on) {
  const hl = group && group.userData && group.userData.highlight;
  if (!hl) return;
  const active = Boolean(on);

  for (let i = 0; i < hl.windows.length; i++) {
    const entry = hl.windows[i];
    if (active) {
      entry.mat.emissive.setRGB(entry.hiColor[0], entry.hiColor[1], entry.hiColor[2]);
      entry.mat.emissiveIntensity = entry.hiIntensity;
    } else {
      entry.mat.emissive.setRGB(entry.baseColor[0], entry.baseColor[1], entry.baseColor[2]);
      entry.mat.emissiveIntensity = entry.baseIntensity;
    }
  }

  for (let i = 0; i < hl.lamps.length; i++) {
    const entry = hl.lamps[i];
    if (active) {
      entry.mat.emissive.setRGB(entry.hiColor[0], entry.hiColor[1], entry.hiColor[2]);
      entry.mat.emissiveIntensity = entry.hiIntensity;
    } else {
      entry.mat.emissive.setRGB(entry.baseColor[0], entry.baseColor[1], entry.baseColor[2]);
      entry.mat.emissiveIntensity = entry.baseIntensity;
    }
  }

  for (let i = 0; i < hl.roofs.length; i++) {
    const entry = hl.roofs[i];
    if (active) {
      entry.mat.emissive.setRGB(entry.hiColor[0], entry.hiColor[1], entry.hiColor[2]);
      entry.mat.emissiveIntensity = entry.hiIntensity;
    } else {
      entry.mat.emissive.setRGB(entry.baseColor[0], entry.baseColor[1], entry.baseColor[2]);
      entry.mat.emissiveIntensity = entry.baseIntensity;
    }
  }
}

export function build(THREE, opts, kit) {
  const options = opts || {};
  const accentColor = new THREE.Color(
    options.accent !== undefined ? options.accent : 0x226d6d
  );

  const root = new THREE.Group();
  root.name = 'UniversityLibrary';

  const highlight = { windows: [], lamps: [], roofs: [] };
  root.userData.highlight = highlight;

  const textures = createTextures(THREE, kit, accentColor);
  const mats = createMaterials(THREE, textures, accentColor, highlight);

  const Z_CENTER = -0.20;
  const BASE_Y = 0.15;

  buildPavedBase(THREE, root, mats);
  buildMainStructure(THREE, root, mats, Z_CENTER, BASE_Y);
  buildPortico(THREE, root, mats, Z_CENTER, BASE_Y);
  buildWindows(THREE, root, mats, Z_CENTER);
  buildRoofAndDormers(THREE, root, mats, Z_CENTER);
  buildClockCupola(THREE, root, mats, Z_CENTER);
  buildBanners(THREE, root, mats, textures, accentColor);
  buildLampPosts(THREE, root, mats, BASE_Y);
  buildBookDrop(THREE, root, mats, BASE_Y);
  buildBikeRackAndBikes(THREE, root, mats, BASE_Y);
  buildGreeneryAndDetails(THREE, root, mats, Z_CENTER, BASE_Y);

  return root;
}

function setSRGB(THREE, tex) {
  if (THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}

function enableShadows(mesh, cast, receive) {
  mesh.castShadow = cast !== undefined ? cast : true;
  mesh.receiveShadow = receive !== undefined ? receive : true;
  return mesh;
}

function bevelBoxGeo(THREE, w, h, d, radius, bevel, curveSegs) {
  const b = Math.min(bevel !== undefined ? bevel : 0.02, w * 0.25, h * 0.25, d * 0.25);
  const iw = Math.max(0.004, w - b * 2);
  const id = Math.max(0.004, d - b * 2);
  const ih = Math.max(0.004, h - b * 2);
  const r = Math.min(Math.max(0.002, (radius !== undefined ? radius : b) - b), iw * 0.45, id * 0.45);
  const hw = iw * 0.5;
  const hd = id * 0.5;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: ih,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: curveSegs || 4
  });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function archFrameGeo(THREE, w, h, depth, thick, bevel, segs) {
  const rOut = w * 0.5;
  const rIn = Math.max(0.02, rOut - thick);
  const straightTop = h * 0.5 - rOut;
  const bot = -h * 0.5;
  const cs = segs || 7;

  const outer = new THREE.Shape();
  outer.moveTo(-rOut, bot);
  outer.lineTo(rOut, bot);
  outer.lineTo(rOut, straightTop);
  outer.absarc(0, straightTop, rOut, 0, Math.PI, false);
  outer.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-rIn, bot + thick * 0.85);
  hole.lineTo(rIn, bot + thick * 0.85);
  hole.lineTo(rIn, straightTop);
  hole.absarc(0, straightTop, rIn, 0, Math.PI, false);
  hole.closePath();
  outer.holes.push(hole);

  const b = bevel !== undefined ? bevel : 0.012;
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.01, depth - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 1,
    curveSegments: cs
  });
  geo.translate(0, 0, -(depth - b * 2) * 0.5);
  return geo;
}

function archPaneGeo(THREE, w, h, segs) {
  const r = w * 0.5;
  const straightTop = h * 0.5 - r;
  const bot = -h * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-r, bot);
  shape.lineTo(r, bot);
  shape.lineTo(r, straightTop);
  shape.absarc(0, straightTop, r, 0, Math.PI, false);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape, segs || 7);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w * 0.5) / w, (pos.getY(i) + h * 0.5) / h);
  }
  uv.needsUpdate = true;
  return geo;
}

function rectFrameGeo(THREE, w, h, depth, thick, bevel) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const r = 0.025;
  const outer = new THREE.Shape();
  outer.moveTo(-hw + r, -hh);
  outer.lineTo(hw - r, -hh);
  outer.quadraticCurveTo(hw, -hh, hw, -hh + r);
  outer.lineTo(hw, hh - r);
  outer.quadraticCurveTo(hw, hh, hw - r, hh);
  outer.lineTo(-hw + r, hh);
  outer.quadraticCurveTo(-hw, hh, -hw, hh - r);
  outer.lineTo(-hw, -hh + r);
  outer.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const ihw = hw - thick;
  const ihh = hh - thick;
  const hole = new THREE.Path();
  hole.moveTo(-ihw, -ihh);
  hole.lineTo(ihw, -ihh);
  hole.lineTo(ihw, ihh);
  hole.lineTo(-ihw, ihh);
  hole.closePath();
  outer.holes.push(hole);

  const b = bevel !== undefined ? bevel : 0.01;
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.01, depth - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 1,
    curveSegments: 3
  });
  geo.translate(0, 0, -(depth - b * 2) * 0.5);
  return geo;
}

function createTextures(THREE, kit, accentColor) {
  // 1. Red brick texture
  const brick = setSRGB(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c9bba8';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const cols = 4;
      const rh = h / rows;
      const cw = w / cols;
      const mortar = 3;
      const tones = ['#9d4839', '#8f3e31', '#aa5442', '#954234', '#b15c47', '#86382c'];
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (cw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * cw + offset + mortar * 0.5;
          const y = r * rh + mortar * 0.5;
          const bw = cw - mortar;
          const bh = rh - mortar;
          const idx = Math.abs(r * 7 + c * 13) % tones.length;
          ctx.fillStyle = tones[idx];
          ctx.fillRect(x, y, bw, bh);
          const grad = ctx.createLinearGradient(x, y, x, y + bh);
          grad.addColorStop(0, 'rgba(255,235,215,0.10)');
          grad.addColorStop(1, 'rgba(40,12,8,0.14)');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, bw, bh);
        }
      }
      ctx.fillStyle = 'rgba(255,245,230,0.06)';
      for (let i = 0; i < 160; i++) {
        const sx = ((i * 73) % w);
        const sy = ((i * 137) % h);
        ctx.fillRect(sx, sy, 3, 2);
      }
    })
  );
  brick.wrapS = THREE.RepeatWrapping;
  brick.wrapT = THREE.RepeatWrapping;
  brick.repeat.set(0.85, 0.85);

  // 2. Limestone ashlar texture
  const stone = setSRGB(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#b9ae9c';
      ctx.fillRect(0, 0, w, h);
      const rows = 4;
      const cols = 3;
      const rh = h / rows;
      const cw = w / cols;
      const gap = 4;
      const shades = ['#dbd2c3', '#d4cab9', '#e0d8ca', '#cec3b1', '#d8cfc0'];
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (cw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * cw + off + gap * 0.5;
          const y = r * rh + gap * 0.5;
          const bw = cw - gap;
          const bh = rh - gap;
          ctx.fillStyle = shades[Math.abs(r * 5 + c * 11) % shades.length];
          ctx.fillRect(x, y, bw, bh);
          ctx.fillStyle = 'rgba(255,255,250,0.16)';
          ctx.fillRect(x, y, bw, 3);
          ctx.fillStyle = 'rgba(80,68,54,0.14)';
          ctx.fillRect(x, y + bh - 4, bw, 4);
        }
      }
    })
  );
  stone.wrapS = THREE.RepeatWrapping;
  stone.wrapT = THREE.RepeatWrapping;
  stone.repeat.set(0.75, 0.75);

  // 3. Paved plaza flagstone texture
  const paving = setSRGB(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#a89f90';
      ctx.fillRect(0, 0, w, h);
      const rows = 4;
      const cols = 4;
      const rh = h / rows;
      const cw = w / cols;
      const shades = ['#cfc6b8', '#c6bdb0', '#d5cdc0', '#bfb6a8', '#cbc2b4'];
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (cw * 0.45);
        for (let c = -1; c <= cols; c++) {
          const x = c * cw + off + 3;
          const y = r * rh + 3;
          const bw = cw - 6;
          const bh = rh - 6;
          ctx.fillStyle = shades[Math.abs(r * 9 + c * 5) % shades.length];
          ctx.beginPath();
          ctx.roundRect(x, y, bw, bh, 5);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,252,245,0.12)';
          ctx.fillRect(x + 3, y + 2, bw - 6, 3);
        }
      }
    })
  );
  paving.wrapS = THREE.RepeatWrapping;
  paving.wrapT = THREE.RepeatWrapping;
  paving.repeat.set(0.65, 0.65);

  // 4. Slate / shingle roof tiles (neutral light grayscale so accentColor tints cleanly)
  const roofTiles = setSRGB(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#cfd7d7';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const cols = 6;
      const rh = h / rows;
      const cw = w / cols;
      const tones = ['#e4ecec', '#d7e1e1', '#edf3f3', '#ccd7d7', '#dde7e7'];
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (cw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * cw + off;
          const y = r * rh;
          ctx.fillStyle = tones[Math.abs(r * 7 + c * 3) % tones.length];
          ctx.fillRect(x + 1, y + 1, cw - 2, rh - 1);
          const g = ctx.createLinearGradient(x, y, x, y + rh);
          g.addColorStop(0, 'rgba(255,255,255,0.12)');
          g.addColorStop(0.75, 'rgba(0,0,0,0.03)');
          g.addColorStop(1, 'rgba(0,0,0,0.22)');
          ctx.fillStyle = g;
          ctx.fillRect(x + 1, y + 1, cw - 2, rh - 1);
          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          ctx.fillRect(x, y, 2, rh);
        }
      }
    })
  );
  roofTiles.wrapS = THREE.RepeatWrapping;
  roofTiles.wrapT = THREE.RepeatWrapping;
  roofTiles.repeat.set(1.0, 1.0);

  // 5. Warm glowing reading-room window with visible bookshelves behind glass
  const bookshelfWindow = setSRGB(
    THREE,
    kit.canvasTexture(256, 384, (ctx, w, h) => {
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.28, 12, w * 0.5, h * 0.45, h * 0.65);
      bg.addColorStop(0, '#fff2c2');
      bg.addColorStop(0.45, '#ffcf78');
      bg.addColorStop(1, '#d4863b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Warm hanging reading-room globe glow in upper arch
      const lamp = ctx.createRadialGradient(w * 0.5, h * 0.21, 4, w * 0.5, h * 0.21, 56);
      lamp.addColorStop(0, 'rgba(255,255,240,0.95)');
      lamp.addColorStop(0.4, 'rgba(255,232,160,0.55)');
      lamp.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, w, h * 0.45);

      // Bookcase frame & bays in warm dark mahogany silhouette
      const shelfTop = h * 0.34;
      const shelfCount = 4;
      const shelfSpan = (h - shelfTop - 16) / shelfCount;
      const bookColors = [
        '#6a2620', '#2b4d46', '#7d4d25', '#343b5c',
        '#8c3c2e', '#4d3a2c', '#5e2c3b', '#3f5a44'
      ];

      // Draw books on each shelf
      for (let s = 0; s < shelfCount; s++) {
        const sy = shelfTop + (s + 1) * shelfSpan;
        let bx = 18;
        let bi = s * 11;
        while (bx < w - 22) {
          bi++;
          if (bi % 7 === 0) {
            bx += 12; // occasional cozy gap letting golden light peek through
            continue;
          }
          const bw = 9 + ((bi * 5) % 9);
          const bh = shelfSpan * (0.56 + ((bi * 13) % 30) * 0.01);
          if (bx + bw > w - 18) break;
          ctx.fillStyle = bookColors[bi % bookColors.length];
          ctx.save();
          if (bi % 9 === 0) {
            ctx.translate(bx + bw * 0.5, sy - 4);
            ctx.rotate(0.14);
            ctx.fillRect(-bw * 0.5, -bh, bw, bh);
          } else {
            ctx.fillRect(bx, sy - bh - 4, bw, bh);
          }
          ctx.restore();
          bx += bw + 1.5;
        }
        // Horizontal wooden shelf plank
        ctx.fillStyle = '#47281a';
        ctx.fillRect(10, sy - 5, w - 20, 8);
        ctx.fillStyle = 'rgba(255,200,120,0.22)';
        ctx.fillRect(10, sy - 5, w - 20, 2);
      }

      // Vertical bookcase dividers
      ctx.fillStyle = '#3f2216';
      ctx.fillRect(8, shelfTop - 6, 12, h - shelfTop + 6);
      ctx.fillRect(w - 20, shelfTop - 6, 12, h - shelfTop + 6);
      ctx.fillRect(w * 0.5 - 5, shelfTop, 10, h - shelfTop);
      ctx.fillRect(8, shelfTop - 8, w - 16, 10);

      // Subtle warm glass diagonal sheen
      const sheen = ctx.createLinearGradient(0, 0, w, h);
      sheen.addColorStop(0, 'rgba(255,250,235,0.16)');
      sheen.addColorStop(0.45, 'rgba(255,250,235,0.02)');
      sheen.addColorStop(1, 'rgba(90,45,15,0.16)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);
    })
  );
  bookshelfWindow.wrapS = THREE.ClampToEdgeWrapping;
  bookshelfWindow.wrapT = THREE.ClampToEdgeWrapping;

  // 6. Warm wood texture
  const wood = setSRGB(
    THREE,
    kit.canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#6f452c';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 36; i++) {
        const y = (i / 36) * h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(42,22,12,0.18)' : 'rgba(165,112,72,0.14)';
        ctx.fillRect(0, y, w, 2 + (i % 3));
      }
    })
  );
  wood.wrapS = THREE.RepeatWrapping;
  wood.wrapT = THREE.RepeatWrapping;

  // 7. Banner texture with open-book symbol (no text/letters)
  const bannerBg = accentColor.clone().multiplyScalar(0.82);
  const bannerTex = setSRGB(
    THREE,
    kit.canvasTexture(256, 512, (ctx, w, h) => {
      ctx.fillStyle = '#' + bannerBg.getHexString();
      ctx.fillRect(0, 0, w, h);

      // Subtle woven fabric shading
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.16)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Decorative double gold border
      ctx.strokeStyle = '#e7c982';
      ctx.lineWidth = 8;
      ctx.strokeRect(18, 22, w - 36, h - 56);
      ctx.lineWidth = 3;
      ctx.strokeRect(30, 34, w - 60, h - 80);

      // Diamond emblem star above book
      ctx.fillStyle = '#f4dfb0';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 96);
      ctx.lineTo(w * 0.5 + 16, 122);
      ctx.lineTo(w * 0.5, 148);
      ctx.lineTo(w * 0.5 - 16, 122);
      ctx.closePath();
      ctx.fill();

      // Open-book symbol
      const cx = w * 0.5;
      const cy = h * 0.50;
      ctx.strokeStyle = '#f6e7c1';
      ctx.fillStyle = '#f6e7c1';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Left page
      ctx.beginPath();
      ctx.moveTo(cx, cy - 32);
      ctx.quadraticCurveTo(cx - 38, cy - 52, cx - 76, cy - 34);
      ctx.lineTo(cx - 76, cy + 44);
      ctx.quadraticCurveTo(cx - 38, cy + 28, cx, cy + 48);
      ctx.closePath();
      ctx.fill();

      // Right page
      ctx.beginPath();
      ctx.moveTo(cx, cy - 32);
      ctx.quadraticCurveTo(cx + 38, cy - 52, cx + 76, cy - 34);
      ctx.lineTo(cx + 76, cy + 44);
      ctx.quadraticCurveTo(cx + 38, cy + 28, cx, cy + 48);
      ctx.closePath();
      ctx.fill();

      // Center spine groove & subtle page lines
      ctx.strokeStyle = '#' + bannerBg.getHexString();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 34);
      ctx.lineTo(cx, cy + 50);
      ctx.stroke();

      ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) {
        const ly = cy - 12 + k * 18;
        ctx.beginPath();
        ctx.moveTo(cx - 60, ly);
        ctx.quadraticCurveTo(cx - 36, ly - 8, cx - 14, ly + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 60, ly);
        ctx.quadraticCurveTo(cx + 36, ly - 8, cx + 14, ly + 2);
        ctx.stroke();
      }

      // Book cover cradle underneath
      ctx.strokeStyle = '#e7c982';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx - 86, cy + 46);
      ctx.quadraticCurveTo(cx - 42, cy + 40, cx, cy + 62);
      ctx.quadraticCurveTo(cx + 42, cy + 40, cx + 86, cy + 46);
      ctx.stroke();

      // Decorative chevron at bottom
      ctx.strokeStyle = '#e7c982';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 46, h - 115);
      ctx.lineTo(cx, h - 82);
      ctx.lineTo(cx + 46, h - 115);
      ctx.stroke();
    })
  );
  bannerTex.wrapS = THREE.ClampToEdgeWrapping;
  bannerTex.wrapT = THREE.ClampToEdgeWrapping;

  // 8. Clock dial texture (radial ticks & hands only, no text/numbers)
  const clockFace = setSRGB(
    THREE,
    kit.canvasTexture(256, 256, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const rad = w * 0.46;
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, rad);
      g.addColorStop(0, '#fffdf4');
      g.addColorStop(0.85, '#f4ebd4');
      g.addColorStop(1, '#d8c9a8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#5c4b36';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 0.88, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI * 0.5;
        const major = i % 3 === 0;
        const r1 = rad * (major ? 0.67 : 0.74);
        const r2 = rad * 0.85;
        ctx.strokeStyle = '#2d241b';
        ctx.lineWidth = major ? 8 : 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
      }

      // Clock hands (10:10)
      ctx.strokeStyle = '#231c15';
      ctx.lineCap = 'round';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - rad * 0.44, cy - rad * 0.25);
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + rad * 0.56, cy - rad * 0.34);
      ctx.stroke();

      ctx.fillStyle = '#c99c46';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
    })
  );

  // 9. Book-drop front emblem (open-book symbol + slot arrow, no text)
  const bookDropFront = setSRGB(
    THREE,
    kit.canvasTexture(128, 128, (ctx, w, h) => {
      const col = accentColor.clone().multiplyScalar(0.68);
      ctx.fillStyle = '#' + col.getHexString();
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e6c882';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // Small open book icon
      const cx = w * 0.5;
      const cy = h * 0.52;
      ctx.fillStyle = '#f5e6c4';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.quadraticCurveTo(cx - 18, cy - 22, cx - 32, cy - 14);
      ctx.lineTo(cx - 32, cy + 16);
      ctx.quadraticCurveTo(cx - 16, cy + 10, cx, cy + 18);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.quadraticCurveTo(cx + 18, cy - 22, cx + 32, cy - 14);
      ctx.lineTo(cx + 32, cy + 16);
      ctx.quadraticCurveTo(cx + 16, cy + 10, cx, cy + 18);
      ctx.closePath();
      ctx.fill();
    })
  );

  return {
    brick,
    stone,
    paving,
    roofTiles,
    bookshelfWindow,
    wood,
    bannerTex,
    clockFace,
    bookDropFront
  };
}

function createMaterials(THREE, tex, accentColor, highlight) {
  const brick = new THREE.MeshStandardMaterial({
    map: tex.brick,
    roughness: 0.84,
    metalness: 0.02
  });

  const stone = new THREE.MeshStandardMaterial({
    map: tex.stone,
    roughness: 0.80,
    metalness: 0.02
  });

  const stoneTrim = new THREE.MeshStandardMaterial({
    color: 0xe3dac9,
    roughness: 0.72,
    metalness: 0.02
  });

  const paving = new THREE.MeshStandardMaterial({
    map: tex.paving,
    roughness: 0.88,
    metalness: 0.02
  });

  const curbStone = new THREE.MeshStandardMaterial({
    color: 0xc8bfb0,
    roughness: 0.82,
    metalness: 0.02
  });

  const roofHiTint = accentColor.clone().lerp(new THREE.Color(0x98f2e8), 0.35);

  const roof = new THREE.MeshStandardMaterial({
    color: accentColor.clone(),
    map: tex.roofTiles,
    roughness: 0.56,
    metalness: 0.12,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0
  });
  highlight.roofs.push({
    mat: roof,
    baseColor: [0, 0, 0],
    baseIntensity: 0,
    hiColor: [roofHiTint.r, roofHiTint.g, roofHiTint.b],
    hiIntensity: 0.32
  });

  const roofTrim = new THREE.MeshStandardMaterial({
    color: accentColor.clone().multiplyScalar(0.84),
    roughness: 0.45,
    metalness: 0.25,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0
  });
  highlight.roofs.push({
    mat: roofTrim,
    baseColor: [0, 0, 0],
    baseIntensity: 0,
    hiColor: [roofHiTint.r, roofHiTint.g, roofHiTint.b],
    hiIntensity: 0.28
  });

  const winBookshelf = new THREE.MeshStandardMaterial({
    map: tex.bookshelfWindow,
    emissiveMap: tex.bookshelfWindow,
    emissive: new THREE.Color(0xffbd6b),
    emissiveIntensity: 0.95,
    roughness: 0.18,
    metalness: 0.08
  });
  highlight.windows.push({
    mat: winBookshelf,
    baseColor: [1.0, 0.74, 0.42],
    baseIntensity: 0.95,
    hiColor: [1.0, 0.86, 0.55],
    hiIntensity: 1.95
  });

  const winWarm = new THREE.MeshStandardMaterial({
    color: 0xffe4ad,
    emissive: new THREE.Color(0xffb85c),
    emissiveIntensity: 0.88,
    roughness: 0.20,
    metalness: 0.06
  });
  highlight.windows.push({
    mat: winWarm,
    baseColor: [1.0, 0.72, 0.36],
    baseIntensity: 0.88,
    hiColor: [1.0, 0.86, 0.55],
    hiIntensity: 1.85
  });

  const lampGlobe = new THREE.MeshStandardMaterial({
    color: 0xfff5d8,
    emissive: new THREE.Color(0xffcf7a),
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.04
  });
  highlight.lamps.push({
    mat: lampGlobe,
    baseColor: [1.0, 0.81, 0.48],
    baseIntensity: 1.35,
    hiColor: [1.0, 0.92, 0.68],
    hiIntensity: 2.65
  });

  const wood = new THREE.MeshStandardMaterial({
    map: tex.wood,
    roughness: 0.65,
    metalness: 0.05
  });

  const windowMullion = new THREE.MeshStandardMaterial({
    color: 0xf0e7d6,
    roughness: 0.60,
    metalness: 0.04
  });

  const iron = new THREE.MeshStandardMaterial({
    color: 0x2c3236,
    roughness: 0.45,
    metalness: 0.65
  });

  const brass = new THREE.MeshStandardMaterial({
    color: 0xd4aa52,
    roughness: 0.32,
    metalness: 0.78
  });

  const clockFace = new THREE.MeshStandardMaterial({
    map: tex.clockFace,
    emissive: new THREE.Color(0xffdf9e),
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.05
  });
  highlight.windows.push({
    mat: clockFace,
    baseColor: [1.0, 0.87, 0.62],
    baseIntensity: 0.35,
    hiColor: [1.0, 0.92, 0.72],
    hiIntensity: 0.85
  });

  const bookDropMetal = new THREE.MeshStandardMaterial({
    color: accentColor.clone().multiplyScalar(0.68),
    roughness: 0.42,
    metalness: 0.35
  });

  const bookDropEmblem = new THREE.MeshStandardMaterial({
    map: tex.bookDropFront,
    roughness: 0.42,
    metalness: 0.32
  });

  const foliageA = new THREE.MeshStandardMaterial({
    color: 0x4c7c48,
    roughness: 0.86,
    metalness: 0.02
  });

  const foliageB = new THREE.MeshStandardMaterial({
    color: 0x5d8d52,
    roughness: 0.84,
    metalness: 0.02
  });

  return {
    brick,
    stone,
    stoneTrim,
    paving,
    curbStone,
    roof,
    roofTrim,
    winBookshelf,
    winWarm,
    lampGlobe,
    wood,
    windowMullion,
    iron,
    brass,
    clockFace,
    bookDropMetal,
    bookDropEmblem,
    foliageA,
    foliageB
  };
}

function buildPavedBase(THREE, root, mats) {
  // Paved base 8 wide (x) by 7 deep (z) and 0.15 high
  const baseGeo = bevelBoxGeo(THREE, 8.0, 0.15, 7.0, 0.18, 0.035, 5);
  const baseMesh = enableShadows(new THREE.Mesh(baseGeo, mats.paving), false, true);
  baseMesh.position.set(0, 0.075, 0);
  root.add(baseMesh);

  // Subtle decorative stone walkway pad leading to the entrance steps
  const runnerGeo = bevelBoxGeo(THREE, 2.7, 0.022, 1.0, 0.06, 0.008, 4);
  const runner = enableShadows(new THREE.Mesh(runnerGeo, mats.curbStone), false, true);
  runner.position.set(0, 0.151, 3.00);
  root.add(runner);
}

function buildMainStructure(THREE, root, mats, zc, baseY) {
  const W = 6.80;
  const D = 4.60;

  // Water-table stone plinth
  const plinth = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W + 0.16, 0.18, D + 0.16, 0.06, 0.025), mats.stoneTrim)
  );
  plinth.position.set(0, baseY + 0.09, zc);
  root.add(plinth);

  // Stone ground floor (y = 0.30 to 1.12)
  const groundH = 0.86;
  const groundMesh = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W, groundH, D, 0.05, 0.02), mats.stone)
  );
  groundMesh.position.set(0, baseY + 0.16 + groundH * 0.5, zc);
  root.add(groundMesh);

  // Front & rear central subtle projecting bays (stone ground)
  const frontBayStone = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 2.84, groundH, 0.34, 0.04, 0.02), mats.stone)
  );
  frontBayStone.position.set(0, baseY + 0.16 + groundH * 0.5, zc + D * 0.5 + 0.04);
  root.add(frontBayStone);

  const rearBayStone = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 2.76, groundH, 0.36, 0.04, 0.02), mats.stone)
  );
  rearBayStone.position.set(0, baseY + 0.16 + groundH * 0.5, zc - D * 0.5 - 0.05);
  root.add(rearBayStone);

  // Stone belt course separating stone ground floor and red brick storeys
  const beltY = 1.17;
  const belt = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W + 0.16, 0.11, D + 0.16, 0.06, 0.025), mats.stoneTrim)
  );
  belt.position.set(0, beltY, zc);
  root.add(belt);

  const rearBelt = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 2.90, 0.11, 0.38, 0.05, 0.022), mats.stoneTrim)
  );
  rearBelt.position.set(0, beltY, zc - D * 0.5 - 0.05);
  root.add(rearBelt);

  // Three storeys of red brick (y = 1.22 to 4.18 -> height 2.96)
  const brickH = 2.96;
  const brickCenterY = 1.22 + brickH * 0.5;
  const brickMain = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W, brickH, D, 0.05, 0.02), mats.brick)
  );
  brickMain.position.set(0, brickCenterY, zc);
  root.add(brickMain);

  // Front & rear central bays in brick
  const frontBayBrick = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 2.80, brickH, 0.30, 0.04, 0.018), mats.brick)
  );
  frontBayBrick.position.set(0, brickCenterY, zc + D * 0.5 + 0.02);
  root.add(frontBayBrick);

  const rearBayBrick = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 2.72, brickH, 0.34, 0.04, 0.018), mats.brick)
  );
  rearBayBrick.position.set(0, brickCenterY, zc - D * 0.5 - 0.04);
  root.add(rearBayBrick);

  // Subtle horizontal stone stringcourses delineating brick storeys 1, 2, and 3
  const band2 = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W + 0.08, 0.055, D + 0.08, 0.04, 0.014), mats.stoneTrim)
  );
  band2.position.set(0, 2.31, zc);
  root.add(band2);

  const band3 = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W + 0.08, 0.055, D + 0.08, 0.04, 0.014), mats.stoneTrim)
  );
  band3.position.set(0, 3.35, zc);
  root.add(band3);

  // Classical top cornice & frieze (y = 4.18 to 4.39)
  const frieze = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W + 0.10, 0.10, D + 0.10, 0.05, 0.02), mats.stoneTrim)
  );
  frieze.position.set(0, 4.22, zc);
  root.add(frieze);

  const topCornice = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, W + 0.32, 0.11, D + 0.32, 0.07, 0.028), mats.stoneTrim)
  );
  topCornice.position.set(0, 4.335, zc);
  root.add(topCornice);

  // Corner stone quoins (InstancedMesh)
  const quoinGeo = bevelBoxGeo(THREE, 0.24, 0.16, 0.24, 0.03, 0.014, 2);
  const quoinPositions = [];
  const corners = [
    [-W * 0.5 + 0.08, zc + D * 0.5 - 0.08],
    [W * 0.5 - 0.08, zc + D * 0.5 - 0.08],
    [-W * 0.5 + 0.08, zc - D * 0.5 + 0.08],
    [W * 0.5 - 0.08, zc - D * 0.5 + 0.08]
  ];
  for (let c = 0; c < corners.length; c++) {
    for (let r = 0; r < 12; r++) {
      const qy = 1.34 + r * 0.245;
      const sx = r % 2 === 0 ? 1.25 : 0.85;
      const sz = r % 2 === 0 ? 0.85 : 1.25;
      quoinPositions.push({ x: corners[c][0], y: qy, z: corners[c][1], sx, sz });
    }
  }
  const quoinInst = enableShadows(new THREE.InstancedMesh(quoinGeo, mats.stoneTrim, quoinPositions.length));
  const dummy = new THREE.Object3D();
  for (let i = 0; i < quoinPositions.length; i++) {
    const q = quoinPositions[i];
    dummy.position.set(q.x, q.y, q.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(q.sx, 1, q.sz);
    dummy.updateMatrix();
    quoinInst.setMatrixAt(i, dummy.matrix);
  }
  quoinInst.instanceMatrix.needsUpdate = true;
  root.add(quoinInst);

  // Classical dentils beneath top cornice (InstancedMesh)
  const dentilGeo = bevelBoxGeo(THREE, 0.075, 0.065, 0.075, 0.015, 0.008, 2);
  const dentilCoords = [];
  for (let x = -3.22; x <= 3.23; x += 0.22) {
    dentilCoords.push([x, 4.265, zc + D * 0.5 + 0.07]);
    dentilCoords.push([x, 4.265, zc - D * 0.5 - 0.07]);
  }
  for (let z = zc - 2.12; z <= zc + 2.13; z += 0.22) {
    dentilCoords.push([W * 0.5 + 0.07, 4.265, z]);
    dentilCoords.push([-W * 0.5 - 0.07, 4.265, z]);
  }
  const dentilInst = enableShadows(new THREE.InstancedMesh(dentilGeo, mats.stoneTrim, dentilCoords.length), false, true);
  dummy.scale.set(1, 1, 1);
  for (let i = 0; i < dentilCoords.length; i++) {
    dummy.position.set(dentilCoords[i][0], dentilCoords[i][1], dentilCoords[i][2]);
    dummy.updateMatrix();
    dentilInst.setMatrixAt(i, dummy.matrix);
  }
  dentilInst.instanceMatrix.needsUpdate = true;
  root.add(dentilInst);
}

function buildPortico(THREE, root, mats, zc, baseY) {
  const frontWallZ = zc + 2.30; // +2.10
  const deckTop = 0.72;
  const deckH = deckTop - baseY;

  // Portico stone platform
  const deck = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 3.04, deckH, 0.86, 0.06, 0.025), mats.stone)
  );
  deck.position.set(0, baseY + deckH * 0.5, frontWallZ + 0.43);
  root.add(deck);

  const deckCap = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 3.12, 0.06, 0.92, 0.06, 0.02), mats.stoneTrim)
  );
  deckCap.position.set(0, deckTop - 0.02, frontWallZ + 0.43);
  root.add(deckCap);

  // Wide sweeping stone steps on +z side (4 rounded steps)
  const stepCount = 4;
  const stepH = deckH / stepCount;
  for (let i = 0; i < stepCount; i++) {
    const sh = stepH * (stepCount - i);
    const sz = frontWallZ + 0.86 + (i + 0.5) * 0.115;
    const sw = 2.48 + i * 0.06;
    const step = enableShadows(
      new THREE.Mesh(bevelBoxGeo(THREE, sw, sh, 0.135, 0.03, 0.015), mats.stoneTrim)
    );
    step.position.set(0, baseY + sh * 0.5, sz);
    root.add(step);
  }

  // Flanking step cheek walls with decorative stone orbs
  const cheekGeo = bevelBoxGeo(THREE, 0.22, 0.42, 0.56, 0.04, 0.02);
  const orbGeo = new THREE.SphereGeometry(0.095, 14, 10);
  const orbBaseGeo = new THREE.CylinderGeometry(0.085, 0.10, 0.05, 12);
  for (let side = -1; side <= 1; side += 2) {
    const cx = side * 1.42;
    const cz = frontWallZ + 1.06;
    const cheek = enableShadows(new THREE.Mesh(cheekGeo, mats.stone));
    cheek.position.set(cx, baseY + 0.21, cz);
    root.add(cheek);

    const cheekCap = enableShadows(
      new THREE.Mesh(bevelBoxGeo(THREE, 0.26, 0.055, 0.60, 0.04, 0.015), mats.stoneTrim)
    );
    cheekCap.position.set(cx, baseY + 0.43, cz);
    root.add(cheekCap);

    const ob = enableShadows(new THREE.Mesh(orbBaseGeo, mats.stoneTrim));
    ob.position.set(cx, baseY + 0.48, cz + 0.16);
    root.add(ob);

    const orb = enableShadows(new THREE.Mesh(orbGeo, mats.stoneTrim));
    orb.position.set(cx, baseY + 0.58, cz + 0.16);
    root.add(orb);
  }

  // Classical Lathe columns (4 freestanding + 2 engaged rear pilasters)
  const colPts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.155, 0.0),
    new THREE.Vector2(0.155, 0.07),
    new THREE.Vector2(0.135, 0.11),
    new THREE.Vector2(0.145, 0.15),
    new THREE.Vector2(0.112, 0.19),
    new THREE.Vector2(0.115, 0.90),
    new THREE.Vector2(0.105, 1.70),
    new THREE.Vector2(0.095, 2.15),
    new THREE.Vector2(0.118, 2.21),
    new THREE.Vector2(0.148, 2.28),
    new THREE.Vector2(0.155, 2.35),
    new THREE.Vector2(0.001, 2.35)
  ];
  const colGeo = new THREE.LatheGeometry(colPts, 16);
  const plinthGeo = bevelBoxGeo(THREE, 0.34, 0.08, 0.34, 0.03, 0.014);
  const abacusGeo = bevelBoxGeo(THREE, 0.34, 0.07, 0.34, 0.03, 0.014);

  const colXs = [-1.20, -0.44, 0.44, 1.20];
  const colZ = frontWallZ + 0.68;
  for (let i = 0; i < colXs.length; i++) {
    const x = colXs[i];
    const pl = enableShadows(new THREE.Mesh(plinthGeo, mats.stoneTrim));
    pl.position.set(x, deckTop + 0.04, colZ);
    root.add(pl);

    const col = enableShadows(new THREE.Mesh(colGeo, mats.stoneTrim));
    col.position.set(x, deckTop + 0.07, colZ);
    root.add(col);

    const ab = enableShadows(new THREE.Mesh(abacusGeo, mats.stoneTrim));
    ab.position.set(x, deckTop + 2.41, colZ);
    root.add(ab);
  }

  // Engaged pilasters against the front wall
  const pilGeo = bevelBoxGeo(THREE, 0.24, 2.36, 0.14, 0.03, 0.015);
  for (let side = -1; side <= 1; side += 2) {
    const pil = enableShadows(new THREE.Mesh(pilGeo, mats.stoneTrim));
    pil.position.set(side * 1.20, deckTop + 1.22, frontWallZ + 0.18);
    root.add(pil);
  }

  // Portico entablature & roof deck
  const entY = deckTop + 2.52; // 3.24
  const entablature = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 3.08, 0.22, 0.94, 0.05, 0.02), mats.stoneTrim)
  );
  entablature.position.set(0, entY, frontWallZ + 0.45);
  root.add(entablature);

  const porticoCornice = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 3.26, 0.08, 1.06, 0.06, 0.022), mats.stoneTrim)
  );
  porticoCornice.position.set(0, entY + 0.14, frontWallZ + 0.48);
  root.add(porticoCornice);

  // Triangular Classical Pediment (extruded bevelled triangle + teal roof slopes)
  const pedW = 3.16;
  const pedH = 0.66;
  const pedShape = new THREE.Shape();
  pedShape.moveTo(-pedW * 0.5, 0);
  pedShape.lineTo(pedW * 0.5, 0);
  pedShape.lineTo(0, pedH);
  pedShape.closePath();

  const pedBodyGeo = new THREE.ExtrudeGeometry(pedShape, {
    depth: 0.88,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2
  });
  const pedBody = enableShadows(new THREE.Mesh(pedBodyGeo, mats.stoneTrim));
  pedBody.position.set(0, entY + 0.16, frontWallZ + 0.02);
  root.add(pedBody);

  // Recessed tympanum face + decorative stone rosette medallion (no text)
  const tympShape = new THREE.Shape();
  tympShape.moveTo(-pedW * 0.41, 0.05);
  tympShape.lineTo(pedW * 0.41, 0.05);
  tympShape.lineTo(0, pedH - 0.10);
  tympShape.closePath();
  const tympGeo = new THREE.ExtrudeGeometry(tympShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1
  });
  const tymp = enableShadows(new THREE.Mesh(tympGeo, mats.stone));
  tymp.position.set(0, entY + 0.16, frontWallZ + 0.90);
  root.add(tymp);

  const rosette = enableShadows(
    new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 10, 18), mats.brass)
  );
  rosette.position.set(0, entY + 0.39, frontWallZ + 0.95);
  root.add(rosette);
  const rosetteCore = enableShadows(
    new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), mats.stoneTrim)
  );
  rosetteCore.scale.set(1, 1, 0.45);
  rosetteCore.position.set(0, entY + 0.39, frontWallZ + 0.95);
  root.add(rosetteCore);

  // Raking cornice & teal roof plates on pediment
  const slopeLen = Math.hypot(pedW * 0.5 + 0.12, pedH + 0.06);
  const slopeAng = Math.atan2(pedH, pedW * 0.5);
  const pedRoofGeo = bevelBoxGeo(THREE, slopeLen, 0.065, 1.04, 0.03, 0.015);
  for (let side = -1; side <= 1; side += 2) {
    const slab = enableShadows(new THREE.Mesh(pedRoofGeo, mats.roof));
    slab.position.set(side * (pedW * 0.25 + 0.03), entY + 0.18 + pedH * 0.52, frontWallZ + 0.48);
    slab.rotation.z = -side * slopeAng;
    root.add(slab);
  }

  // Grand Double Arched Library Entrance Doors behind portico
  const doorZ = frontWallZ + 0.17;
  const doorSurround = enableShadows(
    new THREE.Mesh(archFrameGeo(THREE, 1.24, 1.56, 0.14, 0.12, 0.02, 10), mats.stoneTrim)
  );
  doorSurround.position.set(0, deckTop + 0.78, doorZ);
  root.add(doorSurround);

  // Arched glowing fanlight transom above double doors
  const fanShape = new THREE.Shape();
  fanShape.absarc(0, 0, 0.50, 0, Math.PI, false);
  fanShape.closePath();
  const fanGeo = new THREE.ShapeGeometry(fanShape, 10);
  const fanGlass = enableShadows(new THREE.Mesh(fanGeo, mats.winWarm), false, true);
  fanGlass.position.set(0, deckTop + 1.00, doorZ - 0.02);
  root.add(fanGlass);

  // Radial fanlight spokes
  const spokeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.48, 6);
  for (let k = 1; k <= 3; k++) {
    const a = (k / 4) * Math.PI;
    const sp = new THREE.Mesh(spokeGeo, mats.windowMullion);
    sp.position.set(Math.cos(a) * 0.24, deckTop + 1.00 + Math.sin(a) * 0.24, doorZ + 0.005);
    sp.rotation.z = a - Math.PI * 0.5;
    root.add(sp);
  }

  // Transom crossbar
  const transomBar = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 1.04, 0.055, 0.09, 0.015, 0.008), mats.stoneTrim)
  );
  transomBar.position.set(0, deckTop + 1.00, doorZ + 0.01);
  root.add(transomBar);

  // Double panelled mahogany doors with brass handles
  const doorLeafGeo = bevelBoxGeo(THREE, 0.47, 0.98, 0.06, 0.02, 0.012);
  const panelGeo = bevelBoxGeo(THREE, 0.30, 0.34, 0.025, 0.02, 0.008);
  const handleGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8);
  for (let side = -1; side <= 1; side += 2) {
    const lx = side * 0.25;
    const leaf = enableShadows(new THREE.Mesh(doorLeafGeo, mats.wood));
    leaf.position.set(lx, deckTop + 0.50, doorZ - 0.01);
    root.add(leaf);

    const pTop = enableShadows(new THREE.Mesh(panelGeo, mats.wood));
    pTop.position.set(lx, deckTop + 0.72, doorZ + 0.02);
    root.add(pTop);

    const pBot = enableShadows(new THREE.Mesh(panelGeo, mats.wood));
    pBot.position.set(lx, deckTop + 0.30, doorZ + 0.02);
    root.add(pBot);

    const handle = new THREE.Mesh(handleGeo, mats.brass);
    handle.position.set(side * 0.065, deckTop + 0.50, doorZ + 0.045);
    root.add(handle);
  }
}

function buildWindows(THREE, root, mats, zc) {
  const halfW = 3.40;
  const frontZ = zc + 2.30; // +2.10
  const rearZ = zc - 2.30;  // -2.50
  const rearBayZ = rearZ - 0.14;

  const tallSlots = [];   // Storeys 1 & 2 tall arched reading-room windows
  const upperSlots = [];  // Storey 3 arched windows
  const groundSlots = []; // Stone ground floor rectangular windows

  const frontWingsX = [-2.74, -1.98, 1.98, 2.74];
  const rearAllX = [-2.74, -1.98, -0.78, 0, 0.78, 1.98, 2.74];
  const sideZs = [-1.72, -0.96, -0.20, 0.56, 1.32];

  // Front wing bays (all 4 levels)
  for (let i = 0; i < frontWingsX.length; i++) {
    const x = frontWingsX[i];
    groundSlots.push({ x, y: 0.72, z: frontZ, ry: 0 });
    tallSlots.push({ x, y: 1.79, z: frontZ, ry: 0, sy: 1.0 });
    tallSlots.push({ x, y: 2.84, z: frontZ, ry: 0, sy: 0.94 });
    upperSlots.push({ x, y: 3.76, z: frontZ, ry: 0 });
  }

  // Front portico upper reading-room windows behind columns (Storey 2)
  const portUpperX = [-0.82, 0, 0.82];
  for (let i = 0; i < portUpperX.length; i++) {
    upperSlots.push({ x: portUpperX[i], y: 2.66, z: frontZ + 0.16, ry: 0 });
  }

  // Rear bays (all 4 levels)
  for (let i = 0; i < rearAllX.length; i++) {
    const x = rearAllX[i];
    const z = Math.abs(x) < 1.1 ? rearBayZ : rearZ;
    groundSlots.push({ x, y: 0.72, z, ry: Math.PI });
    tallSlots.push({ x, y: 1.79, z, ry: Math.PI, sy: 1.0 });
    tallSlots.push({ x, y: 2.84, z, ry: Math.PI, sy: 0.94 });
    upperSlots.push({ x, y: 3.76, z, ry: Math.PI });
  }

  // Left & Right facades (5 bays each, all 4 levels)
  for (let side = -1; side <= 1; side += 2) {
    const x = side * halfW;
    const ry = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    for (let i = 0; i < sideZs.length; i++) {
      const z = sideZs[i];
      groundSlots.push({ x, y: 0.72, z, ry });
      tallSlots.push({ x, y: 1.79, z, ry, sy: 1.0 });
      tallSlots.push({ x, y: 2.84, z, ry, sy: 0.94 });
      upperSlots.push({ x, y: 3.76, z, ry });
    }
  }

  // Helper to populate instanced window group
  const dummy = new THREE.Object3D();

  // --- 1. Tall Arched Reading-Room Windows (with glowing bookshelf interiors) ---
  const tW = 0.52;
  const tH = 0.88;
  const tallFrameGeo = archFrameGeo(THREE, tW, tH, 0.10, 0.055, 0.012, 7);
  const tallSillGeo = bevelBoxGeo(THREE, tW + 0.12, 0.06, 0.14, 0.02, 0.012, 2);
  const tallPaneGeo = archPaneGeo(THREE, tW - 0.09, tH - 0.08, 7);
  const tallVBarGeo = bevelBoxGeo(THREE, 0.022, tH - 0.12, 0.024, 0.005, 0.004, 2);
  const tallHBarGeo = bevelBoxGeo(THREE, tW - 0.10, 0.022, 0.024, 0.005, 0.004, 2);
  const keyGeo = bevelBoxGeo(THREE, 0.09, 0.11, 0.12, 0.015, 0.01, 2);

  const nT = tallSlots.length;
  const instTFrame = enableShadows(new THREE.InstancedMesh(tallFrameGeo, mats.stoneTrim, nT));
  const instTSill = enableShadows(new THREE.InstancedMesh(tallSillGeo, mats.stoneTrim, nT));
  const instTPane = enableShadows(new THREE.InstancedMesh(tallPaneGeo, mats.winBookshelf, nT), false, false);
  const instTVBar = enableShadows(new THREE.InstancedMesh(tallVBarGeo, mats.windowMullion, nT), false, false);
  const instTHBar = enableShadows(new THREE.InstancedMesh(tallHBarGeo, mats.windowMullion, nT), false, false);
  const instTKey = enableShadows(new THREE.InstancedMesh(keyGeo, mats.stoneTrim, nT));

  for (let i = 0; i < nT; i++) {
    const s = tallSlots[i];
    const sy = s.sy || 1.0;
    const nx = Math.sin(s.ry);
    const nz = Math.cos(s.ry);

    dummy.rotation.set(0, s.ry, 0);
    dummy.scale.set(1, sy, 1);
    dummy.position.set(s.x + nx * 0.025, s.y, s.z + nz * 0.025);
    dummy.updateMatrix();
    instTFrame.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.018, s.y + 0.005, s.z + nz * 0.018);
    dummy.updateMatrix();
    instTPane.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.036, s.y - 0.02 * sy, s.z + nz * 0.036);
    dummy.updateMatrix();
    instTVBar.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.036, s.y + 0.14 * sy, s.z + nz * 0.036);
    dummy.updateMatrix();
    instTHBar.setMatrixAt(i, dummy.matrix);

    dummy.scale.set(1, 1, 1);
    dummy.position.set(s.x + nx * 0.04, s.y - tH * 0.5 * sy - 0.02, s.z + nz * 0.04);
    dummy.updateMatrix();
    instTSill.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.035, s.y + tH * 0.5 * sy - 0.01, s.z + nz * 0.035);
    dummy.updateMatrix();
    instTKey.setMatrixAt(i, dummy.matrix);
  }
  root.add(instTFrame, instTSill, instTPane, instTVBar, instTHBar, instTKey);

  // --- 2. Storey 3 Upper Arched Windows ---
  const uW = 0.48;
  const uH = 0.58;
  const upFrameGeo = archFrameGeo(THREE, uW, uH, 0.09, 0.05, 0.011, 7);
  const upSillGeo = bevelBoxGeo(THREE, uW + 0.10, 0.05, 0.12, 0.018, 0.01, 2);
  const upPaneGeo = archPaneGeo(THREE, uW - 0.08, uH - 0.07, 7);
  const upCrossVGeo = bevelBoxGeo(THREE, 0.02, uH - 0.11, 0.022, 0.004, 0.004, 2);

  const nU = upperSlots.length;
  const instUFrame = enableShadows(new THREE.InstancedMesh(upFrameGeo, mats.stoneTrim, nU));
  const instUSill = enableShadows(new THREE.InstancedMesh(upSillGeo, mats.stoneTrim, nU));
  const instUPane = enableShadows(new THREE.InstancedMesh(upPaneGeo, mats.winBookshelf, nU), false, false);
  const instUVBar = enableShadows(new THREE.InstancedMesh(upCrossVGeo, mats.windowMullion, nU), false, false);

  for (let i = 0; i < nU; i++) {
    const s = upperSlots[i];
    const nx = Math.sin(s.ry);
    const nz = Math.cos(s.ry);
    dummy.rotation.set(0, s.ry, 0);
    dummy.scale.set(1, 1, 1);

    dummy.position.set(s.x + nx * 0.022, s.y, s.z + nz * 0.022);
    dummy.updateMatrix();
    instUFrame.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.016, s.y + 0.005, s.z + nz * 0.016);
    dummy.updateMatrix();
    instUPane.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.032, s.y - 0.01, s.z + nz * 0.032);
    dummy.updateMatrix();
    instUVBar.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.036, s.y - uH * 0.5 - 0.015, s.z + nz * 0.036);
    dummy.updateMatrix();
    instUSill.setMatrixAt(i, dummy.matrix);
  }
  root.add(instUFrame, instUSill, instUPane, instUVBar);

  // --- 3. Stone Ground-Floor Windows ---
  const gW = 0.50;
  const gH = 0.46;
  const gFrameGeo = rectFrameGeo(THREE, gW, gH, 0.09, 0.052, 0.01);
  const gSillGeo = bevelBoxGeo(THREE, gW + 0.10, 0.055, 0.12, 0.016, 0.01, 2);
  const gPaneGeo = new THREE.PlaneGeometry(gW - 0.09, gH - 0.09);
  const gBarGeo = bevelBoxGeo(THREE, 0.02, gH - 0.10, 0.022, 0.004, 0.004, 2);

  const nG = groundSlots.length;
  const instGFrame = enableShadows(new THREE.InstancedMesh(gFrameGeo, mats.stoneTrim, nG));
  const instGSill = enableShadows(new THREE.InstancedMesh(gSillGeo, mats.stoneTrim, nG));
  const instGPane = enableShadows(new THREE.InstancedMesh(gPaneGeo, mats.winWarm, nG), false, false);
  const instGBar = enableShadows(new THREE.InstancedMesh(gBarGeo, mats.windowMullion, nG), false, false);

  for (let i = 0; i < nG; i++) {
    const s = groundSlots[i];
    const nx = Math.sin(s.ry);
    const nz = Math.cos(s.ry);
    dummy.rotation.set(0, s.ry, 0);
    dummy.scale.set(1, 1, 1);

    dummy.position.set(s.x + nx * 0.022, s.y, s.z + nz * 0.022);
    dummy.updateMatrix();
    instGFrame.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.015, s.y, s.z + nz * 0.015);
    dummy.updateMatrix();
    instGPane.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.032, s.y, s.z + nz * 0.032);
    dummy.updateMatrix();
    instGBar.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x + nx * 0.038, s.y - gH * 0.5 - 0.018, s.z + nz * 0.038);
    dummy.updateMatrix();
    instGSill.setMatrixAt(i, dummy.matrix);
  }
  root.add(instGFrame, instGSill, instGPane, instGBar);
}

function createHippedRoofGeo(THREE, rw, rd, rh, ridgeHalf) {
  const hw = rw * 0.5;
  const hd = rd * 0.5;
  const uvScale = 0.55;
  const sZ = Math.hypot(hd, rh);
  const sX = Math.hypot(hw - ridgeHalf, rh);

  const positions = [];
  const uvs = [];

  function addTri(a, b, c, ua, ub, uc) {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }

  const FL = [-hw, 0, hd];
  const FR = [hw, 0, hd];
  const BR = [hw, 0, -hd];
  const BL = [-hw, 0, -hd];
  const RL = [-ridgeHalf, rh, 0];
  const RR = [ridgeHalf, rh, 0];

  // Front slope (+z)
  addTri(FL, FR, RR, [-hw * uvScale, 0], [hw * uvScale, 0], [ridgeHalf * uvScale, sZ * uvScale]);
  addTri(FL, RR, RL, [-hw * uvScale, 0], [ridgeHalf * uvScale, sZ * uvScale], [-ridgeHalf * uvScale, sZ * uvScale]);

  // Back slope (-z)
  addTri(BR, BL, RL, [-hw * uvScale, 0], [hw * uvScale, 0], [ridgeHalf * uvScale, sZ * uvScale]);
  addTri(BR, RL, RR, [-hw * uvScale, 0], [ridgeHalf * uvScale, sZ * uvScale], [-ridgeHalf * uvScale, sZ * uvScale]);

  // Right hip (+x)
  addTri(FR, BR, RR, [-hd * uvScale, 0], [hd * uvScale, 0], [0, sX * uvScale]);

  // Left hip (-x)
  addTri(BL, FL, RL, [-hd * uvScale, 0], [hd * uvScale, 0], [0, sX * uvScale]);

  // Underside soffit close
  addTri(FL, BL, BR, [0, 0], [0, 1], [1, 1]);
  addTri(FL, BR, FR, [0, 0], [1, 1], [1, 0]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function buildRoofAndDormers(THREE, root, mats, zc) {
  const roofY = 4.38;
  const rw = 7.16;
  const rd = 4.96;
  const rh = 1.36;
  const ridgeHalf = 1.62;

  const roofGeo = createHippedRoofGeo(THREE, rw, rd, rh, ridgeHalf);
  const roofMesh = enableShadows(new THREE.Mesh(roofGeo, mats.roof));
  roofMesh.position.set(0, roofY, zc);
  root.add(roofMesh);

  // Rounded eave lip / gutter trim around the roof perimeter
  const eaveLip = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, rw + 0.08, 0.07, rd + 0.08, 0.06, 0.025), mats.roofTrim)
  );
  eaveLip.position.set(0, roofY + 0.015, zc);
  root.add(eaveLip);

  // Rounded ridge beam along top
  const ridgeCap = enableShadows(
    new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, ridgeHalf * 2 + 0.14, 10), mats.roofTrim)
  );
  ridgeCap.rotation.z = Math.PI * 0.5;
  ridgeCap.position.set(0, roofY + rh + 0.01, zc);
  root.add(ridgeCap);

  // Rounded hip rolls along the 4 diagonal hips
  const hipEnds = [
    [[-rw * 0.5, 0, rd * 0.5], [-ridgeHalf, rh, 0]],
    [[rw * 0.5, 0, rd * 0.5], [ridgeHalf, rh, 0]],
    [[rw * 0.5, 0, -rd * 0.5], [ridgeHalf, rh, 0]],
    [[-rw * 0.5, 0, -rd * 0.5], [-ridgeHalf, rh, 0]]
  ];
  const upVec = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < hipEnds.length; i++) {
    const a = new THREE.Vector3(hipEnds[i][0][0], hipEnds[i][0][1], hipEnds[i][0][2]);
    const b = new THREE.Vector3(hipEnds[i][1][0], hipEnds[i][1][1], hipEnds[i][1][2]);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const hipGeo = new THREE.CylinderGeometry(0.042, 0.048, len, 8);
    const hipMesh = enableShadows(new THREE.Mesh(hipGeo, mats.roofTrim));
    hipMesh.position.copy(a).addScaledVector(dir, 0.5);
    hipMesh.position.y += roofY + 0.015;
    hipMesh.position.z += zc;
    hipMesh.quaternion.setFromUnitVectors(upVec, dir.normalize());
    root.add(hipMesh);
  }

  // Two neat red-brick chimneys with clay pots flanking the cupola on the back slope
  const chimGeo = bevelBoxGeo(THREE, 0.44, 0.88, 0.40, 0.04, 0.02);
  const chimCapGeo = bevelBoxGeo(THREE, 0.52, 0.08, 0.48, 0.04, 0.02);
  const potGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.16, 10);
  for (let side = -1; side <= 1; side += 2) {
    const cx = side * 1.48;
    const cz = zc - 0.52;
    const ch = enableShadows(new THREE.Mesh(chimGeo, mats.brick));
    ch.position.set(cx, roofY + 1.15, cz);
    root.add(ch);

    const cap = enableShadows(new THREE.Mesh(chimCapGeo, mats.stoneTrim));
    cap.position.set(cx, roofY + 1.60, cz);
    root.add(cap);

    for (let p = -1; p <= 1; p += 2) {
      const pot = enableShadows(new THREE.Mesh(potGeo, mats.brick));
      pot.position.set(cx + p * 0.10, roofY + 1.71, cz);
      root.add(pot);
    }
  }

  // Dormers (7 cozy rounded-hood dormers: 2 front, 3 back, 1 left, 1 right)
  const dormSpecs = [
    { x: -1.68, z: zc + 1.94, ry: 0 },
    { x: 1.68, z: zc + 1.94, ry: 0 },
    { x: -1.68, z: zc - 1.94, ry: Math.PI },
    { x: 0, z: zc - 1.94, ry: Math.PI },
    { x: 1.68, z: zc - 1.94, ry: Math.PI },
    { x: 3.00, z: zc, ry: Math.PI * 0.5 },
    { x: -3.00, z: zc, ry: -Math.PI * 0.5 }
  ];

  const dBodyGeo = bevelBoxGeo(THREE, 0.50, 0.52, 0.86, 0.04, 0.015);
  const dHoodGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.94, 14, 1, false, 0, Math.PI);
  dHoodGeo.rotateZ(Math.PI * 0.5);
  dHoodGeo.rotateY(Math.PI * 0.5);
  const dFrameGeo = archFrameGeo(THREE, 0.36, 0.40, 0.07, 0.042, 0.01, 7);
  const dPaneGeo = archPaneGeo(THREE, 0.29, 0.34, 7);
  const dSillGeo = bevelBoxGeo(THREE, 0.44, 0.045, 0.10, 0.015, 0.008);

  const nD = dormSpecs.length;
  const instDBody = enableShadows(new THREE.InstancedMesh(dBodyGeo, mats.stoneTrim, nD));
  const instDHood = enableShadows(new THREE.InstancedMesh(dHoodGeo, mats.roof, nD));
  const instDFrame = enableShadows(new THREE.InstancedMesh(dFrameGeo, mats.windowMullion, nD));
  const instDPane = enableShadows(new THREE.InstancedMesh(dPaneGeo, mats.winWarm, nD), false, false);
  const instDSill = enableShadows(new THREE.InstancedMesh(dSillGeo, mats.stoneTrim, nD));

  const dummy = new THREE.Object3D();
  const dY = roofY + 0.44;
  for (let i = 0; i < nD; i++) {
    const d = dormSpecs[i];
    const nx = Math.sin(d.ry);
    const nz = Math.cos(d.ry);
    dummy.rotation.set(0, d.ry, 0);
    dummy.scale.set(1, 1, 1);

    dummy.position.set(d.x - nx * 0.40, dY, d.z - nz * 0.40);
    dummy.updateMatrix();
    instDBody.setMatrixAt(i, dummy.matrix);

    dummy.position.set(d.x - nx * 0.38, dY + 0.24, d.z - nz * 0.38);
    dummy.updateMatrix();
    instDHood.setMatrixAt(i, dummy.matrix);

    dummy.position.set(d.x + nx * 0.03, dY + 0.02, d.z + nz * 0.03);
    dummy.updateMatrix();
    instDFrame.setMatrixAt(i, dummy.matrix);

    dummy.position.set(d.x + nx * 0.02, dY + 0.02, d.z + nz * 0.02);
    dummy.updateMatrix();
    instDPane.setMatrixAt(i, dummy.matrix);

    dummy.position.set(d.x + nx * 0.04, dY - 0.19, d.z + nz * 0.04);
    dummy.updateMatrix();
    instDSill.setMatrixAt(i, dummy.matrix);
  }
  root.add(instDBody, instDHood, instDFrame, instDPane, instDSill);
}

function buildClockCupola(THREE, root, mats, zc) {
  const cupola = new THREE.Group();
  cupola.position.set(0, 5.56, zc);

  // Pedestal base emerging smoothly through the roof ridge
  const ped = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 1.12, 0.36, 1.12, 0.08, 0.025), mats.stone)
  );
  ped.position.y = 0.08;
  cupola.add(ped);

  const pedCap = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 1.22, 0.08, 1.22, 0.08, 0.022), mats.stoneTrim)
  );
  pedCap.position.y = 0.28;
  cupola.add(pedCap);

  // Clock chamber (y = 0.32 to 0.84 -> world 5.88 to 6.40)
  const clockBox = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 0.94, 0.54, 0.94, 0.09, 0.025), mats.stoneTrim)
  );
  clockBox.position.y = 0.57;
  cupola.add(clockBox);

  // 4 circular recessed clocks with brass bezels
  const dialGeo = new THREE.CircleGeometry(0.18, 20);
  const bezelGeo = new THREE.TorusGeometry(0.185, 0.026, 10, 22);
  const dirs = [
    [0, 0, 0.478, 0],
    [0, 0, -0.478, Math.PI],
    [0.478, 0, 0, Math.PI * 0.5],
    [-0.478, 0, 0, -Math.PI * 0.5]
  ];
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const dial = new THREE.Mesh(dialGeo, mats.clockFace);
    dial.position.set(d[0], 0.58, d[2]);
    dial.rotation.y = d[3];
    cupola.add(dial);

    const bezel = enableShadows(new THREE.Mesh(bezelGeo, mats.brass), false, true);
    bezel.position.set(d[0], 0.58, d[2]);
    bezel.rotation.y = d[3];
    cupola.add(bezel);
  }

  // Cornice between clock chamber and lantern
  const midCornice = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 1.08, 0.08, 1.08, 0.12, 0.024), mats.stoneTrim)
  );
  midCornice.position.y = 0.86;
  cupola.add(midCornice);

  // Glowing lantern storey (world y = 6.44 to 6.86)
  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.40, 16),
    mats.lampGlobe
  );
  lanternGlass.position.y = 1.09;
  cupola.add(lanternGlass);

  // 8 slender colonnettes around lantern
  const pillarGeo = new THREE.CylinderGeometry(0.026, 0.030, 0.42, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const p = enableShadows(new THREE.Mesh(pillarGeo, mats.stoneTrim));
    p.position.set(Math.cos(a) * 0.35, 1.09, Math.sin(a) * 0.35);
    cupola.add(p);
  }

  // Lantern circular top ring
  const topRing = enableShadows(
    new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.40, 0.07, 20), mats.stoneTrim)
  );
  topRing.position.y = 1.32;
  cupola.add(topRing);

  // Ogee curved teal cupola dome (LatheGeometry, world y = 6.90 to 7.26)
  const domePts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.42, 0.0),
    new THREE.Vector2(0.40, 0.06),
    new THREE.Vector2(0.32, 0.16),
    new THREE.Vector2(0.20, 0.25),
    new THREE.Vector2(0.08, 0.32),
    new THREE.Vector2(0.035, 0.38),
    new THREE.Vector2(0.001, 0.39)
  ];
  const dome = enableShadows(new THREE.Mesh(new THREE.LatheGeometry(domePts, 20), mats.roof));
  dome.position.y = 1.35;
  cupola.add(dome);

  // Brass orb finial & spire (reaches total height ~7.45? Keep compact ~7.22)
  const finialOrb = enableShadows(new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), mats.brass));
  finialOrb.position.y = 1.76;
  cupola.add(finialOrb);

  const spire = enableShadows(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.16, 8), mats.brass));
  spire.position.y = 1.87;
  cupola.add(spire);

  root.add(cupola);
}

function buildBanners(THREE, root, mats, textures) {
  const bannerMat = new THREE.MeshStandardMaterial({
    map: textures.bannerTex,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  // Gently waving vertical banner cloth geometry
  const bw = 0.42;
  const bh = 1.02;
  const clothGeo = new THREE.PlaneGeometry(bw, bh, 4, 12);
  const pos = clothGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (bh * 0.5 - y) / bh; // 0 at top rod, 1 at bottom hem
    const wave = Math.sin(t * Math.PI * 1.45) * 0.032 * t + Math.sin(pos.getX(i) * 5.0) * 0.008 * t;
    pos.setZ(i, wave);
  }
  clothGeo.computeVertexNormals();

  const rodGeo = new THREE.CylinderGeometry(0.016, 0.016, bw + 0.12, 10);
  rodGeo.rotateZ(Math.PI * 0.5);
  const knobGeo = new THREE.SphereGeometry(0.026, 10, 8);
  const armGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8);
  armGeo.rotateX(Math.PI * 0.5);
  const plateGeo = bevelBoxGeo(THREE, 0.08, 0.14, 0.03, 0.02, 0.006);

  // Two banners flanking the portico cleanly on the front facade piers
  const bannerXs = [-1.55, 1.55];
  const wallZ = 2.11;
  const topY = 3.22;

  for (let i = 0; i < bannerXs.length; i++) {
    const bx = bannerXs[i];
    const grp = new THREE.Group();
    grp.position.set(bx, topY, wallZ);

    const plate = enableShadows(new THREE.Mesh(plateGeo, mats.iron));
    plate.position.set(0, 0, 0.01);
    grp.add(plate);

    const arm = enableShadows(new THREE.Mesh(armGeo, mats.iron));
    arm.position.set(0, 0.02, 0.13);
    grp.add(arm);

    const rod = enableShadows(new THREE.Mesh(rodGeo, mats.brass));
    rod.position.set(0, 0.02, 0.24);
    grp.add(rod);

    for (let s = -1; s <= 1; s += 2) {
      const knob = new THREE.Mesh(knobGeo, mats.brass);
      knob.position.set(s * (bw * 0.5 + 0.07), 0.02, 0.24);
      grp.add(knob);
    }

    const cloth = enableShadows(new THREE.Mesh(clothGeo, bannerMat), true, true);
    cloth.position.set(0, -bh * 0.5 + 0.01, 0.24);
    grp.add(cloth);

    const botRod = enableShadows(new THREE.Mesh(rodGeo, mats.brass));
    botRod.scale.set(0.92, 0.8, 0.8);
    botRod.position.set(0, -bh + 0.01, 0.24);
    grp.add(botRod);

    root.add(grp);
  }
}

function buildLampPosts(THREE, root, mats, baseY) {
  // Lathe turned cast-iron post
  const postPts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.11, 0.0),
    new THREE.Vector2(0.105, 0.06),
    new THREE.Vector2(0.075, 0.14),
    new THREE.Vector2(0.085, 0.20),
    new THREE.Vector2(0.052, 0.28),
    new THREE.Vector2(0.036, 0.84),
    new THREE.Vector2(0.056, 0.89),
    new THREE.Vector2(0.085, 0.94),
    new THREE.Vector2(0.001, 0.94)
  ];
  const postGeo = new THREE.LatheGeometry(postPts, 14);
  const crossBarGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.24, 8);
  crossBarGeo.rotateZ(Math.PI * 0.5);
  const globeGeo = new THREE.SphereGeometry(0.115, 16, 12);
  globeGeo.scale(1, 1.08, 1);
  const capGeo = new THREE.ConeGeometry(0.075, 0.09, 12);

  const positions = [
    [-1.74, baseY, 3.16],
    [1.74, baseY, 3.16]
  ];

  const instPost = enableShadows(new THREE.InstancedMesh(postGeo, mats.iron, 2));
  const instBar = enableShadows(new THREE.InstancedMesh(crossBarGeo, mats.iron, 2));
  const instGlobe = enableShadows(new THREE.InstancedMesh(globeGeo, mats.lampGlobe, 2), false, false);
  const instCap = enableShadows(new THREE.InstancedMesh(capGeo, mats.iron, 2));

  const dummy = new THREE.Object3D();
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);

    dummy.position.set(p[0], p[1], p[2]);
    dummy.updateMatrix();
    instPost.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p[0], p[1] + 0.78, p[2]);
    dummy.updateMatrix();
    instBar.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p[0], p[1] + 1.03, p[2]);
    dummy.updateMatrix();
    instGlobe.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p[0], p[1] + 1.16, p[2]);
    dummy.updateMatrix();
    instCap.setMatrixAt(i, dummy.matrix);
  }
  root.add(instPost, instBar, instGlobe, instCap);
}

function buildBookDrop(THREE, root, mats, baseY) {
  const drop = new THREE.Group();
  drop.position.set(2.48, baseY, 2.86);
  drop.rotation.y = -0.32;

  // Pedestal base
  const plinth = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 0.36, 0.07, 0.34, 0.04, 0.015), mats.iron)
  );
  plinth.position.y = 0.035;
  drop.add(plinth);

  // Main body
  const body = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 0.32, 0.42, 0.30, 0.045, 0.018), mats.bookDropMetal)
  );
  body.position.y = 0.27;
  drop.add(body);

  // Front emblem plaque (open-book icon, no text)
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), mats.bookDropEmblem);
  plaque.position.set(0, 0.24, 0.153);
  drop.add(plaque);

  // Rounded barrel top hood
  const hoodGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.32, 16, 1, false, 0, Math.PI);
  hoodGeo.rotateZ(Math.PI * 0.5);
  const hood = enableShadows(new THREE.Mesh(hoodGeo, mats.bookDropMetal));
  hood.position.set(0, 0.46, 0);
  drop.add(hood);

  // Projecting chute overhang & recessed brass return flap
  const chuteHood = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 0.28, 0.11, 0.13, 0.035, 0.014), mats.bookDropMetal)
  );
  chuteHood.position.set(0, 0.44, 0.16);
  chuteHood.rotation.x = 0.22;
  drop.add(chuteHood);

  const slotFlap = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 0.22, 0.045, 0.03, 0.01, 0.006), mats.brass)
  );
  slotFlap.position.set(0, 0.42, 0.195);
  slotFlap.rotation.x = -0.25;
  drop.add(slotFlap);

  root.add(drop);
}

function buildBikeRackAndBikes(THREE, root, mats, baseY) {
  const area = new THREE.Group();
  area.position.set(-2.65, baseY, 2.86);

  // Tubular steel bike rack: low rails + 4 inverted-U hoops
  const railGeo = bevelBoxGeo(THREE, 1.34, 0.025, 0.05, 0.01, 0.006);
  for (let s = -1; s <= 1; s += 2) {
    const rail = enableShadows(new THREE.Mesh(railGeo, mats.iron));
    rail.position.set(0, 0.014, s * 0.16);
    area.add(rail);
  }

  const hoopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, -0.16),
    new THREE.Vector3(0, 0.21, -0.16),
    new THREE.Vector3(0, 0.29, -0.09),
    new THREE.Vector3(0, 0.29, 0.09),
    new THREE.Vector3(0, 0.21, 0.16),
    new THREE.Vector3(0, 0.02, 0.16)
  ]);
  const hoopGeo = new THREE.TubeGeometry(hoopCurve, 14, 0.014, 6, false);
  const instHoops = enableShadows(new THREE.InstancedMesh(hoopGeo, mats.iron, 4));
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 4; i++) {
    dummy.position.set(-0.54 + i * 0.36, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    instHoops.setMatrixAt(i, dummy.matrix);
  }
  area.add(instHoops);

  // Shared geometries for three stylized miniature bikes
  const wheelR = 0.11;
  const tireGeo = new THREE.TorusGeometry(wheelR, 0.018, 8, 16);
  tireGeo.rotateY(Math.PI * 0.5);
  const rimGeo = new THREE.TorusGeometry(wheelR - 0.015, 0.007, 6, 14);
  rimGeo.rotateY(Math.PI * 0.5);
  const hubGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.036, 8);
  hubGeo.rotateZ(Math.PI * 0.5);
  const saddleGeo = bevelBoxGeo(THREE, 0.048, 0.024, 0.09, 0.018, 0.008, 3);
  const handleGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.16, 6);
  handleGeo.rotateZ(Math.PI * 0.5);
  const basketGeo = bevelBoxGeo(THREE, 0.10, 0.08, 0.075, 0.02, 0.01, 2);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.35, metalness: 0.72 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x242628, roughness: 0.85, metalness: 0.05 });
  const saddleMat = new THREE.MeshStandardMaterial({ color: 0x6b3e26, roughness: 0.72, metalness: 0.04 });
  const wickerMat = new THREE.MeshStandardMaterial({ color: 0xc99c62, roughness: 0.85, metalness: 0.02 });

  const bikeSpecs = [
    { x: -0.36, z: 0.04, ry: 0.10, tilt: 0.06, color: 0xc85246, basket: false },
    { x: 0.00, z: -0.02, ry: -0.06, tilt: -0.05, color: 0xd9a63c, basket: true },
    { x: 0.36, z: 0.05, ry: 0.14, tilt: 0.07, color: 0x4b8ea0, basket: false }
  ];

  function addTube(parent, a, b, rad, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(rad, rad, len, 6);
    const m = enableShadows(new THREE.Mesh(g, mat));
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
  }

  for (let i = 0; i < bikeSpecs.length; i++) {
    const s = bikeSpecs[i];
    const bike = new THREE.Group();
    bike.position.set(s.x, 0, s.z);
    bike.rotation.set(0, s.ry, s.tilt);

    const frameMat = new THREE.MeshStandardMaterial({
      color: s.color,
      roughness: 0.38,
      metalness: 0.35
    });

    const fz = -0.17;
    const rz = 0.17;
    const wy = wheelR + 0.015;

    // Front & rear wheels
    const wheelZs = [fz, rz];
    for (let w = 0; w < 2; w++) {
      const wz = wheelZs[w];
      const tire = enableShadows(new THREE.Mesh(tireGeo, rubberMat));
      tire.position.set(0, wy, wz);
      bike.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(0, wy, wz);
      bike.add(rim);

      const hub = new THREE.Mesh(hubGeo, rimMat);
      hub.position.set(0, wy, wz);
      bike.add(hub);
    }

    // Diamond frame tubes
    const pRear = new THREE.Vector3(0, wy, rz);
    const pCrank = new THREE.Vector3(0, wy - 0.01, 0.02);
    const pSeat = new THREE.Vector3(0, wy + 0.15, 0.07);
    const pHeadTop = new THREE.Vector3(0, wy + 0.16, -0.11);
    const pHeadBot = new THREE.Vector3(0, wy + 0.10, -0.13);
    const pFront = new THREE.Vector3(0, wy, fz);
    const pStem = new THREE.Vector3(0, wy + 0.21, -0.10);

    addTube(bike, pRear, pCrank, 0.010, frameMat);
    addTube(bike, pRear, pSeat, 0.010, frameMat);
    addTube(bike, pCrank, pSeat, 0.012, frameMat);
    addTube(bike, pCrank, pHeadBot, 0.012, frameMat);
    addTube(bike, pSeat, pHeadTop, 0.011, frameMat);
    addTube(bike, pHeadTop, pFront, 0.011, frameMat);
    addTube(bike, pHeadTop, pStem, 0.010, rimMat);

    // Saddle & handlebars
    const saddle = enableShadows(new THREE.Mesh(saddleGeo, saddleMat));
    saddle.position.set(0, wy + 0.185, 0.08);
    bike.add(saddle);

    const bar = enableShadows(new THREE.Mesh(handleGeo, rimMat));
    bar.position.set(0, wy + 0.215, -0.10);
    bike.add(bar);

    if (s.basket) {
      const bsk = enableShadows(new THREE.Mesh(basketGeo, wickerMat));
      bsk.position.set(0, wy + 0.18, -0.165);
      bike.add(bsk);
    }

    area.add(bike);
  }

  root.add(area);
}

function buildGreeneryAndDetails(THREE, root, mats, zc, baseY) {
  // Low stone planters with cozy rounded boxwood shrubs framing the building corners
  const planterGeo = bevelBoxGeo(THREE, 0.62, 0.22, 0.56, 0.06, 0.02);
  const planterRimGeo = bevelBoxGeo(THREE, 0.68, 0.05, 0.62, 0.06, 0.016);

  const planterCoords = [
    [-3.42, zc + 2.48],
    [3.42, zc + 2.48],
    [-3.52, zc - 2.40],
    [3.52, zc - 2.40]
  ];

  const nP = planterCoords.length;
  const instPlanter = enableShadows(new THREE.InstancedMesh(planterGeo, mats.stone, nP));
  const instRim = enableShadows(new THREE.InstancedMesh(planterRimGeo, mats.stoneTrim, nP));
  const dummy = new THREE.Object3D();

  for (let i = 0; i < nP; i++) {
    const p = planterCoords[i];
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(p[0], baseY + 0.11, p[1]);
    dummy.updateMatrix();
    instPlanter.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p[0], baseY + 0.23, p[1]);
    dummy.updateMatrix();
    instRim.setMatrixAt(i, dummy.matrix);
  }
  root.add(instPlanter, instRim);

  // Organic rounded foliage clusters in planters & flanking the side walks
  const puffGeo = new THREE.SphereGeometry(0.22, 12, 9);
  const puffsA = [];
  const puffsB = [];

  for (let i = 0; i < planterCoords.length; i++) {
    const px = planterCoords[i][0];
    const pz = planterCoords[i][1];
    puffsA.push([px, baseY + 0.39, pz, 1.05, 0.92, 1.0]);
    puffsB.push([px - 0.14, baseY + 0.34, pz + 0.09, 0.72, 0.68, 0.72]);
    puffsB.push([px + 0.15, baseY + 0.35, pz - 0.08, 0.76, 0.72, 0.74]);
    puffsA.push([px + 0.03, baseY + 0.54, pz - 0.02, 0.62, 0.60, 0.62]);
  }

  // Low manicured hedge mounds along the left and right edges of the base
  const sideZs = [-1.45, -0.55, 0.35, 1.25];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < sideZs.length; i++) {
      const hx = side * 3.72;
      const hz = zc + sideZs[i];
      puffsA.push([hx, baseY + 0.14, hz, 0.75, 0.62, 1.15]);
      puffsB.push([hx - side * 0.05, baseY + 0.22, hz + 0.10, 0.56, 0.52, 0.72]);
    }
  }

  function addPuffs(list, mat) {
    const inst = enableShadows(new THREE.InstancedMesh(puffGeo, mat, list.length));
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(p[3], p[4], p[5]);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    root.add(inst);
  }
  addPuffs(puffsA, mats.foliageA);
  addPuffs(puffsB, mats.foliageB);

  // Cozy wooden campus bench on the front-right plaza beside the book-drop
  const bench = new THREE.Group();
  bench.position.set(3.26, baseY, 2.94);
  bench.rotation.y = -0.42;

  const seat = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 0.62, 0.04, 0.22, 0.02, 0.008), mats.wood)
  );
  seat.position.set(0, 0.18, 0);
  bench.add(seat);

  const back = enableShadows(
    new THREE.Mesh(bevelBoxGeo(THREE, 0.62, 0.16, 0.036, 0.02, 0.008), mats.wood)
  );
  back.position.set(0, 0.29, -0.095);
  back.rotation.x = -0.18;
  bench.add(back);

  const legGeo = bevelBoxGeo(THREE, 0.045, 0.18, 0.20, 0.015, 0.006);
  for (let s = -1; s <= 1; s += 2) {
    const leg = enableShadows(new THREE.Mesh(legGeo, mats.iron));
    leg.position.set(s * 0.24, 0.09, 0);
    bench.add(leg);
  }
  root.add(bench);
}