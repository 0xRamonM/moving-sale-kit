// ─────────────────────────────────────────────────────────────────────────────
// YOUR SALE. Edit this file: it's the only place with seller-specific details.
// Everything here is public (it ends up on the page), so never put a phone
// number or anything private in it. Safe to import from client components.
// ─────────────────────────────────────────────────────────────────────────────

// Your first name, as buyers see it ("Alex will get in touch with you").
export const SELLER = "Alex";

// Page title, in Portuguese and English.
export const SITE_TITLE = { pt: "Venda do Alex", en: "Alex's sale" };

// Where buyers pick things up. AREA is the neighbourhood, CITY the city.
// PICKUP_PLACE is written by the chat bot word for word and turned into a link to MAP_URL,
// so use a short, exact name (a shop, a café, a street corner). Don't use your home address.
export const AREA = { pt: "Arroios", en: "Arroios" };
export const CITY = { pt: "Lisboa", en: "Lisbon" };
export const PICKUP_PLACE = "Café Example, Rua Exemplo 1";
export const MAP_URL = "https://maps.google.com/?q=Arroios,Lisboa";

// IANA time zone for "today", the pickup schedule and analytics days.
export const TIME_ZONE = "Europe/Lisbon";

// Country calling code, added to local phone numbers buyers type without one (e.g. "912 345 678").
export const COUNTRY_CODE = "351";
// Length and first digit of a local mobile number without the country code (Portugal: 9 digits, starts with 9).
export const LOCAL_MOBILE = /^9\d{8}$/;

// People who can handle a pickup, shown as toggles in the admin's pickup schedule.
export const HANDLERS = ["Alex", "Sam"];

// Where you post your listings, offered as the "channel" of a pickup in the admin.
export const CHANNELS = ["FB Marketplace", "OLX", "Site", "WhatsApp", "Instagram"];

// Public URL of the site. On Vercel it's picked up automatically from the production domain;
// set NEXT_PUBLIC_SITE_URL to use a custom domain.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// Shared helpers built from the settings above.
export const PICKUP_AREA = { pt: `${AREA.pt}, ${CITY.pt}`, en: `${AREA.en}, ${CITY.en}` };
