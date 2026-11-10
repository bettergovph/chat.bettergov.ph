import type { MetadataRoute } from "next";
import { SITE_URL, SOCIAL_IMAGE } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only public information pages: conversations have no public URL or archive.
  return [
    { url: `${SITE_URL}/`, images: [`${SITE_URL}${SOCIAL_IMAGE.url}`] },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
  ];
}
