// Architectural shell for a small single dorm room cutaway diorama (4m x 4m x 2.7m).
// Plain ES module with no imports; receives THREE (r160) as first argument.

export const SLOTS = {
  bed: {
    position: [-1.35, 0, -0.95],
    rotationY: 0,
    footprint: [1.1, 1.95],
    kind: "floor",
  },
  desk: {
    position: [0.2, 0, -1.6],
    rotationY: 0,
    footprint: [1.3, 0.65],
    kind: "floor",
  },
  chair: {
    position: [0.2, 0, -0.95],
    rotationY: Math.PI,
    footprint: [0.55, 0.55],
    kind: "floor",
  },
  diary: {
    position: [0.42, 0.76, -1.55],
    rotationY: -0.18,
    footprint: [0.22, 0.16],
    kind: "surface",
  },
  wardrobe: {
    position: [1.48, 0, -1.6],
    rotationY: 0,
    footprint: [0.85, 0.62],
    kind: "floor",
  },
  shelf: {
    position: [1.62, 0, -0.45],
    rotationY: -Math.PI / 2,
    footprint: [0.85, 0.36],
    kind: "floor",
  },
  rug: {
    position: [0.15, 0.005, 0.45],
    rotationY: 0,
    footprint: [2.1, 1.5],
    kind: "floor",
  },
  plant: {
    position: [1.55, 0, 0.55],
    rotationY: 0.4,
    footprint: [0.48, 0.48],
    kind: "floor",
  },
  lamp: {
    position: [-1.62, 0, 0.42],
    rotationY: 0.3,
    footprint: [0.4, 0.4],
    kind: "floor",
  },
  petBed: {
    position: [0.95, 0, 1.35],
    rotationY: -0.45,
    footprint: [0.7, 0.55],
    kind: "floor",
  },
  wallArt: {
    position: [-1.35, 1.6, -1.98],
    rotationY: 0,
    footprint: [0.9, 0.05],
    kind: "wall",
  },
  corkboard: {
    position: [-1.98, 1.48, -0.95],
    rotationY: Math.PI / 2,
    footprint: [0.95, 0.05],
    kind: "wall",
  },
};

function createRoundedRectShape(THREE, w, h, r) {
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.max(0.0005, Math.min(r, hw * 0.45, hh * 0.45));
  const shape = new THREE.Shape();
  shape.moveTo(-hw + rad, -hh);
  shape.lineTo(hw - rad, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  shape.lineTo(hw, hh - rad);
  shape.quadraticCurveTo(hw, hh, hw - rad, hh);
  shape.lineTo(-hw + rad, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  shape.lineTo(-hw, -hh + rad);
  shape.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return shape;
}

function createRoundedBoxGeometry(THREE, w, h, d, bevel = 0.008, segments = 3) {
  const b = Math.max(0.0005, Math.min(bevel, w * 0.3, h * 0.3, d * 0.3));
  const innerW = Math.max(0.001, w - b * 2);
  const innerH = Math.max(0.001, h - b * 2);
  const innerD = Math.max(0.001, d - b * 2);
  const shape = createRoundedRectShape(THREE, innerW, innerH, b * 0.75);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerD,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: segments,
    curveSegments: segments,
  });
  geo.center();
  return geo;
}

function makeMesh(THREE, geometry, material, slot, cast = true, receive = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (slot) mesh.userData.slot = slot;
  return mesh;
}

function hash2D(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Clip a 2D polygon against an axis-aligned rectangle [minX, maxX] x [minY, maxY].
function clipPolyToRect(poly, minX, maxX, minY, maxY) {
  const clipEdge = (pts, inside, intersect) => {
    if (!pts.length) return [];
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const currIn = inside(curr);
      const prevIn = inside(prev);
      if (currIn) {
        if (!prevIn) out.push(intersect(prev, curr));
        out.push(curr);
      } else if (prevIn) {
        out.push(intersect(prev, curr));
      }
    }
    return out;
  };

  let pts = poly;
  pts = clipEdge(
    pts,
    (p) => p[0] >= minX,
    (a, b) => {
      const t = (minX - a[0]) / (b[0] - a[0]);
      return [minX, a[1] + t * (b[1] - a[1])];
    }
  );
  pts = clipEdge(
    pts,
    (p) => p[0] <= maxX,
    (a, b) => {
      const t = (maxX - a[0]) / (b[0] - a[0]);
      return [maxX, a[1] + t * (b[1] - a[1])];
    }
  );
  pts = clipEdge(
    pts,
    (p) => p[1] >= minY,
    (a, b) => {
      const t = (minY - a[1]) / (b[1] - a[1]);
      return [a[0] + t * (b[0] - a[0]), minY];
    }
  );
  pts = clipEdge(
    pts,
    (p) => p[1] <= maxY,
    (a, b) => {
      const t = (maxY - a[1]) / (b[1] - a[1]);
      return [a[0] + t * (b[0] - a[0]), maxY];
    }
  );
  return pts;
}

