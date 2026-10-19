import {
  center,
  width,
  tangent,
  surface,
  bed,
  island,
  inFalls,
  clamp,
  rng,
} from "./course.js";

// A terrain-derived Eulerian hydraulic field, independent of duck positions.
// This is a reduced flow model, not a full Navier–Stokes/SPH solver. The grid
// stores depth and velocity; local potential gradients, channel discharge,
// obstacle deflection and unsteady vortices determine the sampled current.
export class RiverFlow {
  constructor(seed, flow = 1) {
    this.flow = flow;
    this.dx = 2;
    this.nx = 81;
    this.nz = 381;
    this.x0 = -80;
    this.z0 = -20;
    const n = this.nx * this.nz;
    this.depth = new Float32Array(n);
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
    // The authored river has its own seed. Race-day seeds change the release
    // and conditions, not the rendered obstacle geometry.
    const r = rng(1842 ^ 0xa730);
    this.rocks = [];
    for (let i = 0; i < 55; i++) {
      const z = 55 + r() * 620;
      if (inFalls(z) || (z > 280 && z < 365)) continue;
      const rock = {
        x: center(z) + (r() - 0.5) * width(z) * 1.25,
        z,
        r: 0.65 + r() * 0.8,
      };
      if (
        this.rocks.some(
          (o) => Math.hypot(o.x - rock.x, o.z - rock.z) < o.r + rock.r + 2.5,
        )
      )
        continue;
      this.rocks.push(rock);
    }
    this.eddies = [
      { x: center(150) - width(150) * 0.66, z: 150, r: 4.5 },
      { x: center(380) + width(380) * 0.64, z: 380, r: 4.1 },
      { x: center(575) - width(575) * 0.55, z: 575, r: 4.2 },
    ];
    for (let j = 0; j < this.nz; j++)
      for (let i = 0; i < this.nx; i++) {
        const x = this.x0 + i * this.dx,
          z = this.z0 + j * this.dx,
          k = j * this.nx + i,
          d = (x - center(z)) / width(z);
        if (Math.abs(d) > 1 || island(x, z)) continue;
        this.depth[k] = Math.max(0.15, surface(z) - bed(x, z));
        const slope = Math.max(0.005, (surface(z - 1) - surface(z + 1)) / 2);
        const speed =
          clamp(Math.sqrt((9.81 * this.depth[k] * slope) / 0.033), 0.8, 7) *
          flow *
          (1 - 0.34 * Math.pow(Math.abs(d), 4));
        let vz = speed / Math.sqrt(1 + tangent(z) ** 2),
          vx = vz * tangent(z);
        // Pressure from curved banks and the island acts on water, never on ranks.
        vx -= d * Math.pow(Math.abs(d), 6) * 1.1;
        if (z > 290 && z < 350) {
          const local = x - center(z);
          vx +=
            Math.sign(local || 0.01) *
            Math.exp((-local * local) / 26) *
            Math.sin(((z - 290) / 60) * Math.PI) *
            2;
        }
        for (const rock of this.rocks) {
          const ax = x - rock.x,
            az = z - rock.z,
            dist = Math.hypot(ax, az);
          if (dist < rock.r + 4) {
            const force = Math.exp((-dist * dist) / 7) * 2.2;
            vx += (ax / Math.max(0.2, dist)) * force;
            vz += (az / Math.max(0.2, dist)) * force;
          }
        }
        this.u[k] = vx;
        this.v[k] = vz;
      }
  }
  sample(x, z, t = 0) {
    const fx = clamp((x - this.x0) / 2, 0, this.nx - 1.001),
      fz = clamp((z - this.z0) / 2, 0, this.nz - 1.001),
      i = Math.floor(fx),
      j = Math.floor(fz),
      a = fx - i,
      b = fz - j,
      k = j * this.nx + i;
    const lerp = (f) =>
      (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) +
      (f[k + this.nx] * (1 - a) + f[k + this.nx + 1] * a) * b;
    let u = lerp(this.u),
      v = lerp(this.v);
    const depth = lerp(this.depth);
    for (const e of this.eddies) {
      const dx = x - e.x,
        dz = z - e.z,
        q = Math.exp(-(dx * dx + dz * dz) / (e.r * e.r)),
        strength = (1.1 + 0.8 * Math.sin(t * 0.19 + e.z)) * q;
      u += -dz * 0.65 * strength;
      v = v * (1 - q * 0.85) + dx * 0.65 * strength;
    }
    u += 0.46 * Math.sin(z * 0.31 + t * 0.8) * Math.sin(x * 0.52 - t * 0.3);
    v += 0.22 * Math.sin(x * 0.4 + t * 0.65);
    return {
      u,
      v,
      depth,
      height: surface(z) + 0.038 * Math.sin(x * 1.7 + z * 1.1 - t * 3),
      foam: clamp((Math.hypot(u, v) - 2.3) * 0.25 + (inFalls(z) ? 1 : 0), 0, 1),
    };
  }
}
