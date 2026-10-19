export const LENGTH = 720;
export const STEP = 1 / 60;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  let n = 2166136261;
  for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
export const center = (z) => 27 * Math.sin(z / 74) + 13 * Math.sin(z / 33);
export const tangent = (z) =>
  (27 / 74) * Math.cos(z / 74) + (13 / 33) * Math.cos(z / 33);
export const width = (z) =>
  11 +
  2.5 * Math.sin(z / 59) +
  (z > 290 && z < 355 ? 6 * Math.sin(((z - 290) / 65) * Math.PI) : 0);
const ramp = (z, start, span) => clamp((z - start) / span, 0, 1);
export const surface = (z) =>
  40 - z * 0.021 - 7 * ramp(z, 238, 7) - 11 * ramp(z, 510, 9);
export const inFalls = (z) => (z >= 238 && z < 248) || (z >= 510 && z < 522);
export const island = (x, z) =>
  z > 299 &&
  z < 348 &&
  Math.abs(x - center(z)) < 3.0 * Math.sin(((z - 299) / 49) * Math.PI);
export function bed(x, z) {
  const l = Math.abs(x - center(z)) / width(z);
  return (
    surface(z) -
    Math.max(0.18, 1.5 * (1 - l * l)) +
    0.13 * Math.sin(x * 1.1 + z * 0.3) +
    0.09 * Math.sin(z * 1.5)
  );
}
export function ground(x, z) {
  const d = Math.abs(x - center(z));
  return (
    surface(z) +
    0.55 +
    Math.max(0, d - width(z) - 5) * 0.105 +
    Math.sin(x * 0.17 + z * 0.06) * 0.35
  );
}
export const landmarks = [
  {
    id: "gate",
    name: "Festival Pool",
    z: 18,
    side: 1,
    tag: "The beginning of everything",
    icon: "⚑",
  },
  {
    id: "cathedral",
    name: "Redwood Cathedral",
    z: 105,
    side: 1,
    tag: "A little duck. A very big world.",
    icon: "♧",
  },
  {
    id: "gold",
    name: "Gold Bend",
    z: 182,
    side: 1,
    tag: "There is gold in this quiet water.",
    icon: "✧",
  },
  {
    id: "falls",
    name: "Bridalveil Steps",
    z: 242,
    side: 1,
    tag: "Everyone takes the scenic route.",
    icon: "≋",
  },
  {
    id: "fork",
    name: "Three Sisters Fork",
    z: 320,
    side: 1,
    tag: "Three currents. One questionable decision.",
    icon: "⑂",
  },
  {
    id: "bridge",
    name: "Old Timber Bridge",
    z: 419,
    side: 1,
    tag: "The best seat is above the river.",
    icon: "⌒",
  },
  {
    id: "cascade",
    name: "Grand Cascade",
    z: 517,
    side: 1,
    tag: "Small ducks. Spectacularly large drop.",
    icon: "≋",
  },
  {
    id: "finish",
    name: "Sunset Basin",
    z: 705,
    side: 1,
    tag: "Every duck has a story.",
    icon: "⚑",
  },
];
export const overlooks = [
  { id: "giant", name: "The Sleeping Giant", z: 143, x: 72 },
  { id: "ranger", name: "Lost Ranger Lookout", z: 374, x: 41 },
  { id: "mining", name: "Old Gold Mine", z: 200, x: 69 },
];
export const wildlife = [
  { id: "deer", name: "Black-tailed deer", x: center(130) + 21, z: 130, y: 0 },
  { id: "heron", name: "Great blue heron", x: center(192) - 10, z: 192, y: 0 },
  {
    id: "butterfly",
    name: "Western tiger swallowtail",
    x: center(365) + 16,
    z: 365,
    y: 1.6,
  },
  { id: "otter", name: "River otter", x: center(555) - 8, z: 555, y: 0 },
];
export function conditions(seed, mode) {
  const variants = [
    ["Morning mist", 0.9, 0],
    ["Golden afternoon", 1, 1],
    ["Spring runoff", 1.24, 2],
    ["Autumn light", 0.85, 3],
  ];
  const a =
    mode === "storm"
      ? ["Mountain rain", 1.4, 4]
      : mode === "lantern"
        ? ["Blue-hour lanterns", 0.96, 5]
        : variants[seed % 4];
  return { name: a[0], flow: a[1], style: a[2] };
}
