# Painted troop card art

All 63 troop portraits were generated with the built-in image generation tool from
the prompts in `PROMPTS.md`. `prompts.json` contains the shared style and each troop
prompt. Each generation used the preserved 3D model render from `../card-renders`
and the painted Swordsmen as the style reference. Swordsmen, Giant Spider, and Elder
Dragon were generated first as the style anchors.

The final WebP masters are 600×480 with genuine alpha transparency. They are trimmed,
fit within 560×448, centered, and encoded at quality 86. Matching copies in
`../../public/cards` are consumed by the game's existing cardArtUrl function.

`preview-1.jpg` through `preview-4.jpg` show the complete set against navy for review.
These preview backgrounds are not part of the transparent card assets.

`scripts/render-card-art.mjs` preserves paintings found here and copies them into
`public/cards` instead of replacing them with newly rendered 3D portraits.
