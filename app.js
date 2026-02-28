const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomRange = (min, max) => min + Math.random() * (max - min);

const WORLD_WIDTH_M = 82;
const GROUND_THICKNESS_M = 2.2;
const SKY_KILL_MARGIN_M = 1.4;
const MAX_BODIES = 280;
const TRAIN_LENGTH_M = 9.2;
const TRAIN_HEIGHT_M = 2.45;
const TRAIN_BUFFER_M = 4;

const canvas = document.getElementById("sim-canvas");
const ctx = canvas.getContext("2d");

const controls = {
  speed: document.getElementById("speed"),
  speedValue: document.getElementById("speed-value"),
  angle: document.getElementById("angle"),
  angleValue: document.getElementById("angle-value"),
  cannonElevation: document.getElementById("cannon-elevation"),
  cannonElevationValue: document.getElementById("cannon-elevation-value"),
  wallDistance: document.getElementById("wall-distance"),
  wallDistanceValue: document.getElementById("wall-distance-value"),
  wallHeight: document.getElementById("wall-height"),
  wallHeightValue: document.getElementById("wall-height-value"),
  gravity: document.getElementById("gravity"),
  gravityValue: document.getElementById("gravity-value"),
  wind: document.getElementById("wind"),
  windValue: document.getElementById("wind-value"),
  fragmentCount: document.getElementById("fragment-count"),
  fragmentCountValue: document.getElementById("fragment-count-value"),
  burstPower: document.getElementById("burst-power"),
  burstPowerValue: document.getElementById("burst-power-value"),
  restitution: document.getElementById("restitution"),
  restitutionValue: document.getElementById("restitution-value"),
  timeScale: document.getElementById("time-scale"),
  timeScaleValue: document.getElementById("time-scale-value"),
  autoFireInterval: document.getElementById("auto-fire-interval"),
  autoFireIntervalValue: document.getElementById("auto-fire-interval-value"),
  trainSpeed: document.getElementById("train-speed"),
  trainSpeedValue: document.getElementById("train-speed-value"),
  showTrails: document.getElementById("show-trails"),
  autoFire: document.getElementById("auto-fire"),
  launchButton: document.getElementById("launch"),
  sendTrainButton: document.getElementById("send-train"),
  pauseButton: document.getElementById("pause"),
  rebuildWallButton: document.getElementById("rebuild-wall"),
  clearButton: document.getElementById("clear"),
  resetButton: document.getElementById("reset"),
};

const formatters = {
  speed: (v) => `${Number(v).toFixed(1)} m/s`,
  angle: (v) => `${Math.round(v)} deg`,
  cannonElevation: (v) => `${Number(v).toFixed(1)} m`,
  wallDistance: (v) => `${Number(v).toFixed(1)} m`,
  wallHeight: (v) => `${Number(v).toFixed(1)} m`,
  gravity: (v) => `${Number(v).toFixed(2)} m/s^2`,
  wind: (v) => `${Number(v).toFixed(2)} m/s^2`,
  fragmentCount: (v) => `${Math.round(v)} pcs`,
  burstPower: (v) => `${Math.round(v)} m/s`,
  restitution: (v) => Number(v).toFixed(2),
  timeScale: (v) => `${Number(v).toFixed(2)}x`,
  autoFireInterval: (v) => `${Number(v).toFixed(2)} s`,
  trainSpeed: (v) => `${Math.round(v)} m/s`,
};

const state = {
  widthPx: 0,
  heightPx: 0,
  ppm: 12,
  worldHeightM: 0,
  groundY: 0,
  wall: {
    widthM: 1.45,
    restitution: 0.3,
    friction: 0.34,
  },
  wallBroken: false,
  cannon: {
    xM: 6,
    barrelLengthM: 1.85,
  },
  train: null,
  bodies: [],
  effects: [],
  paused: false,
  lastTimestamp: 0,
  accumulator: 0,
  fixedDt: 1 / 144,
  maxSteps: 10,
  autoFireClock: 0,
  shotsFired: 0,
  fragmentsSpawned: 0,
  trainsSent: 0,
  wallsDemolished: 0,
  skyObliterations: 0,
  maxAltitudeM: 0,
  simTime: 0,
  fragmentPairHitTime: new Map(),
  fps: 60,
  fpsSmoothing: 0.08,
};

let nextBodyId = 1;

const mx = (meters) => meters * state.ppm;
const my = (meters) => meters * state.ppm;
const mp = (pixels) => pixels / state.ppm;

const discMass = (radiusM, density = 32) => Math.PI * radiusM * radiusM * density;

function createBody(config) {
  return {
    id: nextBodyId++,
    kind: "fragment",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 0.1,
    mass: 1,
    restitution: 0.4,
    friction: 0.45,
    airDrag: 0.08,
    color: "#ffd166",
    age: 0,
    fragmentHits: 0,
    brickW: 0,
    brickH: 0,
    trail: [],
    ...config,
  };
}

