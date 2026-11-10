import type { Metadata } from "next";

// Public URLs must stay stable across local previews and Worker deployments.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://chat.bettergov.ph";
export const SITE_TITLE = "Kuya J — Philippine AI Assistant | BetterGov.ph";
export const SITE_DESCRIPTION = "Ask Kuya J about Philippine government services, laws, budgets and public data. Get answers with sources in English, Filipino or Taglish. By BetterGov.ph.";
export const SOCIAL_IMAGE = {
  url: "/social/kuya-j-og-v1.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Ask Kuya J, your Philippine AI companion. Laws, services, budgets and public data. An initiative by BetterGov.ph.",
};

export function pageMetadata(path: string, title: string, description: string): Metadata {
  const url = new URL(path, SITE_URL).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Kuya J by BetterGov.ph",
      locale: "en_PH",
      url,
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: SOCIAL_IMAGE.url, alt: SOCIAL_IMAGE.alt }],
    },
  };
}

export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "BetterGov.ph",
      url: "https://bettergov.ph/",
      logo: `${SITE_URL}/brand/bettergov-horizontal-primary.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Kuya J",
      alternateName: "Kuya J by BetterGov.ph",
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      inLanguage: "en-PH",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export const applicationStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE_URL}/#application`,
  name: "Kuya J",
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
  applicationCategory: "ReferenceApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and an internet connection for chat.",
  image: `${SITE_URL}${SOCIAL_IMAGE.url}`,
  publisher: { "@id": `${SITE_URL}/#organization` },
  isPartOf: { "@id": `${SITE_URL}/#website` },
  featureList: ["Philippine public-service guidance", "Laws and bills", "National budgets and public projects", "Statistics and source references", "English, Filipino and Taglish questions"],
};
