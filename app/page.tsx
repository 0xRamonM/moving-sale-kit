import { formatDay, formatPrice, type Item } from "@/lib/db";
import { getPublicItems, MAP_URL, SITE_URL } from "@/lib/items";
import { CATEGORIES, type Category } from "@/lib/categories";
import { AREA, CITY, PICKUP_PLACE, SITE_TITLE } from "@/lib/site";
import { Bi, BiInline } from "./bi";
import { CategoryFilter } from "./categories";
import { ChatButton, type ChatItem } from "./chat";
import { Gallery } from "./gallery";
import { PageTracker } from "./page-tracker";
import { Selection, SelectToggle } from "./selection";

const AVAILABILITY = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/LimitedAvailability",
  sold: "https://schema.org/SoldOut",
} as const;

// schema.org product data, so search engines and AI agents can read items, prices and stock directly.
// Items not ready yet, grouped by the date they become available, soonest first.
function laterGroups(items: Item[]) {
  const groups = new Map<string, Item[]>();
  for (const i of items) {
    if (!i.available_from || i.status === "sold") continue;
    groups.set(i.available_from, [...(groups.get(i.available_from) ?? []), i]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// What the chat needs to greet visitors about an item.
function chatItem(item: Item): ChatItem {
  const price = formatPrice(item.price_cents);
  return {
    id: item.id,
    titlePt: item.title_pt,
    titleEn: item.title_en,
    price: typeof price === "string" ? { pt: price, en: price } : { pt: price.pt.toLowerCase(), en: price.en.toLowerCase() },
    availableFrom: item.available_from ? { pt: formatDay(item.available_from, "pt"), en: formatDay(item.available_from, "en") } : null,
  };
}

function categoryCounts(items: Item[]) {
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, 0])) as Record<Category, number>;
  for (const i of items) if (i.status !== "sold") counts[i.category]++;
  return counts;
}

function structuredData(items: Item[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE_TITLE.pt} · ${SITE_TITLE.en}`,
    description: `Second-hand items for sale, pickup only in ${AREA.en}, ${CITY.en}.`,
    url: SITE_URL,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        productID: String(item.id),
        name: `${item.title_en} / ${item.title_pt}`,
        description: [item.description_en, item.description_pt].filter(Boolean).join(" / ") || undefined,
        image: item.images.length ? item.images : undefined,
        url: `${SITE_URL}/#item-${item.id}`,
        category: CATEGORIES[item.category].en,
        itemCondition: "https://schema.org/UsedCondition",
        offers: {
          "@type": "Offer",
          price: item.price_cents === null ? undefined : (item.price_cents / 100).toFixed(2),
          priceCurrency: "EUR",
          availability:
            item.status === "available" && item.available_from ? "https://schema.org/PreOrder" : AVAILABILITY[item.status],
          availabilityStarts: item.available_from ?? undefined,
          areaServed: CITY.en,
          availableDeliveryMethod: "https://schema.org/OnSitePickup",
        },
      },
    })),
  };
}

