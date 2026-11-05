import type { Metadata } from "next";
import { Suspense } from "react";
import { isAdmin } from "@/lib/auth";
import { sql, formatPrice, toItems, type Interest, type Item } from "@/lib/db";
import { InterestRow } from "./interest-row";
import { ItemForm } from "./item-form";
import { ItemList } from "./item-list";
import { BotSettings } from "./bot-settings";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";
import { AdminNav } from "./nav";
import { Schedule, type Pickup } from "./schedule";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
        <Gate />
      </Suspense>
    </main>
  );
}

function adminPrice(cents: number | null) {
  const p = formatPrice(cents);
  return typeof p === "string" ? p : p.en;
}

async function Gate() {
  if (!(await isAdmin())) return <LoginForm />;
  return <Dashboard />;
}

async function Dashboard() {
  const settings = await getSettings();
  const [itemRows, interests, pickupRows] = (await Promise.all([
    sql`select * from items order by position, id`,
    sql`
      select i.*, it.title_en as item_title, it.title_pt as item_title_pt, it.price_cents as item_price_cents, c.messages as chat_messages
      from interests i
      join items it on it.id = i.item_id
      left join chats c on c.id = i.chat_id
      order by i.handled, i.created_at desc
      limit 300`,
    sql`select id, day::text as day, time, name, item, channel, handler, done from pickups order by day, time, id`,
  ])) as [Record<string, unknown>[], Interest[], Pickup[]];
  const items: Item[] = toItems(itemRows);

  const interestCount = new Map<number, number>();
  for (const i of interests) interestCount.set(i.item_id, (interestCount.get(i.item_id) ?? 0) + 1);
  const newInterests = interests.filter((i) => !i.handled).length;

  return (
    <>
      <AdminNav active="items" />

      <Schedule pickups={pickupRows} items={items.filter((i) => i.status !== "sold").map((i) => i.title_en)} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-6">
          <ItemList
            rows={items.map((item) => ({ item, price: adminPrice(item.price_cents), interestCount: interestCount.get(item.id) ?? 0 }))}
          >
            <details className="card p-4">
              <summary className="cursor-pointer font-medium">
                Chat bot instructions
              </summary>
              <BotSettings instructions={settings.instructions} />
            </details>

            <details className="card p-4" open={items.length === 0}>
              <summary className="cursor-pointer font-medium">+ Add an item</summary>
              <div className="mt-4">
                <ItemForm />
              </div>
            </details>

          </ItemList>
        </section>

        <aside className="order-first space-y-3 lg:order-none">
          <h2 className="font-semibold">
            Leads to contact {newInterests > 0 && <span className="pill ml-1 bg-blue-100 text-blue-900">{newInterests} new</span>}
          </h2>
          {interests.length === 0 ? (
            <p className="text-sm text-muted">No leads yet. They appear here when the chat registers someone, with how to contact them.</p>
          ) : (
            // Only new leads are open; handled ones fold away so the items aren't buried on phones.
            <div className="space-y-2 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
              {newInterests === 0 && <p className="text-sm text-muted">No new leads.</p>}
              <ul className="space-y-2">
                {interests.filter((i) => !i.handled).map((i) => (
                  <InterestRow key={i.id} interest={i} />
                ))}
              </ul>
              {interests.length > newInterests && (
                <details className="card p-3">
                  <summary className="cursor-pointer text-sm font-medium text-muted">Handled ({interests.length - newInterests})</summary>
                  <ul className="mt-2 space-y-2">
                    {interests.filter((i) => i.handled).map((i) => (
                      <InterestRow key={i.id} interest={i} />
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

