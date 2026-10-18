import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Caption, INK } from "./Caption";

export type CoverProps = {
  /** A still from the footage (public/stills/...). */
  still: string;
  text: string;
  sub?: string;
  accent?: string;
  /** Title position (px from the top); keep it inside the profile grid's 4:5 crop (285–1635). */
  top?: number;
};

/**
 * The reel's cover: a frame of the fight with its title. The title sits in the middle
 * band, so it still reads in the profile grid's square/4:5 crop.
 */
export const Cover: React.FC<CoverProps> = ({ still, text, sub, accent, top = 620 }) => (
  <AbsoluteFill style={{ backgroundColor: INK }}>
    <Img src={staticFile(still)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
    <Caption text={text} sub={sub} accent={accent} top={top} size={170} delay={-10} />
    <Img src={staticFile("brand/logo.png")} style={{ position: "absolute", width: 170, left: 455, top: Math.max(1390, top + 690) }} />
  </AbsoluteFill>
);
