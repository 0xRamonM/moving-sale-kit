"use client";

import { Analytics } from "@vercel/analytics/next";
import { isInternal } from "@/lib/internal";

// Vercel Web Analytics, minus the seller's own devices.
export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => (isInternal() ? null : event)} />;
}
