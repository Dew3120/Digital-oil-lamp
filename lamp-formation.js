const TAU = Math.PI * 2;
const PERIOD = 6000;
const DECELERATION = 1200;
const ORBIT_VELOCITY = .00027;
const EPSILON = 1e-7;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const modulo = (value, modulus) => ((value % modulus) + modulus) % modulus;

function pointOnBezier(points, t) {
  const q = 1 - t;
  return {
    x: q * q * q * points[0].x + 3 * q * q * t * points[1].x + 3 * q * t * t * points[2].x + t * t * t * points[3].x,
    y: q * q * q * points[0].y + 3 * q * q * t * points[1].y + 3 * q * t * t * points[2].y + t * t * t * points[3].y
  };
}

function makeLane({ side, width, centerX, centerY, radius, lampWidth }) {
  const mouthX = centerX + side * radius;
  const startX = side < 0 ? -lampWidth - 28 : width + lampWidth + 28;
  // The two lanes remain outside the ring. Their final tangents match its
  // clockwise velocity: upward on the left and downward on the right.
  const points = [
    { x: startX, y: centerY - side * radius * .8 },
    { x: mouthX + (startX - mouthX) * .28, y: centerY - side * radius * .8 },
    { x: mouthX, y: centerY - side * radius * .42 },
    { x: mouthX, y: centerY }
  ];
  const table = [{ t: 0, distance: 0, ...points[0] }];
  let length = 0, previous = points[0];
  // Arc-length sampling makes every lamp follow the same lane at the same
  // speed. Easing each lamp separately would compress or reorder the queue.
  for (let sample = 1; sample <= 160; sample++) {
    const t = sample / 160, point = pointOnBezier(points, t);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    table.push({ t, distance: length, ...point });
    previous = point;
  }
  return { points, table, length };
}

function sampleLane(lane, distance) {
  const target = clamp(distance, 0, lane.length);
  let low = 0, high = lane.table.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (lane.table[middle].distance <= target) low = middle;
    else high = middle;
  }
  const a = lane.table[low], b = lane.table[high];
  const fraction = (target - a.distance) / Math.max(EPSILON, b.distance - a.distance);
  return pointOnBezier(lane.points, a.t + (b.t - a.t) * fraction);
}

function allocateJoiningSlots(count, leftCount, velocity) {
  const base = leftCount === 0 ? 0 : Math.PI;
  const candidates = Array.from({ length: count }, (_, ordinal) => {
    const phase = base - TAU * ordinal / count;
    const leftTime = modulo((Math.PI - phase) / velocity, PERIOD);
    const rightTime = modulo(-phase / velocity, PERIOD);
    return { ordinal, phase, leftTime, rightTime };
  });
  const times = [...new Set(candidates.flatMap(item => [item.leftTime, item.rightTime]))].sort((a, b) => a - b);
  // Find the earliest time at which the two mouths can fill all N uniform
  // slots with the requested left/right counts, including odd lamp counts.
  const cutoff = times.find(time => {
    if (candidates.some(item => item.leftTime > time + EPSILON && item.rightTime > time + EPSILON)) return false;
    const mandatory = candidates.filter(item => item.rightTime > time + EPSILON).length;
    const eligible = candidates.filter(item => item.leftTime <= time + EPSILON).length;
    return mandatory <= leftCount && leftCount <= eligible;
  }) ?? PERIOD;
  const left = candidates.filter(item => item.rightTime > cutoff + EPSILON);
  const optional = candidates.filter(item => !left.includes(item) && item.leftTime <= cutoff + EPSILON).sort((a, b) => a.leftTime - b.leftTime);
  for (const item of optional) {
    if (left.length >= leftCount) break;
    left.push(item);
  }
  const right = candidates.filter(item => !left.includes(item));
  return {
    left: left.sort((a, b) => a.leftTime - b.leftTime),
    right: right.sort((a, b) => a.rightTime - b.rightTime),
    duration: cutoff
  };
}