function buildFloorSurface(THREE, style, floorColor) {
  const floorGroup = new THREE.Group();
  floorGroup.name = "FloorSurface";

  const surfaceThickness = 0.018;
  const yCenter = -surfaceThickness / 2;

  if (style === "carpet") {
    const carpetMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 0.95,
      metalness: 0.0,
    });
    const borderMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(floorColor).multiplyScalar(0.94),
      roughness: 0.96,
      metalness: 0.0,
    });
    borderMat.userData.shade = 0.94;

    const padGeo = createRoundedBoxGeometry(THREE, 3.98, surfaceThickness, 3.98, 0.008, 3);
    const pad = makeMesh(THREE, padGeo, carpetMat, "floor", false, true);
    pad.position.set(0, yCenter, 0);
    floorGroup.add(pad);

    // Subtle tufted weave ribs so carpet reads with tactile geometry
    const ribMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(floorColor).multiplyScalar(0.975),
      roughness: 0.97,
      metalness: 0.0,
    });
    ribMat.userData.shade = 0.975;

    const ribGeo = createRoundedBoxGeometry(THREE, 3.84, 0.004, 0.032, 0.0015, 2);
    const ribCount = 34;
    for (let i = 0; i < ribCount; i++) {
      const z = -1.86 + (i / (ribCount - 1)) * 3.72;
      const rib = makeMesh(THREE, ribGeo, ribMat, "floor", false, true);
      rib.position.set(0, -0.001, z);
      floorGroup.add(rib);
    }

    // Soft stitched edge frame around perimeter
    const edgeStrips = [
      [3.92, 0.005, 0.055, 0, -1.94],
      [3.92, 0.005, 0.055, 0, 1.94],
      [0.055, 0.005, 3.82, -1.94, 0],
      [0.055, 0.005, 3.82, 1.94, 0],
    ];
    for (const [w, h, d, x, z] of edgeStrips) {
      const g = createRoundedBoxGeometry(THREE, w, h, d, 0.002, 2);
      const m = makeMesh(THREE, g, borderMat, "floor", false, true);
      m.position.set(x, -0.001, z);
      floorGroup.add(m);
    }

    return floorGroup;
  }

  // Wood shade buckets for planks and herringbone
  const shades = [0.92, 0.96, 1.0, 1.03, 1.07];
  const woodMats = shades.map((shade, idx) => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(floorColor).multiplyScalar(shade),
      roughness: 0.52 + idx * 0.025,
      metalness: 0.03,
    });
    mat.userData.shade = shade;
    return mat;
  });

  // Dark sub-floor groove backing so plank seams look crisp
  const grooveMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(floorColor).multiplyScalar(0.45),
    roughness: 0.9,
    metalness: 0.0,
  });
  grooveMat.userData.shade = 0.45;
  const grooveGeo = createRoundedBoxGeometry(THREE, 3.99, 0.006, 3.99, 0.002, 1);
  const grooveMesh = makeMesh(THREE, grooveGeo, grooveMat, "floor", false, true);
  grooveMesh.position.set(0, -surfaceThickness + 0.003, 0);
  floorGroup.add(grooveMesh);

  if (style === "herringbone") {
    const tileL = 0.44;
    const tileW = 0.11;
    const gap = 0.0035;
    const halfL = tileL / 2 - gap / 2;
    const halfW = tileW / 2 - gap / 2;
    const s = Math.SQRT1_2;
    const stepX = tileL * s;
    const stepZ = tileW * s * 2;
    const bevel = 0.0025;
    const extrudeDepth = surfaceThickness - bevel * 2;

    const addTile = (cx, cz, angle, seedA, seedB) => {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const corners = [
        [-halfL, -halfW],
        [halfL, -halfW],
        [halfL, halfW],
        [-halfL, halfW],
      ].map(([lx, lz]) => [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca]);

      const clipped = clipPolyToRect(corners, -1.995, 1.995, -1.995, 1.995);
      if (clipped.length < 3) return;

      // Compute area to skip tiny slivers
      let area = 0;
      for (let i = 0; i < clipped.length; i++) {
        const p1 = clipped[i];
        const p2 = clipped[(i + 1) % clipped.length];
        area += p1[0] * p2[1] - p2[0] * p1[1];
      }
      if (Math.abs(area) * 0.5 < 0.0012) return;

      const shape = new THREE.Shape();
      shape.moveTo(clipped[0][0], -clipped[0][1]);
      for (let i = 1; i < clipped.length; i++) {
        shape.lineTo(clipped[i][0], -clipped[i][1]);
      }
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeDepth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel * 0.8,
        bevelSegments: 2,
      });
      geo.rotateX(-Math.PI / 2);

      const bucket = Math.floor(hash2D(seedA, seedB) * woodMats.length);
      const mesh = makeMesh(THREE, geo, woodMats[bucket], "floor", false, true);
      mesh.position.y = -surfaceThickness + bevel;
      floorGroup.add(mesh);
    };

    for (let col = -9; col <= 9; col++) {
      const baseX = col * stepX;
      const isOdd = ((col % 2) + 2) % 2 === 1;
      const angle = isOdd ? -Math.PI / 4 : Math.PI / 4;
      const zShift = isOdd ? stepZ * 0.5 : 0;
      for (let row = -18; row <= 18; row++) {
        const cz = row * stepZ + zShift;
        addTile(baseX, cz, angle, col + 31, row + 73);
      }
    }

    return floorGroup;
  }

  // Default: "planks"
  const rows = 20;
  const rowDepth = 4.0 / rows;
  const gap = 0.004;
  const plankDepth = rowDepth - gap;

  for (let r = 0; r < rows; r++) {
    const z = -2.0 + (r + 0.5) * rowDepth;
    const offset = ((r * 0.67) % 1.0) * 1.25;
    let xCursor = -2.0 - offset;
    let seg = 0;

    while (xCursor < 2.0) {
      const rawLen = 0.95 + hash2D(r, seg) * 0.65;
      const xStart = Math.max(-1.998, xCursor + gap / 2);
      const xEnd = Math.min(1.998, xCursor + rawLen - gap / 2);
      const w = xEnd - xStart;

      if (w > 0.05) {
        const geo = createRoundedBoxGeometry(THREE, w, surfaceThickness, plankDepth, 0.0028, 2);
        const bucket = Math.floor(hash2D(r + 11, seg + 29) * woodMats.length);
        const plank = makeMesh(THREE, geo, woodMats[bucket], "floor", false, true);
        plank.position.set((xStart + xEnd) / 2, yCenter, z);
        floorGroup.add(plank);
      }
      xCursor += rawLen;
      seg++;
    }
  }

  return floorGroup;
}

