# Card art prompts

Prompts for painting every troop card in ChatGPT, one per troop, each based on the troop's 3D model.
Finished paintings go in this folder as `<troop id>.webp`. `scripts/render-card-art.mjs` won't
overwrite a card whose painting is here.

## How to use them

1. **Start a new chat for each faction.** Paste the **style setup** message first. Attach two images
   to it: the approved anchor painting (once you have one) and the reference render of the card
   you're painting.
2. **For each card, send its prompt** and attach that troop's render from
   `art/card-renders/<id>.webp`. The render fixes the pose, colours and gear, and the prompt
   describes the same things in words. If ChatGPT won't accept WebP, convert it:
   `magick art/card-renders/infantry.webp infantry.png`.
3. **Paint the anchor first.** Do Swordsmen (`infantry`), then Giant Spider and the Elder Dragon, and
   regenerate until all three look right together. Use those three as the style references for
   every other chat. They're your art bible.
4. **Fit each painting to the card** (600×480 WebP with a transparent background, the size and shape
   of the current renders):

   ```sh
   magick painting.png -trim +repage -resize 560x448 -background none -gravity center -extent 600x480 -quality 86 art/card-ai/infantry.webp
   cp art/card-ai/infantry.webp public/cards/infantry.webp
   ```

   (On ImageMagick 6, use `convert` in place of `magick`.)

If ChatGPT returns a checkerboard or a white background instead of real transparency, reply with
"Same image, but with a truly transparent background (alpha), not a checkerboard." If that doesn't
work, remove the background afterwards.

---

## Style setup (paste once at the start of each chat)

```
I'm making card art for "Hex Hordes", a cheerful fantasy strategy card game with chunky, toy-like
3D pieces on a bright hex board. Its UI is deep navy with bright, rounded, playful type. For each
card I'll attach a 3D render of the troop's game model. Repaint it as a 2D illustration that is
clearly the same character: same silhouette, proportions, pose, colours, gear and colour placement.

STYLE (same for every card):
- A hand-painted board-game piece / toy figure: chibi proportions (the head is about a third of the
  body's height), stubby limbs, chunky rounded simple forms. Creatures keep the faceted, low-poly
  blockiness of the reference.
- Flat cel shading with 2–3 tones per colour and soft, matte, gouache-like paint. Light, even paper
  grain inside the colour fills. Edges are crisp and confident, slightly imperfect, like they were
  painted by hand.
- Thin outlines in a darker shade of each local colour, never pure black.
- Bright, saturated, friendly palette. One light source from the upper left, with one clear shadow
  side.
- Three-quarter view from slightly above, as in the reference. Full body, centred, with about 8% empty
  margin on every side.
- Fully transparent background (PNG with alpha): no ground, no cast shadow, no scenery, no particles
  or smoke beyond what the prompt asks for, no text, no border, no frame.
- Landscape 3:2 image.

AVOID: photorealism, glossy plastic or 3D-render shine, bloom, glow halos, rim lighting, lens or
depth-of-field effects, airbrushed gradients, hyper-detailed textures or filigree, extra ornaments
or weapons that aren't in the reference, dramatic cinematic lighting, and anything that would look
grim or gory. The tone is playful and readable, so each card must read clearly at 64 pixels wide.

Paint the first card now. After that I'll send one card per message, and every card must match the
first one's style, scale and framing exactly.
```

Each card's prompt below ends with the same reminder, so ChatGPT stays consistent over a long chat.

---

## The Kingdom (your cards)

Kingdom troops carry **blue** shields and accents, the player's colour.

### `infantry` - Swordsmen
```
Card: Swordsmen (Kingdom, common infantry). A stout chibi soldier in rounded steel plate armour with
a steel great-helm whose visor is raised to show a cheerful young face. The helm has a small spiky
crest. A small red rose emblem sits on the chest, with a brown leather belt and silver buckle. A short
steel sword hangs in the right hand, pointing down, and a round royal-blue shield is on the left arm.
Steady, stubborn stance. Match the attached render. Same style, framing and transparent background as
the approved cards.
```

### `artillery` - Archers
```
Card: Archers (Kingdom, common ranged). A chibi archer in an emerald-green pointed hood and green
tunic, with brown leather bracers, belt and boots. Holds a grey-steel crossbow low across the body.
Calm, ready expression, peeking from under the hood. Match the attached render. Same style, framing
and transparent background as the approved cards.
```

