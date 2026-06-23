import { Rng } from "../shared/rng.js";
import { DIMENSIONS } from "../warehouse/config.js";

export type CreativeStyle = "product_drop" | "evergreen" | "promotional" | "ugc";

export interface Creative {
  id: string;
  intendedStyle: CreativeStyle;
  text: string;
}

const TEMPLATES: Record<CreativeStyle, (c: string, extra: string) => string> = {
  product_drop: (c, coll) =>
    `Just dropped: the ${coll} ${c} collection. Limited first run — shop the new arrivals before they're gone.`,
  evergreen: (c) => `Discover timeless ${c} essentials, crafted to last. Free shipping on every order, always.`,
  promotional: (c, pct) => `${pct}% OFF all ${c} this weekend only! Use code SAVE${pct}. Don't miss these deals.`,
  ugc: (c) => `"I basically live in these ${c} now" — real reviews from real customers. See why they're obsessed.`,
};

const COLLECTIONS = ["Fall Flagship", "Workwear Edit", "Core", "Summer Capsule"];

/** Deterministically generate a varied set of ad creatives to fan-out classify. */
export function generateCreatives(seed: number, perStyle = 9): Creative[] {
  const rng = new Rng(seed);
  const styles: CreativeStyle[] = ["product_drop", "evergreen", "promotional", "ugc"];
  const creatives: Creative[] = [];
  for (const style of styles) {
    for (let i = 0; i < perStyle; i++) {
      const category = rng.pick(DIMENSIONS.categories);
      const extra = style === "promotional" ? String(rng.pick([15, 20, 25, 30])) : rng.pick(COLLECTIONS);
      creatives.push({ id: `${style}_${i + 1}`, intendedStyle: style, text: TEMPLATES[style](category, extra) });
    }
  }
  return rng.shuffle(creatives);
}
