export const PARTS = {
  skin: [
    "#FDE2D2",
    "#F7CEB5",
    "#EAC0A2",
    "#D9A482",
    "#BD835E",
    "#9C6443",
    "#77492E",
    "#52301E",
  ],
  hairStyles: [
    "short",
    "buzz",
    "middlePart",
    "curly",
    "afro",
    "braids",
    "bob",
    "longStraight",
    "ponytail",
    "hijab",
  ],
  hairColors: [
    "#231F20",
    "#4A3222",
    "#8B5A3C",
    "#C9965B",
    "#E6C78B",
    "#A8432E",
    "#5C6B8A",
    "#D8C8D4",
  ],
  eyes: ["round", "smile", "sleepy", "dot"],
  tops: ["hoodie", "tee", "shirt", "cardigan"],
  bottoms: ["trousers", "shorts", "skirt"],
  headwear: ["none", "cap", "beanie", "headphones"],
  glasses: ["none", "round", "square"],
};

function makeMat(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness !== undefined ? opts.roughness : 0.78,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.02,
    transparent: opts.transparent || false,
    opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide,
  });
}

function tagMesh(mesh, slot) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = slot;
  return mesh;
}

function makeRoundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.min(r, hw, hh);
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

function makeRoundedBox(THREE, w, h, d, r, bevel = 0.008) {
  const shape = makeRoundedRectShape(THREE, Math.max(0.002, w - bevel * 2), Math.max(0.002, h - bevel * 2), r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

function buildHeadGeometry(THREE) {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.075, 0.012),
    new THREE.Vector2(0.148, 0.055),
    new THREE.Vector2(0.194, 0.132),
    new THREE.Vector2(0.204, 0.205),
    new THREE.Vector2(0.192, 0.285),
    new THREE.Vector2(0.142, 0.362),
    new THREE.Vector2(0.068, 0.402),
    new THREE.Vector2(0.0, 0.412),
  ];
  return new THREE.LatheGeometry(pts, 32);
}

function buildEyeStyle(THREE, style, mats) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.068, 0.184, 0.189);
    eye.rotation.y = side * 0.31;

    if (style === "round") {
      const iris = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 14), mats.eye), "eye");
      iris.scale.set(0.92, 1.12, 0.55);
      eye.add(iris);

      const catchlight = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), mats.white), "accent");
      catchlight.position.set(0.0065, 0.0085, 0.011);
      eye.add(catchlight);

      const lash = tagMesh(
        new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.0032, 8, 16, Math.PI * 0.78), mats.eye),
        "eye"
      );
      lash.position.set(0, 0.004, 0.004);
      lash.rotation.z = Math.PI * 0.11;
      eye.add(lash);
    } else if (style === "smile") {
      const arc = tagMesh(
        new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0045, 10, 18, Math.PI * 0.85), mats.eye),
        "eye"
      );
      arc.position.set(0, -0.006, 0.006);
      arc.rotation.z = Math.PI * 0.075;
      eye.add(arc);
      for (const end of [-1, 1]) {
        const cap = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), mats.eye), "eye");
        cap.position.set(end * 0.0204, -0.001, 0.006);
        eye.add(cap);
      }
    } else if (style === "sleepy") {
      const iris = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 12), mats.eye), "eye");
      iris.scale.set(0.96, 0.92, 0.52);
      iris.position.y = -0.004;
      eye.add(iris);

      const catchlight = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), mats.white), "accent");
      catchlight.position.set(0.005, -0.002, 0.01);
      eye.add(catchlight);

      const lid = tagMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mats.skin),
        "skin"
      );
      lid.scale.set(1.02, 0.96, 0.65);
      lid.position.set(0, 0.002, 0.003);
      eye.add(lid);

      const lidLine = tagMesh(
        new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, 0.036, 4, 8), mats.eye),
        "eye"
      );
      lidLine.rotation.z = Math.PI / 2 - side * 0.08;
      lidLine.position.set(0, 0.002, 0.013);
      eye.add(lidLine);
    } else {
      // dot
      const dot = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.0135, 14, 12), mats.eye), "eye");
      dot.scale.set(1.0, 1.05, 0.62);
      eye.add(dot);

      const catchlight = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.0042, 8, 8), mats.white), "accent");
      catchlight.position.set(0.004, 0.0045, 0.0075);
      eye.add(catchlight);
    }

    group.add(eye);
  }
  return group;
}

function buildClosedEyes(THREE, mats) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.068, 0.184, 0.193);
    eye.rotation.y = side * 0.31;

    const arc = tagMesh(
      new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 16, Math.PI * 0.8), mats.eye),
      "eye"
    );
    arc.rotation.z = Math.PI + Math.PI * 0.1;
    arc.position.y = 0.008;
    eye.add(arc);

    group.add(eye);
  }
  return group;
}

function buildMouths(THREE, mats) {
  const mouths = {};

  // awake: warm gentle smile
  const awake = new THREE.Group();
  const awakeArc = tagMesh(
    new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0032, 8, 16, Math.PI * 0.72), mats.mouth),
    "mouth"
  );
  awakeArc.rotation.z = Math.PI + Math.PI * 0.14;
  awakeArc.position.set(0, 0.125, 0.191);
  awake.add(awakeArc);
  mouths.awake = awake;

  // asleep: tiny soft 'o'
  const asleep = new THREE.Group();
  const asleepO = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0028, 8, 14), mats.mouth), "mouth");
  asleepO.position.set(0, 0.114, 0.194);
  asleep.add(asleepO);
  mouths.asleep = asleep;

  // thinking: small offset puckered bar
  const thinking = new THREE.Group();
  const thinkBar = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, 0.014, 4, 8), mats.mouth), "mouth");
  thinkBar.rotation.z = Math.PI / 2 + 0.18;
  thinkBar.position.set(0.014, 0.115, 0.193);
  thinking.add(thinkBar);
  mouths.thinking = thinking;

  // unsure: tiny wavy/tilted slight frown
  const unsure = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.018, -0.003, 0),
    new THREE.Vector3(-0.006, 0.0025, 0.002),
    new THREE.Vector3(0.006, -0.0025, 0.002),
    new THREE.Vector3(0.018, 0.003, 0),
  ]);
  const unsureWave = tagMesh(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.003, 8, false), mats.mouth), "mouth");
  unsureWave.position.set(0, 0.115, 0.193);
  unsure.add(unsureWave);
  mouths.unsure = unsure;

  // happy: open joyful D-smile
  const happy = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.022, 0.005);
  shape.lineTo(0.022, 0.005);
  shape.quadraticCurveTo(0.02, -0.02, 0, -0.02);
  shape.quadraticCurveTo(-0.02, -0.02, -0.022, 0.005);
  const mouthGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 3,
  });
  mouthGeo.center();
  const mouthOpen = tagMesh(new THREE.Mesh(mouthGeo, mats.mouth), "mouth");
  mouthOpen.position.set(0, 0.114, 0.192);
  happy.add(mouthOpen);

  const tongue = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), mats.blush), "blush");
  tongue.scale.set(1.2, 0.65, 0.5);
  tongue.position.set(0, 0.106, 0.195);
  happy.add(tongue);
  mouths.happy = happy;

  return mouths;
}

