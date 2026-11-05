import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Category } from "./categories";
import { TIME_ZONE } from "./site";

export { CATEGORIES, type Category } from "./categories";

export const sql = neon(process.env.DATABASE_URL!);

export type Status = "available" | "reserved" | "sold";

export type Item = {
  id: number;
  title_pt: string;
  title_en: string;
  description_pt: string;
  description_en: string;
  price_cents: number | null;
  images: string[];
  status: Status;
  category: Category;
  available_from: string | null; // YYYY-MM-DD; still in use until then, can be reserved now
  visible: boolean;
  position: number;
  created_at: string;
};

export type Interest = {
  id: number;
  item_id: number;
  item_title: string;
  item_title_pt: string;
  item_price_cents: number | null;
  name: string;
  contact: string; // phone number since the chat started requiring one
  message: string; // the bot's summary for the seller
  language: "pt" | "en";
  pickup_when: string;
  offer: string;
  app: string; // "whatsapp" | "telegram" | "" for older leads
  chat_messages: { role: "user" | "assistant"; content: string }[] | null; // the conversation that led here
  handled: boolean;
  created_at: string;
};

export const ITEMS_TAG = "items";

// Today's date in the sale's time zone as YYYY-MM-DD.
export function localToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

// Rows from the database, with the date column as a plain YYYY-MM-DD string.
export function toItems(rows: Record<string, unknown>[]): Item[] {
  return rows.map((r) => ({
    ...r,
    available_from: r.available_from instanceof Date ? r.available_from.toISOString().slice(0, 10) : null,
  })) as Item[];
}

// For the public page: an available-from date only matters while it's still in the future.
export function withFutureDates(items: Item[], today = localToday()): Item[] {
  return items.map((i) => ({ ...i, available_from: i.available_from && i.available_from > today ? i.available_from : null }));
}

const PT_MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "27 de novembro" / "27 November", or "27 nov" / "27 Nov" when short.
export function formatDay(iso: string, lang: "pt" | "en", month: "long" | "short" = "long") {
  const date = new Date(`${iso}T00:00:00Z`);
  if (lang === "pt" && month === "short") return `${date.getUTCDate()} ${PT_MONTHS_SHORT[date.getUTCMonth()]}`;
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month, timeZone: "UTC" }).format(date);
}

// A number for real prices; a { pt, en } pair for the two special cases.
export function formatPrice(cents: number | null): string | { pt: string; en: string } {
  if (cents === null) return { pt: "Aceito propostas", en: "Make an offer" };
  if (cents === 0) return { pt: "Grátis", en: "Free" };
  const euros = cents / 100;
  return `${Number.isInteger(euros) ? euros : euros.toFixed(2).replace(".", ",")} €`;
}
