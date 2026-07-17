import type { Metadata } from "next";
import Link from "next/link";
import { DropshippingAdminPanel } from "@/components/DropshippingAdminPanel";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";
import { categories } from "@/lib/catalog";
import { readQuickProducts } from "@/lib/catalog-server";
import {
  getDropshippingConnectorStatus,
  readDropshippingOrders,
} from "@/lib/dropshipping-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin produits partenaires",
};

type AdminDropshippingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminDropshippingPage({
  searchParams,
}: AdminDropshippingPageProps) {
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

  const [orders, connectorStatus, quickProducts] = await Promise.all([
    readDropshippingOrders(),
    Promise.resolve(getDropshippingConnectorStatus()),
    readQuickProducts(),
  ]);
  const partnerDraftProducts = quickProducts.filter(
    (product) => product.status === "draft" && product.dropshipping?.enabled,
  );
  const dropshippingCategories = categories.filter(
    (category) => category.id === "dropshipping" || category.parentId === "dropshipping",
  );
  const query = searchParams ? await searchParams : {};
  const categoryId = getSearchParamValue(query, "categoryId");
  const prefillCategoryId = dropshippingCategories.some(
    (category) => category.id === categoryId,
  )
    ? categoryId
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Produits partenaires - Commandes à traiter"
        description="Tableau de bord semi-automatique : validation humaine obligatoire avant toute commande fournisseur."
      />
      <section className="container-page pt-8">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/pilotage"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Ouvrir le pilotage
          </Link>
          <Link
            href="/admin/selection-produits"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
          >
            Voir la sélection fournisseurs à valider
          </Link>
          <Link
            href="/admin/decision-hold"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
          >
            Décision HOLD compacte
          </Link>
        </div>
      </section>
      <DropshippingAdminPanel
        initialOrders={orders}
        initialDraftProducts={partnerDraftProducts}
        connectorStatus={connectorStatus}
        dropshippingCategories={dropshippingCategories}
        prefill={{
          candidateId: getSearchParamValue(query, "candidateId"),
          candidateCategory: getSearchParamValue(query, "candidateCategory"),
          sourceMode: getSearchParamValue(query, "sourceMode"),
          sourceGeneratedAt: getSearchParamValue(query, "sourceGeneratedAt"),
          title: getSearchParamValue(query, "title"),
          supplierUrl: getSearchParamValue(query, "supplierUrl"),
          categoryId: prefillCategoryId,
          description: getSearchParamValue(query, "description"),
          deliveryEstimate: getSearchParamValue(query, "deliveryEstimate"),
        }}
      />
    </>
  );
}