function buildHairCap(THREE, mat, scale = 1.045, phiLen = Math.PI * 0.66) {
  const geo = new THREE.SphereGeometry(0.205 * scale, 28, 20, 0, Math.PI * 2, 0, phiLen);
  const mesh = tagMesh(new THREE.Mesh(geo, mat), "hair");
  mesh.position.set(0, 0.215, -0.012);
  mesh.rotation.x = -0.22;
  return mesh;
}

function buildHair(THREE, style, mats) {
  const hair = new THREE.Group();
  hair.name = "hair";
  const mat = mats.hair;

  if (style === "buzz") {
    const cap = buildHairCap(THREE, mat, 1.018, Math.PI * 0.58);
    cap.position.set(0, 0.212, -0.008);
    cap.rotation.x = -0.18;
    hair.add(cap);

    const back = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat), "hair");
    back.position.set(0, 0.192, -0.018);
    back.rotation.x = -1.25;
    hair.add(back);
    return hair;
  }

  if (style === "short") {
    hair.add(buildHairCap(THREE, mat, 1.055, Math.PI * 0.68));
    // Back fullness
    const back = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 16), mat), "hair");
    back.scale.set(1.02, 0.92, 0.96);
    back.position.set(0, 0.185, -0.042);
    hair.add(back);

    // Swept layered bangs
    const bangSpecs = [
      { x: -0.09, y: 0.305, z: 0.155, rz: 0.42, rx: 0.3, s: [0.055, 0.085, 0.042] },
      { x: -0.03, y: 0.315, z: 0.175, rz: 0.24, rx: 0.22, s: [0.058, 0.095, 0.045] },
      { x: 0.035, y: 0.312, z: 0.172, rz: -0.18, rx: 0.22, s: [0.055, 0.09, 0.044] },
      { x: 0.095, y: 0.30, z: 0.15, rz: -0.45, rx: 0.32, s: [0.052, 0.08, 0.04] },
    ];
    for (const b of bangSpecs) {
      const m = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), mat), "hair");
      m.scale.set(b.s[0], b.s[1], b.s[2]);
      m.position.set(b.x, b.y, b.z);
      m.rotation.set(b.rx, 0, b.rz);
      hair.add(m);
    }
    // Sideburns
    for (const side of [-1, 1]) {
      const sb = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.065, 6, 10), mat), "hair");
      sb.position.set(side * 0.185, 0.21, 0.048);
      sb.rotation.z = side * 0.15;
      hair.add(sb);
    }
    return hair;
  }

  if (style === "middlePart") {
    hair.add(buildHairCap(THREE, mat, 1.06, Math.PI * 0.68));
    const back = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 18), mat), "hair");
    back.scale.set(1.04, 0.98, 0.96);
    back.position.set(0, 0.18, -0.042);
    hair.add(back);

    for (const side of [-1, 1]) {
      // Sweeping curtain bang curve
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.015, 0.375, 0.09),
        new THREE.Vector3(side * 0.095, 0.335, 0.165),
        new THREE.Vector3(side * 0.168, 0.245, 0.145),
        new THREE.Vector3(side * 0.19, 0.135, 0.09),
      ]);
      const strand = tagMesh(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.036, 12, false), mat), "hair");
      strand.scale.set(1.0, 1.0, 0.72);
      hair.add(strand);

      const tip = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), mat), "hair");
      tip.position.set(side * 0.19, 0.125, 0.065);
      hair.add(tip);

      // Crown volume on each side of the part
      const lobe = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), mat), "hair");
      lobe.scale.set(1.0, 0.75, 1.15);
      lobe.position.set(side * 0.072, 0.365, 0.015);
      hair.add(lobe);
    }
    return hair;
  }

  if (style === "curly") {
    hair.add(buildHairCap(THREE, mat, 1.04, Math.PI * 0.66));
    const curls = [
      // Crown & fringe curls
      [-0.12, 0.34, 0.12, 0.056],
      [-0.05, 0.36, 0.15, 0.058],
      [0.02, 0.365, 0.155, 0.056],
      [0.09, 0.35, 0.135, 0.058],
      [0.14, 0.31, 0.095, 0.055],
      [-0.15, 0.30, 0.085, 0.055],
      // Top volume
      [-0.09, 0.405, 0.03, 0.064],
      [0.0, 0.425, 0.01, 0.068],
      [0.09, 0.405, 0.025, 0.064],
      [-0.06, 0.395, -0.09, 0.066],
      [0.06, 0.395, -0.09, 0.066],
      // Sides & back
      [-0.195, 0.25, 0.02, 0.06],
      [0.195, 0.25, 0.02, 0.06],
      [-0.205, 0.18, -0.04, 0.058],
      [0.205, 0.18, -0.04, 0.058],
      [-0.175, 0.12, -0.10, 0.058],
      [0.175, 0.12, -0.10, 0.058],
      [-0.11, 0.11, -0.165, 0.062],
      [0.0, 0.105, -0.185, 0.065],
      [0.11, 0.11, -0.165, 0.062],
      [-0.13, 0.22, -0.165, 0.065],
      [0.0, 0.23, -0.19, 0.068],
      [0.13, 0.22, -0.165, 0.065],
      [-0.11, 0.32, -0.145, 0.064],
      [0.0, 0.33, -0.165, 0.066],
      [0.11, 0.32, -0.145, 0.064],
    ];
    for (const [x, y, z, r] of curls) {
      const puff = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat), "hair");
      puff.position.set(x, y, z);
      hair.add(puff);
    }
    return hair;
  }

  if (style === "afro") {
    const core = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.275, 28, 22), mat), "hair");
    core.scale.set(1.06, 0.98, 1.0);
    core.position.set(0, 0.275, -0.042);
    hair.add(core);

    // Sculpted cloud-like perimeter puffs
    const rings = [
      { count: 10, y: 0.36, rad: 0.185, r: 0.095 },
      { count: 12, y: 0.26, rad: 0.225, r: 0.092 },
      { count: 10, y: 0.15, rad: 0.195, r: 0.082 },
    ];
    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const a = (i / ring.count) * Math.PI * 2;
        const z = Math.cos(a) * ring.rad - 0.04;
        // Leave face area open
        if (z > 0.11 && ring.y < 0.31) continue;
        const x = Math.sin(a) * ring.rad * 1.05;
        const puff = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(ring.r, 14, 12), mat), "hair");
        puff.position.set(x, ring.y, z);
        hair.add(puff);
      }
    }
    const topPuff = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), mat), "hair");
    topPuff.position.set(0, 0.455, -0.025);
    hair.add(topPuff);
    return hair;
  }

  if (style === "braids") {
    hair.add(buildHairCap(THREE, mat, 1.055, Math.PI * 0.68));
    const back = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.208, 22, 16), mat), "hair");
    back.position.set(0, 0.185, -0.04);
    hair.add(back);

    for (const side of [-1, 1]) {
      // Soft parted front swoop
      const swoop = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), mat), "hair");
      swoop.scale.set(1.15, 0.65, 0.85);
      swoop.position.set(side * 0.085, 0.34, 0.115);
      swoop.rotation.z = -side * 0.35;
      hair.add(swoop);

      // Twin hanging braid made of alternating overlapping beads
      const braid = new THREE.Group();
      braid.position.set(side * 0.175, 0.16, -0.03);
      for (let i = 0; i < 8; i++) {
        const seg = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.032 - i * 0.0018, 12, 10), mat), "hair");
        seg.scale.set(1.05, 0.78, 0.9);
        const zig = (i % 2 === 0 ? 1 : -1) * 0.008;
        seg.position.set(zig, -i * 0.034, i * 0.009);
        seg.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.35;
        braid.add(seg);
      }
      // Hair tie
      const tie = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 8, 14), mats.topAccent), "topAccent");
      tie.rotation.x = Math.PI / 2;
      tie.position.set(0, -0.275, 0.072);
      braid.add(tie);
      // Tapered tassel tip
      const tassel = tagMesh(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 12), mat), "hair");
      tassel.rotation.x = Math.PI;
      tassel.position.set(0, -0.305, 0.076);
      braid.add(tassel);
      hair.add(braid);
    }
    return hair;
  }

  if (style === "bob") {
    hair.add(buildHairCap(THREE, mat, 1.06, Math.PI * 0.62));
    // Smooth bell-shaped chin-length shell around sides and back
    const pts = [
      new THREE.Vector2(0.185, 0.03),
      new THREE.Vector2(0.228, 0.085),
      new THREE.Vector2(0.232, 0.175),
      new THREE.Vector2(0.222, 0.275),
      new THREE.Vector2(0.175, 0.355),
      new THREE.Vector2(0.095, 0.405),
      new THREE.Vector2(0.0, 0.422),
    ];
    // Open in front for face using phiStart / phiLength
    const shell = tagMesh(new THREE.Mesh(new THREE.LatheGeometry(pts, 28, Math.PI * 0.28, Math.PI * 1.44), mat), "hair");
    shell.position.set(0, 0.0, -0.014);
    hair.add(shell);

    // Rounded front vertical edges of the bob
    for (const side of [-1, 1]) {
      const edge = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.21, 8, 12), mat), "hair");
      edge.position.set(side * 0.178, 0.165, 0.098);
      edge.rotation.z = side * 0.08;
      hair.add(edge);
    }

    // Neat straight-across bangs with soft bevel
    const bangCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.145, 0.285, 0.135),
      new THREE.Vector3(-0.06, 0.295, 0.185),
      new THREE.Vector3(0.06, 0.295, 0.185),
      new THREE.Vector3(0.145, 0.285, 0.135),
    ]);
    const bangs = tagMesh(new THREE.Mesh(new THREE.TubeGeometry(bangCurve, 20, 0.034, 12, false), mat), "hair");
    bangs.scale.set(1, 1.25, 0.8);
    hair.add(bangs);
    return hair;
  }

  if (style === "longStraight") {
    hair.add(buildHairCap(THREE, mat, 1.06, Math.PI * 0.68));
    // Broad flowing back sheet
    const shape = new THREE.Shape();
    shape.moveTo(-0.20, 0.25);
    shape.lineTo(0.20, 0.25);
    shape.quadraticCurveTo(0.23, 0.0, 0.21, -0.22);
    shape.quadraticCurveTo(0.0, -0.25, -0.21, -0.22);
    shape.quadraticCurveTo(-0.23, 0.0, -0.20, 0.25);
    const backGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.065,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.022,
      bevelSegments: 5,
      curveSegments: 14,
    });
    const backSheet = tagMesh(new THREE.Mesh(backGeo, mat), "hair");
    backSheet.position.set(0, 0.02, -0.215);
    hair.add(backSheet);

    // Side framing long locks
    for (const side of [-1, 1]) {
      const lock = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.34, 8, 12), mat), "hair");
      lock.position.set(side * 0.195, 0.08, 0.045);
      lock.rotation.z = side * 0.04;
      hair.add(lock);
    }

    // Soft side-swept bangs
    const bang = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat), "hair");
    bang.scale.set(1.35, 0.55, 0.72);
    bang.position.set(-0.02, 0.335, 0.145);
    bang.rotation.z = 0.18;
    hair.add(bang);
    return hair;
  }

  if (style === "ponytail") {
    hair.add(buildHairCap(THREE, mat, 1.055, Math.PI * 0.72));
    const back = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.205, 22, 16), mat), "hair");
    back.position.set(0, 0.19, -0.028);
    hair.add(back);

    // Soft bangs
    for (const side of [-1, 1]) {
      const b = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), mat), "hair");
      b.scale.set(1.15, 0.7, 0.7);
      b.position.set(side * 0.065, 0.335, 0.155);
      b.rotation.z = -side * 0.25;
      hair.add(b);
    }

    // Hair tie at back
    const tie = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 10, 18), mats.topAccent), "topAccent");
    tie.position.set(0, 0.265, -0.215);
    tie.rotation.x = 0.35;
    hair.add(tie);

    // Bouncy curved ponytail
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.265, -0.22),
      new THREE.Vector3(0, 0.27, -0.295),
      new THREE.Vector3(0, 0.17, -0.34),
      new THREE.Vector3(0, 0.03, -0.315),
    ]);
    const tail = tagMesh(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.054, 14, false), mat), "hair");
    hair.add(tail);

    const tip = tagMesh(new THREE.Mesh(new THREE.ConeGeometry(0.054, 0.10, 14), mat), "hair");
    tip.rotation.x = Math.PI + 0.18;
    tip.position.set(0, -0.015, -0.305);
    hair.add(tip);
    return hair;
  }

  // hijab
  const hMat = mats.hair;
  // Main draped hood dome
  const dome = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.224, 28, 22), hMat), "hair");
  dome.scale.set(1.02, 1.03, 1.04);
  dome.position.set(0, 0.205, -0.025);
  hair.add(dome);

  // Soft face-framing rim
  const frame = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.044, 14, 28), hMat), "hair");
  frame.scale.set(1.02, 1.12, 0.85);
  frame.position.set(0, 0.188, 0.072);
  hair.add(frame);

  // Neck wrap fold
  const neckWrap = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.042, 12, 24), hMat), "hair");
  neckWrap.rotation.x = Math.PI / 2 + 0.12;
  neckWrap.position.set(0, 0.015, 0.01);
  hair.add(neckWrap);

  // Draped shoulder cape
  const capePts = [
    new THREE.Vector2(0.195, -0.14),
    new THREE.Vector2(0.185, -0.06),
    new THREE.Vector2(0.145, 0.01),
    new THREE.Vector2(0.115, 0.04),
  ];
  const cape = tagMesh(new THREE.Mesh(new THREE.LatheGeometry(capePts, 24), hMat), "hair");
  cape.scale.set(1.04, 1.0, 0.88);
  hair.add(cape);

  // Draped front scarf tail over left shoulder
  const drape = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.11, 8, 12), hMat), "hair");
  drape.scale.set(1.25, 1.0, 0.55);
  drape.position.set(0.085, -0.075, 0.105);
  drape.rotation.set(-0.2, 0, -0.22);
  hair.add(drape);

  return hair;
}

