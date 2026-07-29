import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Product, Size } from "./catalog";

export interface CartLine {
  product: Product;
  size: Size;
  qty: number;
}

interface CartApi {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add(product: Product, size: Size): void;
  setQty(productId: string, size: Size, qty: number): void;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((product: Product, size: Size) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === product.id && l.size === size);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i]!, qty: next[i]!.qty + 1 };
        return next;
      }
      return [...prev, { product, size, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((productId: string, size: Size, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => !(l.product.id === productId && l.size === size))
        : prev.map((l) => (l.product.id === productId && l.size === size ? { ...l, qty } : l)),
    );
  }, []);

  const api = useMemo<CartApi>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + l.qty * l.product.price, 0);
    return { lines, count, subtotal, add, setQty };
  }, [lines, add, setQty]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const api = useContext(CartContext);
  if (!api) throw new Error("useCart outside CartProvider");
  return api;
}
