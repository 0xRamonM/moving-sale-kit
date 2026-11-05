"use client";

import { useState, useTransition } from "react";
import type { Item, Status } from "@/lib/db";
import { CATEGORIES } from "@/lib/categories";
import { deleteItem, setStatus, setVisible } from "./actions";
import { ItemForm } from "./item-form";
import { MarketplaceKit } from "./marketplace-kit";
import { PickupForm } from "./schedule";

const STATUS_STYLE: Record<Status, string> = {
  available: "bg-accent-soft text-accent-ink",
  reserved: "bg-amber-200 text-amber-950",
  sold: "bg-neutral-800 text-white",
};

export function ItemRow({ item, price, interestCount }: { item: Item; price: string; interestCount: number }) {
  // Which panel is open under the row: the edit form, the Marketplace kit, or the pickup to book when reserving.
  const [panel, setPanel] = useState<"edit" | "fb" | "reserve" | null>(null);
  const [pending, start] = useTransition();

  return (
    <li className={`card p-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 sm:items-center">
        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:size-16">
          {item.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.images[0]} alt="" className="size-full object-cover" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Phones: name wraps to two lines with the price below; wider screens: one line. */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
            <span className="line-clamp-2 text-sm leading-snug font-medium sm:truncate sm:text-base">{item.title_pt}</span>
            <span className="shrink-0 text-sm text-muted tabular-nums">{price}</span>
          </div>
          <div className="hidden truncate text-xs text-muted sm:block">{item.title_en}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`pill max-sm:hidden ${STATUS_STYLE[item.status]}`}>{item.status}</span>
            <span className="pill bg-surface-2 text-muted">{CATEGORIES[item.category].en}</span>
            {item.available_from && <span className="pill bg-sky-100 text-sky-950">from {item.available_from}</span>}
            {!item.visible && <span className="pill bg-surface-2 text-muted">hidden</span>}
            {interestCount > 0 && <span className="pill bg-blue-100 text-blue-900">{interestCount} interested</span>}
            <span className="text-muted">#{item.position}</span>
          </div>
        </div>

        {/* 2×2 grid of actions, always visible (no hover needed on phones). */}
        <div className="grid w-40 shrink-0 grid-cols-2 gap-1 sm:w-52 sm:gap-1.5">
          <select
            aria-label="Status"
            className={`btn btn-sm w-full px-1 max-sm:text-[11px] ${STATUS_STYLE[item.status]}`}
            value={panel === "reserve" ? "reserved" : item.status}
            onChange={(e) => {
              const status = e.target.value as Status;
              if (status === "reserved") return setPanel("reserve");
              if (panel === "reserve") setPanel(null);
              start(() => setStatus(item.id, status));
            }}
          >
            <option value="available">For sale</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
          </select>
          <button className="btn btn-sm" onClick={() => start(() => setVisible(item.id, !item.visible))}>
            {item.visible ? "Hide" : "Show"}
          </button>
          <button className="btn btn-sm" onClick={() => setPanel((p) => (p === "edit" ? null : "edit"))}>
            Edit
          </button>
          <button
            className="btn btn-sm text-red-700"
            onClick={() => confirm(`Delete “${item.title_en}” and its photos?`) && start(() => deleteItem(item.id))}
          >
            Delete
          </button>
          {item.status !== "sold" && (
            <button
              className={`btn btn-sm col-span-2 ${panel === "fb" ? "border-[#1877f2] bg-[#1877f2] text-white hover:bg-[#1877f2]" : "text-[#1877f2]"}`}
              onClick={() => setPanel((p) => (p === "fb" ? null : "fb"))}
            >
              Marketplace kit
            </button>
          )}
        </div>
      </div>

      {panel === "reserve" && (
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <p className="mb-1 font-medium">Book the pickup to reserve it</p>
          <PickupForm reserve={{ id: item.id, item: item.title_en }} onDone={() => setPanel(null)} />
        </div>
      )}

      {panel === "fb" && (
        <div className="mt-3 border-t border-border pt-3">
          <MarketplaceKit item={item} images={item.images} />
        </div>
      )}

      {panel === "edit" && (
        <div className="mt-3 border-t border-border pt-3">
          <ItemForm
            initial={{
              id: item.id,
              title_pt: item.title_pt,
              title_en: item.title_en,
              description_pt: item.description_pt,
              description_en: item.description_en,
              price: item.price_cents === null ? "" : String(item.price_cents / 100),
              position: item.position,
              category: item.category,
              available_from: item.available_from,
              images: item.images,
            }}
            onDone={() => setPanel(null)}
          />
        </div>
      )}
    </li>
  );
}
