import { loadFont } from "@remotion/fonts";
import React from "react";
import { interpolate, staticFile, useCurrentFrame } from "remotion";

// FONT: the captions' typeface - Hex Hordes' own: DynaPuff for titles (its font-display) and
// Fredoka for small text (its body font), both SIL OFL, bundled so renders don't need Google Fonts.
//   scale: size multiplier (DynaPuff is wide and round: ~0.8 fits the same lines as a condensed font)
//   stroke: outline width as a share of the size
//   caps: set captions in capitals (the game writes its callouts in title case: "Double Kill!")
export const FONT = { family: "DynaPuff", file: "fonts/DynaPuff-Bold.ttf", scale: 0.8, stroke: 0.06, caps: false };
export const DISPLAY = FONT.family;
export const BODY = "Fredoka";
loadFont({ family: FONT.family, url: staticFile(FONT.file), weight: "700" });
loadFont({ family: BODY, url: staticFile("fonts/Fredoka-SemiBold.ttf"), weight: "600" });

// BRAND: the game's own colours - its callout tones (components/game/effects/EffectsLayer.tsx),
// the slate-900 it outlines everything in, and the logo's gold.
export const TONES = {
  gold: { text: "#fcd34d", glow: "rgba(245, 158, 11, 0.55)" },
  red: { text: "#fca5a5", glow: "rgba(239, 68, 68, 0.55)" },
  blue: { text: "#93c5fd", glow: "rgba(59, 130, 246, 0.55)" },
  purple: { text: "#d8b4fe", glow: "rgba(168, 85, 247, 0.55)" },
  green: { text: "#86efac", glow: "rgba(34, 197, 94, 0.55)" },
} as const;
/** Highlight colour for *words* and labels. */
export const ACCENT = TONES.gold.text;
/** Second, hotter highlight (bosses, danger, defeat). */
export const HOT = TONES.red.text;
/** Light text (the game's slate-50). */
export const CREAM = "#f8fafc";
/** Outline / dark (the game's slate-900). */
export const INK = "#0f172a";
/** The logo's gold. */
export const LOGO_GOLD = "#d9a200";
/** The game's primary button (emerald-600 on an emerald-800 ledge). */
export const BUTTON = { bg: "#059669", ledge: "#065f46" };

const glowOf = (color: string) => Object.values(TONES).find((t) => t.text === color)?.glow ?? "rgba(0,0,0,0.5)";

/** Splits "Double *Kill!*" into plain and highlighted runs. */
const runs = (text: string) => text.split(/(\*[^*]+\*)/).filter(Boolean).map((r) => (r.startsWith("*") ? { hi: true, t: r.slice(1, -1) } : { hi: false, t: r }));

/** The game's own callout entrance (globals.css momentPop): slams in big and tilted, overshoots, settles. */
export const momentPop = (f: number) => ({
  scale: interpolate(f, [0, 4, 6, 8], [2.2, 0.92, 1.04, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  rotate: `${interpolate(f, [0, 4, 6], [-4, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}deg`,
  opacity: interpolate(f, [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
});

/** A caption in the style of the game's battle callouts: DynaPuff, slate outline and ledge, a tone's glow. */
export const Caption: React.FC<{ text: string; sub?: string; accent?: string; top?: number; size?: number; delay?: number }> = ({
  text,
  sub,
  accent = ACCENT,
  top = 300,
  size: baseSize = 150,
  delay = 0,
}) => {
  const f = useCurrentFrame() - delay;
  if (f < 0) return null;
  const size = baseSize * FONT.scale;
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.02,
          textAlign: "center",
          textTransform: FONT.caps ? "uppercase" : "none",
          color: CREAM,
          WebkitTextStroke: `${Math.round(size * FONT.stroke)}px ${INK}`,
          paintOrder: "stroke fill",
          textShadow: `0 ${Math.round(size * 0.07)}px 0 ${INK}, 0 0 ${Math.round(size * 0.35)}px ${glowOf(accent)}`,
          ...momentPop(f),
        }}
      >
        {runs(text).map((r, i) => (
          <span key={i} style={{ color: r.hi ? accent : CREAM }}>
            {r.t}
          </span>
        ))}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: size * 0.22,
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: Math.round(size * 0.34),
            color: CREAM,
            background: "rgba(15, 23, 42, 0.85)",
            border: `3px solid ${accent}`,
            borderRadius: 999,
            padding: `${Math.round(size * 0.06)}px ${Math.round(size * 0.24)}px`,
            boxShadow: `0 6px 0 ${INK}`,
            translate: interpolate(f, [3, 8], ["0px 30px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            opacity: interpolate(f, [3, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
