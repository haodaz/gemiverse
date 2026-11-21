const JOINT_NAMES = [
  'pelvis', 'chest', 'neck', 'head',
  'armL', 'forearmL', 'handL',
  'armR', 'forearmR', 'handR',
  'legL', 'shinL', 'footL',
  'legR', 'shinR', 'footR',
];

const TAU = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;

// --- Math & easing helpers ---

function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOut(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function easeOut(t) {
  t = clamp(t, 0, 1);
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function easeIn(t) {
  t = clamp(t, 0, 1);
  return t * t * t;
}

function pulse(t, start, end, ramp) {
  if (t <= start || t >= end) return 0;
  const r = Math.min(ramp, (end - start) * 0.5);
  if (t < start + r) return easeInOut((t - start) / r);
  if (t > end - r) return easeInOut((end - t) / r);
  return 1;
}

function hermite(v0, v1, m0, m1, h, s) {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 +
    (s3 - 2 * s2 + s) * h * m0 +
    (-2 * s3 + 3 * s2) * v1 +
    (s3 - s2) * h * m1;
}

function monotonicTangent(dPrev, dNext) {
  if (dPrev * dNext <= 0) return 0;
  return (2 * dPrev * dNext) / (dPrev + dNext);
}

// Periodic monotonic cubic Hermite spline on u in [0, 1)
function sampleLoop(u, keys) {
  const n = keys.length;
  u = ((u % 1) + 1) % 1;

  let i = n - 1;
  for (let k = 0; k < n; k++) {
    const nextT = k + 1 < n ? keys[k + 1][0] : 1;
    if (u >= keys[k][0] && u < nextT) {
      i = k;
      break;
    }
  }

  const iPrev = (i - 1 + n) % n;
  const iNext = (i + 1) % n;
  const iNext2 = (i + 2) % n;

  const t0 = keys[i][0];
  const t1 = i + 1 < n ? keys[iNext][0] : 1;
  const h = t1 - t0;

  const hPrev = i > 0 ? t0 - keys[iPrev][0] : t0 + (1 - keys[iPrev][0]);
  const hNext = iNext + 1 < n ? keys[iNext2][0] - keys[iNext][0] : 1 - keys[iNext][0];

  const vPrev = keys[iPrev][1];
  const v0 = keys[i][1];
  const v1 = keys[iNext][1];
  const vNext = keys[iNext2][1];

  const dPrev = (v0 - vPrev) / hPrev;
  const d0 = (v1 - v0) / h;
  const dNext = (vNext - v1) / hNext;

  const m0 = monotonicTangent(dPrev, d0);
  const m1 = monotonicTangent(d0, dNext);

  return hermite(v0, v1, m0, m1, h, (u - t0) / h);
}

// Non-periodic monotonic cubic Hermite spline (zero overshoot)
function sampleTrack(t, keys) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];

  let i = 0;
  for (let k = 0; k < n - 1; k++) {
    if (t >= keys[k][0] && t <= keys[k + 1][0]) {
      i = k;
      break;
    }
  }

  const t0 = keys[i][0];
  const t1 = keys[i + 1][0];
  const h = t1 - t0;
  const v0 = keys[i][1];
  const v1 = keys[i + 1][1];
  const d0 = (v1 - v0) / h;

  const m0 = i === 0
    ? 0
    : monotonicTangent((v0 - keys[i - 1][1]) / (t0 - keys[i - 1][0]), d0);
  const m1 = i + 1 === n - 1
    ? 0
    : monotonicTangent(d0, (keys[i + 2][1] - v1) / (keys[i + 2][0] - t1));

  return hermite(v0, v1, m0, m1, h, (t - t0) / h);
}

// --- Pose construction & mirroring helpers ---

function emptyJoints() {
  const joints = {};
  for (let i = 0; i < JOINT_NAMES.length; i++) {
    joints[JOINT_NAMES[i]] = [0, 0, 0];
  }
  return joints;
}

function makePose(spec = {}) {
  const joints = emptyJoints();
  if (spec.joints) {
    for (let i = 0; i < JOINT_NAMES.length; i++) {
      const name = JOINT_NAMES[i];
      const v = spec.joints[name];
      if (v) {
        joints[name] = [v[0] || 0, v[1] || 0, v[2] || 0];
      }
    }
  }
  return {
    pelvisY: spec.pelvisY || 0,
    root: {
      y: spec.root && spec.root.y ? spec.root.y : 0,
      rx: spec.root && spec.root.rx ? spec.root.rx : 0,
    },
    joints,
  };
}

function mirrorJoints(joints) {
  const out = {};
  const keys = Object.keys(joints);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = joints[k];
    const mirrored = [v[0] || 0, -(v[1] || 0), -(v[2] || 0)];
    if (k.endsWith('L')) {
      out[k.slice(0, -1) + 'R'] = mirrored;
    } else if (k.endsWith('R')) {
      out[k.slice(0, -1) + 'L'] = mirrored;
    } else {
      out[k] = mirrored;
    }
  }
  return out;
}

function mirrorPose(pose) {
  return makePose({
    pelvisY: pose.pelvisY,
    root: { y: pose.root.y, rx: pose.root.rx },
    joints: mirrorJoints(pose.joints),
  });
}

function clonePose(pose) {
  const joints = {};
  for (let i = 0; i < JOINT_NAMES.length; i++) {
    const name = JOINT_NAMES[i];
    const v = pose.joints && pose.joints[name];
    joints[name] = v ? [v[0] || 0, v[1] || 0, v[2] || 0] : [0, 0, 0];
  }
  return {
    pelvisY: pose.pelvisY || 0,
    root: {
      y: pose.root && pose.root.y ? pose.root.y : 0,
      rx: pose.root && pose.root.rx ? pose.root.rx : 0,
    },
    joints,
  };
}

function blendPose(a, b, alpha) {
  const t = clamp(alpha, 0, 1);
  const joints = {};
  for (let i = 0; i < JOINT_NAMES.length; i++) {
    const name = JOINT_NAMES[i];
    const va = (a.joints && a.joints[name]) || [0, 0, 0];
    const vb = (b.joints && b.joints[name]) || [0, 0, 0];
    joints[name] = [
      lerp(va[0], vb[0], t),
      lerp(va[1], vb[1], t),
      lerp(va[2], vb[2], t),
    ];
  }
  return {
    pelvisY: lerp(a.pelvisY || 0, b.pelvisY || 0, t),
    root: {
      y: lerp(a.root ? a.root.y || 0 : 0, b.root ? b.root.y || 0 : 0, t),
      rx: lerp(a.root ? a.root.rx || 0 : 0, b.root ? b.root.rx || 0 : 0, t),
    },
    joints,
  };
}

// Symmetric pair helper: applies [rx, ry, rz] to L and [rx, -ry, -rz] to R
function sym(joints, base, rx, ry = 0, rz = 0) {
  joints[base + 'L'] = [rx, ry, rz];
  joints[base + 'R'] = [rx, -ry, -rz];
}

// --- Shared gait curves ---

const WALK_HIP = [
  [0.00, -0.46],
  [0.12, -0.26],
  [0.25,  0.00],
  [0.40,  0.32],
  [0.50,  0.46],
  [0.65,  0.12],
  [0.80, -0.34],
  [0.92, -0.50],
];

const WALK_KNEE = [
  [0.00, 0.08],
  [0.10, 0.18],
  [0.25, 0.05],
  [0.42, 0.10],
  [0.53, 0.48],
  [0.68, 0.98],
  [0.85, 0.34],
  [0.95, 0.08],
];