function buildSkyBackdrop(THREE, width, height, windowView) {
  if (windowView) {
    const mat = new THREE.MeshStandardMaterial({
      map: windowView,
      emissiveMap: windowView,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.35,
      roughness: 0.95,
      metalness: 0.0,
    });
    const geo = new THREE.PlaneGeometry(width, height);
    return makeMesh(THREE, geo, mat, "sky", false, false);
  }

  // Soft vertical sky gradient using vertex colors (warm horizon -> soft daylight blue)
  const geo = new THREE.PlaneGeometry(width, height, 1, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const horizonColor = new THREE.Color(0xfff1dc);
  const midColor = new THREE.Color(0xcde6f8);
  const zenithColor = new THREE.Color(0x8ec1eb);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y + height / 2) / height));
    if (t < 0.42) {
      tmp.copy(horizonColor).lerp(midColor, t / 0.42);
    } else {
      tmp.copy(midColor).lerp(zenithColor, (t - 0.42) / 0.58);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    emissive: new THREE.Color(0xcce4ff),
    emissiveIntensity: 0.25,
    roughness: 1.0,
    metalness: 0.0,
  });

  return makeMesh(THREE, geo, mat, "sky", false, false);
}

function buildWindow(THREE, trimMat, metalMat, windowView) {
  const group = new THREE.Group();
  group.name = "Window";

  // Opening spans x in [-0.52, 0.92] (width 1.44), y in [0.85, 2.25] (height 1.40)
  const cx = 0.2;
  const cy = 1.55;
  const winW = 1.44;
  const winH = 1.4;
  const wallThick = 0.2;

  // Inner jamb lining (top, bottom, left, right)
  const jambThick = 0.028;
  const jambParts = [
    [winW, jambThick, wallThick, 0, winH / 2 - jambThick / 2, -wallThick / 2],
    [winW, jambThick, wallThick, 0, -winH / 2 + jambThick / 2, -wallThick / 2],
    [jambThick, winH - jambThick * 2, wallThick, -winW / 2 + jambThick / 2, 0, -wallThick / 2],
    [jambThick, winH - jambThick * 2, wallThick, winW / 2 - jambThick / 2, 0, -wallThick / 2],
  ];
  for (const [w, h, d, x, y, z] of jambParts) {
    const m = makeMesh(THREE, createRoundedBoxGeometry(THREE, w, h, d, 0.004, 2), trimMat, "trim");
    m.position.set(cx + x, cy + y, -2.0 + z);
    group.add(m);
  }

  // Interior casing / architrave around top and sides
  const casingW = 0.075;
  const casingD = 0.024;
  const casingParts = [
    [winW + casingW * 2, casingW, casingD, 0, winH / 2 + casingW / 2 - 0.01, casingD / 2],
    [casingW, winH, casingD, -winW / 2 - casingW / 2 + 0.01, 0, casingD / 2],
    [casingW, winH, casingD, winW / 2 + casingW / 2 - 0.01, 0, casingD / 2],
  ];
  for (const [w, h, d, x, y, z] of casingParts) {
    const m = makeMesh(THREE, createRoundedBoxGeometry(THREE, w, h, d, 0.005, 3), trimMat, "trim");
    m.position.set(cx + x, cy + y, -2.0 + z);
    group.add(m);
  }

  // Deep bevelled window sill + decorative under-apron
  const sillW = winW + casingW * 2 + 0.07;
  const sillD = wallThick + 0.075;
  const sill = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, sillW, 0.036, sillD, 0.007, 3),
    trimMat,
    "trim"
  );
  sill.position.set(cx, cy - winH / 2 - 0.008, -2.0 - wallThick / 2 + 0.0375);
  group.add(sill);

  const apron = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, winW + casingW * 1.4, 0.048, 0.022, 0.005, 2),
    trimMat,
    "trim"
  );
  apron.position.set(cx, cy - winH / 2 - 0.048, -1.989);
  group.add(apron);

  // Inner sash frame & mullions
  const sashZ = -2.11;
  const sashW = winW - jambThick * 2;
  const sashH = winH - jambThick * 2;
  const sashBar = 0.036;

  const sashParts = [
    [sashW, sashBar, 0.034, 0, sashH / 2 - sashBar / 2],
    [sashW, sashBar, 0.034, 0, -sashH / 2 + sashBar / 2],
    [sashBar, sashH, 0.034, -sashW / 2 + sashBar / 2, 0],
    [sashBar, sashH, 0.034, sashW / 2 - sashBar / 2, 0],
    // Center vertical mullion
    [0.032, sashH - sashBar, 0.03, 0, 0],
    // Horizontal meeting rail (slightly above midpoint for classic dorm look)
    [sashW - sashBar, 0.036, 0.032, 0, 0.08],
    // Secondary thin transom muntin in lower panes
    [sashW - sashBar, 0.018, 0.02, 0, -0.32],
    // Secondary thin muntin in upper panes
    [sashW - sashBar, 0.018, 0.02, 0, 0.42],
  ];
  for (const [w, h, d, x, y] of sashParts) {
    const m = makeMesh(THREE, createRoundedBoxGeometry(THREE, w, h, d, 0.004, 2), trimMat, "trim");
    m.position.set(cx + x, cy + y, sashZ);
    group.add(m);
  }

  // Small metallic window latch on the meeting rail
  const latchBase = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, 0.042, 0.018, 0.014, 0.003, 2),
    metalMat,
    "metal"
  );
  latchBase.position.set(cx, cy + 0.08, sashZ + 0.022);
  group.add(latchBase);

  const latchKnob = makeMesh(
    THREE,
    new THREE.CylinderGeometry(0.006, 0.005, 0.028, 12),
    metalMat,
    "metal"
  );
  latchKnob.rotation.z = Math.PI / 2;
  latchKnob.position.set(cx + 0.012, cy + 0.08, sashZ + 0.032);
  group.add(latchKnob);

  // Subtle translucent glass pane (doesn't block shadows)
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdff2ff,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.2,
  });
  const glass = makeMesh(
    THREE,
    new THREE.PlaneGeometry(sashW - sashBar, sashH - sashBar),
    glassMat,
    "glass",
    false,
    false
  );
  glass.position.set(cx, cy, sashZ - 0.006);
  group.add(glass);

  // Window view / soft sky gradient plane behind the glass
  const backdrop = buildSkyBackdrop(THREE, winW - 0.02, winH - 0.02, windowView);
  backdrop.position.set(cx, cy, -2.175);
  group.add(backdrop);

  return group;
}