### `tank` - Pikemen
```
Card: Pikemen (Kingdom, common spear). A chibi soldier wearing a dark-brown bear-head helmet with
round ears and the snout over the brow. Bushy grey beard. Slate-blue tunic under brown leather
straps with silver studs. A long wooden pike with a steel tip is held upright, its point down at the
feet, and a round royal-blue shield is on the left arm. Match the attached render. Same style,
framing and transparent background as the approved cards.
```

### `rogue` - Rogues
```
Card: Rogues (Kingdom, common skirmisher). A chibi rogue with long auburn-brown hair, a sly
half-smile and a small earring, wearing a green tunic with a V-neck, brown leather bracers, belt
and boots. A short dagger is in one hand and a curved short sword in the other, held low and ready.
Light on their feet. Match the attached render. Same style, framing and transparent background as
the approved cards.
```

### `helicopter` - Knights
```
Card: Knights (Kingdom, rare cavalry). A chibi knight in steel plate with a raised-visor great-helm
and a small red rose emblem, riding a chestnut-brown horse that rears slightly toward the viewer. A
steel sword is in one hand and a royal-blue shield is on the arm. The horse is simple and blocky with
a dark mane, in the same toy-like proportions. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `medic` - Mages
```
Card: Mages (Kingdom, rare caster). A chibi battle mage in a huge wide-brimmed, bright royal-blue
pointed wizard hat with a slightly bent tip. Long periwinkle-purple coat with a high collar and silver
buttons, a brown belt with small potion vials, and brown boots. One hand holds a glowing lime-green
potion flask low at the side. Serious, focused face. Match the attached render. Same style, framing
and transparent background as the approved cards.
```

### `engineer` - Engineers
```
Card: Engineers (Kingdom, rare infantry). A bald, stout chibi woodsman with heavy grey eyebrows, a thick grey beard and a focused determined expression. Burnt-orange work tunic with white fur trim, brown leather work apron/straps, belt with silver buckle and studs, brown boots. Holds a small single-bladed steel axe low in the right hand; royal-blue badge shield on the left arm, largely hidden by the pose as in the render. No helmet. Match the attached model's silhouette, proportions, pose, color placement and gear. Same painted style, framing and transparent background as the approved cards.
```

### `shieldbearer` - Shieldbearers
```
Card: Shieldbearers (Kingdom, rare infantry). A chibi soldier in heavy steel plate and a
raised-visor great-helm with a spiky crest. A tall rectangular royal-blue tower shield with a round
boss is planted in front, covering most of the body. A short steel sword is in the other hand.
Immovable, braced stance. Match the attached render. Same style, framing and transparent background
as the approved cards.
```

### `berserker` - Berserkers
```
Card: Berserkers (Kingdom, rare brute). A bald, burly chibi Northman with heavy grey eyebrows, a
thick grey beard and a fierce scowl. Rust-brown leather armour with white fur trim, straps and silver
studs. A short sword is in one hand and a small single-bladed axe in the other. Ready to charge. Match
the attached render. Same style, framing and transparent background as the approved cards.
```

### `longbow` - Longbowmen
```
Card: Longbowmen (Kingdom, epic ranged). A chibi archer with long auburn-brown hair and a calm,
confident look, wearing a bright green tunic with brown leather bracers, belt and boots. Holds a
tall wooden longbow (taller than the figure) at the side, with a small quiver of green-fletched arrows
on the back. Match the colours and figure of the attached render. Note that the render shows a
crossbow, but this card gets a longbow. Same style, framing and transparent background as the approved
cards.
```

### `cleric` - War Clerics
```
Card: War Clerics (Kingdom, epic infantry). A chibi holy warrior in ivory-white plate armour and a
matching raised-visor great-helm with a spiky crest. A small golden sun emblem is on the chest. A
steel flanged mace is held down in one hand and a royal-blue shield is on the other arm. Calm, devout
expression. Match the attached render. Note that the render shows a sword, but the card's lore calls
for a mace. Same style, framing and transparent background as the approved cards.
```

### `sapper` - Siege Sappers
```
Card: Siege Sappers (Kingdom, epic skirmisher). A chibi demolition expert with long auburn-brown hair
and a determined, mischievous look, in a brown leather tunic, bracers, belt and boots. One hand holds
a round black iron bomb with a short fuse that is just sparking. Match the attached render. Same
style, framing and transparent background as the approved cards.
```

### `pegasus` - Pegasus Knights
```
Card: Pegasus Knights (Kingdom, legendary cavalry). A chibi knight in gleaming white plate armour with
a raised-visor great-helm and a small red rose emblem, riding a pure-white winged horse that rears
up. Its wings are long, slim and angular, swept out to both sides. A royal-blue shield is on the
knight's arm. Noble and heroic, yet still toy-like. Match the attached render. Same style, framing
and transparent background as the approved cards.
```

### `archmage` - Archmage
```
Card: Archmage (Kingdom, legendary caster). A chibi wizard in an enormous wide-brimmed royal-blue
pointed hat, wearing a deep indigo-purple long coat with a high collar and silver buttons. Holds an
open white spellbook in one hand and a glowing violet potion flask in the other. A single small crackle
of blue storm-lightning dances above the open book. Wise, commanding look. Match the attached render.
Same style, framing and transparent background as the approved cards.
```

---

## Bandits

Enemy troops carry **red** scarves, shields and collars, the enemy's colour. Keep them.

### `bandit_thug` - Bandit Thug
```
Card: Bandit Thug (Bandits, common infantry). A stocky chibi brute in a grey bear-head helmet with
round ears, with a scruffy grey beard and a mean squint. Brown leather armour with red-brown straps and
silver studs. A notched short sword hangs in one hand. Match the attached render. Same style, framing
and transparent background as the approved cards.
```

### `bandit_archer` - Bandit Archer
```
Card: Bandit Archer (Bandits, common ranged). A chibi poacher in an olive-drab pointed hood and olive
tunic with brown leather bracers, belt and boots. Holds a grey crossbow low. Shifty, smug look from
under the hood. Match the attached render. Same style, framing and transparent background as the
approved cards.
```

### `highwayman` - Highwayman
```
Card: Highwayman (Bandits, rare skirmisher). A chibi rogue with long auburn-brown hair, a cocky
smirk and an earring, wearing a near-black charcoal tunic with brown leather bracers, belt and boots.
A dagger is in one hand and a curved short sword in the other. Light, sneaky stance. Match the attached
render. Same style, framing and transparent background as the approved cards.
```

### `bandit_raider` - Mounted Raider
```
Card: Mounted Raider (Bandits, rare cavalry). A chibi rider in a dark, gunmetal great-helm with a
spiky crest, with a dark-brown beard and grimy leather armour, riding a dusty dark-brown horse that
rears slightly. A short sword is in one hand. Rough and scrappy, not noble. Match the attached render.
Same style, framing and transparent background as the approved cards.
```

### `bandit_king` - Redcap Rufus, Bandit King (boss)
```
Card: Redcap Rufus, the Bandit King (Bandits, BOSS). A big, swaggering chibi brute in a shining
golden bear-head helmet with round ears, with a golden-blond beard and a crimson-red tunic with gold
trim and straps. A huge golden double-bladed battle axe rests on the shoulder. Gaudy, self-crowned
pride. Make him feel bigger and bolder than a regular troop. Match the attached render. Same style,
framing and transparent background as the approved cards.
```

---

## Goblins

### `goblin_scrapper` - Goblin Scrapper
```
Card: Goblin Scrapper (Goblins, common infantry). A small chibi goblin with bright green skin,
pointed ears, long scraggly auburn hair and a toothy grin, in a ragged brown tunic with leather
bracers and boots. Holds a small rusty knife low. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `goblin_slinger` - Goblin Slinger
```
Card: Goblin Slinger (Goblins, common ranged). A chibi goblin with bright green skin in an olive-drab
pointed hood and olive tunic with leather bracers and boots. One hand holds a round grey rock ready to
throw. Gleeful, mischievous face. Match the attached render. Same style, framing and transparent
background as the approved cards.
```