const WALK_ANKLE = [
  [0.00,  0.10],
  [0.08,  0.16],
  [0.25, -0.05],
  [0.42, -0.22],
  [0.52,  0.26],
  [0.68, -0.18],
  [0.88, -0.02],
];

const WALK_BOB = [
  [0.05, -0.011],
  [0.28,  0.003],
  [0.55, -0.011],
  [0.78,  0.003],
];

const RUN_HIP = [
  [0.00, -0.52],
  [0.15, -0.02],
  [0.34,  0.54],
  [0.50,  0.34],
  [0.66, -0.20],
  [0.84, -0.72],
];

const RUN_KNEE = [
  [0.00, 0.26],
  [0.14, 0.48],
  [0.34, 0.14],
  [0.52, 0.92],
  [0.66, 1.42],
  [0.84, 0.56],
];

const RUN_ANKLE = [
  [0.00,  0.06],
  [0.14, -0.32],
  [0.34,  0.36],
  [0.56, -0.16],
  [0.82, -0.08],
];

const RUN_BOB = [
  [0.14, -0.026],
  [0.42,  0.024],
  [0.64, -0.026],
  [0.92,  0.024],
];

function sampleWalkBase(u, strideScale = 1, armScale = 1) {
  const uL = ((u % 1) + 1) % 1;
  const uR = (uL + 0.5) % 1;

  const hipL = sampleLoop(uL, WALK_HIP) * strideScale;
  const hipR = sampleLoop(uR, WALK_HIP) * strideScale;
  const kneeL = sampleLoop(uL, WALK_KNEE) * (0.35 + 0.65 * strideScale);
  const kneeR = sampleLoop(uR, WALK_KNEE) * (0.35 + 0.65 * strideScale);
  const ankleL = sampleLoop(uL, WALK_ANKLE) * strideScale;
  const ankleR = sampleLoop(uR, WALK_ANKLE) * strideScale;

  const bob = sampleLoop(uL, WALK_BOB) * strideScale;
  const phase = uL * TAU;

  // Pelvis rolls over stance leg (left mid-stance u=0.25 -> +rz) and rotates with stride
  const pelvisRz = Math.sin(phase) * 0.062 * strideScale;
  const pelvisRy = -Math.cos(phase) * 0.088 * strideScale;
  const pelvisRx = 0.025;

  const chestRy = -pelvisRy * 1.45 * (0.35 + 0.65 * armScale);
  const chestRz = -pelvisRz * 1.15;
  const chestRx = 0.045 * strideScale;

  // Head counter-rotates to stay level and facing forward
  const neckRy = -(pelvisRy + chestRy) * 0.45;
  const headRy = -(pelvisRy + chestRy) * 0.55;
  const headRz = -(pelvisRz + chestRz) * 0.85;
  const headRx = -(pelvisRx + chestRx) * 0.85;

  // Arms swing opposite to legs with elbow bending more on forward swing
  const armWaveL = Math.cos(phase - 0.12); // +1 back at u=0, -1 forward at u=0.5
  const armWaveR = -armWaveL;

  const armLRx = armWaveL * 0.45 * armScale;
  const armRRx = armWaveR * 0.45 * armScale;
  const forearmLRx = (-0.30 + 0.18 * armWaveL) * armScale - 0.08;
  const forearmRRx = (-0.30 + 0.18 * armWaveR) * armScale - 0.08;

  const handLRx = Math.sin(phase - 0.35) * 0.08 * armScale;
  const handRRx = -handLRx;

  return makePose({
    pelvisY: bob,
    joints: {
      pelvis: [pelvisRx, pelvisRy, pelvisRz],
      chest: [chestRx, chestRy, chestRz],
      neck: [0, neckRy, -pelvisRz * 0.15],
      head: [headRx, headRy, headRz],
      legL: [hipL, -pelvisRy * 0.2, -pelvisRz * 0.72],
      shinL: [kneeL, 0, 0],
      footL: [ankleL, 0, pelvisRz * 0.35],
      legR: [hipR, -pelvisRy * 0.2, -pelvisRz * 0.72],
      shinR: [kneeR, 0, 0],
      footR: [ankleR, 0, pelvisRz * 0.35],
      armL: [armLRx, 0, 0.02],
      forearmL: [forearmLRx, 0, 0],
      handL: [handLRx, 0, 0],
      armR: [armRRx, 0, -0.02],
      forearmR: [forearmRRx, 0, 0],
      handR: [handRRx, 0, 0],
    },
  });
}

// --- Shared posture bases so transitions match idles seamlessly ---

function sitBasePose() {
  const joints = {};
  joints.pelvis = [0.04, 0, 0];
  joints.chest = [0.04, 0, 0];
  joints.neck = [-0.02, 0, 0];
  joints.head = [-0.04, 0, 0];
  sym(joints, 'leg', -1.50, 0.06, 0.05);
  sym(joints, 'shin', 1.50, 0, 0);
  sym(joints, 'foot', -0.04, 0, 0);
  sym(joints, 'arm', -0.36, 0, -0.14);
  sym(joints, 'forearm', -0.96, 0, -0.08);
  sym(joints, 'hand', 0.14, 0, 0);
  return makePose({ pelvisY: -0.15, joints });
}

function squatBasePose() {
  const joints = {};
  joints.pelvis = [0.12, 0, 0];
  joints.chest = [0.36, 0, 0];
  joints.neck = [-0.10, 0, 0];
  joints.head = [-0.28, 0, 0];
  sym(joints, 'leg', -1.38, 0.14, 0.12);
  sym(joints, 'shin', 2.06, 0, 0);
  sym(joints, 'foot', -0.80, 0, -0.08);
  sym(joints, 'arm', -0.86, 0, -0.06);
  sym(joints, 'forearm', -0.52, 0, -0.10);
  sym(joints, 'hand', 0.10, 0, 0);
  return makePose({ pelvisY: -0.16, joints });
}

function lieBasePose(opts = {}) {
  const bedHeight = opts.bedHeight !== undefined ? opts.bedHeight : 0.20;
  const bodyWidth = opts.bodyWidth !== undefined ? opts.bodyWidth : 1.0;
  const rootY = bedHeight + 0.075 * bodyWidth;
  return makePose({
    pelvisY: 0,
    root: { y: rootY, rx: -HALF_PI },
    joints: {
      pelvis: [0, 0, 0],
      chest: [0.02, 0, 0],
      neck: [0.04, 0.04, 0],
      head: [0.06, 0.10, -0.05],
      legL: [-0.08, 0.05, 0.06],
      shinL: [0.16, 0, 0],
      footL: [0.18, 0, 0],
      legR: [-0.22, -0.06, -0.07],
      shinR: [0.38, 0, 0],
      footR: [0.14, 0, 0],
      // Right arm tucked comfortably behind head, left arm resting on belly
      armR: [-2.45, -0.15, -0.45],
      forearmR: [-1.15, 0, -0.38],
      handR: [0.15, 0, -0.10],
      armL: [-0.30, 0.10, -0.18],
      forearmL: [-1.12, 0, -0.35],
      handL: [0.12, 0, 0],
    },
  });
}