function getSettings() {
  return {
    speed: Number(controls.speed.value),
    angle: Number(controls.angle.value),
    cannonElevation: Number(controls.cannonElevation.value),
    wallDistance: Number(controls.wallDistance.value),
    wallHeight: Number(controls.wallHeight.value),
    gravity: Number(controls.gravity.value),
    wind: Number(controls.wind.value),
    fragmentCount: Number(controls.fragmentCount.value),
    burstPower: Number(controls.burstPower.value),
    restitution: Number(controls.restitution.value),
    timeScale: Number(controls.timeScale.value),
    autoFireInterval: Number(controls.autoFireInterval.value),
    trainSpeed: Number(controls.trainSpeed.value),
    showTrails: controls.showTrails.checked,
    autoFire: controls.autoFire.checked,
  };
}

function updateReadouts() {
  controls.speedValue.textContent = formatters.speed(controls.speed.value);
  controls.angleValue.textContent = formatters.angle(controls.angle.value);
  controls.cannonElevationValue.textContent = formatters.cannonElevation(controls.cannonElevation.value);
  controls.wallDistanceValue.textContent = formatters.wallDistance(controls.wallDistance.value);
  controls.wallHeightValue.textContent = formatters.wallHeight(controls.wallHeight.value);
  controls.gravityValue.textContent = formatters.gravity(controls.gravity.value);
  controls.windValue.textContent = formatters.wind(controls.wind.value);
  controls.fragmentCountValue.textContent = formatters.fragmentCount(controls.fragmentCount.value);
  controls.burstPowerValue.textContent = formatters.burstPower(controls.burstPower.value);
  controls.restitutionValue.textContent = formatters.restitution(controls.restitution.value);
  controls.timeScaleValue.textContent = formatters.timeScale(controls.timeScale.value);
  controls.autoFireIntervalValue.textContent = formatters.autoFireInterval(controls.autoFireInterval.value);
  controls.trainSpeedValue.textContent = formatters.trainSpeed(controls.trainSpeed.value);
}

function getLauncherOrigin(settings) {
  return {
    x: state.cannon.xM,
    y: clamp(state.groundY - settings.cannonElevation, 0.6, state.groundY - 0.45),
  };
}