function buildDoor(THREE, trimMat, woodMat, metalMat) {
  const group = new THREE.Group();
  group.name = "Door";

  // Door opening in left wall: z in [0.88, 1.74] (width 0.86), y in [0, 2.08]
  const cz = 1.31;
  const doorW = 0.86;
  const doorH = 2.08;
  const wallThick = 0.2;

  // Inner door jambs
  const jambThick = 0.028;
  const jambParts = [
    [wallThick, jambThick, doorW, -wallThick / 2, doorH - jambThick / 2, 0],
    [wallThick, doorH - jambThick, jambThick, -wallThick / 2, (doorH - jambThick) / 2, -doorW / 2 + jambThick / 2],
    [wallThick, doorH - jambThick, jambThick, -wallThick / 2, (doorH - jambThick) / 2, doorW / 2 - jambThick / 2],
  ];
  for (const [w, h, d, x, y, z] of jambParts) {
    const m = makeMesh(THREE, createRoundedBoxGeometry(THREE, w, h, d, 0.004, 2), trimMat, "trim");
    m.position.set(-2.0 + x, y, cz + z);
    group.add(m);
  }

  // Interior door casing + plinth blocks at the floor
  const casingW = 0.075;
  const casingD = 0.024;
  const plinthH = 0.13;

  const topCasing = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, casingD, casingW, doorW + casingW * 2, 0.005, 3),
    trimMat,
    "trim"
  );
  topCasing.position.set(-2.0 + casingD / 2, doorH + casingW / 2 - 0.01, cz);
  group.add(topCasing);

  for (const side of [-1, 1]) {
    const zPos = cz + side * (doorW / 2 + casingW / 2 - 0.01);
    const sideCasing = makeMesh(
      THREE,
      createRoundedBoxGeometry(THREE, casingD, doorH - plinthH, casingW, 0.005, 3),
      trimMat,
      "trim"
    );
    sideCasing.position.set(-2.0 + casingD / 2, plinthH + (doorH - plinthH) / 2, zPos);
    group.add(sideCasing);

    const plinth = makeMesh(
      THREE,
      createRoundedBoxGeometry(THREE, casingD + 0.006, plinthH, casingW + 0.008, 0.005, 2),
      trimMat,
      "trim"
    );
    plinth.position.set(-2.0 + (casingD + 0.006) / 2, plinthH / 2, zPos);
    group.add(plinth);
  }

  // Crafted paneled wooden door leaf
  const leafW = doorW - jambThick * 2 - 0.008;
  const leafH = doorH - jambThick - 0.01;
  const leafThick = 0.044;
  const leafX = -2.065;

  const core = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, leafThick, leafH, leafW, 0.005, 2),
    woodMat,
    "wood"
  );
  core.position.set(leafX, leafH / 2 + 0.005, cz);
  group.add(core);

  // Raised door panels (upper tall panel + lower square panel) on interior face
  const panelAccentMat = new THREE.MeshStandardMaterial({
    color: woodMat.color.clone().multiplyScalar(0.95),
    roughness: 0.56,
    metalness: 0.02,
  });
  panelAccentMat.userData.shade = 0.95;

  const panelW = leafW - 0.2;
  const upperPanel = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, 0.012, 0.88, panelW, 0.004, 2),
    panelAccentMat,
    "wood"
  );
  upperPanel.position.set(leafX + leafThick / 2 + 0.003, 1.44, cz);
  group.add(upperPanel);

  const lowerPanel = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, 0.012, 0.56, panelW, 0.004, 2),
    panelAccentMat,
    "wood"
  );
  lowerPanel.position.set(leafX + leafThick / 2 + 0.003, 0.52, cz);
  group.add(lowerPanel);

  // Door handle & backplate on latch side (z near 0.98)
  const handleZ = cz - leafW / 2 + 0.085;
  const handleY = 0.99;
  const plateX = leafX + leafThick / 2 + 0.005;

  const backplate = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, 0.008, 0.14, 0.038, 0.003, 3),
    metalMat,
    "metal"
  );
  backplate.position.set(plateX, handleY - 0.015, handleZ);
  group.add(backplate);

  // Spindle
  const spindle = makeMesh(
    THREE,
    new THREE.CylinderGeometry(0.009, 0.011, 0.042, 14),
    metalMat,
    "metal"
  );
  spindle.rotation.z = Math.PI / 2;
  spindle.position.set(plateX + 0.022, handleY, handleZ);
  group.add(spindle);

  // Lever bar
  const lever = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, 0.014, 0.018, 0.115, 0.006, 3),
    metalMat,
    "metal"
  );
  lever.position.set(plateX + 0.044, handleY, handleZ + 0.048);
  group.add(lever);

  // Subtle keyhole escutcheon / thumbturn below lever
  const turn = makeMesh(
    THREE,
    new THREE.CylinderGeometry(0.008, 0.008, 0.014, 12),
    metalMat,
    "metal"
  );
  turn.rotation.z = Math.PI / 2;
  turn.position.set(plateX + 0.008, handleY - 0.052, handleZ);
  group.add(turn);

  // Two cylindrical hinges on the hinge side
  for (const hy of [0.36, 1.74]) {
    const hinge = makeMesh(
      THREE,
      new THREE.CylinderGeometry(0.007, 0.007, 0.075, 10),
      metalMat,
      "metal"
    );
    hinge.position.set(leafX + leafThick / 2 + 0.004, hy, cz + leafW / 2 - 0.005);
    group.add(hinge);
  }

  return group;
}

