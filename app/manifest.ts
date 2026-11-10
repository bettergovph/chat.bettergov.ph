import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kuya J — Philippine Civic Companion",
    short_name: "Kuya J",
    description: "Clear answers about Philippine public services, laws and government data, with sources you can trace.",
    lang: "en-PH",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e7f1ff",
    theme_color: "#e7f1ff",
    categories: ["education", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
