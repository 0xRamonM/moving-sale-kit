"use client";

import { capture } from "@/lib/track";
import { createContext, useCallback, useContext, useState } from "react";
import { Bi, BiInline } from "./bi";
import { ChatDialog, type ChatItem } from "./chat";

// "Pick several" mode: visitors tick items, then open one chat about all of them.

type SelectionState = { picking: boolean; selected: number[]; toggle: (id: number) => void };
const SelectionContext = createContext<SelectionState>({ picking: false, selected: [], toggle: () => {} });

export function Selection({ items, children }: { items: ChatItem[]; children: React.ReactNode }) {
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const stop = () => {
    setPicking(false);
    setSelected([]);
  };
  const picked = items.filter((i) => selected.includes(i.id));
  const n = picked.length;

  return (
    <SelectionContext.Provider value={{ picking, selected, toggle }}>
      {picking ? (
        <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <p className="min-w-0 flex-1 text-sm font-medium">
            {n === 0 ? (
              <Bi pt="Toca nos artigos que queres" en="Tap the items you want" />
            ) : (
              <Bi pt={`${n} ${n === 1 ? "selecionado" : "selecionados"}`} en={`${n} selected`} />
            )}
          </p>
          <button type="button" className="btn" onClick={stop}>
            <Bi pt="Cancelar" en="Cancel" className="text-left leading-tight sm:hidden" />
            <span className="hidden sm:inline"><BiInline pt="Cancelar" en="Cancel" /></span>
          </button>
          <button type="button" className="btn btn-primary" disabled={n === 0} onClick={() => {
            setChatOpen(true);
            capture("chat_opened", { itemIds: selected });
          }}>
            <span className="flex flex-col text-left leading-tight sm:hidden">
              <span lang="pt">Tenho interesse</span>
              <span lang="en" className="text-xs font-normal opacity-70">I&apos;m interested</span>
            </span>
            <span className="hidden sm:inline"><BiInline pt="Tenho interesse" en="I'm interested" /></span>
          </button>
        </div>
      ) : (
        <button type="button" className="btn mb-4 w-full gap-2 sm:w-auto" onClick={() => {
            setPicking(true);
            capture("pick_several_started");
          }}>
          <ChecklistIcon />
          <BiInline pt="Escolher vários artigos" en="Pick several items" />
        </button>
      )}

      {/* While picking, cards hide their own button so the top bar is the one action. */}
      <div data-picking={picking || undefined}>{children}</div>

      {/* Keyed by the selection, so changing what's picked starts a fresh conversation. */}
      {n > 0 && <ChatDialog key={selected.join(",")} items={picked} open={chatOpen} onClose={closeChat} />}
    </SelectionContext.Provider>
  );
}

// Tick circle over a card's photo, shown only while picking.
export function SelectToggle({ id, titlePt, titleEn }: { id: number; titlePt: string; titleEn: string }) {
  const { picking, selected, toggle } = useContext(SelectionContext);
  if (!picking) return null;
  const on = selected.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${titlePt} / ${titleEn}`}
      data-selected={on}
      onClick={() => toggle(id)}
      className={`absolute inset-0 z-10 flex items-start justify-end p-3 transition ${on ? "bg-accent/15" : "bg-black/5 hover:bg-black/10"}`}
    >
      <span
        className={`flex size-8 items-center justify-center rounded-full border-2 shadow-sm ${
          on ? "border-accent bg-accent text-white" : "border-white bg-white/80 text-transparent"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12l5 5 9-10" />
        </svg>
      </span>
    </button>
  );
}

function ChecklistIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M3 6l2 2 3-3M3 13l2 2 3-3M11 6h10M11 13h10M11 20h10" />
    </svg>
  );
}