function buildMoldingRun(THREE, profilePoints, length, material, slot) {
  const shape = new THREE.Shape();
  shape.moveTo(profilePoints[0][0], profilePoints[0][1]);
  for (let i = 1; i < profilePoints.length; i++) {
    shape.lineTo(profilePoints[i][0], profilePoints[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  return makeMesh(THREE, geo, material, slot, true, true);
}

export function buildRoom(THREE, opts = {}) {
  const wallColor = opts.wall ?? 0xf3ece1;
  const trimColor = opts.trim ?? 0xfaf6f0;
  const floorColor = opts.floor ?? 0xc49a6c;
  const floorStyle = opts.floorStyle ?? "planks";
  const windowView = opts.windowView ?? null;

  const root = new THREE.Group();
  root.name = "DormRoomShell";

  // Core materials
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.88,
    metalness: 0.0,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.46,
    metalness: 0.02,
  });
  const cutMat = new THREE.MeshStandardMaterial({
    color: 0xd9d0c3,
    roughness: 0.82,
    metalness: 0.0,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xb68456,
    roughness: 0.54,
    metalness: 0.02,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xd4af6a,
    roughness: 0.26,
    metalness: 0.85,
  });

  const wallH = 2.7;
  const wallThick = 0.2;
  const baseThick = 0.2;
  const interiorLayer = 0.055;
  const exteriorLayer = wallThick - interiorLayer;

  // 1. Thick Diorama Base Slab (x: -2.20..2.00, z: -2.20..2.00, y: -0.20..-0.018)
  const slabH = baseThick - 0.018;
  const slabGeo = createRoundedBoxGeometry(THREE, 4.2, slabH, 4.2, 0.012, 3);
  const slabMesh = makeMesh(THREE, slabGeo, cutMat, "cut", true, true);
  slabMesh.position.set(-0.1, -0.018 - slabH / 2, -0.1);
  root.add(slabMesh);

  // Subtle plinth lip around the very bottom of the diorama model
  const plinthLipGeo = createRoundedBoxGeometry(THREE, 4.22, 0.028, 4.22, 0.008, 2);
  const plinthLip = makeMesh(THREE, plinthLipGeo, cutMat, "cut", true, true);
  plinthLip.position.set(-0.1, -baseThick + 0.014, -0.1);
  root.add(plinthLip);

  // 2. Floor Surface (y: -0.018..0.000, x: -2..2, z: -2..2)
  const floorSurface = buildFloorSurface(THREE, floorStyle, floorColor);
  root.add(floorSurface);

  // 3. Back Wall (z = -2.20..-2.00, x = -2.20..2.00, y = 0..2.70) with Window Hole
  const backShape = new THREE.Shape();
  backShape.moveTo(-2.2, 0);
  backShape.lineTo(2.0, 0);
  backShape.lineTo(2.0, wallH);
  backShape.lineTo(-2.2, wallH);
  backShape.closePath();

  const winHole = new THREE.Path();
  winHole.moveTo(-0.52, 0.85);
  winHole.lineTo(0.92, 0.85);
  winHole.lineTo(0.92, 2.25);
  winHole.lineTo(-0.52, 2.25);
  winHole.closePath();
  backShape.holes.push(winHole);

  const backIntGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: interiorLayer - 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  const backIntWall = makeMesh(THREE, backIntGeo, wallMat, "wall");
  backIntWall.position.set(0, 0, -2.0 - interiorLayer + 0.004);
  root.add(backIntWall);

  const backExtGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: exteriorLayer - 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  const backExtWall = makeMesh(THREE, backExtGeo, cutMat, "cut");
  backExtWall.position.set(0, 0, -2.2 + 0.004);
  root.add(backExtWall);

  // 4. Left Wall (x = -2.20..-2.00, z = -2.00..2.00, y = 0..2.70) with U-shaped Door Cutout
  // Local x maps to world z via rotation.y = Math.PI/2 and position.z = 2.0: z_world = 2.0 - x_local
  // Door world z in [0.88, 1.74] => local x in [0.26, 1.12]
  const leftShape = new THREE.Shape();
  leftShape.moveTo(0, 0);
  leftShape.lineTo(0.26, 0);
  leftShape.lineTo(0.26, 2.08);
  leftShape.lineTo(1.12, 2.08);
  leftShape.lineTo(1.12, 0);
  leftShape.lineTo(4.0, 0);
  leftShape.lineTo(4.0, wallH);
  leftShape.lineTo(0, wallH);
  leftShape.closePath();

  const leftIntGeo = new THREE.ExtrudeGeometry(leftShape, {
    depth: interiorLayer - 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  const leftIntWall = makeMesh(THREE, leftIntGeo, wallMat, "wall");
  leftIntWall.rotation.y = Math.PI / 2;
  leftIntWall.position.set(-2.0 - interiorLayer + 0.004, 0, 2.0);
  root.add(leftIntWall);

  const leftExtGeo = new THREE.ExtrudeGeometry(leftShape, {
    depth: exteriorLayer - 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  const leftExtWall = makeMesh(THREE, leftExtGeo, cutMat, "cut");
  leftExtWall.rotation.y = Math.PI / 2;
  leftExtWall.position.set(-2.2 + 0.004, 0, 2.0);
  root.add(leftExtWall);

  // 5. Cutaway Caps (clean architectural cross-sections on wall ends & top)
  const capThick = 0.018;
  // Back wall right cut edge (x = 2.00)
  const backEndCap = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, capThick, wallH + 0.01, wallThick + 0.008, 0.005, 3),
    cutMat,
    "cut"
  );
  backEndCap.position.set(2.0, wallH / 2, -2.1);
  root.add(backEndCap);

  // Left wall front cut edge (z = 2.00)
  const leftEndCap = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, wallThick + 0.008, wallH + 0.01, capThick, 0.005, 3),
    cutMat,
    "cut"
  );
  leftEndCap.position.set(-2.1, wallH / 2, 2.0);
  root.add(leftEndCap);

  // Top cutaway wall caps (y = 2.70)
  const backTopCap = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, 4.22, capThick, wallThick + 0.01, 0.005, 3),
    cutMat,
    "cut"
  );
  backTopCap.position.set(-0.1, wallH + capThick / 2 - 0.004, -2.1);
  root.add(backTopCap);

  const leftTopCap = makeMesh(
    THREE,
    createRoundedBoxGeometry(THREE, wallThick + 0.01, capThick, 4.02, 0.005, 3),
    cutMat,
    "cut"
  );
  leftTopCap.position.set(-2.1, wallH + capThick / 2 - 0.004, 0.0);
  root.add(leftTopCap);

  // 6. Skirting Boards (profiled molding along floor-wall junctions)
  const skirtProfilePos = [
    [0, 0],
    [0.022, 0],
    [0.022, 0.088],
    [0.015, 0.102],
    [0.012, 0.112],
    [0, 0.112],
  ];
  const skirtProfileNeg = skirtProfilePos.map(([x, y]) => [-x, y]);

  // Back wall skirting (x: -2.00 to 2.00)
  const backSkirt = buildMoldingRun(THREE, skirtProfileNeg, 3.996, trimMat, "trim");
  backSkirt.rotation.y = Math.PI / 2;
  backSkirt.position.set(-1.998, 0, -2.0);
  root.add(backSkirt);

  // Left wall skirting before door (z: -2.00 to 0.80)
  const leftSkirtA = buildMoldingRun(THREE, skirtProfilePos, 2.796, trimMat, "trim");
  leftSkirtA.position.set(-2.0, 0, -1.998);
  root.add(leftSkirtA);

  // Left wall skirting after door (z: 1.82 to 2.00)
  const leftSkirtB = buildMoldingRun(THREE, skirtProfilePos, 0.176, trimMat, "trim");
  leftSkirtB.position.set(-2.0, 0, 1.82);
  root.add(leftSkirtB);

  // 7. Crown Trim along ceiling-less top interior edge
  const crownProfilePos = [
    [0, 0],
    [0.016, 0],
    [0.022, 0.018],
    [0.044, 0.056],
    [0.058, 0.072],
    [0.058, 0.088],
    [0, 0.088],
  ];
  const crownProfileNeg = crownProfilePos.map(([x, y]) => [-x, y]);

  const backCrown = buildMoldingRun(THREE, crownProfileNeg, 3.996, trimMat, "trim");
  backCrown.rotation.y = Math.PI / 2;
  backCrown.position.set(-1.998, wallH - 0.09, -2.0);
  root.add(backCrown);

  const leftCrown = buildMoldingRun(THREE, crownProfilePos, 3.996, trimMat, "trim");
  leftCrown.position.set(-2.0, wallH - 0.09, -1.998);
  root.add(leftCrown);

  // 8. Window & Door Assemblies
  root.add(buildWindow(THREE, trimMat, metalMat, windowView));
  root.add(buildDoor(THREE, trimMat, woodMat, metalMat));

  return root;
}

export function recolor(group, palette) {
  // Support both recolor(group, palette) and recolor(THREE, group, palette)
  let targetGroup = group;
  let targetPalette = palette;
  if (
    arguments.length >= 3 &&
    group &&
    typeof group.traverse !== "function" &&
    palette &&
    typeof palette.traverse === "function"
  ) {
    targetGroup = palette;
    targetPalette = arguments[2];
  }

  if (!targetGroup || !targetPalette || typeof targetGroup.traverse !== "function") {
    return;
  }

  targetGroup.traverse((obj) => {
    if (!obj.isMesh || !obj.userData || !obj.userData.slot) return;
    const slot = obj.userData.slot;
    if (!Object.prototype.hasOwnProperty.call(targetPalette, slot)) return;

    const nextColor = targetPalette[slot];
    if (nextColor === undefined || nextColor === null) return;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || !mat.color) continue;
      mat.color.set(nextColor);
      if (mat.userData && typeof mat.userData.shade === "number") {
        mat.color.multiplyScalar(mat.userData.shade);
      }
      mat.needsUpdate = true;
    }
  });
}