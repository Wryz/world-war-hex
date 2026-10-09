# Music

The game ships with recorded music (below) and synthesises the rest in the browser (see
`src/lib/audio/`). Any file in this folder with one of the names below replaces the synthesised
version, with no code changes needed: add the file, then list its name in `manifest.json`, e.g.
`{ "files": ["battle.mp3", "victory.mp3"] }`. Anything not listed uses the synthesised music.

## Tracks included

All are CC0 (public domain), from OpenGameArt; no attribution is required, but they're credited
in the game (Stats & Save) anyway.

| File          | Track                                   | Composer                         |
| ------------- | --------------------------------------- | -------------------------------- |
| `menu.mp3`    | Medieval: Exploration                   | RandomMind                       |
| `map.mp3`     | Medieval: Harvest Season                | RandomMind                       |
| `battle.mp3`  | Medieval: Battle                        | RandomMind                       |
| `boss.mp3`    | Epic Boss Battle [Seamlessly Looping]   | Juhani Junkala (SubspaceAudio)   |
| `victory.mp3` | Medieval: Victory Theme (opening, 7 s)  | RandomMind                       |
| `defeat.mp3`  | Medieval: Defeat Theme (opening, 7 s)   | RandomMind                       |

Sources: opengameart.org/content/medieval-exploration, /medieval-harvest-season,
/medieval-battle, /boss-battle-music, /medieval-victory-theme and /medieval-defeat-theme.
The files were trimmed of leading and trailing silence, levelled to similar loudness and
re-encoded at 128 kbps; the victory and defeat themes are cut to their opening phrase.

## Looping tracks

These loop seamlessly, crossfade into each other and follow the music volume and mute settings.

| File        | Plays during                                   |
| ----------- | ---------------------------------------------- |
| `menu.mp3`  | Main menu: heroic and welcoming                |
| `map.mp3`   | Campaign map: light and adventurous            |
| `battle.mp3`| Battles: driving and tense                     |
| `boss.mp3`  | Boss battles: heavier and darker               |

Battle intensity (calm planning / normal / climax) only adds and removes layers in the
synthesised battle music; a `battle.mp3` override just gets slightly quieter or louder.

## Music for each region

A battle in a region plays `battle-<faction>.mp3` when the manifest lists one (a boss battle,
`boss-<faction>.mp3`), and `battle.mp3` / `boss.mp3` otherwise. The faction is the region's enemy;
the late-campaign rematch regions reuse their faction's music.

| Faction    | Regions                              | Battle file           | Track                                        | Licence   |
| ---------- | ------------------------------------ | --------------------- | -------------------------------------------- | --------- |
| `bandits`  | Greenvale Meadows                    | (uses `battle.mp3`)   | Medieval: Battle, RandomMind                 | CC0       |
| `goblins`  | Goblin Woods                         | `battle-goblins.mp3`  | Battle Theme A, cynicmusic                   | CC0       |
| `beasts`   | Howling Hills                        | `battle-beasts.mp3`   | Wind Run, TAD                                | CC-BY 4.0 |
| `swamp`    | Mirefen Marsh                        | `battle-swamp.mp3`    | Land of Misdeeds, Jonathan Shaw (InspectorJ) | CC-BY 3.0 |
| `desert`   | Sunscorch Desert                     | `battle-desert.mp3`   | The Eternal Sands, HitCtrl                   | CC-BY 3.0 |
| `frost`    | Frostpeak Pass, Rimeholt             | `battle-frost.mp3`    | Steeps of Destiny, Alexandr Zhelanov         | CC-BY 3.0 |
| `undead`   | Gravemoor, Hallowmere                | `battle-undead.mp3`   | Dark Descent, Matthew Pablo                  | CC-BY 3.0 |
| `orcs`     | Ironfang Badlands, The King's Road   | `battle-orcs.mp3`     | Ef Humeni Glorem, Alexandr Zhelanov          | CC-BY 4.0 |
| `infernal` | Emberforge Wastes, The Underkeep     | `battle-infernal.mp3` | Demonium, Alexandr Zhelanov                  | CC-BY 4.0 |
| `dragons`  | Dragonspire Peaks, The Last Bastion  | `battle-dragons.mp3`  | Colossal Boss Battle Theme (loop), Matthew Pablo | CC-BY 3.0 |

The CC-BY tracks require credit, given in the game (Stats & Save > Credits); "Land of Misdeeds"
must be credited as composed by Jonathan Shaw (www.jshaw.co.uk). Sources on OpenGameArt:
/content/battle-theme-a, /wind-run, /land-of-misdeeds-rpg-orchestral-essentials-evil-music,
/fantasy-music-the-eternal-sands, /steeps-of-destiny, /dark-descent, /ef-humeni-glorem, /demonium and
/colossal-boss-battle-theme. Each was trimmed of silence, levelled to about -16.5 LUFS like the
other tracks and re-encoded at 128 kbps.

## Stingers (play once, over the music)

| File              | Plays when                     |
| ----------------- | ------------------------------ |
| `victory.mp3`     | A battle is won                |
| `defeat.mp3`      | A battle is lost               |
| `star.mp3`        | A star is earned               |
| `unlock.mp3`      | Something new is unlocked      |
| `levelUp.mp3`     | The player levels up           |
| `bossAppears.mp3` | A boss enters the battle       |

Keep stingers short (about 1.5–4 seconds); the music ducks underneath them for their length.

## Finding more

[OpenGameArt](https://opengameart.org) has plenty of CC0 orchestral and fantasy music.
Licences there are set per submission and are sometimes changed or mis-labelled, so
double-check the licence on each track's own page before shipping it. Prefer CC0; CC-BY is fine
too if the author is credited in the game.

Tips: trim leading and trailing silence so loops are seamless, keep files around 128–192 kbps,
and aim for similar loudness across tracks (the music sits under the sound effects).
