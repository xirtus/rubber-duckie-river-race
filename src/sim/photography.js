import { landmarks, clamp } from "./course.js";
export function scorePhoto({
  subjects,
  ownedId,
  checkpoint,
  events = [],
  wildlife = [],
  horizon = 0,
}) {
  const visible = subjects.filter(
    (s) =>
      s.visible &&
      s.size > 0.002 &&
      Math.abs(s.x) < 0.92 &&
      Math.abs(s.y) < 0.9,
  );
  const owned = visible.some((s) => s.id === ownedId),
    rare = visible.filter((s) => s.type !== "Classic"),
    framing = visible.length
      ? Math.round(
          100 *
            Math.max(
              ...visible.map((s) =>
                clamp(
                  1 - Math.hypot(Math.abs(s.x) - 0.33, Math.abs(s.y) - 0.2),
                  0,
                  1,
                ),
              ),
            ),
        )
      : 0;
  const breakdown = {
    subject: Math.min(150, visible.length * 12) + (owned ? 100 : 0),
    rarity: Math.min(120, rare.length * 40) + wildlife.length * 70,
    composition:
      framing +
      (visible.length || wildlife.length
        ? Math.round(25 * (1 - Math.min(1, Math.abs(horizon))))
        : 0),
    moment: events.filter((e) => visible.some((s) => s.id === e.duck)).length
      ? 100
      : 0,
    checkpoint: checkpoint && visible.length ? 125 : 0,
  };
  return {
    score: Object.values(breakdown).reduce((a, b) => a + b, 0),
    breakdown,
    duckIds: visible.map((s) => s.id),
    types: [...new Set(visible.map((s) => s.type))],
    owned,
    wildlife,
    checkpoint: breakdown.checkpoint ? checkpoint : null,
  };
}
export function spectatorResult(
  photos,
  discoveries,
  predictionCorrect,
  visibility,
) {
  const checkpoints = new Set(
    photos.filter((p) => p.checkpoint).map((p) => p.checkpoint),
  );
  const points =
    checkpoints.size * 90 +
    Math.min(300, photos.reduce((s, p) => s + p.score, 0) / 5) +
    discoveries.length * 50 +
    (predictionCorrect ? 100 : 0) +
    visibility * 100;
  return {
    grade:
      points >= 950
        ? "S"
        : points >= 650
          ? "A"
          : points >= 380
            ? "B"
            : points >= 150
              ? "C"
              : "D",
    points: Math.round(points),
    checkpoints: checkpoints.size,
    ribbons: [
      ...(checkpoints.size >= 3 ? ["River Photographer"] : []),
      ...(photos.some((p) => p.owned && p.types.length > 1)
        ? ["Odd Ducks Together"]
        : []),
      ...(predictionCorrect ? ["River Oracle"] : []),
      ...(discoveries.length ? ["Off the Beaten Trail"] : []),
      ...(visibility > 0.6 ? ["Faithful Spectator"] : []),
    ],
  };
}
export function checkpointAt(player, ducks) {
  return (
    landmarks.find(
      (l) =>
        Math.abs(player.z - l.z) < 15 &&
        Math.abs(player.x - player.riverX) < 30 &&
        ducks.some((d) => Math.abs(d.z - l.z) < 20 && d.finish === null),
    )?.id || null
  );
}
