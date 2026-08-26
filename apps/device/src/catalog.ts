/**
 * The demo catalog - 8 products matching the synthetic warehouse's world
 * (categories + price bands from packages/core/src/warehouse/seed.ts).
 * The first three ids predate the redesign and are kept for event continuity.
 *
 * Photography: Unsplash License (free commercial use, no attribution required),
 * downloaded once and bundled so the offline demo makes zero runtime fetches.
 * Photo ids under unsplash.com/photos/ - wax-canvas-jacket 1544022613-e87ca75a784a,
 * chore-coat 1516257984-b1b4d707412e, flannel-overshirt 1596755094514-f87e34085b2c,
 * leather-moto 1551028719-00167b16eac5, lace-up-boot 1608256246200-53e635b5b65f,
 * utility-pant 1473966968600-fa801b869a1a, rib-beanie 1510598969022-c4c6c5d05769,
 * day-pack 1553062407-98eeb64c6a62, masthead 1490481651871-ab68de25d43d.
 */

export type Category = "Outerwear" | "Workwear" | "Footwear" | "Accessories";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  image: number; // static require - Metro bundles it
  detail: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "wax-canvas-jacket",
    name: "Waxed Field Jacket",
    category: "Outerwear",
    price: 248,
    image: require("../assets/products/wax-canvas-jacket.jpg"),
    detail: "Dry-waxed organic cotton, corozo buttons. Re-wax yearly; it only gets better.",
  },
  {
    id: "chore-coat",
    name: "Denim Chore Jacket",
    category: "Outerwear",
    price: 186,
    image: require("../assets/products/chore-coat.jpg"),
    detail: "14 oz sanforized denim, triple-needle seams. Breaks in, never breaks down.",
  },
  {
    id: "flannel-overshirt",
    name: "Chambray Overshirt",
    category: "Workwear",
    price: 98,
    image: require("../assets/products/flannel-overshirt.jpg"),
    detail: "Mid-weight chambray, cat-eye buttons. Wear open over a tee or buttoned to the top.",
  },
  {
    id: "utility-pant",
    name: "Cotton Utility Pant",
    category: "Workwear",
    price: 128,
    image: require("../assets/products/utility-pant.jpg"),
    detail: "Garment-dyed cotton twill, gusseted crotch, tool pocket. Cut straight, sits easy.",
  },
  {
    id: "leather-moto",
    name: "Leather Moto Jacket",
    category: "Outerwear",
    price: 342,
    image: require("../assets/products/leather-moto.jpg"),
    detail: "Vegetable-tanned cowhide, YKK Excella zips. Heavy now, perfect in five years.",
  },
  {
    id: "lace-up-boot",
    name: "Leather Lace-Up Boot",
    category: "Footwear",
    price: 198,
    image: require("../assets/products/lace-up-boot.jpg"),
    detail: "Full-grain leather, Goodyear welt, resolable. Wear them to work, wear them out.",
  },
  {
    id: "rib-beanie",
    name: "Ribbed Knit Beanie",
    category: "Accessories",
    price: 38,
    image: require("../assets/products/rib-beanie.jpg"),
    detail: "Three-gauge merino rib, fisherman roll. One size, every head.",
  },
  {
    id: "day-pack",
    name: "Canvas Day Pack",
    category: "Accessories",
    price: 88,
    image: require("../assets/products/day-pack.jpg"),
    detail: "Bonded canvas, padded 15\" sleeve, storm flap. Commute-proof.",
  },
];

export const MASTHEAD = require("../assets/editorial/masthead.jpg");

export const SIZES = ["XS", "S", "M", "L", "XL"] as const;
export type Size = (typeof SIZES)[number];
