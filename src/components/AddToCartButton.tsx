"use client";

import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";

type AddToCartButtonProps = {
  productId: string;
  label?: string;
  disabledLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function AddToCartButton({
  productId,
  label = "Ajouter au panier",
  disabledLabel = "Rupture de stock",
  className = "",
  disabled = false,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [feedback, setFeedback] = useState(false);

  function handleClick() {
    if (disabled) {
      return;
    }

    addItem(productId);
    setFeedback(true);
    window.setTimeout(() => setFeedback(false), 1100);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:bg-muted ${className}`}
    >
      <ShoppingCart size={18} aria-hidden="true" />
      {disabled ? disabledLabel : feedback ? "Ajoute" : label}
    </button>
  );
}
