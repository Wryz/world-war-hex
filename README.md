# Hex Hordes

A turn-based strategy card game on a 3D hexagonal battlefield, built with Next.js, React, TypeScript, Tailwind CSS and three.js (via React Three Fiber and drei).

## The game in a nutshell

- **Cards.** Your troops are playing cards. You start with four and bring four into every battle, picked in the Army (an empty slot is filled with a strong pick for the battle when you go in). In battle, tap a card, then a glowing hex next to your castle (or a camp you hold) to deploy it.
- **Fighting together.** Troops fight better for where they stand, not which cards they are: archers and mages screened by a front-line troop between them and the attacker take 40% less damage (50% behind armour), an enemy pinned next to one of your front-line troops takes 25% more from your archers and riders, front-line troops side by side form a shield wall (15% less damage), and a troop holding a bridge or gateway can't be flanked. The enemy forms up the same way.
- **Enemies that fight their own way.** Every faction has a trait: goblins come cheap and swarm (but packed together a blow on one hurts its neighbours), beasts hunt in packs, swamp folk, the Sand Court and the Frostborn cross their own ground freely, the undead rise again once unless a War Cleric or fire finishes them, orcs hit harder the more they are hurt, demons shrug off fire, and dragonkin flyers soar over walls and gatehouses.
- **Weather.** Fog banks drift across Mirefen Marsh, hiding the troops inside them; sandstorms in the Sunscorch Desert cut every shot's reach; blizzards in Frostpeak Pass and Rimeholt slow everyone; and ash on the Emberforge wind spreads fire faster. Storms blow two rounds in every four, and the top bar warns when one is coming.
- **Morale.** When a boss or champion falls its army is shaken, and a badly hurt troop surrounded with no friend beside it wavers: shaken troops hit 30% softer until their side's next turn is over (two turns after a boss falls). Bosses and the undead are fearless.
- **Challenges.** Every level past the first two has an optional harder way to win - by a round, without losses, with the castle near whole, taking both camps, with few troops, by toppling the castle or slaying the boss - for bonus coins the first time, and a medal on the campaign map.
- **Signature abilities.** Every Kingdom card has its own ability that only works when its condition is met: Swordsmen hit harder beside friends, Rogues alone, Archers when they hold still, Knights after a long charge; Pikemen brace on the enemy's turn, Mages ward the troops beside them, Shieldbearers pull enemies in, Berserkers heal on a kill, Longbowmen pierce cover, War Clerics smite the undead and demons, Siege Sappers dig out the ground around them, Pegasus Knights strafe whatever they fly past, and the Archmage strikes harder far from the enemy. It wakes at card level 2 and grows stronger every two levels (rank I to VII).
- **A battlefield to use.** Great trees tower over some forests: nothing walks through one and they block arrows, but a troop next to one can chop it down - it falls away from the troop, crushing whoever stands on the hex beyond (friend or foe), and its trunk blocks that hex for the rest of the battle (felled across water, it makes a bridge). On volcanic maps, lava sets the grass and woods around it alight: embers warn a turn ahead, then the hex burns for a round and a half - nobody can enter it, its smoke blocks arrows, troops caught in it are burned - and the fire spreads through forest, burning it down to open ground.
- **Buildings to fight over.** Every battlefield (after the first) has a catapult tower near the middle, watchtowers, a hamlet of houses and two workshops, placed where neither side has the longer march. Step onto one to take it (it turns your colour): a watchtower is high ground that sees far and keeps watch for you; a house shelters a garrison (40% less damage, no flanking) but burns; a crewed catapult tower bombards the weakest enemy you can see within 4 hexes, or the castle if you can see it (empty, it stays quiet); a blacksmith makes all your troops hit 10% harder, barracks let you deploy there with drilled recruits, a tavern pays 3 gold a turn and a lumber mill lets your troops fell trees from 2 hexes away.
- **Walls, gates and bridges, and troops that work.** Some battlefields have a stone wall across the middle: whoever holds the gatehouse decides who passes. Bridges cross the water. Siege Sappers tear down walls, gates, bridges, trunks and stakes; Rogues set dry ground alight; the new Engineers build bridges over water and plant stakes cavalry can't cross (and dig in, raising their ground, when they stand still). Select the troop, tap the gold hex next to it, and choose Move or the work.
- **Choose your castle.** Before the first turn, pick one of a few sites on your edge of the map for your castle; the enemy builds across the map from it.
- **Campaign.** 150 battles across 15 regions - Greenvale Meadows, Goblin Woods, Howling Hills, Mirefen Marsh, Sunscorch Desert, Frostpeak Pass, Gravemoor, Ironfang Badlands, Emberforge Wastes and Dragonspire Peaks, then five rematch regions where old foes return with allies: the King's Road (villages whose houses give cover and block arrows), haunted Hallowmere, the Underkeep's treasure vaults, frozen Rimeholt and the Last Bastion, where every army marches at once. The campaign map draws each region as its own island - grass and farmland, pine woods, desert dunes, snowfields, gloomy moors and scorched badlands - with the road winding past its ten levels. Each region has its own battle theme, terrain and enemy faction, an elite battle (a champion guards the castle) and a boss battle. Win to unlock the next level, and earn up to three stars per level: one for winning, and two and three for winning with enough points - the gold value of enemy troops destroyed, half the gold you earned, 15 for every camp you hold and 10 for every round left (the bars rise with the level's recommended power).
- **50 monsters.** Ten factions of five - bandits, goblins, beasts, swamp folk, the sand court, the frostborn, the undead, orcs, the infernal legion and the dragonkin - each with four troops the enemy recruits and a boss.
- **Bestiary.** Every monster you meet is added to the Bestiary on the main menu, with its lore, abilities, kill count and a 3D model to inspect.
- **Power.** Each card has a power rating from its stats and abilities, and your army's power is the sum of the four cards you bring. Every campaign level shows its recommended power, so you know when to upgrade first.
- **Coins.** Battles pay coins - more for wins and stars, a little for a loss - which buy new cards (the shop gains cards as you advance) and upgrade cards up to level 10. Win level 100 and cards can train on to elite levels 11-15, so the last five regions still have upgrades to chase.
- **Style.** Coins also buy cosmetics: seven card frames (Old Map, Frostbound, Emberforged, Obsidian, Royal Seal, a shimmering Prismatic foil...) and six castle styles (Desert Fort, Ice Citadel, Elven Spire, Shadow Keep, Golden Palace). They only change how your army looks, never how it fights.
- **Troop buffs.** Every troop shows the buffs working on it under its health tag - cover, high ground, a healing spring, a gold mine, berserk fury, its formation and its faction's trait (and drawbacks like low ground, being pinned or shaken). Tap them to see each one's numbers.
- **Settings.** The gear on the main menu opens sound (separate sliders for the menu, map, battle and boss music, the jingles and sound effects), gameplay options (text size, graphics - Auto, High or Low, where low turns off shadows, draws at the screen's own pixel size and thins out the weather, and Auto picks low on phones that report little memory or few cores (`src/lib/graphics.ts`) - battle speed, vibration on phones that support it - castle hits, kills, a boss's strikes and the battle won or lost), quick battles (a one-off battle on a random map at easy, medium or hard) and the full guide to the rules.
- **Stats and saves.** Lifetime stats and your progress live in the browser; download a save file to back it up or move it to another computer. The browser is asked to keep the save safe from automatic clean-up.
- **Cloud save.** Turned on in Stats & Save, it keeps a copy of your progress online (see **Cloud save** below), so clearing the browser can't lose it. Link an email address to the save, then sign in with it on another device (by the emailed link, or its code in the installed app) to play the same save there. When both copies have changed since they last agreed, the game asks which to keep.
- **Daily challenge.** One quick battle a day on the main menu, on the same battlefield for everyone: the map, the region (its ground and weather) and the difficulty (easy on Mondays, hard at weekends) all come from the date, and the rival kingdom fields its troops at your own card level. A battle begun before midnight still pays if it's won after. The first win of the day pays as much as clearing your next campaign level, plus a tenth more for every day won in a row (up to a week); losing costs nothing, so try again. It unlocks once the first battle is won, the day turns over at midnight UTC, and sharing the result sends friends the same battle with your score to beat (`src/lib/campaign/daily.ts`).
- **Offline.** After one visit online, the game keeps working without a connection: a service worker caches the pages and scripts once the first page has loaded, then the models, map art, card portraits and sounds once the game has been idle a while (and each music track once it has played), so a first visit on a slow connection isn't slowed down. The game can also be installed as an app (`src/app/manifest.ts`): it then opens full screen from the home screen or app list, and Settings offers an Install button where the browser allows it (or explains Share, then Add to Home Screen, on iPhone and iPad). On phones it runs edge to edge, around notches and camera cutouts, with its buttons and panels kept clear of them (the `--safe-*` insets in `globals.css`).
- **Short battles.** Small maps, castles placed automatically, 30-second turns, a round limit (decided on points when time runs out), all of a turn's battles fought at once and a 2x speed button keep a battle to a few minutes.
- **Battle callouts.** When a fight breaks out, its special effects pop up above it - Sneak attack!, Flanked +25%, High ground, Counter x1.5, Cover, Armored, Berserk, Ambush! - green when they help you and red when they help the enemy, and the battle log lists them too.
- **Resign.** The flag in the top bar gives up the battle on your turn (after asking): it counts as a defeat and earns nothing.
- **Replays.** Once a battle is over, **Watch the replay** on the results screen plays it again from the first turn, fog lifted so you see what the enemy was up to, at the pace it was fought (your thinking time cut short), with pause, restart and 2x speed. It lasts until you leave the battle.
- **Battle Friends.** **Battle Friends** on the main menu opens a room and gives you an invite link: up to eight players join with the four cards saved in their own Army, the host sets the rules and starts. A free-for-all or teams; AI kingdoms can make up the numbers; the weather can be chosen; the map can be random or mirrored (the same ground for every side - possible for 2, 3 and 6 sides, and for pairs of sides with 4 and 8); and fair mode puts every card at one level (skill trees off). The map is the usual size for up to four players and grows by a hex each way for every player beyond that, with every castle spread evenly around its edge and a camp between each pair of neighbours. Every side still in the battle strikes back at an attacker within its reach, whoever was attacked; a side whose castle falls is out, and the last team standing wins (or, when the rounds run out, the most points). No coins are won or lost. The same battles can be practised offline against the AI.
- **Challenge a friend.** After a quick battle, **Challenge** shares a link to the same battlefield and the same enemy army with your score; your friend fights it with their own cards, gets a callout with the score to beat, and the results compare the two.
- **Big moments.** First blood, double and triple kills, rampages, camp captures, crushing blows, last stands, the final round and boss kills get callouts, screen shake, slow motion, confetti and coins flying into your treasury. Castles shudder when hit and crumble when they fall, and fallen troops play out their deaths.
- **Music.** Recorded medieval menu, map, battle and boss themes with victory and defeat jingles (CC0 tracks by RandomMind and Juhani Junkala), a battle theme and a boss theme of its own for each region (from OpenGameArt, credited in the game), plus synthesised jingles for stars, unlocks and bosses. Drop your own MP3s into `public/music/` to replace any of them (see its README).
- **Tutorial.** The first battle is guided by a pointing hand that plays the game's own AI plan for your side, with a few words on why (every time it's played). From the second battle on, the hand comes back once for each new thing a battle brings - the fog of war, a boss's marked strike, a great tree to fell, a catapult tower, a gatehouse.

