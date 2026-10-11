# Portfolio art

## Thumbnail

`hex-hordes-thumbnail-1080p.png` (and a smaller `.jpg`) is a 1920×1080 thumbnail of the game for a
portfolio. It uses the game's own branding: the sky colour of the main menu (`#b3e1ff`), the hex
helmet logo, the DynaPuff "Hex HORDES" wordmark with its navy outline, Fredoka for the text, and
the navy chips and amber numbers from the menus.

What's in it:

- **The island**: the landing page's first island (`/dev/hero-poster`), rendered on a canvas twice
  the usual size so it stays sharp at 1080p.
- **The troops**: the AI-painted card portraits from `art/card-ai` (Swordsmen, Archmage, Orc
  Warlord and the Elder Dragon).

They were put together in HTML and saved as an image with Playwright's Chromium.

## Hero clip

`hex-hordes-hero-15s.mp4` is a 15-second product demo for the top of a portfolio page: 1920×1080,
30 fps, H.264 with AAC stereo sound, set up to start playing before it has fully downloaded.
`hex-hordes-hero-poster.jpg` is its title frame, to show while the video loads.

| Time       | Shot                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| 0 – 2.6 s  | Title: the landing island turning and changing region as the logo and wordmark drop in       |
| 2.4 – 4.8 s | "Conquer the realm": the campaign map pans from Sunscorch Desert to Frostpeak Pass and opens a level |
| 4.7 – 6.7 s | "Play your cards": a card picked in Emberforge Wastes, its deploy hexes lit by the castle   |
| 6.5 – 8.9 s | "Read the land": a Knights charge, with the battle card showing its charge and high-ground bonuses |
| 8.8 – 12.4 s | "Topple the castle": Knights strike the castle in Greenvale Meadows, Victory!, and the castle crumbles |
| 12.1 – 15 s | End card: the island, the tagline and hexhordes.com                                         |

All the footage is the game itself: real campaign battles, with the player's side played by the
game's own planner (the one the tutorial hand uses) through the normal controls. Each frame was
captured on a stepped clock so the animation stays smooth. Fog of war was off while filming so the
enemy stays in view. The title and end cards use the landing page's live island.

Sound: "Medieval: Battle" and "Medieval: Victory Theme" by RandomMind (CC0, the game's own menu
and battle music, see `public/music/README.md`), with the game's own sound effects: its ZzFX
sword, bounty and fall sounds and its UI clicks, placed where they happen on screen. The mix is
about −16 LUFS, a normal level for web video.
