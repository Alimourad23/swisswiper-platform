/* SwissWiper pricing engine — pure, config-driven, reusable everywhere (internal
   calculator, partner portal, public website API). No side effects: give it a
   config + a configuration, get a price + a full breakdown back.

   Model (v1, parametric): per unit,
     price = base + glassArea(m²) × glassRate + finishSurcharge + Σ hardware,
   floored at minPrice, rounded. Partner/discount is a layer on top of the list
   total. Rates are placeholders until Etienne confirms real cost drivers. */

export type GlassType = { key: string; name: string; ratePerM2: number };
export type Finish = { key: string; name: string; surcharge: number };
export type Hardware = { key: string; name: string; price: number };

export type PricingConfig = {
  currency: string; // e.g. "CHF"
  basePrice: number; // fixed base/handling per unit
  glassTypes: GlassType[];
  finishes: Finish[];
  hardware: Hardware[];
  minPrice: number; // price floor per unit
  maxDiscountPct: number; // guardrail: no partner discount beyond this
  rounding: number; // round unit price to nearest (0 = nearest 1)
  note?: string; // e.g. "Example rates — edit in Rates"
};

export type LineInput = {
  widthMm: number;
  heightMm: number;
  glass: string; // GlassType.key
  finish: string; // Finish.key
  hardware?: string[]; // Hardware.key[]
  quantity: number;
};

export type LineBreakdown = {
  label: string;
  areaM2: number;
  base: number;
  glass: number;
  finish: number;
  hardware: number;
  unit: number; // per-unit list price
  quantity: number;
  lineTotal: number; // unit × quantity
};

export type QuoteResult = {
  currency: string;
  lines: LineBreakdown[];
  listTotal: number;
};

function round(n: number, step: number): number {
  if (step && step > 0) return Math.round(n / step) * step;
  return Math.round(n);
}

/* Placeholder default config — clearly example rates until Etienne's numbers are in. */
export const DEFAULT_CONFIG: PricingConfig = {
  currency: "CHF",
  basePrice: 150,
  glassTypes: [
    { key: "clear8", name: "8mm Clear", ratePerM2: 220 },
    { key: "clear10", name: "10mm Clear", ratePerM2: 280 },
    { key: "lowiron10", name: "10mm Low-iron", ratePerM2: 360 },
  ],
  finishes: [
    { key: "polished", name: "Polished silver", surcharge: 0 },
    { key: "matteblack", name: "Matte black", surcharge: 120 },
    { key: "brushedbrass", name: "Brushed brass", surcharge: 180 },
  ],
  hardware: [
    { key: "standard", name: "Standard wiper + care kit", price: 90 },
    { key: "premium", name: "Premium wiper + care kit", price: 160 },
  ],
  minPrice: 350,
  maxDiscountPct: 40,
  rounding: 5,
  note: "Example rates — edit these in Pricing → Rates before quoting for real.",
};

export function priceLine(config: PricingConfig, line: LineInput): LineBreakdown {
  const areaM2 = Math.max(0, (line.widthMm * line.heightMm) / 1_000_000);
  const glassRate = config.glassTypes.find((g) => g.key === line.glass)?.ratePerM2 ?? 0;
  const glass = areaM2 * glassRate;
  const finish = config.finishes.find((f) => f.key === line.finish)?.surcharge ?? 0;
  const hardware = (line.hardware ?? []).reduce(
    (sum, k) => sum + (config.hardware.find((h) => h.key === k)?.price ?? 0),
    0,
  );
  let unit = config.basePrice + glass + finish + hardware;
  unit = Math.max(unit, config.minPrice);
  unit = round(unit, config.rounding);
  const quantity = Math.max(1, Math.round(line.quantity || 1));
  const glassName = config.glassTypes.find((g) => g.key === line.glass)?.name ?? line.glass;
  const finishName = config.finishes.find((f) => f.key === line.finish)?.name ?? line.finish;
  return {
    label: `${line.widthMm}×${line.heightMm}mm · ${glassName} · ${finishName}`,
    areaM2: Math.round(areaM2 * 100) / 100,
    base: config.basePrice,
    glass: Math.round(glass * 100) / 100,
    finish,
    hardware,
    unit,
    quantity,
    lineTotal: unit * quantity,
  };
}

export function priceQuote(config: PricingConfig, lines: LineInput[]): QuoteResult {
  const priced = lines.filter((l) => l.widthMm > 0 && l.heightMm > 0).map((l) => priceLine(config, l));
  return {
    currency: config.currency,
    lines: priced,
    listTotal: priced.reduce((sum, l) => sum + l.lineTotal, 0),
  };
}

/* Apply a partner discount to a list total, clamped by the config guardrail. */
export function applyDiscount(config: PricingConfig, listTotal: number, discountPct: number) {
  const pct = Math.min(Math.max(0, discountPct || 0), config.maxDiscountPct);
  const net = Math.round(listTotal * (1 - pct / 100) * 100) / 100;
  return { discountPct: pct, net, saved: Math.round((listTotal - net) * 100) / 100 };
}