### `goblin_shaman` - Goblin Shaman
```
Card: Goblin Shaman (Goblins, rare caster). A small chibi goblin with bright green skin in a big
floppy bright-red pointed witch hat, wearing a lavender-purple coat with a high collar and silver
buttons. A small twig wand is in one hand, giving off one wisp of smelly green smoke. Muttering,
squinting expression. Match the attached render. Same style, framing and transparent background as
the approved cards.
```

### `goblin_sapper` - Goblin Sapper
```
Card: Goblin Sapper (Goblins, rare skirmisher). A chibi goblin with bright green skin and long
scraggly auburn hair, in a brown leather tunic, bracers and boots. Proudly holds a round black bomb
whose fuse is fizzing and sparking. Manic, delighted grin. Match the attached render. Same style,
framing and transparent background as the approved cards.
```

### `goblin_warchief` - Grubnak the Warchief (boss)
```
Card: Grubnak the Warchief (Goblins, BOSS). An oversized, hulking chibi goblin with bright green skin
and a troll-like jaw, under a big brown bear-head helmet with round ears. Dark brown leather armour
with straps and studs. A massive notched double-bladed axe made of pale weathered wood and stone is
held across the body. Make him feel much bigger and meaner than a normal goblin. Match the attached
render. Same style, framing and transparent background as the approved cards.
```