function buildHeadwear(THREE, type, hairStyle, mats) {
  const group = new THREE.Group();
  if (type === "none") return group;

  const afroLift = hairStyle === "afro" ? 0.055 : 0;

  if (type === "cap") {
    const cap = new THREE.Group();
    cap.position.set(0, 0.255 + afroLift, -0.006);
    cap.rotation.x = -0.14;

    const dome = tagMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.218, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.headwear),
      "headwear"
    );
    dome.scale.set(1.02, 0.86, 1.04);
    cap.add(dome);

    const btn = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), mats.headwearAccent), "headwearAccent");
    btn.position.set(0, 0.188, 0);
    cap.add(btn);

    // Curved front brim
    const brimShape = new THREE.Shape();
    brimShape.moveTo(-0.155, 0);
    brimShape.quadraticCurveTo(-0.14, 0.165, 0, 0.185);
    brimShape.quadraticCurveTo(0.14, 0.165, 0.155, 0);
    brimShape.quadraticCurveTo(0, 0.04, -0.155, 0);

    const brimGeo = new THREE.ExtrudeGeometry(brimShape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 3,
      curveSegments: 16,
    });
    const brim = tagMesh(new THREE.Mesh(brimGeo, mats.headwear), "headwear");
    brim.rotation.x = Math.PI / 2 + 0.1;
    brim.position.set(0, 0.02, 0.155);
    cap.add(brim);

    group.add(cap);
  } else if (type === "beanie") {
    const beanie = new THREE.Group();
    beanie.position.set(0, 0.245 + afroLift, -0.014);
    beanie.rotation.x = -0.2;

    const pts = [
      new THREE.Vector2(0.218, 0.0),
      new THREE.Vector2(0.222, 0.065),
      new THREE.Vector2(0.202, 0.138),
      new THREE.Vector2(0.145, 0.20),
      new THREE.Vector2(0.065, 0.232),
      new THREE.Vector2(0.0, 0.24),
    ];
    const body = tagMesh(new THREE.Mesh(new THREE.LatheGeometry(pts, 28), mats.headwear), "headwear");
    beanie.add(body);

    // Folded ribbed cuff
    const cuff = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.214, 0.032, 12, 28), mats.headwearAccent), "headwearAccent");
    cuff.rotation.x = Math.PI / 2;
    cuff.scale.set(1.0, 1.0, 1.3);
    cuff.position.y = 0.015;
    beanie.add(cuff);

    // Fluffy pom-pom
    const pom = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), mats.headwearAccent), "headwearAccent");
    pom.position.set(0, 0.265, -0.01);
    beanie.add(pom);

    group.add(beanie);
  } else if (type === "headphones") {
    const hp = new THREE.Group();
    const extraR = hairStyle === "afro" ? 0.035 : 0;

    // Arched headband
    const band = tagMesh(
      new THREE.Mesh(new THREE.TorusGeometry(0.225 + extraR, 0.018, 12, 28, Math.PI), mats.headwear),
      "headwear"
    );
    band.position.set(0, 0.21, -0.008);
    hp.add(band);

    for (const side of [-1, 1]) {
      // Metal slider
      const slider = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.045, 6, 8), mats.metal), "metal");
      slider.position.set(side * (0.222 + extraR), 0.20, -0.008);
      hp.add(slider);

      // Plush ear cushion
      const cushion = tagMesh(
        new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 12, 20), mats.headwearAccent),
        "headwearAccent"
      );
      cushion.rotation.y = Math.PI / 2;
      cushion.position.set(side * (0.208 + extraR * 0.6), 0.175, -0.008);
      hp.add(cushion);

      // Outer cup shell
      const cup = tagMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), mats.headwear),
        "headwear"
      );
      cup.rotation.z = -side * Math.PI / 2;
      cup.position.set(side * (0.22 + extraR * 0.6), 0.175, -0.008);
      hp.add(cup);
    }
    group.add(hp);
  }

  return group;
}

