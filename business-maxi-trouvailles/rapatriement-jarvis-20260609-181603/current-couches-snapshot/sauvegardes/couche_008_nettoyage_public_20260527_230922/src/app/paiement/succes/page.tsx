import type { Metadata } from "next";
import { OrderSuccess } from "@/components/OrderSuccess";

export const metadata: Metadata = {
  title: "Paiement test confirme",
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

  return <OrderSuccess sessionId={sessionId} />;
}
