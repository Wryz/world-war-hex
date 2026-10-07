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
  - `IntroScreen`: Initial screen for starting/loading a game and selecting difficulty

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
- Animated battles: each troop type strikes at its own pace, archers fire arrows, with clash, bow and impact sounds
- Battle sounds synthesised in the browser with [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT); icons from [Game Icons](https://game-icons.net) and [Lucide](https://lucide.dev) via [react-icons](https://react-icons.github.io/react-icons/)

## How to Play

1. **Place your castle.** Click a highlighted hex on the edge of the map, then click it again to confirm. A castle needs at least two open hexes next to it (not water, mountains or a gold mine). The enemy castle is placed on the far side of the map.
2. **Take turns.** You and the enemy alternate turns. You have 60 seconds to plan, then press **End Turn** (or let the timer run out).
   - **Recruit:** pick a unit in the Barracks, click a highlighted hex next to your castle, then click it again to deploy. Units appear at the end of your turn and can move from your next turn. You can also deploy on a hex whose unit you've ordered to move away (cancelling that move also cancels the recruit). Click a queued unit to cancel it and get your gold back.
   - **Move:** click one of your units, then a highlighted hex - the route is drawn as you hover. If a hex is out of reach or impassable you get a short warning and the unit stays selected. Click a planned destination to cancel the move. Units walk there when the turn ends.
   - **Camera:** click and drag to rotate the view around the map (drag up/down to tilt), and scroll or pinch to zoom in on any part of it. The view swings to whoever's turn it is.
   - **Menu:** the buttons next to your gold save the game, mute the sound and return to the main menu. The game also saves itself at the start of each of your turns, and the turn timer pauses while the tab is in the background.
3. **Combat.** When a side ends its turn, each of its units automatically attacks one enemy in range - adjacent for most units, up to 2 hexes for Archers - preferring one it can finish off, otherwise the weakest. A unit attacked by several enemies splits its strike-back between the attackers it can reach, so Archers firing from 2 hexes take no damage.
4. **Terrain matters.** Every map has its own theme and only some of the terrain types below; the Guide panel lists the ones on the current map. Hover any hex to see its effect.

   | Terrain | Effect |
   |---|---|
   | Plains | No effect |
   | Forest | Units take 40% less damage; Pikemen attack 50% harder |
   | Hills | High ground: units deal 25% more damage and Archers reach 3 hexes; costs 2 movement |
   | Desert | Costs 2 movement |
   | Swamp | Units take 25% more damage; costs 2 movement |
   | Snow | Costs 3 movement |
   | Spring | Units here heal 2 health at the end of each of their turns |
   | Gold Mine | Pays its gold at the end of each of your turns while one of your units holds it |
   | Mountains, Water | Impassable |

   A unit can always step onto one neighbouring hex, however rough, even if that takes all of its movement.
5. **Camps.** Two neutral camps sit between the castles, the same distance from each. Move a unit onto a camp to capture it: from then on you can deploy recruits on and around it as well as next to your castle. The enemy can take it back the same way.
6. **Economy.** At the end of each of its turns a side earns 5 gold, plus the value of any gold mines (resource hexes) its units stand on. Destroying an enemy unit pays a bounty of half its cost, and damaging the enemy castle plunders gold (1 per 2 damage).
7. **Win** by moving a unit onto the enemy castle, or by wearing it down. At the end of each of your turns, each of your units within 3 hexes of the enemy castle deals damage equal to its attack power (and the enemy does the same at the end of theirs).

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [Nunito](https://fonts.google.com/specimen/Nunito) for body text and [DynaPuff](https://fonts.google.com/specimen/DynaPuff) for titles and buttons.
