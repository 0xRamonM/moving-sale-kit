"use client";

import { useState } from "react";
import type { Item } from "@/lib/db";
import { ItemRow } from "./item-row";

export type ItemListRow = { item: Item; price: string; interestCount: number };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "available", label: "For sale" },
  { key: "reserved", label: "Reserved" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

// Accents and case don't matter: "secador" finds "Secador", "agua" finds "água".
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Admin item list: search, a status filter, and always sorted by price, highest first.
export function ItemList({ rows, children }: { rows: ItemListRow[]; children?: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const terms = fold(query).split(/\s+/).filter(Boolean);
  const matches = (i: Item) => {
    const text = fold(`${i.title_pt} ${i.title_en} ${i.description_pt} ${i.description_en}`);
    return terms.every((t) => text.includes(t));
  };
  const shown = rows
    .filter((r) => matches(r.item) && (filter === "all" || r.item.status === filter))
    .sort((a, b) => (b.item.price_cents ?? -1) - (a.item.price_cents ?? -1));
  const count = (f: Filter) => rows.filter((r) => matches(r.item) && (f === "all" || r.item.status === f)).length;

  // Every item lands in exactly one group, checked in this order.
  const unsold = shown.filter((r) => r.item.status !== "sold");
  const groups = [
    { title: "On the site", rows: unsold.filter((r) => r.item.visible), open: true },
    { title: "Needs photos", hint: "add photos with Edit and they go live", rows: unsold.filter((r) => !r.item.visible && r.item.images.length === 0), open: true },
    { title: "Hidden", rows: unsold.filter((r) => !r.item.visible && r.item.images.length > 0), open: true },
    { title: "Sold", rows: shown.filter((r) => r.item.status === "sold"), open: !!query },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="w-full rounded-xl border border-border bg-surface py-2 pr-3 pl-9 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />
          <svg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
        <div className="flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-foreground text-background" : "text-muted hover:bg-surface-2"}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="font-normal opacity-70 tabular-nums">{count(f.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {children}

      {shown.length === 0 && <p className="text-sm text-muted">No items match.</p>}

      {groups.map((g) =>
        g.rows.length === 0 ? null : (
          <details key={g.title} className="group/section space-y-2" open={g.open}>
            <summary className="flex cursor-pointer items-baseline gap-2 font-semibold">
              {g.title}
              <span className="text-sm font-normal text-muted">{g.rows.length}</span>
              {g.hint && <span className="text-xs font-normal text-muted">· {g.hint}</span>}
            </summary>
            <ul className="mt-2 space-y-2">
              {g.rows.map((r) => (
                <ItemRow key={r.item.id} item={r.item} price={r.price} interestCount={r.interestCount} />
              ))}
            </ul>
          </details>
        ),
      )}
    </div>
  );
}
