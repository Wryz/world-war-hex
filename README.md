# World War Hex

A turn-based strategy card game on a 3D hexagonal battlefield, built with Next.js, React, TypeScript, Tailwind CSS and three.js (via React Three Fiber and drei).

## The game in a nutshell

- **Cards.** Your troops are playing cards. You start with four and bring four into every battle, picked before each fight (the pre-battle screen marks the cards that counter that enemy, and Auto-pick chooses a strong set). In battle, tap a card, then a glowing hex next to your castle (or a camp you hold) to deploy it.
- **Bonds.** Twelve pairs of cards fight better together - Swordsmen and Pikemen form a Shield Wall (+15% health each), Archers and Longbowmen a Volley (+15% attack each), War Clerics give Berserkers Regenerates, and so on. Bring both cards of a bond into a battle and its bonuses apply to every troop you recruit from them; the pre-battle screen and the Army screen show which bonds you have and which are one card away.
- **Campaign.** 150 battles across 15 regions - Greenvale Meadows, Goblin Woods, Howling Hills, Mirefen Marsh, Sunscorch Desert, Frostpeak Pass, Gravemoor, Ironfang Badlands, Emberforge Wastes and Dragonspire Peaks, then five rematch regions where old foes return with allies: the King's Road (villages whose houses give cover and block arrows), haunted Hallowmere, the Underkeep's treasure vaults, frozen Rimeholt and the Last Bastion, where every army marches at once. The campaign map draws each region as its own island - grass and farmland, pine woods, desert dunes, snowfields, gloomy moors and scorched badlands - with the road winding past its ten levels. Each region has its own battle theme, terrain and enemy faction, an elite battle (a champion guards the castle) and a boss battle. Win to unlock the next level, and earn up to three stars per level: one for winning, and two and three for winning with enough points - the gold value of enemy troops destroyed, half the gold you earned, 15 for every camp you hold and 10 for every round left (the bars rise with the level's recommended power).
- **50 monsters.** Ten factions of five - bandits, goblins, beasts, swamp folk, the sand court, the frostborn, the undead, orcs, the infernal legion and the dragonkin - each with four troops the enemy recruits and a boss.
- **Bestiary.** Every monster you meet is added to the Bestiary on the main menu, with its lore, abilities, kill count and a 3D model to inspect.
- **Power.** Each card has a power rating from its stats and abilities, and your army's power is the sum of the four cards you bring. Every campaign level shows its recommended power, so you know when to upgrade first.
- **Coins.** Battles pay coins - more for wins and stars, a little for a loss - which buy new cards (the shop gains cards as you advance) and upgrade cards up to level 10. Win level 100 and cards can train on to elite levels 11-15, so the last five regions still have upgrades to chase.
- **Style.** Coins also buy cosmetics: seven card frames (Old Map, Frostbound, Emberforged, Obsidian, Royal Seal, a shimmering Prismatic foil...) and six castle styles (Desert Fort, Ice Citadel, Elven Spire, Shadow Keep, Golden Palace). They only change how your army looks, never how it fights.
- **Troop buffs.** Every troop shows the buffs working on it under its health tag - cover, high ground, a healing spring, a gold mine, berserk fury and its bonds (and drawbacks like low ground). Tap them to see each one's numbers.
- **Settings.** The gear on the main menu opens sound (separate sliders for the menu, map, battle and boss music, the jingles and sound effects), gameplay options, quick battles (a one-off battle on a random map at easy, medium or hard) and the full guide to the rules.
- **Stats and saves.** Lifetime stats and your progress live in the browser; download a save file to back it up or move it to another computer. The browser is asked to keep the save safe from automatic clean-up.
- **Offline.** After one visit online, the game keeps working without a connection: a service worker caches the pages, scripts, models, map art and sounds (and each music track once it has played).
- **Short battles.** Small maps, castles placed automatically, 30-second turns, a round limit (decided on points when time runs out), all of a turn's battles fought at once and a 2x speed button keep a battle to a few minutes.
- **Battle callouts.** When a fight breaks out, its special effects pop up above it - Sneak attack!, Flanked +25%, High ground, Counter x1.5, Cover, Armored, Berserk, Ambush! - green when they help you and red when they help the enemy, and the battle log lists them too.
- **Big moments.** First blood, double and triple kills, rampages, camp captures, crushing blows, last stands, the final round and boss kills get callouts, screen shake, slow motion, confetti and coins flying into your treasury. Castles shudder when hit and crumble when they fall, and fallen troops play out their deaths.
- **Music.** Recorded medieval menu, map, battle and boss themes with victory and defeat jingles (CC0 tracks by RandomMind and Juhani Junkala), plus synthesised jingles for stars, unlocks and bosses. Drop your own MP3s into `public/music/` to replace any of them (see its README).
- **Tutorial.** The first battle walks new players through playing a card, deploying, ending the turn and moving troops.

## How to Play

1. **Pick a battle.** Open the campaign map, pick the next level, choose the four cards to bring, compare your power with the recommended power, then press **Fight!**
2. **Play cards.** Tap a card in your hand, then a glowing hex next to your castle or a camp you hold. Its gold cost comes out of your treasury. Tap a troop you queued this turn to take it back.
3. **Move.** Tap one of your troops, then a highlighted hex. Rough ground costs more movement; water and mountains block the way (flyers pass over them).
4. **End your turn.** Troops arrive and move, then every troop in range attacks one enemy it can reach automatically - preferring one it can finish off, then one it is strong against. A defender splits its strike-back between the attackers it can reach, so archers shooting from 2 hexes and sneak attacks take no damage. The other side's troops strike back too: any troop of theirs that can reach an attacker (and isn't in a fight of its own) hits it, and the attacker, busy with its own target, can't hit back. The battle card shows every modifier, and health bars count down blow by blow. Then the enemy takes its turn.
5. **Win** by attacking the enemy castle: every troop that can reach the castle - from the next hex for most troops, from 2-3 hexes for archers and mages with a clear line of sight - strikes it for its attack (double for siege troops), unless it could finish off an enemy troop instead. Troops in reach strike the enemies attacking their castle the same way (a raider that falls does no damage). Bring its health down to 0 to win - troops can't step onto a castle. If the last round ends first, the battle is decided on points: the gold value of the enemy troops each side destroyed, plus half the gold it earned, plus 15 for every camp it holds (the top bar shows the score in the last three rounds).
6. **Earn gold** each turn: 5, plus any gold mines your troops hold and 2 for each camp you hold. Troops are expensive and tough, so a battle is fought with a handful of them: armies larger than 4 troops cost 2 gold upkeep per extra troop, and holding mines and camps beats massing troops. Destroying an enemy pays a bounty of half its cost, and damaging the enemy castle plunders gold. Your income per turn is shown next to your gold.