export default async function Home() {
  const items = await getPublicItems();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <PageTracker />
      <script
        type="application/ld+json"
        // Escape "<" so item text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(items)).replace(/</g, "\\u003c") }}
      />
      <header className="py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <Bi pt={SITE_TITLE.pt} en={SITE_TITLE.en} />
        </h1>
        <a
          href={MAP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-2.5 text-accent-ink hover:brightness-95"
        >
          <PinIcon />
          <span className="text-sm leading-snug">
            <span className="block font-semibold">
              <BiInline pt={`Recolha em ${AREA.pt}`} en={`Pick up in ${AREA.en}`} />
            </span>
            <span className="block">{PICKUP_PLACE} ↗</span>
          </span>
        </a>
        <p className="mt-4 max-w-xl text-sm">
          <Bi
            pt="Gostas de alguma coisa? Carrega em “Tenho interesse” para tirar dúvidas e reservar. Eu entro em contacto contigo."
            en="Like something? Tap “I'm interested” to ask questions and reserve it. I'll get in touch with you."
          />
        </p>
      </header>

      {items.length === 0 ? (
        <p>
          <Bi pt="Ainda não há artigos. Volta em breve." en="Nothing listed yet. Check back soon." />
        </p>
      ) : (
        <CategoryFilter counts={categoryCounts(items)} total={items.filter((i) => i.status !== "sold").length}>
          <Selection
            items={items.filter((i) => i.status !== "sold").map(chatItem)}
          >
            <ul className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
              {items
                .filter((i) => !i.available_from)
                .map((item, i) => (
                  <ItemCard key={item.id} item={item} priority={i < 4} />
                ))}
            </ul>

            {laterGroups(items).map(([date, group]) => (
              <section key={date} className="later-section mt-14">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  <Bi pt={`Disponível a partir de ${formatDay(date, "pt")}`} en={`Available from ${formatDay(date, "en")}`} />
                </h2>
                <p className="mt-2 mb-5 max-w-xl text-sm">
                  <Bi
                    pt="Ainda estamos a usar estas coisas. Fala connosco para reservar e entregamos-tas nesse dia."
                    en="We're still using these. Reach out to reserve one and we'll hand it over then."
                  />
                </p>
                <ul className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
                  {group.map((item) => (
                    <ItemCard key={item.id} item={item} priority={false} />
                  ))}
                </ul>
              </section>
            ))}
          </Selection>
        </CategoryFilter>
      )}
    </main>
  );
}

function ItemCard({ item, priority }: { item: Item; priority: boolean }) {
  const sold = item.status === "sold";
  const price = formatPrice(item.price_cents);
  return (
    <li id={`item-${item.id}`} data-category={item.category} className={`card flex scroll-mt-20 flex-col has-[[data-selected=true]]:border-accent has-[[data-selected=true]]:ring-2 has-[[data-selected=true]]:ring-accent ${sold ? "opacity-60" : ""}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2 sm:aspect-[4/3]">
        {item.images.length > 0 ? (
          <Gallery images={item.images} alt={`${item.title_pt} / ${item.title_en}`} priority={priority} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <CameraIcon />
            <Bi pt="Fotos em breve" en="Photos soon" />
          </div>
        )}
        {item.status === "available" && item.available_from && (
          <span className="pill absolute top-2 left-2 bg-sky-100 text-sky-950 sm:top-3 sm:left-3">
            <BiInline pt={`A partir de ${formatDay(item.available_from, "pt", "short")}`} en={`From ${formatDay(item.available_from, "en", "short")}`} />
          </span>
        )}
        {item.status !== "available" && (
          <span className={`pill absolute top-2 left-2 sm:top-3 sm:left-3 ${sold ? "bg-neutral-900 text-white" : "bg-amber-300 text-amber-950"}`}>
            {sold ? <BiInline pt="Vendido" en="Sold" /> : <BiInline pt="Reservado" en="Reserved" />}
          </span>
        )}
        {!sold && <SelectToggle id={item.id} titlePt={item.title_pt} titleEn={item.title_en} />}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:gap-2 sm:p-4">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <h2 className="text-sm leading-snug font-medium sm:text-base">
            <Bi pt={item.title_pt} en={item.title_en} />
          </h2>
          <span className="shrink-0 text-sm font-semibold tabular-nums sm:text-right sm:text-base">
            {typeof price === "string" ? price : <Bi pt={price.pt} en={price.en} className="text-sm" />}
          </span>
        </div>
        {(item.description_pt || item.description_en) && (
          <p className="line-clamp-3 text-xs whitespace-pre-line sm:line-clamp-none sm:text-sm">
            <span lang="pt" className="block">{item.description_pt}</span>
            <span lang="en" className="mt-1 block text-muted">{item.description_en}</span>
          </p>
        )}
        <div className="card-cta mt-auto pt-1.5 sm:pt-2">
          {sold ? (
            <button className="btn btn-card w-full" disabled>
              <BiInline pt="Vendido" en="Sold" />
            </button>
          ) : (
            <ChatButton item={chatItem(item)} />
          )}
        </div>
      </div>
    </li>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="opacity-60">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
