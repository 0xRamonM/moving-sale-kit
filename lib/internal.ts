// The seller's own devices are marked in localStorage so none of the analytics
// (PostHog, Vercel, our own Tracking screen) count their visits. Set by opening the admin,
// or by visiting /?internal=1 once (/?internal=0 undoes it).
const KEY = "sale_internal";

export function isInternal() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setInternalFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {}
}