function deskBasePose(lean = 0.15, headDown = 0.32) {
  const joints = {};
  joints.pelvis = [0.04, 0, 0];
  joints.chest = [lean, 0, 0];
  joints.neck = [0.08, 0, 0];
  joints.head = [headDown, 0, 0];
  sym(joints, 'leg', -1.50, 0.05, 0.04);
  sym(joints, 'shin', 1.50, 0, 0);
  sym(joints, 'foot', -0.04, 0, 0);
  sym(joints, 'arm', -0.74, 0, -0.14);
  sym(joints, 'forearm', -1.25, 0, -0.18);
  sym(joints, 'hand', 0.30, 0, 0);
  return makePose({ pelvisY: -0.15, joints });
}

// --- Clips ---

const REACH_DURATION = 2.6;

function sampleReachShelf(t) {
  const u = clamp(t, 0, REACH_DURATION);

  const reachEnv = sampleTrack(u, [
    [0.00, 0.0],
    [0.75, 1.0],
    [1.08, 1.0],
    [1.65, 0.0],
    [2.60, 0.0],
  ]);

  const holdEnv = sampleTrack(u, [
    [0.00, 0.0],
    [1.00, 0.0],
    [1.65, 1.0],
    [2.18, 1.0],
    [2.60, 0.0],
  ]);

  const graspAmt = sampleTrack(u, [
    [0.00, 0.0],
    [0.80, 0.0],
    [0.95, 1.0],
    [2.25, 1.0],
    [2.45, 0.0],
    [2.60, 0.0],
  ]);

  const stepFwd = sampleTrack(u, [
    [0.00, 0.0],
    [0.55, 1.0],
    [1.45, 0.65],
    [2.25, 0.30],
    [2.60, 0.0],
  ]);

  // ArmR reaches high to y ~ 0.75 m, then brings book to chest level
  const armRRx = -2.25 * reachEnv - 0.58 * holdEnv;
  const armRRz = 0.06 * reachEnv + 0.22 * holdEnv;
  const forearmRRx = -0.12 * reachEnv - 1.24 * holdEnv - 0.10;
  const forearmRRz = 0.04 * reachEnv + 0.18 * holdEnv;
  const handRRx = -0.26 * graspAmt + 0.12 * holdEnv;
  const handRRy = -0.35 * holdEnv;

  // ArmL lightly steadies object while inspecting in front of chest
  const armLRx = 0.10 * reachEnv - 0.48 * holdEnv;
  const armLRz = -0.20 * holdEnv;
  const forearmLRx = -0.12 - 1.12 * holdEnv;
  const forearmLRz = -0.18 * holdEnv;
  const handLRy = 0.35 * holdEnv;

  const chestRx = 0.07 * reachEnv + 0.04 * holdEnv;
  const chestRy = 0.14 * reachEnv - 0.04 * holdEnv;
  const headRx = -0.28 * reachEnv + 0.24 * holdEnv;
  const headRy = -0.10 * reachEnv + 0.06 * holdEnv;
  const headRz = 0.06 * holdEnv * Math.sin((u - 1.65) * 3.0);

  return makePose({
    pelvisY: -0.010 * stepFwd,
    joints: {
      pelvis: [0.03 * stepFwd, -0.06 * stepFwd, -0.03 * reachEnv],
      chest: [chestRx, chestRy, 0.04 * reachEnv],
      neck: [-0.08 * reachEnv + 0.06 * holdEnv, 0, 0],
      head: [headRx, headRy, headRz],
      legR: [-0.22 * stepFwd, 0, 0],
      shinR: [0.22 * stepFwd, 0, 0],
      footR: [-0.02 * stepFwd, 0, 0],
      legL: [0.16 * stepFwd, 0, 0],
      shinL: [0.06 * stepFwd, 0, 0],
      footL: [-0.18 * stepFwd, 0, 0],
      armR: [armRRx, 0, armRRz],
      forearmR: [forearmRRx, 0, forearmRRz],
      handR: [handRRx, handRRy, 0],
      armL: [armLRx, 0, armLRz],
      forearmL: [forearmLRx, 0, forearmLRz],
      handL: [0, handLRy, 0],
    },
  });
}

function sampleSitTransition(t, duration) {
  const u = clamp(t / duration, 0, 1);
  const sit = sitBasePose();

  const lower = sampleTrack(u, [
    [0.00, 0.0],
    [0.25, 0.18],
    [0.72, 0.94],
    [1.00, 1.0],
  ]);

  const leanFwd = sampleTrack(u, [
    [0.00, 0.0],
    [0.40, 1.0],
    [0.80, 0.22],
    [1.00, 0.0],
  ]);

  const pose = blendPose(makePose(), sit, lower);
  pose.joints.chest[0] += 0.30 * leanFwd;
  pose.joints.head[0] -= 0.22 * leanFwd;
  pose.joints.armL[0] -= 0.28 * leanFwd;
  pose.joints.armR[0] -= 0.28 * leanFwd;
  pose.joints.forearmL[0] += 0.35 * leanFwd;
  pose.joints.forearmR[0] += 0.35 * leanFwd;
  pose.joints.footL[0] -= 0.14 * leanFwd;
  pose.joints.footR[0] -= 0.14 * leanFwd;
  return pose;
}

function sampleLieTransition(t, duration, opts = {}) {
  const u = clamp(t / duration, 0, 1);
  const sit = sitBasePose();
  const lie = lieBasePose(opts);

  if (u <= 0.40) {
    // Phase 1: standing to seated on bed edge
    const p = sampleSitTransition(u / 0.40, 1.0);
    const bedHeight = opts.bedHeight !== undefined ? opts.bedHeight : 0.20;
    const seatPelvisY = clamp(bedHeight - 0.35, -0.22, -0.06);
    p.pelvisY = p.pelvisY * (seatPelvisY / -0.15);
    return p;
  }

  // Phase 2: seated to lying on back
  const bedHeight = opts.bedHeight !== undefined ? opts.bedHeight : 0.20;
  const seatPelvisY = clamp(bedHeight - 0.35, -0.22, -0.06);
  sit.pelvisY = seatPelvisY;

  const v = (u - 0.40) / 0.60;
  const ease = easeInOut(v);
  const armTuck = smoothstep(0.35, 1.0, v);
  const legStretch = smoothstep(0.10, 0.88, v);

  const pose = blendPose(sit, lie, ease);

  // Smooth leg unfolding slightly earlier than arm tuck behind head
  for (const side of ['L', 'R']) {
    pose.joints['leg' + side][0] = lerp(sit.joints['leg' + side][0], lie.joints['leg' + side][0], legStretch);
    pose.joints['shin' + side][0] = lerp(sit.joints['shin' + side][0], lie.joints['shin' + side][0], legStretch);
  }
  pose.joints.armR = [
    lerp(sit.joints.armR[0], lie.joints.armR[0], armTuck),
    lerp(sit.joints.armR[1], lie.joints.armR[1], armTuck),
    lerp(sit.joints.armR[2], lie.joints.armR[2], armTuck),
  ];
  pose.joints.forearmR = [
    lerp(sit.joints.forearmR[0], lie.joints.forearmR[0], armTuck),
    0,
    lerp(sit.joints.forearmR[2], lie.joints.forearmR[2], armTuck),
  ];

  // Brief mid-recline torso curl as shoulders lower onto mattress
  const curl = Math.sin(v * Math.PI);
  pose.joints.chest[0] += 0.18 * curl;
  pose.joints.head[0] += 0.14 * curl;
  return pose;
}

