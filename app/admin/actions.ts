"use server";

import { del } from "@vercel/blob";
import { refresh, updateTag } from "next/cache";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/auth";
import { sql, CATEGORIES, ITEMS_TAG, type Category, type Status } from "@/lib/db";
import { saveSettings } from "@/lib/settings";

const STATUSES: Status[] = ["available", "reserved", "sold"];

function itemsChanged() {
  updateTag(ITEMS_TAG);
  refresh();
}

export async function login(_prev: string | null, form: FormData) {
  if (!checkPassword(String(form.get("password") ?? ""))) return "Wrong password.";
  await startSession();
  refresh();
  return null;
}

export async function logout() {
  await endSession();
  refresh();
}

function parsePrice(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim().replace(",", ".").replace(/[€\s]/g, "");
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export type SaveState = { ok: boolean; error?: string; savedAt?: number };

export async function saveItem(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const id = Number(form.get("id")) || null;
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const [titlePt, titleEn, descPt, descEn] = ["title_pt", "title_en", "description_pt", "description_en"].map(text);
  const price = parsePrice(form.get("price"));
  const position = Number(form.get("position")) || 0;
  const images = JSON.parse(String(form.get("images") ?? "[]")) as string[];
  const rawCategory = String(form.get("category") ?? "");
  const category: Category = rawCategory in CATEGORIES ? (rawCategory as Category) : "house";
  const rawFrom = String(form.get("available_from") ?? "");
  const availableFrom = /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : null;

  if (!titlePt || !titleEn) return { ok: false, error: "Add the title in Portuguese and English." };

  if (id) {
    const [old] = await sql`select images from items where id = ${id}`;
    // Items without photos are kept off the site; their first photos put them live.
    const firstPhotos = (old?.images ?? []).length === 0 && images.length > 0;
    await sql`
      update items set title_pt = ${titlePt}, title_en = ${titleEn},
        description_pt = ${descPt}, description_en = ${descEn},
        price_cents = ${price}, images = ${images}, position = ${position}, category = ${category}, available_from = ${availableFrom},
        visible = case when ${firstPhotos} and status <> 'sold' then true else visible end
      where id = ${id}`;
    const removed = ((old?.images ?? []) as string[]).filter((u) => !images.includes(u));
    if (removed.length) await del(removed).catch(() => {});
  } else {
    await sql`
      insert into items (title_pt, title_en, description_pt, description_en, price_cents, images, position, category, available_from)
      values (${titlePt}, ${titleEn}, ${descPt}, ${descEn}, ${price}, ${images}, ${position}, ${category}, ${availableFrom})`;
  }
  itemsChanged();
  return { ok: true, savedAt: Date.now() };
}

export async function setStatus(id: number, status: Status) {
  await requireAdmin();
  if (!STATUSES.includes(status)) return;
  await sql`update items set status = ${status} where id = ${id}`;
  itemsChanged();
}

export async function setVisible(id: number, visible: boolean) {
  await requireAdmin();
  await sql`update items set visible = ${visible} where id = ${id}`;
  itemsChanged();
}

export async function deleteItem(id: number) {
  await requireAdmin();
  const [row] = await sql`delete from items where id = ${id} returning images`;
  if (row?.images?.length) await del(row.images as string[]).catch(() => {});
  itemsChanged();
}

export async function saveBotSettings(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  await saveSettings({ instructions: String(form.get("instructions") ?? "").trim() });
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function setHandled(id: number, handled: boolean) {
  await requireAdmin();
  await sql`update interests set handled = ${handled} where id = ${id}`;
  refresh();
}

export async function createRef(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const label = String(form.get("label") ?? "").trim().slice(0, 60);
  const slug = (String(form.get("slug") ?? "").trim() || label)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  if (!label || !slug) return { ok: false, error: "Give the link a name." };
  const rows = await sql`insert into refs (slug, label) values (${slug}, ${label}) on conflict do nothing returning slug`;
  if (!rows.length) return { ok: false, error: `“${slug}” already exists.` };
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function deleteRef(slug: string) {
  await requireAdmin();
  await sql`delete from refs where slug = ${slug}`;
  refresh();
}

// Pickup schedule: free-text entries the seller fills in.
function pickupFields(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "").trim().slice(0, 120);
  const [day, time, name, item, channel, handler] = ["day", "time", "name", "item", "channel", "handler"].map(text);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? { day, time, name, item, channel, handler } : null;
}

export async function savePickup(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id")) || null;
  const p = pickupFields(form);
  if (!p) return;
  if (id) {
    await sql`
      update pickups set day = ${p.day}, time = ${p.time}, name = ${p.name}, item = ${p.item}, channel = ${p.channel}, handler = ${p.handler}
      where id = ${id}`;
  } else {
    await sql`
      insert into pickups (day, time, name, item, channel, handler)
      values (${p.day}, ${p.time}, ${p.name}, ${p.item}, ${p.channel}, ${p.handler})`;
  }
  refresh();
}

// Reserving always books the pickup, so every reserved item shows up in the schedule.
export async function reserveItem(id: number, form: FormData) {
  await requireAdmin();
  const p = pickupFields(form);
  if (!p || !p.name || !p.handler) return;
  await sql`
    insert into pickups (day, time, name, item, channel, handler)
    values (${p.day}, ${p.time}, ${p.name}, ${p.item}, ${p.channel}, ${p.handler})`;
  await sql`update items set status = 'reserved' where id = ${id}`;
  itemsChanged();
}

export async function setPickupDone(id: number, done: boolean) {
  await requireAdmin();
  await sql`update pickups set done = ${done} where id = ${id}`;
  refresh();
}

export async function deletePickup(id: number) {
  await requireAdmin();
  await sql`delete from pickups where id = ${id}`;
  refresh();
}

export async function setPickupHandler(id: number, handler: string) {
  await requireAdmin();
  await sql`update pickups set handler = ${handler.slice(0, 40)} where id = ${id}`;
  refresh();
}
