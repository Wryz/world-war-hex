# World War Hex

A turn-based strategy game on a 3D hexagonal battlefield, built with Next.js, React, TypeScript, Tailwind CSS and three.js (via React Three Fiber and drei).

## Project Structure

The game is organized into modular components for better maintainability:

### Core Components

- `GameController`: Main game controller that manages game state and lays out the HUD for each phase
- `GameBoard`: Renders the 3D board, the camera (swings to the active side's view each turn; drag to orbit, scroll to zoom), planned routes and battle markers
- `HexTile`: Individual hexagon tile component
- `BoardDecorations`: Instanced trees, peaks, dunes and gold that show each hex's terrain
- `UnitMesh`: Animated unit that walks along its route, faces its opponent and shows its health and terrain bonuses
- `Castle`: Each side's castle, topped with a crown
- `Camp`: Neutral camp with a banner in the colour of whoever holds it
- `MovePath`: Dashed route with an arrow showing where a unit will walk

### HUD

- `src/components/game/hud/`
  - `TopBar`: Round, whose turn it is, timer, both castles' health, your gold, and save / mute / main menu buttons
  - `ActionBar`: Recruit units and end your turn
  - `SelectionCard`: Details about the selected unit and the terrain it stands on
  - `EventFeed`: Battle log of recent events
  - `HelpPanel`: Collapsible guide to terrain effects and how to win
  - `CollapsiblePanel`: Shared collapsible HUD panel
  - `TurnBanner`: Announces turn changes and battles

### Game Phases

- `src/components/game/phases/`
  - `SetupPhase`: Instructions for placing the player's castle

### Combat System

- `src/components/game/combat/`
  - `CombatResolver`: Shows the battle being fought, with each unit's damage and any kill bounty

### UI Components

- `src/components/game/shared/`
  - `GameOverScreen`: End game screen showing the winner

### Game Intro

- `src/components/game/intro/`
  - `IntroScreen`: Main menu: pick a difficulty, start or continue a game, and meet your army
  - `IslandDiorama`: A small 3D island built from the game's own tiles, castles, camps and troops, skirmishing on a loop and cycling through the map themes

### Storage Utilities

- `src/components/game/storage/`
  - `GameStorage`: Versioned save/load of the game in localStorage (the game also autosaves at the start of each of your turns)

### Helper Utilities

- `src/components/game/utils/`
  - `LoadingManager` / `LoadingScreen`: Download the unit models and sounds before the board is shown
  - `unitModelCache`: Loads each animated model once and clones it per unit
  - `UnitModelSystem`: Model, animation and attack-speed settings for each unit type
  - `SoundPlayer` / `battleSounds`: UI sounds, synthesised battle sounds and the global mute
  - `boardGeometry`: Hex heights and hex-to-world positions

### Game Logic

- `src/lib/game/`
  - `gameState.ts`: Rules engine: setup, purchases, movement, combat, economy and win conditions (pure functions)
  - `mapGenerator.ts`: Seeded natural map generation: a random theme (Green Valley, Frozen Pass, Marshlands, Desert Frontier, Highlands, Riverlands) picks which terrain appears, then noise shapes it into lakes, ranges and forests, keeps every walkable hex connected and scatters gold mines and springs
  - `hexUtils.ts`: Hex grid maths (neighbours, distances)

### AI Player

- `src/lib/ai/`
  - `aiPlayer.ts`: AI decision making for moves and combat

## Game Features

- Hexagonal grid-based strategy game
- Save and load game functionality
- Multiple unit types with different abilities
- Resource management
- Turn-based combat system
- AI opponent with three difficulty levels
- Animated battles: each troop type strikes at its own pace, archers fire bolts and mages hurl spells, with clash, bow, spell and impact sounds; health bars count down as blows land
- Strategy over numbers: counters, height, line of sight and upkeep let a smaller, smarter army beat a bigger one
- Six troop types, each with its own low-poly model in its side's colours

## Credits

- Unit models: [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) by Kay Lousberg ([CC0](http://creativecommons.org/publicdomain/zero/1.0/)), trimmed and meshopt-compressed for the web
- Knights' horse: from the [three.js examples](https://github.com/mrdoob/three.js) (MIT), model by [mirada](https://mirada.com/) for ROME
- Battle sounds synthesised in the browser with [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT)
- Icons from [Game Icons](https://game-icons.net) and [Lucide](https://lucide.dev) via [react-icons](https://react-icons.github.io/react-icons/)

## How to Play

1. **Place your castle.** Click a highlighted hex on the edge of the map, then click it again to confirm. A castle needs at least two open hexes next to it (not water, mountains or a gold mine). The enemy castle is placed on the far side of the map.
2. **Take turns.** You and the enemy alternate turns. You have 60 seconds to plan, then press **End Turn** (or let the timer run out).
   - **Recruit:** pick a unit in the Barracks, click a highlighted hex next to your castle, then click it again to deploy. Units appear at the end of your turn and can move from your next turn. You can also deploy on a hex whose unit you've ordered to move away (cancelling that move also cancels the recruit). Click a queued unit to cancel it and get your gold back.
   - **Move:** click one of your units, then a highlighted hex - the route is drawn as you hover. If a hex is out of reach or impassable you get a short warning and the unit stays selected. Click a planned destination to cancel the move. Units walk there when the turn ends.
   - **Camera:** click and drag to rotate the view around the map (drag up/down to tilt), and scroll or pinch to zoom in on any part of it. The view swings to whoever's turn it is.
   - **Menu:** the buttons next to your gold save the game, mute the sound and return to the main menu. The game also saves itself at the start of each of your turns, and the turn timer pauses while the tab is in the background.
3. **Your army.** Every troop counters another, so no single army beats them all.

   | Unit | Cost | Attack | Health | Move | Strong against | Special |
   |---|---|---|---|---|---|---|
   | Swordsmen | 5 | 2 | 5 | 2 | Pikemen, Rogues | Cheap all-rounders |
   | Archers | 10 | 5 | 3 | 1 | Pikemen | Shoot from 2 hexes away (3 from high ground) |
   | Knights | 13 | 3 | 4 | 5 | Archers, Mages | Fast mounted cavalry |
   | Pikemen | 12 | 4 | 8 | 3 | Knights (double damage) | Tough; attack 50% harder from a forest |
   | Rogues | 9 | 3 | 3 | 4 | Archers, Mages | Sneak attacks: enemies can't strike back at them |
   | Mages | 10 | 3 | 4 | 2 | - | Spells reach 2 hexes and ignore cover and line of sight; heal adjacent allies 2 health each turn |

   Counters deal 50% more damage (Pikemen double against Knights). Archers and Mages caught in close combat fight at half strength.

4. **Combat.** When a side ends its turn, each of its units automatically attacks one enemy it can reach, preferring one it can finish off, then one it is strong against. A unit attacked by several enemies splits its strike-back between the attackers it can reach, so Archers shooting from 2 hexes take no damage, and Rogues' sneak attacks are never struck back. The battle card shows every modifier, and health bars count down blow by blow as the battle plays out.
5. **Terrain and height matter.** Every map has its own theme and only some of the terrain types below; the Guide panel lists the ones on the current map. Hover any hex to see its effect and height.
   - **Height:** each hex has a height level - water and swamp 0, most ground 1, hills and snow 2, mountains 3. Attacking down onto lower ground deals 25% more damage per level (up to two levels); attacking uphill deals 25% less. Archers and Mages on high ground reach one hex further.
   - **Line of sight:** shots at range are blocked by any hex in between that stands higher than both the shooter and the target. Mountains block everything, ridges hide units from archers below, and forest canopies count one level higher - so forests screen an advance unless the archers stand on high ground. Mages' spells arc over anything.

   | Terrain | Height | Effect |
   |---|---|---|
   | Plains | 1 | No effect |
   | Forest | 1 (trees 2) | Units take 40% less damage (except from spells); Pikemen attack 50% harder; blocks shots from below |
   | Hills | 2 | High ground; costs 2 movement |
   | Desert | 1 | Costs 2 movement |
   | Swamp | 0 | Low ground; costs 2 movement |
   | Snow | 2 | High ground; costs 3 movement |
   | Spring | 1 | Units here heal 2 health at the end of each of their turns |
   | Gold Mine | 1 | Pays its gold at the end of each of your turns while one of your units holds it |
   | Mountains | 3 | Impassable; blocks line of sight |
   | Water | 0 | Impassable |

   A unit can always step onto one neighbouring hex, however rough, even if that takes all of its movement.
6. **Camps.** Two neutral camps sit between the castles, the same distance from each. Move a unit onto a camp to capture it: from then on you can deploy recruits on and around it as well as next to your castle. The enemy can take it back the same way.
7. **Economy.** At the end of each of its turns a side earns 5 gold, plus the value of any gold mines its units stand on and 2 gold for each camp it holds. Armies larger than 5 units cost 1 gold upkeep per extra unit each turn, so a bigger army isn't automatically a better one - holding mines and camps pays more. Destroying an enemy unit pays a bounty of half its cost, and damaging the enemy castle plunders gold (1 per 2 damage). Your income per turn is shown next to your gold.
8. **Win** by moving a unit onto the enemy castle, or by wearing it down. At the end of each of your turns, each of your units within 3 hexes of the enemy castle deals damage equal to its attack power (and the enemy does the same at the end of theirs).

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [Nunito](https://fonts.google.com/specimen/Nunito) for body text and [DynaPuff](https://fonts.google.com/specimen/DynaPuff) for titles and buttons.