export const CLIPS = {
  idle: {
    loop: true,
    duration: 8.0,
    sample(t) {
      const u = ((t % 8.0) + 8.0) % 8.0;
      const breath = Math.sin((u / 8.0) * TAU * 3);
      const sway = Math.sin((u / 8.0) * TAU);

      const lookY = sampleLoop(u / 8.0, [
        [0.00,  0.00],
        [0.20,  0.02],
        [0.32,  0.22],
        [0.45,  0.18],
        [0.58, -0.02],
        [0.72, -0.20],
        [0.84, -0.14],
        [0.94,  0.00],
      ]);
      const lookX = sampleLoop(u / 8.0, [
        [0.00,  0.00],
        [0.32, -0.05],
        [0.58,  0.03],
        [0.74, -0.08],
        [0.92,  0.00],
      ]);
      const lookZ = -lookY * 0.22;

      const pelvisRz = sway * 0.036;
      const legFlexL = Math.max(0, -sway) * 0.055;
      const legFlexR = Math.max(0, sway) * 0.055;

      return makePose({
        pelvisY: -Math.abs(sway) * 0.004 + breath * 0.0018,
        joints: {
          pelvis: [0, sway * 0.025, pelvisRz],
          chest: [-0.022 * breath, -sway * 0.02, -pelvisRz * 0.85],
          neck: [0.008 * breath + lookX * 0.3, lookY * 0.35, -pelvisRz * 0.15],
          head: [lookX * 0.7, lookY * 0.65, lookZ],
          armL: [0.02 + sway * 0.02, 0, 0.016 * breath],
          forearmL: [-0.12 - 0.02 * breath, 0, 0],
          handL: [0.03 * breath, 0, 0],
          armR: [0.02 - sway * 0.02, 0, -0.016 * breath],
          forearmR: [-0.12 - 0.02 * breath, 0, 0],
          handR: [0.03 * breath, 0, 0],
          legL: [-legFlexL * 0.5, 0, -pelvisRz * 0.85],
          shinL: [legFlexL, 0, 0],
          footL: [-legFlexL * 0.5, 0, pelvisRz * 0.6],
          legR: [-legFlexR * 0.5, 0, -pelvisRz * 0.85],
          shinR: [legFlexR, 0, 0],
          footR: [-legFlexR * 0.5, 0, pelvisRz * 0.6],
        },
      });
    },
  },

  walk: {
    loop: true,
    duration: 1.0,
    sample(t) {
      return sampleWalkBase(t / 1.0, 1.0, 1.0);
    },
  },

  run: {
    loop: true,
    duration: 0.62,
    sample(t) {
      const uL = ((t / 0.62) % 1 + 1) % 1;
      const uR = (uL + 0.5) % 1;
      const phase = uL * TAU;

      const hipL = sampleLoop(uL, RUN_HIP);
      const hipR = sampleLoop(uR, RUN_HIP);
      const kneeL = sampleLoop(uL, RUN_KNEE);
      const kneeR = sampleLoop(uR, RUN_KNEE);
      const ankleL = sampleLoop(uL, RUN_ANKLE);
      const ankleR = sampleLoop(uR, RUN_ANKLE);

      const bob = sampleLoop(uL, RUN_BOB);
      const pelvisRz = Math.sin(phase) * 0.085;
      const pelvisRy = -Math.cos(phase) * 0.13;
      const pelvisRx = 0.08;

      const chestRy = -pelvisRy * 1.6;
      const chestRz = -pelvisRz * 1.1;
      const chestRx = 0.14;

      const armWaveL = Math.cos(phase - 0.15);
      const armWaveR = -armWaveL;

      return makePose({
        pelvisY: bob,
        joints: {
          pelvis: [pelvisRx, pelvisRy, pelvisRz],
          chest: [chestRx, chestRy, chestRz],
          neck: [-0.06, -(pelvisRy + chestRy) * 0.45, -pelvisRz * 0.15],
          head: [-0.14, -(pelvisRy + chestRy) * 0.55, -(pelvisRz + chestRz) * 0.8],
          legL: [hipL, -pelvisRy * 0.25, -pelvisRz * 0.6],
          shinL: [kneeL, 0, 0],
          footL: [ankleL, 0, pelvisRz * 0.3],
          legR: [hipR, -pelvisRy * 0.25, -pelvisRz * 0.6],
          shinR: [kneeR, 0, 0],
          footR: [ankleR, 0, pelvisRz * 0.3],
          armL: [armWaveL * 0.78 - 0.05, 0, -0.04],
          forearmL: [-1.18 + 0.24 * armWaveL, 0, -0.06],
          handL: [-0.08, 0, 0],
          armR: [armWaveR * 0.78 - 0.05, 0, 0.04],
          forearmR: [-1.18 + 0.24 * armWaveR, 0, 0.06],
          handR: [-0.08, 0, 0],
        },
      });
    },
  },

  turn: {
    loop: true,
    duration: 0.6,
    sample(t) {
      const uL = ((t / 0.6) % 1 + 1) % 1;
      const uR = (uL + 0.5) % 1;
      const liftL = Math.max(0, Math.sin(uL * TAU));
      const liftR = Math.max(0, Math.sin(uR * TAU));
      const phase = uL * TAU;

      const pelvisRz = Math.sin(phase) * 0.045;
      const pelvisRy = Math.cos(phase) * 0.055;

      return makePose({
        pelvisY: -0.008 + Math.abs(Math.sin(phase)) * 0.008,
        joints: {
          pelvis: [0.02, pelvisRy, pelvisRz],
          chest: [0.02, -pelvisRy * 0.8, -pelvisRz * 0.9],
          neck: [0, -pelvisRy * 0.1, 0],
          head: [-0.02, -pelvisRy * 0.1, -pelvisRz * 0.1],
          legL: [-0.24 * liftL, 0.06 * liftL, -pelvisRz * 0.7],
          shinL: [0.46 * liftL + 0.05, 0, 0],
          footL: [-0.20 * liftL - 0.04, 0, 0],
          legR: [-0.24 * liftR, -0.06 * liftR, -pelvisRz * 0.7],
          shinR: [0.46 * liftR + 0.05, 0, 0],
          footR: [-0.20 * liftR - 0.04, 0, 0],
          armL: [0.12 * Math.sin(phase), 0, 0.04],
          forearmL: [-0.22 - 0.06 * liftR, 0, 0],
          armR: [-0.12 * Math.sin(phase), 0, -0.04],
          forearmR: [-0.22 - 0.06 * liftL, 0, 0],
        },
      });
    },
  },

  sitDown: {
    loop: false,
    duration: 1.1,
    sample(t) {
      return sampleSitTransition(t, 1.1);
    },
  },

  sitIdle: {
    loop: true,
    duration: 6.0,
    sample(t) {
      const u = ((t % 6.0) + 6.0) % 6.0;
      const breath = Math.sin((u / 6.0) * TAU * 2);
      const sway = Math.sin((u / 6.0) * TAU);
      const lookY = sampleLoop(u / 6.0, [
        [0.00,  0.00],
        [0.25,  0.18],
        [0.50,  0.00],
        [0.75, -0.16],
      ]);

      const pose = sitBasePose();
      pose.joints.chest[0] -= 0.022 * breath;
      pose.joints.chest[2] += sway * 0.025;
      pose.joints.neck[1] += lookY * 0.35;
      pose.joints.head[0] += 0.015 * breath;
      pose.joints.head[1] += lookY * 0.65;
      pose.joints.head[2] -= lookY * 0.18;
      pose.joints.armL[2] += 0.014 * breath;
      pose.joints.armR[2] -= 0.014 * breath;
      pose.joints.footR[0] += Math.sin((u / 6.0) * TAU * 3) * 0.04;
      return pose;
    },
  },

  standUp: {
    loop: false,
    duration: 1.0,
    sample(t) {
      const u = clamp(t / 1.0, 0, 1);
      const pose = sampleSitTransition(1.0 - u, 1.0);
      const push = Math.sin(u * Math.PI);
      pose.joints.chest[0] += 0.10 * push;
      pose.joints.head[0] -= 0.08 * push;
      return pose;
    },
  },

  squat: {
    loop: false,
    duration: 0.9,
    sample(t) {
      const u = clamp(t / 0.9, 0, 1);
      const ease = easeInOut(u);
      return blendPose(makePose(), squatBasePose(), ease);
    },
  },

  squatIdle: {
    loop: true,
    duration: 4.0,
    sample(t) {
      const u = ((t % 4.0) + 4.0) % 4.0;
      const breath = Math.sin((u / 4.0) * TAU * 2);
      const sway = Math.sin((u / 4.0) * TAU);

      const pose = squatBasePose();
      pose.pelvisY += 0.004 * breath;
      pose.joints.chest[0] -= 0.025 * breath;
      pose.joints.chest[2] += 0.025 * sway;
      pose.joints.head[1] += 0.10 * sway;
      pose.joints.head[2] -= 0.03 * sway;
      pose.joints.armL[0] += 0.02 * breath;
      pose.joints.armR[0] += 0.02 * breath;
      return pose;
    },
  },

  lieDown: {
    loop: false,
    duration: 2.2,
    sample(t, opts) {
      return sampleLieTransition(t, 2.2, opts);
    },
  },

  lieIdle: {
    loop: true,
    duration: 6.0,
    sample(t, opts) {
      const u = ((t % 6.0) + 6.0) % 6.0;
      const breath = Math.sin((u / 6.0) * TAU * 2);
      const drift = Math.sin((u / 6.0) * TAU);

      const pose = lieBasePose(opts);
      pose.joints.chest[0] -= 0.024 * breath;
      pose.joints.head[1] += 0.09 * drift;
      pose.joints.head[2] -= 0.03 * drift;
      pose.joints.armL[0] -= 0.022 * breath;
      pose.joints.forearmL[0] += 0.02 * breath;
      pose.joints.shinR[0] += 0.04 * drift;
      return pose;
    },
  },

  getUp: {
    loop: false,
    duration: 2.2,
    sample(t, opts) {
      const u = clamp(t, 0, 2.2);
      return sampleLieTransition(2.2 - u, 2.2, opts);
    },
  },

  sleep: {
    loop: true,
    duration: 8.0,
    sample(t, opts) {
      const u = ((t % 8.0) + 8.0) % 8.0;
      const breath = Math.sin((u / 8.0) * TAU * 2); // Very slow 4 s breath
      const pose = lieBasePose(opts);

      pose.joints.head = [0.10, 0.28, 0.10];
      pose.joints.neck = [0.04, 0.10, 0.04];
      pose.joints.chest[0] = 0.02 - 0.030 * breath;
      pose.joints.armR = [-2.25, -0.10, -0.55];
      pose.joints.forearmR = [-1.30, 0, -0.35];
      pose.joints.armL[0] = -0.28 - 0.025 * breath;
      pose.joints.forearmL[0] = -1.16 + 0.02 * breath;
      return pose;
    },
  },

  wave: {
    loop: false,
    duration: 2.2,
    sample(t) {
      const u = clamp(t, 0, 2.2);
      const env = pulse(u, 0.0, 2.2, 0.42);
      const wavePhase = (u - 0.40) * TAU * 2.2;
      const wag = env * Math.sin(wavePhase);
      const bounce = env * Math.sin(wavePhase * 0.5);

      return makePose({
        pelvisY: -0.008 * Math.abs(bounce) + 0.004 * bounce,
        joints: {
          pelvis: [0, -0.05 * env, 0.04 * env],
          chest: [-0.03 * env, 0.06 * env, -0.06 * env],
          neck: [0, 0, -0.04 * env],
          head: [-0.04 * env, 0.06 * env, -0.14 * env - 0.03 * wag],
          armR: [-0.35 * env, 0.15 * env, -1.92 * env + 0.06 * wag],
          forearmR: [-0.25 * env, 0, -0.78 * env - 0.34 * wag],
          handR: [0, 0, -0.18 * wag],
          armL: [0.06 * env, 0, 0.12 * env],
          forearmL: [-0.18 * env, 0, 0],
          legL: [-0.04 * Math.abs(bounce), 0, -0.04 * env],
          shinL: [0.08 * Math.abs(bounce), 0, 0],
          footL: [-0.04 * Math.abs(bounce), 0, 0.03 * env],
          legR: [-0.04 * Math.abs(bounce), 0, -0.04 * env],
          shinR: [0.08 * Math.abs(bounce), 0, 0],
          footR: [-0.04 * Math.abs(bounce), 0, 0.03 * env],
        },
      });
    },
  },

  patHead: {
    loop: false,
    duration: 2.0,
    sample(t) {
      const u = clamp(t, 0, 2.0);
      const env = pulse(u, 0.0, 2.0, 0.45);
      // Two distinct gentle pats around t = 0.80 and t = 1.28
      const pat1 = pulse(u, 0.62, 1.00, 0.16);
      const pat2 = pulse(u, 1.10, 1.48, 0.16);
      const pat = pat1 + pat2;

      return makePose({
        pelvisY: -0.004 * pat,
        joints: {
          pelvis: [0, 0, -0.02 * env],
          chest: [0.02 * env, 0, 0.07 * env],
          neck: [0.02 * pat, 0, 0.10 * env + 0.02 * pat],
          head: [0.06 * pat, -0.06 * env, 0.24 * env + 0.05 * pat],
          // Curves cleanly outside the wide chibi head before tapping the crown
          armR: [-0.24 * env, 0.10 * env, -2.28 * env - 0.04 * pat],
          forearmR: [-0.18 * env, 0, -1.04 * env - 0.28 * pat],
          handR: [0, 0, -0.18 * env - 0.16 * pat],
          armL: [0.04 * env, 0, 0.04 * env],
          forearmL: [-0.16 * env, 0, 0],
        },
      });
    },
  },

  think: {
    loop: false,
    duration: 2.8,
    sample(t) {
      const u = clamp(t, 0, 2.8);
      const env = pulse(u, 0.0, 2.8, 0.50);
      const ponder = pulse(u, 0.70, 2.10, 0.35);
      const tap = Math.sin(u * 5.0) * 0.035 * ponder;

      return makePose({
        pelvisY: -0.006 * env,
        joints: {
          pelvis: [0, 0.05 * env, 0.065 * env],
          chest: [-0.03 * env, -0.06 * env, -0.05 * env],
          neck: [-0.05 * env, 0.06 * env, -0.05 * env],
          head: [-0.18 * env + tap * 0.5, 0.16 * env, -0.16 * env],
          // Right hand tucked under chin
          armR: [-1.04 * env, 0.12 * env, 0.12 * env],
          forearmR: [-1.54 * env + tap, 0, 0.38 * env],
          handR: [-0.18 * env, 0.20 * env, 0.10 * env],
          // Left arm lightly folded across waist
          armL: [-0.46 * env, -0.10 * env, -0.32 * env],
          forearmL: [-1.22 * env, 0, -0.42 * env],
          handL: [0.10 * env, 0, 0],
          // Weight on left leg, right leg relaxed
          legL: [-0.02 * env, 0, -0.06 * env],
          shinL: [0.04 * env, 0, 0],
          footL: [-0.02 * env, 0, 0.05 * env],
          legR: [-0.12 * env, -0.08 * env, -0.09 * env],
          shinR: [0.18 * env, 0, 0],
          footR: [-0.04 * env, 0, 0.06 * env],
        },
      });
    },
  },

  nod: {
    loop: false,
    duration: 1.1,
    sample(t) {
      const u = clamp(t, 0, 1.1);
      const dip = sampleTrack(u, [
        [0.00, 0.0],
        [0.24, 1.0],
        [0.50, 0.12],
        [0.74, 0.85],
        [1.10, 0.0],
      ]);
      return makePose({
        joints: {
          chest: [0.04 * dip, 0, 0],
          neck: [0.11 * dip, 0, 0],
          head: [0.32 * dip, 0, 0],
          armL: [0.02 * dip, 0, 0],
          armR: [0.02 * dip, 0, 0],
        },
      });
    },
  },

  shakeHead: {
    loop: false,
    duration: 1.2,
    sample(t) {
      const u = clamp(t, 0, 1.2);
      const yaw = sampleTrack(u, [
        [0.00,  0.00],
        [0.22, -0.38],
        [0.54,  0.38],
        [0.84, -0.26],
        [1.20,  0.00],
      ]);
      return makePose({
        joints: {
          chest: [0, -yaw * 0.08, 0],
          neck: [0.02 * Math.abs(yaw), yaw * 0.30, 0],
          head: [0.04 * Math.abs(yaw), yaw * 0.70, -yaw * 0.14],
        },
      });
    },
  },

  shrug: {
    loop: false,
    duration: 1.4,
    sample(t) {
      const u = clamp(t, 0, 1.4);
      const env = sampleTrack(u, [
        [0.00, 0.0],
        [0.34, 1.0],
        [0.88, 1.0],
        [1.40, 0.0],
      ]);
      const joints = {};
      joints.chest = [-0.05 * env, 0, 0];
      joints.neck = [0.04 * env, 0, -0.05 * env];
      joints.head = [0.08 * env, 0.06 * env, -0.18 * env];
      sym(joints, 'arm', -0.32 * env, -0.12 * env, 0.34 * env);
      sym(joints, 'forearm', -1.18 * env, 0, 0.28 * env);
      sym(joints, 'hand', 0.22 * env, 0.65 * env, 0.12 * env);
      return makePose({ pelvisY: 0.008 * env, joints });
    },
  },

  cheer: {
    loop: false,
    duration: 1.5,
    sample(t) {
      const u = clamp(t, 0, 1.5);

      const crouch = sampleTrack(u, [
        [0.00, 0.0],
        [0.24, 1.0],
        [0.38, 0.0],
        [0.82, 0.0],
        [0.98, 0.85],
        [1.50, 0.0],
      ]);

      const air = sampleTrack(u, [
        [0.00, 0.0],
        [0.30, 0.0],
        [0.56, 1.0],
        [0.84, 0.0],
        [1.50, 0.0],
      ]);

      const armsUp = sampleTrack(u, [
        [0.00, 0.0],
        [0.24, 0.0],
        [0.48, 1.0],
        [1.05, 0.92],
        [1.50, 0.0],
      ]);

      const wiggle = armsUp * Math.sin((u - 0.45) * 18.0) * 0.10;

      const joints = {};
      joints.pelvis = [0.10 * crouch - 0.06 * air, 0, 0];
      joints.chest = [0.14 * crouch - 0.12 * air, 0, 0];
      joints.neck = [-0.06 * air, 0, 0];
      joints.head = [-0.14 * armsUp, 0, 0.04 * wiggle];

      sym(joints, 'leg', -0.32 * crouch + 0.16 * air, 0, 0.05 * air);
      sym(joints, 'shin', 0.56 * crouch + 0.34 * air, 0, 0);
      sym(joints, 'foot', -0.24 * crouch + 0.28 * air, 0, 0);

      joints.armL = [0.22 * crouch - 2.68 * armsUp, 0, 0.28 * armsUp + wiggle];
      joints.armR = [0.22 * crouch - 2.68 * armsUp, 0, -0.28 * armsUp - wiggle];
      joints.forearmL = [-0.45 * crouch - 0.18 * armsUp, 0, 0.12 * wiggle];
      joints.forearmR = [-0.45 * crouch - 0.18 * armsUp, 0, -0.12 * wiggle];
      joints.handL = [0, 0, 0.18 * wiggle];
      joints.handR = [0, 0, -0.18 * wiggle];

      return makePose({
        pelvisY: -0.044 * crouch,
        root: { y: 0.095 * air, rx: 0 },
        joints,
      });
    },
  },

  stretch: {
    loop: false,
    duration: 2.4,
    sample(t) {
      const u = clamp(t, 0, 2.4);
      const env = sampleTrack(u, [
        [0.00, 0.0],
        [0.65, 1.0],
        [1.65, 1.0],
        [2.40, 0.0],
      ]);
      const sway = pulse(u, 0.65, 1.75, 0.25) * Math.sin((u - 0.65) * 4.5);

      const joints = {};
      joints.pelvis = [-0.06 * env, 0, 0.03 * sway];
      joints.chest = [-0.20 * env, 0, 0.07 * sway];
      joints.neck = [-0.08 * env, 0, 0.03 * sway];
      joints.head = [-0.20 * env, 0, 0.05 * sway];
      sym(joints, 'arm', -2.85 * env, 0, 0.14 * env);
      sym(joints, 'forearm', -0.20 * env, 0, -0.12 * env);
      sym(joints, 'hand', -0.22 * env, 0, 0);
      sym(joints, 'foot', 0.14 * env, 0, 0);

      return makePose({
        pelvisY: 0.012 * env,
        joints,
      });
    },
  },

  yawn: {
    loop: false,
    duration: 2.4,
    sample(t) {
      const u = clamp(t, 0, 2.4);
      const inhale = sampleTrack(u, [
        [0.00, 0.0],
        [0.60, 1.0],
        [1.45, 1.0],
        [2.00, 0.0],
        [2.40, 0.0],
      ]);
      const exhale = pulse(u, 1.55, 2.35, 0.30);

      return makePose({
        pelvisY: 0.005 * inhale - 0.005 * exhale,
        joints: {
          pelvis: [-0.03 * inhale, 0, 0],
          chest: [-0.13 * inhale + 0.06 * exhale, 0, 0],
          neck: [-0.07 * inhale + 0.03 * exhale, 0, 0],
          head: [-0.24 * inhale + 0.10 * exhale, 0.06 * inhale, -0.08 * inhale],
          // Right hand gently covers mouth
          armR: [-1.18 * inhale, 0.12 * inhale, 0.12 * inhale],
          forearmR: [-1.52 * inhale, 0, 0.36 * inhale],
          handR: [-0.22 * inhale, 0.15 * inhale, 0],
          // Left arm stretches slightly out
          armL: [-0.28 * inhale, 0, 0.34 * inhale],
          forearmL: [-0.36 * inhale, 0, 0],
        },
      });
    },
  },

  reachShelf: {
    loop: false,
    duration: REACH_DURATION,
    events: { grasp: 0.90, release: 2.35 },
    sample(t) {
      return sampleReachShelf(t);
    },
  },

  putBack: {
    loop: false,
    duration: REACH_DURATION,
    events: { grasp: 0.25, release: 1.70 },
    sample(t) {
      return sampleReachShelf(REACH_DURATION - clamp(t, 0, REACH_DURATION));
    },
  },

  readBook: {
    loop: true,
    duration: 5.0,
    sample(t) {
      const u = ((t % 5.0) + 5.0) % 5.0;
      const breath = Math.sin((u / 5.0) * TAU * 2);

      // Slow reading scan across lines
      const scanY = sampleLoop(u / 5.0, [
        [0.00,  0.10],
        [0.24, -0.09],
        [0.32,  0.09],
        [0.58, -0.10],
        [0.72,  0.04],
        [0.92,  0.10],
      ]);

      // Occasional page turn with right hand between t = 3.2 and 4.3
      const turnLift = pulse(u, 3.20, 4.30, 0.28);
      const turnSweep = sampleTrack(u, [
        [0.00, 0.0],
        [3.25, 0.0],
        [3.75, 1.0],
        [4.28, 0.0],
        [5.00, 0.0],
      ]);

      return makePose({
        pelvisY: 0.002 * breath,
        joints: {
          pelvis: [0, 0, 0.015 * Math.sin((u / 5.0) * TAU)],
          chest: [0.05 - 0.018 * breath, 0, -0.015 * Math.sin((u / 5.0) * TAU)],
          neck: [0.08, scanY * 0.3, 0],
          head: [0.30 + 0.015 * breath, scanY * 0.7, -0.04 * turnLift],
          armL: [-0.56 - 0.015 * breath, 0.06, -0.18],
          forearmL: [-1.20, 0, -0.16],
          handL: [0.16, 0.45, 0],
          armR: [-0.56 - 0.14 * turnLift, -0.06, 0.18 + 0.12 * turnSweep],
          forearmR: [-1.20 - 0.18 * turnLift, 0, 0.16 + 0.34 * turnSweep],
          handR: [0.16 - 0.35 * turnLift, -0.45 + 0.30 * turnSweep, 0],
        },
      });
    },
  },

  writeAtDesk: {
    loop: true,
    duration: 4.5,
    sample(t) {
      const u = ((t % 4.5) + 4.5) % 4.5;
      const breath = Math.sin((u / 4.5) * TAU * 2);
      const think = pulse(u, 2.80, 4.05, 0.32);
      const writing = 1 - think;

      const strokeA = Math.sin(u * 14.0) * writing;
      const strokeB = Math.cos(u * 9.5) * writing;
      const lineDrift = Math.sin(u * 2.4) * writing;

      const pose = deskBasePose(0.16, 0.34);
      pose.joints.chest[0] -= 0.02 * breath + 0.05 * think;
      pose.joints.head[0] -= 0.18 * think;
      pose.joints.head[1] += 0.05 * lineDrift - 0.10 * think;
      pose.joints.head[2] -= 0.10 * think;

      // Left hand holds page steady
      pose.joints.armL = [-0.72, 0.08, -0.22];
      pose.joints.forearmL = [-1.26, 0, -0.26];
      pose.joints.handL = [0.32, 0.10, 0];

      // Right hand makes small writing strokes over desk at y ~ 0.42 m
      pose.joints.armR = [-0.76 + 0.05 * think, -0.04 + 0.04 * lineDrift, 0.12];
      pose.joints.forearmR = [-1.24 - 0.08 * think + 0.03 * strokeB, 0, 0.16 + 0.06 * lineDrift + 0.025 * strokeA];
      pose.joints.handR = [0.30 - 0.16 * think + 0.07 * strokeA, -0.08 + 0.08 * strokeB, 0.04 * strokeA];
      return pose;
    },
  },

  typeAtDesk: {
    loop: true,
    duration: 3.0,
    sample(t) {
      const u = ((t % 3.0) + 3.0) % 3.0;
      const breath = Math.sin((u / 3.0) * TAU);
      const pause = pulse(u, 2.25, 2.75, 0.14);
      const active = 1 - pause;

      const tapL = Math.sin(u * 22.0) * active;
      const tapR = Math.sin(u * 25.0 + 1.9) * active;
      const shiftL = Math.sin(u * 5.2) * active;
      const shiftR = Math.cos(u * 4.6) * active;

      const pose = deskBasePose(0.14, 0.24);
      pose.joints.chest[0] -= 0.018 * breath;
      pose.joints.head[0] -= 0.06 * pause;
      pose.joints.head[1] += 0.04 * Math.sin(u * 2.1);

      pose.joints.armL = [-0.74, 0.04, -0.14];
      pose.joints.forearmL = [-1.26 + 0.03 * tapL, 0, -0.18 + 0.04 * shiftL];
      pose.joints.handL = [0.30 + 0.09 * tapL, 0.04 * shiftL, 0];

      pose.joints.armR = [-0.74, -0.04, 0.14];
      pose.joints.forearmR = [-1.26 + 0.03 * tapR, 0, 0.18 + 0.04 * shiftR];
      pose.joints.handR = [0.30 + 0.09 * tapR, 0.04 * shiftR, 0];
      return pose;
    },
  },

  pickUpFromFloor: {
    loop: false,
    duration: 2.5,
    events: { grasp: 1.05, release: 2.30 },
    sample(t) {
      const u = clamp(t, 0, 2.5);

      const down = sampleTrack(u, [
        [0.00, 0.0],
        [0.85, 1.0],
        [1.22, 1.0],
        [2.00, 0.0],
        [2.50, 0.0],
      ]);

      const hold = sampleTrack(u, [
        [0.00, 0.0],
        [1.10, 0.0],
        [1.85, 1.0],
        [2.18, 0.85],
        [2.50, 0.0],
      ]);

      const grasp = sampleTrack(u, [
        [0.00, 0.0],
        [0.95, 0.0],
        [1.10, 1.0],
        [2.20, 1.0],
        [2.40, 0.0],
        [2.50, 0.0],
      ]);

      return makePose({
        pelvisY: -0.175 * down,
        joints: {
          pelvis: [0.28 * down, -0.08 * down, 0],
          chest: [0.62 * down + 0.04 * hold, 0.10 * down, 0.05 * down],
          neck: [0.06 * down, 0, 0],
          head: [0.14 * down + 0.16 * hold, -0.06 * down, 0],
          legL: [-1.52 * down, 0.10 * down, 0.10 * down],
          shinL: [2.18 * down, 0, 0],
          footL: [-0.94 * down, 0, -0.06 * down],
          legR: [-1.56 * down, -0.10 * down, -0.10 * down],
          shinR: [2.22 * down, 0, 0],
          footR: [-0.94 * down, 0, 0.06 * down],
          // Right hand reaches down to floor (~y = 0.05 m), then holds object in front
          armR: [-0.94 * down - 0.56 * hold, 0, 0.08 * down + 0.14 * hold],
          forearmR: [-0.14 * down - 1.12 * hold, 0, 0.12 * hold],
          handR: [-0.28 * grasp, -0.20 * hold, 0],
          // Left hand steadies on left knee during crouch
          armL: [-0.74 * down, 0, -0.10 * down],
          forearmL: [-0.62 * down, 0, -0.10 * down],
        },
      });
    },
  },

  carry: {
    loop: true,
    duration: 1.05,
    sample(t) {
      const u = ((t / 1.05) % 1 + 1) % 1;
      const pose = sampleWalkBase(u, 0.86, 0.25);
      const bobBounce = Math.sin(u * TAU * 2 - 0.35) * 0.032;

      pose.joints.chest[0] = -0.045;
      pose.joints.head[0] = 0.045;
      pose.joints.armL = [-0.36 + bobBounce, 0.04, -0.08];
      pose.joints.forearmL = [-1.28 - bobBounce * 0.6, 0, -0.10];
      pose.joints.handL = [0.08, 0.36, 0];
      pose.joints.armR = [-0.36 + bobBounce, -0.04, 0.08];
      pose.joints.forearmR = [-1.28 - bobBounce * 0.6, 0, 0.10];
      pose.joints.handR = [0.08, -0.36, 0];
      return pose;
    },
  },

  openDoor: {
    loop: false,
    duration: 2.0,
    sample(t) {
      const u = clamp(t, 0, 2.0);

      const reach = sampleTrack(u, [
        [0.00, 0.0],
        [0.50, 1.0],
        [0.82, 1.0],
        [1.30, 0.0],
        [2.00, 0.0],
      ]);

      const twist = sampleTrack(u, [
        [0.00, 0.0],
        [0.52, 0.0],
        [0.76, 1.0],
        [1.18, 0.4],
        [1.45, 0.0],
        [2.00, 0.0],
      ]);

      const pull = sampleTrack(u, [
        [0.00, 0.0],
        [0.80, 0.0],
        [1.26, 1.0],
        [1.58, 0.45],
        [2.00, 0.0],
      ]);

      const stepThrough = sampleTrack(u, [
        [0.00, 0.0],
        [1.22, 0.0],
        [1.62, 1.0],
        [2.00, 0.0],
      ]);

      return makePose({
        pelvisY: -0.008 * reach - 0.010 * stepThrough,
        joints: {
          pelvis: [0.03 * reach, 0.08 * reach - 0.14 * pull, -0.03 * pull],
          chest: [0.10 * reach - 0.05 * pull + 0.05 * stepThrough, 0.16 * reach - 0.22 * pull, 0.03 * pull],
          neck: [0, -0.06 * reach + 0.10 * pull, 0],
          head: [-0.04 * reach, -0.10 * reach + 0.18 * pull, 0],
          armR: [-1.14 * reach - 0.26 * pull, 0, 0.08 * reach - 0.24 * pull],
          forearmR: [-0.34 * reach - 1.18 * pull, -0.35 * twist, 0],
          handR: [-0.14 * reach, -0.62 * twist, 0],
          armL: [0.12 * reach - 0.18 * stepThrough, 0, 0.04 * pull],
          forearmL: [-0.16 * reach - 0.22 * stepThrough, 0, 0],
          legL: [0.08 * reach - 0.30 * stepThrough, 0, 0],
          shinL: [0.10 * reach + 0.34 * stepThrough, 0, 0],
          footL: [-0.12 * reach - 0.06 * stepThrough, 0, 0],
          legR: [-0.14 * reach + 0.22 * stepThrough, 0, 0],
          shinR: [0.14 * reach + 0.10 * stepThrough, 0, 0],
          footR: [-0.02 * reach - 0.20 * stepThrough, 0, 0],
        },
      });
    },
  },
};

