"use client";

import { useEffect, useMemo, useState } from "react";
// Type volontairement pris dans catalog-client : cote navigateur, un produit
// est sa version PUBLIQUE (sans prix d'achat, marge ni source fournisseur).
import type { Product } from "@/lib/catalog-client";
import {
  emptyShippingSelection,
  getAvailableShippingMethods,
  getShippingMethodById,
  getShippingPrice,
  sanitizeShippingSelection,
  SHIPPING_STORAGE_KEY,
  validateShippingSelection,
  type ShippingSelection,
} from "@/lib/shipping";

export function useShippingSelection(products: Product[]) {
  const [selection, setSelection] = useState<ShippingSelection>(
    emptyShippingSelection,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const availableMethods = useMemo(
    () => getAvailableShippingMethods(products),
    [products],
  );
  const effectiveSelection = useMemo(() => {
    if (
      selection.methodId &&
      !availableMethods.some((method) => method.id === selection.methodId)
    ) {
      return { ...selection, methodId: "" as const };
    }

    return selection;
  }, [availableMethods, selection]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(SHIPPING_STORAGE_KEY);
        if (stored) {
          setSelection(sanitizeShippingSelection(JSON.parse(stored)));
        }
      } catch {
        setSelection(emptyShippingSelection);
      } finally {
        setIsHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      SHIPPING_STORAGE_KEY,
      JSON.stringify(effectiveSelection),
    );
  }, [effectiveSelection, isHydrated]);

  const validation = useMemo(
    () => validateShippingSelection(effectiveSelection, products),
    [effectiveSelection, products],
  );
  const selectedMethod = getShippingMethodById(effectiveSelection.methodId);
  const shippingPrice = getShippingPrice(effectiveSelection.methodId);

  return {
    selection: effectiveSelection,
    setSelection,
    availableMethods,
    selectedMethod,
    shippingPrice,
    validation,
    isHydrated,
  };
}
