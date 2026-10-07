# Hex Kingdoms - Board Game

A strategic hexagonal grid board game built with React, TypeScript, and Tailwind CSS.

## Project Structure

The game is organized into modular components for better maintainability:

### Core Components

- `GameController`: Main game controller that manages game state and lays out the HUD for each phase
- `GameBoard`: Renders the 3D board, the fixed camera that swings to the active side's view each turn, planned routes and battle markers
- `HexTile`: Individual hexagon tile component
- `BoardDecorations`: Instanced trees, peaks, dunes and gold that show each hex's terrain
- `UnitMesh`: Animated unit that walks along its route, faces its opponent and shows its health and terrain bonuses
- `Castle`: Each side's castle, topped with a crown
- `MovePath`: Dashed route with an arrow showing where a unit will walk

### HUD

- `src/components/game/hud/`
  - `TopBar`: Round, whose turn it is, timer, both castles' health and your gold
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
  - `GameStorage`: Utilities for saving/loading game state

### Helper Utilities

- `src/components/game/utils/`
  - `UnitHelpers`: Helper functions for unit types, icons, and names
  - `LoadingManager`: Asset loading and management
  - `SoundPlayer`: Sound effects playback and volume control

### Game Logic

- `src/lib/game/`
  - `gameState.ts`: Core game state management
  - `hexUtils.ts`: Utility functions for hex grid calculations

### AI Player

- `src/lib/ai/`
  - `aiPlayer.ts`: AI decision making for moves and combat

## Game Features

- Hexagonal grid-based strategy game
- Save and load game functionality
- Multiple unit types with different abilities
- Resource management
- Turn-based combat system
- AI opponent with configurable difficulty levels
- Animated battles: each troop type strikes at its own pace, archers fire arrows, with clash, bow and impact sounds
- Battle sounds synthesised in the browser with [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT); icons from [Game Icons](https://game-icons.net) and [Lucide](https://lucide.dev) via [react-icons](https://react-icons.github.io/react-icons/)

## How to Play

1. **Place your castle.** Click a highlighted hex on the edge of the map, then click it again to confirm. The enemy castle is placed on the far side of the map.
2. **Take turns.** You and the enemy alternate turns. You have 60 seconds to plan, then press **End Turn** (or let the timer run out).
   - **Recruit:** pick a unit in the Barracks, click a highlighted hex next to your castle, then click it again to deploy. Units appear at the end of your turn and can move from your next turn. Click a queued unit to cancel it and get your gold back.
   - **Move:** click one of your units, then a highlighted hex - the route is drawn as you hover. If a hex is out of reach or impassable you get a short warning and the unit stays selected. Click a planned destination to cancel the move. Units walk there when the turn ends.
   - **Camera:** scroll or pinch to zoom in and out on any part of the map. The view swings to whoever's turn it is.
3. **Combat.** When a side ends its turn, its units automatically attack every enemy in range - adjacent for most units, up to 2 hexes for Archers. Defenders strike back only at attackers they can reach, so Archers firing from 2 hexes take no damage.
4. **Terrain matters.** Forests give cover (units there take 40% less damage, and Pikemen attack 50% harder from them), desert costs 2 movement to cross, gold mines pay out every round, and water and mountains are impassable. Hover any hex to see its effect.
5. **Economy.** At the end of every round both sides earn 5 gold, plus the value of any gold mines (resource hexes) their units stand on. Destroying an enemy unit pays a bounty of half its cost, and damaging the enemy castle plunders gold (1 per 2 damage).
6. **Win** by moving a unit onto the enemy castle, or by wearing it down. At the end of every round each unit within 3 hexes of an enemy castle deals damage equal to its attack power.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [Nunito](https://fonts.google.com/specimen/Nunito) for body text and [DynaPuff](https://fonts.google.com/specimen/DynaPuff) for titles and buttons.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
