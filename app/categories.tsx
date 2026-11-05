"use client";

import { useSyncExternalStore } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";

type Filter = Category | "all";
const EVENT = "categorychange";

// The active category lives in the URL (?c=sports) so a filtered view can be shared.
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function readFilter(): Filter {
  const c = new URLSearchParams(window.location.search).get("c");
  return c && c in CATEGORIES ? (c as Category) : "all";
}

function setFilter(next: Filter) {
  const url = new URL(window.location.href);
  if (next === "all") url.searchParams.delete("c");
  else url.searchParams.set("c", next);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(EVENT));
}

// Category chips above the grid. Every card stays in the HTML (for search engines and agents);
// CSS hides the ones outside the chosen category.
export function CategoryFilter({
  counts,
  total,
  children,
}: {
  counts: Record<Category, number>;
  total: number;
  children: React.ReactNode;
}) {
  const active = useSyncExternalStore(subscribe, readFilter, () => "all" as Filter);
  const chips: { id: Filter; pt: string; en: string; n: number }[] = [
    { id: "all", pt: "Todos", en: "All", n: total },
    ...(Object.keys(CATEGORIES) as Category[]).map((id) => ({ id, ...CATEGORIES[id], n: counts[id] })),
  ];

  return (
    <div data-filter={active}>
      <nav aria-label="Categorias / Categories" className="chip-row">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={active === c.id}
            onClick={() => setFilter(c.id)}
            className={`chip ${active === c.id ? "chip-active" : ""}`}
          >
            {/* Phones: "Casa 9" over "Home". Wider screens: "Casa · Home 9" on one line. */}
            <span lang="pt" className="block font-medium sm:inline">
              {c.pt}
              <span className="ml-1 text-[11px] font-normal opacity-60 tabular-nums sm:hidden">{c.n}</span>
            </span>
            {c.pt !== c.en && (
              <span lang="en" className="block text-[11px] opacity-65 sm:inline sm:text-sm">
                <span className="hidden sm:inline"> · </span>
                {c.en}
              </span>
            )}
            <span className="ml-1.5 hidden text-xs opacity-60 tabular-nums sm:inline">{c.n}</span>
          </button>
        ))}
      </nav>

      {active !== "all" && counts[active] === 0 && (
        <p className="mb-6 text-sm text-muted">
          <span lang="pt" className="block">Ainda não há nada nesta categoria.</span>
          <span lang="en" className="block">Nothing in this category yet.</span>
        </p>
      )}

      {children}
    </div>
  );
}