/** Build one uniform circle with two independent, collision-free entrance lanes. */
export function createLampFormation({ width, height, rowCounts = [3, 3, 3] }) {
  const W = Math.max(1, Number(width) || 1), H = Math.max(1, Number(height) || 1);
  let rows = rowCounts.map(count => Math.max(0, Math.floor(Number(count) || 0)));
  if (!rows.some(Boolean)) rows = [1];
  const sources = rows.flatMap((count, row) => Array.from({ length: count }, () => ({ row, side: row % 2 === 0 ? -1 : 1 })));
  const count = sources.length;
  const centerX = W / 2, centerY = H * .34;
  const radius = Math.min(H * .285, W * .35);
  const chord = count > 1 ? 2 * radius * Math.sin(Math.PI / count) : Infinity;
  const lampDiameter = Math.min(100, H * .13, radius * .48, chord * .78);
  const lampWidth = lampDiameter * .8, lampHeight = lampDiameter * .6;
  const angularVelocity = TAU / PERIOD, laneVelocity = angularVelocity * radius;
  const lanes = {
    left: makeLane({ side: -1, width: W, centerX, centerY, radius, lampWidth }),
    right: makeLane({ side: 1, width: W, centerX, centerY, radius, lampWidth })
  };
  for (const lane of Object.values(lanes)) lane.duration = lane.length / laneVelocity;
  const preRoll = Math.max(1400, ...Object.values(lanes).map(lane => lane.duration)) + 120;
  const allocation = allocateJoiningSlots(count, sources.filter(source => source.side < 0).length, angularVelocity);
  const cursor = { left: 0, right: 0 };
  const lamps = sources.map((source, index) => {
    const name = source.side < 0 ? 'left' : 'right';
    const slot = allocation[name][cursor[name]++], lane = lanes[name];
    const joinTime = preRoll + (name === 'left' ? slot.leftTime : slot.rightTime);
    return { index, row: source.row, side: source.side, ordinal: slot.ordinal, phase: slot.phase, joinTime, startTime: joinTime - lane.duration, lane };
  });
  const gatherDuration = preRoll + allocation.duration;
  const phase = elapsed => {
    const time = Math.max(0, Number(elapsed) || 0);
    if (time <= gatherDuration) return angularVelocity * (time - preRoll);
    const deceleration = Math.min(DECELERATION, time - gatherDuration);
    const u = deceleration / DECELERATION;
    const integratedEase = DECELERATION * (u * u * u - .5 * u * u * u * u);
    return angularVelocity * (gatherDuration - preRoll)
      + angularVelocity * deceleration
      + (ORBIT_VELOCITY - angularVelocity) * integratedEase
      + ORBIT_VELOCITY * Math.max(0, time - gatherDuration - DECELERATION);
  };
  return { width: W, height: H, count, centerX, centerY, radius, chord, lampDiameter, lampWidth, lampHeight, logoDiameter: radius * 1.38,
    preRoll, gatherDuration, angularVelocity, orbitVelocity: ORBIT_VELOCITY, decelerationDuration: DECELERATION, lamps, lanes, phase };
}

/** Coordinates are bowl centers relative to the ceremony screen. */
export function sampleLampFormation(plan, index, elapsed) {
  const item = plan.lamps[index];
  if (!item) return { x: plan.centerX, y: plan.centerY, opacity: 0, scale: 1, joined: false, side: 0 };
  const time = Math.max(0, Number(elapsed) || 0);
  if (time < item.startTime) return { ...item.lane.points[0], opacity: 0, scale: 1, joined: false, side: item.side };
  if (time < item.joinTime) {
    const distance = (time - item.startTime) * plan.angularVelocity * plan.radius;
    const point = sampleLane(item.lane, distance);
    // Fade entirely within the offscreen portion, before entering the view.
    const fadeLength = Math.max(12, plan.lampWidth * .6);
    return { ...point, opacity: smooth(distance / fadeLength), scale: 1, joined: false, side: item.side };
  }
  const angle = item.phase + plan.phase(time);
  return { x: plan.centerX + Math.cos(angle) * plan.radius, y: plan.centerY + Math.sin(angle) * plan.radius,
    opacity: 1, scale: 1, joined: true, side: item.side };
}
