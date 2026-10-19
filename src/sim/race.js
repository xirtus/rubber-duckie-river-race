import {
  rng,
  STEP,
  LENGTH,
  center,
  width,
  surface,
  inFalls,
  island,
  conditions,
  clamp,
} from "./course.js";
import { RiverFlow } from "./flow.js";
export const DUCK_TYPES = [
  "Classic",
  "Explorer",
  "Pirate",
  "Rose",
  "Moonbeam",
  "Mallard",
  "Lavender",
  "Astronaut",
  "Golden",
  "Midnight",
  "Captain",
];
export class Race {
  constructor(seed = 1842, mode = "classic") {
    this.seed = seed >>> 0;
    this.mode = mode;
    this.tick = 0;
    this.time = 0;
    this.finished = [];
    this.events = [];
    this.weather = conditions(seed, mode);
    this.water = new RiverFlow(seed, this.weather.flow);
    const random = rng(seed ^ 0xface),
      count = mode === "derby" ? 150 : 100;
    this.ducks = Array.from({ length: count }, (_, i) => {
      const z = 8 - Math.floor(i / 10) * 1.35,
        x = center(z) + ((i % 10) - 4.5) * 1.25 + (random() - 0.5) * 0.3;
      return {
        id: i + 1,
        type: i >= count * 0.9 ? DUCK_TYPES[1 + (i % 10)] : "Classic",
        x,
        z,
        y: surface(z) + 0.18,
        vx: 0,
        vz: 0,
        vy: 0,
        yaw: random() * 6.28,
        roll: 0,
        finish: null,
        rank: i + 1,
        bumps: 0,
        spins: 0,
        eddyTime: 0,
        falls: 0,
        falling: false,
        fork: null,
        best: count,
        worst: 1,
      };
    });
  }
  step() {
    this.tick++;
    this.time = this.tick * STEP;
    const crossings = [];
    for (const d of this.ducks) {
      if (d.finish !== null) continue;
      const prev = d.z,
        f = this.water.sample(d.x, d.z, this.time),
        oldYaw = d.yaw;
      d.vx += (f.u - d.vx) * 1.7 * STEP;
      d.vz += (f.v - d.vz) * 1.7 * STEP;
      d.x += d.vx * STEP;
      d.z += d.vz * STEP;
      const edge = width(d.z) - 0.42,
        offset = d.x - center(d.z);
      if (Math.abs(offset) > edge) {
        d.x = center(d.z) + Math.sign(offset) * edge;
        d.vx = -d.vx * 0.3;
        d.bumps++;
      }
      if (island(d.x, d.z)) {
        const side = Math.sign(d.x - center(d.z)) || 1;
        d.x =
          center(d.z) +
          side * (3 * Math.sin(((d.z - 299) / 49) * Math.PI) + 0.45);
        d.vx = side * Math.abs(d.vx) * 0.5;
      }
      if (prev < 325 && d.z >= 325)
        d.fork = d.x < center(d.z) ? "left" : "right";
      for (const r of this.water.rocks) {
        const dx = d.x - r.x,
          dz = d.z - r.z,
          dist = Math.hypot(dx, dz),
          min = r.r + 0.38;
        if (dist < min) {
          const nx = dist > 1e-6 ? dx / dist : 1,
            nz = dist > 1e-6 ? dz / dist : 0;
          d.x = r.x + nx * min;
          d.z = r.z + nz * min;
          const v = d.vx * nx + d.vz * nz;
          if (v < 0) {
            d.vx -= v * nx * 1.4;
            d.vz -= v * nz * 1.4;
            d.bumps++;
          }
        }
      }
      const target = surface(d.z) + 0.2;
      for (const lip of [238, 510])
        if (prev < lip && d.z >= lip && (!d.lastFall || lip > d.lastFall)) {
          d.falls++;
          d.lastFall = lip;
          this.events.push({ tick: this.tick, type: "waterfall", duck: d.id });
        }
      if (d.y - target > 0.45) {
        d.falling = true;
        d.vy -= 9.81 * STEP;
        d.y += d.vy * STEP;
        d.roll += STEP * 3;
      } else {
        d.falling = false;
        d.vy += (target - d.y) * 38 * STEP - d.vy * 7 * STEP;
        d.y += d.vy * STEP;
        d.roll = Math.sin(this.time * 3 + d.id) * 0.065;
      }
      if (d.y < target - 0.25) {
        d.y = target - 0.25;
        d.vy = Math.abs(d.vy) * 0.18;
      }
      d.yaw = Math.atan2(d.vx, d.vz) + Math.sin(this.time + d.id) * 0.14;
      d.spins +=
        Math.abs(
          Math.atan2(Math.sin(d.yaw - oldYaw), Math.cos(d.yaw - oldYaw)),
        ) /
        Math.PI /
        2;
      if (Math.hypot(d.vx, d.vz) < 1) d.eddyTime += STEP;
      if (d.z >= LENGTH) {
        crossings.push({
          d,
          time:
            (this.tick -
              1 +
              clamp((LENGTH - prev) / Math.max(1e-9, d.z - prev), 0, 1)) *
            STEP,
        });
      }
    }
    // Stable spatial hashing keeps collision order independent of presentation.
    const bins = new Map();
    for (const d of this.ducks) {
      if (d.finish !== null) continue;
      const bx = Math.floor(d.x),
        bz = Math.floor(d.z);
      for (let iz = bz - 1; iz <= bz + 1; iz++)
        for (let ix = bx - 1; ix <= bx + 1; ix++) {
          for (const o of bins.get(`${ix},${iz}`) || []) {
            const dx = d.x - o.x,
              dz = d.z - o.z,
              dist = Math.hypot(dx, dz);
            if (dist < 0.73) {
              const nx = dist > 1e-8 ? dx / dist : 1,
                nz = dist > 1e-8 ? dz / dist : 0,
                p = (0.73 - dist) * 0.5;
              d.x += nx * p;
              d.z += nz * p;
              o.x -= nx * p;
              o.z -= nz * p;
              const vel = (d.vx - o.vx) * nx + (d.vz - o.vz) * nz;
              if (vel < 0) {
                d.vx -= vel * nx * 0.6;
                d.vz -= vel * nz * 0.6;
                o.vx += vel * nx * 0.6;
                o.vz += vel * nz * 0.6;
                d.bumps++;
                o.bumps++;
              }
            }
          }
        }
      const key = `${bx},${bz}`;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(d);
    }
    crossings.sort((a, b) => a.time - b.time || a.d.id - b.d.id);
    for (const { d, time } of crossings) {
      d.finish = time;
      d.z = LENGTH;
      this.finished.push(d.id);
    }
    const ranked = [...this.ducks].sort((a, b) =>
      a.finish !== null && b.finish !== null
        ? a.finish - b.finish || a.id - b.id
        : a.finish !== null
          ? -1
          : b.finish !== null
            ? 1
            : b.z - a.z || a.id - b.id,
    );
    ranked.forEach((d, i) => {
      const last = d.rank;
      d.rank = i + 1;
      d.best = Math.min(d.best, d.rank);
      d.worst = Math.max(d.worst, d.rank);
      if (last - d.rank >= 3 && this.tick % 30 === 0)
        this.events.push({ tick: this.tick, type: "overtake", duck: d.id });
    });
    this.events = this.events.filter((e) => this.tick - e.tick < 180);
  }
  get done() {
    return this.finished.length === this.ducks.length;
  }
}
