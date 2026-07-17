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
import {
  getProductById,
  isProductPurchasable,
  products,
  type Product,
} from "@/lib/catalog";
import { clampQuantity } from "@/lib/format";
import {
  QUICK_PRODUCTS_UPDATED_EVENT,
  sanitizeQuickProducts,
} from "@/lib/quick-products";

const CART_STORAGE_KEY = "maxi-trouvaille-cart-v1";

export type CartLine = {
  productId: string;
  quantity: number;
};

export type DetailedCartLine = CartLine & {
  product: Product;
  lineTotal: number;
};

type CartContextValue = {
  items: CartLine[];
  detailedItems: DetailedCartLine[];
  subtotal: number;
  totalQuantity: number;
  addItem: (productId: string, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function sanitizeCart(input: unknown): CartLine[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((line) => {
      if (
        !line ||
        typeof line !== "object" ||
        !("productId" in line) ||
        !("quantity" in line)
      ) {
        return null;
      }

      const productId = String(line.productId);

      return {
        productId,
        quantity: clampQuantity(Number(line.quantity)),
      };
    })
    .filter((line): line is CartLine => Boolean(line));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [quickProducts, setQuickProducts] = useState<Product[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [quickProductsLoaded, setQuickProductsLoaded] = useState(false);

  const productMap = useMemo(() => {
    return new Map(
      [...products, ...quickProducts].map((product) => [product.id, product]),
    );
  }, [quickProducts]);

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
    let isMounted = true;

    async function loadQuickProducts() {
      try {
        const response = await fetch("/api/admin/products", { cache: "no-store" });
        const data = (await response.json()) as { products?: unknown };

        if (isMounted) {
          setQuickProducts(sanitizeQuickProducts(data.products));
        }
      } catch {
        if (isMounted) {
          setQuickProducts([]);
        }
      } finally {
        if (isMounted) {
          setQuickProductsLoaded(true);
        }
      }
    }

    function handleProductsUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ products?: unknown }>;
      setQuickProducts(sanitizeQuickProducts(customEvent.detail?.products));
      setQuickProductsLoaded(true);
    }

    loadQuickProducts();
    window.addEventListener(QUICK_PRODUCTS_UPDATED_EVENT, handleProductsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener(
        QUICK_PRODUCTS_UPDATED_EVENT,
        handleProductsUpdated,
      );
    };
  }, []);

  useEffect(() => {
    if (isHydrated) {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [isHydrated, items]);

  useEffect(() => {
    if (!isHydrated || !quickProductsLoaded) {
      return;
    }

    const timer = window.setTimeout(() => {
      setItems((currentItems) => {
        let changed = false;
        const nextItems = currentItems.flatMap((item) => {
          const product = productMap.get(item.productId);

          if (!product || !isProductPurchasable(product)) {
            changed = true;
            return [];
          }

          const quantity = clampQuantity(item.quantity, product.stock);
          if (quantity !== item.quantity) {
            changed = true;
          }

          return [{ productId: item.productId, quantity }];
        });

        return changed ? nextItems : currentItems;
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isHydrated, productMap, quickProductsLoaded]);

  const addItem = useCallback((productId: string, quantity = 1) => {
    const product = productMap.get(productId);
    if (!product || !isProductPurchasable(product)) {
      return;
    }

    setItems((currentItems) => {
      const existing = currentItems.find((item) => item.productId === productId);
      const nextQuantity = existing
        ? existing.quantity + quantity
        : quantity;
      const cappedQuantity = clampQuantity(nextQuantity, product.stock);

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
  }, [productMap]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const product = productMap.get(productId);

    setItems((currentItems) => {
      if (quantity <= 0 || !product || !isProductPurchasable(product)) {
        return currentItems.filter((item) => item.productId !== productId);
      }

      return currentItems.map((item) =>
        item.productId === productId
          ? { ...item, quantity: clampQuantity(quantity, product.stock) }
          : item,
      );
    });
  }, [productMap]);

  const removeItem = useCallback((productId: string) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.productId !== productId),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const detailedItems = useMemo<DetailedCartLine[]>(() => {
    return items
      .map((item) => {
        const product = productMap.get(item.productId) ?? getProductById(item.productId);
        if (!product || !isProductPurchasable(product)) {
          return null;
        }
        const quantity = clampQuantity(item.quantity, product.stock);

        return {
          productId: item.productId,
          quantity,
          product,
          lineTotal: product.price * quantity,
        };
      })
      .filter((line): line is DetailedCartLine => Boolean(line));
  }, [items, productMap]);

  const subtotal = detailedItems.reduce((total, item) => total + item.lineTotal, 0);
  const totalQuantity = detailedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const value = useMemo(
    () => ({
      items,
      detailedItems,
      subtotal,
      totalQuantity,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [
      items,
      detailedItems,
      subtotal,
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
