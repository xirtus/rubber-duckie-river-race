import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { resolve } from "../vendor/dryad/genome.js";
import { PRESETS } from "../vendor/dryad/presets.js";
import { buildBranchGeometry } from "../vendor/dryad/branchMesh.js";
import { diffusionAttenuation } from "../vendor/poseidon/water.js";
import {
  LENGTH,
  center,
  width,
  surface,
  ground,
  bed,
  landmarks,
  overlooks,
  wildlife,
  rng,
  clamp,
} from "../sim/course.js";

const V = THREE.Vector3,
  dummy = new THREE.Object3D(),
  color = new THREE.Color();
const mat = (c, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color: c, roughness });
function mesh(geo, material, x = 0, y = 0, z = 0, scale) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function texture(path, repeat = 1) {
  const t = new THREE.TextureLoader().load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function ribbon(min, max, step, columns, fn) {
  const p = [],
    uv = [],
    idx = [],
    colors = [];
  for (let z = min, k = 0; z <= max + 0.001; z += step, k++) {
    for (let j = 0; j <= columns; j++) {
      const v = fn(z, j / columns);
      p.push(v[0], v[1], z);
      uv.push(v[0] * 0.17, z * 0.17);
      if (v[2]) colors.push(...v[2]);
      if (k && j) {
        const a = k * (columns + 1) + j;
        idx.push(
          a,
          a - columns - 2,
          a - 1,
          a,
          a - columns - 1,
          a - columns - 2,
        );
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (colors.length)
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function signTexture(title, subtitle) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#183f36";
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = "#d4c69a";
  ctx.lineWidth = 3;
  ctx.strokeRect(9, 9, 494, 142);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f6edce";
  ctx.font = "bold 31px Georgia";
  ctx.fillText(title, 256, 66);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#bfcab2";
  ctx.fillText(subtitle, 256, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export class World {
  constructor(canvas, water) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#aec8c4");
    this.scene.fog = new THREE.FogExp2("#b8cbb9", 0.0042);
    this.camera = new THREE.PerspectiveCamera(
      64,
      innerWidth / innerHeight,
      0.1,
      2200,
    );
    this.camera.rotation.order = "YXZ";
    this.scene.add(new THREE.HemisphereLight("#d5eaf1", "#5c6340", 2.1));
    this.sun = new THREE.DirectionalLight("#fff1cf", 3.2);
    this.sun.position.set(-80, 160, 140);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -85,
      right: 85,
      top: 85,
      bottom: -85,
      near: 1,
      far: 420,
    });
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun, this.sun.target);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.trees = [];
    this.forestChunks = [];
    this.duckMeshes = [];
    this.time = 0;
    this.makeTerrain(water);
    this.makeForest();
    this.makeProps(water);
    this.makeWater();
    this.makeDucks();
    this.makeParticles();
    this.makeWildlife();
    new RGBELoader().load("/assets/forest-sky.hdr", (t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = t;
      this.scene.background = t;
      this.scene.backgroundBlurriness = 0.06;
      this.scene.backgroundIntensity = 0.8;
      this.waterMaterial.uniforms.panorama.value = t;
      this.waterMaterial.uniforms.hasSky.value = 1;
    });
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.6, 4),
      new THREE.MeshBasicMaterial({ color: "#ffe77e" }),
    );
    this.marker.rotation.z = Math.PI;
    this.root.add(this.marker);
    this.marker.visible = false;
    window.addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }
  makeTerrain(water) {
    const soil = texture("/assets/ground.jpg");
    const material = mat("#8c9470");
    material.map = soil;
    material.vertexColors = true;
    const terrain = ribbon(-140, 840, 2, 180, (z, t) => {
      const x = -240 + t * 480,
        d = Math.abs(x - center(z)),
        h = d < width(z) ? bed(x, z) : ground(x, z),
        c = new THREE.Color(
          d < width(z) ? "#7b8170" : d < width(z) + 6 ? "#b9ab8c" : "#a2aa88",
        );
      c.multiplyScalar(0.85 + 0.15 * Math.sin(x * 0.16 + z * 0.2));
      return [x, h, [c.r, c.g, c.b]];
    });
    this.root.add(mesh(terrain, material));
    const trailMat = mat("#bbaa7d");
    trailMat.map = soil;
    for (const side of [-1, 1]) {
      const g = ribbon(-10, 760, 2, 2, (z, t) => {
        const x = center(z) + side * (width(z) + 4.5) + (t - 0.5) * 2.4;
        return [x, ground(x, z) + 0.08];
      });
      this.root.add(mesh(g, trailMat));
    }
    const stone = mat("#bbc0b7");
    stone.map = texture("/assets/rock.jpg", 2);
    stone.normalMap = texture("/assets/rock-normal.jpg", 2);
    stone.normalMap.colorSpace = THREE.NoColorSpace;
    stone.normalScale.set(1.2, 1.2);
    const r = rng(33);
    this.rockMaterial = stone;
    for (let i = 0; i < 15; i++) {
      const z = -180 + r() * 1500,
        x = (i % 2 ? -1 : 1) * (160 + r() * 220),
        g = new THREE.SphereGeometry(1, 20, 18);
      const p = g.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const n =
          1 +
          0.07 *
            Math.sin(p.getX(j) * 28 + p.getY(j) * 12) *
            Math.cos(p.getZ(j) * 17);
        p.setXYZ(j, p.getX(j) * n, p.getY(j) * n, p.getZ(j) * n);
      }
      g.computeVertexNormals();
      const mountain = mesh(g, stone, x, -80, z, [
        70 + r() * 140,
        180 + r() * 240,
        100 + r() * 100,
      ]);
      this.root.add(mountain);
    }
    const geo = new THREE.IcosahedronGeometry(1, 1),
      boulders = new THREE.InstancedMesh(geo, stone, 750);
    for (let i = 0; i < 750; i++) {
      const z = r() * 780 - 20,
        x = center(z) + (i % 2 ? -1 : 1) * (width(z) + r() * 30),
        s = 0.3 + r() * 2;
      dummy.position.set(x, ground(x, z) - s * 0.35, z);
      dummy.scale.set(s, s * (0.5 + r() * 0.6), s * (0.7 + r() * 0.6));
      dummy.rotation.set(r(), r() * 6, r());
      dummy.updateMatrix();
      boulders.setMatrixAt(i, dummy.matrix);
    }
    boulders.castShadow = true;
    boulders.receiveShadow = true;
    this.root.add(boulders);
    for (const r of water.rocks)
      this.root.add(
        mesh(geo, stone, r.x, surface(r.z) - 0.5, r.z, [r.r, 1.2, r.r]),
      );
    const islandGeo = ribbon(299, 348, 1, 8, (z, t) => {
      const x =
        center(z) + (t * 2 - 1) * 3 * Math.sin(((z - 299) / 49) * Math.PI);
      return [x, surface(z) + 0.5 * Math.sin(t * Math.PI)];
    });
    this.root.add(mesh(islandGeo, trailMat));
  }
  makeForest() {
    const bark = texture("/assets/bark.jpg");
    bark.repeat.set(2, 1.5);
    const barkN = texture("/assets/bark-normal.jpg");
    barkN.colorSpace = THREE.NoColorSpace;
    barkN.repeat.copy(bark.repeat);
    const barkMat = mat("#b39a82");
    barkMat.map = bark;
    barkMat.normalMap = barkN;
    barkMat.normalScale.set(1.3, 1.3);
    const alpha = texture("/assets/needles-alpha.jpg");
    alpha.colorSpace = THREE.NoColorSpace;
    const leafMat = new THREE.MeshStandardMaterial({
        map: texture("/assets/needles.jpg"),
        alphaMap: alpha,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        roughness: 0.95,
        color: "#b8c59f",
      }),
      r = rng(7135);
    const env = {
      gravity: 1,
      medium: "air",
      energy: "photo",
      biochem: "carbon",
      light: 0.8,
      sunAngle: 0.25,
      wind: 0.15,
      aridity: 0.25,
    };
    for (let variant = 0; variant < 3; variant++) {
      const genes = {
        ...PRESETS.find((p) => p.id === "pine").genome,
        structuralSeed: 523 + variant * 183,
        stemGirth: 0.43,
        trunkHeight: 0.75,
        branchiness: 0.7,
        appendageDensity: 0.8,
        whorl: 0.35,
      };
      const plant = resolve(genes, env),
        g = buildBranchGeometry(plant.graph, {
          radialSegsFor: (l) => (l === 0 ? 12 : 5),
        });
      const wood = new THREE.BufferGeometry();
      wood.setAttribute("position", new THREE.BufferAttribute(g.positions, 3));
      wood.setAttribute("normal", new THREE.BufferAttribute(g.normals, 3));
      wood.setAttribute("uv", new THREE.BufferAttribute(g.uvs, 2));
      wood.setIndex(new THREE.BufferAttribute(g.indices, 1));
      wood.computeBoundingBox();
      const h = wood.boundingBox.max.y;
      const fol = plant.foliage,
        leaves = [];
      for (let i = 0; i < fol.count; i += 2) {
        for (let cross = 0; cross < 2; cross++) {
          const q = new THREE.PlaneGeometry(1, 1);
          const uv = q.attributes.uv;
          for (let k = 0; k < uv.count; k++)
            uv.setXY(k, 0.012 + uv.getX(k) * 0.225, 0.55 + uv.getY(k) * 0.435);
          dummy.position.fromArray(fol.position, i * 3);
          dummy.rotation.set(
            0.3 + Math.sin(i) * 0.5,
            i * 2.399 + (cross * Math.PI) / 2,
            0.2 * Math.cos(i),
          );
          const s = fol.scale[i] * 0.23;
          dummy.scale.set(s * 0.9, s * 1.8, s);
          dummy.updateMatrix();
          q.applyMatrix4(dummy.matrix);
          leaves.push(q);
        }
      }
      const leafGeo = mergeGeometries(leaves);
      leaves.forEach((g) => g.dispose());
      const count = 85,
        placements = [];
      for (let i = 0; i < count; i++) {
        const z = -35 + r() * 830,
          side = i % 2 ? -1 : 1,
          near = i < 65,
          distance = width(z) + (near ? 8 + r() * 32 : 40 + r() * 125),
          x = center(z) + side * distance,
          s = (32 + r() * 36) / h;
        dummy.position.set(x, ground(x, z) - 0.4, z);
        dummy.rotation.set(0, r() * 6.28, 0);
        dummy.scale.set(s * (0.85 + r() * 0.3), s, s * (0.85 + r() * 0.3));
        dummy.updateMatrix();
        placements.push({ matrix: dummy.matrix.clone(), z });
        this.trees.push({ x, z, r: 0.24 * s });
      }
      placements.sort((a, b) => a.z - b.z);
      for (let first = 0; first < placements.length; first += 12) {
        const items = placements.slice(first, first + 12),
          trunks = new THREE.InstancedMesh(wood, barkMat, items.length),
          crowns = new THREE.InstancedMesh(leafGeo, leafMat, items.length);
        items.forEach((p, i) => {
          trunks.setMatrixAt(i, p.matrix);
          crowns.setMatrixAt(i, p.matrix);
        });
        trunks.castShadow = true;
        trunks.receiveShadow = true;
        crowns.castShadow = false;
        this.root.add(trunks, crowns);
        this.forestChunks.push({
          trunks,
          crowns,
          min: items[0].z,
          max: items.at(-1).z,
        });
      }
    }
    // Ground cover is batched into two draw calls, including fern silhouettes.
    const fronds = [];
    for (let j = 0; j < 7; j++) {
      for (let k = 1; k < 9; k++) {
        const shape = new THREE.Shape();
        const fw = 0.09 * (1 - k / 11),
          fl = 0.4 * (1 - k / 11);
        shape.moveTo(0, -fl * 0.5);
        shape.quadraticCurveTo(fw, 0, 0, fl * 0.5);
        shape.quadraticCurveTo(-fw, 0, 0, -fl * 0.5);
        const q = new THREE.ShapeGeometry(shape, 2);
        dummy.position.set(
          Math.sin(j * 0.897) * k * 0.07,
          k * 0.04,
          Math.cos(j * 0.897) * k * 0.07,
        );
        dummy.rotation.set(-0.8, j * 0.897, k % 2 ? 0.7 : -0.7);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        q.applyMatrix4(dummy.matrix);
        fronds.push(q);
      }
    }
    const fern = new THREE.InstancedMesh(
      mergeGeometries(fronds),
      new THREE.MeshStandardMaterial({
        color: "#536d32",
        side: THREE.DoubleSide,
        roughness: 0.95,
      }),
      6000,
    );
    for (let i = 0; i < 6000; i++) {
      const z = r() * 780 - 15,
        x = center(z) + (i % 2 ? -1 : 1) * (width(z) + 2 + r() * 48);
      dummy.position.set(x, ground(x, z), z);
      dummy.rotation.set(0, r() * 6.28, 0);
      const s = 0.7 + r() * 2;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      fern.setMatrixAt(i, dummy.matrix);
      fern.setColorAt(
        i,
        color.setHSL(0.19 + r() * 0.09, 0.35, 0.19 + r() * 0.14),
      );
    }
    this.root.add(fern);
  }
  makeProps() {
    const wood = mat("#5a4030"),
      cream = mat("#e2d4a8");
    for (const l of landmarks) {
      const x = center(l.z) + width(l.z) + 6,
        y = ground(x, l.z);
      this.root.add(
        mesh(
          new THREE.CylinderGeometry(0.08, 0.1, 2.7, 6),
          wood,
          x,
          y + 1.35,
          l.z,
        ),
      );
      const board = mesh(
        new THREE.PlaneGeometry(3.6, 1.125),
        new THREE.MeshStandardMaterial({
          map: signTexture(l.name, "RIVER TRAIL  ·  PHOTO POINT"),
          side: THREE.DoubleSide,
        }),
        x,
        y + 2.25,
        l.z,
      );
      board.rotation.y = Math.PI;
      this.root.add(board);
      const disk = mesh(
        new THREE.RingGeometry(1.3, 1.42, 40),
        mat("#ccbd83"),
        x - 1,
        y + 0.1,
        l.z + 2,
      );
      disk.rotation.x = -Math.PI / 2;
      this.root.add(disk);
    }
    for (const z of [24, 419]) {
      const w = width(z) + 4,
        y = surface(z) + 3.1;
      for (let i = 0; i < Math.ceil(w * 4); i++) {
        const x = center(z) - w + i * 0.5;
        this.root.add(
          mesh(new THREE.BoxGeometry(0.43, 0.2, 2.6), wood, x, y, z),
        );
      }
      for (const dz of [-1.25, 1.25]) {
        this.root.add(
          mesh(
            new THREE.BoxGeometry(w * 2, 0.12, 0.12),
            cream,
            center(z),
            y + 1,
            z + dz,
          ),
        );
        for (let i = -w; i <= w; i += 3)
          this.root.add(
            mesh(
              new THREE.BoxGeometry(0.12, 1.2, 0.12),
              wood,
              center(z) + i,
              y + 0.5,
              z + dz,
            ),
          );
      }
    }
    for (const o of overlooks) {
      const y = ground(o.x, o.z);
      const board = mesh(
        new THREE.PlaneGeometry(3.2, 1),
        new THREE.MeshStandardMaterial({
          map: signTexture(o.name, "HIDDEN OVERLOOK  ·  TAKE A BREATH"),
          side: THREE.DoubleSide,
        }),
        o.x,
        y + 1.7,
        o.z,
      );
      this.root.add(
        board,
        mesh(
          new THREE.CylinderGeometry(0.1, 0.12, 2, 7),
          wood,
          o.x,
          y + 1,
          o.z,
        ),
      );
    }
    for (const z of [9, 719]) {
      const w = width(z);
      for (let i = -w; i < w; i += 1.4) {
        const g = new THREE.ConeGeometry(0.45, 0.75, 3),
          flag = mesh(
            g,
            mat(i % 3 ? "#e4b94e" : "#d9eee4"),
            center(z) + i,
            surface(z) + 4.6,
            z,
          );
        flag.rotation.z = Math.PI;
        this.root.add(flag);
      }
      for (const side of [-1, 1])
        this.root.add(
          mesh(
            new THREE.CylinderGeometry(0.16, 0.2, 5.8, 8),
            wood,
            center(z) + side * (w + 1),
            surface(z) + 2.5,
            z,
          ),
        );
    }
    const gold = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(0.06, 0),
        new THREE.MeshStandardMaterial({
          color: "#ffc846",
          metalness: 1,
          roughness: 0.17,
        }),
        700,
      ),
      r = rng(87);
    for (let i = 0; i < 700; i++) {
      const z = 165 + r() * 35,
        x = center(z) + (r() - 0.5) * width(z) * 1.7;
      dummy.position.set(x, bed(x, z) + 0.12, z);
      dummy.scale.set(1 + r() * 2, 0.22, 1 + r());
      dummy.rotation.set(r(), r() * 6, r());
      dummy.updateMatrix();
      gold.setMatrixAt(i, dummy.matrix);
    }
    this.root.add(gold);
  }
  makeWater() {
    const coeff = diffusionAttenuation("1C");
    this.waterMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        eye: { value: new V() },
        attenuation: { value: new V(...coeff) },
        panorama: { value: new THREE.Texture() },
        hasSky: { value: 0 },
        fogColor: { value: new THREE.Color("#b8cbb9") },
        darkness: { value: 1 },
      },
      vertexShader: `varying vec3 p;varying float depth;uniform float time;void main(){p=(modelMatrix*vec4(position,1.)).xyz;depth=1.4;vec3 pos=position;pos.y+=.035*sin(p.x*2.1+p.z*1.3-time*3.)+.018*sin(p.z*3.4-time*4.);gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}`,
      fragmentShader: `precision highp float;varying vec3 p;uniform float time;uniform vec3 eye,attenuation,fogColor;uniform sampler2D panorama;uniform float hasSky,darkness;
   void main(){vec2 q=p.xz;float t=time;vec3 n=normalize(vec3(.075*cos(q.x*2.1+q.y*1.3-t*3.)+.055*sin(q.y*4.1+q.x*1.5-t*4.3),1.,.095*cos(q.y*2.7+q.x*.7-t*3.6)));vec3 v=normalize(eye-p);float f=.02+.98*pow(1.-max(dot(n,v),0.),5.);vec3 refl=reflect(-v,n);vec2 uv=vec2(atan(refl.z,refl.x)/6.2831853+.5,asin(clamp(refl.y,-1.,1.))/3.14159265+.5);vec3 sky=mix(vec3(.57,.73,.69),texture2D(panorama,uv).rgb,hasSky);float sun=pow(max(dot(reflect(-normalize(vec3(-.4,.8,.6)),n),v),0.),360.);vec3 transmit=exp(-attenuation*2.3);vec3 base=vec3(.09,.3,.23)*transmit+vec3(.015,.06,.045);float streak=sin(q.x*3.+sin(q.y*.8-t)*2.)*sin(q.y*8.-t*8.);float foam=smoothstep(.91,1.,streak)*.09;vec3 c=mix(base,sky,clamp(f+.18,0.,.93))+vec3(1.,.86,.6)*sun*3.+foam;float fog=1.-exp(-pow(length(eye-p)*.0042,2.));c=mix(c*darkness,fogColor,fog);gl_FragColor=vec4(c,.77+f*.22);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`,
    });
    const g = ribbon(-20, 770, 1, 18, (z, t) => [
      center(z) + (t * 2 - 1) * width(z),
      surface(z),
    ]);
    this.water = new THREE.Mesh(g, this.waterMaterial);
    this.water.renderOrder = 2;
    this.root.add(this.water);
    this.reflector = new Reflector(new THREE.PlaneGeometry(1, 1), {
      textureWidth: 768,
      textureHeight: 768,
      clipBias: 0.003,
    });
    this.reflector.rotation.x = -Math.PI / 2;
    this.reflector.visible = false;
    this.scene.add(this.reflector);
    this.waterMaterial.uniforms.reflection = {
      value: this.reflector.getRenderTarget().texture,
    };
    this.waterMaterial.uniforms.reflectionMatrix =
      this.reflector.material.uniforms.textureMatrix;
    this.waterMaterial.fragmentShader = this.waterMaterial.fragmentShader
      .replace(
        "void main(){",
        "uniform sampler2D reflection; uniform mat4 reflectionMatrix; uniform sampler2D flowField;\nvoid main(){",
      )
      .replace(
        "vec2 q=p.xz;",
        "vec4 flow=texture2D(flowField,vec2((p.x+80.)/160.,(p.z+20.)/760.));vec2 q=p.xz-flow.xy*time*.12;",
      )
      .replace("attenuation*2.3", "attenuation*max(.2,flow.z)*1.6")
      .replace(
        "float sun=pow",
        "vec4 rp=reflectionMatrix*vec4(p,1.);vec2 ruv=rp.xy/rp.w+n.xz*.009;vec3 local=texture2D(reflection,clamp(ruv,.002,.998)).rgb;sky=mix(sky,local,1.-smoothstep(35.,90.,length(eye-p)));float sun=pow",
      )
      .replace("clamp(f+.18,0.,.93)", "clamp(f+.08,0.,.93)")
      .replace("streak)*.09", "streak)*(.03+flow.w*.25)");
    this.waterMaterial.fragmentShader = this.waterMaterial.fragmentShader
      .replace(
        "float fog=1.-exp",
        "float falls=max(step(238.,p.z)*(1.-step(246.,p.z)),step(510.,p.z)*(1.-step(521.,p.z)));float strands=.5+.5*sin(p.x*13.+sin(p.x*5.)+p.z*.4-time*8.);c=mix(c,vec3(.65,.79,.73)+strands*.25,falls*(.72+strands*.25));float fog=1.-exp",
      )
      .replace(
        "vec4(c,.77+f*.22)",
        "vec4(c,mix(clamp(.32+flow.z*.27+f*.3,.35,.96),.98,falls))",
      );
    this.waterMaterial.uniforms.flowField = { value: null };
  }
  makeDucks() {
    const sphere = new THREE.SphereGeometry(1, 16, 12),
      parts = [];
    for (const [pos, scale] of [
      [
        [0, 0.22, 0],
        [0.38, 0.29, 0.5],
      ],
      [
        [0, 0.57, 0.25],
        [0.25, 0.26, 0.25],
      ],
      [
        [0, 0.28, -0.43],
        [0.22, 0.14, 0.3],
      ],
      [
        [0.3, 0.26, -0.08],
        [0.15, 0.18, 0.32],
      ],
      [
        [-0.3, 0.26, -0.08],
        [0.15, 0.18, 0.32],
      ],
    ]) {
      const g = sphere.clone();
      g.scale(...scale);
      g.translate(...pos);
      parts.push(g);
    }
    const bodies = new THREE.InstancedMesh(
      mergeGeometries(parts),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.34,
        metalness: 0.02,
      }),
      150,
    );
    const bill = sphere.clone();
    bill.scale(0.19, 0.065, 0.16);
    bill.translate(0, 0.51, 0.48);
    const bills = new THREE.InstancedMesh(bill, mat("#e98b28", 0.32), 150),
      eyes = [];
    for (const side of [-1, 1]) {
      const g = sphere.clone();
      g.scale(0.038, 0.041, 0.04);
      g.translate(side * 0.2, 0.64, 0.4);
      eyes.push(g);
    }
    const eyeMesh = new THREE.InstancedMesh(
      mergeGeometries(eyes),
      mat("#101c1c", 0.2),
      150,
    );
    this.duckBatch = [bodies, bills, eyeMesh];
    this.duckColors = [
      "#f5c72f",
      "#78a16a",
      "#2b383c",
      "#e58997",
      "#f4f0d7",
      "#58714b",
      "#afa2d4",
      "#c9dde4",
      "#d7a73d",
      "#3b405d",
      "#8aabae",
    ];
    for (const batch of this.duckBatch) {
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.frustumCulled = false;
      batch.castShadow = true;
      batch.receiveShadow = true;
      this.root.add(batch);
    }
    this.hats = [];
    for (let i = 0; i < 150; i++) {
      const group = new THREE.Group();
      group.add(
        mesh(
          new THREE.CylinderGeometry(0.32, 0.31, 0.07, 12),
          mat(i % 10 === 1 ? "#1f292b" : "#b9a577"),
          0,
          0.8,
          0.24,
        ),
      );
      group.visible = false;
      this.root.add(group);
      this.hats.push(group);
    }
  }
  makeParticles() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d"),
      gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,.65)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    const r = rng(73);
    this.sprayData = Array.from({ length: 900 }, (_, i) => ({
      z: i % 2 ? 240 : 513,
      x: r(),
      phase: r(),
      spread: r(),
    }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(2700), 3),
    );
    this.spray = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: new THREE.CanvasTexture(c),
        color: "#edf7f1",
        size: 2.4,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.root.add(this.spray);
    const p = [];
    for (let i = 0; i < 1800; i++) {
      const z = r() * 760;
      p.push(center(z) + (r() - 0.5) * width(z) * 1.8, surface(z) + 0.085, z);
    }
    this.foam = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(p, 3),
      ),
      new THREE.PointsMaterial({
        color: "#e7e9ce",
        size: 0.12,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.root.add(this.foam);
  }
  makeWildlife() {
    this.animals = [];
    for (const a of wildlife) {
      const group = new THREE.Group(),
        m = mat(
          a.id === "heron"
            ? "#8d9b9d"
            : a.id === "butterfly"
              ? "#dcae39"
              : "#78583c",
        ),
        y = a.id === "otter" ? surface(a.z) + 0.1 : ground(a.x, a.z);
      if (a.id === "deer") {
        group.add(
          mesh(
            new THREE.SphereGeometry(1, 12, 8),
            m,
            0,
            0.9,
            0,
            [0.35, 0.46, 0.7],
          ),
        );
        group.add(
          mesh(
            new THREE.SphereGeometry(1, 12, 8),
            m,
            0,
            1.55,
            0.6,
            [0.22, 0.35, 0.25],
          ),
        );
        for (const x of [-0.23, 0.23])
          for (const z of [-0.4, 0.4])
            group.add(
              mesh(
                new THREE.CylinderGeometry(0.035, 0.06, 0.9, 6),
                m,
                x,
                0.4,
                z,
              ),
            );
        for (const x of [-0.15, 0.15])
          group.add(
            mesh(new THREE.ConeGeometry(0.08, 0.3, 5), m, x, 1.95, 0.61),
          );
      } else if (a.id === "butterfly") {
        for (const side of [-1, 1])
          group.add(
            mesh(
              new THREE.SphereGeometry(1, 12, 8),
              m,
              side * 0.16,
              0.3,
              0,
              [0.2, 0.025, 0.25],
            ),
          );
      } else {
        group.add(
          mesh(
            new THREE.SphereGeometry(1, 12, 8),
            m,
            0,
            0.3,
            0,
            [0.2, 0.25, 0.55],
          ),
        );
        if (a.id === "heron")
          group.add(
            mesh(
              new THREE.CylinderGeometry(0.055, 0.08, 0.9, 7),
              m,
              0,
              0.8,
              0.4,
            ),
          );
      }
      group.position.set(a.x, y + a.y, a.z);
      this.root.add(group);
      this.animals.push({ a, group });
    }
    this.ghostRunner = new THREE.Group();
    const ghostMat = new THREE.MeshBasicMaterial({
      color: "#b5f1e6",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.ghostRunner.add(
      mesh(new THREE.CapsuleGeometry(0.18, 0.38, 4, 8), ghostMat, 0, 1, 0),
      mesh(new THREE.SphereGeometry(0.17, 12, 8), ghostMat, 0, 1.5, 0),
    );
    this.ghostLegs = [];
    for (const side of [-1, 1]) {
      const leg = mesh(
        new THREE.CapsuleGeometry(0.065, 0.52, 4, 6),
        ghostMat,
        side * 0.11,
        0.4,
        0,
      );
      this.ghostLegs.push(leg);
      this.ghostRunner.add(leg);
    }
    this.ghostRunner.visible = false;
    this.root.add(this.ghostRunner);
    this.flowLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(600), 3),
      ),
      new THREE.LineBasicMaterial({
        color: "#eddf7c",
        depthTest: false,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.flowLines.visible = false;
    this.flowLines.frustumCulled = false;
    this.scene.add(this.flowLines);
  }
  setGhost(sample, t) {
    this.ghostRunner.visible = !!sample;
    if (!sample) return;
    this.ghostRunner.position.set(
      sample.x,
      ground(sample.x, sample.z),
      sample.z,
    );
    this.ghostLegs.forEach(
      (l, i) => (l.rotation.x = Math.sin(t * 9 + i * Math.PI) * 0.65),
    );
  }
  setFlow(flow) {
    this.flow = flow;
    const data = new Float32Array(flow.nx * flow.nz * 4);
    for (let i = 0; i < flow.u.length; i++) {
      data[i * 4] = flow.u[i];
      data[i * 4 + 1] = flow.v[i];
      data[i * 4 + 2] = flow.depth[i];
      data[i * 4 + 3] = clamp(
        (Math.hypot(flow.u[i], flow.v[i]) - 2.3) * 0.25,
        0,
        1,
      );
    }
    const t = new THREE.DataTexture(
      data,
      flow.nx,
      flow.nz,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    t.needsUpdate = true;
    this.waterMaterial.uniforms.flowField.value?.dispose();
    this.waterMaterial.uniforms.flowField.value = t;
  }
  setWeather(weather) {
    const night = weather.style === 5,
      storm = weather.style === 4;
    this.sun.intensity = night ? 0.3 : storm ? 1.1 : 3.2;
    this.renderer.toneMappingExposure = night ? 0.6 : 1.1;
    this.scene.fog.density = night
      ? 0.006
      : storm
        ? 0.009
        : weather.style === 0
          ? 0.006
          : 0.0042;
    this.waterMaterial.uniforms.darkness.value = night ? 0.38 : storm ? 0.7 : 1;
  }
  update(state, player, menu = false, owned = 37, tracker = true) {
    this.time = state.time;
    const t = menu ? performance.now() / 1000 : state.time;
    if (menu) {
      this.camera.position.set(center(-9) + 21, surface(-9) + 5.3, -9);
      this.camera.lookAt(center(23) - 3, surface(23) + 1.8, 27);
    } else {
      this.camera.position.set(player.x, player.y, player.z);
      this.camera.rotation.set(player.pitch, player.yaw, 0);
      this.camera.fov = player.fov;
      this.camera.updateProjectionMatrix();
    }
    for (const c of this.forestChunks) {
      const distance = Math.max(
        c.min - this.camera.position.z,
        this.camera.position.z - c.max,
        0,
      );
      c.trunks.visible = distance < 320;
      c.crowns.visible = distance < 245;
    }
    for (const batch of this.duckBatch) batch.count = state.ducks.length;
    for (let i = 0; i < state.ducks.length; i++) {
      const d = state.ducks[i];
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(
        d.falling ? state.time * 2 : Math.sin(t * 3 + d.id) * 0.04,
        d.yaw,
        d.roll,
      );
      dummy.updateMatrix();
      for (const batch of this.duckBatch) batch.setMatrixAt(i, dummy.matrix);
      const type = d.type === "Classic" ? 0 : 1 + ((d.id - 1) % 10);
      this.duckBatch[0].setColorAt(i, color.set(this.duckColors[type]));
      const h = this.hats[i];
      h.visible = d.type === "Explorer" || d.type === "Pirate";
      h.position.copy(dummy.position);
      h.rotation.copy(dummy.rotation);
    }
    for (let i = state.ducks.length; i < 150; i++) this.hats[i].visible = false;
    for (const batch of this.duckBatch) batch.instanceMatrix.needsUpdate = true;
    this.duckBatch[0].instanceColor.needsUpdate = true;
    const d = state.ducks.find((d) => d.id === owned);
    this.marker.visible = !menu && tracker && !!d;
    if (d) this.marker.position.set(d.x, d.y + 2, d.z);
    this.waterMaterial.uniforms.time.value = t;
    this.waterMaterial.uniforms.eye.value.copy(this.camera.position);
    for (const { a, group } of this.animals) {
      if (a.id === "butterfly")
        group.children.forEach(
          (w, i) => (w.rotation.z = Math.sin(t * 14) * (i ? 1 : -1) * 0.7),
        );
    }
    this.flowLines.visible = !!this.debug && !menu;
    if (this.flowLines.visible && this.flow) {
      const p = this.flowLines.geometry.attributes.position;
      for (let i = 0; i < 100; i++) {
        const z = player.z - 15 + Math.floor(i / 10) * 4,
          x = center(z) + ((i % 10) - 4.5) * 2,
          f = this.flow.sample(x, z, t),
          y = surface(z) + 0.3;
        p.setXYZ(i * 2, x, y, z);
        p.setXYZ(i * 2 + 1, x + f.u, y, z + f.v);
      }
      p.needsUpdate = true;
    }
    const p = this.spray.geometry.attributes.position;
    this.sprayData.forEach((a, i) => {
      const q = (t * 0.23 + a.phase) % 1,
        z = a.z + q * 11,
        x = center(a.z) + (a.x - 0.5) * width(a.z) * 2;
      p.setXYZ(
        i,
        x + Math.sin(t + a.phase * 20) * q,
        surface(a.z) - q * q * (a.z > 500 ? 14 : 10) + a.spread * 2,
        z,
      );
    });
    p.needsUpdate = true;
    const fp = this.foam.geometry.attributes.position,
      delta = Math.min(0.1, Math.max(0, t - (this.lastFoamTime ?? t)));
    this.lastFoamTime = t;
    for (let i = 0; i < fp.count; i++) {
      let x = fp.getX(i),
        z = fp.getZ(i);
      const f = this.flow?.sample(x, z, t);
      if (f) {
        x += f.u * delta;
        z += f.v * delta;
      }
      if (z > 755 || Math.abs(x - center(z)) > width(z)) {
        z = (i * 0.4327) % 750;
        x = center(z) + Math.sin(i * 6.27) * width(z) * 0.8;
      }
      fp.setXYZ(i, x, surface(z) + 0.1, z);
    }
    fp.needsUpdate = true;
    this.sun.position.set(
      this.camera.position.x - 80,
      this.camera.position.y + 140,
      this.camera.position.z + 60,
    );
    this.sun.target.position.copy(this.camera.position);
    this.sun.target.updateMatrixWorld();
    this.reflector.position.y = surface(menu ? 5 : player.z);
    this.reflector.updateMatrixWorld();
    this.water.visible = false;
    this.spray.visible = false;
    this.foam.visible = false;
    this.reflector.onBeforeRender(this.renderer, this.scene, this.camera);
    this.water.visible = true;
    this.spray.visible = true;
    this.foam.visible = true;
    this.renderer.render(this.scene, this.camera);
  }
  project(x, y, z) {
    const p = new V(x, y, z).project(this.camera);
    return {
      x: p.x,
      y: p.y,
      visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
    };
  }
  sightline(x, y, z) {
    const eye = this.camera.position,
      dist = Math.hypot(x - eye.x, z - eye.z);
    for (let n = 2; n < dist; n += 1.5) {
      const t = n / dist,
        px = eye.x + (x - eye.x) * t,
        pz = eye.z + (z - eye.z) * t,
        py = eye.y + (y - eye.y) * t;
      if (Math.abs(px - center(pz)) > width(pz) && ground(px, pz) > py + 0.05)
        return false;
    }
    for (const tree of this.trees) {
      const dx = x - eye.x,
        dz = z - eye.z,
        q = clamp(
          ((tree.x - eye.x) * dx + (tree.z - eye.z) * dz) /
            Math.max(1, dist * dist),
          0,
          1,
        );
      if (
        q > 0.01 &&
        q < 0.99 &&
        Math.hypot(eye.x + dx * q - tree.x, eye.z + dz * q - tree.z) <
          tree.r * 0.6
      )
        return false;
    }
    return true;
  }
  photoSubjects(state, occlusion = false) {
    return state.ducks.map((d) => {
      const p = this.project(d.x, d.y + 0.35, d.z),
        dist = this.camera.position.distanceTo(new V(d.x, d.y, d.z));
      return {
        ...p,
        visible:
          p.visible && (!occlusion || this.sightline(d.x, d.y + 0.35, d.z)),
        id: d.id,
        type: d.type,
        size: 0.7 / Math.max(1, dist),
        distance: dist,
      };
    });
  }
  capture() {
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = Math.round((960 * this.canvas.height) / this.canvas.width);
    c.getContext("2d").drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.83);
  }
}
