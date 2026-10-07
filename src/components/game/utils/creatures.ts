import * as THREE from 'three';
import type { CreatureBody, CreatureLook, CreatureRig, CreatureState } from './creatureTypes';

// Procedural low-poly monsters built from three.js primitives (see creatureTypes.ts).
// Every rig owns its geometries and materials, so disposing one never touches another.
// Shapes are mostly unit primitives stretched per mesh, so a rig only needs a handful of geometries.

type Vec3 = [number, number, number];

const TAU = Math.PI * 2;
const ORIGIN: Vec3 = [0, 0, 0];
const SIDES = [-1, 1] as const;

const MOUTH_COLOUR = '#4a1c24';
const PUPIL_COLOUR = '#17141f';
const EYE_WHITE = '#fbfbf2';
const DEATH_SECONDS = 1;

// ---------------------------------------------------------------------------------------------
// Small maths helpers

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Frame-rate independent ease towards a target
const approach = (current: number, target: number, rate: number, delta: number) =>
  current + (target - current) * (1 - Math.exp(-rate * delta));
// Deterministic pseudo random number in [0, 1)
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// A strike is a wind-up over the first third, a snap to the hit, then easing back to rest
const strikeWindup = (progress: number) => smoothstep(0, 0.35, progress) * (1 - smoothstep(0.35, 0.5, progress));
const strikeLunge = (progress: number) => smoothstep(0.35, 0.5, progress) * (1 - smoothstep(0.6, 1, progress));

const shade = (color: string, factor: number) => `#${new THREE.Color(color).multiplyScalar(factor).getHexString()}`;

// ---------------------------------------------------------------------------------------------
// Rig kit: owns every geometry and material of one rig

interface MaterialOptions {
  // Emissive intensity in the material's own colour
  emissive?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  doubleSide?: boolean;
}

class Kit {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly shapes = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  track<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private shape(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geometry = this.shapes.get(key);
    if (!geometry) {
      geometry = this.track(make());
      this.shapes.set(key, geometry);
    }
    return geometry;
  }

  // Unit sphere, stretched into ellipsoids
  sphere() {
    return this.shape('sphere', () => new THREE.SphereGeometry(1, 8, 6));
  }

  // Upper and lower half spheres (frog heads and jaws)
  dome() {
    return this.shape('dome', () => new THREE.SphereGeometry(1, 10, 4, 0, TAU, 0, Math.PI / 2));
  }

  bowl() {
    return this.shape('bowl', () => new THREE.SphereGeometry(1, 10, 3, 0, TAU, Math.PI / 2, Math.PI / 2));
  }

  // Unit cone with its base at y = 0 and the point at y = 1
  cone(segments = 5) {
    return this.shape(`cone${segments}`, () => new THREE.ConeGeometry(1, 1, segments).translate(0, 0.5, 0));
  }

  // Tapered cylinder hanging down from y = 0 to y = -1 (legs, arms)
  limb(taper = 0.8) {
    return this.shape(`limb${taper}`, () => new THREE.CylinderGeometry(1, taper, 1, 6).translate(0, -0.5, 0));
  }

  // Tapered cylinder from y = 0 up to y = 1 (bones between two points)
  rod() {
    return this.shape('rod', () => new THREE.CylinderGeometry(0.7, 1, 1, 5).translate(0, 0.5, 0));
  }

  // Tapered cylinder from z = 0 out to z = 1 (tails, spider legs, pincer arms)
  segment(taper = 0.75) {
    return this.shape(`segment${taper}`, () =>
      new THREE.CylinderGeometry(taper, 1, 1, 5).translate(0, 0.5, 0).rotateX(Math.PI / 2)
    );
  }

  // Square tapered snout from z = 0 to z = 1, 1 wide and 1 tall at its base
  prism() {
    return this.shape('prism', () =>
      new THREE.CylinderGeometry(0.7, 1, 1, 4)
        .rotateY(Math.PI / 4)
        .translate(0, 0.5, 0)
        .rotateX(Math.PI / 2)
        .scale(Math.SQRT1_2, Math.SQRT1_2, 1)
    );
  }

  box() {
    return this.shape('box', () => new THREE.BoxGeometry(1, 1, 1));
  }

  dodeca() {
    return this.shape('dodeca', () => new THREE.DodecahedronGeometry(1));
  }

