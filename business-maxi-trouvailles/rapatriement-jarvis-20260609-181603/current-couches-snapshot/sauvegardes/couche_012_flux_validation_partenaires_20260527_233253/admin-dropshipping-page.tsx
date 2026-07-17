import type { Metadata } from "next";
import Link from "next/link";
import { DropshippingAdminPanel } from "@/components/DropshippingAdminPanel";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";
import { categories } from "@/lib/catalog";
import {
  getDropshippingConnectorStatus,
  readDropshippingOrders,
} from "@/lib/dropshipping-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin produits partenaires",
};

export default async function AdminDropshippingPage() {
  const adminEnabled = isAdminModeEnabled();

  if (!adminEnabled) {
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="Produits partenaires verrouillés"
          description="Activez ADMIN_MODE=true dans l'environnement local pour ouvrir cette page."
        />
        <section className="container-page py-10">
          <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
            Le mode admin est désactivé.
          </div>
        </section>
      </>
    );
  }

  const [orders, connectorStatus] = await Promise.all([
    readDropshippingOrders(),
    Promise.resolve(getDropshippingConnectorStatus()),
  ]);
  const dropshippingCategories = categories.filter(
    (category) => category.id === "dropshipping" || category.parentId === "dropshipping",
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Produits partenaires - Commandes à traiter"
        description="Tableau de bord semi-automatique : validation humaine obligatoire avant toute commande fournisseur."
      />
      <section className="container-page pt-8">
        <Link
          href="/admin/selection-produits"
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
        >
          Voir la sélection fournisseurs à valider
        </Link>
      </section>
      <DropshippingAdminPanel
        initialOrders={orders}
        connectorStatus={connectorStatus}
        dropshippingCategories={dropshippingCategories}
      />
    </>
  );
}
