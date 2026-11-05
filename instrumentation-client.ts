import posthog from "posthog-js";
import { isInternal, setInternalFlag } from "./lib/internal";
import { markInternal } from "./lib/track";

// ?internal=1 marks this device as the seller's own (see lib/internal.ts); the param is then dropped from the URL.
const internalParam = new URLSearchParams(location.search).get("internal");
if (internalParam !== null) {
  if (internalParam === "0") setInternalFlag(false);
  else markInternal();
  const url = new URL(location.href);
  url.searchParams.delete("internal");
  history.replaceState(history.state, "", url);
}

// Product analytics. Events go through /ingest on our own domain (see next.config.ts)
// so ad blockers don't drop them, then on to PostHog's EU cloud.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (key && !isInternal()) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    person_profiles: "identified_only",
  });
}
