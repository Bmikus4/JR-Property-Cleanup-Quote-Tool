import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JR Property Cleanup Quote Tool",
    short_name: "JR Quotes",
    description: "Field quoting tool for property cleanup technicians",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a3a5c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
