import type { Metadata } from "next";
import { Suspense } from "react";
import { isAdmin } from "@/lib/auth";
import { sql, toItems } from "@/lib/db";
import { SITE_URL, TIME_ZONE } from "@/lib/site";
import { Tracker } from "../sales";
import { LoginForm } from "../login-form";
import { AdminNav } from "../nav";
import { RefLinks, type RefRow } from "./ref-links";
import { Transcript, type ChatMessage } from "../transcript";

export const metadata: Metadata = { title: "Tracking", robots: { index: false } };

// The sale has only been live a few days, so a week is the only range worth showing.
const DAYS = 7;

export default function TrackingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  if (!(await isAdmin())) return <LoginForm />;
  return <Tracking days={DAYS} />;
}

const n = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

async function Tracking({ days }: { days: number }) {
  const [[totals], daily, byRef, refRows, topItems, chats] = (await Promise.all([
    sql`
      select
        count(distinct visitor) filter (where type = 'pageview') visitors,
        count(distinct session) filter (where type = 'pageview') visits,
        count(*) filter (where type = 'pageview') pageviews,
        count(distinct session) filter (where type = 'chat_opened') chats,
        count(distinct session) filter (where type = 'chat_message_sent') talked,
        count(distinct session) filter (where type in ('lead_registered', 'whatsapp_clicked')) leads
      from events where at > now() - make_interval(days => ${days})`,
    sql`
      select to_char(d, 'YYYY-MM-DD') as day, count(distinct e.visitor) as visitors
      from generate_series(
        (now() at time zone ${TIME_ZONE})::date - (${days} - 1), (now() at time zone ${TIME_ZONE})::date, interval '1 day'
      ) d
      left join events e on e.type = 'pageview' and (e.at at time zone ${TIME_ZONE})::date = d::date
      group by d order by d`,
    sql`
      select coalesce(e.ref, '') ref, r.label,
        count(distinct e.visitor) filter (where e.type = 'pageview') visitors,
        count(distinct e.session) filter (where e.type = 'chat_opened') chats,
        count(distinct e.session) filter (where e.type in ('lead_registered', 'whatsapp_clicked')) leads
      from events e left join refs r on r.slug = e.ref
      where e.at > now() - make_interval(days => ${days})
      group by 1, 2 order by visitors desc`,
    sql`
      select r.slug, r.label,
        count(distinct e.visitor) filter (where e.type = 'pageview') visitors,
        count(distinct e.session) filter (where e.type in ('lead_registered', 'whatsapp_clicked')) leads
      from refs r left join events e on e.ref = r.slug
      group by r.slug, r.label, r.created_at order by r.created_at`,
    sql`
      select i.id, i.title_en,
        count(distinct e.session) filter (where e.type = 'chat_opened') chats,
        count(distinct e.session) filter (where e.type in ('lead_registered', 'whatsapp_clicked')) leads
      from events e cross join unnest(e.item_ids) as x(item_id) join items i on i.id = x.item_id
      where e.at > now() - make_interval(days => ${days}) and e.type in ('chat_opened', 'lead_registered', 'whatsapp_clicked')
      group by i.id, i.title_en order by chats desc, leads desc limit 10`,
    sql`
      select c.id, to_char(c.started_at at time zone ${TIME_ZONE}, 'DD Mon HH24:MI') as started, c.ref, c.lead, c.messages,
        (select string_agg(i.title_en, ', ') from items i where i.id = any(c.item_ids)) as items
      from chats c
      where c.started_at > now() - make_interval(days => ${days})
      order by c.started_at desc limit 50`,
  ])) as Record<string, unknown>[][];

  const items = toItems((await sql`select * from items`) as Record<string, unknown>[]);
  const visitors = n(totals.visitors);
  const peak = Math.max(1, ...daily.map((d) => n(d.visitors)));

  return (
    <>
      <AdminNav active="tracking" />
      <p className="-mt-4 mb-6 text-sm text-muted">
        This device isn’t counted in any analytics. To leave out another phone without logging in, open{" "}
        <span className="font-medium text-foreground">{SITE_URL.replace(/^https?:\/\//, "")}/?internal=1</span> on it once.
      </p>

      <Tracker items={items} />

      <h2 className="mb-4 text-lg font-semibold">Last {days} days</h2>

      <section className="card mb-8 p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Visitors" value={visitors} />
          <Stat label="Visits" value={n(totals.visits)} />
          <Stat label="Page views" value={n(totals.pageviews)} />
          <Stat label="Opened a chat" value={n(totals.chats)} sub={pct(n(totals.chats), n(totals.visits)) + " of visits"} />
          <Stat label="Leads registered" value={n(totals.leads)} sub={pct(n(totals.leads), n(totals.visits)) + " of visits"} />
        </dl>

        <div className="mt-6">
          <p className="mb-2 text-sm text-muted">Visitors per day</p>
          <div className="flex h-32 items-end gap-px">
            {daily.map((d) => (
              <div key={String(d.day)} className="group relative flex h-full flex-1 items-end" title={`${d.day}: ${n(d.visitors)} visitors`}>
                <div className="w-full rounded-t-sm bg-accent/80 group-hover:bg-accent" style={{ height: `${(n(d.visitors) / peak) * 100}%`, minHeight: n(d.visitors) ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{String(daily[0]?.day ?? "")}</span>
            <span>peak {peak} / day</span>
            <span>today</span>
          </div>
        </div>
      </section>

      <section className="card mb-8 p-5">
        <h2 className="mb-3 font-semibold">Chat funnel</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {[
            ["Opened a chat", n(totals.chats), n(totals.visits), "of visits"],
            ["Wrote a message", n(totals.talked), n(totals.chats), "of chats opened"],
            ["Left name + number", n(totals.leads), n(totals.talked), "of those who wrote"],
          ].map(([label, value, base, of]) => (
            <div key={String(label)} className="rounded-xl bg-surface-2 p-3">
              <div className="text-muted">{label}</div>
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
              <div className="text-xs text-muted">{pct(Number(value), Number(base))} {of}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold">Where visitors come from</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="p-3 font-medium">Source</th>
                  <th className="p-3 text-right font-medium">Visitors</th>
                  <th className="p-3 text-right font-medium">Chats</th>
                  <th className="p-3 text-right font-medium">Leads</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {byRef.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-3 text-muted">No visits yet.</td>
                  </tr>
                )}
                {byRef.map((r) => (
                  <tr key={String(r.ref)} className="border-b border-border last:border-0">
                    <td className="p-3">{r.ref ? String(r.label ?? r.ref) : <span className="text-muted">Direct / other</span>}</td>
                    <td className="p-3 text-right">{n(r.visitors)}</td>
                    <td className="p-3 text-right">{n(r.chats)}</td>
                    <td className="p-3 text-right">{n(r.leads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 mb-3 font-semibold">Most wanted items</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="p-3 font-medium">Item</th>
                  <th className="p-3 text-right font-medium">Chats</th>
                  <th className="p-3 text-right font-medium">Leads</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {topItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-3 text-muted">No chats yet.</td>
                  </tr>
                )}
                {topItems.map((i) => (
                  <tr key={String(i.id)} className="border-b border-border last:border-0">
                    <td className="p-3">{String(i.title_en)}</td>
                    <td className="p-3 text-right">{n(i.chats)}</td>
                    <td className="p-3 text-right">{n(i.leads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-1 font-semibold">Ref links</h2>
          <p className="mb-4 text-sm text-muted">
            Share a different link per place you post (Marketplace, Instagram, a WhatsApp group…) to see which one works. Counts are all time.
          </p>
          <div className="card p-4">
            <RefLinks
              refs={refRows.map((r) => ({ slug: String(r.slug), label: String(r.label), visitors: n(r.visitors), leads: n(r.leads) })) as RefRow[]}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Your own visits while logged in to the admin aren&apos;t counted. For recordings and deeper analysis, use PostHog.
          </p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Chats ({chats.length})</h2>
        {chats.length === 0 ? (
          <p className="text-sm text-muted">No conversations yet. Chats where nobody writes aren&apos;t saved.</p>
        ) : (
          <ul className="space-y-2">
            {chats.map((c) => {
              const messages = c.messages as ChatMessage[];
              return (
                <li key={String(c.id)} className="card p-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium">{String(c.items ?? "—")}</span>
                      <span className="text-muted">
                        {String(c.started)} · {messages.length} messages{c.ref ? ` · via ${String(c.ref)}` : ""}
                      </span>
                      {c.lead ? (
                        <span className="pill bg-accent-soft text-accent-ink">lead</span>
                      ) : (
                        <span className="pill bg-surface-2 text-muted">no lead</span>
                      )}
                    </summary>
                    <div className="mt-2">
                      <Transcript messages={messages} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}
