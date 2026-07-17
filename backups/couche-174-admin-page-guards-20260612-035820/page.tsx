import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { formatPrice } from "@/lib/format";
import { readProductMessages } from "@/lib/product-messages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages produits",
};

export default async function AdminMessagesPage() {
  const messages = await readProductMessages();

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Messages produits"
        description="Messages envoyés depuis les fiches produits. Interface simple pour répondre ensuite par email."
      />
      <section className="container-page py-8">
        {messages.length > 0 ? (
          <div className="grid gap-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className="rounded-lg border border-line bg-paper p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <p className="text-sm font-black uppercase text-teal">
                      {message.customerName}
                    </p>
                    <a
                      href={`mailto:${message.customerEmail}`}
                      className="mt-1 block text-sm font-bold text-muted hover:text-teal"
                    >
                      {message.customerEmail}
                    </a>
                  </div>
                  <div className="text-sm font-bold text-muted">
                    {new Date(message.createdAt).toLocaleString("fr-FR")}
                  </div>
                </div>

                <div className="mt-4 rounded-md bg-[#f6f1e8] p-4">
                  <div className="font-black">{message.productName}</div>
                  <div className="mt-1 text-sm font-bold text-muted">
                    {formatPrice(message.productPrice)} - ID {message.productId}
                  </div>
                  {message.productUrl ? (
                    <Link
                      href={message.productUrl}
                      className="mt-2 inline-flex text-sm font-black text-teal hover:text-foreground"
                    >
                      Voir le produit
                    </Link>
                  ) : null}
                </div>

                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">
                  {message.message}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
            <MessageCircle className="mx-auto mb-4 text-teal" size={40} aria-hidden="true" />
            <h2 className="text-2xl font-black">Aucun message pour le moment</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              Les demandes clients envoyées depuis les fiches produits
              apparaîtront ici.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