### Tactics

- **Zones of control.** Stepping next to an enemy ends a troop's move, so a line of troops really does hold a pass, and raiders have to fight their way through. Fliers pass over enemy lines.
- **Flanking.** When two or more of your troops attack the same enemy together, each extra attacker adds +25% damage, up to +50%; a lone attacker gets no bonus - gang up on one enemy rather than spreading out.
- **Threat preview.** Press **T** (or the crosshair in the top bar) to tint every hex the enemies you can see could strike next turn. With a troop selected, each hex it can move to shows the most damage it could take there (a skull means it could be destroyed).
- **Fog of war** (from level 11, and in medium and hard quick battles). You only see enemy troops your own troops, castle and camps can see: 2 hexes, 3 from hills and snow, and one more for scouts (Rogues and other skirmishers, and fliers). Forests hide troops from anyone not right next to them, and ridges and woods block sight. A troop that attacks or besieges gives its position away until its side's next turn. Marching into a hidden enemy stops your troop short - an ambush. Enemies that slip back into the fog are marked where you last saw them, and the AI plays by the same rules.

### Counters

Every troop belongs to a class, and each class hits some others 50% harder (spears hit cavalry twice as hard), so no single army beats them all:

| Class | Strong against |
|---|---|
| Spear (Pikemen, lizardmen, scorpions) | Cavalry (x2), Brutes |
| Cavalry (Knights, wolves, wyverns) | Ranged, Casters |
| Ranged (Archers, Longbowmen) | Spears, Brutes |
| Infantry (Swordsmen, skeletons, orc grunts) | Spears, Skirmishers |
| Skirmisher (Rogues, spiders, imps, ghosts) | Ranged, Casters |
| Brute (Berserkers, bears, golems, ogres, giants) | Infantry |
| Caster (Mages, shamans, witches) | - but their spells ignore cover and line of sight |

Ranged troops caught in close combat fight at half strength. Every card and unit shows its class and what it is strong and weak against.

### Height and line of sight

