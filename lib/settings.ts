import "server-only";
import { sql } from "./db";
import { PICKUP_AREA, PICKUP_PLACE, SELLER } from "./site";

export type Settings = { instructions: string };

export const DEFAULT_INSTRUCTIONS = `- Pickup only, at ${PICKUP_PLACE} in ${PICKUP_AREA.en}. No delivery or shipping.
- The only thing needed to register someone's interest is a phone number. Ask for it as soon as they're interested and register right away.
- Prices are as listed. If someone offers less, note the offer and pass it on; never accept or reject an offer yourself.
- If you don't know something about an item (size, condition, model, age), say ${SELLER} can answer that when they get in touch.`;

export async function getSettings(): Promise<Settings> {
  const rows = (await sql`select key, value from settings`) as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    instructions: map.instructions || DEFAULT_INSTRUCTIONS,
  };
}

export async function saveSettings(settings: Settings) {
  for (const [key, value] of Object.entries(settings)) {
    await sql`
      insert into settings (key, value) values (${key}, ${value})
      on conflict (key) do update set value = excluded.value`;
  }
}