---

## Beasts

Beasts keep their low-poly, faceted, blocky toy look, painted flat.

### `grey_wolf` - Grey Wolf
```
Card: Grey Wolf (Beasts, common cavalry). A blocky, faceted low-poly wolf in cool grey with lighter
grey legs, tall pointed ears, a black nose, bright yellow eyes and a red collar. It stands alert,
three-quarter view, head turned toward the viewer. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `wild_boar` - Wild Boar
```
Card: Wild Boar (Beasts, common cavalry). A chunky, faceted low-poly boar in dark chocolate brown with
a bristly mane ridge, small pointed ears, beady white eyes, two big white curved tusks and a red
collar. Low, stubborn, about-to-charge stance. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `giant_spider` - Giant Spider
```
Card: Giant Spider (Beasts, rare skirmisher). A faceted low-poly giant spider with a dark
plum-purple body and eight long, thin, angular violet legs splayed wide, and a cluster of glowing
red-pink eyes on the front. Sinister but still cartoon-friendly. Match the attached render. Same
style, framing and transparent background as the approved cards.
```

### `cave_bear` - Cave Bear
```
Card: Cave Bear (Beasts, rare brute). A big, blocky, faceted low-poly bear in warm brown with a
lighter tan muzzle and paws, small round ears, beady black eyes and a red collar. A heavy, grumpy,
just-woken-up stance. Match the attached render. Same style, framing and transparent background as the
approved cards.
```

### `alpha_direwolf` - Fenrak the Alpha (boss)
```
Card: Fenrak the Alpha (Beasts, BOSS). A huge, faceted low-poly direwolf in near-black charcoal with
slate-grey legs, tall pointed ears, a black nose, fierce glowing yellow eyes and a red collar. Head
raised mid-howl, with a few sharp white fangs showing. It should feel massive and commanding. Match the
attached render. Same style, framing and transparent background as the approved cards.
```

---

## Swamp Folk

### `bog_slime` - Bog Slime
```
Card: Bog Slime (Swamp Folk, common infantry). A round, faceted low-poly blob of bright moss-green
slime with two big googly white eyes with black pupils, one slightly bigger than the other, a small
surprised mouth and two little droplets splitting off at the base. Silly and gooey. Match the attached
render. Same style, framing and transparent background as the approved cards.
```

### `lizardman` - Lizardman Spear
```
Card: Lizardman Spear (Swamp Folk, common spear). A chibi lizard warrior with a rounded teal-green
scaly head, heavy brow and a pale grey-green chin frill, wearing a dark green tunic with white trim
and leather straps. A long wooden spear with a steel tip is held upright, point down. Match the
colours and figure of the attached render. Lean the head a little more reptilian than the render.
Same style, framing and transparent background as the approved cards.
```

### `toxic_toad` - Toxic Toad
```
Card: Toxic Toad (Swamp Folk, rare ranged). A chunky, faceted low-poly toad in acid lime-green with
huge bulging yellow eyes, a wide grinning purple mouth and belly, and a small red bump on top of its
head. Squatting on thick front legs, with a single drip of glowing green spit at the corner of its
mouth. Match the attached render. Same style, framing and transparent background as the approved
cards.
```

