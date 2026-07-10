/**
 * ─────────────────────────────────────────────────────────────────────────
 * PRODUCT LOOKUP — ARCHITECTURE NOTE
 * ─────────────────────────────────────────────────────────────────────────
 * lookupProductByBarcode() is the single entry point the UI calls. Today it:
 *   1. Queries Open Beauty Facts (world.openbeautyfacts.org) — a real, free,
 *      unauthenticated public API of cosmetic products (crowdsourced INCI
 *      ingredient lists, brands, images). No API key needed, safe to call
 *      directly from the browser.
 *   2. Falls back to a small local DEMO_CATALOG (clearly flagged
 *      `source: "local"`) so the flow is testable without a physical
 *      product in hand, and so scanning still works offline.
 *
 * Phase 2: swap step 1 for your own `Product` table (see
 * prisma/schema.prisma) seeded from Open Beauty Facts bulk exports plus
 * manual curation, so lookups are fast and don't depend on a third party.
 * The function signature stays the same either way.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { Locale } from "./locale";

export interface Product {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
  ingredientsText: string;
  ingredients: string[];
  source: "openbeautyfacts" | "local";
}

const OBF_ENDPOINT = (barcode: string) =>
  `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,image_front_url,image_url,ingredients_text_fr,ingredients_text,ingredients,categories,status`;

export async function lookupProductByBarcode(barcode: string): Promise<Product | null> {
  const clean = barcode.trim();
  if (!clean) return null;

  const remote = await tryOpenBeautyFacts(clean);
  if (remote) return remote;

  const demo = DEMO_CATALOG.find((p) => p.barcode === clean);
  return demo ? localizeCatalogEntry(demo, "fr") : null;
}

async function tryOpenBeautyFacts(barcode: string): Promise<Product | null> {
  try {
    const res = await fetch(OBF_ENDPOINT(barcode), {
      headers: { Accept: "application/json" },
      // Open Beauty Facts explicitly documents this JSON endpoint for
      // client apps (1 call = 1 real scan), so no proxy/key is required.
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 1 || !data?.product) return null;

    const p = data.product;
    const ingredientsText: string = p.ingredients_text_fr || p.ingredients_text || "";
    if (!p.product_name && !ingredientsText) return null;

    return {
      barcode,
      name: p.product_name || "Produit sans nom",
      brand: p.brands,
      imageUrl: p.image_front_url || p.image_url,
      category: firstCategory(p.categories),
      ingredientsText,
      ingredients: parseIngredients(ingredientsText),
      source: "openbeautyfacts",
    };
  } catch {
    // Network unavailable, CORS blocked in an unusual embed context, or
    // the API is down — the caller falls back to the local catalog.
    return null;
  }
}

function firstCategory(categories?: string): string | undefined {
  return categories?.split(",")[0]?.trim();
}

export function parseIngredients(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[,•]/)
    .map((s) => s.replace(/[*().0-9%]/g, "").trim().toLowerCase())
    .filter((s) => s.length > 1);
}

// Reserved-range demo barcodes (the 200–299 EAN-13 prefix is set aside for
// internal/in-store use) so testing never collides with a real product.
type CatalogEntry = Omit<Product, "name" | "category"> & {
  name: Record<Locale, string>;
  category: Record<Locale, string>;
};

const DEMO_CATALOG: CatalogEntry[] = [
  {
    barcode: "2000000000017",
    name: {
      en: "Intense hydration gentle shampoo",
      fr: "Shampoing doux hydratation intense",
    },
    brand: "Botaniqa Lab",
    category: { en: "Shampoo", fr: "Shampoing" },
    ingredientsText:
      "Aqua, Sodium Cocoyl Isethionate, Glycerin, Aloe Barbadensis Leaf Juice, Panthenol, Hydrolyzed Keratin, Parfum, Citric Acid",
    ingredients: [],
    source: "local",
  },
  {
    barcode: "2000000000024",
    name: {
      en: "Shea & argan repair mask",
      fr: "Masque réparateur karité & argan",
    },
    brand: "Botaniqa Lab",
    category: { en: "Mask", fr: "Masque" },
    ingredientsText:
      "Aqua, Cetearyl Alcohol, Butyrospermum Parkii Butter, Argania Spinosa Kernel Oil, Glycerin, Hydrolyzed Keratin, Panthenol, Parfum",
    ingredients: [],
    source: "local",
  },
  {
    barcode: "2000000000031",
    name: {
      en: "Daily volume shampoo",
      fr: "Shampoing volume quotidien",
    },
    brand: "Clarté",
    category: { en: "Shampoo", fr: "Shampoing" },
    ingredientsText:
      "Aqua, Sodium Laureth Sulfate, Sodium Chloride, Dimethicone, Cocamidopropyl Betaine, Parfum, Methylparaben",
    ingredients: [],
    source: "local",
  },
  {
    barcode: "2000000000048",
    name: {
      en: "Castor oil growth & strengthening",
      fr: "Huile de ricin pousse & fortifiant",
    },
    brand: "Racines",
    category: { en: "Oil", fr: "Huile" },
    ingredientsText: "Ricinus Communis Seed Oil, Simmondsia Chinensis Seed Oil, Tocopherol",
    ingredients: [],
    source: "local",
  },
  {
    barcode: "2000000000055",
    name: {
      en: "Strong-hold curl definition gel",
      fr: "Gel définition boucles fixation forte",
    },
    brand: "Curl Studio",
    category: { en: "Styling", fr: "Coiffant" },
    ingredientsText:
      "Aqua, Alcohol Denat, PVP, Glycerin, Aloe Barbadensis Leaf Juice, Parfum, Sodium Lauryl Sulfate",
    ingredients: [],
    source: "local",
  },
];

DEMO_CATALOG.forEach((p) => (p.ingredients = parseIngredients(p.ingredientsText)));

const DEMO_BY_BARCODE = new Map(DEMO_CATALOG.map((p) => [p.barcode, p]));

function localizeCatalogEntry(entry: CatalogEntry, locale: Locale): Product {
  return {
    barcode: entry.barcode,
    name: entry.name[locale],
    brand: entry.brand,
    category: entry.category[locale],
    imageUrl: entry.imageUrl,
    ingredientsText: entry.ingredientsText,
    ingredients: entry.ingredients,
    source: entry.source,
  };
}

/** Localize a product for display (demo catalog entries + fallback for remote products). */
export function localizeProduct(product: Product, locale: Locale): Product {
  const demo = DEMO_BY_BARCODE.get(product.barcode);
  if (demo) return localizeCatalogEntry(demo, locale);
  return product;
}

/** Products available for recommendation purposes (report page, etc.). */
export function getCatalog(locale: Locale = "fr"): Product[] {
  return DEMO_CATALOG.map((p) => localizeCatalogEntry(p, locale));
}