Every hex shows its height, a decimal number (water about 0.5, plains about 1.3, hills about 2.1, mountains about 2.7 - each hex varies a little). The height advantage comes from that number: every 1.0 of height the attacker stands above its target adds 30% damage, and every 1.0 below takes 30% away, rounded to a whole percent and capped at 50% either way - so even a small rise gives a small edge. Line of sight and ranged reach use height levels: water, swamp, ice and lava 0, most ground 1, hills and snow 2, mountains 3. Ranged troops on high ground reach one hex further. Shots at range are blocked by any hex in between that stands higher than both the shooter and the target: mountains block everything, ridges hide units from archers below, and forest canopies, ruined walls and village houses count one level higher. Spells arc over anything.

### Terrain

| Terrain | Height | Effect |
|---|---|---|
| Plains | 1 | No effect |
| Forest | 1 (trees 2) | Units take 40% less damage (except from spells); Pikemen attack 50% harder; blocks shots from below |
| Hills | 2 | High ground; costs 2 movement |
| Ruins | 1 (walls 2) | Units take 25% less damage (except from spells); blocks shots from below |
| Village | 1 (houses 2) | Units take 20% less damage (except from spells); the houses block shots from below |
| Desert | 1 | Costs 2 movement |
| Swamp | 0 | Low ground; costs 2 movement |
| Snow | 2 | High ground; costs 3 movement |
| Ice | 0 | Low ground; costs 2 movement |
| Spring | 1 | Heals 4 health at the end of each of your turns |
| Cursed Ground | 1 | Drains 2 health each turn - but heals the undead |
| Lava Field | 0 | Burns 4 health each turn (Fireborn troops are unharmed); costs 2 movement |
| Gold Mine | 1 | Pays its gold each turn while one of your units holds it |
| Mountains | 3 | Impassable (flyers pass over); blocks line of sight |
| Water | 0 | Impassable (flyers pass over) |

A unit can always step onto one neighbouring hex, however rough, even if that takes all of its movement.

### Abilities

Ranged, Long range, Spells (ignore cover and line of sight), Healer, Forest fighter, Sneak attack (no strike-back, except from other sneak attackers), Flying, Regenerates, Armored (2 less damage per fight), Siege (double castle damage), Berserk (+50% attack at half health), Undead, Pathfinder (rough ground costs 1) and Fireborn. Every card shows its abilities; hover them for details.

## Project Structure

### Game logic (`src/lib`)

- `game/troops.ts`: Every troop - the Kingdom's 13 cards and the 50 monsters - with stats, abilities, rarity and lore; card levels and power
- `game/gameState.ts`: Rules engine (pure functions): battle setup, the card hand, purchases, movement, combat (height, line of sight, counters, abilities), terrain, economy and upkeep, round limit and win conditions
- `game/mapGenerator.ts`: Seeded, themed map generation, including the campaign's region themes
- `game/hexUtils.ts`: Hex grid maths
- `ai/aiPlayer.ts`: The AI: scores every move on the fight it offers, the danger it walks into, the ground and its goal; recruits counters from whatever roster it has; plays either side, with selectable doctrines for simulations
- `campaign/levels.ts`: The 15 regions and 150 levels: enemy rosters and scaling, bosses, star goals and rewards
- `campaign/battleSetup.ts`: Builds a battle from a campaign level (or a quick battle) and the player's deck
- `meta/economy.ts`: Rewards, card prices, upgrade costs and the progression model behind recommended power
- `meta/profile.ts`: The player's saved progress, the shop, battle results, stats, and save export and import
- `audio/`: The music engine: instruments, a lookahead scheduler, the score notation and the tracks

### Screens (`src/app`)

- `page.tsx`: Main menu (`components/game/intro/IntroScreen`, with a 3D island of troops and monsters)
- `campaign`: The campaign map (each region an island of map tiles, laid out in `lib/campaign/mapArt.ts` and drawn by `components/menu/RegionMap`) and the pre-battle sheet: recommended power and picking your four cards (`components/menu/CampaignScreen`, `PreBattleSheet`; suggestions in `lib/meta/loadout.ts`)
- `army`: Your cards, the card shop and upgrades (`components/menu/ArmyScreen`)
- `bestiary`: The bestiary and its 3D model viewer (`components/menu/BestiaryScreen`, `TroopModelViewer`)
- `stats`: Stats and save files (`components/menu/StatsScreen`); the main menu's settings and guide are in `components/menu/SettingsPanel`
- `play`: A battle (`/play?level=7`, or `/play?mode=quick&difficulty=hard`)