## How to Play

1. **Pick a battle.** Open the campaign map and tap the next level: a callout shows the enemy, your power against the recommended power and the optional challenge. Press **Fight!**, then tap one of the glowing sites to build your castle.
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
- `game/signatures.ts`: Each Kingdom card's signature ability, its condition and its numbers by rank
- `game/battlefield.ts`: The battlefield's objects - great trees to fell and fires around lava - and their numbers
- `game/structures.ts`: The buildings - watchtowers, houses, the catapult tower and the workshops - and their numbers
- `game/formations.ts`: Fighting together: screens, pinning, shield walls and holding a crossing
- `game/bosses.ts`: Each boss's power - strikes marked a turn ahead, minions, bites - and its rage
- `game/regionRules.ts`: Faction traits, regional weather (fog banks, sandstorms, blizzards, ashfall) and morale
- `game/tutorialPlan.ts`: The tutorial's plan for a turn, from the AI playing the player's side, with captions
- `ai/aiPlayer.ts`: The AI: scores every move on the fight it offers, the danger it walks into, the ground and its goal; recruits counters from whatever roster it has; plays either side, with selectable doctrines for simulations
- `campaign/levels.ts`: The 15 regions and 150 levels: enemy rosters and scaling, bosses, star goals and rewards
- `campaign/battleSetup.ts`: Builds a battle from a campaign level (or a quick battle) and the player's deck
- `campaign/challenges.ts`: Each level's optional challenge and its bonus
- `campaign/daily.ts`: The daily challenge: the day's battle from the date, its reward and the streak
- `cloudSave.ts`: Cloud save: syncing the profile with the `cloud_saves` table, choosing between two changed copies, and linking an email
- `graphics.ts`: The graphics setting and what each quality changes in the 3D scenes
- `legal.ts`: The contact address and date shown on the privacy policy and terms
- `meta/economy.ts`: Rewards, card prices, upgrade costs and the progression model behind recommended power
- `haptics.ts`: Vibration on phones, and its setting
- `meta/profile.ts`: The player's saved progress, the shop, battle results, stats, and save export and import
- `game/sides.ts`: The sides of a battle: turn order, teams and allies, enemies, sides knocked out, and how the log names them (the campaign is fought between `player` and `ai`; a bigger battle has sides `s1`...`s8`, and its AI sides `ai1`...)
- `pvp/arena.ts`: Builds a free-for-all or team battle: the map's size, mirrored maps, weather, fair mode and the AI's kingdoms
- `pvp/room.ts`, `pvp/supabase.ts`: Online rooms (see **Online battles** below)
- `audio/`: The music engine: instruments, a lookahead scheduler, the score notation and the tracks

