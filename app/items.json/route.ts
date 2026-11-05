import { getPublicItems, MAP_URL, SITE_URL } from "@/lib/items";
import { PICKUP_AREA, PICKUP_PLACE, SELLER } from "@/lib/site";

// Machine-readable item list for agents and scripts. See /llms.txt for how to ask about or buy items.
export async function GET() {
  const items = await getPublicItems();
  return Response.json({
    seller: SELLER,
    pickup: { area: PICKUP_AREA.en, place: PICKUP_PLACE, map: MAP_URL, delivery: false },
    currency: "EUR",
    howToBuy: `${SITE_URL}/llms.txt`,
    items: items.map((i) => ({
      id: i.id,
      title: { en: i.title_en, pt: i.title_pt },
      description: { en: i.description_en, pt: i.description_pt },
      price: i.price_cents === null ? null : i.price_cents / 100,
      status: i.status,
      category: i.category,
      availableFrom: i.available_from, // null = available now; otherwise reserve now, pickup from this date
      photos: i.images,
      url: `${SITE_URL}/#item-${i.id}`,
    })),
  });
}