function buildGlasses(THREE, type, mats) {
  const group = new THREE.Group();
  if (type === "none") return group;

  group.position.set(0, 0.184, 0.212);

  for (const side of [-1, 1]) {
    if (type === "round") {
      const rim = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0042, 10, 24), mats.glasses), "glasses");
      rim.position.set(side * 0.066, 0, 0);
      rim.rotation.y = side * 0.15;
      group.add(rim);

      const lens = tagMesh(new THREE.Mesh(new THREE.CircleGeometry(0.039, 20), mats.lens), "accent");
      lens.position.set(side * 0.066, 0, -0.001);
      lens.rotation.y = side * 0.15;
      group.add(lens);
    } else {
      // square with soft rounded corners
      const outer = makeRoundedRectShape(THREE, 0.088, 0.068, 0.018);
      const hole = makeRoundedRectShape(THREE, 0.072, 0.052, 0.012);
      outer.holes.push(hole);
      const frameGeo = new THREE.ExtrudeGeometry(outer, {
        depth: 0.006,
        bevelEnabled: true,
        bevelThickness: 0.0025,
        bevelSize: 0.0025,
        bevelSegments: 3,
        curveSegments: 10,
      });
      frameGeo.center();
      const rim = tagMesh(new THREE.Mesh(frameGeo, mats.glasses), "glasses");
      rim.position.set(side * 0.066, 0, 0);
      rim.rotation.y = side * 0.15;
      group.add(rim);

      const lensGeo = new THREE.ShapeGeometry(makeRoundedRectShape(THREE, 0.074, 0.054, 0.012));
      const lens = tagMesh(new THREE.Mesh(lensGeo, mats.lens), "accent");
      lens.position.set(side * 0.066, 0, -0.001);
      lens.rotation.y = side * 0.15;
      group.add(lens);
    }

    // Temple arm reaching back to ears
    const arm = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, 0.19, 4, 8), mats.glasses), "glasses");
    arm.rotation.x = Math.PI / 2;
    arm.rotation.z = -side * 0.25;
    arm.position.set(side * 0.145, 0.004, -0.105);
    group.add(arm);
  }

  // Nose bridge
  const bridge = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0035, 8, 12, Math.PI * 0.7), mats.glasses), "glasses");
  bridge.position.set(0, -0.004, 0.006);
  bridge.rotation.z = Math.PI * 0.15;
  group.add(bridge);

  return group;
}

