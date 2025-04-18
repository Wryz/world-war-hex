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
