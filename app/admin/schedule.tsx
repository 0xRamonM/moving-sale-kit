"use client";

import { useState, useTransition } from "react";
import { CHANNELS, HANDLERS } from "@/lib/site";
import { deletePickup, reserveItem, savePickup, setPickupDone, setPickupHandler } from "./actions";

export type Pickup = {
  id: number;
  day: string; // YYYY-MM-DD
  time: string;
  name: string;
  item: string;
  channel: string;
  handler: string;
  done: boolean;
};



// Local calendar dates as YYYY-MM-DD, so local evenings don't slip into the next UTC day.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const weekdayShort = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

// Compact week agenda of who's picking up what: one line per pickup, edited in place.
export function Schedule({ pickups, items }: { pickups: Pickup[]; items: string[] }) {
  const [week, setWeek] = useState(() => monday(new Date()));
  const today = ymd(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const thisWeek = ymd(week) === ymd(monday(new Date()));

  return (
    <section className="card mb-8 text-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h2 className="font-semibold">
          Pickups <span className="font-normal text-muted">· {dayMonth.format(days[0])} – {dayMonth.format(days[6])}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-sm" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">←</button>
          {!thisWeek && <button type="button" className="btn btn-sm" onClick={() => setWeek(monday(new Date()))}>Today</button>}
          <button type="button" className="btn btn-sm" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">→</button>
        </div>
      </header>

      <datalist id="pickup-items">{items.map((i) => <option key={i} value={i} />)}</datalist>
      <datalist id="pickup-channels">{CHANNELS.map((c) => <option key={c} value={c} />)}</datalist>

      <ol className="divide-y divide-border">
        {days.map((d) => {
          const key = ymd(d);
          return <Day key={key} date={d} day={key} isToday={key === today} past={key < today} list={pickups.filter((p) => p.day === key)} />;
        })}
      </ol>
    </section>
  );
}

function Day({ date, day, isToday, past, list }: { date: Date; day: string; isToday: boolean; past: boolean; list: Pickup[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <li className={`flex gap-3 px-4 py-1.5 ${isToday ? "bg-accent-soft/50" : ""} ${past ? "text-muted" : ""}`}>
      <div className="w-12 shrink-0 py-1 sm:w-16">
        <span className={isToday ? "font-semibold text-accent-ink" : "font-medium"}>{weekdayShort.format(date)}</span>{" "}
        <span className="text-muted">{date.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        {list.map((p) => <PickupRow key={p.id} pickup={p} />)}
        {adding ? (
          <PickupForm day={day} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" className="rounded px-1 py-1 text-accent hover:underline" onClick={() => setAdding(true)}>
            + Add
          </button>
        )}
      </div>
    </li>
  );
}

function PickupRow({ pickup: p }: { pickup: Pickup }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) return <PickupForm pickup={p} day={p.day} onDone={() => setEditing(false)} />;

  return (
    <div className={`group flex items-center gap-2 py-1 ${p.done ? "opacity-50" : ""} ${pending ? "animate-pulse" : ""}`}>
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-[var(--accent)]"
        checked={p.done}
        aria-label="Picked up"
        onChange={(e) => start(() => setPickupDone(p.id, e.target.checked))}
      />
      <button type="button" className="min-w-0 flex-1 text-left leading-snug sm:truncate" onClick={() => setEditing(true)} title="Edit">
        {p.time && <span className="mr-1 text-muted tabular-nums">{p.time}</span>}
        <span className={`font-medium text-foreground ${p.done ? "line-through" : ""}`}>{p.item || "No item"}</span>
        <span className="text-muted">
          {" · "}
          {p.name || "no name"}
          {p.channel && ` · ${p.channel}`}
        </span>
      </button>
      <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-xs" role="group" aria-label="Talking to them">
        {HANDLERS.map((h) => (
          <button
            key={h}
            type="button"
            className={`px-1.5 py-0.5 font-medium sm:px-2 ${p.handler === h ? "bg-foreground text-background" : "text-muted hover:bg-surface-2"}`}
            onClick={() => start(() => setPickupHandler(p.id, p.handler === h ? "" : h))}
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}

// With `reserve`, saving also marks that item reserved; name, day and who's handling it are then required.
export function PickupForm({
  pickup,
  day = ymd(new Date()),
  reserve,
  onDone,
}: {
  pickup?: Pickup;
  day?: string;
  reserve?: { id: number; item: string };
  onDone: () => void;
}) {
  const [handler, setHandler] = useState(pickup?.handler ?? "");
  const [missing, setMissing] = useState(false);
  const [pending, start] = useTransition();
  const field = "min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-base outline-none focus:border-accent sm:text-sm";
  return (
    <form
      className="my-1 flex flex-wrap items-center gap-1.5"
      // Checked on submit, not in the action: a form action resets the fields even when it bails out.
      onSubmit={(e) => {
        if (reserve && !handler) {
          e.preventDefault();
          setMissing(true);
        }
      }}
      action={(form) => start(async () => {
        await (reserve ? reserveItem(reserve.id, form) : savePickup(form));
        onDone();
      })}
    >
      <input type="hidden" name="id" value={pickup?.id ?? ""} />
      <input type="hidden" name="handler" value={handler} />
      <input name="item" list="pickup-items" defaultValue={pickup?.item ?? reserve?.item} placeholder="Item" className={`${field} w-40 flex-1 sm:flex-none`} autoFocus={!reserve} />
      <input name="name" defaultValue={pickup?.name} placeholder="Name" required={!!reserve} className={`${field} w-28`} autoFocus={!!reserve} />
      <input name="channel" list="pickup-channels" defaultValue={pickup?.channel} placeholder="Channel" className={`${field} w-32`} />
      <input name="time" defaultValue={pickup?.time} placeholder="Time" className={`${field} w-16`} />
      <input name="day" type="date" defaultValue={day} required className={`${field} w-36`} />
      <div className={`flex overflow-hidden rounded-md border text-xs ${missing && !handler ? "border-red-600 ring-2 ring-red-600/30" : "border-border"}`}>
        {HANDLERS.map((h) => (
          <button
            key={h}
            type="button"
            className={`px-2 py-1.5 font-medium ${handler === h ? "bg-foreground text-background" : "text-muted hover:bg-surface-2"}`}
            onClick={() => setHandler(handler === h ? "" : h)}
          >
            {h}
          </button>
        ))}
      </div>
      <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "…" : reserve ? "Reserve" : "Save"}</button>
      <button type="button" className="btn btn-sm" onClick={onDone}>Cancel</button>
      {missing && !handler && <span className="text-xs text-red-700">Pick who&apos;s handling it</span>}
      {pickup && (
        <button
          type="button"
          className="px-1 text-xs text-red-700 hover:underline"
          onClick={() => confirm("Delete this pickup?") && start(async () => {
            await deletePickup(pickup.id);
            onDone();
          })}
        >
          Delete
        </button>
      )}
    </form>
  );
}
