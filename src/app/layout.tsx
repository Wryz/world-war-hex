import type { Metadata } from "next";
import { DynaPuff } from "next/font/google";
// Rounded, playful body text that still reads clearly at small sizes (self-hosted)
import "@fontsource-variable/fredoka";
import "./globals.css";
import { AppBoot } from "@/components/shared/AppBoot";

// Playful display font for titles, buttons and big numbers
const dynaPuff = DynaPuff({
  variable: "--font-dyna-puff",
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
        className={`${dynaPuff.variable} antialiased`}
      >
        <AppBoot />
        {children}
      </body>
    </html>
  );
}
