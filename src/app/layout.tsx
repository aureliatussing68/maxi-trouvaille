import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MobileDemoNav } from "@/components/MobileDemoNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  applicationName: "Maxi Trouvaille",
  title: {
    default: "Maxi Trouvaille - Boutique en ligne à petits prix",
    template: "%s | Maxi Trouvaille",
  },
  description:
    "Les trouvailles malignes du moment à petits prix : maison, cuisine, high-tech, auto, animaux. Paiement sécurisé, livraison suivie, service client réactif.",
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
    title: "Maxi Trouvaille - Boutique en ligne à petits prix",
    description:
      "Maison, cuisine, high-tech, auto, animaux : les trouvailles malignes du moment. Paiement sécurisé et livraison suivie.",
    url: siteUrl,
    siteName: "Maxi Trouvaille",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/uploads/category-images/produits-partenaires.webp",
        width: 1200,
        height: 630,
        alt: "Maxi Trouvaille - produits partenaires",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maxi Trouvaille - Boutique en ligne à petits prix",
    description:
      "Maison, cuisine, high-tech, auto, animaux : les trouvailles malignes du moment. Paiement sécurisé et livraison suivie.",
    images: ["/uploads/category-images/produits-partenaires.webp"],
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
    <html lang="fr" className="h-full" data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col pb-20 antialiased md:pb-0">
        <ServiceWorkerRegister />
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileDemoNav />
        </CartProvider>
      </body>
    </html>
  );
}
