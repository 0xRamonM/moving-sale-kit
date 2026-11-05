// Shown as filter chips on the public page, in this order. Safe to import from client components.
export const CATEGORIES = {
  clothing: { pt: "Roupa", en: "Clothing" },
  sports: { pt: "Desporto", en: "Sports" },
  travel: { pt: "Viagem", en: "Travel" },
  electronics: { pt: "Eletrónica", en: "Electronics" },
  house: { pt: "Casa", en: "Home" },
} as const;
export type Category = keyof typeof CATEGORIES;
