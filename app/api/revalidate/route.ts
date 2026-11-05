import { revalidateTag } from "next/cache";
import { ITEMS_TAG } from "@/lib/db";

// Refreshes the public page after items are changed straight in the database (e.g. by a script).
// Usage: curl -X POST -H "Authorization: Bearer $SESSION_SECRET" https://…/api/revalidate
export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.SESSION_SECRET}`) {
    return new Response("Not authorised", { status: 401 });
  }
  revalidateTag(ITEMS_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}
