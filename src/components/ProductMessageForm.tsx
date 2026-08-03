"use client";

import { FormEvent, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { formatPrice } from "@/lib/format";

type ProductMessageFormProps = {
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
  };
};

const defaultMessage = "Bonjour, ce produit est-il toujours disponible ?";

export function ProductMessageForm({ product }: ProductMessageFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [feedback, setFeedback] = useState("");

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setFeedback("");

    try {
      const productUrl =
        typeof window === "undefined"
          ? `/produit/${product.slug}`
          : `${window.location.origin}/produit/${product.slug}`;
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          message,
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          productUrl,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        autoReply?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Message impossible a envoyer.");
      }

      setStatus("sent");
      // autoReply n'existe que si la reponse automatique est activee ET
      // autorisee pour ce message. Sinon, comportement inchange.
      setFeedback(
        typeof data.autoReply === "string" && data.autoReply.trim()
          ? data.autoReply.trim()
          : "Message enregistre. Vous pouvez le consulter dans l'admin.",
      );
      setCustomerName("");
      setCustomerEmail("");
      setMessage(defaultMessage);
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error ? error.message : "Message impossible a envoyer.",
      );
    }
  }

  return (
    <section id="message-produit" className="container-page pb-12">
      <div className="rounded-lg border border-line bg-paper p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-1 text-teal" size={24} aria-hidden="true" />
          <div>
            <p className="text-sm font-bold uppercase text-teal">Message</p>
            <h2 className="mt-1 text-2xl font-black">Envoyer un message</h2>
            <p className="mt-2 text-sm font-bold text-muted">
              {product.name} - {formatPrice(product.price)}
            </p>
          </div>
        </div>

        <form onSubmit={submitMessage} className="mt-5 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Nom
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
                className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
                placeholder="Votre nom"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Email
              <input
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                required
                type="email"
                className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
                placeholder="vous@email.fr"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold">
            Message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              rows={5}
              className="focus-ring rounded-md border border-line px-3 py-3 text-base"
            />
          </label>

          {feedback ? (
            <div
              className={`whitespace-pre-line rounded-md p-3 text-sm font-bold ${
                status === "error"
                  ? "bg-[#fff1f2] text-rose"
                  : "bg-[#eef8f6] text-teal"
              }`}
            >
              {feedback}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={status === "sending"}
            className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-bold text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65 sm:w-fit"
          >
            {status === "sending" ? (
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            ) : (
              <Send size={18} aria-hidden="true" />
            )}
            Envoyer le message
          </button>
        </form>
      </div>
    </section>
  );
}
