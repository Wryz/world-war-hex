# Music overrides

The game synthesises all of its music in the browser (see `src/lib/audio/`). Any file dropped
into this folder with one of the names below replaces the synthesised version, with no code
changes needed: add the file, then list its name in `manifest.json`, e.g.
`{ "files": ["battle.mp3", "victory.mp3"] }`. Anything not listed uses the synthesised music.

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

## Suggested free tracks

[OpenGameArt](https://opengameart.org) has plenty of CC0 (public domain) orchestral and fantasy
music that fits. Some to try (search for them by name, or search for CC0 "orchestral",
"fantasy battle" or "medieval"):

- "Swordfight" by Kistol: `battle.mp3`
- "Heartfelt Battle": `battle.mp3` or `boss.mp3`
- "Orcs Victorious" by Bobjt: `boss.mp3`
- "Laments of the War" by Cethiel: `defeat.mp3` or a slow alternative for `map.mp3`
- "A Legend Will Rise" by CodeManu: `menu.mp3`
- RandomMind's medieval tracks: `map.mp3` and `menu.mp3`

Licences on OpenGameArt are set per submission and are sometimes changed or mis-labelled, so
double-check the licence on each track's own page before shipping it. Prefer CC0; CC-BY is fine
too if the author is credited in the game.

Tips: trim leading and trailing silence so loops are seamless, keep files around 128–192 kbps,
and aim for similar loudness across tracks (the music sits under the sound effects).
