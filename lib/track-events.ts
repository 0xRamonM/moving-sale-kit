// Events stored for the admin's Tracking screen (PostHog gets them too).
export const TRACKED_EVENTS = [
  "pageview",
  "chat_opened",
  "chat_message_sent",
  "lead_registered",
  "quick_reply_tapped",
  "chat_language_chosen",
  "chat_nudge_shown",
  // Older events from when the chat handed off to WhatsApp; kept so past data stays valid.
  "whatsapp_handoff_shown",
  "whatsapp_clicked",
  "pick_several_started",
  "photo_viewer_opened",
] as const;

export type TrackedEvent = (typeof TRACKED_EVENTS)[number];
