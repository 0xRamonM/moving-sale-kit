import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/items";

// Everyone, AI agents included, may read the sale and use the chat; admin endpoints stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/chat"], disallow: ["/admin", "/api/upload", "/api/revalidate"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