  ico(detail = 0) {
    return this.shape(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail));
  }

  octa() {
    return this.shape('octa', () => new THREE.OctahedronGeometry(1));
  }

  // Ring around the z axis; scale it to set the radius
  torus(tube = 0.22) {
    return this.shape(`torus${tube}`, () => new THREE.TorusGeometry(1, tube, 4, 14));
  }

  material(color: string, options: MaterialOptions = {}): THREE.MeshStandardMaterial {
    const { emissive = 0, opacity = 1, roughness = 0.75, metalness = 0, doubleSide = false } = options;
    const key = `${color}|${emissive}|${opacity}|${roughness}|${metalness}|${doubleSide}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness,
        metalness,
        emissive: emissive > 0 ? color : '#000000',
        emissiveIntensity: emissive,
        transparent: opacity < 1,
        opacity,
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide
      });
      material.userData.baseOpacity = opacity;
      this.materials.set(key, material);
    }
    return material;
  }

  glow(color: string, intensity = 1.3) {
    return this.material(color, { emissive: intensity, roughness: 0.5 });
  }

  // Fade every material of the rig (wisps dissolving)
  setOpacity(factor: number) {
    for (const material of this.materials.values()) {
      if (!material.transparent) {
        material.transparent = true;
        material.needsUpdate = true;
      }
      material.opacity = (material.userData.baseOpacity as number) * factor;
    }
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.length = 0;
    this.shapes.clear();
    this.materials.clear();
  }
}

// ---------------------------------------------------------------------------------------------
// Scene graph helpers

const part = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3 = ORIGIN,
  scale: Vec3 | number = 1,
  rotation?: Vec3
): THREE.Mesh => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (typeof scale === 'number') mesh.scale.setScalar(scale);
  else mesh.scale.set(scale[0], scale[1], scale[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
};

const pivot = (parent: THREE.Object3D, position: Vec3 = ORIGIN, rotation?: Vec3): THREE.Group => {
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  if (rotation) group.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(group);
  return group;
};

// Group mirrored across x, for building the left half of a symmetric pair
const mirrored = (parent: THREE.Object3D, side: number): THREE.Group => {
  const group = pivot(parent);
  group.scale.x = side;
  return group;
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Thin bone between two points (wing fingers)
const bone = (kit: Kit, parent: THREE.Object3D, material: THREE.Material, from: Vec3, to: Vec3, radius: number) => {
  const direction = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const length = direction.length();
  const mesh = part(parent, kit.rod(), material, from, [radius, length, radius]);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  return mesh;
};

// A pair of eyes on the +z face of a head; with a pupil material they get a dark centre
const addEyes = (
  kit: Kit,
  parent: THREE.Object3D,
  material: THREE.Material,
  spacing: number,
  y: number,
  z: number,
  size: number,
  pupil?: THREE.Material
) => {
  for (const side of SIDES) {
    part(parent, kit.sphere(), material, [side * spacing, y, z], [size, size, size * 0.8]);
    if (pupil) part(parent, kit.sphere(), pupil, [side * spacing, y, z + size * 0.6], [size * 0.5, size * 0.55, size * 0.4]);
  }
};

// Team coloured band; with no tilt it rings the z axis (necks), tilt PI/2 for a horizontal belt
const addCollar = (kit: Kit, parent: THREE.Object3D, material: THREE.Material, position: Vec3, radius: number, tilt = 0) =>
  part(parent, kit.torus(), material, position, radius, [tilt, 0, 0]);

// Chunky leg hanging from a hip; the hip's height is the leg length so the paw rests on y = 0
const addLeg = (
  kit: Kit,
  parent: THREE.Object3D,
  material: THREE.Material,
  pawMaterial: THREE.Material,
  hip: Vec3,
  radius: number
): THREE.Group => {
  const length = hip[1];
  const group = pivot(parent, hip);
  part(group, kit.limb(0.8), material, ORIGIN, [radius, length - radius * 0.4, radius]);
  part(group, kit.sphere(), pawMaterial, [0, -length + radius * 0.6, radius * 0.3], [radius * 1.2, radius * 0.6, radius * 1.45]);
  return group;
};

interface JointedLeg {
  yaw: THREE.Group;
  lift: THREE.Group;
  knee: THREE.Group;
  baseYaw: number;
  elevation: number;
  baseKnee: number;
  side: number;
  index: number;
}

// Two-segment arthropod leg: the thigh rises out from the hip and the shin reaches down to the ground
const addJointedLeg = (
  kit: Kit,
  parent: THREE.Object3D,
  material: THREE.Material,
  tipMaterial: THREE.Material,
  hip: Vec3,
  side: number,
  index: number,
  forwardAngle: number,
  thigh: number,
  elevation: number,
  reach: number,
  radius: number
): JointedLeg => {
  const baseYaw = Math.atan2(side * Math.cos(forwardAngle), Math.sin(forwardAngle));
  const yaw = pivot(parent, hip, [0, baseYaw, 0]);
  const lift = pivot(yaw, ORIGIN, [-elevation, 0, 0]);
  part(lift, kit.segment(0.75), material, ORIGIN, [radius, radius, thigh]);
  const kneeHeight = hip[1] + thigh * Math.sin(elevation);
  const shin = Math.hypot(kneeHeight, reach);
  const baseKnee = elevation + Math.atan2(kneeHeight, reach);
  const knee = pivot(lift, [0, 0, thigh], [baseKnee, 0, 0]);
  part(knee, kit.sphere(), material, ORIGIN, radius * 1.15);
  part(knee, kit.segment(0.3), tipMaterial, ORIGIN, [radius * 0.85, radius * 0.85, shin]);
  return { yaw, lift, knee, baseYaw, elevation, baseKnee, side, index };
};

// Upper snout and a hinged lower jaw sticking out of a head; returns the jaw to open with rotation.x
const addMuzzle = (
  kit: Kit,
  parent: THREE.Object3D,
  material: THREE.Material,
  jawMaterial: THREE.Material,
  z: number,
  size: Vec3,
  fangs?: THREE.Material,
  nose?: THREE.Material
): THREE.Group => {
  const [width, height, length] = size;
  part(parent, kit.prism(), material, [0, height * 0.12, z], [width, height * 0.62, length]);
  const jaw = pivot(parent, [0, -height * 0.2, z]);
  part(jaw, kit.prism(), jawMaterial, [0, -height * 0.1, 0], [width * 0.86, height * 0.36, length * 0.92]);
  part(jaw, kit.box(), kit.material(MOUTH_COLOUR), [0, height * 0.06, length * 0.45], [width * 0.62, height * 0.1, length * 0.8]);
  if (fangs) {
    for (const side of SIDES) {
      part(jaw, kit.cone(4), fangs, [side * width * 0.27, height * 0.04, length * 0.8], [width * 0.08, height * 0.32, width * 0.08]);
      part(parent, kit.cone(4), fangs, [side * width * 0.28, -height * 0.1, z + length * 0.7], [width * 0.08, height * 0.3, width * 0.08], [Math.PI, 0, 0]);
    }
  }
  if (nose) part(parent, kit.sphere(), nose, [0, height * 0.32, z + length * 0.96], [width * 0.22, height * 0.16, width * 0.16]);
  return jaw;
};

// A curved horn pair rising from the origin, curling outwards then up
const buildHorns = (kit: Kit, material: THREE.Material, size: number): THREE.Group => {
  const group = new THREE.Group();
  const SEGMENTS = 4;
  const length = (size / SEGMENTS) * 1.1;
  const radius = (k: number) => size * 0.2 * (1 - k / SEGMENTS) + 0.002;
  const geometries = Array.from({ length: SEGMENTS }, (_, k) =>
    kit.track(new THREE.CylinderGeometry(k === SEGMENTS - 1 ? 0 : radius(k + 1), radius(k), length, 6).translate(0, length / 2, 0))
  );
  for (const side of SIDES) {
    let joint = pivot(mirrored(group, side), [size * 0.35, 0, 0], [-0.25, 0, -0.85]);
    geometries.forEach((geometry) => {
      part(joint, geometry, material);
      joint = pivot(joint, [0, length * 0.95, 0], [-0.12, 0, 0.42]);
    });
  }
  return group;
};

// Membrane wing outline (right wing, spread along +x, trailing towards -z)
const BAT_WING_POINTS: Vec3[] = [
  [0, 0, 0], // shoulder
  [0.42, 0.06, 0.04], // elbow
  [0.62, 0.12, -0.02], // wrist
  [1, 0.06, -0.18], // finger tips
  [0.84, 0.02, -0.58],
  [0.52, 0, -0.68],
  [0.1, 0, -0.42] // trailing edge at the body
];

const batWingGeometry = (length: number): THREE.BufferGeometry => {
  const p = BAT_WING_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z).multiplyScalar(length));
  const wrist = p[2];
  // Scalloped edge between finger tips, pulled in towards the wrist
  const scallop = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().add(b).multiplyScalar(0.5).lerp(wrist, 0.28);
  const s34 = scallop(p[3], p[4]);
  const s45 = scallop(p[4], p[5]);
  const s56 = scallop(p[5], p[6]);
  const triangles = [
    [wrist, p[3], s34], [wrist, s34, p[4]], [wrist, p[4], s45], [wrist, s45, p[5]],
    [wrist, p[5], s56], [wrist, s56, p[6]], [wrist, p[6], p[0]], [wrist, p[0], p[1]]
  ];
  const positions = new Float32Array(triangles.length * 9);
  triangles.forEach((triangle, i) => triangle.forEach((point, j) => point.toArray(positions, i * 9 + j * 3)));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

interface WingPair {
  // Raise (+) or lower (-) both wings and sweep them back by `fold` radians
  set(angle: number, fold: number): void;
}

// Bat wings (imps and dragons): a finger-boned membrane on each side, hinged at the shoulders
const addBatWings = (
  kit: Kit,
  parent: THREE.Object3D,
  boneMaterial: THREE.Material,
  membraneMaterial: THREE.Material,
  clawMaterial: THREE.Material,
  shoulder: Vec3,
  length: number
): WingPair => {
  const membrane = kit.track(batWingGeometry(length));
  const at = (index: number): Vec3 => {
    const [x, y, z] = BAT_WING_POINTS[index];
    return [x * length, y * length, z * length];
  };
  const radius = length * 0.025;
  const hinges = SIDES.map((side) => {
    const hinge = pivot(mirrored(parent, side), [shoulder[0], shoulder[1], shoulder[2]]);
    part(hinge, membrane, membraneMaterial);
    bone(kit, hinge, boneMaterial, at(0), at(1), radius * 1.3);
    bone(kit, hinge, boneMaterial, at(1), at(2), radius * 1.1);
    for (const tip of [3, 4, 5]) bone(kit, hinge, boneMaterial, at(2), at(tip), radius * 0.7);
    part(hinge, kit.cone(4), clawMaterial, at(2), [radius * 1.2, radius * 5, radius * 1.2], [0, 0, -0.4]);
    return hinge;
  });
  return {
    set(angle, fold) {
      for (const hinge of hinges) hinge.rotation.set(0, fold, angle);
    }
  };
};

// Neck of beads laid along a quadratic curve, with a head group at its tip
class Neck {
  readonly head: THREE.Group;
  private readonly beads: THREE.Mesh[];

  constructor(kit: Kit, parent: THREE.Object3D, material: THREE.Material, count: number, baseRadius: number, tipRadius: number) {
    this.beads = Array.from({ length: count }, (_, i) =>
      part(parent, kit.sphere(), material, ORIGIN, lerp(baseRadius, tipRadius, i / Math.max(1, count - 1)))
    );
    this.head = pivot(parent);
    this.head.rotation.order = 'YXZ';
  }

  // Lay the neck from base through control to tip and point the head along it (pitch > 0 noses down)
  place(base: THREE.Vector3, control: THREE.Vector3, tip: THREE.Vector3, pitch: number) {
    const count = this.beads.length;
    this.beads.forEach((bead, i) => {
      const t = i / count;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      bead.position.set(
        a * base.x + b * control.x + c * tip.x,
        a * base.y + b * control.y + c * tip.y,
        a * base.z + b * control.z + c * tip.z
      );
    });
    this.head.position.copy(tip);
    const dx = tip.x - control.x;
    const dy = tip.y - control.y;
    const dz = tip.z - control.z;
    this.head.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)) + pitch, Math.atan2(dx, dz), 0);
  }
}

// Tail of tapered segments chained from a root pointing backwards
const addTail = (
  kit: Kit,
  parent: THREE.Object3D,
  material: THREE.Material,
  root: Vec3,
  count: number,
  length: number,
  radius: number,
  spineMaterial?: THREE.Material
): THREE.Group[] => {
  const joints: THREE.Group[] = [];
  let joint = pivot(pivot(parent, root, [0, Math.PI, 0]));
  for (let k = 0; k < count; k++) {
    const r = radius * (1 - (k / count) * 0.75);
    part(joint, kit.segment(0.75), material, ORIGIN, [r, r * 0.9, length * 1.05]);
    if (spineMaterial) part(joint, kit.cone(4), spineMaterial, [0, r * 0.75, length * 0.4], [r * 0.45, r * 1.3, r * 0.6], [0.5, 0, 0]);
    joints.push(joint);
    joint = pivot(joint, [0, 0, length]);
  }
  joints.push(joint);
  return joints;
};

// ---------------------------------------------------------------------------------------------
// Bodies

interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  team: string;
}

// Everything a body needs to pose itself for one frame
interface Pose {
  // Animation clock in seconds (slows to a stop as the creature dies)
  time: number;
  // Seconds since the last frame, scaled the same way
  delta: number;
  // Blend into the walk cycle and the combat stance, 0..1
  walk: number;
  tension: number;
  // Strike envelope: wind-up and hit, 0..1 each, and progress through the strike (1 when idle)
  windup: number;
  lunge: number;
  strikeProgress: number;
  // Progress of the death collapse, 0..1
  dead: number;
}

// How the rig collapses on death: on its side, onto its face, dissolving, or handled by the body itself
type DeathStyle = 'topple' | 'forward' | 'fade' | 'custom';

interface Body {
  root: THREE.Group;
  pose(p: Pose): void;
  death: DeathStyle;
  // Raise a toppled body by this much so it lies on the ground rather than in it
  deathLift?: number;
}

type Builder = (kit: Kit, colors: Palette, variant: string | undefined) => Body;

// --- Quadrupeds -------------------------------------------------------------------------------

interface QuadSpec {
  torso: Vec3; // ellipsoid radii
  torsoY: number;
  hip: Vec3; // |x|, height (leg length) and |z| of the legs
  legRadius: number;
  head: Vec3;
  skull: Vec3;
  muzzle: Vec3; // width, height, length
  collar: { position: Vec3; radius: number; tilt: number };
  stride: number; // walk cycle speed, radians per second
  swing: number; // leg swing amplitude
}

const QUADRUPEDS: Record<'wolf' | 'boar' | 'bear', QuadSpec> = {
  wolf: {
    torso: [0.12, 0.12, 0.26], torsoY: 0.37, hip: [0.075, 0.31, 0.16], legRadius: 0.035,
    head: [0, 0.52, 0.3], skull: [0.1, 0.09, 0.1], muzzle: [0.09, 0.08, 0.15],
    collar: { position: [0, 0.45, 0.23], radius: 0.075, tilt: -0.8 }, stride: 10, swing: 0.6
  },
  boar: {
    torso: [0.17, 0.16, 0.27], torsoY: 0.31, hip: [0.1, 0.2, 0.15], legRadius: 0.045,
    head: [0, 0.31, 0.29], skull: [0.12, 0.12, 0.12], muzzle: [0.11, 0.1, 0.13],
    collar: { position: [0, 0.31, 0.2], radius: 0.13, tilt: -0.15 }, stride: 11, swing: 0.5
  },
  bear: {
    torso: [0.23, 0.22, 0.32], torsoY: 0.47, hip: [0.13, 0.33, 0.17], legRadius: 0.075,
    head: [0, 0.64, 0.4], skull: [0.14, 0.13, 0.13], muzzle: [0.11, 0.1, 0.1],
    collar: { position: [0, 0.6, 0.31], radius: 0.13, tilt: -0.6 }, stride: 6.5, swing: 0.4
  }
};

const buildQuadruped: Builder = (kit, colors, variant) => {
  const kind = variant === 'boar' || variant === 'bear' ? variant : 'wolf';
  const spec = QUADRUPEDS[kind];
  const fur = kit.material(colors.primary);
  const dark = kit.material(colors.secondary);
  const ivory = kit.material(colors.accent);
  const eye = kit.glow(colors.glow, 1.2);
  const team = kit.material(colors.team, { emissive: 0.2 });
  const nose = kit.material(PUPIL_COLOUR);

  const root = new THREE.Group();
  // Torso, head and tail bob and lunge; legs hang from the root so the paws stay planted
  const body = pivot(root);
  const torso = part(body, kit.sphere(), fur, [0, spec.torsoY, 0], spec.torso);

  const legs = ([[1, 1], [-1, 1], [1, -1], [-1, -1]] as const).map(([x, z]) =>
    addLeg(kit, root, fur, dark, [x * spec.hip[0], spec.hip[1], z * spec.hip[2]], spec.legRadius)
  );

  const head = pivot(body, spec.head);
  part(head, kit.sphere(), fur, ORIGIN, spec.skull);
  const muzzleZ = spec.skull[2] * 0.55;
  const jaw = addMuzzle(kit, head, kind === 'bear' ? dark : fur, dark, muzzleZ, spec.muzzle, ivory, nose);
  addEyes(kit, head, eye, spec.skull[0] * 0.5, spec.skull[1] * 0.3, spec.skull[2] * 0.78, spec.skull[0] * 0.18);
  addCollar(kit, body, team, spec.collar.position, spec.collar.radius, spec.collar.tilt);

  // Tail: a yaw pivot for wagging, pointing backwards
  const tailRoot = pivot(body, [0, spec.torsoY + spec.torso[1] * 0.45, -spec.torso[2] * 0.9], [0, Math.PI, 0]);
  const tail = pivot(tailRoot);
  let tailDroop = 0.7;

  if (kind === 'wolf') {
    // Neck, chest ruff, tall pointed ears and a bushy tail
    part(body, kit.sphere(), fur, [0, 0.45, 0.22], [0.075, 0.09, 0.1], [-0.6, 0, 0]);
    part(body, kit.sphere(), dark, [0, spec.torsoY - 0.01, 0.17], [0.1, 0.11, 0.1]);
    for (const side of SIDES) {
      part(head, kit.cone(4), fur, [side * 0.055, 0.06, -0.03], [0.035, 0.11, 0.025], [0, 0, -side * 0.3]);
    }
    part(tail, kit.sphere(), fur, [0, 0, 0.14], [0.05, 0.05, 0.15]);
    part(tail, kit.sphere(), dark, [0, 0, 0.27], [0.035, 0.035, 0.05]);
    tailDroop = 0.9;
  } else if (kind === 'boar') {
    // Curved tusks, small ears, a bristly ridge down the spine and a little curly tail
    for (const side of SIDES) {
      part(head, kit.cone(4), ivory, [side * 0.06, -0.02, muzzleZ + spec.muzzle[2] * 0.7], [0.018, 0.09, 0.018], [0.5, 0, -side * 0.55]);
      part(head, kit.cone(4), dark, [side * 0.075, 0.08, -0.02], [0.035, 0.07, 0.02], [-0.3, 0, -side * 0.6]);
    }
    for (let i = 0; i < 7; i++) {
      const z = 0.24 - i * 0.075;
      const y = spec.torsoY + spec.torso[1] * Math.sqrt(Math.max(0, 1 - (z / spec.torso[2]) ** 2)) - 0.02;
      part(body, kit.cone(4), dark, [0, y, z], [0.028, 0.09 - Math.abs(i - 2) * 0.008, 0.03], [-0.5, 0, 0]);
    }
    part(tail, kit.segment(0.5), dark, ORIGIN, [0.018, 0.018, 0.1]);
    tailDroop = 0.3;
  } else {
    // Shoulder hump, round ears, pale muzzle and a stubby tail
    part(body, kit.sphere(), fur, [0, spec.torsoY + 0.1, 0.13], [0.21, 0.2, 0.2]);
    part(body, kit.sphere(), fur, [0, 0.6, 0.3], [0.13, 0.12, 0.1]);
    for (const side of SIDES) part(head, kit.sphere(), fur, [side * 0.1, 0.1, -0.03], [0.05, 0.05, 0.03]);
    part(tail, kit.sphere(), fur, [0, 0, 0.02], 0.045);
    tailDroop = 0.2;
  }

  return {
    root,
    death: 'topple',
    deathLift: spec.torso[0] * 0.9,
    pose: (p) => {
      const t = p.time;
      const stride = t * spec.stride;
      // Diagonal pairs swing together
      legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(stride + (i === 0 || i === 3 ? 0 : Math.PI)) * spec.swing * p.walk;
      });
      const bob = Math.abs(Math.sin(stride)) * 0.025 * p.walk;
      body.position.set(0, bob - p.tension * 0.025 - p.lunge * 0.03, p.lunge * 0.08 - p.windup * 0.03);
      body.rotation.x = p.lunge * 0.12 - p.windup * 0.06 + p.tension * 0.04;
      torso.scale.y = spec.torso[1] * (1 + Math.sin(t * 2.4) * 0.035 * (1 - p.walk));

      // Bite: head rears with the jaw wide open, then snaps forward and shut
      head.position.z = spec.head[2] + p.lunge * 0.1;
      head.rotation.x = p.tension * 0.22 - p.windup * 0.35 + p.lunge * 0.3 + Math.sin(t * 1.3) * 0.04;
      head.rotation.y = Math.sin(t * 0.7) * 0.18 * (1 - p.tension) * (1 - p.walk);
      jaw.rotation.x = p.tension * 0.15 + p.windup * 0.75 + Math.max(0, Math.sin(t * 2.4)) * 0.05 * (1 - p.tension);

      tail.rotation.y = Math.sin(t * (5 + p.tension * 7)) * (0.4 - p.tension * 0.25);
      tail.rotation.x = tailDroop - p.tension * 0.5 + p.walk * 0.15;
    }
  };
};

// --- Spider -----------------------------------------------------------------------------------

const buildSpider: Builder = (kit, colors) => {
  const shell = kit.material(colors.primary);
  const dark = kit.material(colors.secondary);
  const eye = kit.glow(colors.accent, 1);
  const fang = kit.material(colors.accent);
  const team = kit.material(colors.team, { emissive: 0.3 });

  const root = new THREE.Group();
  // Pivot under the back legs so the spider rears up on them
  const rear = pivot(root, [0, 0, -0.12]);
  const body = pivot(rear, [0, 0, 0.12]);

  part(body, kit.sphere(), shell, [0, 0.24, 0.05], [0.12, 0.085, 0.13]);
  const abdomen = pivot(body, [0, 0.31, -0.21], [-0.25, 0, 0]);
  part(abdomen, kit.sphere(), shell, ORIGIN, [0.19, 0.16, 0.22]);
  // Team diamond and markings on the back of the abdomen
  part(abdomen, kit.octa(), team, [0, 0.145, 0.02], [0.065, 0.03, 0.09]);
  part(abdomen, kit.sphere(), dark, [0, 0.12, -0.11], [0.06, 0.04, 0.05]);
  for (const side of SIDES) part(abdomen, kit.sphere(), dark, [side * 0.1, 0.1, -0.04], [0.04, 0.03, 0.06]);

  const head = pivot(body, [0, 0.25, 0.16]);
  part(head, kit.sphere(), dark, ORIGIN, [0.08, 0.075, 0.07]);
  // Eight eyes: a big front pair and three smaller pairs around them
  const EYES: [number, number, number][] = [[0.028, 0.03, 0.022], [0.06, 0.022, 0.014], [0.045, 0.058, 0.013], [0.014, 0.062, 0.01]];
  for (const [x, y, r] of EYES) {
    for (const side of SIDES) part(head, kit.sphere(), eye, [side * x, y, Math.sqrt(Math.max(0, 0.0049 - x * x * 0.7 - y * y * 0.5)) + 0.004], r);
  }
  for (const side of SIDES) {
    part(head, kit.cone(4), fang, [side * 0.03, -0.035, 0.055], [0.018, 0.06, 0.018], [Math.PI - 0.3, 0, 0]);
  }

  const HIP_Z = [0.12, 0.07, 0.02, -0.03];
  const ANGLES = [0.95, 0.35, -0.3, -0.85];
  const legs: JointedLeg[] = [];
  for (const side of SIDES) {
    HIP_Z.forEach((z, k) => legs.push(addJointedLeg(kit, body, shell, dark, [side * 0.08, 0.24, z], side, k, ANGLES[k], 0.22, 0.75, 0.13, 0.022)));
  }

  return {
    root,
    death: 'custom',
    pose: (p) => {
      const t = p.time;
      const stride = t * 11;
      for (const leg of legs) {
        // Alternating gait: every other leg down each side moves together
        const group = (leg.index + (leg.side > 0 ? 0 : 1)) % 2;
        const phase = stride + group * Math.PI;
        let lift = Math.max(0, Math.sin(phase)) * 0.35 * p.walk + Math.sin(t * 1.7 + leg.index * 1.3 + leg.side) * 0.03;
        let bend = 0;
        if (leg.index === 0) {
          // Front legs rise high and curl on the wind-up, then stab down
          lift += p.tension * 0.3 + p.windup * 1.1 - p.lunge * 0.25;
          bend += -p.tension * 0.3 - p.windup * 0.9 + p.lunge * 0.1;
        } else if (leg.index === 1) {
          lift += p.windup * 0.4;
        }
        lift += p.dead * 0.9;
        bend += p.dead * 1.0;
        leg.yaw.rotation.y = leg.baseYaw - Math.cos(phase) * 0.22 * p.walk * leg.side;
        leg.lift.rotation.x = -(leg.elevation + lift);
        leg.knee.rotation.x = leg.baseKnee + bend;
      }
      rear.rotation.x = -0.45 * p.windup + 0.15 * p.lunge - 0.08 * p.tension;
      body.position.y = Math.sin(t * 2) * 0.006 - p.tension * 0.02 + Math.abs(Math.sin(stride)) * 0.012 * p.walk - p.dead * 0.12;
      abdomen.scale.setScalar(1 + Math.sin(t * 2.2) * 0.025);
      head.rotation.x = -p.windup * 0.2 + p.lunge * 0.25;
    }
  };
};

// --- Slime ------------------------------------------------------------------------------------

// Icosphere with its bottom squashed flat, base at y = 0 and top at y = 1.65
const slimeGeometry = (): THREE.BufferGeometry => {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setY(i, (y < -0.5 ? -0.5 + (y + 0.5) * 0.3 : y) + 0.65);
  }
  geometry.computeVertexNormals();
  return geometry;
};

const buildSlime: Builder = (kit, colors) => {
  const goo = kit.material(colors.primary, { opacity: 0.8, roughness: 0.15, metalness: 0.05, emissive: 0.12 });
  const core = kit.material(colors.team, { emissive: 0.5 });
  const white = kit.material(EYE_WHITE);
  const pupil = kit.material(PUPIL_COLOUR);

  const root = new THREE.Group();
  // Squash and stretch about the ground point
  const blob = pivot(root);
  part(blob, kit.track(slimeGeometry()), goo, ORIGIN, [0.3, 0.26, 0.3]);
  // A team coloured core floats inside the goo
  const nucleus = part(blob, kit.octa(), core, [0, 0.17, -0.02], 0.075);
  addEyes(kit, blob, white, 0.085, 0.27, 0.245, 0.05, pupil);
  part(blob, kit.sphere(), pupil, [0, 0.185, 0.29], [0.035, 0.014, 0.012]);
  for (const [x, z] of [[0.27, 0.09], [-0.25, 0.14], [0.06, -0.29]]) part(root, kit.sphere(), goo, [x, 0.02, z], [0.045, 0.03, 0.045]);

  return {
    root,
    death: 'custom',
    pose: (p) => {
      const t = p.time;
      const hop = Math.sin(t * 6.5);
      const air = Math.max(0, hop) * p.walk;
      // Positive stretches tall, negative squashes wide
      let stretch = Math.sin(t * 3.2) * 0.06 * (1 - p.walk) + air * 0.12 + Math.min(0, hop) * 0.14 * p.walk;
      stretch += -p.windup * 0.32 + p.lunge * 0.22 - p.tension * 0.05 + Math.sin(t * 7) * 0.02 * p.tension;
      stretch = lerp(stretch, -0.75, p.dead);
      blob.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);
      blob.position.set(0, (air * 0.13 + p.lunge * 0.1) * (1 - p.dead), p.lunge * 0.25);
      blob.rotation.x = p.lunge * 0.3 - p.windup * 0.1;
      nucleus.rotation.set(t * 0.7, t * 1.1, 0);
    }
  };
};

// --- Toad -------------------------------------------------------------------------------------

const buildFrog: Builder = (kit, colors) => {
  const skin = kit.material(colors.primary);
  const belly = kit.material(colors.secondary);
  const iris = kit.material(colors.accent, { emissive: 0.4 });
  const pupil = kit.material(PUPIL_COLOUR);
  const mouth = kit.material(MOUTH_COLOUR);
  const team = kit.material(colors.team, { emissive: 0.2 });

  const root = new THREE.Group();
  // Hops and leans; the feet stay on the root
  const body = pivot(root);
  const torso = pivot(body, [0, 0.16, -0.05], [-0.3, 0, 0]);
  part(torso, kit.sphere(), skin, ORIGIN, [0.2, 0.13, 0.21]);
  // Team stripe down the spine, and warts
  part(torso, kit.sphere(), team, [0, 0.12, -0.02], [0.05, 0.022, 0.15]);
  for (const [x, y, z] of [[0.1, 0.095, -0.07], [-0.11, 0.085, -0.03], [0.07, 0.1, 0.08], [-0.06, 0.105, -0.12]]) {
    part(torso, kit.sphere(), belly, [x, y, z], 0.022);
  }

  // Wide head: a dome over a hinged lower jaw, with big eyes on top
  const head = pivot(body, [0, 0.2, 0.12]);
  part(head, kit.dome(), skin, ORIGIN, [0.19, 0.1, 0.16]);
  part(head, kit.sphere(), mouth, [0, 0.002, 0.005], [0.17, 0.006, 0.14]);
  const jaw = pivot(head, [0, 0, -0.12]);
  part(jaw, kit.bowl(), belly, [0, 0, 0.12], [0.18, 0.07, 0.155]);
  part(jaw, kit.sphere(), mouth, [0, -0.004, 0.125], [0.165, 0.006, 0.135]);
  for (const side of SIDES) {
    part(head, kit.sphere(), skin, [side * 0.1, 0.075, 0.03], 0.062);
    part(head, kit.sphere(), iris, [side * 0.1, 0.09, 0.062], [0.045, 0.045, 0.035]);
    part(head, kit.sphere(), pupil, [side * 0.1, 0.092, 0.094], [0.028, 0.011, 0.01]);
  }
  const throat = part(body, kit.sphere(), belly, [0, 0.125, 0.15], [0.12, 0.06, 0.08]);

  // Big folded back legs and small front arms
  const thighs = SIDES.map((side) => {
    const thigh = pivot(body, [side * 0.15, 0.13, -0.1]);
    part(thigh, kit.sphere(), skin, [side * 0.03, -0.02, 0], [0.075, 0.085, 0.13], [0.3, 0, side * 0.2]);
    part(thigh, kit.sphere(), skin, [side * 0.06, -0.118, 0.11], [0.06, 0.014, 0.11]);
    return thigh;
  });
  for (const side of SIDES) {
    part(body, kit.limb(0.8), skin, [side * 0.11, 0.13, 0.17], [0.025, 0.12, 0.025], [0, 0, side * 0.15]);
    part(body, kit.sphere(), skin, [side * 0.125, 0.008, 0.19], [0.035, 0.008, 0.04]);
  }

  return {
    root,
    death: 'topple',
    deathLift: 0.15,
    pose: (p) => {
      const t = p.time;
      const hop = Math.max(0, Math.sin(t * 5.5)) * p.walk;
      body.position.set(0, hop * 0.14, p.lunge * 0.06);
      body.rotation.x = -hop * 0.25 + p.lunge * 0.3 - p.windup * 0.15 + p.tension * 0.06;
      for (const thigh of thighs) thigh.rotation.x = hop * 0.9;
      // Throat pulses at rest and puffs up before a spit
      const puff = 1 + Math.max(0, Math.sin(t * 3.1)) * 0.3 * (1 - p.walk) + p.windup * 0.5;
      throat.scale.set(0.12 * puff, 0.06 * puff, 0.08 * puff);
      head.rotation.x = -p.windup * 0.25 + p.lunge * 0.1 - p.tension * 0.05;
      jaw.rotation.x = p.lunge * 0.6 + p.windup * 0.08;
    }
  };
};

// --- Hydra ------------------------------------------------------------------------------------

const HYDRA_NECKS = [
  { base: [-0.1, 0.3, 0.13] as Vec3, spread: -0.17, height: 0.38, reach: 0.17 },
  { base: [0, 0.33, 0.16] as Vec3, spread: 0, height: 0.48, reach: 0.2 },
  { base: [0.1, 0.3, 0.13] as Vec3, spread: 0.17, height: 0.38, reach: 0.17 }
];

const buildHydra: Builder = (kit, colors) => {
  const scales = kit.material(colors.primary);
  const belly = kit.material(colors.secondary);
  const fin = kit.material(colors.accent);
  const eye = kit.glow(colors.glow, 1.3);
  const team = kit.material(colors.team, { emissive: 0.2 });

  const root = new THREE.Group();
  const body = pivot(root);
  part(body, kit.sphere(), scales, [0, 0.19, -0.06], [0.22, 0.15, 0.3]);
  part(body, kit.sphere(), belly, [0, 0.12, -0.02], [0.16, 0.06, 0.22]);
  [0.0, -0.12, -0.24].forEach((z, i) => part(body, kit.cone(4), fin, [0, 0.32 - i * 0.02, z], [0.03, 0.08 - i * 0.015, 0.05], [-0.5, 0, 0]));
  const legs = ([[1, 1], [-1, 1], [1, -1], [-1, -1]] as const).map(([x, z]) => addLeg(kit, root, scales, belly, [x * 0.17, 0.11, z * 0.13], 0.05));
  const tail = addTail(kit, body, scales, [0, 0.17, -0.32], 4, 0.08, 0.07);

  const necks = HYDRA_NECKS.map(({ base }) => {
    const neck = new Neck(kit, body, scales, 9, 0.065, 0.042);
    addCollar(kit, body, team, [base[0], base[1] + 0.01, base[2] + 0.005], 0.07, -1.1);
    part(neck.head, kit.sphere(), scales, [0, 0.01, -0.01], [0.06, 0.045, 0.07]);
    const jaw = addMuzzle(kit, neck.head, scales, belly, 0.03, [0.075, 0.06, 0.09], fin);
    addEyes(kit, neck.head, eye, 0.035, 0.03, 0.03, 0.016);
    for (const side of SIDES) part(neck.head, kit.cone(4), fin, [side * 0.03, 0.035, -0.04], [0.015, 0.07, 0.012], [-1.1, 0, -side * 0.3]);
    return { neck, jaw, base: new THREE.Vector3(...base) };
  });
  const control = new THREE.Vector3();
  const tip = new THREE.Vector3();

  return {
    root,
    death: 'topple',
    deathLift: 0.2,
    pose: (p) => {
      const t = p.time;
      const stride = t * 7;
      legs.forEach((leg, i) => (leg.rotation.x = Math.sin(stride + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 * p.walk));
      body.rotation.z = Math.sin(stride) * 0.04 * p.walk;
      body.position.y = Math.sin(t * 1.8) * 0.006 - p.tension * 0.015;
      tail.forEach((joint, k) => (joint.rotation.y = Math.sin(t * 2 - k * 0.8) * 0.2));
      tail[0].rotation.x = 0.35;

      necks.forEach(({ neck, jaw, base }, i) => {
        const spec = HYDRA_NECKS[i];
        // Heads strike one after another through the strike
        const local = clamp01((p.strikeProgress - i * 0.17) / 0.66);
        const windup = strikeWindup(local);
        const lunge = strikeLunge(local);
        const sway = Math.sin(t * 1.3 + i * 2.1);
        const drop = p.dead * spec.height * 0.85;
        tip.set(
          base.x + spec.spread + sway * 0.05,
          base.y + spec.height + Math.sin(t * 1.7 + i) * 0.02 + windup * 0.06 - lunge * 0.2 - p.tension * 0.03 - drop,
          base.z + spec.reach + lunge * 0.28 - windup * 0.1 - p.tension * 0.04 + p.dead * 0.1
        );
        control.set(base.x + spec.spread * 0.4 - sway * 0.03, base.y + (spec.height - drop) * 0.9, base.z - 0.02);
        neck.place(base, control, tip, 0.35 + lunge * 0.3);
        jaw.rotation.x = p.tension * 0.1 + windup * 0.65 + Math.max(0, Math.sin(t * 2 + i * 2)) * 0.08;
      });
    }
  };
};

// --- Scorpion ---------------------------------------------------------------------------------

const buildScorpion: Builder = (kit, colors) => {
  const shell = kit.material(colors.primary);
  const dark = kit.material(colors.secondary);
  const sting = kit.material(colors.accent);
  const venom = kit.glow(colors.glow, 1);
  const team = kit.material(colors.team, { emissive: 0.3 });

  const root = new THREE.Group();
  const body = pivot(root);
  // Carapace and the plates behind it
  part(body, kit.sphere(), shell, [0, 0.14, 0.1], [0.13, 0.065, 0.13]);
  part(body, kit.sphere(), team, [0, 0.198, 0.08], [0.055, 0.014, 0.07]);
  for (const [z, w, h, d] of [[-0.04, 0.125, 0.07, 0.08], [-0.13, 0.115, 0.068, 0.07], [-0.21, 0.1, 0.065, 0.06]]) {
    part(body, kit.sphere(), shell, [0, 0.145, z], [w, h, d]);
    part(body, kit.box(), dark, [0, 0.145 + h * 0.85, z - d * 0.6], [w * 1.1, 0.012, 0.02]);
  }
  for (const [x, y] of [[0.025, 0.19], [0.06, 0.175]]) {
    for (const side of SIDES) part(body, kit.sphere(), venom, [side * x, y, 0.2], 0.014);
  }

  const legs: JointedLeg[] = [];
  const HIP_Z = [0.08, 0.03, -0.03, -0.09];
  const ANGLES = [0.5, 0.1, -0.35, -0.75];
  for (const side of SIDES) {
    HIP_Z.forEach((z, k) => legs.push(addJointedLeg(kit, body, shell, dark, [side * 0.09, 0.13, z], side, k, ANGLES[k], 0.13, 0.6, 0.09, 0.018)));
  }

  // Pincers: shoulder, forearm and a claw with one moving finger
  const pincers = SIDES.map((side) => {
    const shoulder = pivot(body, [side * 0.08, 0.13, 0.19], [-0.15, side * 0.55, 0]);
    part(shoulder, kit.segment(0.8), shell, ORIGIN, [0.03, 0.03, 0.13]);
    const elbow = pivot(shoulder, [0, 0, 0.13], [0, -side * 0.9, 0]);
    part(elbow, kit.sphere(), shell, ORIGIN, 0.035);
    part(elbow, kit.segment(0.85), shell, ORIGIN, [0.032, 0.032, 0.1]);
    const claw = pivot(elbow, [0, 0, 0.1], [0, side * 0.2, 0]);
    part(claw, kit.sphere(), shell, [0, 0, 0.05], [0.05, 0.042, 0.075]);
    part(claw, kit.cone(4), dark, [side * 0.022, 0, 0.1], [0.022, 0.1, 0.018], [Math.PI / 2, 0, 0]);
    const finger = pivot(claw, [-side * 0.022, 0, 0.09]);
    part(finger, kit.cone(4), dark, ORIGIN, [0.02, 0.09, 0.016], [Math.PI / 2, 0, 0]);
    return { shoulder, finger, side };
  });

  // Tail arching up over the back, ending in a venom bulb and stinger
  const TAIL_BEND = [-1, 0.5, 0.5, 0.5, 0.5];
  const tail: THREE.Group[] = [];
  let joint: THREE.Object3D = body;
  let position: Vec3 = [0, 0.16, -0.26];
  TAIL_BEND.forEach((bend, k) => {
    const segment = pivot(joint, position, [bend, 0, 0]);
    const r = 0.05 - k * 0.004;
    part(segment, kit.sphere(), shell, [0, 0.05, 0], [r, 0.065, r * 0.9]);
    tail.push(segment);
    joint = segment;
    position = [0, 0.1, 0];
  });
  const stinger = pivot(joint, [0, 0.1, 0], [0.9, 0, 0]);
  part(stinger, kit.sphere(), venom, [0, 0.03, 0], [0.04, 0.045, 0.04]);
  part(stinger, kit.cone(4), sting, [0, 0.06, 0], [0.018, 0.08, 0.018]);

  return {
    root,
    death: 'custom',
    pose: (p) => {
      const t = p.time;
      const stride = t * 12;
      for (const leg of legs) {
        const phase = stride + ((leg.index + (leg.side > 0 ? 0 : 1)) % 2) * Math.PI;
        const lift = Math.max(0, Math.sin(phase)) * 0.3 * p.walk + p.dead * 0.8;
        leg.yaw.rotation.y = leg.baseYaw - Math.cos(phase) * 0.2 * p.walk * leg.side;
        leg.lift.rotation.x = -(leg.elevation + lift);
        leg.knee.rotation.x = leg.baseKnee + p.dead * 0.9;
      }
      body.position.y = Math.abs(Math.sin(stride)) * 0.008 * p.walk - p.dead * 0.08;

      for (const { shoulder, finger, side } of pincers) {
        shoulder.rotation.x = -0.15 - p.tension * 0.25 + Math.sin(t * 1.2 + side) * 0.05 + Math.sin(stride * 0.5) * 0.08 * p.walk + p.dead * 0.2;
        // Claws snap open and shut while threatening
        const snap = 0.12 + p.tension * 0.3 * (0.5 + 0.5 * Math.sin(t * 6 + side)) + p.windup * 0.3 - p.lunge * 0.12;
        finger.rotation.y = -side * snap;
      }

      // Tail curls back on the wind-up then whips the stinger forward over the head
      tail[0].rotation.x = lerp(-1 - p.windup * 0.3 + p.lunge * 0.55 + p.tension * 0.05, -1.55, p.dead);
      for (let k = 1; k < tail.length; k++) {
        tail[k].rotation.x = lerp(TAIL_BEND[k] + Math.sin(t * 1.5 - k * 0.5) * 0.04 - p.windup * 0.1 + p.lunge * 0.18, 0.05, p.dead);
      }
      stinger.rotation.x = 0.9 + p.lunge * 0.3;
    }
  };
};

// --- Golem ------------------------------------------------------------------------------------

const buildGolem: Builder = (kit, colors, variant) => {
  const magma = variant === 'magma';
  const stone = kit.material(colors.primary, { roughness: 0.9 });
  const lava = kit.glow(colors.glow, 1.5);
  const eye = kit.glow(colors.glow, 1.4);
  const gem = kit.material(colors.team, { emissive: 0.6, metalness: 0.3, roughness: 0.3 });
  // Sandstone is rounded; magma rock is sharp with lava seeping between its faces
  const rockGeometry = magma ? kit.dodeca() : kit.ico(1);
  let seed = 0;
  const rock = (parent: THREE.Object3D, position: Vec3, scale: Vec3) => {
    seed++;
    const rotation: Vec3 = [hash(seed) * TAU, hash(seed + 0.5) * TAU, 0];
    const mesh = part(parent, rockGeometry, stone, position, scale, rotation);
    if (magma) part(parent, kit.ico(0), lava, position, [scale[0] * 0.92, scale[1] * 0.92, scale[2] * 0.92], [rotation[1], rotation[0], 0.7]);
    return mesh;
  };

  const root = new THREE.Group();
  const legs = SIDES.map((side) => {
    const hip = pivot(root, [side * 0.14, 0.3, 0]);
    rock(hip, [0, -0.1, 0], [0.1, 0.11, 0.1]);
    rock(hip, [0, -0.22, 0.03], [0.12, 0.08, 0.14]);
    return hip;
  });
  // Hips sway and bob; the torso bends at the waist for the slam
  const hips = pivot(root);
  rock(hips, [0, 0.34, 0], [0.17, 0.1, 0.13]);
  const torso = pivot(hips, [0, 0.38, 0]);
  rock(torso, [0, 0.24, 0], [0.28, 0.25, 0.22]);
  part(torso, kit.octa(), gem, [0, 0.27, 0.2], [0.055, 0.07, 0.04]);
  const head = pivot(torso, [0, 0.5, 0.06]);
  rock(head, ORIGIN, [0.11, 0.1, 0.1]);
  part(head, kit.box(), stone, [0, 0.04, 0.075], [0.14, 0.03, 0.04]);
  addEyes(kit, head, eye, 0.04, 0.005, 0.085, 0.02);
  if (!magma) {
    // Strata bands across the sandstone chest
    for (const [y, r] of [[0.16, 0.27], [0.32, 0.25]]) part(torso, kit.torus(0.08), kit.material(colors.secondary), [0, y, 0], [r, r * 0.8, 0.5], [Math.PI / 2, 0, 0]);
  }

  const arms = SIDES.map((side) => {
    const shoulder = pivot(torso, [side * 0.31, 0.36, 0], [0, 0, side * 0.12]);
    rock(shoulder, ORIGIN, [0.13, 0.12, 0.13]);
    rock(shoulder, [0, -0.15, 0], [0.08, 0.1, 0.08]);
    rock(shoulder, [0, -0.32, 0.02], [0.14, 0.13, 0.14]);
    return { shoulder, side };
  });

  return {
    root,
    death: 'forward',
    deathLift: 0.22,
    pose: (p) => {
      const t = p.time;
      const step = t * 3.2;
      legs.forEach((leg, i) => (leg.rotation.x = Math.sin(step + i * Math.PI) * 0.35 * p.walk));
      hips.position.y = Math.abs(Math.sin(step)) * 0.03 * p.walk - p.tension * 0.03 - p.lunge * 0.06 + Math.sin(t * 1.6) * 0.005;
      hips.rotation.z = Math.sin(step) * 0.06 * p.walk;
      hips.rotation.y = Math.sin(step) * 0.08 * p.walk;
      torso.rotation.x = p.lunge * 0.35 - p.windup * 0.15 + p.tension * 0.08 + Math.sin(t * 1.6) * 0.012;
      head.rotation.y = Math.sin(t * 0.6) * 0.2 * (1 - p.tension);
      // Two-armed slam: fists raised overhead on the wind-up, brought down in front on the hit
      arms.forEach(({ shoulder, side }, i) => {
        shoulder.rotation.x = -Math.sin(step + i * Math.PI) * 0.3 * p.walk - p.tension * 0.35 - p.windup * 2.4 - p.lunge * 1.1;
        shoulder.rotation.z = side * (0.12 + p.tension * 0.08 - p.windup * 0.25);
      });
    }
  };
};

// --- Wisps ------------------------------------------------------------------------------------

const HOVER_HEIGHT = 0.25;

// Ghost sheet: a teardrop lathe whose tail curls backwards
const ghostGeometry = (): THREE.BufferGeometry => {
  const profile = [[0, 0], [0.05, 0.06], [0.11, 0.16], [0.16, 0.28], [0.195, 0.4], [0.21, 0.52], [0.19, 0.63], [0.12, 0.71], [0, 0.74]].map(
    ([x, y]) => new THREE.Vector2(x, y)
  );
  const geometry = new THREE.LatheGeometry(profile, 10);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y < 0.3) {
      // Curl the tail back and off to one side so it shows from the front
      const curl = (0.3 - y) ** 2;
      position.setZ(i, position.getZ(i) - curl * 1.2);
      position.setX(i, position.getX(i) + curl * 1.6);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
};

const buildWisp: Builder = (kit, colors, variant) => {
  const kind = variant === 'ice' || variant === 'fire' ? variant : 'ghost';
  const team = kit.material(colors.team, { emissive: 0.5 });
  const hole = kit.material(PUPIL_COLOUR);
  const root = new THREE.Group();
  const hover = pivot(root, [0, HOVER_HEIGHT, 0]);
  // Extra per-variant motion
  let animate: (p: Pose) => void;

  if (kind === 'ghost') {
    const sheet = kit.material(colors.primary, { opacity: 0.8, emissive: 0.35 });
    const spark = kit.glow(colors.glow, 1.5);
    const body = pivot(hover);
    part(body, kit.track(ghostGeometry()), sheet);
    for (const side of SIDES) {
      part(body, kit.sphere(), hole, [side * 0.075, 0.55, 0.185], [0.035, 0.05, 0.025], [0, side * 0.35, 0]);
      part(body, kit.sphere(), spark, [side * 0.075, 0.545, 0.2], 0.012);
    }
    part(body, kit.sphere(), hole, [0, 0.44, 0.2], [0.055, 0.025, 0.02]);
    addCollar(kit, body, team, [0, 0.3, -0.01], 0.165, Math.PI / 2);
    const arms = SIDES.map((side) => {
      const arm = pivot(body, [side * 0.18, 0.44, 0.02]);
      part(arm, kit.cone(5), sheet, ORIGIN, [0.05, 0.18, 0.04], [0, 0, -side * 2.3]);
      return { arm, side };
    });
    animate = (p) => {
      body.rotation.z = Math.sin(p.time * 1.7) * 0.06;
      for (const { arm, side } of arms) {
        arm.rotation.z = side * (Math.sin(p.time * 2.4 + side) * 0.2 + p.tension * 0.4 + p.windup * 1.2 - p.lunge * 0.3);
      }
    };
  } else if (kind === 'ice') {
    const shard = kit.material(colors.primary, { opacity: 0.85, roughness: 0.1, metalness: 0.2, emissive: 0.3 });
    const core = kit.glow(colors.glow, 1.4);
    const heart = part(hover, kit.ico(0), core, [0, 0.38, 0], 0.12);
    addEyes(kit, hover, hole, 0.042, 0.4, 0.1, 0.022);
    part(hover, kit.octa(), shard, [0, 0.17, 0], [0.09, 0.2, 0.09]);
    part(hover, kit.octa(), shard, [0, 0.57, -0.02], [0.05, 0.14, 0.05]);
    for (const side of SIDES) part(hover, kit.octa(), shard, [side * 0.075, 0.52, -0.01], [0.035, 0.1, 0.035], [0, 0, -side * 0.45]);
    const halo = part(hover, kit.torus(0.1), team, [0, 0.38, 0], 0.2, [Math.PI / 2 + 0.25, 0, 0]);
    // Shards orbiting the core
    const orbit = pivot(hover, [0, 0.36, 0]);
    const shards = Array.from({ length: 6 }, (_, k) => {
      const angle = (k / 6) * TAU;
      return part(orbit, kit.octa(), shard, [Math.cos(angle) * 0.27, Math.sin(k * 1.7) * 0.13, Math.sin(angle) * 0.27], [0.035, 0.09, 0.035], [k * 0.7, 0, 0.4]);
    });
    animate = (p) => {
      orbit.rotation.y = p.time * (0.9 + p.tension * 1.5 + p.windup * 4);
      shards.forEach((s, k) => (s.rotation.y = p.time * 2 + k));
      heart.rotation.set(p.time * 0.5, p.time * 0.8, 0);
      halo.rotation.z = p.time * 0.6;
    };
  } else {
    const ember = kit.glow(colors.glow, 1.5);
    const flameMaterials = [
      kit.glow(colors.secondary, 1.1),
      kit.glow(colors.primary, 1.2),
      kit.glow(colors.accent, 1.4)
    ];
    // Base blob, body cone, bright tip and three side licks
    const flames = [
      part(hover, kit.ico(1), flameMaterials[0], [0, 0.22, 0], [0.17, 0.15, 0.17]),
      part(hover, kit.cone(6), flameMaterials[1], [0, 0.12, 0], [0.16, 0.44, 0.16]),
      part(hover, kit.cone(5), flameMaterials[2], [0, 0.3, 0.02], [0.1, 0.34, 0.1]),
      ...[0, 1, 2].map((k) => {
        const angle = (k / 3) * TAU + 0.5;
        return part(hover, kit.cone(4), flameMaterials[1 + (k % 2)], [Math.cos(angle) * 0.11, 0.2, Math.sin(angle) * 0.11 - 0.03], [0.055, 0.24, 0.055], [Math.sin(angle) * 0.5, 0, -Math.cos(angle) * 0.5]);
      })
    ];
    const heights = flames.map((flame) => flame.scale.y);
    addEyes(kit, hover, hole, 0.05, 0.27, 0.15, 0.026);
    addCollar(kit, hover, team, [0, 0.1, 0], 0.17, Math.PI / 2);
    const embers = Array.from({ length: 4 }, () => part(hover, kit.octa(), ember, ORIGIN, 0.02));
    animate = (p) => {
      const t = p.time;
      flames.forEach((flame, i) => {
        const flicker = 1 + Math.sin(t * 11 + i * 1.7) * 0.12 + Math.sin(t * 23 + i * 3.1) * 0.06 + p.windup * 0.3;
        flame.scale.y = heights[i] * flicker;
      });
      embers.forEach((e, k) => {
        const rise = (t * 0.6 + k / 4) % 1;
        const angle = k * 1.6 + t * 1.5;
        e.position.set(Math.cos(angle) * 0.14, 0.3 + rise * 0.6, Math.sin(angle) * 0.14);
        e.scale.setScalar(0.025 * (1 - rise) + 0.003);
      });
    };
  }

  return {
    root,
    death: 'fade',
    pose: (p) => {
      const t = p.time;
      hover.position.set(
        0,
        lerp(HOVER_HEIGHT + Math.sin(t * 2.2) * 0.04 + p.windup * 0.05 - p.lunge * 0.05, 0.02, p.dead),
        p.lunge * 0.3 - p.windup * 0.08
      );
      hover.rotation.x = p.lunge * 0.35 - p.windup * 0.15 + p.walk * 0.15;
      hover.rotation.z = Math.sin(t * 1.3) * 0.05;
      hover.scale.setScalar(1 + p.windup * 0.15 + Math.sin(t * 5) * 0.015 * p.tension);
      animate(p);
    }
  };
};

// --- Imp --------------------------------------------------------------------------------------

const buildImp: Builder = (kit, colors) => {
  const skin = kit.material(colors.primary);
  const belly = kit.material(colors.secondary);
  const membrane = kit.material(colors.secondary, { doubleSide: true });
  const claw = kit.material(colors.accent);
  const eye = kit.glow(colors.glow, 1.4);
  const mouth = kit.material(MOUTH_COLOUR);
  const team = kit.material(colors.team, { emissive: 0.3 });

  const root = new THREE.Group();
  const hover = pivot(root, [0, 0.08, 0]);
  const body = pivot(hover);
  part(body, kit.sphere(), skin, [0, 0.3, 0], [0.1, 0.12, 0.09]);
  part(body, kit.sphere(), belly, [0, 0.28, 0.04], [0.075, 0.085, 0.06]);
  addCollar(kit, body, team, [0, 0.235, 0], 0.095, Math.PI / 2);

  const head = pivot(body, [0, 0.47, 0.02]);
  part(head, kit.sphere(), skin, ORIGIN, [0.11, 0.1, 0.1]);
  const horns = buildHorns(kit, claw, 0.09);
  horns.position.set(0, 0.07, -0.01);
  head.add(horns);
  for (const side of SIDES) part(head, kit.cone(4), skin, [side * 0.1, 0.01, -0.01], [0.025, 0.08, 0.02], [0, 0, -side * 1.3]);
  addEyes(kit, head, eye, 0.042, 0.015, 0.085, 0.022);
  part(head, kit.box(), mouth, [0, -0.045, 0.088], [0.07, 0.012, 0.01]);
  for (const side of SIDES) part(head, kit.cone(4), claw, [side * 0.022, -0.04, 0.093], [0.008, 0.022, 0.008], [Math.PI, 0, 0]);
  part(head, kit.sphere(), skin, [0, -0.012, 0.1], 0.016);

  const arms = SIDES.map((side) => {
    const shoulder = pivot(body, [side * 0.1, 0.37, 0], [0, 0, side * 0.3]);
    part(shoulder, kit.limb(0.7), skin, ORIGIN, [0.025, 0.14, 0.025]);
    for (const x of [-0.012, 0, 0.012]) part(shoulder, kit.cone(4), claw, [x, -0.14, 0.01], [0.007, 0.035, 0.007], [Math.PI - 0.4, 0, 0]);
    return { shoulder, side };
  });
  const legs = SIDES.map((side) => {
    const hip = pivot(body, [side * 0.05, 0.2, 0]);
    part(hip, kit.limb(0.7), skin, ORIGIN, [0.03, 0.12, 0.03]);
    part(hip, kit.sphere(), belly, [0, -0.13, 0.01], [0.032, 0.02, 0.04]);
    return hip;
  });
  const wings = addBatWings(kit, body, skin, membrane, claw, [0.04, 0.38, -0.07], 0.28);
  const tail = addTail(kit, body, skin, [0, 0.22, -0.08], 4, 0.07, 0.016);
  part(tail[tail.length - 1], kit.cone(3), claw, ORIGIN, [0.03, 0.05, 0.01], [Math.PI / 2, 0, 0]);
  let flap = 0;

  return {
    root,
    death: 'topple',
    deathLift: 0.06,
    pose: (p) => {
      const t = p.time;
      flap += p.delta * (11 + p.walk * 4);
      wings.set(Math.sin(flap) * 0.6 + 0.15, 0.35 - p.windup * 0.2);
      hover.position.set(
        0,
        (0.08 + Math.sin(flap) * 0.02 + Math.sin(t * 1.4) * 0.02 + p.windup * 0.1 - p.lunge * 0.07) * (1 - p.dead),
        -p.windup * 0.06 + p.lunge * 0.2
      );
      body.rotation.x = p.walk * 0.25 + p.lunge * 0.45 - p.windup * 0.3 + p.tension * 0.08;
      head.rotation.x = -p.lunge * 0.2 + p.windup * 0.1;
      head.rotation.y = Math.sin(t * 0.9) * 0.3 * (1 - p.tension);
      // Claws raised high, then slashed down in front
      for (const { shoulder, side } of arms) {
        shoulder.rotation.x = Math.sin(t * 2 + side) * 0.1 - p.tension * 0.5 - p.windup * 2.2 + p.lunge * 0.3;
        shoulder.rotation.z = side * (0.3 + p.windup * 0.3 - p.lunge * 0.5);
      }
      legs.forEach((leg, i) => (leg.rotation.x = Math.sin(t * 3 + i) * 0.1 + p.walk * 0.4 + p.lunge * 0.3));
      tail.forEach((joint, k) => {
        joint.rotation.y = Math.sin(t * 2.5 - k * 0.8) * 0.25;
        joint.rotation.x = k === 0 ? 0.7 : -0.45;
      });
    }
  };
};

// --- Dragons ----------------------------------------------------------------------------------

interface DragonSpec {
  torso: Vec3;
  torsoY: number;
  pitch: number; // torso tilt, negative raises the chest
  legs: Vec3[]; // hip positions on the right side
  legRadius: number;
  wing: { shoulder: Vec3; length: number };
  neck: { base: Vec3; tip: Vec3; count: number; radius: [number, number] };
  headScale: number;
  horns: number;
  tail: { count: number; length: number; radius: number };
  spines: number;
}

const DRAGONS: Record<'wyvern' | 'drake' | 'elder', DragonSpec> = {
  wyvern: {
    torso: [0.12, 0.12, 0.22], torsoY: 0.4, pitch: -0.3,
    legs: [[0.09, 0.3, -0.06]], legRadius: 0.045,
    wing: { shoulder: [0.08, 0.5, 0.06], length: 0.55 },
    neck: { base: [0, 0.48, 0.17], tip: [0, 0.74, 0.3], count: 5, radius: [0.06, 0.045] },
    headScale: 0.9, horns: 0.05, tail: { count: 6, length: 0.08, radius: 0.05 }, spines: 0
  },
  drake: {
    torso: [0.16, 0.14, 0.26], torsoY: 0.32, pitch: -0.05,
    legs: [[0.11, 0.22, 0.14], [0.11, 0.22, -0.14]], legRadius: 0.055,
    wing: { shoulder: [0.1, 0.42, 0.06], length: 0.32 },
    neck: { base: [0, 0.38, 0.22], tip: [0, 0.58, 0.38], count: 4, radius: [0.075, 0.06] },
    headScale: 1, horns: 0.07, tail: { count: 5, length: 0.085, radius: 0.06 }, spines: 5
  },
  elder: {
    torso: [0.2, 0.18, 0.32], torsoY: 0.4, pitch: -0.08,
    legs: [[0.14, 0.28, 0.17], [0.14, 0.28, -0.17]], legRadius: 0.07,
    wing: { shoulder: [0.12, 0.52, 0.08], length: 0.62 },
    neck: { base: [0, 0.48, 0.28], tip: [0, 0.84, 0.44], count: 6, radius: [0.09, 0.07] },
    headScale: 1.3, horns: 0.13, tail: { count: 6, length: 0.095, radius: 0.075 }, spines: 7
  }
};

const buildDragon: Builder = (kit, colors, variant) => {
  const kind = variant === 'wyvern' || variant === 'elder' ? variant : 'drake';
  const spec = DRAGONS[kind];
  const scales = kit.material(colors.primary);
  const belly = kit.material(colors.secondary);
  const membrane = kit.material(colors.secondary, { doubleSide: true });
  const horn = kit.material(colors.accent);
  const eye = kit.glow(colors.glow, 1.4);
  const fire = kit.glow(colors.glow, 1.5);
  const team = kit.material(colors.team, { emissive: 0.25 });

  const root = new THREE.Group();
  const body = pivot(root);
  const torso = pivot(body, [0, spec.torsoY, 0], [spec.pitch, 0, 0]);
  part(torso, kit.sphere(), scales, ORIGIN, spec.torso);
  part(torso, kit.sphere(), belly, [0, -spec.torso[1] * 0.35, 0.02], [spec.torso[0] * 0.85, spec.torso[1] * 0.7, spec.torso[2] * 0.9]);
  for (let i = 0; i < spec.spines; i++) {
    const z = spec.torso[2] * (0.55 - (i / Math.max(1, spec.spines - 1)) * 1.2);
    const y = spec.torso[1] * Math.sqrt(Math.max(0, 1 - (z / spec.torso[2]) ** 2)) - 0.01;
    part(torso, kit.cone(4), horn, [0, y, z], [0.025, 0.07 + (i % 2) * 0.02, 0.035], [-0.45, 0, 0]);
  }

  const legs = spec.legs.flatMap(([x, y, z]) =>
    SIDES.map((side) => {
      const hip = addLeg(kit, root, scales, belly, [side * x, y, z], spec.legRadius);
      part(hip, kit.sphere(), scales, [0, -0.03, 0], [spec.legRadius * 1.5, spec.legRadius * 2.2, spec.legRadius * 1.8]);
      for (const toe of [-1, 0, 1]) {
        part(hip, kit.cone(4), horn, [toe * spec.legRadius * 0.7, -y + 0.01, spec.legRadius * 1.6], [0.01, 0.035, 0.01], [Math.PI / 2, 0, 0]);
      }
      return hip;
    })
  );

  const wings = addBatWings(kit, body, scales, membrane, horn, spec.wing.shoulder, spec.wing.length);
  const tail = addTail(kit, body, scales, [0, spec.torsoY - 0.02, -spec.torso[2] * 0.85], spec.tail.count, spec.tail.length, spec.tail.radius, spec.spines > 0 ? horn : undefined);
  part(tail[tail.length - 1], kit.octa(), horn, [0, 0, 0.02], [0.05, 0.012, 0.06]);

  const neck = new Neck(kit, body, scales, spec.neck.count, spec.neck.radius[0], spec.neck.radius[1]);
  const [bx, by, bz] = spec.neck.base;
  addCollar(kit, body, team, [bx, by + 0.02, bz + 0.01], spec.neck.radius[0] * 1.15, -1.0);
  const head = pivot(neck.head);
  head.scale.setScalar(spec.headScale);
  part(head, kit.sphere(), scales, [0, 0.01, -0.01], [0.075, 0.065, 0.085]);
  const jaw = addMuzzle(kit, head, scales, belly, 0.04, [0.1, 0.075, 0.12], horn, kit.material(PUPIL_COLOUR));
  addEyes(kit, head, eye, 0.045, 0.035, 0.045, 0.02);
  // Brow ridges and swept-back horns
  for (const side of SIDES) part(head, kit.box(), scales, [side * 0.045, 0.06, 0.04], [0.04, 0.015, 0.03], [0.2, 0, -side * 0.3]);
  const horns = buildHorns(kit, horn, spec.horns / spec.headScale);
  horns.position.set(0, 0.05, -0.04);
  horns.rotation.x = -1;
  head.add(horns);
  // Fire glowing at the back of the throat
  const ember = part(head, kit.sphere(), fire, [0, -0.02, 0.09], 0.03);

  const base = new THREE.Vector3(bx, by, bz);
  const control = new THREE.Vector3();
  const tip = new THREE.Vector3();
  let flap = 0;
  let flapPower = 0.15;

  return {
    root,
    death: 'topple',
    deathLift: spec.torso[0] * 0.8,
    pose: (p) => {
      const t = p.time;
      const stride = t * 8;
      legs.forEach((leg, i) => {
        const pair = legs.length === 2 ? i : (i % 2) + Math.floor(i / 2);
        leg.rotation.x = Math.sin(stride + pair * Math.PI) * 0.5 * p.walk;
      });
      body.position.y = Math.abs(Math.sin(stride)) * 0.02 * p.walk - p.tension * 0.02;
      torso.scale.y = 1 + Math.sin(t * 2) * 0.03;
      body.position.z = p.lunge * 0.05;

      // Lazy beats at rest, strong ones on the move; wings spread wide when threatening
      flapPower = approach(flapPower, 0.12 + p.walk * 0.45 + p.tension * 0.1, 4, p.delta);
      flap += p.delta * lerp(1.8, 9, p.walk);
      const fold = lerp(0.9, 0.15, Math.max(p.walk, p.tension * 0.8));
      wings.set(Math.sin(flap) * flapPower + 0.2 + p.tension * 0.25 + p.windup * 0.4 - p.dead * 0.4, fold - p.windup * 0.2);

      // Neck rears back on the wind-up then lunges with the jaws wide
      tip.set(
        spec.neck.tip[0] + Math.sin(t * 0.8) * 0.04 * (1 - p.tension),
        spec.neck.tip[1] + Math.sin(t * 1.6) * 0.015 + p.windup * 0.06 - p.lunge * 0.14 - p.tension * 0.04 - p.dead * 0.25,
        spec.neck.tip[2] + p.lunge * 0.22 - p.windup * 0.1 - p.tension * 0.03
      );
      control.set(base.x, lerp(base.y, tip.y, 0.85), base.z + (tip.z - base.z) * 0.2);
      neck.place(base, control, tip, 0.2 + p.tension * 0.1 + p.lunge * 0.2);
      jaw.rotation.x = p.tension * 0.12 + p.windup * 0.3 + p.lunge * 0.55;
      ember.scale.setScalar(0.03 + p.lunge * 0.03 + p.tension * 0.005 * (1 + Math.sin(t * 9)));

      tail.forEach((joint, k) => {
        joint.rotation.y = Math.sin(t * 1.6 - k * 0.7) * 0.12 * (1 + p.walk);
        joint.rotation.x = k === 0 ? 0.35 : -0.05;
      });
    }
  };
};

const BUILDERS: Record<CreatureBody, Builder> = {
  quadruped: buildQuadruped,
  spider: buildSpider,
  slime: buildSlime,
  frog: buildFrog,
  hydra: buildHydra,
  scorpion: buildScorpion,
  golem: buildGolem,
  wisp: buildWisp,
  imp: buildImp,
  dragon: buildDragon
};

// ---------------------------------------------------------------------------------------------
// Rig

export const createCreature = (look: CreatureLook, teamColor: string): CreatureRig => {
  const kit = new Kit();
  const { primary } = look.colors;
  const colors: Palette = {
    primary,
    secondary: look.colors.secondary ?? shade(primary, 0.65),
    accent: look.colors.accent ?? '#f4ecd8',
    glow: look.colors.glow ?? look.colors.accent ?? '#ffe066',
    team: teamColor
  };
  const body = BUILDERS[look.body](kit, colors, look.variant);

  const object = new THREE.Group();
  object.name = `creature-${look.body}${look.variant ? `-${look.variant}` : ''}`;
  object.scale.setScalar(look.scale);
  // Collapses on death about the feet
  const fall = pivot(object);
  fall.add(body.root);

  let state: CreatureState = 'idle';
  let strikeTime = 0;
  let strikeDuration = 0;
  let deathTime = 0;
  let shadows = true;
  const setShadows = (on: boolean) => {
    if (on === shadows) return;
    shadows = on;
    body.root.traverse((child) => (child.castShadow = on));
  };
  const pose: Pose = { time: 0, delta: 0, walk: 0, tension: 0, windup: 0, lunge: 0, strikeProgress: 1, dead: 0 };

  const update = (delta: number) => {
    const dt = Math.min(Math.max(delta, 0), 0.1);
    pose.walk = approach(pose.walk, state === 'walk' ? 1 : 0, 8, dt);
    pose.tension = approach(pose.tension, state === 'hold' || state === 'attack' ? 1 : 0, 6, dt);
    if (state === 'death') deathTime += dt;
    pose.dead = clamp01(deathTime / DEATH_SECONDS);
    // Motion winds down as the creature dies
    const life = 1 - pose.dead;
    pose.delta = dt * life;
    pose.time += pose.delta;

    strikeTime += dt;
    pose.strikeProgress = strikeDuration > 0 ? clamp01(strikeTime / strikeDuration) : 1;
    pose.windup = strikeWindup(pose.strikeProgress);
    pose.lunge = strikeLunge(pose.strikeProgress);

    body.pose(pose);

    // Falls faster as it goes, like a toppling weight
    const drop = pose.dead * pose.dead;
    const lift = (body.deathLift ?? 0) * drop;
    if (body.death === 'topple') {
      fall.rotation.z = drop * Math.PI * 0.48;
      fall.position.y = lift;
    } else if (body.death === 'forward') {
      fall.rotation.x = drop * Math.PI * 0.45;
      fall.position.y = lift;
    } else if (body.death === 'fade' && deathTime > 0) {
      kit.setOpacity(1 - pose.dead);
      fall.scale.setScalar(1 - pose.dead * 0.4);
      setShadows(pose.dead < 0.5);
      fall.visible = pose.dead < 1;
    }
  };

  update(0);

  return {
    object,
    setState(next) {
      if (next === state) return;
      if (next === 'death') {
        // A dying creature drops whatever strike it was in the middle of
        strikeDuration = 0;
      } else if (state === 'death') {
        deathTime = 0;
        fall.rotation.set(0, 0, 0);
        fall.position.set(0, 0, 0);
        fall.scale.setScalar(1);
        fall.visible = true;
        setShadows(true);
        if (body.death === 'fade') kit.setOpacity(1);
      }
      state = next;
    },
    strike(duration) {
      if (state === 'death') return;
      strikeTime = 0;
      strikeDuration = Math.max(0.1, duration);
    },
    update,
    dispose() {
      object.removeFromParent();
      kit.dispose();
    }
  };
};

// ---------------------------------------------------------------------------------------------
// Parts for character models

// Feathered wings to attach to a model (a demon lord or a pegasus): two wings meeting at the origin,
// spread along ±x and trailing back towards -z. `flap(speed, delta)` beats them, where speed is the
// beat rate in radians per second (about 2 for a lazy idle, 8-10 in flight; 0 settles them at rest).
export const createWings = (color: string, span: number) => {
  const kit = new Kit();
  const feather = kit.material(color, { doubleSide: true });
  const covert = kit.material(shade(color, 1.15), { doubleSide: true });
  const bone = kit.material(shade(color, 0.85));
  // Flattened four-sided cone from z = 0 back to its point at z = -1
  const featherGeometry = kit.track(
    new THREE.ConeGeometry(1, 1, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.5).scale(1, 0.2, 1)
  );
  const length = span / 2;
  const PRIMARIES = 8;
  const object = new THREE.Group();
  object.name = 'wings';

  const hinges = SIDES.map((side) => {
    const hinge = pivot(mirrored(object, side));
    // Trailing edge droops so the wing shows its face to a camera above and behind
    const wing = pivot(hinge, ORIGIN, [-0.35, 0, 0]);
    // Arm along the leading edge, a broad bed of coverts, then long flight feathers fanning out to the tip
    part(wing, kit.sphere(), bone, [length * 0.48, 0, -length * 0.02], [length * 0.5, length * 0.05, length * 0.07], [0, -0.1, 0]);
    part(wing, kit.sphere(), covert, [length * 0.45, -length * 0.01, -length * 0.15], [length * 0.47, length * 0.035, length * 0.17], [0, -0.22, 0]);
    for (let i = 0; i < PRIMARIES; i++) {
      const f = i / (PRIMARIES - 1);
      const x = length * (0.12 + 0.86 * f);
      const z = -length * (0.08 + 0.12 * f);
      part(wing, featherGeometry, feather, [x, -length * 0.02, z], [length * 0.13, length * 0.12, length * (0.32 + 0.4 * f)], [0, 0.05 - f * 0.95, 0]);
      part(wing, featherGeometry, covert, [x * 0.9, 0, z * 0.6], [length * 0.12, length * 0.1, length * (0.24 + 0.1 * f)], [0, -f * 0.6, 0]);
    }
    return hinge;
  });

  let phase = 0;
  let amplitude = 0;
  return {
    object,
    flap(speed: number, delta: number) {
      phase += speed * delta;
      amplitude = approach(amplitude, Math.min(0.7, speed * 0.06), 4, delta);
      const angle = 0.3 + Math.sin(phase) * amplitude;
      // Wings sweep back a little on the downstroke
      const sweep = 0.2 + Math.max(0, -Math.sin(phase)) * amplitude * 0.3;
      for (const hinge of hinges) hinge.rotation.set(0, sweep, angle);
    },
    dispose() {
      object.removeFromParent();
      kit.dispose();
    }
  };
};

// A pair of curved horns for a humanoid head, with the origin at the top of the head. `size` is
// roughly each horn's length. The group owns its geometries and materials: call
// `group.userData.dispose()` when it is no longer needed.
export const createHorns = (color: string, size: number): THREE.Group => {
  const kit = new Kit();
  const group = buildHorns(kit, kit.material(color, { roughness: 0.5 }), size);
  group.name = 'horns';
  group.userData.dispose = () => kit.dispose();
  return group;
};
