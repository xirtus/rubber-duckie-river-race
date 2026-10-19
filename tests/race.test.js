import test from "node:test";
import assert from "node:assert/strict";
import { Race } from "../src/sim/race.js";
import { snapshot } from "../src/presentation/snapshot.js";
import { scorePhoto, spectatorResult } from "../src/sim/photography.js";
import { hash } from "../src/sim/course.js";

test("same seed reproduces the entire race and both waterfall crossings", () => {
  const a = new Race(1842),
    b = new Race(1842);
  while (!a.done && a.tick < 36000) {
    a.step();
    b.step();
  }
  assert.equal(a.finished.length, 100);
  assert.deepEqual(a.ducks, b.ducks);
  assert.deepEqual(a.finished, b.finished);
  assert.equal(new Set(a.finished).size, 100);
  assert.ok(a.ducks.every((d) => d.falls === 2));
  assert.deepEqual(
    new Set(a.ducks.map((d) => d.fork)),
    new Set(["left", "right"]),
  );
  assert.ok(a.ducks.some((d) => d.eddyTime > 1));
  const finishes = a.finished.map((id) => a.ducks[id - 1].finish);
  assert.deepEqual(
    finishes,
    [...finishes].sort((a, b) => a - b),
  );
});
test("presentation and spectator activity cannot mutate race truth", () => {
  const a = new Race(1234),
    b = new Race(1234);
  for (let i = 0; i < 1200; i++) {
    a.step();
    b.step();
    if (i % 40 === 0) {
      const s = snapshot(a);
      s.ducks[0].x = 9999;
      s.finished.push(47);
      s.weather.flow = 0;
      scorePhoto({ subjects: [], ownedId: 37 });
    }
  }
  assert.deepEqual(a.ducks, b.ducks);
  assert.deepEqual(a.water.u, b.water.u);
});
test("cosmetics and selecting another duck have identical physics", () => {
  const a = new Race(901),
    b = new Race(901);
  b.ducks.forEach((d) => (d.type = "Pirate"));
  for (let i = 0; i < 1200; i++) {
    a.step();
    b.step();
  }
  assert.deepEqual(
    a.ducks.map(({ type, ...d }) => d),
    b.ducks.map(({ type, ...d }) => d),
  );
  assert.equal(a.ducks.filter((d) => d.type !== "Classic").length, 10);
});
test("five seeds and all alternate formats finish with finite state", () => {
  for (const [seed, mode] of [
    [12345, "classic"],
    [42, "classic"],
    [777, "classic"],
    [9876, "classic"],
    [hash("2026-09-05"), "daily"],
    [873, "storm"],
    [733, "derby"],
    [345, "mystery"],
    [42, "lantern"],
  ]) {
    const r = new Race(seed, mode);
    while (!r.done && r.tick < 42000) r.step();
    assert.ok(r.done, `${seed}/${mode}: ${r.finished.length} finishers`);
    assert.ok(
      r.ducks.every((d) => [d.x, d.z, d.y, d.finish].every(Number.isFinite)),
    );
    assert.equal(r.ducks.length, mode === "derby" ? 150 : 100);
  }
});
test("photographs reward visible subjects and live checkpoints deterministically", () => {
  const frame = {
    ownedId: 37,
    checkpoint: "falls",
    subjects: [
      { id: 37, type: "Classic", visible: true, x: 0.3, y: 0.2, size: 0.03 },
      { id: 92, type: "Pirate", visible: true, x: -0.3, y: 0.1, size: 0.02 },
    ],
    events: [{ duck: 37, type: "waterfall" }],
  };
  assert.deepEqual(scorePhoto(frame), scorePhoto(frame));
  const good = scorePhoto(frame);
  assert.ok(good.score > 400);
  assert.equal(good.breakdown.checkpoint, 125);
  assert.ok(good.owned);
  const blank = scorePhoto({ ...frame, subjects: [] });
  assert.equal(blank.score, 0);
  assert.equal(blank.checkpoint, null);
  const hidden = scorePhoto({
    ...frame,
    subjects: frame.subjects.map((s) => ({ ...s, visible: false })),
  });
  assert.equal(hidden.score, 0);
});
test("spectator grade depends on spectator achievements, not duck rank", () => {
  const photos = ["a", "b", "c", "d", "e", "f", "g", "h"].map((checkpoint) => ({
    checkpoint,
    score: 500,
    owned: true,
    types: ["Classic", "Pirate"],
  }));
  assert.equal(spectatorResult(photos, ["giant"], true, 0.8).grade, "S");
});