function getWallRect(settings) {
  const origin = getLauncherOrigin(settings);
  const left = clamp(
    origin.x + settings.wallDistance,
    origin.x + 4,
    WORLD_WIDTH_M - state.wall.widthM - 0.6,
  );
  const height = clamp(settings.wallHeight, 1.8, state.groundY - 0.4);

  return {
    left,
    top: state.groundY - height,
    right: left + state.wall.widthM,
    bottom: state.groundY,
    width: state.wall.widthM,
    height,
  };
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getTrainRect(train = state.train) {
  if (!train) {
    return null;
  }

  return {
    left: train.x - train.length * 0.5,
    right: train.x + train.length * 0.5,
    top: train.y - train.height * 0.5,
    bottom: train.y + train.height * 0.5,
    width: train.length,
    height: train.height,
  };
}

function sendTrain() {
  const settings = getSettings();
  state.train = {
    x: -TRAIN_BUFFER_M - TRAIN_LENGTH_M * 0.5,
    y: state.groundY - TRAIN_HEIGHT_M * 0.5 - 0.02,
    length: TRAIN_LENGTH_M,
    height: TRAIN_HEIGHT_M,
    vx: settings.trainSpeed,
  };
  state.trainsSent += 1;
}

function rebuildWall() {
  const removedBodyIds = new Set();
  state.bodies = state.bodies.filter((body) => {
    if (body.kind !== "brick") {
      return true;
    }
    removedBodyIds.add(body.id);
    return false;
  });
  pruneFragmentPairCache(removedBodyIds);
  state.wallBroken = false;
}

function demolishWallIntoBricks(wall, settings) {
  if (state.wallBroken) {
    return;
  }

  state.wallBroken = true;
  state.wallsDemolished += 1;

  const brickW = 0.5;
  const brickH = 0.32;
  const columns = Math.max(2, Math.floor(wall.width / brickW) + 1);
  const rows = clamp(Math.floor(wall.height / brickH), 3, 20);
  const spawnLimit = 120;
  let spawned = 0;
  const trainPush = state.train ? state.train.vx : settings.trainSpeed;
  const impactX = wall.left + wall.width * 0.35;
  const impactY = wall.top + wall.height * 0.45;

  for (let row = 0; row < rows && spawned < spawnLimit; row += 1) {
    const y = wall.bottom - brickH * (row + 0.5);
    const stagger = (row % 2) * brickW * 0.5;

    for (let col = -1; col < columns + 1; col += 1) {
      if (spawned >= spawnLimit) {
        break;
      }
      const x = wall.left + brickW * 0.5 + col * brickW + stagger;
      if (x < wall.left + brickW * 0.25 || x > wall.right - brickW * 0.25) {
        continue;
      }

      const radius = Math.min(brickW, brickH) * 0.55;
      const spread = (x - wall.left) / Math.max(wall.width, 0.01);
      const forwardKick = trainPush * randomRange(0.62, 1.1) + spread * 18;

      state.bodies.push(
        createBody({
          kind: "brick",
          x: x + randomRange(-0.04, 0.04),
          y: y + randomRange(-0.03, 0.03),
          vx: forwardKick + randomRange(-4, 14),
          vy: randomRange(-16, -1.5) - row * 0.14,
          r: radius,
          brickW,
          brickH,
          mass: discMass(radius, randomRange(85, 115)),
          restitution: clamp(settings.restitution * 0.75 + randomRange(-0.06, 0.05), 0.08, 0.85),
          friction: randomRange(0.42, 0.82),
          airDrag: randomRange(0.05, 0.17),
          color: row % 2 === 0 ? "#b16a54" : "#a35c49",
        }),
      );
      spawned += 1;
    }
  }

  applyRadialImpulse(impactX, impactY, 9.5, trainPush * 0.75);
  addShockwaveEffect(impactX, impactY, "255,167,112", 0.52, 9.7);
  if (state.train) {
    state.train.vx *= 0.9;
  }
  enforceBodyCap(MAX_BODIES);
}

function launchProjectile() {
  const settings = getSettings();
  const origin = getLauncherOrigin(settings);
  const angle = (settings.angle * Math.PI) / 180;
  const radius = 0.34;
  const launchOffset = state.cannon.barrelLengthM + radius + 0.04;

  const projectile = createBody({
    kind: "projectile",
    x: origin.x + Math.cos(angle) * launchOffset,
    y: origin.y - Math.sin(angle) * launchOffset,
    vx: Math.cos(angle) * settings.speed,
    vy: -Math.sin(angle) * settings.speed,
    r: radius,
    mass: discMass(radius, 44),
    restitution: clamp(settings.restitution * 0.68 + 0.14, 0.08, 0.95),
    friction: 0.4,
    airDrag: 0.025,
    color: "#f3f1dc",
  });

  if (projectile.y + projectile.r > state.groundY) {
    projectile.y = state.groundY - projectile.r - 0.02;
  }

  state.bodies.push(projectile);
  state.shotsFired += 1;
  enforceBodyCap(MAX_BODIES);
}

function addShockwaveEffect(x, y, color, life = 0.35, maxRadius = 7.5) {
  state.effects.push({
    x,
    y,
    radius: 0.2,
    maxRadius,
    life,
    totalLife: life,
    color,
  });
}

function applyRadialImpulse(originX, originY, radius, strength, skipBodyId = null) {
  for (const body of state.bodies) {
    if (skipBodyId !== null && body.id === skipBodyId) {
      continue;
    }

    const dx = body.x - originX;
    const dy = body.y - originY;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1e-6 || distance > radius) {
      continue;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const falloff = 1 - distance / radius;
    const kick = strength * falloff * clamp(1 / Math.sqrt(body.mass), 0.18, 1.2);

    body.vx += nx * kick;
    body.vy += ny * kick;
  }
}

function explodeProjectile(projectile, settings) {
  const palette = ["#ffe9a6", "#ffd166", "#f8a62a", "#ff9448", "#f95738"];
  const count = settings.fragmentCount;

  for (let i = 0; i < count; i += 1) {
    const theta = (i / count) * Math.PI * 2 + randomRange(-0.08, 0.08);
    const radius = randomRange(0.07, 0.2);
    const speed = settings.burstPower * randomRange(0.72, 1.18);
    const tangential = settings.burstPower * randomRange(-0.24, 0.24);
    const spawnDistance = projectile.r + radius + randomRange(0.03, 0.14);

    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const fragment = createBody({
      kind: "fragment",
      x: projectile.x + cos * spawnDistance,
      y: projectile.y + sin * spawnDistance,
      vx: projectile.vx * 0.22 + cos * speed - sin * tangential + randomRange(-1.2, 1.2),
      vy: projectile.vy * 0.22 + sin * speed + cos * tangential + randomRange(-1.2, 1.2),
      r: radius,
      mass: discMass(radius, randomRange(22, 38)),
      restitution: clamp(settings.restitution + randomRange(-0.09, 0.07), 0.1, 0.95),
      friction: randomRange(0.26, 0.74),
      airDrag: randomRange(0.03, 0.12),
      color: palette[(Math.random() * palette.length) | 0],
    });

    state.bodies.push(fragment);
  }

  state.fragmentsSpawned += count;

  applyRadialImpulse(projectile.x, projectile.y, 6.5, settings.burstPower * 0.46, projectile.id);
  addShockwaveEffect(projectile.x, projectile.y, "255,173,84", 0.45, 8.5);
}

function circleIntersectsRect(body, rect) {
  const nearestX = clamp(body.x, rect.left, rect.right);
  const nearestY = clamp(body.y, rect.top, rect.bottom);
  const dx = body.x - nearestX;
  const dy = body.y - nearestY;
  return dx * dx + dy * dy < body.r * body.r;
}

function resolveRectCollision(body, rect, restitution, friction) {
  const nearestX = clamp(body.x, rect.left, rect.right);
  const nearestY = clamp(body.y, rect.top, rect.bottom);
  const dx = body.x - nearestX;
  const dy = body.y - nearestY;
  const distance = Math.hypot(dx, dy);

  let nx = 0;
  let ny = 0;
  let penetration = 0;

  if (distance < 1e-8) {
    const toLeft = body.x - rect.left;
    const toRight = rect.right - body.x;
    const toTop = body.y - rect.top;
    const toBottom = rect.bottom - body.y;
    const minSide = Math.min(toLeft, toRight, toTop, toBottom);

    if (minSide === toLeft) {
      nx = -1;
      penetration = body.r + toLeft;
    } else if (minSide === toRight) {
      nx = 1;
      penetration = body.r + toRight;
    } else if (minSide === toTop) {
      ny = -1;
      penetration = body.r + toTop;
    } else {
      ny = 1;
      penetration = body.r + toBottom;
    }
  } else {
    nx = dx / distance;
    ny = dy / distance;
    penetration = body.r - distance;
  }

  if (penetration <= 0) {
    return;
  }

  body.x += nx * penetration;
  body.y += ny * penetration;

  const normalVelocity = body.vx * nx + body.vy * ny;
  if (normalVelocity < 0) {
    body.vx -= (1 + restitution) * normalVelocity * nx;
    body.vy -= (1 + restitution) * normalVelocity * ny;

    const tx = -ny;
    const ty = nx;
    const tangentVelocity = body.vx * tx + body.vy * ty;
    body.vx -= tangentVelocity * friction * tx;
    body.vy -= tangentVelocity * friction * ty;
  }
}

function resolveBodyTrainCollision(body, train) {
  const trainRect = getTrainRect(train);
  if (!trainRect) {
    return;
  }

  const nearestX = clamp(body.x, trainRect.left, trainRect.right);
  const nearestY = clamp(body.y, trainRect.top, trainRect.bottom);
  const dx = body.x - nearestX;
  const dy = body.y - nearestY;
  const distance = Math.hypot(dx, dy);
  let nx = 0;
  let ny = 0;
  let penetration = 0;

  if (distance < 1e-8) {
    const toLeft = body.x - trainRect.left;
    const toRight = trainRect.right - body.x;
    const toTop = body.y - trainRect.top;
    const toBottom = trainRect.bottom - body.y;
    const minSide = Math.min(toLeft, toRight, toTop, toBottom);

    if (minSide === toLeft) {
      nx = -1;
      penetration = body.r + toLeft;
    } else if (minSide === toRight) {
      nx = 1;
      penetration = body.r + toRight;
    } else if (minSide === toTop) {
      ny = -1;
      penetration = body.r + toTop;
    } else {
      ny = 1;
      penetration = body.r + toBottom;
    }
  } else {
    nx = dx / distance;
    ny = dy / distance;
    penetration = body.r - distance;
  }

  if (penetration <= 0) {
    return;
  }

  body.x += nx * penetration;
  body.y += ny * penetration;

  const relativeNormalVelocity = (body.vx - train.vx) * nx + body.vy * ny;
  if (relativeNormalVelocity < 0) {
    const restitution = Math.max(0.28, body.restitution * 0.62);
    const impulse = -(1 + restitution) * relativeNormalVelocity;
    body.vx += impulse * nx;
    body.vy += impulse * ny;
  }

  if (Math.abs(ny) > 0.6) {
    body.vx += (train.vx - body.vx) * 0.16;
  }
  if (nx > 0.2) {
    body.vx = Math.max(body.vx, train.vx * randomRange(0.72, 1.02));
  }
}

function resolveSideBounds(body, restitution) {
  if (body.x - body.r < 0) {
    body.x = body.r;
    if (body.vx < 0) {
      body.vx = -body.vx * restitution;
    }
  }

  if (body.x + body.r > WORLD_WIDTH_M) {
    body.x = WORLD_WIDTH_M - body.r;
    if (body.vx > 0) {
      body.vx = -body.vx * restitution;
    }
  }
}

function resolveGroundCollision(body, dt) {
  if (body.y + body.r <= state.groundY) {
    return;
  }

  body.y = state.groundY - body.r;

  if (body.vy > 0) {
    body.vy = -body.vy * body.restitution;
  }

  const frictionDelta = body.friction * 12 * dt;
  if (Math.abs(body.vx) <= frictionDelta) {
    body.vx = 0;
  } else {
    body.vx -= Math.sign(body.vx) * frictionDelta;
  }

  if (Math.abs(body.vy) < 0.14) {
    body.vy = 0;
  }
}

function pairKey(idA, idB) {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

function registerFragmentImpact(a, b, impactSpeed, removeBodyIds) {
  if (a.kind !== "fragment" || b.kind !== "fragment") {
    return;
  }

  if (impactSpeed < 0.85) {
    return;
  }

  const key = pairKey(a.id, b.id);
  const lastImpactTime = state.fragmentPairHitTime.get(key);
  if (lastImpactTime !== undefined && state.simTime - lastImpactTime < 0.12) {
    return;
  }

  state.fragmentPairHitTime.set(key, state.simTime);
  a.fragmentHits += 1;
  b.fragmentHits += 1;

  if (a.fragmentHits >= 2) {
    removeBodyIds.add(a.id);
  }
  if (b.fragmentHits >= 2) {
    removeBodyIds.add(b.id);
  }
}

function pruneFragmentPairCache(removedBodyIds) {
  if (removedBodyIds.size === 0 || state.fragmentPairHitTime.size === 0) {
    return;
  }

  for (const key of state.fragmentPairHitTime.keys()) {
    const separator = key.indexOf(":");
    const idA = Number(key.slice(0, separator));
    const idB = Number(key.slice(separator + 1));
    if (removedBodyIds.has(idA) || removedBodyIds.has(idB)) {
      state.fragmentPairHitTime.delete(key);
    }
  }
}

function resolveBodyCollisions(removeBodyIds) {
  const bodies = state.bodies;
  const iterations = 6;
  const slop = 0.001;
  const correctionPercent = 0.82;

  for (let pass = 0; pass < iterations; pass += 1) {
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i];
      if (removeBodyIds.has(a.id)) {
        continue;
      }
      for (let j = i + 1; j < bodies.length; j += 1) {
        if (removeBodyIds.has(a.id)) {
          break;
        }
        const b = bodies[j];
        if (removeBodyIds.has(b.id)) {
          continue;
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minDist * minDist) {
          continue;
        }

        let distance = Math.sqrt(distSq);
        let nx = 1;
        let ny = 0;

        if (distance >= 1e-6) {
          nx = dx / distance;
          ny = dy / distance;
        } else {
          const angle = ((i * 92821 + j * 68917) % 360) * (Math.PI / 180);
          nx = Math.cos(angle);
          ny = Math.sin(angle);
          distance = 0;
        }

        const penetration = minDist - distance;
        const invMassA = 1 / a.mass;
        const invMassB = 1 / b.mass;

        const correction = (Math.max(penetration - slop, 0) / (invMassA + invMassB)) * correctionPercent;
        a.x -= nx * correction * invMassA;
        a.y -= ny * correction * invMassA;
        b.x += nx * correction * invMassB;
        b.y += ny * correction * invMassB;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal > 0) {
          continue;
        }

        registerFragmentImpact(a, b, -velAlongNormal, removeBodyIds);
        if (removeBodyIds.has(a.id) || removeBodyIds.has(b.id)) {
          continue;
        }

        const restitution = Math.min(a.restitution, b.restitution);
        const impulseMag = (-(1 + restitution) * velAlongNormal) / (invMassA + invMassB);
        const impulseX = impulseMag * nx;
        const impulseY = impulseMag * ny;

        a.vx -= impulseX * invMassA;
        a.vy -= impulseY * invMassA;
        b.vx += impulseX * invMassB;
        b.vy += impulseY * invMassB;

        const tangentXRaw = rvx - velAlongNormal * nx;
        const tangentYRaw = rvy - velAlongNormal * ny;
        const tangentLength = Math.hypot(tangentXRaw, tangentYRaw);

        if (tangentLength > 1e-7) {
          const tx = tangentXRaw / tangentLength;
          const ty = tangentYRaw / tangentLength;
          let frictionMag = (-(rvx * tx + rvy * ty)) / (invMassA + invMassB);
          const mu = Math.sqrt(a.friction * b.friction);
          const maxFriction = impulseMag * mu;
          frictionMag = clamp(frictionMag, -maxFriction, maxFriction);

          const fx = frictionMag * tx;
          const fy = frictionMag * ty;

          a.vx -= fx * invMassA;
          a.vy -= fy * invMassA;
          b.vx += fx * invMassB;
          b.vy += fy * invMassB;
        }
      }
    }
  }
}

