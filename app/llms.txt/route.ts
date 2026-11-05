import { CATEGORIES, formatDay, formatPrice, type Item } from "@/lib/db";
import { getPublicItems, MAP_URL, SITE_URL } from "@/lib/items";
import { AREA, PICKUP_AREA, PICKUP_PLACE, SELLER, SITE_TITLE } from "@/lib/site";

// Plain-text guide for AI agents: what's for sale, how pickup works, and how to ask about or buy items.
function price(item: Item) {
  const p = formatPrice(item.price_cents);
  return typeof p === "string" ? p : p.en.toLowerCase();
}

function line(item: Item) {
  const status = item.status === "available" ? "available" : item.status;
  const details = item.description_en ? ` ${item.description_en}` : "";
  const later = item.available_from
    ? ` Still in use: can be reserved now, pickup from ${formatDay(item.available_from, "en")} (${item.available_from}).`
    : "";
  const photos = item.images.length ? `\n  Photos: ${item.images.join(" ")}` : "";
  return `- [${item.id}] ${item.title_en} (${item.title_pt}): ${price(item)}, ${status}, ${CATEGORIES[item.category].en.toLowerCase()}.${later}${details}\n  Link: ${SITE_URL}/#item-${item.id}${photos}`;
}

export async function GET() {
  const items = await getPublicItems();
  const forSale = items.filter((i) => i.status !== "sold");
  const sold = items.filter((i) => i.status === "sold");

  const body = `# ${SITE_TITLE.en} (${SITE_TITLE.pt})

> ${SELLER} is selling their own second-hand things. Pickup only, in ${PICKUP_AREA.en}, at ${PICKUP_PLACE} (${MAP_URL}). No delivery or shipping. Prices in euros.

## How buying works

- Pickup only, in ${PICKUP_AREA.en}. No delivery or shipping.
- Prices are as listed. Offers are passed on to ${SELLER}, who decides.
- Payment and the exact pickup time are arranged with ${SELLER}, who contacts the buyer.
- "reserved" means someone is already arranging it; it may still fall through.
- Some items are still in use and marked "Still in use": they can be reserved now and picked up from the date given.

## Asking questions or buying, for agents

Humans tap "Tenho interesse / I'm interested" on an item, which opens a chat. Agents can use the same chat over HTTP:

POST ${SITE_URL}/api/chat
Content-Type: application/json

{"itemIds": [12], "messages": [{"role": "user", "content": "Is it still available? I could pick it up Saturday afternoon. My name is Ana."}]}

- itemIds: one or more ids from the list below (several items can go in one chat).
- messages: the whole conversation so far, alternating user/assistant, ending with a user message. Send back each "reply" as an assistant message.
- The response is {"reply": "...", "registered": {"registered": true} | null}.
- When the buyer has picked items, accepted pickup in ${AREA.en}, said roughly when they can come and given a way to be contacted (phone, email or Instagram), the chat registers their interest and "registered" is set. ${SELLER} then contacts your user to finish.
- Replies come in the language of the last message (Portuguese or English).

## For sale (${forSale.length})

${forSale.map(line).join("\n")}
${sold.length ? `\n## Recently sold\n\n${sold.map((i) => `- ${i.title_en} (${i.title_pt})`).join("\n")}\n` : ""}
## Other formats

- Web page: ${SITE_URL}
- JSON: ${SITE_URL}/items.json
`;

  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
