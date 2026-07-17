import type { Metadata } from "next";
import { CustomerJourneyPanel } from "@/components/CustomerJourneyPanel";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { OrderSuccess } from "@/components/OrderSuccess";

export const metadata: Metadata = {
  title: "Paiement confirme",
  robots: {
    index: false,
    follow: false,
  },
};

type PaymentSuccessPageProps = {
  searchParams?: Promise<{ session_id?: string | string[] }>;
};

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const query = searchParams ? await searchParams : {};
  const sessionId =
    typeof query.session_id === "string" ? query.session_id : undefined;

  return (
    <>
      <OrderSuccess sessionId={sessionId} />
      <section className="container-page pb-12">
        <CustomerJourneyPanel />
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
    </>
  );
}
