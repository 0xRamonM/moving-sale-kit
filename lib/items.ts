import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql, ITEMS_TAG, toItems, withFutureDates } from "./db";

export { MAP_URL, SITE_URL } from "./site";

// Items shown on the public page (and to agents): only ones for sale, since people kept asking about reserved ones.
// Putting a reserved item back to For sale in the admin brings it back. available_from is set only for items not ready yet.
export async function getPublicItems() {
  "use cache";
  cacheTag(ITEMS_TAG);
  // Hourly, so items move out of the "available later" section on their date without a redeploy.
  cacheLife("hours");
  const rows = await sql`
    select * from items where visible and status = 'available'
    order by position, id`;
  return withFutureDates(toItems(rows));
}
