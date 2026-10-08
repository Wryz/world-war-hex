import type { Metadata } from "next";
import { DynaPuff, Fredoka } from "next/font/google";
import "./globals.css";
import { AppBoot } from "@/components/shared/AppBoot";
import { DevPanel } from "@/components/shared/DevPanel";

// Playful display font for titles, buttons and big numbers
const dynaPuff = DynaPuff({
  variable: "--font-dyna-puff",
  subsets: ["latin"],
});

// Rounded, playful body text that still reads clearly at small sizes
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "World War Hex",
  description: "A military strategy game where players use environmental factors and medieval military tactics to destroy the enemy base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dynaPuff.variable} ${fredoka.variable} antialiased`}
      >
        <AppBoot />
        {children}
        <DevPanel />
      </body>
    </html>
  );
}
