import type { Metadata } from "next";
import { Nunito, DynaPuff } from "next/font/google";
import "./globals.css";
import { AppBoot } from "@/components/shared/AppBoot";

// Readable body font
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

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
        className={`${nunito.variable} ${dynaPuff.variable} antialiased`}
      >
        <AppBoot />
        {children}
      </body>
    </html>
  );
}
