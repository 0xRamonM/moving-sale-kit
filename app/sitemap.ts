import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/items";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/llms.txt`, changeFrequency: "daily" },
    { url: `${SITE_URL}/items.json`, changeFrequency: "daily" },
  ];
}