function settleRestingBodies() {
  for (const body of state.bodies) {
    if (body.y + body.r < state.groundY - 0.002) {
      continue;
    }

    if (Math.abs(body.vx) < 0.08) {
      body.vx = 0;
    }

    if (Math.abs(body.vy) < 0.08) {
      body.vy = 0;
    }
  }
}

function enforceBodyCap(maxBodies) {
  const removedBodyIds = new Set();

  if (state.bodies.length <= maxBodies) {
    return removedBodyIds;
  }

  let overflow = state.bodies.length - maxBodies;

  state.bodies = state.bodies.filter((body) => {
    if (overflow > 0 && body.kind === "fragment") {
      removedBodyIds.add(body.id);
      overflow -= 1;
      return false;
    }
    return true;
  });

  if (overflow > 0) {
    const removed = state.bodies.splice(0, overflow);
    for (const body of removed) {
      removedBodyIds.add(body.id);
    }
  }

  pruneFragmentPairCache(removedBodyIds);
  return removedBodyIds;
}

function updateEffects(dt) {
  for (const effect of state.effects) {
    effect.life -= dt;
    const approach = (effect.maxRadius - effect.radius) * 0.22;
    effect.radius += approach + 3.8 * dt;
  }

  state.effects = state.effects.filter((effect) => effect.life > 0);
}