### Screens (`src/app`)

- `page.tsx`: Main menu (`components/game/intro/IntroScreen`, with a 3D island of troops and monsters)
- `campaign`: The campaign map (each region an island of map tiles, laid out in `lib/campaign/mapArt.ts` and drawn by `components/menu/RegionMap`); tapping a level opens a callout from its spot (the enemy, your power against the recommended, weather, the challenge, the reward) with the button to fight it, and any empty deck slots are filled for the battle (`components/menu/CampaignScreen`, `LevelPopup`, `battleDeck` in `lib/campaign/battleSetup.ts`; suggestions in `lib/meta/loadout.ts`)
- `army`: Your cards, the card shop and upgrades (`components/menu/ArmyScreen`)
- `bestiary`: The bestiary and its 3D model viewer (`components/menu/BestiaryScreen`, `TroopModelViewer`)
- `stats`: Stats and save files (`components/menu/StatsScreen`); the main menu's settings and guide are in `components/menu/SettingsPanel`
- `play`: A battle (`/play?level=7`, `/play?mode=quick&difficulty=hard`, or the daily challenge, `/play?mode=quick&daily=2026-10-10`)
- `privacy`, `terms`: The privacy policy and terms of service (`components/menu/LegalPage`), linked from the main menu and Settings; `robots.ts` and `sitemap.ts` list the public pages for search engines
- `pvp`: Battle Friends: the rooms page, a room's lobby (`/pvp?room=ABC234`) and its battle, and practice against the AI (`components/arena/`: `PvpScreen`, `ArenaSettingsForm`, `ArenaBattle` - the battle screen with the standings - and `OnlineBattle`)