### Battle (`src/components/game`)

- `GameController`: Runs a battle and lays out its HUD, records the result and shows the results screen
- `GameBoard`: The 3D board and camera (framed so the board sits just above the hand; drag to orbit, scroll to zoom; selecting something far away swings it round to the nearest of four sides, picking a card keeps or brings into view a side with your castle or a camp you hold, and when battles break out it rises to look down on them, then settles on the nearest side once they're over), routes, battle markers, deaths and damage numbers
- `UnitMesh`: An animated troop - KayKit character or procedural creature - walking, fighting blow by blow (see `utils/battleTiming`) and falling
- `Castle`, `Camp`, `HexTile`, `BoardDecorations`, `MovePath`: The rest of the board
- `cards/TroopCard`: A troop as a playing card, used everywhere
- `hud/`: `TopBar` (round, castles, gold, speed and menu buttons), `CardHand`, `SelectionCard`, `EventFeed`, `HelpPanel`, `TurnBanner`
- `shared/`: `ResultsScreen`, `TutorialCoach`, `BossIntro`
- `effects/`: Callouts, screen shake, slow motion, flying coins and confetti, and `useBattleMoments`, which spots the big moments
- `utils/UnitModelSystem`: How every troop looks: character, weapons, colour palette and animations, or creature body
- `utils/unitModelCache`: Loads models once, repaints their colour atlas per faction and clones them per unit
- `utils/creatures`: Procedural low-poly monsters (wolves, spiders, slimes, golems, wisps, dragons...)
- `storage/GameStorage`: Save and resume the battle in progress

### Balance

`npm run simulate` plays AI-vs-AI battles in which one side uses the deck the progression model expects at each level, and reports win rates and battle lengths. `npm run simulate -- --tune 20 1 2 3` searches for the enemy strength at which that deck wins its level's target share of battles: 90% on level 1, easing to 65% from level 16 on (`targetWinRate` in `levels.ts`). The constants in `src/lib/campaign/levels.ts` were tuned with it.

## Analytics

The game can send anonymous gameplay events to [PostHog](https://posthog.com) - battles started, won, lost and abandoned (with level, deck, bonds and duration), cards bought and upgraded, cosmetics bought, tutorial completion and save exports - to show where players get stuck in the campaign. Nothing is sent unless `NEXT_PUBLIC_POSTHOG_KEY` is set at build time (and optionally `NEXT_PUBLIC_POSTHOG_HOST`, default `https://us.i.posthog.com`). Session recording and autocapture are off, Do Not Track is respected, and players can switch it off in Settings. Events are defined in `src/lib/analytics.ts`.

## Credits

- Character models: [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) and [KayKit Character Pack: Skeletons](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) by Kay Lousberg ([CC0](http://creativecommons.org/publicdomain/zero/1.0/)), with the characters and weapons split from one shared animation pack and meshopt-compressed for the web
- Knights' horse: from the [three.js examples](https://github.com/mrdoob/three.js) (MIT), model by [mirada](https://mirada.com/) for ROME
- Monsters without a character model are procedural low-poly creatures built in code
- Music: "Medieval: Exploration", "Medieval: Harvest Season", "Medieval: Battle", "Medieval: Victory Theme" and "Medieval: Defeat Theme" by [RandomMind](https://opengameart.org/users/randommind), and "Epic Boss Battle" by [Juhani Junkala](https://opengameart.org/content/boss-battle-music) (all [CC0](http://creativecommons.org/publicdomain/zero/1.0/), from OpenGameArt); the remaining jingles are synthesised in the browser
- Battlefield scenery, castles and camps: [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) , [KayKit Halloween Bits](https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0) and [KayKit Dungeon Remastered](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0) by Kay Lousberg ([CC0](http://creativecommons.org/publicdomain/zero/1.0/)), packed into three meshopt-compressed GLBs in `public/models/kaykit/`
- Campaign map: [Map Pack](https://kenney.nl/assets/map-pack) by [Kenney](https://kenney.nl) ([CC0](http://creativecommons.org/publicdomain/zero/1.0/))
- Battle sounds are synthesised with [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT)
- Icons from [Game Icons](https://game-icons.net) and [Lucide](https://lucide.dev) via [react-icons](https://react-icons.github.io/react-icons/)

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [DynaPuff](https://fonts.google.com/specimen/DynaPuff) for titles and buttons; and [Fredoka](https://fonts.google.com/specimen/Fredoka) for body text (both under the SIL Open Font License).
