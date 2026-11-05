import { isAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { TRACKED_EVENTS } from "@/lib/track-events";

// Records one anonymous event for the admin's Tracking screen. No IPs or personal data are stored.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const type = String(body?.type ?? "");
  const visitor = String(body?.visitor ?? "").slice(0, 64);
  const session = String(body?.session ?? "").slice(0, 64);
  // A device was marked as the seller's own (lib/internal.ts): forget what it was counted for so far.
  if (type === "internal" && visitor) {
    await sql`delete from events where visitor = ${visitor}`;
    return new Response(null, { status: 204 });
  }
  if (!TRACKED_EVENTS.includes(type as never) || !visitor || !session) return new Response(null, { status: 400 });

  // The seller's own visits (logged in to the admin) and obvious bots don't count.
  const ua = request.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|preview|headless/i.test(ua) || (await isAdmin())) return new Response(null, { status: 204 });

  const ref = typeof body?.ref === "string" && body.ref ? body.ref.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) : null;
  const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.map(Number).filter(Number.isInteger).slice(0, 40) : [];
  await sql`insert into events (type, visitor, session, ref, item_ids) values (${type}, ${visitor}, ${session}, ${ref}, ${itemIds})`;
  return new Response(null, { status: 204 });
}
