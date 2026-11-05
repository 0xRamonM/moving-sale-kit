"use client";

import { useEffect } from "react";
import { capture, registerRef } from "@/lib/track";

let sent = false; // once per page load, even if the effect runs twice

// Counts a visit to the public page for the admin's Tracking screen.
export function PageTracker() {
  useEffect(() => {
    if (sent) return;
    sent = true;
    registerRef();
    capture("pageview");
  }, []);
  return null;
}