function buildTopBody(THREE, topStyle, mats) {
  const group = new THREE.Group();

  // Base tapered cozy torso lathe (local y: -0.02 to 0.28)
  const pts = [
    new THREE.Vector2(0.0, -0.02),
    new THREE.Vector2(0.118, -0.015),
    new THREE.Vector2(0.136, 0.03),
    new THREE.Vector2(0.132, 0.115),
    new THREE.Vector2(0.116, 0.21),
    new THREE.Vector2(0.088, 0.268),
    new THREE.Vector2(0.052, 0.282),
    new THREE.Vector2(0.0, 0.285),
  ];
  const bodyGeo = new THREE.LatheGeometry(pts, 28);
  const bodyMat = topStyle === "cardigan" ? mats.topAccent : mats.top;
  const bodySlot = topStyle === "cardigan" ? "topAccent" : "top";
  const body = tagMesh(new THREE.Mesh(bodyGeo, bodyMat), bodySlot);
  body.scale.set(1.06, 1.0, 0.86);
  group.add(body);

  if (topStyle === "hoodie") {
    // Ribbed bottom hem
    const hem = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.017, 10, 26), mats.top), "top");
    hem.rotation.x = Math.PI / 2;
    hem.scale.set(1.06, 0.86, 1.0);
    hem.position.y = 0.005;
    group.add(hem);

    // Kangaroo pocket
    const pShape = new THREE.Shape();
    pShape.moveTo(-0.075, -0.038);
    pShape.lineTo(0.075, -0.038);
    pShape.lineTo(0.058, 0.038);
    pShape.lineTo(-0.058, 0.038);
    pShape.closePath();
    const pGeo = new THREE.ExtrudeGeometry(pShape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.007,
      bevelSegments: 3,
    });
    pGeo.center();
    const pocket = tagMesh(new THREE.Mesh(pGeo, mats.top), "top");
    pocket.position.set(0, 0.068, 0.112);
    pocket.rotation.x = -0.1;
    group.add(pocket);

    // Cozy folded hood collar behind neck
    const hoodRing = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.028, 12, 22), mats.top), "top");
    hoodRing.rotation.x = Math.PI / 2 - 0.25;
    hoodRing.position.set(0, 0.272, -0.012);
    group.add(hoodRing);

    const hoodBack = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 12), mats.top), "top");
    hoodBack.scale.set(1.25, 0.72, 0.9);
    hoodBack.position.set(0, 0.248, -0.085);
    group.add(hoodBack);

    // Drawstrings
    for (const side of [-1, 1]) {
      const str = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.075, 4, 8), mats.topAccent), "topAccent");
      str.position.set(side * 0.028, 0.215, 0.095);
      str.rotation.x = -0.18;
      str.rotation.z = side * 0.08;
      group.add(str);
    }
  } else if (topStyle === "tee") {
    // Ribbed crew neck collar
    const collar = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.013, 10, 22), mats.topAccent), "topAccent");
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.278, 0.004);
    group.add(collar);
  } else if (topStyle === "shirt") {
    // Crisp folded collar lapels
    const neckBand = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.014, 10, 22), mats.topAccent), "topAccent");
    neckBand.rotation.x = Math.PI / 2;
    neckBand.position.set(0, 0.278, 0.0);
    group.add(neckBand);

    for (const side of [-1, 1]) {
      const lapel = tagMesh(new THREE.Mesh(makeRoundedBox(THREE, 0.048, 0.036, 0.014, 0.008, 0.004), mats.topAccent), "topAccent");
      lapel.position.set(side * 0.038, 0.262, 0.058);
      lapel.rotation.set(-0.45, side * 0.35, -side * 0.45);
      group.add(lapel);
    }

    // Front button placket & buttons
    const placket = tagMesh(new THREE.Mesh(makeRoundedBox(THREE, 0.024, 0.22, 0.012, 0.006, 0.003), mats.top), "top");
    placket.position.set(0, 0.135, 0.108);
    placket.rotation.x = -0.14;
    group.add(placket);

    for (let i = 0; i < 3; i++) {
      const btn = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), mats.topAccent), "topAccent");
      btn.scale.set(1, 1, 0.55);
      btn.position.set(0, 0.20 - i * 0.058, 0.106 + i * 0.008);
      group.add(btn);
    }

    // Small chest pocket
    const cp = tagMesh(new THREE.Mesh(makeRoundedBox(THREE, 0.046, 0.048, 0.012, 0.008, 0.004), mats.top), "top");
    cp.position.set(0.055, 0.175, 0.098);
    cp.rotation.set(-0.15, 0.35, 0);
    group.add(cp);
  } else if (topStyle === "cardigan") {
    // Open-front knitted cardigan shell wrapping around the inner tee
    const cardiPts = [
      new THREE.Vector2(0.128, -0.015),
      new THREE.Vector2(0.146, 0.03),
      new THREE.Vector2(0.142, 0.115),
      new THREE.Vector2(0.126, 0.21),
      new THREE.Vector2(0.096, 0.268),
      new THREE.Vector2(0.06, 0.282),
    ];
    // Open front gap via phiStart/phiLength
    const shell = tagMesh(
      new THREE.Mesh(new THREE.LatheGeometry(cardiPts, 28, Math.PI * 0.18, Math.PI * 1.64), mats.top),
      "top"
    );
    shell.scale.set(1.06, 1.0, 0.88);
    group.add(shell);

    // Ribbed front plackets framing the V-opening
    for (const side of [-1, 1]) {
      const trim = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.23, 6, 10), mats.top), "top");
      trim.position.set(side * 0.048, 0.135, 0.105);
      trim.rotation.set(-0.14, 0, side * 0.06);
      group.add(trim);

      // Patch pockets
      const pkt = tagMesh(new THREE.Mesh(makeRoundedBox(THREE, 0.048, 0.052, 0.014, 0.009, 0.004), mats.top), "top");
      pkt.position.set(side * 0.078, 0.068, 0.102);
      pkt.rotation.set(-0.1, side * 0.45, 0);
      group.add(pkt);
    }

    // Buttons along right placket
    for (let i = 0; i < 3; i++) {
      const btn = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), mats.metal), "metal");
      btn.scale.set(1, 1, 0.55);
      btn.position.set(-0.046, 0.18 - i * 0.055, 0.114 + i * 0.006);
      group.add(btn);
    }

    // Inner tee neckline ring
    const innerCollar = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.011, 8, 20), mats.topAccent), "topAccent");
    innerCollar.rotation.x = Math.PI / 2;
    innerCollar.position.set(0, 0.278, 0.004);
    group.add(innerCollar);
  }

  return group;
}

