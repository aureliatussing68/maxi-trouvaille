"use client";

import { useState } from "react";
import { Check, Loader2, Mail, Save } from "lucide-react";
import { supportCategoryLabel, supportStatusLabel } from "@/lib/support-ai";

type SupportReplyCardProps = {
  messageId: string;
  customerEmail: string;
  productName: string;
  supportCategory?: string;
  supportStatus?: string;
  supportDraft?: string;
  supportDraftSource?: string;
  supportDraftModel?: string;
  supportReason?: string;
  supportSentAt?: string;
};

function statusTone(status: string | undefined) {
  if (status === "envoye") {
    return "bg-[#eef8f6] text-teal";
  }

  if (status === "brouillon") {
    return "bg-[#f6f1e8] text-foreground";
  }

  return "bg-[#fff1f2] text-rose";
}

export function SupportReplyCard(props: SupportReplyCardProps) {
  const [draft, setDraft] = useState(props.supportDraft ?? "");
  const [status, setStatus] = useState(props.supportStatus);
  const [sentAt, setSentAt] = useState(props.supportSentAt);
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const [feedback, setFeedback] = useState("");

  // Aucun brouillon : l'assistant n'est pas actif ou ce message est anterieur.
  if (!props.supportDraft && !props.supportStatus) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-line p-4 text-sm font-bold text-muted">
        Aucune proposition de reponse pour ce message.
      </div>
    );
  }

  async function patchMessage(nextStatus: string) {
    setBusy(nextStatus === "envoye" ? "send" : "save");
    setFeedback("");

    try {
      const response = await fetch(`/api/admin/messages/${props.messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportDraft: draft,
          supportStatus: nextStatus,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        emailSent?: boolean;
        message?: { supportStatus?: string; supportSentAt?: string };
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Enregistrement impossible.");
      }

      setStatus(data.message?.supportStatus);
      setSentAt(data.message?.supportSentAt);

      if (nextStatus === "envoye") {
        // Le serveur n'a pas pu envoyer (pas de service d'email configure) :
        // on ouvre le logiciel de messagerie, comme avant.
        if (!data.emailSent) {
          openMailClient();
        }

        setFeedback(
          data.emailSent
            ? "Reponse envoyee au client par email."
            : "Marque comme envoye. Ton logiciel de messagerie s'ouvre pour envoyer la reponse.",
        );
      } else {
        setFeedback("Brouillon enregistre.");
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy("");
    }
  }

  function openMailClient() {
    const subject = `Votre message - ${props.productName}`;
    const href = `mailto:${props.customerEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(draft)}`;
    window.location.href = href;
  }

  async function sendReply() {
    // patchMessage ouvre lui-meme le logiciel de messagerie si le serveur
    // n'a pas envoye l'email : jamais deux fois la meme reponse au client.
    await patchMessage("envoye");
  }

  return (
    <div className="mt-4 rounded-md border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#f6f1e8] px-3 py-1 text-xs font-black uppercase text-foreground">
          {supportCategoryLabel(props.supportCategory)}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusTone(status)}`}
        >
          {supportStatusLabel(status)}
        </span>
        <span className="text-xs font-bold text-muted">
          {props.supportDraftSource === "ia"
            ? `Redige par l'IA${props.supportDraftModel ? ` (${props.supportDraftModel})` : ""}`
            : "Modele pre-ecrit gratuit"}
        </span>
      </div>

      {props.supportReason ? (
        <p className="mt-3 text-xs font-bold leading-5 text-muted">
          Pourquoi : {props.supportReason}
        </p>
      ) : null}

      {sentAt ? (
        <p className="mt-2 text-xs font-bold text-teal">
          Envoye le {new Date(sentAt).toLocaleString("fr-FR")}
        </p>
      ) : null}

      <label className="mt-3 grid gap-2 text-sm font-bold">
        Reponse proposee (modifiable avant envoi)
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={9}
          className="focus-ring rounded-md border border-line px-3 py-3 text-sm leading-6"
        />
      </label>

      {feedback ? (
        <div className="mt-3 rounded-md bg-[#f6f1e8] p-3 text-sm font-bold text-foreground">
          {feedback}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={sendReply}
          disabled={busy !== "" || !draft.trim()}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {busy === "send" ? (
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <Mail size={16} aria-hidden="true" />
          )}
          Envoyer la reponse au client
        </button>

        <button
          type="button"
          onClick={() => patchMessage("brouillon")}
          disabled={busy !== "" || !draft.trim()}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-black hover:bg-[#f6f1e8] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {busy === "save" ? (
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <Save size={16} aria-hidden="true" />
          )}
          Enregistrer le brouillon
        </button>

        {status === "envoye" ? (
          <span className="inline-flex items-center gap-2 text-sm font-black text-teal">
            <Check size={16} aria-hidden="true" />
            Traite
          </span>
        ) : null}
      </div>
    </div>
  );
}
