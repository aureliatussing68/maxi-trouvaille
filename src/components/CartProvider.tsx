"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clampQuantity } from "@/lib/format";

const CART_STORAGE_KEY = "maxi-trouvaille-cart-v1";

export type CartLine = {
  productId: string;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  totalQuantity: number;
  addItem: (productId: string, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

type EligibleCartItem = {
  id: string;
  stock: number;
};

type EligibleCartResponse = {
  items?: EligibleCartItem[];
};

const CartContext = createContext<CartContextValue | null>(null);

function sanitizeCart(input: unknown): CartLine[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const quantitiesById = new Map<string, number>();

  input.forEach((line) => {
    if (
      !line ||
      typeof line !== "object" ||
      !("productId" in line) ||
      !("quantity" in line)
    ) {
      return;
    }

    const productId = String(line.productId);
    if (!productId) {
      return;
    }

    quantitiesById.set(
      productId,
      (quantitiesById.get(productId) ?? 0) + Number(line.quantity),
    );
  });

  return [...quantitiesById.entries()].map(([productId, quantity]) => ({
    productId,
    quantity: clampQuantity(quantity),
  }));
}

function reconcileCartItems(
  currentItems: CartLine[],
  eligibleItems: EligibleCartItem[],
) {
  const eligibilityById = new Map(
    eligibleItems
      .filter((item) => typeof item.stock === "number" && item.stock > 0)
      .map((item) => [item.id, item.stock]),
  );
  let changed = false;

  const nextItems = currentItems.flatMap((item) => {
    const eligibleStock = eligibilityById.get(item.productId);
    if (!eligibleStock) {
      changed = true;
      return [];
    }

    const quantity = clampQuantity(item.quantity, eligibleStock);
    if (quantity !== item.quantity) {
      changed = true;
    }

    return [{ productId: item.productId, quantity }];
  });

  return changed ? nextItems : currentItems;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
          setItems(sanitizeCart(JSON.parse(storedCart)));
        }
      } catch {
        setItems([]);
      } finally {
        setIsHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [isHydrated, items]);

  useEffect(() => {
    if (!isHydrated || items.length === 0) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/cart/eligible-items", {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as EligibleCartResponse;
        if (cancelled || !Array.isArray(payload.items)) {
          return;
        }

        setItems((currentItems) =>
          reconcileCartItems(currentItems, payload.items ?? []),
        );
      } catch {
        // The checkout API remains the final guard if this read-only sync fails.
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isHydrated, items.length]);

  const addItem = useCallback((productId: string, quantity = 1) => {
    if (!productId) {
      return;
    }

    setItems((currentItems) => {
      const existing = currentItems.find((item) => item.productId === productId);
      const nextQuantity = existing
        ? existing.quantity + quantity
        : quantity;
      const cappedQuantity = clampQuantity(nextQuantity);

      if (!existing) {
        return [...currentItems, { productId, quantity: cappedQuantity }];
      }

      return currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: cappedQuantity,
            }
          : item,
      );
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((currentItems) => {
      if (quantity <= 0) {
        return currentItems.filter((item) => item.productId !== productId);
      }

      return currentItems.map((item) =>
        item.productId === productId
          ? { ...item, quantity: clampQuantity(quantity) }
          : item,
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

  const value = useMemo(
    () => ({
      items,
      totalQuantity,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [
      items,
      totalQuantity,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
