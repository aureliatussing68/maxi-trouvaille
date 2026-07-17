import { isDropshippingProduct, type Product } from "@/lib/catalog";

export type DropshippingAutomationAlert =
  | {
      type: "stock-low";
      productId: string;
      productName: string;
      message: string;
    }
  | {
      type: "supplier-price-missing";
      productId: string;
      productName: string;
      message: string;
    }
  | {
      type: "supplier-link-missing";
      productId: string;
      productName: string;
      message: string;
    };

export const dropshippingAutomationJobs = [
  {
    id: "supplier-price-sync",
    label: "Synchronisation prix fournisseur",
    mode: "manual-ready",
  },
  {
    id: "supplier-stock-sync",
    label: "Synchronisation stock fournisseur",
    mode: "manual-ready",
  },
  {
    id: "tracking-sync",
    label: "Récupération suivi colis",
    mode: "manual-ready",
  },
  {
    id: "status-sync",
    label: "Changement automatique statuts",
    mode: "manual-ready",
  },
  {
    id: "supplier-alerts",
    label: "Alertes rupture stock et hausse prix",
    mode: "manual-ready",
  },
] as const;

export function buildDropshippingAlerts(products: Product[]) {
  return products.filter(isDropshippingProduct).flatMap((product) => {
    const alerts: DropshippingAutomationAlert[] = [];
    const supplierStock = product.dropshipping?.supplierStock;

    if (!product.dropshipping?.supplierUrl) {
      alerts.push({
        type: "supplier-link-missing",
        productId: product.id,
        productName: product.name,
        message: "Lien fournisseur manquant.",
      });
    }

    if (!product.dropshipping?.supplierPriceCents) {
      alerts.push({
        type: "supplier-price-missing",
        productId: product.id,
        productName: product.name,
        message: "Prix fournisseur manquant.",
      });
    }

    if (typeof supplierStock === "number" && supplierStock <= 3) {
      alerts.push({
        type: "stock-low",
        productId: product.id,
        productName: product.name,
        message: "Stock fournisseur bas.",
      });
    }

    return alerts;
  });
}
