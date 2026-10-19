# Third-party materials and code

All downloaded assets are bundled locally. No scraped or trademark-character models are included.

| Component | Creator / source | License | Use |
| --- | --- | --- | --- |
| Three.js 0.184.0 | [Three.js contributors](https://github.com/mrdoob/three.js) | MIT, `node_modules/three/LICENSE` | Renderer, geometry, RGBE loader, Reflector |
| Dryad | [Owen Yuwono](https://github.com/owenyuwono/dryad) | MIT, `src/vendor/dryad/LICENSE` | Genome, skeleton, proportions, roots, foliage anchors, branch geometry, pine preset |
| Poseidon | [Owen Yuwono](https://github.com/owenyuwono/poseidon) | MIT, `src/vendor/poseidon/LICENSE` | Unmodified `diffusionAttenuation` and source documentation from `water.js`; not the FFT engine |
| Pine Bark | [Dimitrios Savva / Poly Haven](https://polyhaven.com/a/pine_bark) | CC0 | 1K scanned color and OpenGL normal textures |
| Forest Ground 04 | [Poly Haven](https://polyhaven.com/a/forest_ground_04) | CC0 | 1K scanned diffuse texture |
| Rock Boulder Dry | [Poly Haven](https://polyhaven.com/a/rock_boulder_dry) | CC0 | 1K diffuse and OpenGL normal textures |
| Pine Tree 01, twig maps only | [Poly Haven](https://polyhaven.com/a/pine_tree_01) | CC0 | 1K scanned needle color and opacity maps; full model not included |
| Kloofendal 43d Clear | [Poly Haven](https://polyhaven.com/a/kloofendal_43d_clear) | CC0 | 1K HDR panorama copied from the existing Dryad asset bundle |
| DM Sans / Libre Caslon Display | [Google Fonts](https://fonts.google.com) | SIL Open Font License, served by Google Fonts | Optional interface fonts; system fallbacks work without network |

Powered by Poly Haven. Asset metadata was retrieved from its public API during development; the game does not call that API.

The optical coefficients retain Poseidon's documentation of Solonenko & Mobley (2015), *Inherent optical properties of Jerlov water types*. These coastal-water coefficients are an artistic approximation for this freshwater river, not a claim of measured site-specific water chemistry.

Duck and wildlife meshes, props, terrain, interface, and gameplay code were authored for this project. The current redwood-scale trees are derived procedural conifers, not botanical scans of Sequoia sempervirens.

Potential future hero redwood: [kungphil's Coastal redwood from Grove of Old Trees](https://sketchfab.com/3d-models/coastal-redwood-from-grove-of-old-trees-5c249b3973734f21a0a3e0bab97c182c), advertised CC Attribution. It has not been downloaded or bundled. A noncommercial-only redwood scan was excluded. The Poly Haven pine model's mesh is approximately 949 MB, so only its licensed foliage maps are used here.
