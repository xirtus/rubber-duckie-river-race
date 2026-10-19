# Verification — 2026-09-05

- `npm test`: **6/6 passed**. Full deterministic replay; identical physics despite cosmetic changes; immutable presentation boundary; all 100/150 ducks finished across tested seeds and alternate formats; both waterfall crossings; both island channels; deterministic photo scoring; S-grade spectator achievements independent of duck finish.
- `npm run build`: **passed**. Vite reports the usual large JavaScript chunk advisory (~668 KB minified, ~183 KB gzip). Static output is in `dist/`.
- `scripts/full-playtest.mjs`: **passed** in Brave/Chromium. Normal keyboard walking moved the player; Daily format selected; prediction submitted; photograph did not pause ticks; actual image appeared in album; favorite saved; five scenic views rendered; race completed; finish scrapbook used the saved image; photo/favorite/Duck Book persisted after reload; mobile start screen remained usable. No page or console errors.
- End-to-end fixture: owned duck finished **48/100**; one photograph earned **C** spectator grade and **1/8** checkpoints. This checks integration, not the quality of a skilled player's album.
- Grand Cascade scene telemetry: **245 draw calls, 4,279,976 triangles, 311 geometries, 27 textures** reported by Three.js. These are scene diagnostics, not GPU timing or a 60 FPS certification.

The development test harness advances the same authoritative simulation to scenic fixtures; it does not inject finish results or artificial photographs. Full-playtest captures are in `/tmp/duck-*.png`; representative mobile and scrapbook captures are retained in `docs/screenshots/`.

See [ACCEPTANCE.md](ACCEPTANCE.md) for the production gates still outstanding. Passing these tests does not establish full fluid realism, photoreal visual quality, or cross-device performance.
