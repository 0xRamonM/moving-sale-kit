// Facebook Marketplace listing text for an item: Portuguese first, then English.
// Pure function, so the admin can build it in the browser.

import { AREA, CITY, SITE_URL } from "./site";

const PT_MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type ListingInput = {
  id: number;
  title_pt: string;
  title_en: string;
  description_pt: string;
  description_en: string;
  price_cents: number | null;
  available_from: string | null;
};

function euros(cents: number) {
  const e = cents / 100;
  return `${Number.isInteger(e) ? e : e.toFixed(2).replace(".", ",")} €`;
}

function day(iso: string, months: string[], pt: boolean) {
  const [, m, d] = iso.split("-").map(Number);
  return pt ? `${d} de ${months[m - 1]}` : `${d} ${months[m - 1]}`;
}

// Home page, tagged so PostHog shows visits from Facebook.
const LISTING_URL = `${SITE_URL}/?ref=fb`;

export function marketplaceListing(item: ListingInput) {
  const title = item.title_pt === item.title_en ? item.title_pt : `${item.title_pt} / ${item.title_en}`;
  const url = LISTING_URL;
  const price = item.price_cents;

  const pt = [
    item.description_pt,
    item.available_from && `Disponível a partir de ${day(item.available_from, PT_MONTHS, true)}. Podes reservar já.`,
    `Recolha só em ${AREA.pt} (${CITY.pt}). Sem entregas nem envios.`,
    price !== null ? `Preço fixo: ${euros(price)}.` : "Aceito propostas.",
    `Vê tudo o que estou a vender (podes levar várias coisas de uma vez): ${url}`,
  ];
  const en = [
    item.description_en,
    item.available_from && `Available from ${day(item.available_from, EN_MONTHS, false)}. You can reserve it now.`,
    `Pickup in ${AREA.en} (${CITY.en}) only. No delivery or shipping.`,
    price !== null ? `Price is final: ${euros(price)}.` : "Open to offers.",
    `See everything else I'm selling (grab several things at once): ${url}`,
  ];

  const description = [pt.filter(Boolean).join("\n\n"), "— English —", en.filter(Boolean).join("\n\n")].join("\n\n");
  return { title, description, price: price === null ? null : price / 100 };
}