// --- Walk speed for foot-slide-free locomotion ---

const WALK_SPEEDS = {
  walk: 0.64,
  run: 1.55,
  carry: 0.54,
};

export function walkSpeed(clipName, opts) {
  const base = WALK_SPEEDS[clipName] || 0;
  const scale = opts && opts.bodyHeight ? opts.bodyHeight : 1;
  return base * scale;
}

// --- Runtime animator with smooth cross-fading ---

export function createAnimator(root, opts = {}) {
  const rootPivot = root && root.name === 'root'
    ? root
    : (root && root.getObjectByName ? root.getObjectByName('root') : null) || root;

  const restRoot = {
    y: rootPivot ? rootPivot.position.y : 0,
    rx: rootPivot ? rootPivot.rotation.x : 0,
  };

  const pivots = {};
  const rest = {};
  for (let i = 0; i < JOINT_NAMES.length; i++) {
    const name = JOINT_NAMES[i];
    const obj = root && root.getObjectByName ? root.getObjectByName(name) : null;
    if (obj) {
      pivots[name] = obj;
      rest[name] = {
        y: obj.position.y,
        rx: obj.rotation.x,
        ry: obj.rotation.y,
        rz: obj.rotation.z,
      };
    }
  }

  let currentName = 'idle';
  let currentClip = CLIPS.idle;
  let clipTime = 0;
  let clipOpts = { ...opts };

  let fadeFrom = null;
  let fadeElapsed = 0;
  let fadeDuration = 0;

  let presentPose = clonePose(currentClip.sample(0, clipOpts));

  function applyPose(pose) {
    if (rootPivot) {
      rootPivot.position.y = restRoot.y + (pose.root ? pose.root.y || 0 : 0);
      rootPivot.rotation.x = restRoot.rx + (pose.root ? pose.root.rx || 0 : 0);
    }

    if (pivots.pelvis) {
      pivots.pelvis.position.y = rest.pelvis.y + (pose.pelvisY || 0);
    }

    for (let i = 0; i < JOINT_NAMES.length; i++) {
      const name = JOINT_NAMES[i];
      const p = pivots[name];
      if (!p) continue;
      const r = rest[name];
      const v = pose.joints && pose.joints[name];
      const rx = v ? v[0] || 0 : 0;
      const ry = v ? v[1] || 0 : 0;
      const rz = v ? v[2] || 0 : 0;
      p.rotation.set(r.rx + rx, r.ry + ry, r.rz + rz);
    }
  }

  function play(name, playOpts = {}) {
    const nextClip = CLIPS[name];
    if (!nextClip) return;

    const { fade = 0.25, restart = false, ...extra } = playOpts;
    clipOpts = { ...opts, ...extra };

    if (name === currentName && nextClip.loop && !restart) {
      return;
    }

    fadeFrom = fade > 0 ? clonePose(presentPose) : null;
    fadeDuration = Math.max(0, fade);
    fadeElapsed = 0;

    currentName = name;
    currentClip = nextClip;
    clipTime = 0;

    if (fadeDuration === 0) {
      presentPose = clonePose(currentClip.sample(0, clipOpts));
      applyPose(presentPose);
    }
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) dt = 0;

    const dur = currentClip.duration;
    if (currentClip.loop) {
      clipTime = dur > 0 ? (clipTime + dt) % dur : 0;
    } else {
      clipTime = Math.min(clipTime + dt, dur);
    }

    let targetPose = currentClip.sample(clipTime, clipOpts);

    if (fadeFrom && fadeDuration > 0) {
      fadeElapsed += dt;
      if (fadeElapsed >= fadeDuration) {
        fadeFrom = null;
        fadeDuration = 0;
      } else {
        const alpha = smoothstep(0, 1, fadeElapsed / fadeDuration);
        targetPose = blendPose(fadeFrom, targetPose, alpha);
      }
    }

    presentPose = clonePose(targetPose);
    applyPose(presentPose);
  }

  function current() {
    return currentName;
  }

  function isDone() {
    return !currentClip.loop && clipTime >= currentClip.duration;
  }

  return { play, update, current, isDone };
}