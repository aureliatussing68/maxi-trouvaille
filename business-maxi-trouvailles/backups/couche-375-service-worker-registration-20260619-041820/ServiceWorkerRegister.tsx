"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalApp =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!window.isSecureContext && !isLocalApp) {
      return;
    }

    const registerWorker = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // L'installation PWA ne doit jamais bloquer l'achat ni l'ajout rapide.
      });
    };

    if (document.readyState === "complete") {
      registerWorker();
      return;
    }

    window.addEventListener("load", registerWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerWorker);
    };
  }, []);

  return null;
}