function buildArm(THREE, side, topStyle, mats) {
  const arm = new THREE.Group();
  arm.name = side > 0 ? "armL" : "armR";
  arm.position.set(side * 0.134, 0.242, 0.0);
  arm.rotation.z = side * 0.18;

  const isShortSleeve = topStyle === "tee";

  // Shoulder cap
  const shoulder = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), mats.top), "top");
  arm.add(shoulder);

  if (isShortSleeve) {
    const sleeve = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.065, 8, 14), mats.top), "top");
    sleeve.position.y = -0.042;
    arm.add(sleeve);

    const cuff = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 8, 16), mats.top), "top");
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.075;
    arm.add(cuff);

    const bareArm = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.031, 0.13, 8, 12), mats.skin), "skin");
    bareArm.position.y = -0.145;
    arm.add(bareArm);
  } else {
    const sleeve = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.039, 0.165, 8, 14), mats.top), "top");
    sleeve.position.y = -0.095;
    arm.add(sleeve);

    const cuffMat = topStyle === "shirt" ? mats.topAccent : mats.top;
    const cuffSlot = topStyle === "shirt" ? "topAccent" : "top";
    const cuff = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 8, 16), cuffMat), cuffSlot);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.182;
    arm.add(cuff);
  }

  // Soft chibi mitten hand + cute thumb
  const hand = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 12), mats.skin), "skin");
  hand.scale.set(0.95, 1.12, 0.85);
  hand.position.set(0, -0.222, 0.005);
  arm.add(hand);

  const thumb = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.018, 4, 8), mats.skin), "skin");
  thumb.position.set(-side * 0.024, -0.214, 0.02);
  thumb.rotation.set(0.3, 0, side * 0.55);
  arm.add(thumb);

  return arm;
}

function buildShoe(THREE, mats) {
  const shoe = new THREE.Group();

  // Chunky rounded sole resting on y = 0 (local y = -0.32 in leg space -> shoe placed at y = -0.32)
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-0.044, -0.055);
  soleShape.quadraticCurveTo(-0.052, 0.02, -0.045, 0.068);
  soleShape.quadraticCurveTo(0, 0.105, 0.045, 0.068);
  soleShape.quadraticCurveTo(0.052, 0.02, 0.044, -0.055);
  soleShape.quadraticCurveTo(0, -0.072, -0.044, -0.055);

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 3,
    curveSegments: 12,
  });
  const sole = tagMesh(new THREE.Mesh(soleGeo, mats.shoeAccent), "shoeAccent");
  sole.rotation.x = Math.PI / 2;
  sole.position.set(0, 0.021, 0.02);
  shoe.add(sole);

  // Soft rounded shoe upper
  const upper = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), mats.shoe), "shoe");
  upper.scale.set(0.98, 0.82, 1.48);
  upper.position.set(0, 0.048, 0.024);
  shoe.add(upper);

  // Ankle collar
  const collar = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 8, 16), mats.shoeAccent), "shoeAccent");
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.078, -0.002);
  shoe.add(collar);

  // Cozy lace bars
  for (let i = 0; i < 2; i++) {
    const lace = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.028, 4, 8), mats.shoeAccent), "shoeAccent");
    lace.rotation.z = Math.PI / 2;
    lace.position.set(0, 0.074 - i * 0.011, 0.038 + i * 0.018);
    shoe.add(lace);
  }

  return shoe;
}

function buildLeg(THREE, side, bottomStyle, mats) {
  const leg = new THREE.Group();
  leg.name = side > 0 ? "legL" : "legR";
  leg.position.set(side * 0.068, 0.32, 0);

  if (bottomStyle === "trousers") {
    const pant = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.185, 8, 14), mats.bottom), "bottom");
    pant.position.y = -0.115;
    leg.add(pant);

    const cuff = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 16), mats.bottom), "bottom");
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.228;
    leg.add(cuff);
  } else if (bottomStyle === "shorts") {
    const shortLeg = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.075, 8, 14), mats.bottom), "bottom");
    shortLeg.position.y = -0.055;
    leg.add(shortLeg);

    const hem = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.008, 8, 16), mats.bottom), "bottom");
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -0.098;
    leg.add(hem);

    const bare = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.11, 8, 12), mats.skin), "skin");
    bare.position.y = -0.165;
    leg.add(bare);

    // Cozy ankle sock
    const sock = tagMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.037, 0.048, 14), mats.shoeAccent), "shoeAccent");
    sock.position.y = -0.222;
    leg.add(sock);
  } else {
    // skirt: bare legs + cozy mid-calf socks
    const bare = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.037, 0.165, 8, 12), mats.skin), "skin");
    bare.position.y = -0.115;
    leg.add(bare);

    const sock = tagMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.037, 0.072, 14), mats.shoeAccent), "shoeAccent");
    sock.position.y = -0.21;
    leg.add(sock);

    const sockTop = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 8, 16), mats.shoeAccent), "shoeAccent");
    sockTop.rotation.x = Math.PI / 2;
    sockTop.position.y = -0.175;
    leg.add(sockTop);
  }

  const shoe = buildShoe(THREE, mats);
  shoe.position.set(0, -0.32, 0);
  leg.add(shoe);

  return leg;
}

