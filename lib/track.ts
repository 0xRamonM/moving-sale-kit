"use client";

import posthog from "posthog-js";
import { isInternal, setInternalFlag } from "./internal";
import type { TrackedEvent } from "./track-events";

// Anonymous visitor id (kept across visits) and session id (one per tab session), plus the ref link
// the session arrived with (?ref=fb). Storage can be blocked, so every access is guarded.
function stored(store: () => Storage, key: string, make: () => string | null) {
  try {
    const existing = store().getItem(key);
    if (existing) return existing;
    const value = make();
    if (value) store().setItem(key, value);
    return value;
  } catch {
    return make();
  }
}

export function context() {
  const id = () => crypto.randomUUID();
  return {
    visitor: stored(() => localStorage, "sale_visitor", id)!,
    session: stored(() => sessionStorage, "sale_session", id)!,
    // First ref seen in this session wins, so later navigation keeps the attribution.
    ref: stored(() => sessionStorage, "sale_ref", () => new URLSearchParams(location.search).get("ref")),
  };
}

function send(body: string) {
  if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

export function capture(type: TrackedEvent, props: { itemIds?: number[] } & Record<string, unknown> = {}) {
  if (isInternal()) return;
  const { visitor, session, ref } = context();
  if (type !== "pageview") posthog.capture(type, { ...props, ref });
  send(JSON.stringify({ type, visitor, session, ref, itemIds: props.itemIds ?? [] }));
}

// Stops all analytics on this device from now on, and asks the server to drop this
// visitor's past events from the Tracking screen.
export function markInternal() {
  if (isInternal()) return;
  setInternalFlag(true);
  if (posthog.__loaded) posthog.opt_out_capturing();
  const { visitor, session } = context();
  send(JSON.stringify({ type: "internal", visitor, session }));
}

// Tags PostHog with the session's ref so its own pageviews can be split by link too.
export function registerRef() {
  if (isInternal()) return;
  const { ref } = context();
  if (ref) posthog.register({ ref });
}