### `swamp_witch` - Swamp Witch
```
Card: Swamp Witch (Swamp Folk, rare caster). A small chibi witch with pale green skin in a big
floppy bright-red pointed witch hat, wearing a dark plum-purple coat with silver buttons. A bubbling
purple potion flask hangs from one hand. Knowing, crooked smile. Match the attached render. Same
style, framing and transparent background as the approved cards.
```

### `bog_hydra` - The Bog Hydra (boss)
```
Card: The Bog Hydra (Swamp Folk, BOSS). A faceted low-poly hydra with three long, segmented,
dark-jade-green serpent necks rising from a stubby squat body on short legs. Each head has small
yellow horns, yellow eyes and a red collar ring. The three heads look in different directions. It
should feel big and menacing. Match the attached render. Same style, framing and transparent
background as the approved cards.
```

---

## Sand Court

### `giant_scorpion` - Giant Scorpion
```
Card: Giant Scorpion (Sand Court, common spear). A faceted low-poly scorpion in sandy amber-orange
with darker brown banding, a red spot on its back, thin spiky legs and big pincers forward. Its
segmented tail curls high overhead, ending in a black stinger. Match the attached render. Same style,
framing and transparent background as the approved cards.
```

### `sand_raider` - Sand Raider
```
Card: Sand Raider (Sand Court, common skirmisher). A chibi desert raider with warm brown skin, in a
sand-coloured pointed hood and sand-coloured tunic with brown leather bracers, belt and boots. A
dagger is in one hand and a curved scimitar in the other. A small swirl of sand around the feet. Match
the attached render. Same style, framing and transparent background as the approved cards.
```

### `mummy` - Mummy
```
Card: Mummy (Sand Court, rare infantry). A chibi skeletal figure with a big bone-white skull and
glowing lime-green eye sockets, a red scarf at the neck and a brown belt, its bony body loosely
wrapped in a few strips of pale, frayed linen bandage. Arms raised forward, cross about being woken.
Match the attached render, adding the bandage wrappings it lacks. Same style, framing and transparent
background as the approved cards.
```

### `sand_golem` - Sand Golem
```
Card: Sand Golem (Sand Court, rare brute). A hulking golem built from round, lumpy, faceted
sandstone boulders in warm sand-gold, with a big chest, boulder fists, short boulder legs and a small
head with two glowing cyan eyes. A faint carved band runs across the chest like an old statue. Match
the attached render. Same style, framing and transparent background as the approved cards.
```

### `pharaoh` - Pharaoh Ankhamun (boss)
```
Card: Pharaoh Ankhamun (Sand Court, BOSS). A chibi skeletal king with a bone-white skull and glowing
amber eyes, under a tall floppy bright-red pointed wizard hat, wearing a royal-blue robe with silver
buttons, with a few gold trims added. Holds a staff topped with a small horned skull, its shaft
painted gold. Ancient, regal and grumpy. Make him feel bigger and grander than a normal troop. Match
the attached render. Same style, framing and transparent background as the approved cards.
```

---

## Frostborn

### `snow_wolf` - Snow Wolf
```
Card: Snow Wolf (Frostborn, common cavalry). A blocky, faceted low-poly wolf in snow-white with
pale ice-blue shading, tall pointed ears, a black nose, glowing cyan eyes and a red collar. It stands
alert. Match the attached render. Same style, framing and transparent background as the approved
cards.
```

### `ice_wraith` - Ice Wraith
```
Card: Ice Wraith (Frostborn, rare skirmisher). A floating spirit: a glowing aqua-cyan orb face with
two black eyes, ringed by a red hoop, with a halo of sharp, pale-blue ice crystal shards fanning
out around it and a tapering icy tail beneath. Eerie but readable. Match the attached render. Same
style, framing and transparent background as the approved cards.
```

### `yeti` - Yeti
```
Card: Yeti (Frostborn, rare brute). A big chibi brute with pale frost-white skin, a heavy brow, a
thick grey beard and a shaggy white fur coat with grey trim and fur boots. Bare fists at the sides.
Hulking but a little goofy. Match the attached render. Same style, framing and transparent background
as the approved cards.
```

