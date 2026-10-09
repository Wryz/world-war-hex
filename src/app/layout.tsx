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

const DESCRIPTION = "A fantasy strategy card game on a 3D hex battlefield: play your troops, read the land and topple the enemy castle.";

export const metadata: Metadata = {
  metadataBase: new URL("https://hexhordes.com"),
  title: "Hex Hordes",
  applicationName: "Hex Hordes",
  description: DESCRIPTION,
  openGraph: { title: "Hex Hordes", description: DESCRIPTION, siteName: "Hex Hordes", url: "/", images: ["/logo.png"], type: "website" },
  twitter: { card: "summary", title: "Hex Hordes", description: DESCRIPTION, images: ["/logo.png"] },
  appleWebApp: { title: "Hex Hordes" },
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
