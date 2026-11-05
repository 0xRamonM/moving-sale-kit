"use client";

import { useEffect } from "react";
import { markInternal } from "@/lib/track";

// Any device that opens the admin while logged in stops counting in the analytics.
export function MarkDevice() {
  useEffect(() => markInternal(), []);
  return null;
}