export function buildCharacter(THREE, look = {}) {
  const cfg = {
    skin: look.skin || PARTS.skin[1],
    hairStyle: PARTS.hairStyles.includes(look.hairStyle) ? look.hairStyle : "short",
    hairColor: look.hairColor || PARTS.hairColors[1],
    eyes: PARTS.eyes.includes(look.eyes) ? look.eyes : "round",
    top: PARTS.tops.includes(look.top) ? look.top : "hoodie",
    topColor: look.topColor || "#7EA89E",
    bottom: PARTS.bottoms.includes(look.bottom) ? look.bottom : "trousers",
    bottomColor: look.bottomColor || "#4E5D73",
    shoeColor: look.shoeColor || "#C86D51",
    headwear: PARTS.headwear.includes(look.headwear) ? look.headwear : "none",
    glasses: PARTS.glasses.includes(look.glasses) ? look.glasses : "none",
    blush: look.blush !== undefined ? Boolean(look.blush) : true,
  };

  const mats = {
    skin: makeMat(THREE, cfg.skin, { roughness: 0.72 }),
    hair: makeMat(THREE, cfg.hairColor, { roughness: 0.82 }),
    top: makeMat(THREE, cfg.topColor, { roughness: 0.86 }),
    topAccent: makeMat(THREE, "#F4EFE6", { roughness: 0.84 }),
    bottom: makeMat(THREE, cfg.bottomColor, { roughness: 0.85 }),
    shoe: makeMat(THREE, cfg.shoeColor, { roughness: 0.74 }),
    shoeAccent: makeMat(THREE, "#F5F1E9", { roughness: 0.8 }),
    headwear: makeMat(THREE, cfg.topColor, { roughness: 0.84 }),
    headwearAccent: makeMat(THREE, "#EFE8DC", { roughness: 0.82 }),
    glasses: makeMat(THREE, "#3E342F", { roughness: 0.32, metalness: 0.45 }),
    lens: makeMat(THREE, "#FFFFFF", { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.22 }),
    eye: makeMat(THREE, "#221D1B", { roughness: 0.22, metalness: 0.05 }),
    white: makeMat(THREE, "#FFFFFF", { roughness: 0.15 }),
    mouth: makeMat(THREE, "#7A3B3B", { roughness: 0.55 }),
    blush: makeMat(THREE, "#F08C8C", { roughness: 0.75, transparent: true, opacity: 0.55 }),
    metal: makeMat(THREE, "#C5B49A", { roughness: 0.35, metalness: 0.65 }),
  };

  const root = new THREE.Group();
  root.name = "character";

  // Pelvis / waistband connecting legs & torso
  const pelvis = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.125, 22, 16), mats.bottom), "bottom");
  pelvis.scale.set(1.06, 0.72, 0.88);
  pelvis.position.set(0, 0.32, 0);
  root.add(pelvis);

  if (cfg.bottom === "skirt") {
    const skirtPts = [
      new THREE.Vector2(0.185, 0.14),
      new THREE.Vector2(0.168, 0.22),
      new THREE.Vector2(0.132, 0.325),
      new THREE.Vector2(0.118, 0.345),
    ];
    const skirt = tagMesh(new THREE.Mesh(new THREE.LatheGeometry(skirtPts, 28), mats.bottom), "bottom");
    skirt.scale.set(1.04, 1.0, 0.92);
    root.add(skirt);

    // Subtle soft pleat ridges
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const pleat = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.145, 4, 8), mats.bottom), "bottom");
      pleat.position.set(Math.sin(a) * 0.156, 0.225, Math.cos(a) * 0.142);
      pleat.rotation.z = -Math.sin(a) * 0.26;
      pleat.rotation.x = Math.cos(a) * 0.24;
      root.add(pleat);
    }

    // Waistband
    const wb = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.014, 10, 26), mats.bottom), "bottom");
    wb.rotation.x = Math.PI / 2;
    wb.scale.set(1.06, 0.88, 1.0);
    wb.position.y = 0.335;
    root.add(wb);
  }

  // Legs
  const legL = buildLeg(THREE, 1, cfg.bottom, mats);
  const legR = buildLeg(THREE, -1, cfg.bottom, mats);
  root.add(legL, legR);

  // Torso group (pivots at waist so breathing lifts upper body naturally)
  const torso = new THREE.Group();
  torso.name = "torso";
  torso.position.set(0, 0.34, 0);
  torso.userData.restY = 0.34;
  root.add(torso);

  torso.add(buildTopBody(THREE, cfg.top, mats));

  // Soft neck
  const neck = tagMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.075, 16), mats.skin), "skin");
  neck.position.set(0, 0.305, 0);
  torso.add(neck);

  // Arms (children of torso so they breathe together)
  const armL = buildArm(THREE, 1, cfg.top, mats);
  const armR = buildArm(THREE, -1, cfg.top, mats);
  armL.userData.restRotZ = armL.rotation.z;
  armR.userData.restRotZ = armR.rotation.z;
  torso.add(armL, armR);

  // Head group
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 0.325, 0);
  head.userData.restY = 0.325;
  torso.add(head);

  const headMesh = tagMesh(new THREE.Mesh(buildHeadGeometry(THREE), mats.skin), "skin");
  head.add(headMesh);

  // Cute rounded ears
  for (const side of [-1, 1]) {
    const ear = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), mats.skin), "skin");
    ear.scale.set(0.62, 1.08, 0.85);
    ear.position.set(side * 0.198, 0.175, -0.008);
    head.add(ear);
  }

  // Subtle button nose
  const nose = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), mats.skin), "skin");
  nose.scale.set(1.05, 0.85, 0.75);
  nose.position.set(0, 0.154, 0.201);
  head.add(nose);

  // Cheek blush
  const blushGroup = new THREE.Group();
  blushGroup.visible = cfg.blush;
  for (const side of [-1, 1]) {
    const cheek = tagMesh(new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), mats.blush), "blush");
    cheek.scale.set(1.25, 0.72, 0.28);
    cheek.position.set(side * 0.114, 0.144, 0.165);
    cheek.rotation.y = side * 0.56;
    blushGroup.add(cheek);
  }
  head.add(blushGroup);

  // Eyebrows
  const brows = [];
  for (const side of [-1, 1]) {
    const brow = tagMesh(new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.032, 4, 8), mats.hair), "hair");
    brow.position.set(side * 0.068, 0.232, 0.184);
    brow.rotation.set(0, side * 0.3, Math.PI / 2 - side * 0.08);
    brow.userData.side = side;
    brow.userData.restY = 0.232;
    brow.userData.restRotZ = Math.PI / 2 - side * 0.08;
    head.add(brow);
    brows.push(brow);
  }

  // Expression eye & mouth sets
  const eyesDefault = buildEyeStyle(THREE, cfg.eyes, mats);
  const eyesAsleep = buildClosedEyes(THREE, mats);
  const eyesHappy = buildEyeStyle(THREE, "smile", mats);
  eyesAsleep.visible = false;
  eyesHappy.visible = false;
  head.add(eyesDefault, eyesAsleep, eyesHappy);

  const mouths = buildMouths(THREE, mats);
  for (const [key, m] of Object.entries(mouths)) {
    m.visible = key === "awake";
    head.add(m);
  }

  // Hair, Headwear, Glasses
  const hair = buildHair(THREE, cfg.hairStyle, mats);
  head.add(hair);

  const headwear = buildHeadwear(THREE, cfg.headwear, cfg.hairStyle, mats);
  head.add(headwear);

  const glasses = buildGlasses(THREE, cfg.glasses, mats);
  head.add(glasses);

  // Store expression handles on root
  root.userData.expr = {
    eyesDefault,
    eyesAsleep,
    eyesHappy,
    mouths,
    brows,
    blushGroup,
    baseBlush: cfg.blush,
    headTiltX: 0,
    headTiltZ: 0,
    name: "awake",
  };

  setExpression(root, "awake");
  return root;
}

