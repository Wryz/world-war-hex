import type { Metadata, Viewport } from "next";
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

const DESCRIPTION = "A fantasy strategy card game on a 3D hex battlefield: play your troops, read the land and topple the enemy castle.";

export const metadata: Metadata = {
  metadataBase: new URL("https://hexhordes.com"),
  title: "Hex Hordes",
  applicationName: "Hex Hordes",
  description: DESCRIPTION,
  openGraph: { title: "Hex Hordes", description: DESCRIPTION, siteName: "Hex Hordes", url: "/", images: ["/logo.png"], type: "website" },
  twitter: { card: "summary", title: "Hex Hordes", description: DESCRIPTION, images: ["/logo.png"] },
  appleWebApp: { title: "Hex Hordes", capable: true, statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// The browser bar and the installed game's title bar take the game's background colour
// (and the game runs edge to edge: the --safe-* insets in globals.css keep the HUD clear of notches)
export const viewport: Viewport = {
  themeColor: "#0f172a",
  viewportFit: "cover",
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
