"use client";

import { Search, Truck } from "lucide-react";
import { useState } from "react";

export function TrackingLookupForm() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [message, setMessage] = useState(
    "Entrez le numéro transmis par Maxi Trouvaille.",
  );

  function lookupTracking() {
    if (!trackingNumber.trim()) {
      setMessage("Ajoutez un numéro de suivi pour lancer la recherche.");
      return;
    }

    setMessage(
      "Si le suivi n'apparaît pas encore, le service client Maxi Trouvaille peut vérifier ce numéro.",
    );
  }

  return (
    <div className="rounded-lg border border-line bg-paper p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
          <Truck size={22} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-black">Suivre un colis</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{message}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
          className="focus-ring min-h-12 flex-1 rounded-md border border-line px-3 text-base"
          placeholder="Ex : LP123456789FR"
        />
        <button
          type="button"
          onClick={lookupTracking}
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
        >
          <Search size={18} aria-hidden="true" />
          Rechercher
        </button>
      </div>
    </div>
  );
}
