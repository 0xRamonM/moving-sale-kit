// The seller's first message to a buyer the chat registered, in the buyer's language,
// plus links to open it in WhatsApp or Telegram. Pure functions, used in the admin.
import type { Interest } from "./db";
import { AREA, COUNTRY_CODE, LOCAL_MOBILE, MAP_URL, PICKUP_PLACE, SELLER } from "./site";

// With COUNTRY_CODE 351: "912 345 678" → "351912345678"; "+44 7700 900123" → "447700900123". Null if it isn't a phone number.
export function phoneDigits(raw: string) {
  let d = raw.trim().replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");
  if (LOCAL_MOBILE.test(d)) d = `${COUNTRY_CODE}${d}`; // local mobile without country code
  return d.length >= 8 && d.length <= 15 ? d : null;
}

function euros(cents: number | null) {
  if (cents === null) return "";
  const e = cents / 100;
  return ` (${Number.isInteger(e) ? e : e.toFixed(2).replace(".", ",")} €)`;
}

// "Today at 7pm" reads mid-sentence as "today at 7pm".
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function leadMessage(lead: Interest) {
  const first = lead.name.trim().split(" ")[0];
  const hi = first ? ` ${first}` : "";
  if (lead.language === "pt") {
    return [
      `Olá${hi}! Sou ${SELLER}, da venda em ${AREA.pt}.`,
      `Recebi o teu interesse em: ${lead.item_title_pt}${euros(lead.item_price_cents)}.`,
      lead.pickup_when && `Disseste que podias vir buscar ${lower(lead.pickup_when)}. Confirmamos a hora?`,
      lead.offer && `Sobre a tua proposta (${lead.offer}):`,
      `A recolha é em ${PICKUP_PLACE}, ${AREA.pt}: ${MAP_URL}`,
    ].filter(Boolean).join("\n");
  }
  return [
    `Hi${hi}! It's ${SELLER}, from the sale in ${AREA.en}.`,
    `I got your interest in: ${lead.item_title}${euros(lead.item_price_cents)}.`,
    lead.pickup_when && `You said you could pick it up ${lower(lead.pickup_when)}. Shall we confirm a time?`,
    lead.offer && `About your offer (${lead.offer}):`,
    `Pickup is at ${PICKUP_PLACE} in ${AREA.en}: ${MAP_URL}`,
  ].filter(Boolean).join("\n");
}

export function whatsappLink(lead: Interest) {
  const digits = phoneDigits(lead.contact);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(leadMessage(lead))}` : null;
}

// Telegram can't pre-fill a message to a phone number, so the admin copies it first.
export function telegramLink(lead: Interest) {
  const digits = phoneDigits(lead.contact);
  return digits ? `https://t.me/+${digits}` : null;
}
