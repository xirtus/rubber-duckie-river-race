# Architecture

`sim/course.js` defines the continuous terrain, bed, water surface, landmarks, and seeded weather. The authored obstacle layout has a separate fixed course seed. Race seeds affect release positions and weather. `sim/flow.js` samples a 2 m Eulerian depth and velocity grid with time-varying eddies; obstacle pressure terms and bed slope affect the field. This is an explicit reduced approximation, not a numerically solved conservation law.

`sim/race.js` owns duck truth. At 60 Hz it integrates linear water drag, collision impulses, vertical buoyancy springs, and gravity during water separation. Ducks have free x/z positions. No spline parameter, player position, photograph, prediction, renderer object, or selected duck ID enters the solver. Spatial hashing resolves identical circular collision proxies in stable ID order. Crossings have sub-tick timestamps, sorted with stable ID ties. Rank uses finish state and downstream progress, never visuals.

`presentation/snapshot.js` copies simulation state. `render3d/world.js` consumes those copies. Water surface detail samples a GPU upload of the same depth/current grid. Foam particles sample flow, but are presentation only. A local planar reflection provides actual scene reflections; the HDR panorama handles distant reflections. The descending surface approximation means planar reflections are most correct near the observer.

`sim/photography.js` is DOM/GPU-free. Scoring uses projected subject position/size, visible IDs, novelty types, active event facts, nearby live checkpoint, and wildlife. The render adapter checks terrain height and trunk proxies for line of sight. It does not perform pixel-perfect leaf/duck occlusion. Photos store JPEG image, race seed, simulation tick, camera pose, IDs, tags, and component scores. The score is reproducible from those facts.

`ui/storage.js` uses IndexedDB for image data and localStorage for lightweight collections, race summaries, and the last ten seeded traversal ghosts. Every shutter saves its actual image immediately, even if the race is later abandoned. There is no network sync. Favorite status changes only metadata. Finished race records retain photo IDs.

The application uses Vite. This new directory contained no running harness or game package. The simulation/presentation/render boundaries follow the v2 contract; integration into the neighboring 3JSE/Atlas monorepo is not implemented.

Runtime graphics target WebGL 2 so the game runs in existing desktop browsers. Poseidon's FFT/WebGPU implementation is not bundled; its MIT optical helper is. The physical field and renderer are replaceable independently when a full shallow-water solver and WebGPU water pipeline are introduced.