function stepPhysics(dt, settings) {
  state.simTime += dt;
  const wall = getWallRect(settings);
  const removeBodyIds = new Set();

  if (state.train) {
    state.train.x += state.train.vx * dt;
    if (state.train.x - state.train.length * 0.5 > WORLD_WIDTH_M + TRAIN_BUFFER_M) {
      state.train = null;
    }
  }

  if (state.train && !state.wallBroken) {
    const trainRect = getTrainRect(state.train);
    if (trainRect && rectsOverlap(trainRect, wall)) {
      demolishWallIntoBricks(wall, settings);
    }
  }

  for (const body of state.bodies) {
    body.age += dt;

    body.vx += settings.wind * dt;
    body.vy += settings.gravity * dt;

    const drag = Math.exp(-body.airDrag * dt);
    body.vx *= drag;
    body.vy *= drag;

    const speed = Math.hypot(body.vx, body.vy);
    const speedCap = body.kind === "projectile" ? 360 : 280;
    if (speed > speedCap) {
      const scale = speedCap / speed;
      body.vx *= scale;
      body.vy *= scale;
    }

    body.x += body.vx * dt;
    body.y += body.vy * dt;

    resolveSideBounds(body, settings.restitution);
    resolveGroundCollision(body, dt);

    const altitude = Math.max(0, state.groundY - body.y);
    if (altitude > state.maxAltitudeM) {
      state.maxAltitudeM = altitude;
    }

    if (body.y + body.r < -SKY_KILL_MARGIN_M) {
      removeBodyIds.add(body.id);
      if (body.kind === "projectile") {
        state.skyObliterations += 1;
        addShockwaveEffect(body.x, -0.1, "255,132,132", 0.35, 6.2);
      }
      continue;
    }

    if (body.kind === "fragment" && body.age > 20) {
      removeBodyIds.add(body.id);
    }
  }

  if (!state.wallBroken) {
    for (const body of state.bodies) {
      if (removeBodyIds.has(body.id)) {
        continue;
      }

      if (!circleIntersectsRect(body, wall)) {
        continue;
      }

      if (body.kind === "projectile") {
        explodeProjectile(body, settings);
        removeBodyIds.add(body.id);
        continue;
      }

      resolveRectCollision(body, wall, state.wall.restitution, state.wall.friction);
    }
  }

  if (state.train) {
    for (const body of state.bodies) {
      if (removeBodyIds.has(body.id)) {
        continue;
      }
      resolveBodyTrainCollision(body, state.train);
    }
  }

  if (removeBodyIds.size > 0) {
    state.bodies = state.bodies.filter((body) => !removeBodyIds.has(body.id));
    pruneFragmentPairCache(removeBodyIds);
    removeBodyIds.clear();
  }

  resolveBodyCollisions(removeBodyIds);
  if (removeBodyIds.size > 0) {
    state.bodies = state.bodies.filter((body) => !removeBodyIds.has(body.id));
    pruneFragmentPairCache(removeBodyIds);
  }

  settleRestingBodies();
  enforceBodyCap(MAX_BODIES);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.heightPx);
  gradient.addColorStop(0, "#0a202f");
  gradient.addColorStop(1, "#152f44");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.widthPx, state.heightPx);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#6ca9c6";
  ctx.lineWidth = 1;

  for (let y = 0; y < state.groundY; y += 2) {
    const py = my(y);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(state.widthPx, py);
    ctx.stroke();
  }

  for (let x = 0; x < WORLD_WIDTH_M; x += 4) {
    const px = mx(x);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, my(state.groundY));
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function drawGround() {
  const groundTopPx = my(state.groundY);
  const gradient = ctx.createLinearGradient(0, groundTopPx, 0, state.heightPx);
  gradient.addColorStop(0, "#2f4f63");
  gradient.addColorStop(1, "#1d3243");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, groundTopPx, state.widthPx, state.heightPx - groundTopPx);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundTopPx + 0.5);
  ctx.lineTo(state.widthPx, groundTopPx + 0.5);
  ctx.stroke();
}

