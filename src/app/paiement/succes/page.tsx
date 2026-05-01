import type { Metadata } from "next";
import { OrderSuccess } from "@/components/OrderSuccess";

export const metadata: Metadata = {
  title: "Paiement test confirme",
};

export default function PaymentSuccessPage() {
  return <OrderSuccess />;
}
