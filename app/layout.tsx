import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, siteStructuredData } from "@/lib/site-metadata";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#e7f1ff", interactiveWidget: "resizes-content" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Kuya J",
  creator: "BetterGov.ph",
  publisher: "BetterGov.ph",
  category: "Civic information",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  appleWebApp: { capable: true, title: "Kuya J", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: { url: "/icons/favicon.png", type: "image/png" },
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/icons/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-PH" className={figtree.variable}>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteStructuredData).replace(/</g, "\\u003c") }} />
        {children}
      </body>
    </html>
  );
}
