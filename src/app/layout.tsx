import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  applicationName: "Maxi Trouvaille",
  title: {
    default: "Maxi Trouvaille - Boutique de bonnes affaires",
    template: "%s | Maxi Trouvaille",
  },
  description:
    "Boutique en ligne de trouvailles, lots, colis perdus, objets neufs ou quasi neufs et bonnes affaires.",
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: "Maxi Trouvaille",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: "/icons/favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "Maxi Trouvaille",
    description:
      "Boutique de bonnes affaires, colis perdus, lots et futures annonces vendeurs.",
    siteName: "Maxi Trouvaille",
    locale: "fr_FR",
    type: "website",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171717",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <ServiceWorkerRegister />
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
