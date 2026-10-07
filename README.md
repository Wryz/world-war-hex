# Hex Kingdoms - Board Game

A strategic hexagonal grid board game built with React, TypeScript, and Tailwind CSS.

## Project Structure

The game is organized into modular components for better maintainability:

### Core Components

- `GameController`: Main game controller that manages game state and orchestrates the different phases
- `GameBoard`: Renders the hexagonal game board
- `HexTile`: Individual hexagon tile component

### Game Phases

- `src/components/game/phases/`
  - `SetupPhase`: Initial game phase for placing the player's base
  - `PlanningPhase`: Main game phase for purchasing units and planning moves

### Combat System

- `src/components/game/combat/`
  - `CombatResolver`: Handles combat resolution between units

### UI Components

- `src/components/game/dashboard/`
  - `GameDashboard`: Game information dashboard showing player and enemy units
- `src/components/game/shared/`
  - `GameOverScreen`: End game screen showing the winner
  - `SaveGameButton`: Button for saving the current game

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
- Interactive sound effects for enhanced gameplay experience

## How to Play

1. **Place your castle.** Click a highlighted hex on the edge of the map, then click it again to confirm. The enemy castle is placed on the far side of the map.
2. **Take turns.** You and the enemy alternate turns. You have 60 seconds to plan, then press **End Turn** (or let the timer run out).
   - **Recruit:** pick a unit in the Barracks, click a highlighted hex next to your castle, then click it again to deploy. Units appear at the end of your turn and can move from your next turn. Click a queued unit to cancel it and get your gold back.
   - **Move:** click one of your units, then a highlighted hex. Click the gold marker to cancel a move. Units can't cross water, mountains or enemy units.
3. **Combat.** After a side moves, each of its units attacks every adjacent enemy unit. When you're attacked you choose to **Stand & Fight** or **Retreat**.
4. **Economy.** At the end of every round both sides earn 5 gold, plus the value of any gold mines (resource hexes) their units stand on.
5. **Win** by moving a unit onto the enemy castle, or by wearing it down. At the end of every round each unit within 3 hexes of an enemy castle deals damage equal to its attack power.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
