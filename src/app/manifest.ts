import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hattrick Alchemy",
    short_name: "HT Alchemy",
    description: "Optimize youth and senior squads with CHPP-powered insights.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f1e3",
    theme_color: "#2f5130",
    categories: ["sports", "utilities"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/ht-alchemy-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ht-alchemy-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ht-alchemy-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