### `frost_huntress` - Frost Huntress
```
Card: Frost Huntress (Frostborn, common ranged). A chibi huntress in a sky-blue pointed hood and
light-blue tunic with brown leather bracers, belt and boots. Holds a grey crossbow low, with a bolt
tipped in pale crystal ice. Cool, focused look. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `frost_giant` - Jarl Hrimgar the Frost Giant (boss)
```
Card: Jarl Hrimgar the Frost Giant (Frostborn, BOSS). A massive chibi giant with pale ice-blue skin,
an icy blue bear-head helmet with round ears, and a frosty beard. Dark navy and brown leather armour
with straps. A huge pale-blue ice double-bladed axe is held across the body. Make him feel colossal.
Match the attached render. Same style, framing and transparent background as the approved cards.
```

---

## Undead

### `skeleton_minion` - Skeleton Minion
```
Card: Skeleton Minion (Undead, common infantry). A chibi skeleton with a big bone-white skull,
glowing yellow eye sockets and a red scarf around the neck. Holds a short rusty sword down at the
side. Rattly, slightly dopey stance. Match the attached render. Same style, framing and transparent
background as the approved cards.
```

### `skeleton_warrior` - Skeleton Warrior
```
Card: Skeleton Warrior (Undead, common infantry). A chibi skeleton in a gunmetal viking helmet with
two ivory horns, with glowing yellow eyes, a red scarf and a battered iron round shield. A short sword
is held ready. "Still a knight, technically." Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `skeleton_archer` - Skeleton Crossbowman
```
Card: Skeleton Crossbowman (Undead, rare ranged). A chibi skeleton in a deep wine-red pointed hood,
with glowing yellow eyes, a dark grey tunic and a belt. Holds a big dark-iron crossbow with a spiky,
fan-shaped front. Hollow-eyed and steady. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `ghost` - Wailing Ghost
```
Card: Wailing Ghost (Undead, rare skirmisher). A floating, faceted low-poly ghost head in pale
translucent mint-green with pointed ear-like wisps, two big black oval eyes, a wide open wailing black
mouth and a red ring collar at its base, fading to wisps below. Spooky but cartoonish. Match the
attached render. Same style, framing and transparent background as the approved cards.
```

### `lich_king` - Morthul the Lich King (boss)
```
Card: Morthul the Lich King (Undead, BOSS). A chibi skeletal sorcerer with a bone-white skull and
glowing red-violet eyes, under a tall floppy bright-red pointed wizard hat, wearing a deep
violet-purple robe with silver buttons. Holds a staff topped with a small horned skull. A faint violet
wisp curls around the staff top. Make him feel bigger and more powerful than a normal troop. Match the
attached render. Same style, framing and transparent background as the approved cards.
```

---

## Orcs

### `orc_grunt` - Orc Grunt
```
Card: Orc Grunt (Orcs, common infantry). A stocky chibi orc with green skin and small tusks, under a
grey bear-head helmet with round ears, with a grey beard, rust-brown leather armour, straps and studs.
A short sword is in one hand and a round red shield on the other arm. Match the attached render. Same
style, framing and transparent background as the approved cards.
```

### `orc_archer` - Orc Archer
```
Card: Orc Archer (Orcs, common ranged). A chibi orc with green skin in a dark-brown pointed hood and
brown tunic with leather bracers and boots. Holds a big grey crossbow loaded with a comically thick
bolt. Match the attached render. Same style, framing and transparent background as the approved cards.
```

### `orc_shaman` - Orc Shaman
```
Card: Orc Shaman (Orcs, rare caster). A chibi orc with green skin in a big floppy bright-red pointed
witch hat and a scarlet-red coat with silver buttons. A glowing red potion flask hangs from one hand.
Wild, spirit-touched grin. Match the attached render. Same style, framing and transparent background
as the approved cards.
```

### `ogre` - Ogre
```
Card: Ogre (Orcs, rare brute). A huge, bald chibi brute with a tan, lumpy head, heavy brow, a scraggly
white beard and dim, determined eyes. Brown leather armour with straps and studs. A big grey steel
double-bladed axe is held across the body. Heavy and slow. Match the attached render. Same style,
framing and transparent background as the approved cards.
```

### `orc_warlord` - Warlord Gorrash (boss)
```
Card: Warlord Gorrash (Orcs, BOSS). A hulking chibi orc warlord with green skin under a spiky
blackened-iron great-helm, wearing black armour with dark red-brown straps. A huge, long black
greatsword is held out to the side. Brutal and imposing. Make him feel much bigger than a normal orc.
Match the attached render. Same style, framing and transparent background as the approved cards.
```

---

## Infernal Legion

### `imp` - Imp
```
Card: Imp (Infernal, common skirmisher). A small, faceted low-poly imp in bright scarlet red with
two little yellow horns, big orange-yellow eyes, tiny fangs, long pointed bat-like ears and a short
skirt-like band at the waist. A few small flames flicker off its shoulders. Cackling, mischievous.
Match the attached render. Same style, framing and transparent background as the approved cards.
```

### `magma_golem` - Magma Golem
```
Card: Magma Golem (Infernal, rare brute). A hulking golem made of chunky, faceted black volcanic
boulders with bright orange-yellow lava glowing through the cracks. It has a big chest with a
glowing crack, boulder fists, short boulder legs and a small head with two orange eyes. Match the
attached render. Same style, framing and transparent background as the approved cards.
```

### `fire_elemental` - Fire Elemental
```
Card: Fire Elemental (Infernal, rare caster). A round, bright lemon-yellow fire spirit with two small
black eyes, crowned with tall white-hot and orange flame spikes, floating over a glowing red-orange
ring of fire. A couple of tiny embers drift above it. Match the attached render. Same style, framing
and transparent background as the approved cards.
```

### `hellhound` - Hellhound
```
Card: Hellhound (Infernal, common cavalry). A blocky, faceted low-poly hound in very dark maroon-black
with tall pointed ears, glowing orange eyes, a red collar and dark red paws. Small orange flames lick
from its jaws and paws. Menacing stance. Match the attached render. Same style, framing and transparent
background as the approved cards.
```

### `demon_lord` - Azgaroth the Demon Lord (boss)
```
Card: Azgaroth the Demon Lord (Infernal, BOSS). A hulking chibi demon in a smooth crimson bucket
great-helm with slit eyes, a black beard, black armour with red-brown straps, and two long, thin,
dark-red-black bat wings spread wide. A massive black double-bladed axe is held across the body. Add
two small black horns rising from the helm, and a little smoke curling off the wings. Make him feel
enormous. Match the attached render. Same style, framing and transparent background as the approved
cards.
```

---

## Dragonkin

### `dragon_cultist` - Dragon Cultist
```
Card: Dragon Cultist (Dragonkin, common caster). A chibi human fanatic with rosy cheeks and a smug,
devoted expression, in a big floppy bright-red pointed hat and a crimson coat with silver buttons and
grey trim. A thin twig wand is held at the side. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `wyvern` - Wyvern
```
Card: Wyvern (Dragonkin, rare cavalry). A faceted low-poly wyvern in bright lime-to-moss green with a
long segmented neck, a blocky head with yellow eyes, big angular green wings, a red collar ring and
small yellow claws. Standing upright, wings spread. Match the attached render. Same style, framing and
transparent background as the approved cards.
```

