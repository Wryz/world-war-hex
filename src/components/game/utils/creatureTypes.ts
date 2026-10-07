import type * as THREE from 'three';

// Procedural low-poly monsters built from three.js primitives, for the mobs that have no
// character model (wolves, spiders, slimes, golems, dragons...). See creatures.ts.

export type CreatureBody =
  | 'quadruped' // wolves, boars, bears, hellhounds (variant: 'wolf' | 'boar' | 'bear')
  | 'spider'
  | 'slime'
  | 'frog'
  | 'hydra'     // three-headed swamp serpent
  | 'scorpion'
  | 'golem'     // stacked boulders (variant: 'sand' | 'magma')
  | 'wisp'      // floating spirit: ghost, ice wraith, fire elemental (variant: 'ghost' | 'ice' | 'fire')
  | 'imp'       // small winged demon
  | 'dragon';   // variant: 'wyvern' | 'drake' | 'elder'

export interface CreatureLook {
  kind: 'creature';
  body: CreatureBody;
  variant?: string;
  // Overall size: 1 fills a hex about as much as a human troop; bosses are 1.4-1.8
  scale: number;
  colors: {
    primary: string;
    secondary?: string;
    // Eyes, claws, horns
    accent?: string;
    // Emissive glow (lava cracks, spirit light, eyes)
    glow?: string;
  };
  // Height of the unit's label above its hex (world units, after scale)
  labelHeight: number;
  // Projectile for ranged creatures
  projectile?: 'magic' | 'fire' | 'spit' | 'frost';
}

export type CreatureState = 'idle' | 'walk' | 'attack' | 'hold' | 'death';

export interface CreatureRig {
  // Root object: faces +z, feet (or hover base) at y = 0, already scaled by look.scale.
  // A human troop is about 1.15 world units tall and a hex is about 1.7 across.
  object: THREE.Group;
  // Switch the looping motion (idle breathing, walk cycle, hovering, combat stance)
  setState(state: CreatureState): void;
  // Play one strike (bite, swipe, slam, spit) lasting about `duration` seconds
  strike(duration: number): void;
  // Advance the procedural animation
  update(delta: number): void;
  // Free geometries and materials created only for this rig
  dispose(): void;
}
