import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_NOM_PRESSING ?? "Pressing",
  description: "Gestion de pressing — commandes, atelier, livraison.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Le comptoir travaille au téléphone autant qu'à l'ordinateur.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