### Battle (`src/components/game`)

- `GameController`: Runs a battle and lays out its HUD, records the result and shows the results screen
- `GameBoard`: The 3D board and camera (each turn it frames your troops and the enemies near them, just above the hand; drag or one finger to pan, right-drag or Shift-drag to turn and tilt, a two-finger twist to turn and two fingers slid up or down to tilt, scroll or pinch to zoom - but not while it flies somewhere on its own; selecting something far away swings it round to the nearest of four sides, picking a card brings your castle into the frame, and when battles break out it rises to look down on them at a slight tilt, then settles on the nearest side once they're over), routes, battle markers, deaths and damage numbers
- `UnitMesh`: An animated troop - KayKit character or procedural creature - walking, fighting blow by blow (see `utils/battleTiming`) and falling
- `Castle`, `Camp`, `HexTile`, `BoardDecorations`, `MovePath`: The rest of the board
- `cards/TroopCard`: A troop as a playing card, used everywhere
- `hud/`: `TopBar` (round, castles, gold, speed and menu buttons), `CardHand`, `SelectionCard`, `EventFeed`, `HelpPanel`, `TurnBanner`
- `shared/`: `ResultsScreen`, `TutorialCoach`, `BossIntro`
- `replay/`: Recording the battle as the board showed it, and watching it again (`BattleReplay`, `ReplayBar`)
- `effects/`: Callouts, screen shake, slow motion, flying coins and confetti, and `useBattleMoments`, which spots the big moments
- `utils/UnitModelSystem`: How every troop looks: character, weapons, colour palette and animations, or creature body
- `utils/unitModelCache`: Loads models once, repaints their colour atlas per faction and clones them per unit
- `utils/creatures`: Procedural low-poly monsters (wolves, spiders, slimes, golems, wisps, dragons...)
- `storage/GameStorage`: Save and resume the battle in progress

### Dev tools

On the dev server (`npm run dev`), or any copy of the game served from localhost, a pink **DEV** button (bottom left of the menus) opens shortcuts: coins (+10,000, max, zero, or infinite - topped back up after every purchase), unlock or lock every campaign level, own every card, set them all to one level, reset them to the starter set, or reset all progress. Each card in the Army also gets − and + buttons to set its level for free. None of it appears on the live site (`src/lib/meta/devTools.ts`, `src/components/shared/DevPanel.tsx`).

### Card art

Every card shows a picture of its troop's own 3D model - no ground, no shadow - over the faction's colour and the card frame's pattern, so the frames from the Style shop show behind the troop (`src/components/game/cards/cardArt.ts`). The pictures in `public/cards/` are transparent WebP images rendered from the dev page `/dev/card-art?type=<troop>`: with the dev server running, `node scripts/render-card-art.mjs [troop ...]` photographs them (it needs Playwright: `npm i --no-save playwright && npx playwright install chromium`). Re-run it after changing a troop's model.

### Balance

`npm run simulate` plays AI-vs-AI battles in which one side uses the deck the progression model expects at each level, and reports win rates and battle lengths. `npm run simulate -- --tune 20 1 2 3` searches for the enemy strength at which that deck wins its level's target share of battles: 90% on level 1, easing to 65% from level 16 on (`targetWinRate` in `levels.ts`). The constants in `src/lib/campaign/levels.ts` were tuned with it.

## Analytics

The game can send anonymous gameplay events to [PostHog](https://posthog.com) - battles started, won, lost and abandoned (with level, deck and duration), cards bought and upgraded, cosmetics bought, tutorial completion and save exports - to show where players get stuck in the campaign. Nothing is sent unless `NEXT_PUBLIC_POSTHOG_KEY` is set at build time (and optionally `NEXT_PUBLIC_POSTHOG_HOST`, default `https://us.i.posthog.com`). Session recording and autocapture are off, Do Not Track is respected, and players can switch it off in Settings. Events are defined in `src/lib/analytics.ts`.

The same events, plus page views, can also go to Google Analytics 4: set `NEXT_PUBLIC_GA_MEASUREMENT_ID` (the `G-...` ID of a GA4 web stream) at build time. Google signals and ad personalisation are off for it, and the Settings switch turns it off too.

## Ads

The web version can show ads through [Google H5 Games Ads](https://developers.google.com/ad-placement) (AdSense's Ad Placement API), in `src/lib/ads.ts`:

- **Rewarded ad.** When an ad is ready, the results screen offers "Watch an ad for +N coins", half the battle's reward again (`AD_BONUS_FRACTION` in `src/lib/meta/economy.ts`). Players who skip it progress at the normal pace.
- **Break ad.** Leaving the results screen (Next Level, Map or Army) may play an ad first. Never during a battle, not in a player's first three battles, and not within 90 seconds of another ad.
- The game's music and sounds go quiet while an ad plays.

Nothing loads unless `NEXT_PUBLIC_ADSENSE_CLIENT` (your `ca-pub-...` publisher ID) is set at build time, so a build without it (such as a paid desktop version) has no ads. `/ads.txt` is generated from the same ID. Set `NEXT_PUBLIC_ADS_TEST=1` as well to get Google's test ads while trying it out. Ads only serve once the site is approved in AdSense and enrolled in H5 Games Ads, and players in the EEA, UK and Switzerland must be shown a Google-certified consent message, which AdSense's Privacy & messaging page can set up without code changes.

## Credits

- Character models: [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) and [KayKit Character Pack: Skeletons](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) by Kay Lousberg ([CC0](http://creativecommons.org/publicdomain/zero/1.0/)), with the characters and weapons split from one shared animation pack and meshopt-compressed for the web
- Knights' horse: from the [three.js examples](https://github.com/mrdoob/three.js) (MIT), model by [mirada](https://mirada.com/) for ROME
- Monsters without a character model are procedural low-poly creatures built in code
- Music: "Medieval: Exploration", "Medieval: Harvest Season", "Medieval: Battle", "Medieval: Victory Theme" and "Medieval: Defeat Theme" by [RandomMind](https://opengameart.org/users/randommind), and "Epic Boss Battle" by [Juhani Junkala](https://opengameart.org/content/boss-battle-music) (all [CC0](http://creativecommons.org/publicdomain/zero/1.0/), from OpenGameArt); the remaining jingles are synthesised in the browser
- Battlefield scenery, castles and camps: [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) , [KayKit Halloween Bits](https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0) and [KayKit Dungeon Remastered](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0) by Kay Lousberg ([CC0](http://creativecommons.org/publicdomain/zero/1.0/)), packed into meshopt-compressed GLBs in `public/models/kaykit/` (the castle styles are KayKit buildings too)
- Campaign map: [Map Pack](https://kenney.nl/assets/map-pack) by [Kenney](https://kenney.nl) ([CC0](http://creativecommons.org/publicdomain/zero/1.0/))
- Battle sounds are synthesised with [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT)
- Icons from [Game Icons](https://game-icons.net) and [Lucide](https://lucide.dev) via [react-icons](https://react-icons.github.io/react-icons/)

## Online battles

Rooms live in a [Supabase](https://supabase.com) project. Its tables, access rules and functions are in `supabase/migrations` (applied to the project when they reach `main`, through Supabase's GitHub integration). Players are anonymous Supabase users, made on their device the first time they go online. The project's URL and publishable key are in `src/lib/pvp/supabase.ts`; set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to use another project.

The host's game runs the battle - the same rules engine as everywhere else, the AI's sides included - and sends every step of it, gzipped, to the others over the room's private Realtime channel (`room:<code>`, open only to the room's members). Everyone else plans their own turn on their copy and sends their orders to the host with a secret only the host can read, so nobody can give orders for someone else's side. A player who drops out has their turns end when the timer runs out; the host keeps the battle on their device, so reloading the page carries on. Saves can be edited, so a player's cards are only as honest as their device: fair mode makes that moot.

## Cloud save

Saves are kept in the same Supabase project as the online rooms, in the `cloud_saves` table (`supabase/migrations/20261010150000_cloud_saves.sql`): one row per account, readable and deletable only by its owner, and written through `put_cloud_save`. Every copy sent gets a random revision id, and the function only replaces the revision the device last agreed with, so two devices (or tabs) can't overwrite each other's progress unasked: when both changed, the player chooses. It also clears away saves untouched for two years. An emailed sign-in link only works in the browser that asked for it (`src/lib/emailLink.ts`), so nobody can send a link that signs a player into another account; on any other device the player types the code from the email. The account is the anonymous one the device already uses for rooms; linking an email turns it into a permanent account that can sign in elsewhere.

Before email linking works for players, the Supabase project needs:

- **Custom SMTP** (Authentication → Emails → SMTP settings). Supabase's own email service only sends to the project's team members, and only a few an hour.
- **Redirect URLs** (Authentication → URL Configuration): the site URL, plus `https://hexhordes.com/stats` (and any preview domains) in the allow list, as the emailed links return to `/stats?cloud=...`.
- **The code in the emails** (Authentication → Emails → Templates): add `{{ .Token }}` to the *Magic Link* and *Change Email Address* templates, so players of the installed app (where links open in the browser instead) can type the code.

## Legal pages

`/privacy` and `/terms` describe what the game stores and sends (saves on the device, online rooms and cloud saves in Supabase, PostHog and Google Analytics, AdSense) and the rules for playing. Players are asked to write to `admin@hexhordes.com` (`CONTACT_EMAIL` in `src/lib/legal.ts`); update `LEGAL_UPDATED` in `src/lib/legal.ts` whenever either page changes.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [DynaPuff](https://fonts.google.com/specimen/DynaPuff) for titles and buttons; and [Fredoka](https://fonts.google.com/specimen/Fredoka) for body text (both under the SIL Open Font License).