function drawWall(settings) {
  const wall = getWallRect(settings);
  const leftPx = mx(wall.left);
  const topPx = my(wall.top);
  const widthPx = mx(wall.width);
  const heightPx = my(wall.height);

  if (state.wallBroken) {
    ctx.strokeStyle = "rgba(255, 196, 156, 0.45)";
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 2;
    ctx.strokeRect(leftPx, topPx, widthPx, heightPx);
    ctx.setLineDash([]);
    return;
  }

  const gradient = ctx.createLinearGradient(leftPx, topPx, leftPx + widthPx, topPx + heightPx);
  gradient.addColorStop(0, "#98624a");
  gradient.addColorStop(1, "#6f3f31");

  ctx.fillStyle = gradient;
  ctx.fillRect(leftPx, topPx, widthPx, heightPx);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  for (let y = wall.top + 0.45; y < wall.bottom; y += 0.8) {
    const py = my(y);
    ctx.beginPath();
    ctx.moveTo(leftPx, py);
    ctx.lineTo(leftPx + widthPx, py);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 220, 180, 0.38)";
  ctx.lineWidth = 2;
  ctx.strokeRect(leftPx + 0.5, topPx + 0.5, widthPx - 1, heightPx - 1);
}

function drawLauncher(settings) {
  const origin = getLauncherOrigin(settings);
  const angle = (settings.angle * Math.PI) / 180;
  const tipX = origin.x + Math.cos(angle) * state.cannon.barrelLengthM;
  const tipY = origin.y - Math.sin(angle) * state.cannon.barrelLengthM;

  ctx.lineCap = "round";
  ctx.strokeStyle = "#f4cf79";
  ctx.lineWidth = Math.max(4, mx(0.23));
  ctx.beginPath();
  ctx.moveTo(mx(origin.x), my(origin.y));
  ctx.lineTo(mx(tipX), my(tipY));
  ctx.stroke();

  ctx.fillStyle = "#ffb043";
  ctx.beginPath();
  ctx.arc(mx(origin.x), my(origin.y), Math.max(5, mx(0.32)), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#452618";
  ctx.beginPath();
  ctx.arc(mx(origin.x), my(origin.y), Math.max(2, mx(0.12)), 0, Math.PI * 2);
  ctx.fill();
}

function drawTrain() {
  if (!state.train) {
    return;
  }

  const rect = getTrainRect(state.train);
  if (!rect) {
    return;
  }

  const leftPx = mx(rect.left);
  const topPx = my(rect.top);
  const widthPx = mx(rect.width);
  const heightPx = my(rect.height);

  const bodyGradient = ctx.createLinearGradient(leftPx, topPx, leftPx, topPx + heightPx);
  bodyGradient.addColorStop(0, "#417aa6");
  bodyGradient.addColorStop(1, "#2d5f88");
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(leftPx, topPx, widthPx, heightPx);

  const stripeY = topPx + heightPx * 0.58;
  ctx.fillStyle = "#f2c04c";
  ctx.fillRect(leftPx, stripeY, widthPx, Math.max(3, heightPx * 0.12));

  ctx.fillStyle = "#9dc8e6";
  const cabW = widthPx * 0.2;
  const cabH = heightPx * 0.34;
  ctx.fillRect(leftPx + widthPx * 0.69, topPx + heightPx * 0.16, cabW, cabH);

  ctx.strokeStyle = "rgba(8, 18, 25, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(leftPx + 0.5, topPx + 0.5, widthPx - 1, heightPx - 1);

  const wheelY = topPx + heightPx + mx(0.32);
  const wheelRadius = Math.max(5, mx(0.26));
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    const wx = leftPx + widthPx * (0.14 + 0.74 * t);
    ctx.fillStyle = "#1c2731";
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8e9aa5";
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrails(showTrails) {
  for (const body of state.bodies) {
    if (!showTrails) {
      body.trail.length = 0;
      continue;
    }

    body.trail.push({ x: body.x, y: body.y });
    if (body.trail.length > 18) {
      body.trail.shift();
    }

    for (let i = 0; i < body.trail.length; i += 1) {
      const point = body.trail[i];
      const alpha = ((i + 1) / body.trail.length) * 0.2;
      const radiusPx = Math.max(1, mx(Math.max(0.03, body.r * 0.26)));
      ctx.fillStyle = `rgba(255, 246, 211, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mx(point.x), my(point.y), radiusPx, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBodies() {
  for (const body of state.bodies) {
    const cx = mx(body.x);
    const cy = my(body.y);
    const radiusPx = Math.max(1, mx(body.r));

    if (body.kind === "brick") {
      const brickW = Math.max(2, mx(body.brickW || body.r * 1.7));
      const brickH = Math.max(2, my(body.brickH || body.r));
      const fakeTilt = clamp(body.vx * 0.003, -0.3, 0.3);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(fakeTilt);

      const brickGradient = ctx.createLinearGradient(-brickW * 0.5, -brickH * 0.5, brickW * 0.5, brickH * 0.5);
      brickGradient.addColorStop(0, "#cf8a6c");
      brickGradient.addColorStop(1, body.color);
      ctx.fillStyle = brickGradient;
      ctx.fillRect(-brickW * 0.5, -brickH * 0.5, brickW, brickH);

      ctx.strokeStyle = "rgba(58, 31, 20, 0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-brickW * 0.5, -brickH * 0.5, brickW, brickH);
      ctx.restore();
      continue;
    }

    const gradient = ctx.createRadialGradient(
      cx - radiusPx * 0.35,
      cy - radiusPx * 0.35,
      Math.max(1, radiusPx * 0.2),
      cx,
      cy,
      radiusPx,
    );

    if (body.kind === "projectile") {
      gradient.addColorStop(0, "#fff9e1");
      gradient.addColorStop(1, "#e4c069");
    } else {
      gradient.addColorStop(0, "#fff7db");
      gradient.addColorStop(1, body.color);
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(40, 20, 6, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawEffects() {
  for (const effect of state.effects) {
    const alpha = clamp(effect.life / effect.totalLife, 0, 1);
    ctx.strokeStyle = `rgba(${effect.color}, ${(alpha * 0.65).toFixed(3)})`;
    ctx.lineWidth = 2 + alpha * 2;
    ctx.beginPath();
    ctx.arc(mx(effect.x), my(effect.y), Math.max(1, mx(effect.radius)), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(settings) {
  ctx.font = '600 12px "IBM Plex Mono", monospace';
  ctx.fillStyle = "rgba(228, 242, 252, 0.92)";

  const activeProjectiles = state.bodies.filter((body) => body.kind === "projectile").length;
  const fragments = state.bodies.filter((body) => body.kind === "fragment").length;
  const bricks = state.bodies.filter((body) => body.kind === "brick").length;
  const wallStatus = state.wallBroken ? "Demolished" : "Intact";
  const trainStatus = state.train ? `Active @ ${state.train.vx.toFixed(1)} m/s` : "Idle";
  const lines = [
    `Units: meters / seconds`,
    `Shots: ${state.shotsFired}`,
    `Spawned fragments: ${state.fragmentsSpawned}`,
    `Live fragments: ${Math.max(0, fragments)}   Bricks: ${bricks}`,
    `Wall: ${settings.wallDistance.toFixed(1)} m away, ${settings.wallHeight.toFixed(1)} m tall`,
    `Wall status: ${wallStatus}   Walls demolished: ${state.wallsDemolished}`,
    `Cannon elevation: ${settings.cannonElevation.toFixed(1)} m`,
    `Train: ${trainStatus}   Trains sent: ${state.trainsSent}`,
    `Sky obliterations: ${state.skyObliterations}`,
    `Peak altitude: ${state.maxAltitudeM.toFixed(1)} m`,
    `FPS: ${state.fps.toFixed(0)}  Time scale: ${settings.timeScale.toFixed(2)}x`,
  ];

  let y = 22;
  for (const line of lines) {
    ctx.fillText(line, 16, y);
    y += 16;
  }
}

function render(settings) {
  drawBackground();
  drawGround();
  drawWall(settings);
  drawTrain();
  drawLauncher(settings);
  drawTrails(settings.showTrails);
  drawBodies();
  drawEffects();
  drawHud(settings);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.widthPx = rect.width;
  state.heightPx = rect.height;
  state.ppm = state.widthPx / WORLD_WIDTH_M;
  state.worldHeightM = state.heightPx / state.ppm;
  state.groundY = state.worldHeightM - GROUND_THICKNESS_M;
}

function clearDebris() {
  const removedBodyIds = new Set();
  state.bodies = state.bodies.filter((body) => {
    if (body.kind === "projectile") {
      return true;
    }
    removedBodyIds.add(body.id);
    return false;
  });
  pruneFragmentPairCache(removedBodyIds);
}

function resetSimulation() {
  state.bodies.length = 0;
  state.effects.length = 0;
  state.wallBroken = false;
  state.train = null;
  state.shotsFired = 0;
  state.fragmentsSpawned = 0;
  state.trainsSent = 0;
  state.wallsDemolished = 0;
  state.skyObliterations = 0;
  state.maxAltitudeM = 0;
  state.simTime = 0;
  state.fragmentPairHitTime.clear();
  state.autoFireClock = 0;
  state.accumulator = 0;
}

function togglePause() {
  state.paused = !state.paused;
  controls.pauseButton.textContent = state.paused ? "Resume" : "Pause";
}

function triggerPointerShockwave(event) {
  const rect = canvas.getBoundingClientRect();
  const x = mp(event.clientX - rect.left);
  const y = mp(event.clientY - rect.top);

  applyRadialImpulse(x, y, 6.2, 26);
  addShockwaveEffect(x, y, "132,224,255", 0.33, 7.2);
}

function tick(timestamp) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const frameDt = Math.min((timestamp - state.lastTimestamp) / 1000, 0.05);
  state.lastTimestamp = timestamp;

  const settings = getSettings();

  if (!state.paused) {
    if (settings.autoFire) {
      state.autoFireClock += frameDt;
      if (state.autoFireClock >= settings.autoFireInterval) {
        state.autoFireClock = 0;
        launchProjectile();
      }
    } else {
      state.autoFireClock = 0;
    }

    state.accumulator += frameDt * settings.timeScale;

    let steps = 0;
    while (state.accumulator >= state.fixedDt && steps < state.maxSteps) {
      stepPhysics(state.fixedDt, settings);
      state.accumulator -= state.fixedDt;
      steps += 1;
    }

    updateEffects(frameDt * settings.timeScale);
  }

  const targetFps = 1 / Math.max(frameDt, 1e-6);
  state.fps = state.fps + (targetFps - state.fps) * state.fpsSmoothing;

  render(settings);
  requestAnimationFrame(tick);
}

const rangeInputs = [
  controls.speed,
  controls.angle,
  controls.cannonElevation,
  controls.wallDistance,
  controls.wallHeight,
  controls.gravity,
  controls.wind,
  controls.fragmentCount,
  controls.burstPower,
  controls.restitution,
  controls.timeScale,
  controls.autoFireInterval,
  controls.trainSpeed,
];

for (const input of rangeInputs) {
  input.addEventListener("input", updateReadouts);
}

controls.launchButton.addEventListener("click", launchProjectile);
controls.sendTrainButton.addEventListener("click", sendTrain);
controls.pauseButton.addEventListener("click", togglePause);
controls.rebuildWallButton.addEventListener("click", rebuildWall);
controls.clearButton.addEventListener("click", clearDebris);
controls.resetButton.addEventListener("click", resetSimulation);
canvas.addEventListener("pointerdown", triggerPointerShockwave);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    launchProjectile();
  } else if (event.code === "KeyR") {
    event.preventDefault();
    resetSimulation();
  } else if (event.code === "KeyP") {
    event.preventDefault();
    togglePause();
  } else if (event.code === "KeyT") {
    event.preventDefault();
    sendTrain();
  } else if (event.code === "KeyB") {
    event.preventDefault();
    rebuildWall();
  }
});

window.addEventListener("resize", resizeCanvas);

updateReadouts();
resizeCanvas();
requestAnimationFrame(tick);
