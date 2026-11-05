import type { Item } from "@/lib/db";

const euros = (cents: number) => `${Math.round(cents / 100).toLocaleString("pt-PT")} €`;

// Sales summary, like the spreadsheet: money in, money still on the table, items left.
export function Tracker({ items }: { items: Item[] }) {
  const price = (i: Item) => i.price_cents ?? 0;
  const sum = (list: Item[]) => list.reduce((t, i) => t + price(i), 0);
  const sold = items.filter((i) => i.status === "sold");
  const left = items.filter((i) => i.status !== "sold");
  const reserved = items.filter((i) => i.status === "reserved");
  const potential = sum(items);
  const soldValue = sum(sold);
  const pct = potential ? Math.round((soldValue / potential) * 100) : 0;
  const unpriced = left.filter((i) => i.price_cents === null).length;

  return (
    <section className="card mb-8 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted">Sold so far</p>
          <p className="text-3xl font-semibold tabular-nums">
            {euros(soldValue)} <span className="text-base font-normal text-muted">of {euros(potential)}</span>
          </p>
        </div>
        <p className="text-sm text-muted tabular-nums">{pct}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Stat label="Items sold" value={`${sold.length} / ${items.length}`} />
        <Stat label="Left to sell" value={String(left.length)} />
        <Stat label="Value left" value={euros(sum(left))} />
        <Stat label="Reserved" value={`${reserved.length} · ${euros(sum(reserved))}`} />
      </dl>
      {unpriced > 0 && (
        <p className="mt-3 text-xs text-muted">
          {unpriced} item{unpriced > 1 ? "s have" : " has"} no price yet and {unpriced > 1 ? "aren't" : "isn't"} counted in the totals.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
