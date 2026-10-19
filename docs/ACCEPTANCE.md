# V2 acceptance audit

This audit separates implemented behavior from the larger production design. The two original HTML design documents remain authoritative for the intended final product.

## Implemented and tested

- Seeded fixed-step race; 100 standardized duck bodies; approximately 10% novelty visuals.
- Simulation/presentation separation, deterministic full-run replay, authoritative ranking and finish order.
- Player movement never affects the race.
- Free two-dimensional river advection, obstacle and duck collisions, eddies, two-channel island fork, and two waterfall crossings.
- First-person bank traversal, sprint, jump, two timber bridges, named checkpoints, hidden overlook discovery.
- Non-pausing photography, real framebuffer images, deterministic score breakdown, actual-shot finish scrapbook, persistent album/favorites/download.
- Spectator assignments, one fork prediction per race, Duck Book, four wildlife entries, discoveries, stamps/ribbons, spectator grades independent of duck placement.
- Daily UTC seeds, same-seed traversal ghost, Classic/Mystery/Storm/Derby/Lantern formats. Lantern unlocks after the first completed race.
- Bundled licensed materials, source manifests, flow vectors and basic render/physics diagnostics.

## Partial or simplified

- Hydraulics: precomputed slope/discharge/obstacle field plus analytic unsteady vortices. No mass conservation or shallow-water PDE integration.
- Water optics: actual scene reflections and reused Poseidon attenuation; no WebGPU FFT, screen-space refraction, full volumetric fluid, or GPU spray solver.
- Environment: 720 m winding river, procedural Dryad conifers scaled to large trees, scanned material maps. Not the folded 2 km Yosemite course or hero redwood scans.
- Wildlife and ducks: original simple geometry; no downloaded hero models. Wildlife has limited animation.
- Camera scoring: terrain and trunk proxies reject occluded subjects; no pixel-accurate foliage/duck visibility or full cinematic-event taxonomy.
- Weather: flow, exposure, fog, and light vary. Storm currently lacks rain particles; Lantern lacks a fully authored lantern festival.
- Audio: filtered procedural river ambience with distance-based waterfall volume; no full spatial wildlife/footstep library.
- Ghost: recorded one-second traversal samples and translucent runner. No player-command replay or competitive online leaderboard.
- Routes: bank trails and bridges, with discoverable side areas; no mature shortcut graph, vaulting, scrambling, or route-efficiency scoring.

## Outstanding production gates

- Full conservative shallow-water solver and localized SPH/volumetric waterfall zones.
- Scanned hero redwood acquisition, legal downloaded duck roster, child rig, animation normalization/Mixamo, third-person animation director.
- Truly folded 1.5–2 km course with 16 scenic cells and three genuine fork channels.
- Additional distinct rivers and event-specific art/lighting, deeper predictions/assignments and Duck Book stats.
- Cell streaming, per-tree LOD/impostors, GPU timing, sustained 60 FPS qualification and long-run memory profiling.
- 3JSE/Atlas package integration, command-stream replay, accessibility and wider hardware/browser testing.

No production-quality or Unreal-level visual parity claim is made for this implementation.