export function setExpression(arg1, arg2, arg3) {
  const group = arg1 && arg1.isObject3D ? arg1 : arg2;
  const name = arg1 && arg1.isObject3D ? arg2 : arg3;
  if (!group || !group.userData || !group.userData.expr) return;

  const expr = group.userData.expr;
  const valid = ["asleep", "awake", "thinking", "unsure", "happy"];
  const mode = valid.includes(name) ? name : "awake";
  expr.name = mode;

  // Eyes visibility & subtle scale
  expr.eyesDefault.visible = mode === "awake" || mode === "thinking" || mode === "unsure";
  expr.eyesAsleep.visible = mode === "asleep";
  expr.eyesHappy.visible = mode === "happy";

  expr.eyesDefault.scale.set(1, mode === "unsure" ? 0.82 : 1, 1);
  expr.eyesDefault.position.set(mode === "thinking" ? 0.008 : 0, mode === "thinking" ? 0.006 : 0, 0);

  // Mouths
  for (const [k, m] of Object.entries(expr.mouths)) {
    m.visible = k === mode;
  }

  // Brows & blush & expression head tilt
  for (const brow of expr.brows) {
    const s = brow.userData.side;
    brow.position.y = brow.userData.restY;
    brow.rotation.z = brow.userData.restRotZ;

    if (mode === "asleep") {
      brow.position.y = brow.userData.restY - 0.009;
      brow.rotation.z = Math.PI / 2 + s * 0.06;
    } else if (mode === "thinking") {
      brow.position.y = brow.userData.restY + (s > 0 ? 0.01 : -0.004);
      brow.rotation.z = Math.PI / 2 - s * (s > 0 ? 0.16 : -0.1);
    } else if (mode === "unsure") {
      brow.position.y = brow.userData.restY + 0.003;
      brow.rotation.z = Math.PI / 2 + s * 0.24;
    } else if (mode === "happy") {
      brow.position.y = brow.userData.restY + 0.011;
      brow.rotation.z = Math.PI / 2 - s * 0.14;
    }
  }

  if (mode === "happy") {
    expr.blushGroup.visible = true;
    expr.blushGroup.scale.set(1.15, 1.15, 1);
  } else {
    expr.blushGroup.visible = expr.baseBlush;
    expr.blushGroup.scale.set(1, 1, 1);
  }

  expr.headTiltX = mode === "asleep" ? 0.16 : mode === "thinking" ? -0.06 : 0;
  expr.headTiltZ = mode === "thinking" ? 0.12 : mode === "unsure" ? -0.09 : 0;
}

export function idle(arg1, arg2, arg3) {
  const group = arg1 && arg1.isObject3D ? arg1 : arg2;
  const t = arg1 && arg1.isObject3D ? arg2 : arg3;
  if (!group || typeof t !== "number") return;

  const torso = group.getObjectByName("torso");
  const head = group.getObjectByName("head");
  const armL = group.getObjectByName("armL");
  const armR = group.getObjectByName("armR");
  const expr = group.userData && group.userData.expr;
  const isAsleep = expr && expr.name === "asleep";

  const breathRate = isAsleep ? 1.35 : 2.1;
  const breath = Math.sin(t * breathRate);

  if (torso) {
    const restY = torso.userData.restY !== undefined ? torso.userData.restY : 0.34;
    torso.position.y = restY + breath * 0.0055;
    torso.scale.set(1 + breath * 0.01, 1 + breath * 0.012, 1 + breath * 0.012);
  }

  if (armL) {
    const baseZ = armL.userData.restRotZ !== undefined ? armL.userData.restRotZ : 0.18;
    armL.rotation.z = baseZ + breath * 0.032;
    armL.rotation.x = Math.sin(t * 0.85) * 0.03;
  }

  if (armR) {
    const baseZ = armR.userData.restRotZ !== undefined ? armR.userData.restRotZ : -0.18;
    armR.rotation.z = baseZ - breath * 0.032;
    armR.rotation.x = -Math.sin(t * 0.85) * 0.03;
  }

  if (head) {
    const tiltX = expr ? expr.headTiltX : 0;
    const tiltZ = expr ? expr.headTiltZ : 0;
    const swayScale = isAsleep ? 0.35 : 1.0;

    head.rotation.y = Math.sin(t * 0.65) * 0.09 * swayScale;
    head.rotation.z = tiltZ + Math.sin(t * 0.45 + 0.8) * 0.055 * swayScale;
    head.rotation.x = tiltX + Math.sin(t * 0.9 + 0.3) * 0.035 * swayScale + breath * 0.015;
  }
}