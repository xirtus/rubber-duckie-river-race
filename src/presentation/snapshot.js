// Renderer receives copies; it has no mutable references to authoritative ducks.
export function snapshot(race) {
  return {
    tick: race.tick,
    time: race.time,
    seed: race.seed,
    mode: race.mode,
    weather: { ...race.weather },
    finished: [...race.finished],
    done: race.done,
    ducks: race.ducks.map((d) => ({ ...d })),
    events: race.events.map((e) => ({ ...e })),
  };
}