### `drake` - Fire Drake
```
Card: Fire Drake (Dragonkin, rare brute). A chunky, faceted low-poly young dragon in bright red with
a pink belly and small pink wings, yellow horn spikes down its neck and back, yellow eyes, pink feet
with yellow claws and a red collar ring. A small puff of flame curls from its mouth. Match the attached
render. Same style, framing and transparent background as the approved cards.
```

### `dragon_knight` - Dragon Knight
```
Card: Dragon Knight (Dragonkin, epic cavalry). A chibi fallen knight in blackened plate armour with a
spiky black great-helm and small glinting red eyes, a red rose emblem on the chest and a crimson
shield on the arm, riding a coal-black horse that rears slightly. A dark sword is in one hand. Grim but
toy-like. Match the attached render. Same style, framing and transparent background as the approved
cards.
```

### `elder_dragon` - Vyrmathrax the Elder Dragon (boss)
```
Card: Vyrmathrax the Elder Dragon (Dragonkin, BOSS). A massive, faceted low-poly dragon in deep
crimson with golden-yellow wing membranes and belly, golden horns, yellow eyes, golden feet and claws,
yellow spikes along its neck and a red collar ring. It rears up proudly with wings half open. It
should feel ancient, enormous and furious, the final boss. Match the attached render. Same style,
framing and transparent background as the approved cards.
```
